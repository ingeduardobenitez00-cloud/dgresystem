'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage';

/**
 * Inicialización Robusta:
 * Se fuerza el uso del objeto firebaseConfig local para evitar el error 'app/no-options'
 * reportado en la auditoría técnica. Esto garantiza que el SDK tenga las credenciales
 * correctas desde el primer momento, eliminando latencias de conexión.
 */
export function initializeFirebase() {
  // Verificamos si ya hay apps inicializadas, si no, inicializamos con el config explícito
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  
  return {
    firebaseApp: app,
    auth: getAuth(app),
    firestore: getFirestore(app),
    storage: getStorage(app)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-collection-once';
export * from './firestore/use-doc';
export * from './auth/use-user';
export * from './storage/use-storage';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
