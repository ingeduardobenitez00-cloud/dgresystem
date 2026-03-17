
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useUser, useFirebase } from '@/firebase';
import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/app-sidebar';
import { Button } from './ui/button';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import Loading from '@/app/loading';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading, userError } = useUser();
  const { firestore } = useFirebase();
  const pathname = usePathname();
  const router = useRouter();
  
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // SISTEMA DE PRESENCIA (HEARTBEAT)
  const updatePresence = useCallback(async () => {
    if (!user || !firestore) return;
    
    const presenceRef = doc(firestore, 'presencia', user.uid);
    const presenceData = {
      usuario_id: user.uid,
      username: user.profile?.username || user.email || 'Usuario',
      email: user.email || '',
      role: user.profile?.role || 'funcionario',
      departamento: user.profile?.departamento || 'N/A',
      distrito: user.profile?.distrito || 'N/A',
      ultima_actividad: serverTimestamp(),
      ruta_actual: pathname || '/'
    };

    try {
      await setDoc(presenceRef, presenceData, { merge: true });
    } catch (err) {
      // Error silencioso
    }
  }, [user, firestore, pathname]);

  useEffect(() => {
    if (!mounted || !user) return;

    updatePresence();
    const interval = setInterval(updatePresence, 60000);
    return () => clearInterval(interval);
  }, [mounted, user, updatePresence]);

  const isPublicRoute = useMemo(() => {
    const publicRoutes = ['/login', '/encuesta-satisfaccion'];
    return publicRoutes.some(route => pathname.startsWith(route));
  }, [pathname]);

  useEffect(() => {
    if (!mounted || isUserLoading) return;

    if (!user && !isPublicRoute) {
      router.replace('/login');
    } else if (user && pathname === '/login') {
      router.replace('/');
    }
  }, [user, isUserLoading, isPublicRoute, pathname, router, mounted]);

  if (userError && mounted) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center p-6 text-center space-y-6 bg-background">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <div className="space-y-2">
          <h2 className="text-xl font-black uppercase text-primary">Error de Sincronización</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            No se pudo establecer conexión con el servidor de seguridad.
          </p>
        </div>
        <Button onClick={() => window.location.reload()} className="h-12 px-8 font-black uppercase">
          <RefreshCw className="mr-2 h-4 w-4" /> Reintentar Inicio
        </Button>
      </div>
    );
  }

  // OPTIMIZACIÓN: Bloqueo de renderizado para rutas privadas si no hay usuario
  // Esto evita el "flicker" o pantallazo del dashboard al navegar atrás sin sesión.
  if (!mounted || isUserLoading || (!user && !isPublicRoute)) {
    return <Loading />;
  }

  const isLoginPage = pathname === '/login';
  const isEncuestaPage = pathname.startsWith('/encuesta-satisfaccion');
  const isPublicView = isEncuestaPage && !user;
  const showSimpleLayout = isLoginPage || isPublicView;

  return (
    <SidebarProvider defaultOpen={false}>
      {showSimpleLayout ? (
        <div className="flex flex-1 flex-col animate-in fade-in duration-500">
          {children}
        </div>
      ) : (
        <>
          <Sidebar collapsible="offcanvas">
            <AppSidebar />
          </Sidebar>
          <SidebarInset>
            <div className="flex flex-1 flex-col">
              {children}
            </div>
          </SidebarInset>
        </>
      )}
    </SidebarProvider>
  );
}
