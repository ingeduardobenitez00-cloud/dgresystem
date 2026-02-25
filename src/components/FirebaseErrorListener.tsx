'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * It handles errors gracefully to prevent application crashes for end-users.
 */
export function FirebaseErrorListener() {
  const { toast } = useToast();
  const { auth } = useFirebase();

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      // CRITICAL FIX: If there's no current user, it's likely a logout transition.
      // We don't want to show "Acceso Restringido" when the user is simply leaving the app.
      if (!auth?.currentUser) return;

      // Log to system console for debugging
      console.warn('SISTEMA - Acceso Denegado:', error.message);
      
      // Show a graceful toast instead of crashing the app
      toast({
        variant: 'destructive',
        title: 'Acceso Restringido',
        description: 'No tienes permisos suficientes para ver esta información o realizar esta acción.',
      });
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [toast, auth]);

  return null;
}
