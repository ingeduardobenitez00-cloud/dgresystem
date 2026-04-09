'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  getDocs,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export type WithIdOnce<T> = T & { id: string };

export interface UseCollectionOnceResult<T> {
  data: WithIdOnce<T>[] | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
  setData: React.Dispatch<React.SetStateAction<WithIdOnce<T>[] | null>>;
  refetch: () => Promise<void>;
}

export interface InternalQueryOnce extends Query<DocumentData> {
  _query: {
    path: {
      canonicalString(): string;
      toString(): string;
    }
  }
}

export function useCollectionOnce<T = any>(
    targetRefOrQuery: ((CollectionReference<DocumentData> | Query<DocumentData>))  | null | undefined,
): UseCollectionOnceResult<T> {
  type ResultItemType = WithIdOnce<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  
  const query = targetRefOrQuery;

  const fetchData = async () => {
    if (!query) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const snapshot: QuerySnapshot<DocumentData> = await getDocs(query);
      const results: ResultItemType[] = [];
      snapshot.forEach((doc) => {
        results.push({ ...(doc.data() as T), id: doc.id });
      });
      setData(results);
      setIsLoading(false);
    } catch (firestoreError: any) {
      const path: string =
        query.type === 'collection'
          ? (query as CollectionReference).path
          : (query as unknown as InternalQueryOnce)._query.path.canonicalString();

      if (firestoreError.code === 'permission-denied') {
        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path,
        });
        setError(contextualError);
        errorEmitter.emit('permission-error', contextualError);
      } else {
        setError(firestoreError);
        if (process.env.NODE_ENV !== 'production') {
          console.error(`SISTEMA - Error de Base de Datos [${firestoreError.code}]:`, firestoreError.message);
        }
      }
      
      setData(null);
      setIsLoading(false);
    }
  };

  const queryString = (query as any)?._query?.path?.canonicalString() || '';
  const queryParams = JSON.stringify((query as any)?._query?.filters || []); // Filtros específicos

  useEffect(() => {
    fetchData();
  }, [queryString, queryParams]);

  return { data, isLoading, error, setData, refetch: fetchData };
}
