
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { AlertTriangle, RefreshCw, ShieldAlert, LogOut, UserX, Clock, Lock, Construction } from 'lucide-react';
import { useUser, useFirebase } from '@/firebase';
import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/app-sidebar';
import { Button } from './ui/button';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import Loading from '@/app/loading';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading, userError, isProfileLoading } = useUser();
  const { auth, firestore } = useFirebase();
  const pathname = usePathname();
  const router = useRouter();
  
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const sysConfigRef = useMemo(() => firestore ? doc(firestore, 'sysconfig', 'status') : null, [firestore]);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [sessionAlert, setSessionAlert] = useState(false);

  useEffect(() => {
    if (!sysConfigRef || !firestore) return;

    let unsubscribe: (() => void) | undefined;

    const setupListener = async () => {
      try {
        const { onSnapshot } = await import('firebase/firestore');
        unsubscribe = onSnapshot(sysConfigRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setMaintenanceMode(data.maintenance === true);
            setSessionAlert(data.session_alert === true);
          } else {
            setMaintenanceMode(false);
            setSessionAlert(false);
          }
        });
      } catch (err) {
        console.error("Error setting up maintenance listener:", err);
      }
    };

    setupListener();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [sysConfigRef, firestore]);

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
    const interval = setInterval(updatePresence, 300000); // 5 minutos para ahorrar lecturas/escrituras
    return () => clearInterval(interval);
  }, [mounted, user, updatePresence]);

  // SISTEMA DE TIEMPO DE INACTIVIDAD (IDLE TIMER)
  const IDLE_TIMEOUT = (user?.isAdmin || user?.isOwner) ? 1200 : 600;
  const [timer, setTimer] = useState(IDLE_TIMEOUT);
  const [showIdleWarning, setShowIdleWarning] = useState(false);

  const resetTimer = useCallback(() => {
    setTimer(IDLE_TIMEOUT);
    setShowIdleWarning(false);
  }, [IDLE_TIMEOUT]);

  useEffect(() => {
    if (!mounted || !user) return;

    // Resetear al cambiar de timeout base (por login/cambio de rol)
    setTimer(IDLE_TIMEOUT);

    // Escuchar eventos de actividad
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    const countdown = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(countdown);
          auth.signOut();
          return 0;
        }
        // Mostrar advertencia 1 minuto antes de expirar
        if (prev === 61) {
          setShowIdleWarning(true);
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      events.forEach(event => window.removeEventListener(event, resetTimer));
      clearInterval(countdown);
    };
  }, [mounted, user, resetTimer, auth]);

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

  // VALIDACIÓN DE USUARIO ACTIVO REFORZADA
  // Un usuario está restringido SOLO si su campo 'active' es explícitamente 'false'.
  const isOwner = user?.isOwner;
  const isAdminOrOwner = isOwner || user?.isAdmin;
  const isRestricted = !isAdminOrOwner && user && !isPublicRoute && user.profile?.active === false;

  const isMaintenanceBlocked = maintenanceMode && !isAdminOrOwner && !isPublicRoute;

  if (isMaintenanceBlocked && mounted) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center p-6 text-center space-y-6 bg-[#0f172a] text-white">
        <div className="bg-amber-500/20 p-6 rounded-full border border-amber-500/50 mb-2">
            <Construction className="h-16 w-16 text-amber-500" />
        </div>
        <div className="space-y-4 max-w-lg">
          <h2 className="text-3xl font-black uppercase text-amber-500 tracking-tight">Sistema en Mantenimiento</h2>
          <p className="text-base text-slate-300 font-medium">
            El sistema se encuentra temporalmente en <strong>mantenimiento oficial</strong> para facilitar la gestión interna y aplicar mejoras. 
          </p>
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 mt-6 space-y-4">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                  Por favor, intente ingresar más tarde.
              </p>
              <Button 
                variant="outline" 
                className="w-full h-12 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white font-black uppercase text-[10px] rounded-xl"
                onClick={() => auth.signOut()}
              >
                <LogOut className="h-4 w-4 mr-2" /> Salir del Sistema
              </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isRestricted) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center p-6 bg-[#F8F9FA]">
        <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="h-24 w-24 rounded-full flex items-center justify-center mx-auto border-4 bg-amber-100 border-amber-200">
            <Clock className="h-12 w-12 text-amber-600" />
          </div>
          
          <div className="space-y-4">
            <h1 className="text-3xl font-black uppercase text-primary tracking-tighter leading-none">
                Acceso Restringido
            </h1>
            <div className="p-8 bg-white border-2 rounded-[2rem] shadow-2xl space-y-6">
              <p className="text-sm font-bold uppercase text-muted-foreground leading-relaxed">
                {user.profile?.role === 'jefe' 
                  ? 'Su perfil de Jefe requiere una sincronización inicial para habilitar los módulos de su distrito.'
                  : 'Su cuenta estará habilitada en 6 a 12 horas.'}
              </p>
              
              {user.profile?.role === 'jefe' && (
                <Button 
                  className="w-full h-14 bg-green-600 hover:bg-green-700 text-white font-black uppercase text-xs rounded-xl shadow-lg gap-2"
                  onClick={async () => {
                    if (!firestore || !user.uid) return;
                    try {
                      await setDoc(doc(firestore, 'users', user.uid), { active: true }, { merge: true });
                      window.location.reload();
                    } catch (e) {
                      alert("Error al sincronizar. Contacte a soporte.");
                    }
                  }}
                >
                  <RefreshCw className="h-4 w-4 animate-spin" /> Sincronizar y Activar Mi Acceso
                </Button>
              )}

              <div className="flex items-center gap-3 bg-muted/30 p-4 rounded-xl text-left border">
                <Lock className="h-5 w-5 text-primary opacity-40 shrink-0" />
                <p className="text-[10px] font-medium uppercase text-muted-foreground italic">
                    {user.profile?.role === 'jefe'
                      ? 'Al presionar el botón superior, su perfil será validado automáticamente con los parámetros institucionales.'
                      : 'El Administrador Maestro debe verificar su identidad y otorgar los permisos de acceso correspondientes.'}
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
              © 2026 Dpto. Informática DGRE - TSJE | ING. EDUARDO BENITEZ Reservados todos los derechos.
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
                {sessionAlert && user && !isPublicRoute && (
                  <div className="bg-destructive text-white px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top duration-500 border-b-4 border-black/20 relative z-[60]">
                    <div className="flex items-center gap-3">
                      <div className="bg-white/20 p-2 rounded-lg">
                        <ShieldAlert className="h-5 w-5 text-white" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-black uppercase tracking-tight">ACTUALIZACIÓN DE RENDIMIENTO REQUERIDA</p>
                        <p className="text-[10px] font-bold opacity-90 uppercase">Se han aplicado mejoras críticas de ahorro de datos y velocidad. Por favor, cierre sesión ahora para activar los cambios.</p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="bg-white text-destructive hover:bg-white/90 border-none font-black uppercase text-[10px] h-9 px-6 rounded-full shadow-lg"
                      onClick={() => auth.signOut()}
                    >
                      <LogOut className="h-4 w-4 mr-2" /> CERRAR SESIÓN AHORA
                    </Button>
                  </div>
                )}
                {children}
              </div>
              <footer className="py-6 px-4 text-center border-t bg-muted/5">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight opacity-60">
                  © 2026 Dpto. Informática DGRE - TSJE | ING. EDUARDO BENITEZ Reservados todos los derechos.
                </p>
              </footer>
            </div>
          </SidebarInset>
        </>
      )}

      {/* DIÁLOGO DE ADVERTENCIA POR INACTIVIDAD */}
      <Dialog open={showIdleWarning} onOpenChange={setShowIdleWarning}>
        <DialogContent className="max-w-md rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-amber-600 text-white p-6">
            <DialogTitle className="font-black uppercase text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" /> AVISO DE SEGURIDAD
            </DialogTitle>
          </DialogHeader>
          <div className="p-8 space-y-6 bg-white text-center">
            <div className="space-y-2">
              <h3 className="font-black uppercase text-base text-primary">¿SIGUES AHÍ?</h3>
              <p className="text-[11px] font-bold text-muted-foreground uppercase leading-tight">
                Tu sesión está por expirar por inactividad administrativa. Por tu seguridad, cerraremos la sesión en:
              </p>
            </div>

            <div className="py-4">
              <span className="text-5xl font-black text-amber-600 animate-pulse">
                {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <Button 
                className="h-14 bg-black hover:bg-black/90 text-white rounded-xl font-black uppercase text-xs shadow-xl" 
                onClick={resetTimer}
              >
                MANTENER MI SESIÓN ACTIVA
              </Button>
              <Button 
                variant="ghost" 
                className="h-10 font-bold uppercase text-[10px] text-muted-foreground" 
                onClick={() => auth.signOut()}
              >
                CERRAR SESIÓN AHORA
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
