
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useUser, useFirebase } from '@/firebase';
import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/app-sidebar';
import { Button } from './ui/button';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

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
  useEffect(() => {
    if (!user || !firestore || !mounted) return;

    const updatePresence = async () => {
      const presenceRef = doc(firestore, 'presencia', user.uid);
      await setDoc(presenceRef, {
        usuario_id: user.uid,
        username: user.profile?.username || user.email,
        email: user.email,
        role: user.profile?.role,
        departamento: user.profile?.departamento || '',
        distrito: user.profile?.distrito || '',
        ultima_actividad: serverTimestamp(),
        ruta_actual: pathname
      }, { merge: true }).catch(() => {});
    };

    // Actualizar inmediatamente al cargar/cambiar ruta
    updatePresence();

    // Actualizar cada 2 minutos mientras la pestaña esté abierta
    const interval = setInterval(updatePresence, 120000);
    return () => clearInterval(interval);
  }, [user, firestore, mounted, pathname]);

  useEffect(() => {
    if (!mounted || isUserLoading) return;

    // Definir rutas que no requieren login
    const publicRoutes = ['/login', '/encuesta-satisfaccion'];
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

    if (!user && !isPublicRoute) {
      router.replace('/login');
    } else if (user && pathname === '/login') {
      router.replace('/');
    }
  }, [user, isUserLoading, pathname, router, mounted]);

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

  if (!mounted || isUserLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 relative">
             <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
             <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
            Iniciando Sistema...
          </p>
        </div>
      </div>
    );
  }

  // Logic to determine if we should show the full app shell (with sidebar)
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
