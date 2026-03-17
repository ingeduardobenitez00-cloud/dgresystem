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
import { recordAuditLog } from '@/lib/audit';

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
    if (!auth || !firestore) return;
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      
      // Registrar inicio de sesión en auditoría
      recordAuditLog(firestore, {
        usuario_id: userCredential.user.uid,
        usuario_nombre: loginEmail,
        usuario_rol: 'desconocido', // Se actualizará tras cargar el perfil
        accion: 'LOGIN',
        modulo: 'seguridad',
        detalles: `Inicio de sesión exitoso desde el portal principal.`
      });

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

      const jefeModules = [
        'solicitud-capacitacion',
        'agenda-capacitacion',
        'control-movimiento-maquinas',
        'denuncia-lacres',
        'informe-movimientos-denuncias',
        'informe-divulgador',
        'informe-semanal-puntos-fijos',
        'encuesta-satisfaccion'
      ];

      const jefePermissions = [
        'assign_staff',
        'district_filter'
      ];

      jefeModules.forEach(mod => {
        jefePermissions.push(`${mod}:view`);
        jefePermissions.push(`${mod}:add`);
        jefePermissions.push(`${mod}:pdf`);
      });

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

      // Auditoría de nuevo registro
      recordAuditLog(firestore, {
        usuario_id: user.uid,
        usuario_nombre: regData.username,
        usuario_rol: 'jefe',
        accion: 'CREAR',
        modulo: 'seguridad',
        detalles: `Auto-registro de Jefe para ${regData.distrito}`
      });

      await signOut(auth);
      
      setLoginEmail(regData.email);
      setMode('login');
      
      toast({ 
        title: 'Registro exitoso', 
        description: 'Su cuenta de Jefe ha sido creada con filtro distrital automático. Por favor, inicie sesión.' 
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
        description: 'Revisa tu bandeja de entrada para restablecer tu contraseña. Si no lo ves, revisa la carpeta SPAM.',
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
    <div className="flex-1 flex flex-col items-center justify-center p-4">
       <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col items-center">
            <div className="flex items-center justify-center gap-6 mb-6">
                <div className="h-16 w-16 relative">
                   <Image 
                    src="/logo.png" 
                    alt="Logo Izquierdo" 
                    fill 
                    className="object-contain" 
                    priority 
                  />
                </div>
                <div className="h-16 w-16 relative">
                   <Image 
                    src="/logo1.png" 
                    alt="Logo Medio" 
                    fill 
                    className="object-contain" 
                    priority 
                  />
                </div>
                <div className="h-16 w-16 relative">
                   <Image 
                    src="/logo3.png" 
                    alt="Logo Derecho" 
                    fill 
                    className="object-contain" 
                    priority 
                  />
                </div>
            </div>
             <div className="space-y-1 text-center">
                <h3 className="text-[10px] sm:text-xs font-black tracking-tight uppercase text-[#1A1A1A] leading-none opacity-80">
                    DIRECCION GENERAL DEL REGISTRO ELECTORAL
                </h3>
                <h1 className="text-xl sm:text-2xl font-black tracking-tighter uppercase text-primary leading-none py-1">
                    JUSTICIA ELECTORAL
                </h1>
                <p className="text-[9px] sm:text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">
                    SISTEMA DE GESTIÓN
                </p>
             </div>
        </div>

        <Card className="border-t-4 border-t-primary shadow-2xl bg-white overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="uppercase font-black text-center text-xl tracking-tight">
              {mode === 'login' ? 'Acceso al Sistema' : 'Registro de Jefe'}
            </CardTitle>
            <CardDescription className="text-center font-bold uppercase text-[9px] tracking-widest opacity-60">
              {mode === 'login' ? 'Ingrese sus credenciales oficiales' : 'Cree su perfil regional con filtro automático'}
            </CardDescription>
          </CardHeader>

          {mode === 'login' ? (
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Correo Electrónico</Label>
                  <Input
                    id="login-email"
                    type="text"
                    required
                    autoCapitalize="none"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="font-bold border-2 h-11 focus-visible:ring-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                      <Label htmlFor="login-password" className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Contraseña</Label>
                       <button
                          type="button"
                          onClick={handlePasswordReset}
                          className="text-[9px] font-bold text-primary hover:underline uppercase tracking-tight"
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
                        className="font-bold border-2 h-11 focus-visible:ring-primary/20"
                      />
                      <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute inset-y-0 right-0 h-full w-10 text-muted-foreground hover:bg-transparent"
                          onClick={() => setPasswordVisible(!passwordVisible)}
                      >
                          {passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4 pt-2">
                <Button type="submit" className="w-full h-12 font-black uppercase shadow-xl tracking-widest transition-transform active:scale-95" disabled={isLoading}>
                   {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                  Ingresar al sistema
                </Button>
                
                <div className="w-full">
                    <Button 
                        type="button" 
                        variant="outline" 
                        className="w-full border-2 font-black uppercase text-[10px] gap-2 h-11 tracking-wider"
                        onClick={() => setMode('register')}
                    >
                        <UserPlus className="h-4 w-4" /> Registrarse como Jefe
                    </Button>
                </div>
              </CardFooter>
            </form>
          ) : (
            <form onSubmit={handleRegisterJefe}>
              <CardContent className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Nombre y Apellido</Label>
                  <Input 
                    required 
                    value={regData.username}
                    onChange={(e) => setRegData(p => ({...p, username: e.target.value}))}
                    className="font-bold border-2 h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Correo Electrónico</Label>
                  <Input 
                    type="text" 
                    required 
                    autoCapitalize="none"
                    value={regData.email}
                    onChange={(e) => setRegData(p => ({...p, email: e.target.value}))}
                    className="font-bold border-2 h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Nueva Contraseña</Label>
                  <Input 
                    type="password" 
                    required 
                    value={regData.password}
                    onChange={(e) => setRegData(p => ({...p, password: e.target.value}))}
                    className="font-bold border-2 h-11"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3"/> Dpto.</Label>
                    <Select onValueChange={(v) => setRegData(p => ({...p, departamento: v, distrito: ''}))}>
                      <SelectTrigger className="font-bold border-2 text-[10px] h-10">
                        <SelectValue placeholder="Elegir..." />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map(d => <SelectItem key={d} value={d} className="text-[10px] uppercase font-bold">{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3"/> Distrito</Label>
                    <Select onValueChange={(v) => setRegData(p => ({...p, distrito: v}))} disabled={!regData.departamento}>
                      <SelectTrigger className="font-bold border-2 text-[10px] h-10">
                        <SelectValue placeholder="Elegir..." />
                      </SelectTrigger>
                      <SelectContent>
                        {districts.map(d => <SelectItem key={d} value={d} className="text-[10px] uppercase font-bold">{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3 pt-2">
                <Button type="submit" className="w-full h-12 font-black uppercase shadow-xl tracking-widest" disabled={isLoading}>
                   {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  Completar Registro
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full text-[9px] font-black uppercase text-muted-foreground tracking-widest"
                  onClick={() => setMode('login')}
                >
                  Volver al Ingreso
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
