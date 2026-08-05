import * as admin from 'firebase-admin';
import { firebaseConfig } from '@/firebase/config';

let isInitialized = false;

function getAdminApp() {
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
  }
  isInitialized = true;
  return admin.app();
}

export function getAdminAuth() {
  return getAdminApp().auth();
}

export function getAdminFirestore() {
  return getAdminApp().firestore();
}

export { isInitialized };
