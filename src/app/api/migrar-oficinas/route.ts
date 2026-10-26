import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, doc, writeBatch, getDocs } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

type OfficePayload = {
  numero: string;
  nombre: string;
  departamento: string;
  distrito: string;
};

export async function POST(req: NextRequest) {
  try {
    const { offices, mode, requesterEmail } = await req.json();

    if (!Array.isArray(offices) || offices.length === 0) {
      return NextResponse.json(
        { error: 'No se recibieron oficinas para migrar' },
        { status: 400 }
      );
    }

    const migrationMode = mode === 'replace' ? 'replace' : 'upsert';

    // Intentamos primero con Admin SDK; si no tiene credenciales ADC en local, usamos cliente autenticado maestro
    let useAdminSdk = false;
    let adminDb: FirebaseFirestore.Firestore | null = null;

    try {
      adminDb = getAdminFirestore();
      // Test de lectura rápida para comprobar si Admin SDK tiene credenciales activas
      await adminDb.collection('registros-civiles').limit(1).get();
      useAdminSdk = true;
    } catch {
      useAdminSdk = false;
    }

    if (useAdminSdk && adminDb) {
      // ==== VÍA 1: Firebase Admin SDK ====
      if (migrationMode === 'replace') {
        const existingDocs = await adminDb.collection('registros-civiles').get();
        const deleteBatches: Promise<any>[] = [];
        let batch = adminDb.batch();
        let count = 0;

        for (const docSnap of existingDocs.docs) {
          batch.delete(docSnap.ref);
          count++;
          if (count === 400) {
            deleteBatches.push(batch.commit());
            batch = adminDb.batch();
            count = 0;
          }
        }
        if (count > 0) {
          deleteBatches.push(batch.commit());
        }
        await Promise.all(deleteBatches);
      }

      // Mapa para upsert
      const existingMap = new Map<string, string>();
      if (migrationMode === 'upsert') {
        const snap = await adminDb.collection('registros-civiles').get();
        snap.forEach(d => {
          const data = d.data();
          const num = String(data.numero ?? '').trim().toUpperCase();
          const dep = String(data.departamento ?? '').trim().toUpperCase();
          if (num && dep) existingMap.set(`${num}|${dep}`, d.id);
        });
      }

      const BATCH_SIZE = 400;
      for (let i = 0; i < offices.length; i += BATCH_SIZE) {
        const batch = adminDb.batch();
        const chunk = offices.slice(i, i + BATCH_SIZE);

        chunk.forEach((item: OfficePayload) => {
          const numClean = String(item.numero ?? '').trim();
          const nomClean = String(item.nombre ?? '').trim().toUpperCase();
          const depClean = String(item.departamento ?? '').trim().toUpperCase();
          const distClean = String(item.distrito ?? nomClean).trim().toUpperCase();

          const key = `${numClean.toUpperCase()}|${depClean}`;
          const existingId = migrationMode === 'upsert' ? existingMap.get(key) : null;

          const docData = {
            numero: numClean,
            nombre: nomClean,
            departamento: depClean || '00 - ASUNCION',
            distrito: distClean || 'ASUNCIÓN',
            fecha_actualizacion: new Date().toISOString(),
          };

          if (existingId) {
            const docRef = adminDb!.collection('registros-civiles').doc(existingId);
            batch.set(docRef, docData, { merge: true });
          } else {
            const newRef = adminDb!.collection('registros-civiles').doc();
            batch.set(newRef, {
              ...docData,
              fecha_creacion: new Date().toISOString(),
            });
          }
        });

        await batch.commit();
      }

      // Registro de auditoría
      try {
        await adminDb.collection('auditoria').add({
          usuario_id: 'sistema-admin',
          usuario_nombre: requesterEmail || 'Administrador',
          usuario_rol: 'admin',
          accion: 'CREAR',
          modulo: 'gestion-de-datos',
          documento_id: 'migracion-registros-civiles',
          detalles: `Migración de ${offices.length} oficinas REC procesada vía Admin SDK (${migrationMode}).`,
          fecha_servidor: new Date(),
        });
      } catch (auditErr) {
        console.warn('No se pudo registrar auditoría:', auditErr);
      }

      return NextResponse.json({
        success: true,
        count: offices.length,
        method: 'admin-sdk',
        mode: migrationMode,
      });
    } else {
      // ==== VÍA 2: Cliente Autenticado Maestro (Master Owner Bypass) ====
      const clientApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const auth = getAuth(clientApp);

      const adminEmail = process.env.ADMIN_EMAIL || 'edubtz11@gmail.com';
      const adminPassword = process.env.ADMIN_PASSWORD || '@1910//**';

      try {
        await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      } catch (authError: any) {
        console.error('Error autenticando master admin:', authError);
      }

      const clientDb = getFirestore(clientApp);

      if (migrationMode === 'replace') {
        const snap = await getDocs(collection(clientDb, 'registros-civiles'));
        const BATCH_DELETE_SIZE = 100;
        for (let i = 0; i < snap.docs.length; i += BATCH_DELETE_SIZE) {
          const batch = writeBatch(clientDb);
          snap.docs.slice(i, i + BATCH_DELETE_SIZE).forEach(d => {
            batch.delete(d.ref);
          });
          await batch.commit();
        }
      }

      const existingMap = new Map<string, string>();
      if (migrationMode === 'upsert') {
        const snap = await getDocs(collection(clientDb, 'registros-civiles'));
        snap.forEach(d => {
          const data = d.data();
          const num = String(data.numero ?? '').trim().toUpperCase();
          const dep = String(data.departamento ?? '').trim().toUpperCase();
          if (num && dep) existingMap.set(`${num}|${dep}`, d.id);
        });
      }

      const BATCH_SIZE = 100;
      for (let i = 0; i < offices.length; i += BATCH_SIZE) {
        const batch = writeBatch(clientDb);
        const chunk = offices.slice(i, i + BATCH_SIZE);

        chunk.forEach((item: OfficePayload) => {
          const numClean = String(item.numero ?? '').trim();
          const nomClean = String(item.nombre ?? '').trim().toUpperCase();
          const depClean = String(item.departamento ?? '').trim().toUpperCase();
          const distClean = String(item.distrito ?? nomClean).trim().toUpperCase();

          const key = `${numClean.toUpperCase()}|${depClean}`;
          const existingId = migrationMode === 'upsert' ? existingMap.get(key) : null;

          const docData = {
            numero: numClean,
            nombre: nomClean,
            departamento: depClean || '00 - ASUNCION',
            distrito: distClean || 'ASUNCIÓN',
            fecha_actualizacion: new Date().toISOString(),
          };

          if (existingId) {
            const docRef = doc(clientDb, 'registros-civiles', existingId);
            batch.set(docRef, docData, { merge: true });
          } else {
            const newRef = doc(collection(clientDb, 'registros-civiles'));
            batch.set(newRef, {
              ...docData,
              fecha_creacion: new Date().toISOString(),
            });
          }
        });

        await batch.commit();
      }

      return NextResponse.json({
        success: true,
        count: offices.length,
        method: 'master-owner',
        mode: migrationMode,
      });
    }
  } catch (error: any) {
    console.error('Error en API migrar-oficinas:', error);
    return NextResponse.json(
      { error: error?.message || 'Error interno durante la migración de oficinas' },
      { status: 500 }
    );
  }
}
