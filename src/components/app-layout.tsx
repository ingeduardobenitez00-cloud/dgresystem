
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/app-sidebar';

function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useFirebase();
  const pathname = usePathname();

  if (isUserLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user && pathname !== '/login') {
    // If not logged in and not on the login page, render the login page content.
    // The actual routing to /login will be handled by the router if you have middleware,
    // or you could trigger a redirect here, but showing the content avoids a hard redirect flash.
    // For simplicity, we assume the login page is what should be shown.
    const router = useRouter();
    router.replace('/login');
    return (
         <div className="flex min-h-screen w-full items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
         </div>
    );
  }
  
  if (user && pathname === '/login') {
      const router = useRouter();
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
