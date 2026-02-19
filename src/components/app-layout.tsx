'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useEffect, useState } from 'react';
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { useUser } from '@/firebase';
import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/app-sidebar';
import { Button } from './ui/button';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading, userError } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  
  const [mounted, setMounted] = useState(false);
  const [bootReady, setBootReady] = useState(false);

  // Etapa 1: Asegurar que el componente está montado en el cliente antes de nada
  useEffect(() => {
    setMounted(true);
    // Pequeño retraso para dejar que el navegador respire tras el montaje inicial
    const timer = setTimeout(() => setBootReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Etapa 2: Manejo de redirecciones de forma no bloqueante
  useEffect(() => {
    if (!mounted || isUserLoading) return;

    if (!user && pathname !== '/login') {
      router.replace('/login');
    } else if (user && pathname === '/login') {
      router.replace('/');
    }
  }, [user, isUserLoading, pathname, router, mounted]);

  // Si hay un error crítico de conexión con Firebase
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

  // No renderizar nada hasta que el componente esté montado (evita errores de hidratación)
  if (!mounted) return null;

  // Pantalla de carga ultra-ligera
  if ((isUserLoading || !bootReady) && pathname !== '/login') {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 relative animate-pulse">
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

  // Página de Login aislada
  if (pathname === '/login') {
    return <div className="animate-in fade-in duration-500">{children}</div>;
  }

  // Interfaz principal con Sidebar
  return (
    <SidebarProvider defaultOpen={false}>
      <Sidebar collapsible="offcanvas">
        <AppSidebar />
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-1 flex-col">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
