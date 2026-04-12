'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DocumentReference,
  getDoc,
  DocumentData,
  FirestoreError,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/** Utility type to add an 'id' field to a given type T. */
type WithId<T> = T & { id: string };

export interface UseDocOnceResult<T> {
  data: WithId<T> | null; 
  isLoading: boolean;
  error: FirestoreError | Error | null; 
  refetch: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<WithId<T> | null>>;
}

/**
 * React hook to fetch a single Firestore document EXACTLY ONCE.
 */
export function useDocOnce<T = any>(
  memoizedDocRef: DocumentReference<DocumentData> | null | undefined,
): UseDocOnceResult<T> {
  type StateDataType = WithId<T> | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  const docPath = memoizedDocRef?.path || '';

  const fetchData = useCallback(async () => {
    if (!memoizedDocRef) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // GOBERNADOR DE LECTURAS
    const now = Date.now();
    const gov = governor.get(docPath) || { count: 0, lastTime: now };
    
    if (now - gov.lastTime < 10000) {
      gov.count++;
    } else {
      gov.count = 1;
      gov.lastTime = now;
    }
    governor.set(docPath, gov);

    if (gov.count > 10) {
      console.error(`%c SISTEMA - BLOQUEO DE SEGURIDAD: Se detectó un posible bucle de renders para el documento: [${docPath}]. Deteniendo lecturas.`, "color: white; background: #e11d48; font-weight: bold; padding: 4px; border-radius: 4px;");
      setError(new Error("Seguridad de Facturación: Se detuvieron las lecturas debido a repetición excesiva."));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const snapshot = await getDoc(memoizedDocRef);
      if (snapshot.exists()) {
        const newData = { ...(snapshot.data() as T), id: snapshot.id };
        setData(prev => {
          if (JSON.stringify(prev) === JSON.stringify(newData)) return prev;
          return newData;
        });
      } else {
        setData(null);
      }
    } catch (err: any) {
      if (err?.code === 'permission-denied') {
        const contextualError = new FirestorePermissionError({
          operation: 'get',
          path: memoizedDocRef.path,
        });
        setError(contextualError);
        errorEmitter.emit('permission-error', contextualError);
      } else {
        setError(err);
        if (process.env.NODE_ENV !== 'production') {
            console.error(`SISTEMA - Error de BD [useDocOnce - ${err?.code}]:`, err?.message);
        }
      }
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [memoizedDocRef, docPath]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData, setData };
}

// Registro global de lecturas para detección de bucles
const governor = new Map<string, { count: number, lastTime: number }>();
