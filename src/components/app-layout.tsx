
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/app-sidebar';

function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useFirebase();
  const pathname = usePathname();
  const router = useRouter(); // Moved hook to the top

  if (isUserLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user && pathname !== '/login') {
    // If not logged in and not on the login page, redirect to login.
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
