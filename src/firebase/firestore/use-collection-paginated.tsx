'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Query,
  getDocs,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  limit,
  startAfter,
  query as firestoreQuery,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { WithIdOnce } from './use-collection-once';

export interface UseCollectionPaginatedResult<T> {
  data: WithIdOnce<T>[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: FirestoreError | Error | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
  mutate: (newData: WithIdOnce<T>[]) => void;
  updateItem: (id: string, updates: Partial<T>) => void;
}

export function useCollectionPaginated<T = any>(
  baseQuery: Query<DocumentData> | null | undefined,
  pageSize: number = 20
): UseCollectionPaginatedResult<T> {
  const [data, setData] = useState<WithIdOnce<T>[]>([]);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);

  // Generar un string identificador de la query para detectar cambios
  const queryString = (baseQuery as any)?._query?.path?.canonicalString() || '';
  const queryParams = JSON.stringify((baseQuery as any)?._query?.filters || []);

  const fetchData = useCallback(async (isLoadMore: boolean = false) => {
    if (!baseQuery) {
      setData([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (isLoadMore) {
        setIsLoadingMore(true);
    } else {
        setIsLoading(true);
        setData([]); // Reset data on new query
        setLastVisible(null);
        setHasMore(true);
    }
    
    setError(null);

    try {
      // Construir la query con límites y paginación
      let finalQuery = firestoreQuery(baseQuery, limit(pageSize));
      
      if (isLoadMore && lastVisible) {
        finalQuery = firestoreQuery(baseQuery, startAfter(lastVisible), limit(pageSize));
      }

      const snapshot: QuerySnapshot<DocumentData> = await getDocs(finalQuery);
      
      const results: WithIdOnce<T>[] = [];
      snapshot.forEach((doc) => {
        results.push({ ...(doc.data() as T), id: doc.id });
      });

      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      setLastVisible(lastDoc || null);
      setHasMore(snapshot.docs.length === pageSize);

      setData(prev => isLoadMore ? [...prev, ...results] : results);
      
    } catch (firestoreError: any) {
      if (firestoreError.code === 'permission-denied') {
        const path = (baseQuery as any)?._query?.path?.canonicalString() || 'unknown';
        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path,
        });
        setError(contextualError);
        errorEmitter.emit('permission-error', contextualError);
      } else {
        setError(firestoreError);
      }
      console.error("Error en useCollectionPaginated:", firestoreError);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [baseQuery, pageSize, lastVisible]);

  useEffect(() => {
    fetchData(false);
  }, [queryString, queryParams]);

  const loadMore = useCallback(async () => {
    if (!isLoadingMore && hasMore && lastVisible) {
      await fetchData(true);
    }
  }, [fetchData, isLoadingMore, hasMore, lastVisible]);

  return { 
    data, 
    isLoading, 
    isLoadingMore, 
    error, 
    hasMore, 
    loadMore, 
    refetch: () => fetchData(false),
    mutate: setData,
    updateItem: useCallback((id: string, updates: Partial<T>) => {
      setData(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    }, [])
  };
}
