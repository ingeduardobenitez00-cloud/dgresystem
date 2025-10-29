
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirebase } from '@/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { BookMarked, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { auth, firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminUsername, setAdminUsername] = useState('');

  const [isLoadingLogin, setIsLoadingLogin] = useState(false);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setIsLoadingLogin(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      toast({ title: 'Inicio de sesión exitoso' });
      router.push('/');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error de inicio de sesión',
        description: 'Credenciales incorrectas. Por favor, intenta de nuevo.',
      });
    } finally {
        setIsLoadingLogin(false);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) return;
    setIsLoadingAdmin(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        adminEmail,
        adminPassword
      );
      const user = userCredential.user;

      await setDoc(doc(firestore, 'users', user.uid), {
        email: adminEmail,
        username: adminUsername,
        role: 'admin',
        modules: ['fotos', 'config', 'users', 'ficha'],
        permissions: ['add', 'edit', 'delete'],
      });

      toast({
        title: 'Administrador creado',
        description: 'El usuario administrador ha sido creado exitosamente.',
      });
      setAdminEmail('');
      setAdminPassword('');
      setAdminUsername('');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al crear administrador',
        description: error.message,
      });
    } finally {
        setIsLoadingAdmin(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
       <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center">
            <BookMarked className="h-10 w-10 text-primary" />
             <h1 className="text-2xl font-semibold tracking-tight mt-2">
                Informe Edilicio
             </h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Iniciar Sesión</CardTitle>
            <CardDescription>
              Ingresa tus credenciales para acceder al sistema.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Correo Electrónico</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="admin@ejemplo.com"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Contraseña</Label>
                <div className="relative">
                    <Input
                    id="login-password"
                    type={passwordVisible ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute inset-y-0 right-0 h-full w-10 text-muted-foreground"
                        onClick={() => setPasswordVisible(!passwordVisible)}
                    >
                        {passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isLoadingLogin}>
                 {isLoadingLogin && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Ingresar
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Crear Usuario Administrador</CardTitle>
            <CardDescription>
              Crea el primer usuario con permisos de administrador.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleCreateAdmin}>
            <CardContent className="space-y-4">
               <div className="space-y-2">
                <Label htmlFor="admin-username">Usuario</Label>
                <Input
                  id="admin-username"
                  required
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-email">Correo Electrónico</Label>
                <Input
                  id="admin-email"
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Contraseña</Label>
                <Input
                  id="admin-password"
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" variant="secondary" className="w-full" disabled={isLoadingAdmin}>
                 {isLoadingAdmin && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Administrador
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
