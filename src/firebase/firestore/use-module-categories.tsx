'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, doc, writeBatch } from 'firebase/firestore';
import { useFirebase } from '../provider';
import { useCollection } from './use-collection';
import { useUser } from '../auth/use-user';
import { DEFAULT_CATEGORIES, ModuleCategory } from '@/lib/default-categories';

export function useModuleCategories() {
  const { firestore } = useFirebase();
  const { user, isUserLoading } = useUser();
  const [isSeeding, setIsSeeding] = useState(false);

  const categoriesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'modulo_clasificaciones'), orderBy('orden', 'asc'));
  }, [firestore]);

  const { data: categories, isLoading, error } = useCollection<ModuleCategory>(categoriesQuery);

  const isAdmin = user?.profile?.role === 'superadmin' || user?.profile?.role === 'admin' || user?.profile?.role === 'director' || user?.email === 'edubtz11@gmail.com';

  useEffect(() => {
    if (isLoading || isUserLoading || !categories || !firestore || isSeeding || !isAdmin) return;

    if (categories.length === 0) {
      const seed = async () => {
        setIsSeeding(true);
        console.log("SISTEMA - Iniciando auto-sembrado de clasificaciones de módulos por defecto...");
        try {
          const batch = writeBatch(firestore);
          DEFAULT_CATEGORIES.forEach((cat) => {
            const docRef = doc(firestore, 'modulo_clasificaciones', cat.id);
            batch.set(docRef, {
              label: cat.label,
              description: cat.description,
              modules: cat.modules,
              orden: cat.orden
            });
          });
          await batch.commit();
          console.log("SISTEMA - Clasificaciones sembradas con éxito en Firestore!");
        } catch (err) {
          console.error("SISTEMA - Error al sembrar clasificaciones de módulos:", err);
        } finally {
          setIsSeeding(false);
        }
      };
      seed();
    }
  }, [categories, isLoading, isUserLoading, firestore, isSeeding, isAdmin]);

  return {
    categories: categories || [],
    isLoading: isLoading || isSeeding,
    error
  };
}
