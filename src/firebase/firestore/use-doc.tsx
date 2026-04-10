
'use client';
    
import { useState, useEffect } from 'react';
import {
  DocumentReference,
  onSnapshot,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/** Utility type to add an 'id' field to a given type T. */
type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useDoc hook.
 * @template T Type of the document data.
 */
export interface UseDocResult<T> {
  data: WithId<T> | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
  setData: React.Dispatch<React.SetStateAction<WithId<T> | null>>;
}

/**
 * React hook to subscribe to a single Firestore document in real-time.
 * Handles nullable references.
 * 
 * IMPORTANT! YOU MUST MEMOIZE the inputted memoizedTargetRefOrQuery or BAD THINGS WILL HAPPEN
 * use useMemo to memoize it per React guidence.  Also make sure that it's dependencies are stable
 * references
 *
 *
 * @template T Optional type for document data. Defaults to any.
 * @param {DocumentReference<DocumentData> | null | undefined} memoizedDocRef -
 * The Firestore DocumentReference. Waits if null/undefined.
 * @returns {UseDocResult<T>} Object with data, isLoading, error.
 */
export function useDoc<T = any>(
  memoizedDocRef: DocumentReference<DocumentData> | null | undefined,
): UseDocResult<T> {
  type StateDataType = WithId<T> | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  const docPath = memoizedDocRef?.path || '';

  useEffect(() => {
    if (!memoizedDocRef) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // GOBERNADOR DE LECTURAS (Tiempo Real)
    const now = Date.now();
    const gov = governor.get(docPath) || { count: 0, lastTime: now };
    
    if (now - gov.lastTime < 10000) {
      gov.count++;
    } else {
      gov.count = 1;
      gov.lastTime = now;
    }
    governor.set(docPath, gov);

    if (gov.count > 15) {
      console.error(`%c SISTEMA - BLOQUEO DE SEGURIDAD (Real-time): Se detectó inestabilidad en la suscripción del documento: [${docPath}]. Deteniendo escucha.`, "color: white; background: #e11d48; font-weight: bold; padding: 4px; border-radius: 4px;");
      setError(new Error("Seguridad de Facturación: Se detuvo la suscripción debido a re-conexiones excesivas."));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      memoizedDocRef,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        if (snapshot.exists()) {
          const newData = { ...(snapshot.data() as T), id: snapshot.id };
          // Verificación de igualdad profunda para evitar disparar renders innecesarios
          setData(prev => {
            if (JSON.stringify(prev) === JSON.stringify(newData)) return prev;
            return newData;
          });
        } else {
          setData(null);
        }
        setIsLoading(false);
        setError(null);
      },
      (err: FirestoreError) => {
        if (err.code === 'permission-denied') {
          const contextualError = new FirestorePermissionError({
            operation: 'get',
            path: memoizedDocRef.path,
          });
          setError(contextualError);
          errorEmitter.emit('permission-error', contextualError);
        } else {
          setError(err);
          if (process.env.NODE_ENV !== 'production') {
            console.error(`SISTEMA - Error de BD [useDoc - ${err.code}]:`, err.message);
          }
        }
        setData(null);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [memoizedDocRef, docPath]);

  return { data, isLoading, error, setData };
}

// Registro global de lecturas para detección de bucles
const governor = new Map<string, { count: number, lastTime: number }>();
