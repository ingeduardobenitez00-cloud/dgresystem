'use client';

import { useEffect, useState } from 'react';
import { useFirebase, useUser } from '@/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { DEFAULT_CATEGORIES } from '@/lib/default-categories';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function SeedPage() {
  const { firestore } = useFirebase();
  const { user, isUserLoading } = useUser();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const isAdmin = user?.profile?.role === 'superadmin' || user?.profile?.role === 'admin' || user?.profile?.role === 'director' || user?.email === 'edubtz11@gmail.com';

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      setStatus('error');
      setMessage('DEBE INICIAR SESIÓN PRIMERO. Por favor, ve al login e ingresa con tu cuenta de Súper Administrador.');
      return;
    }
    if (!isAdmin) {
      setStatus('error');
      setMessage('ACCESO DENEGADO. Solo los administradores autorizados pueden realizar esta siembra.');
      return;
    }
  }, [user, isUserLoading, isAdmin]);

  const handleSeed = async () => {
    if (!firestore || !user) return;
    setStatus('loading');
    try {
      const batch = writeBatch(firestore);

      DEFAULT_CATEGORIES.forEach((cat) => {
        const docRef = doc(collection(firestore, 'modulo_clasificaciones'), cat.id);
        batch.set(docRef, {
          label: cat.label,
          description: cat.description,
          modules: cat.modules,
          orden: cat.orden
        });
      });

      await batch.commit();
      setStatus('success');
      setMessage('¡Base de datos sembrada con éxito! Las clasificaciones por defecto han sido creadas.');
    } catch (error: any) {
      console.error(error);
      setStatus('error');
      setMessage(`Error de escritura en Firestore: ${error.message || error}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/10 p-6">
      <div className="max-w-md w-full bg-white rounded-[2rem] p-8 border shadow-xl text-center space-y-6">
        <h1 className="text-xl font-black uppercase text-primary">Siembra de Clasificaciones</h1>
        
        {status === 'idle' && (
          <div className="space-y-6">
            <p className="text-xs text-muted-foreground font-bold uppercase leading-relaxed">
              Haz clic abajo para crear de forma segura las clasificaciones predeterminadas utilizando tus credenciales de Súper Administrador activas.
            </p>
            <button 
              onClick={handleSeed}
              className="w-full h-12 rounded-xl bg-black hover:bg-black/90 text-white font-black uppercase text-xs tracking-wider transition-colors"
            >
              Iniciar Siembra de Módulos
            </button>
          </div>
        )}

        {status === 'loading' && (
          <div className="flex flex-col items-center py-6 space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Escribiendo en Firestore...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-6">
            <div className="flex justify-center">
              <CheckCircle2 className="h-14 w-14 text-green-600" />
            </div>
            <p className="text-xs font-bold text-green-800 uppercase bg-green-50 p-4 border border-green-200 rounded-2xl leading-relaxed">
              {message}
            </p>
            <Link href="/" className="block w-full h-12 leading-[48px] rounded-xl bg-black hover:bg-black/90 text-white font-black uppercase text-xs tracking-wider transition-colors">
              Volver al Inicio
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-6">
            <div className="flex justify-center">
              <AlertTriangle className="h-14 w-14 text-destructive" />
            </div>
            <p className="text-xs font-bold text-destructive uppercase bg-destructive/5 p-4 border border-destructive/20 rounded-2xl leading-relaxed">
              {message}
            </p>
            {user ? (
              <button 
                onClick={handleSeed}
                className="w-full h-12 rounded-xl bg-black hover:bg-black/90 text-white font-black uppercase text-xs tracking-wider transition-colors"
              >
                Reintentar Siembra
              </button>
            ) : (
              <Link href="/login" className="block w-full h-12 leading-[48px] rounded-xl bg-primary hover:bg-primary/95 text-white font-black uppercase text-xs tracking-wider transition-colors">
                Iniciar Sesión
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
