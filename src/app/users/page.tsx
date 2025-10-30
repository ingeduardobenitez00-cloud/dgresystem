"use client";

import { useState } from 'react';
import Header from '@/components/header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useFirebase } from '@/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

export default function UsersPage() {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const { toast } = useToast();
  const { auth, firestore } = useFirebase();

  const togglePasswordVisibility = () => {
    setPasswordVisible(!passwordVisible);
  };
  
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!auth || !firestore) {
      toast({
        variant: "destructive",
        title: "Error de Firebase",
        description: "Los servicios de autenticación no están disponibles.",
      });
      return;
    }

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const username = formData.get('username') as string;
    const role = formData.get('role') as string;

    const modules: string[] = [];
    if (formData.get('access-fotos')) modules.push('fotos');
    if (formData.get('access-ficha')) modules.push('ficha');
    if (formData.get('access-resumen')) modules.push('resumen');
    if (formData.get('access-config')) modules.push('config');
    if (formData.get('access-users')) modules.push('users');

    const permissions: string[] = [];
    if (formData.get('perm-add')) permissions.push('add');
    if (formData.get('perm-edit')) permissions.push('edit');
    if (formData.get('perm-delete')) permissions.push('delete');

    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Store additional user info in Firestore
      await setDoc(doc(firestore, 'users', user.uid), {
        username,
        email,
        role,
        modules,
        permissions,
      });

      toast({
        title: 'Usuario Creado',
        description: 'El nuevo usuario ha sido guardado con éxito.',
      });
      event.currentTarget.reset();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast({
        variant: "destructive",
        title: 'Error al crear usuario',
        description: error.message || 'Ocurrió un error inesperado.',
      });
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Gestión de Usuarios" />
      <main className="flex flex-1 flex-col items-center p-4 gap-8">
        <Card className="w-full max-w-2xl">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Crear Nuevo Usuario
              </CardTitle>
              <CardDescription>
                Rellena los campos para añadir un nuevo usuario al sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="username">Usuario</Label>
                  <Input id="username" name="username" placeholder="ej. juanperez" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input id="email" name="email" type="email" placeholder="ej. juan.perez@dominio.com" required />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Input id="password" name="password" type={passwordVisible ? 'text' : 'password'} placeholder="••••••••" required />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute inset-y-0 right-0 h-full w-10 text-muted-foreground"
                      onClick={togglePasswordVisibility}
                    >
                      {passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="role">Rol</Label>
                    <Select name="role" required>
                        <SelectTrigger id="role">
                        <SelectValue placeholder="Seleccionar un rol" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="viewer">Visualizador</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
              </div>
              
              <Separator />

              <div className="space-y-4">
                <Label>Acceso a Módulos</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                        <Checkbox id="access-fotos" name="access-fotos" defaultChecked />
                        <Label htmlFor="access-fotos" className="font-normal">
                            Fotos
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="access-ficha" name="access-ficha" defaultChecked />
                        <Label htmlFor="access-ficha" className="font-normal">
                            Vista de Ficha
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="access-resumen" name="access-resumen" defaultChecked />
                        <Label htmlFor="access-resumen" className="font-normal">
                            Resumen
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="access-config" name="access-config" />
                        <Label htmlFor="access-config" className="font-normal">
                            Configuración
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="access-users" name="access-users" />
                        <Label htmlFor="access-users" className="font-normal">
                            Usuarios
                        </Label>
                    </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label>Permisos</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                        <Checkbox id="perm-add" name="perm-add" />
                        <Label htmlFor="perm-add" className="font-normal">
                            Agregar
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="perm-edit" name="perm-edit" />
                        <Label htmlFor="perm-edit" className="font-normal">
                            Editar
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="perm-delete" name="perm-delete" />
                        <Label htmlFor="perm-delete" className="font-normal">
                            Borrar
                        </Label>
                    </div>
                </div>
              </div>

            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full">Guardar Usuario</Button>
            </CardFooter>
          </form>
        </Card>
      </main>
    </div>
  );
}
