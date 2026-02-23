'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * It throws any received error only in development to be caught by Next.js's overlay.
 * In production, it logs the error to prevent application crashes.
 */
export function FirebaseErrorListener() {
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      // In production, we don't want to crash the app for the end-user (e.g. Citizens)
      if (process.env.NODE_ENV === 'development') {
        setError(error);
      } else {
        console.warn('Firestore Permission Error (Suppressed in Production):', error.message);
      }
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  if (error) {
    throw error;
  }

  return null;
}
