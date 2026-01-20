
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useUser } from '@/firebase';
import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/app-sidebar';
import { dashboardMenuItems } from '@/lib/menu-config';

function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const pathname = usePathname();
  const router = useRouter();

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

  // Handle all redirection logic in a useEffect to prevent side-effects during render
  useEffect(() => {
    if (isUserLoading) {
      return; // Wait until user loading is complete
    }

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
  }, [isUserLoading, user, pathname, router, accessibleMenuItems]);
  
  // Display a loader while auth state is being determined or a redirect is imminent
  if (isUserLoading || (!user && pathname !== '/login') || (user && pathname === '/login') || (user && pathname === '/' && user.profile?.role !== 'admin' && accessibleMenuItems.length === 1)) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // If on login page (and user is not logged in), just render children
  if (pathname === '/login') {
    return <main key={pathname}>{children}</main>;
  }

  // For all other authenticated routes, render the layout
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <AppSidebar />
      </Sidebar>
      <SidebarInset>
        <main key={pathname}>{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AuthLayout>{children}</AuthLayout>;
}
