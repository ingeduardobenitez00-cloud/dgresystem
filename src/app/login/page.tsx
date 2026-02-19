'use client';

import { useState } from 'react';
import Image from 'next/image';
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
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { auth } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  const [isLoadingLogin, setIsLoadingLogin] = useState(false);
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
  
  const handlePasswordReset = async () => {
    if (!auth) return;
    if (!loginEmail) {
      toast({
        variant: 'destructive',
        title: 'Correo requerido',
        description: 'Por favor, ingresa tu correo electrónico para recuperar la contraseña.',
      });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, loginEmail);
      toast({
        title: 'Correo enviado',
        description: 'Revisa tu bandeja de entrada para restablecer tu contraseña.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo enviar el correo. Verifica que el email sea correcto.',
      });
    }
  };


  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
       <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center">
            <Image 
              src="/logo.png" 
              alt="Logo de la aplicación" 
              width={80} 
              height={80} 
              className="mb-4" 
              priority 
            />
             <h1 className="text-2xl font-bold tracking-tight mt-2 uppercase text-primary">
                JUSTICIA ELECTORAL
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
                  placeholder=""
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">Contraseña</Label>
                     <button
                        type="button"
                        onClick={handlePasswordReset}
                        className="text-sm font-medium text-primary hover:underline"
                    >
                        ¿Olvidaste tu contraseña?
                    </button>
                </div>
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
      </div>
    </div>
  );
}
