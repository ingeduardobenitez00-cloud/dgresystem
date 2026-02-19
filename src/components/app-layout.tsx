'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useEffect, useState } from 'react';
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { useUser } from '@/firebase';
import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/app-sidebar';
import { dashboardMenuItems } from '@/lib/menu-config';
import { Button } from './ui/button';

function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading, userError } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Safety timeout: if after 10s we are still loading, allow interaction
    // This prevents the "Unresponsive Page" error from blocking the whole UI
    const timer = setTimeout(() => {
      if (isUserLoading) setTimedOut(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, [isUserLoading]);

  const accessibleMenuItems = useMemo(() => {
    if (!user?.profile) return [];
    if (user.profile.role === 'admin') return dashboardMenuItems;
    const modules = user.profile.modules || [];
    return dashboardMenuItems.filter(item => modules.includes(item.href.substring(1)));
  }, [user]);

  useEffect(() => {
    if (!mounted) return;

    // Fast track for login page
    if (!isUserLoading && !user && pathname !== '/login') {
      router.replace('/login');
    } else if (user && pathname === '/login') {
      router.replace('/');
    }
  }, [isUserLoading, user, pathname, router, mounted]);

  if (userError) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center p-6 text-center space-y-6 bg-background">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <div className="space-y-2">
          <h2 className="text-xl font-black uppercase text-primary">Error de Conexión</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            No se pudo sincronizar con el servidor. Verifique su conexión a internet.
          </p>
        </div>
        <Button onClick={() => window.location.reload()} className="h-12 px-8 font-black uppercase">
          <RefreshCw className="mr-2 h-4 w-4" /> Reintentar
        </Button>
      </div>
    );
  }

  // Show nothing until mounted to prevent hydration mismatches
  if (!mounted) return null;

  // Show loading screen ONLY if we are truly loading and not timed out
  // If timed out, we show the children anyway to avoid locking the user out
  if (isUserLoading && !timedOut && pathname !== '/login') {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
            Sincronizando Sistema
          </p>
        </div>
      </div>
    );
  }

  if (pathname === '/login') {
    return <div className="animate-in fade-in duration-300">{children}</div>;
  }

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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AuthLayout>{children}</AuthLayout>;
}
