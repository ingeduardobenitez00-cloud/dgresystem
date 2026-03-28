
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { AlertTriangle, RefreshCw, ShieldAlert, LogOut, UserX, Clock, Lock } from 'lucide-react';
import { useUser, useFirebase } from '@/firebase';
import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/app-sidebar';
import { Button } from './ui/button';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import Loading from '@/app/loading';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading, userError, isProfileLoading } = useUser();
  const { auth, firestore } = useFirebase();
  const pathname = usePathname();
  const router = useRouter();
  
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // SISTEMA DE PRESENCIA (HEARTBEAT)
  const updatePresence = useCallback(async () => {
    if (!user || !firestore || !user.profile) return;
    
    const presenceRef = doc(firestore, 'presencia', user.uid);
    const presenceData = {
      usuario_id: user.uid,
      username: user.profile?.username || user.email || 'Usuario',
      email: user.email || '',
      role: user.profile?.role || 'funcionario',
      departamento: user.profile?.departamento || 'N/A',
      distrito: user.profile?.distrito || 'N/A',
      registration_method: user.profile?.registration_method || 'no_especificado',
      ultima_actividad: serverTimestamp(),
      ruta_actual: pathname || '/'
    };

    try {
      await setDoc(presenceRef, presenceData, { merge: true });
    } catch (err) {
      // Error silencioso
    }
  }, [user, firestore, pathname]);

  useEffect(() => {
    if (!mounted || !user) return;

    updatePresence();
    const interval = setInterval(updatePresence, 60000);
    return () => clearInterval(interval);
  }, [mounted, user, updatePresence]);

  const isPublicRoute = useMemo(() => {
    const publicRoutes = ['/login', '/encuesta-satisfaccion'];
    return publicRoutes.some(route => pathname.startsWith(route));
  }, [pathname]);

  useEffect(() => {
    if (!mounted || isUserLoading) return;

    if (!user && !isPublicRoute) {
      router.replace('/login');
    } else if (user && pathname === '/login') {
      router.replace('/');
    }
  }, [user, isUserLoading, isPublicRoute, pathname, router, mounted]);

  if (userError && mounted) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center p-6 text-center space-y-6 bg-background">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <div className="space-y-2">
          <h2 className="text-xl font-black uppercase text-primary">Error de Sincronización</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            No se pudo establecer conexión con el servidor de seguridad.
          </p>
        </div>
        <Button onClick={() => window.location.reload()} className="h-12 px-8 font-black uppercase">
          <RefreshCw className="mr-2 h-4 w-4" /> Reintentar Inicio
        </Button>
      </div>
    );
  }

  if (!mounted || isUserLoading || (user && isProfileLoading && !isPublicRoute)) {
    return <Loading />;
  }

  // VALIDACIÓN DE USUARIO ACTIVO CON PANTALLA DE "PENDIENTE DE APROBACIÓN"
  const isOwner = user?.email === 'edubtz11@gmail.com';
  const isRestricted = !isOwner && user && !isPublicRoute && (user.profile?.active === false || !user.profile);

  if (isRestricted) {
    const isPending = user.profile?.registration_method === 'auto_registro_jefe';

    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center p-6 bg-[#F8F9FA]">
        <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
          <div className={cn(
            "h-24 w-24 rounded-full flex items-center justify-center mx-auto border-4",
            isPending ? "bg-amber-100 border-amber-200" : "bg-destructive/10 border-destructive/20"
          )}>
            {isPending ? <Clock className="h-12 w-12 text-amber-600" /> : <UserX className="h-12 w-12 text-destructive" />}
          </div>
          
          <div className="space-y-4">
            <h1 className="text-3xl font-black uppercase text-primary tracking-tighter leading-none">
                {isPending ? "Acceso en Revisión" : "Acceso Denegado"}
            </h1>
            <div className="p-8 bg-white border-2 rounded-[2rem] shadow-2xl space-y-6">
              <p className="text-sm font-bold uppercase text-muted-foreground leading-relaxed">
                {isPending 
                    ? "Su solicitud de registro ha sido recibida pero su cuenta aún no ha sido activada." 
                    : "Su cuenta institucional ha sido desactivada por el departamento de seguridad."}
              </p>
              
              <div className="flex items-center gap-3 bg-muted/30 p-4 rounded-xl text-left border">
                <Lock className="h-5 w-5 text-primary opacity-40 shrink-0" />
                <p className="text-[10px] font-medium uppercase text-muted-foreground italic">
                    El Administrador Maestro debe verificar su identidad y otorgar los permisos de acceso correspondientes.
                </p>
              </div>
            </div>
          </div>
          <Button 
            variant="outline" 
            className="font-black uppercase text-xs h-12 border-2 gap-2 shadow-sm"
            onClick={() => auth.signOut()}
          >
            <LogOut className="h-4 w-4" /> Salir del Sistema
          </Button>
        </div>
        <footer className="fixed bottom-0 w-full py-6 px-4 text-center">
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight opacity-60">
            © 2026 Dpto. Informática DGRE - TSJE | PROTOCOLO DE SEGURIDAD CIDEE
          </p>
        </footer>
      </div>
    );
  }

  const isLoginPage = pathname === '/login';
  const isEncuestaPage = pathname.startsWith('/encuesta-satisfaccion');
  const isPublicView = isEncuestaPage && !user;
  const showSimpleLayout = isLoginPage || isPublicView;

  return (
    <SidebarProvider defaultOpen={false}>
      {showSimpleLayout ? (
        <div className="flex min-h-screen w-full flex-col items-center justify-center animate-in fade-in duration-500 bg-muted/40 overflow-x-hidden">
          <div className="flex-1 flex flex-col items-center justify-center w-full">
            {children}
          </div>
          <footer className="w-full py-6 px-4 text-center">
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight opacity-60">
              © 2026 Dpto. Informática DGRE - TSJE | Reservados todos los derechos.
            </p>
          </footer>
        </div>
      ) : (
        <>
          <Sidebar collapsible="offcanvas">
            <AppSidebar />
          </Sidebar>
          <SidebarInset>
            <div className="flex flex-1 flex-col">
              <div className="flex-1">
                {children}
              </div>
              <footer className="py-6 px-4 text-center border-t bg-muted/5">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight opacity-60">
                  © 2026 Dpto. Informática DGRE - TSJE | Reservados todos los derechos.
                </p>
              </footer>
            </div>
          </SidebarInset>
        </>
      )}
    </SidebarProvider>
  );
}
