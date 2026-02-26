
'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { collection, doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, UserPlus, LogIn, MapPin } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type Dato } from '@/lib/data';

export default function LoginPage() {
  const { auth, firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  // Login States
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  // Register States (Role: Jefe)
  const [regData, setRegData] = useState({
    username: '',
    email: '',
    password: '',
    departamento: '',
    distrito: '',
  });

  // Data for Selects
  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData } = useCollection<Dato>(datosQuery);

  const departments = useMemo(() => {
    if (!datosData) return [];
    return [...new Set(datosData.map(d => d.departamento))].sort();
  }, [datosData]);

  const districts = useMemo(() => {
    if (!datosData || !regData.departamento) return [];
    return [...new Set(datosData.filter(d => d.departamento === regData.departamento).map(d => d.distrito))].sort();
  }, [datosData, regData.departamento]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setIsLoading(true);
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
        setIsLoading(false);
    }
  };

  const handleRegisterJefe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) return;
    
    if (!regData.departamento || !regData.distrito) {
      toast({ variant: 'destructive', title: 'Faltan datos', description: 'Por favor seleccione Departamento y Distrito.' });
      return;
    }

    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, regData.email, regData.password);
      const user = userCredential.user;

      // Definición de módulos para el rol Jefe
      const jefeModules = [
        'solicitud-capacitacion',
        'agenda-capacitacion',
        'control-movimiento-maquinas',
        'denuncia-lacres',
        'informe-divulgador',
        'informe-semanal-puntos-fijos',
        'encuesta-satisfaccion'
      ];

      // Construcción de permisos granulares (Ver, Guardar, PDF) para cada módulo
      const jefePermissions = [
        'assign_staff',
        'district_filter'
      ];

      jefeModules.forEach(mod => {
        jefePermissions.push(`${mod}:view`);
        jefePermissions.push(`${mod}:add`);
        jefePermissions.push(`${mod}:pdf`);
      });

      // Create User Profile in Firestore with role 'jefe'
      await setDoc(doc(firestore, 'users', user.uid), {
        username: regData.username, 
        email: regData.email,
        role: 'jefe',
        departamento: regData.departamento,
        distrito: regData.distrito,
        modules: jefeModules,
        permissions: jefePermissions,
        fecha_registro: new Date().toISOString()
      });

      // Sign out the user immediately after registration to force manual login
      await signOut(auth);
      
      // Update states to show login form with pre-filled email
      setLoginEmail(regData.email);
      setMode('login');
      
      toast({ 
        title: 'Registro exitoso', 
        description: 'Su cuenta ha sido creada con los permisos de Jefe. Por favor, inicie sesión.' 
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error en el registro',
        description: error.message || 'No se pudo completar el registro.',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handlePasswordReset = async () => {
    if (!auth) return;
    const email = mode === 'login' ? loginEmail : regData.email;
    if (!email) {
      toast({
        variant: 'destructive',
        title: 'Correo requerido',
        description: 'Por favor, ingresa tu correo electrónico.',
      });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      toast({
        title: 'Correo enviado',
        description: 'Revisa tu bandeja de entrada para restablecer tu contraseña.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo enviar el correo.',
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
       <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center">
            <div className="h-20 w-20 relative mb-4">
               <Image 
                src="/logo.png" 
                alt="Logo Justicia Electoral" 
                fill 
                className="object-contain" 
                priority 
              />
            </div>
             <h1 className="text-2xl font-black tracking-tight mt-2 uppercase text-primary text-center">
                JUSTICIA ELECTORAL
             </h1>
             <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-1">SISTEMA DE GESTIÓN INTEGRAL</p>
        </div>

        <Card className="border-t-4 border-t-primary shadow-2xl">
          <CardHeader>
            <CardTitle className="uppercase font-black text-center text-xl">
              {mode === 'login' ? 'Acceso al Sistema' : 'Registro de Jefe'}
            </CardTitle>
            <CardDescription className="text-center font-bold uppercase text-[10px]">
              {mode === 'login' ? 'Ingrese sus credenciales oficiales' : 'Cree su perfil regional de supervisión'}
            </CardDescription>
          </CardHeader>

          {mode === 'login' ? (
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-[10px] font-black uppercase">Correo Electrónico</Label>
                  <Input
                    id="login-email"
                    type="text"
                    required
                    autoCapitalize="none"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="font-bold border-2"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                      <Label htmlFor="login-password" className="text-[10px] font-black uppercase">Contraseña</Label>
                       <button
                          type="button"
                          onClick={handlePasswordReset}
                          className="text-[10px] font-bold text-primary hover:underline uppercase"
                      >
                          ¿Olvidó su clave?
                      </button>
                  </div>
                  <div className="relative">
                      <Input
                        id="login-password"
                        type={passwordVisible ? 'text' : 'password'}
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="font-bold border-2"
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
              <CardFooter className="flex flex-col gap-4">
                <Button type="submit" className="w-full h-12 font-black uppercase shadow-lg" disabled={isLoading}>
                   {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                  Ingresar
                </Button>
                <div className="relative w-full text-center">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-muted" /></div>
                  <span className="relative bg-background px-4 text-[9px] font-black text-muted-foreground uppercase">O solicita tu acceso</span>
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full border-2 border-primary text-primary font-black uppercase text-[10px]"
                  onClick={() => setMode('register')}
                >
                  <UserPlus className="mr-2 h-4 w-4" /> Registrarse como Jefe
                </Button>
              </CardFooter>
            </form>
          ) : (
            <form onSubmit={handleRegisterJefe}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Nombre y Apellido</Label>
                  <Input 
                    required 
                    value={regData.username}
                    onChange={(e) => setRegData(p => ({...p, username: e.target.value}))}
                    className="font-bold border-2"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Correo Electrónico</Label>
                  <Input 
                    type="text" 
                    required 
                    autoCapitalize="none"
                    value={regData.email}
                    onChange={(e) => setRegData(p => ({...p, email: e.target.value}))}
                    className="font-bold border-2"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Nueva Contraseña</Label>
                  <Input 
                    type="password" 
                    required 
                    value={regData.password}
                    onChange={(e) => setRegData(p => ({...p, password: e.target.value}))}
                    className="font-bold border-2"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase flex items-center gap-1"><MapPin className="h-3 w-3"/> Dpto.</Label>
                    <Select onValueChange={(v) => setRegData(p => ({...p, departamento: v, distrito: ''}))}>
                      <SelectTrigger className="font-bold border-2 text-[10px] h-9">
                        <SelectValue placeholder="Elegir..." />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map(d => <SelectItem key={d} value={d} className="text-[10px] uppercase font-bold">{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase flex items-center gap-1"><MapPin className="h-3 w-3"/> Distrito</Label>
                    <Select onValueChange={(v) => setRegData(p => ({...p, distrito: v}))} disabled={!regData.departamento}>
                      <SelectTrigger className="font-bold border-2 text-[10px] h-9">
                        <SelectValue placeholder="Elegir..." />
                      </SelectTrigger>
                      <SelectContent>
                        {districts.map(d => <SelectItem key={d} value={d} className="text-[10px] uppercase font-bold">{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button type="submit" className="w-full h-12 font-black uppercase shadow-lg" disabled={isLoading}>
                   {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  Completar Registro
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full text-[10px] font-black uppercase text-muted-foreground"
                  onClick={() => setMode('login')}
                >
                  Volver al Ingreso
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>
        <p className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-50">
          República del Paraguay
        </p>
      </div>
    </div>
  );
}
