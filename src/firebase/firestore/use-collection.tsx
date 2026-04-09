'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export type WithId<T> = T & { id: string };

export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
  setData: React.Dispatch<React.SetStateAction<WithId<T>[] | null>>;
}

export interface InternalQuery extends Query<DocumentData> {
  _query: {
    path: {
      canonicalString(): string;
      toString(): string;
    }
  }
}

export function useCollection<T = any>(
    targetRefOrQuery: ((CollectionReference<DocumentData> | Query<DocumentData>))  | null | undefined,
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  
  const query = targetRefOrQuery;

  const queryString = (query as any)?._query?.path?.canonicalString() || '';
  const queryParams = JSON.stringify((query as any)?._query?.filters || []);

  useEffect(() => {
    if (!query) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      query,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: ResultItemType[] = [];
        for (const doc of snapshot.docs) {
          results.push({ ...(doc.data() as T), id: doc.id });
        }
        setData(results);
        setError(null);
        setIsLoading(false);
      },
      (firestoreError: FirestoreError) => {
        const path: string =
          query.type === 'collection'
            ? (query as CollectionReference).path
            : (query as unknown as InternalQuery)._query.path.canonicalString()

        if (firestoreError.code === 'permission-denied') {
            const contextualError = new FirestorePermissionError({
                operation: 'list',
                path,
            });
            setError(contextualError);
            errorEmitter.emit('permission-error', contextualError);
        } else {
            setError(firestoreError);
            // Reducimos el ruido en consola en entornos de producción según reporte técnico
            if (process.env.NODE_ENV !== 'production') {
                console.error(`SISTEMA - Error de Base de Datos [${firestoreError.code}]:`, firestoreError.message);
            }
        }
        
        setData(null);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [queryString, queryParams]);

  return { data, isLoading, error, setData };
}
