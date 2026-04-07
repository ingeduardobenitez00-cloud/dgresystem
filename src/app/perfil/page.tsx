
"use client";

import { useState, useRef, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  User, 
  Mail, 
  Shield, 
  MapPin, 
  Camera, 
  Lock, 
  Loader2, 
  CheckCircle2, 
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { useUser, useFirebase } from '@/firebase';
import { updateProfile, updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import Image from 'next/image';

export default function PerfilPage() {
  const { user, isUserLoading } = useUser();
  const { auth, firestore } = useFirebase();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [username, setUsername] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setUsername(user.profile?.username || user.displayName || '');
      setPhotoUrl(user.photoURL || user.profile?.photo_url || null);
    }
  }, [user]);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const scaleSize = Math.min(1, MAX_WIDTH / img.width);
          canvas.width = img.width * scaleSize;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject('No context');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file);
      setPhotoUrl(compressed);
    } catch (err) {
      toast({ variant: 'destructive', title: "Error al procesar imagen" });
    }
  };

  const handleUpdateProfile = async () => {
    if (!auth.currentUser || !firestore || !user) return;
    
    setIsSubmitting(true);
    try {
      // 1. Actualizar Firebase Auth (Solo Nombre para evitar errores de tamaño en photoURL)
      await updateProfile(auth.currentUser, {
        displayName: username.toUpperCase(),
      });

      // 2. Actualizar Firestore (Aquí sí guardamos la foto en Base64)
      const userRef = doc(firestore, 'users', user.uid);
      await updateDoc(userRef, {
        username: username.toUpperCase(),
        photo_url: photoUrl
      });

      toast({ title: "Perfil actualizado", description: "Tus cambios se han guardado correctamente." });
    } catch (err: any) {
      console.error(err);
      toast({ 
        variant: 'destructive', 
        title: "Error al actualizar perfil", 
        description: err.message || "Verifica tu conexión o permisos." 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async () => {
    if (!auth.currentUser) return;
    if (passwords.new !== passwords.confirm) {
        toast({ variant: 'destructive', title: "Las contraseñas no coinciden" });
        return;
    }
    if (passwords.new.length < 6) {
        toast({ variant: 'destructive', title: "La contraseña debe tener al menos 6 caracteres" });
        return;
    }

    setIsSubmitting(true);
    try {
      await updatePassword(auth.currentUser, passwords.new);
      toast({ title: "Contraseña actualizada", description: "Tu seguridad se ha reforzado." });
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        toast({ 
            variant: 'destructive', 
            title: "Sesión expirada", 
            description: "Por seguridad, debes cerrar sesión y volver a entrar para cambiar tu contraseña." 
        });
      } else {
        toast({ variant: 'destructive', title: "Error al cambiar contraseña", description: err.message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isUserLoading || !user) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Configuración de Perfil" />
      <main className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full space-y-8 pb-20">
        
        <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Mi Perfil</h1>
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                <Shield className="h-3.5 w-3.5" /> Seguridad e Identidad Institucional
            </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* COLUMNA IZQUIERDA: AVATAR Y DATOS FIJOS */}
            <div className="space-y-6">
                <Card className="border-none shadow-xl overflow-hidden rounded-[2.5rem] bg-white">
                    <CardHeader className="bg-primary/5 text-center p-8">
                        <div className="relative mx-auto w-32 h-32">
                            <Avatar className="w-full h-full border-4 border-white shadow-2xl">
                                <AvatarImage src={photoUrl || undefined} className="object-cover" />
                                <AvatarFallback className="bg-primary text-white text-4xl">
                                    {(username.charAt(0) || user.email?.charAt(0) || '?').toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <Button 
                                size="icon" 
                                className="absolute bottom-0 right-0 rounded-full h-10 w-10 shadow-lg border-2 border-white"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Camera className="h-4 w-4" />
                            </Button>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*"
                                onChange={handlePhotoUpload}
                            />
                        </div>
                        <div className="mt-4">
                            <h2 className="font-black text-lg uppercase leading-none">{username || 'USUARIO'}</h2>
                            <p className="text-[10px] font-black text-primary uppercase mt-1 tracking-widest">{user.profile?.role}</p>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-2xl">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black uppercase text-muted-foreground">Correo Institucional</span>
                                    <span className="text-[11px] font-bold">{user.email}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-2xl">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black uppercase text-muted-foreground">Ubicación Asignada</span>
                                    <span className="text-[11px] font-bold uppercase">{user.profile?.departamento} | {user.profile?.distrito}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                
                <div className="p-6 bg-amber-50 border-2 border-amber-100 rounded-[2rem] space-y-3">
                    <div className="flex items-center gap-2 text-amber-700">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-[10px] font-black uppercase">Nota de Seguridad</span>
                    </div>
                    <p className="text-[9px] font-bold text-amber-800/60 uppercase leading-relaxed">
                        Los datos de ubicación y roles son gestionados por la Dirección. Si necesita cambios de jurisdicción, envíe una nota a Jefatura.
                    </p>
                </div>
            </div>

            {/* COLUMNA DERECHA: EDICIÓN */}
            <div className="lg:col-span-2 space-y-8">
                
                {/* DATOS PERSONALES */}
                <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
                    <CardHeader className="p-8 border-b bg-white">
                        <CardTitle className="text-sm font-black uppercase flex items-center gap-3">
                            <User className="h-5 w-5 text-primary" /> Información Personal
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Nombre Completo / Firma Digital</Label>
                            <Input 
                                value={username} 
                                onChange={(e) => setUsername(e.target.value)}
                                className="h-14 font-black uppercase border-2 rounded-2xl px-6 focus-visible:ring-primary shadow-sm"
                                placeholder="NOMBRE Y APELLIDO"
                            />
                            <p className="text-[9px] font-bold text-muted-foreground ml-1">Este nombre aparecerá en los reportes PDF y formularios oficiales.</p>
                        </div>
                    </CardContent>
                    <CardFooter className="p-8 bg-muted/5 border-t flex justify-end">
                        <Button 
                            onClick={handleUpdateProfile} 
                            disabled={isSubmitting}
                            className="h-12 px-8 bg-black hover:bg-black/90 font-black uppercase text-xs rounded-xl gap-2 shadow-lg"
                        >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            Guardar Cambios
                        </Button>
                    </CardFooter>
                </Card>

                {/* SEGURIDAD */}
                <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
                    <CardHeader className="p-8 border-b bg-white">
                        <CardTitle className="text-sm font-black uppercase flex items-center gap-3">
                            <Lock className="h-5 w-5 text-primary" /> Seguridad de Cuenta
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Nueva Contraseña</Label>
                                <Input 
                                    type="password"
                                    value={passwords.new}
                                    onChange={(e) => setPasswords(p => ({ ...p, new: e.target.value }))}
                                    className="h-14 font-bold border-2 rounded-2xl px-6"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Confirmar Nueva Contraseña</Label>
                                <Input 
                                    type="password"
                                    value={passwords.confirm}
                                    onChange={(e) => setPasswords(p => ({ ...p, confirm: e.target.value }))}
                                    className="h-14 font-bold border-2 rounded-2xl px-6"
                                />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="p-8 bg-muted/5 border-t flex justify-end">
                        <Button 
                            variant="outline"
                            onClick={handleChangePassword} 
                            disabled={isSubmitting || !passwords.new}
                            className="h-12 px-8 border-2 font-black uppercase text-xs rounded-xl gap-2 hover:bg-destructive hover:text-white hover:border-destructive transition-all"
                        >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                            Actualizar Seguridad
                        </Button>
                    </CardFooter>
                </Card>

            </div>
        </div>
      </main>
    </div>
  );
}
