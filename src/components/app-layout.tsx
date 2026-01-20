
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useMemo } from 'react';
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

  if (isUserLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user && pathname !== '/login') {
    router.replace('/login');
    return (
         <div className="flex min-h-screen w-full items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
         </div>
    );
  }
  
  if (user && pathname === '/login') {
      router.replace('/');
       return (
         <div className="flex min-h-screen w-full items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
         </div>
    );
  }

  if (user && pathname === '/' && user.profile?.role !== 'admin' && accessibleMenuItems.length === 1) {
    const targetPath = accessibleMenuItems[0].href;
    router.replace(targetPath);
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (pathname === '/login') {
    return <main key={pathname}>{children}</main>;
  }

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
