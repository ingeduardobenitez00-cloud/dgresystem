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

  const queryString = (query as any)?._query?.path?.canonicalString() || '';
  const queryParams = JSON.stringify((query as any)?._query?.filters || []); // Filtros específicos

  // GOBERNADOR DE LECTURAS: Evita bucles infinitos por software
  const fetchData = async () => {
    if (!query) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const now = Date.now();
    const govKey = `${queryString}-${queryParams}`;
    const gov = governor.get(govKey) || { count: 0, lastTime: now };
    
    if (now - gov.lastTime < 10000) { // Ventana de 10 segundos
      gov.count++;
    } else {
      gov.count = 1;
      gov.lastTime = now;
    }
    governor.set(govKey, gov);

    if (gov.count > 10) { // Tolerancia de 10 lecturas/10s para evitar falsos positivos en navegación rápida
      console.error(`%c SISTEMA - BLOQUEO DE SEGURIDAD: Se detectó un posible bucle de renders para la consulta: [${queryString}]. Deteniendo lecturas para proteger tu presupuesto.`, "color: white; background: #e11d48; font-weight: bold; padding: 4px; border-radius: 4px;");
      setError(new Error("Seguridad de Facturación: Se detuvieron las lecturas debido a repetición excesiva."));
      setIsLoading(false);
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

  useEffect(() => {
    fetchData();
  }, [queryString, queryParams]);

  return { data, isLoading, error, setData, refetch: fetchData };
}

// Registro global de lecturas para detección de bucles
const governor = new Map<string, { count: number, lastTime: number }>();
