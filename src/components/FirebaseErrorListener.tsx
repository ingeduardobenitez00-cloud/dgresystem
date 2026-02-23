
'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * It handles errors gracefully to prevent application crashes for end-users.
 */
export function FirebaseErrorListener() {
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      // We only want to crash the app in development to help developers debug.
      // In a real hosted environment, we suppress the crash to keep the app functional.
      const isDev = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';
      
      if (isDev) {
        setError(error);
      } else {
        console.warn('Firestore Permission Error (Suppressed for Stability):', error.message);
      }
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  // Throwing here will trigger the Nearest Error Boundary or Next.js App Error Screen
  if (error) {
    throw error;
  }

  return null;
}
