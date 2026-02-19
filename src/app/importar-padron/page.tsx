
'use client';

import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function ImportarPadronPage() {
  return (
    <div className="flex min-h-screen flex-col bg-muted/10">
      <Header title="Módulo Desactivado" />
      <main className="flex-1 p-4 md:p-8 flex items-center justify-center">
        <Card className="max-w-md w-full border-dashed">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
            <CardTitle className="uppercase font-black text-muted-foreground">Módulo no disponible</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground font-medium">
              Este módulo ha sido desactivado permanentemente para optimizar la estabilidad del sistema y prevenir bloqueos del navegador.
            </p>
            <p className="text-[10px] mt-4 text-muted-foreground italic">
              Las importaciones masivas deben realizarse a través del script de servidor local para garantizar la integridad de los datos.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
