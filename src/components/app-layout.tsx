'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useUser } from '@/firebase';
import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/app-sidebar';
import { dashboardMenuItems } from '@/lib/menu-config';

function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const accessibleMenuItems = useMemo(() => {
    if (!user?.profile) return [];
    return dashboardMenuItems.filter(item => {
      if (user.profile.role === 'admin') {
        return true;
      }
      const moduleName = item.href.substring(1);
      return user.profile.modules?.includes(moduleName);
    });
  }, [user]);

  useEffect(() => {
    if (isUserLoading || !mounted) return;

    if (!user && pathname !== '/login') {
      router.replace('/login');
    } else if (user && pathname === '/login') {
      router.replace('/');
    } else if (user && pathname === '/' && user.profile?.role !== 'admin' && accessibleMenuItems.length === 1) {
      const targetPath = accessibleMenuItems[0]?.href;
      if (targetPath) {
        router.replace(targetPath);
      }
    }
  }, [isUserLoading, user, pathname, router, accessibleMenuItems, mounted]);
  
  // Show loader during initial auth check or if redirection is imminent
  const isRedirecting = useMemo(() => {
    if (isUserLoading || !mounted) return true;
    if (!user && pathname !== '/login') return true;
    if (user && pathname === '/login') return true;
    if (user && pathname === '/' && user.profile?.role !== 'admin' && accessibleMenuItems.length === 1) return true;
    return false;
  }, [isUserLoading, user, pathname, accessibleMenuItems, mounted]);

  if (isRedirecting) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Cargando sistema...</p>
        </div>
      </div>
    );
  }

  if (pathname === '/login') {
    return <div key="login-root">{children}</div>;
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <Sidebar collapsible="offcanvas">
        <AppSidebar />
      </Sidebar>
      <SidebarInset>
        <div key={pathname} className="flex flex-1 flex-col">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AuthLayout>{children}</AuthLayout>;
}
