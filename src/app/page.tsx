'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import Header from '@/components/header';
import { useUser } from '@/firebase';
import { dashboardMenuItems } from '@/lib/menu-config';


export default function Home() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  const accessibleMenuItems = useMemo(() => {
    if (!user) return [];
    return dashboardMenuItems.filter(item => {
      if (user.profile?.role === 'admin') {
        return true;
      }
      const moduleName = item.href.substring(1);
      return user.profile?.modules?.includes(moduleName);
    });
  }, [user]);

  // The main loading and redirection is handled by AuthLayout
  if (isUserLoading) {
    return (
      <div className="flex min-h-screen w-full flex-col">
        <Header title="Panel Principal" />
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Panel Principal" />
      <main className="flex-1 p-4 sm:p-6 md:p-8">
        <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Bienvenido al Informe Edilicio
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
                Selecciona una sección para empezar a trabajar.
            </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {accessibleMenuItems.map((item) => (
            <Link href={item.href} key={item.href} className="group">
              <Card className="h-full transition-all duration-200 ease-in-out group-hover:shadow-lg group-hover:border-primary/50 group-hover:-translate-y-1">
                <CardHeader className="flex flex-row items-center gap-4">
                  <item.icon className="h-8 w-8 text-primary" />
                  <div>
                    <CardTitle>{item.label}</CardTitle>
                    <CardDescription className="mt-1">
                      {item.description}
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
