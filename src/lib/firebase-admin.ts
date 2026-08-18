import * as admin from 'firebase-admin';
import { firebaseConfig } from '@/firebase/config';

// Robust initialization for Next.js to prevent "The default Firebase app does not exist" errors
function getAdminApp() {
  if (admin.apps.length > 0) {
    return admin.apps[0] as admin.app.App;
  }
  
  try {
    return admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
  } catch (error: any) {
    if (admin.apps.length > 0) {
      return admin.apps[0] as admin.app.App;
    }
    throw error;
  }
}

export function getAdminAuth() {
  return getAdminApp().auth();
}

export function getAdminFirestore() {
  return getAdminApp().firestore();
}

export const isInitialized = true;
