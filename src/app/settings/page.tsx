"use client";

import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const { toast } = useToast();

  const handleSaveChanges = () => {
    toast({
      title: 'Cambios guardados',
      description: 'Tu configuración ha sido actualizada.',
    });
  };

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Configuración" />
      <main className="flex flex-1 justify-center p-4 py-8">
        <div className="w-full max-w-3xl space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Perfil de Usuario</CardTitle>
              <CardDescription>
                Actualiza la información de tu perfil.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Nombre</Label>
                  <Input id="firstName" defaultValue="Usuario" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Apellido</Label>
                  <Input id="lastName" defaultValue="Admin" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <Input id="email" type="email" defaultValue="admin@example.com" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preferencias del Sistema</CardTitle>
              <CardDescription>
                Ajusta las opciones de la aplicación.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="space-y-2">
                <Label htmlFor="appName">Nombre de la Aplicación</Label>
                <Input id="appName" defaultValue="Informe Edilicio" />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveChanges}>
              <Save className="mr-2" />
              Guardar Cambios
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
