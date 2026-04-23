'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/header';
import { useUser } from '@/firebase';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function CargarFichaPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const [message, setMessage] = useState('Verificando asignación...');
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (!isUserLoading && user) {
      const assignedDept = user.profile?.departamento;
      const assignedDist = user.profile?.distrito;

      if (assignedDept && assignedDist) {
        setIsRedirecting(true);
        const deptParam = encodeURIComponent(assignedDept);
        const distParam = encodeURIComponent(assignedDist);
        router.replace(`/ficha?dept=${deptParam}&dist=${distParam}`);
      } else if (user.isAdmin) {
         setMessage('Como administrador, tienes acceso a todos los distritos. Por favor, usa el buscador en "Vista de Ficha".');
      } else {
        setMessage('No tienes un departamento y distrito asignado. Por favor, contacta a un administrador.');
      }
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || isRedirecting) {
    return (
      <div className="flex min-h-screen w-full flex-col">
        <Header title="Cargar Ficha" />
        <main className="flex flex-1 items-center justify-center p-4">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-center text-muted-foreground">
              {isRedirecting ? `Redirigiendo a la ficha asignada...` : 'Verificando asignación...'}
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Cargar Ficha" />
      <main className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle>Acceso a Ficha Asignada</CardTitle>
                <CardDescription>
                    Este módulo te redirige automáticamente a la ficha de tu distrito asignado.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center space-y-4 p-8">
                <p className="text-center text-muted-foreground">{message}</p>
            </CardContent>
        </Card>
      </main>
    </div>
  );
}
