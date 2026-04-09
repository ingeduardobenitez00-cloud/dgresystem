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

  const fetchData = useCallback(async () => {
    if (!memoizedDocRef) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const snapshot = await getDoc(memoizedDocRef);
      if (snapshot.exists()) {
        setData({ ...(snapshot.data() as T), id: snapshot.id });
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
  }, [memoizedDocRef]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData, setData };
}
