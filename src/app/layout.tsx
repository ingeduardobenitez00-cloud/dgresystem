
'use client';

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import AppSidebar from '@/components/app-sidebar';
import { FirebaseClientProvider, useFirebase, useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

// export const metadata: Metadata = {
//   title: 'Informe Edilicio',
//   description: 'Gestión de informes y registros electorales.',
// };

function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isUserLoading) {
      if (user && pathname === '/login') {
        router.replace('/');
      } else if (!user && pathname !== '/login') {
        router.replace('/login');
      }
    }
  }, [user, isUserLoading, router, pathname]);

  if (isUserLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user && pathname !== '/login') {
    return null; // Don't render anything while redirecting
  }
  
  if (user && pathname === '/login') {
     return null;
  }

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <Sidebar variant="inset" collapsible="icon">
        <AppSidebar />
      </Sidebar>
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          'min-h-screen bg-background font-sans antialiased',
          inter.variable
        )}
      >
        <FirebaseClientProvider>
            <AuthLayout>
              {children}
            </AuthLayout>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
