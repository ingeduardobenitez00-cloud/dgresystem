/**
 * Módulo de Almacenamiento Local (IndexedDB) y Sincronización Automática Fuera de Línea
 * Permite tomar fotos de folios sin conexión a internet y subirlas automáticamente a Cloudflare R2 y Firestore al recuperar señal.
 */

import { doc, setDoc, Firestore } from 'firebase/firestore';

export type OfflineFolioItem = {
  id: string; // formato: `${libroId}_${folio}`
  libroId: string;
  folio: number;
  blob: Blob;
  usuario_id: string;
  username: string;
  fecha: string;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  timestamp: number;
  retries: number;
  errorMsg?: string;
};

const DB_NAME = 'DGREC_OFFLINE_STORAGE_V1';
const STORE_NAME = 'offline_folios';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB solo está disponible en el navegador'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('libroId', 'libroId', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = (event: any) => {
      const db = event.target.result as IDBDatabase;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = (event: any) => {
      dbPromise = null;
      reject(event.target.error || new Error('Error al abrir base de datos IndexedDB'));
    };
  });

  return dbPromise;
}

/** Guarda o actualiza un folio en la cola local fuera de línea */
export async function saveOfflineFolio(item: Omit<OfflineFolioItem, 'id' | 'timestamp' | 'retries' | 'status'>): Promise<OfflineFolioItem> {
  const db = await getDb();
  const id = `${item.libroId}_${item.folio}`;
  const record: OfflineFolioItem = {
    ...item,
    id,
    status: 'pending',
    timestamp: Date.now(),
    retries: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);

    req.onsuccess = () => {
      notifySyncListeners({ type: 'queued', item: record });
      resolve(record);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Obtiene todos los folios guardados fuera de línea para un libro específico */
export async function getOfflineFoliosForLibro(libroId: string): Promise<Record<number, OfflineFolioItem>> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('libroId');
      const req = index.getAll(libroId);

      req.onsuccess = () => {
        const items = (req.result || []) as OfflineFolioItem[];
        const map: Record<number, OfflineFolioItem> = {};
        for (const it of items) {
          map[it.folio] = it;
        }
        resolve(map);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Error leyendo folios offline:', err);
    return {};
  }
}

/** Obtiene la cantidad total de folios pendientes de sincronizar en el dispositivo */
export async function getPendingOfflineCount(libroId?: string): Promise<number> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const items = (req.result || []) as OfflineFolioItem[];
        if (libroId) {
          resolve(items.filter(i => i.libroId === libroId && i.status !== 'synced').length);
        } else {
          resolve(items.filter(i => i.status !== 'synced').length);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return 0;
  }
}

/** Elimina un folio de la cola fuera de línea */
export async function removeOfflineFolio(libroId: string, folio: number): Promise<void> {
  try {
    const db = await getDb();
    const id = `${libroId}_${folio}`;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Error eliminando de cola offline:', e);
  }
}

/** Sincroniza un folio individual a Cloudflare R2 y Firestore */
export async function syncSingleFolio(item: OfflineFolioItem, firestore: Firestore): Promise<string> {
  const padFolio = String(item.folio).padStart(4, '0');

  // 1. Subir imagen a Cloudflare R2
  const formData = new FormData();
  formData.append('file', item.blob, `folio_${padFolio}.jpg`);
  formData.append('libroId', item.libroId);
  formData.append('folio', String(item.folio));

  const res = await fetch('/api/r2/upload', {
    method: 'POST',
    body: formData,
  });

  const resData = await res.json();
  if (!res.ok) {
    throw new Error(resData.error || 'Error subiendo imagen a Cloudflare R2');
  }

  const publicUrl = resData.url;

  // 2. Guardar metadatos en Firestore
  const data = {
    folio: item.folio,
    foto: publicUrl,
    usuario_id: item.usuario_id,
    username: item.username,
    fecha: item.fecha,
  };

  await setDoc(doc(firestore, 'libros-escaneo', item.libroId, 'folios', padFolio), data);

  // 3. Eliminar de la base local fuera de línea
  await removeOfflineFolio(item.libroId, item.folio);

  notifySyncListeners({ type: 'synced', item, publicUrl });
  return publicUrl;
}

/** Sincroniza todos los folios pendientes en la memoria local */
export async function syncAllOfflineFolios(
  firestore: Firestore,
  onProgress?: (current: number, total: number, item: OfflineFolioItem) => void
): Promise<{ success: number; failed: number }> {
  const db = await getDb();

  const pendingItems: OfflineFolioItem[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const list = (req.result || []) as OfflineFolioItem[];
      resolve(list.filter(x => x.status !== 'synced'));
    };
    req.onerror = () => reject(req.error);
  });

  if (pendingItems.length === 0) {
    return { success: 0, failed: 0 };
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < pendingItems.length; i++) {
    const it = pendingItems[i];
    onProgress?.(i + 1, pendingItems.length, it);

    try {
      await syncSingleFolio(it, firestore);
      success++;
    } catch (err: any) {
      console.error(`Error sincronizando folio ${it.folio}:`, err);
      failed++;
    }
  }

  // Notificar que la sincronización general finalizó
  notifySyncListeners({ type: 'completed', total: pendingItems.length, success, failed });
  return { success, failed };
}

/* ================= Sistema de Eventos de Sincronización ================= */
type SyncEvent =
  | { type: 'queued'; item: OfflineFolioItem }
  | { type: 'synced'; item: OfflineFolioItem; publicUrl: string }
  | { type: 'completed'; total: number; success: number; failed: number };

type SyncListener = (event: SyncEvent) => void;
const syncListeners = new Set<SyncListener>();

export function subscribeToSyncEvents(listener: SyncListener): () => void {
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}

function notifySyncListeners(event: SyncEvent) {
  syncListeners.forEach(listener => {
    try {
      listener(event);
    } catch (e) {
      console.error('Error en listener de sincronización:', e);
    }
  });
}
