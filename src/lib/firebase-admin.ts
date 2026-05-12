import * as admin from 'firebase-admin';
import { firebaseConfig } from '@/firebase/config';

let adminAuth: any = null;
let adminFirestore: any = null;
let isInitialized = false;

try {
  const isDev = process.env.NODE_ENV === 'development';
  const hasLocalCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  // Solo inicializar si estamos en producción (App Hosting) o si hay credenciales locales explícitas
  if (!isDev || hasLocalCreds) {
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: firebaseConfig.projectId
      });
    }
    adminAuth = admin.auth();
    adminFirestore = admin.firestore();
    isInitialized = true;
  }
} catch (error) {
  console.error('Error al inicializar Firebase Admin:', error);
}

export { adminAuth, adminFirestore, isInitialized };
