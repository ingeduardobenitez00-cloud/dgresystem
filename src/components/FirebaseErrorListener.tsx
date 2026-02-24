
'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * It handles errors gracefully to prevent application crashes for end-users.
 */
export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      // Log to system console as requested
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
  }, [toast]);

  return null;
}
