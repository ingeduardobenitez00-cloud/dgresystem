
"use client";

import { useMemo, useState, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useUser, useFirebase, useCollectionOnce, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { 
    Loader2, 
    Activity, 
    Globe, 
    Clock, 
    UserCheck, 
    ShieldCheck, 
    MapPin, 
    Trash2, 
    Search, 
    Mail, 
    UserPlus, 
    ShieldAlert, 
    UserX, 
    Landmark, 
    Building2,
    MonitorPlay,
    ChevronRight,
    AlertTriangle,
    RefreshCw
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { recordAuditLog } from '@/lib/audit';

type PresenceRecord = {
  id: string;
  usuario_id: string;
  username: string;
  email: string;
  role: string;
  departamento: string;
  distrito: string;
  ultima_actividad: any;
  ruta_actual: string;
  registration_method?: string;
};

const ONLINE_THRESHOLD_MS = 4500000;

export default function ConexionesPage() {
  const { user: currentUser, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [now, setNow] = useState(Date.now());
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isPurging, setIsPurging] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const presenceQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading) return null;
    return collection(firestore, 'presencia');
  }, [firestore, isUserLoading]);

  const { data: presenceData, isLoading } = useCollectionOnce<PresenceRecord>(presenceQuery);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading) return null;
    return collection(firestore, 'users');
  }, [firestore, isUserLoading]);

  const { data: usersData } = useCollectionOnce<any>(usersQuery);

  // VALIDACIÓN DE INTEGRIDAD: Solo mostramos conexiones de usuarios que existen realmente
  const validatedPresence = useMemo(() => {
    if (!presenceData || !usersData) return presenceData || [];
    const existingUserIds = new Set(usersData.map((u: any) => u.id));
    return presenceData.filter(p => existingUserIds.has(p.usuario_id));
  }, [presenceData, usersData]);

  const orphansCount = useMemo(() => {
    if (!presenceData || !usersData) return 0;
    const existingUserIds = new Set(usersData.map((u: any) => u.id));
    return presenceData.filter(p => !existingUserIds.has(p.usuario_id)).length;
  }, [presenceData, usersData]);

  const groupedData = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const filtered = validatedPresence.filter(p => 
      p.username.toLowerCase().includes(term) || 
      p.email.toLowerCase().includes(term) ||
      p.departamento?.toLowerCase().includes(term) ||
      p.distrito?.toLowerCase().includes(term)
    );

    const depts: Record<string, Record<string, PresenceRecord[]>> = {};

    filtered.forEach(p => {
      const dpt = p.departamento || 'ALCANCE NACIONAL';
      const dst = p.distrito || 'TODOS LOS DISTRITOS';
      if (!depts[dpt]) depts[dpt] = {};
      if (!depts[dpt][dst]) depts[dpt][dst] = [];
      depts[dpt][dst].push(p);
    });

    return Object.entries(depts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, dists]) => {
        const districtGroups = Object.entries(dists)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([dName, items]) => {
            const hasOnlineUser = items.some(p => {
                const last = p.ultima_actividad?.toMillis?.() || 0;
                return Math.abs(now - last) < ONLINE_THRESHOLD_MS;
            });

            return {
                name: dName,
                items: items.sort((a, b) => {
                    const timeA = a.ultima_actividad?.toMillis?.() || 0;
                    const timeB = b.ultima_actividad?.toMillis?.() || 0;
                    return timeB - timeA;
                }),
                hasOnline: hasOnlineUser
            };
          });

        const hasOnlineInDept = districtGroups.some(dg => dg.hasOnline);

        return {
            name,
            districts: districtGroups,
            hasOnline: hasOnlineInDept
        };
      });
  }, [validatedPresence, searchTerm, now]);

  const activeCount = useMemo(() => {
    return validatedPresence.filter(p => {
      const last = p.ultima_actividad?.toMillis?.() || 0;
      return Math.abs(now - last) < ONLINE_THRESHOLD_MS;
    }).length;
  }, [validatedPresence, now]);

  const handlePurgeOrphans = async () => {
    if (!firestore || !presenceData || !usersData) return;
    setIsPurging(true);
    const existingUserIds = new Set(usersData.map((u: any) => u.id));
    const orphans = presenceData.filter(p => !existingUserIds.has(p.usuario_id));
    
    if (orphans.length === 0) {
        toast({ title: "Sistema Limpio", description: "No se detectaron registros huérfanos." });
        setIsPurging(false);
        return;
    }

    const batch = writeBatch(firestore);
    orphans.forEach(o => {
        batch.delete(doc(firestore, 'presencia', o.id));
    });

    try {
        await batch.commit();
        toast({ title: "Depuración Exitosa", description: `Se han eliminado ${orphans.length} registros de usuarios inexistentes.` });
    } catch (e) {
        toast({ variant: 'destructive', title: "Error", description: "No se pudo realizar la limpieza." });
    } finally {
        setIsPurging(false);
    }
  };

  const handleDeleteUserRecord = async (record: PresenceRecord) => {
    if (!firestore || !currentUser) return;
    
    setIsDeleting(record.usuario_id);
    const batch = writeBatch(firestore);
    
    batch.delete(doc(firestore, 'users', record.usuario_id));
    batch.delete(doc(firestore, 'presencia', record.usuario_id));

    try {
        await batch.commit();
        
        recordAuditLog(firestore, {
            usuario_id: currentUser.uid,
            usuario_nombre: currentUser.profile?.username || currentUser.email || 'Admin',
            usuario_rol: 'admin',
            accion: 'BORRAR',
            modulo: 'seguridad',
            detalles: `Eliminación administrativa de usuario y rastro: ${record.email}`
        });

        toast({ 
            title: "Usuario Eliminado", 
            description: "Se ha revocado el acceso y limpiado el rastro de conexión." 
        });
    } catch (e) {
        toast({ variant: 'destructive', title: "Error", description: "No se pudo completar la operación." });
    } finally {
        setIsDeleting(null);
    }
  };

  if (isUserLoading || isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
  }

  const isAdmin = currentUser?.profile?.role === 'admin' || currentUser?.profile?.role === 'director';

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col bg-muted/10">
        <Header title="Acceso Restringido" />
        <main className="flex-1 p-8 flex items-center justify-center">
          <Card className="max-w-md w-full text-center p-8 border-dashed">
            <ShieldCheck className="h-16 w-16 mx-auto text-muted-foreground opacity-20 mb-4" />
            <h2 className="text-xl font-black uppercase text-primary mb-2">Módulo de Auditoría</h2>
            <p className="text-xs text-muted-foreground font-bold uppercase">Este panel es exclusivo para la Dirección y Administración Nacional.</p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Monitoreo de Conexiones" />
      
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-end gap-6">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-primary uppercase leading-none">Control de Presencia</h1>
                <p className="text-muted-foreground text-[10px] font-bold uppercase flex items-center gap-2 mt-2 tracking-widest">
                    <Activity className="h-3.5 w-3.5" /> Monitoreo geográfico sincronizado con el Directorio
                </p>
            </div>
            <div className="flex flex-col md:flex-row items-end gap-4 w-full md:w-auto">
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                    <Input 
                        placeholder="Filtrar por nombre, email o zona..." 
                        className="h-12 pl-10 font-bold border-2 rounded-2xl bg-white shadow-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-4">
                    <Card className="bg-white border-2 border-primary/10 px-6 py-4 shadow-sm flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                            <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                        </div>
                        <div>
                            <div className="text-[10px] font-black uppercase text-muted-foreground leading-none mb-1">En Línea</div>
                            <div className="text-2xl font-black">{activeCount}</div>
                        </div>
                    </Card>
                    <Card className="bg-black text-white px-6 py-4 shadow-xl border-none">
                        <div className="text-[10px] font-black uppercase opacity-70 tracking-widest leading-none mb-1">Total Registrados</div>
                        <div className="text-2xl font-black">{validatedPresence.length}</div>
                    </Card>
                </div>
            </div>
        </div>

        {orphansCount > 0 && (
            <div className="p-6 bg-amber-50 border-2 border-dashed border-amber-200 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-4">
                    <AlertTriangle className="h-10 w-10 text-amber-600" />
                    <div>
                        <p className="font-black uppercase text-sm text-amber-800">Inconsistencia de Datos Detectada</p>
                        <p className="text-[10px] font-bold uppercase text-amber-700">Se han encontrado {orphansCount} registros de conexión que pertenecen a usuarios ya eliminados del sistema.</p>
                    </div>
                </div>
                <Button 
                    onClick={handlePurgeOrphans} 
                    disabled={isPurging}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-black uppercase text-[10px] h-11 px-8 rounded-xl gap-2 shadow-lg"
                >
                    {isPurging ? <Loader2 className="animate-spin h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                    DEPURAR REGISTROS HUÉRFANOS
                </Button>
            </div>
        )}

        {groupedData.length === 0 ? (
            <Card className="p-20 text-center border-dashed bg-white rounded-[2.5rem]">
                <div className="flex flex-col items-center justify-center opacity-20">
                    <UserCheck className="h-20 w-20 mb-4" />
                    <p className="font-black uppercase tracking-widest text-sm">No se encontraron usuarios conectados</p>
                </div>
            </Card>
        ) : (
            <Accordion type="multiple" className="space-y-6">
                {groupedData.map((dept) => (
                    <AccordionItem key={dept.name} value={dept.name} className="border-none bg-white rounded-[2rem] shadow-sm overflow-hidden">
                        <AccordionTrigger className="hover:no-underline px-8 py-6 bg-white group">
                            <div className="flex items-center gap-4 text-left">
                                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner relative">
                                    <Landmark className="h-6 w-6" />
                                    {dept.hasOnline && (
                                        <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-white flex items-center justify-center shadow-sm">
                                            <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black uppercase tracking-tight text-[#1A1A1A]">{dept.name}</h2>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                        {dept.districts.length} DISTRITOS CON ACTIVIDAD
                                    </p>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-8 pb-8 pt-2">
                            <Accordion type="multiple" className="space-y-4">
                                {dept.districts.map((dist) => (
                                    <AccordionItem key={dist.name} value={dist.name} className="border-none">
                                        <AccordionTrigger className="hover:no-underline py-4 bg-[#F8F9FA] rounded-2xl px-6 group border border-dashed">
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <Building2 className="h-5 w-5 text-muted-foreground" />
                                                    {dist.hasOnline && (
                                                        <div className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.6)] animate-pulse" />
                                                    )}
                                                </div>
                                                <h3 className="font-black uppercase text-sm tracking-tight text-foreground/80">
                                                    {dist.name}
                                                </h3>
                                                <Badge variant="secondary" className="bg-black text-white text-[8px] font-black px-2">
                                                    {dist.items.length} USUARIOS
                                                </Badge>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-6 px-2">
                                            <div className="overflow-x-auto border-2 rounded-2xl">
                                                <Table>
                                                    <TableHeader className="bg-muted/30">
                                                        <TableRow>
                                                            <TableHead className="text-[9px] font-black uppercase px-8">Estado</TableHead>
                                                            <TableHead className="text-[9px] font-black uppercase">Funcionario / Registro</TableHead>
                                                            <TableHead className="text-[9px] font-black uppercase">Última Actividad</TableHead>
                                                            <TableHead className="text-[9px] font-black uppercase">Sección Actual</TableHead>
                                                            <TableHead className="text-right text-[9px] font-black uppercase px-8">Acción</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {dist.items.map((record) => {
                                                            const lastMillis = record.ultima_actividad?.toMillis?.() || 0;
                                                            const isOnline = Math.abs(now - lastMillis) < ONLINE_THRESHOLD_MS;
                                                            
                                                            return (
                                                                <TableRow key={record.id} className="hover:bg-muted/20 transition-colors border-b last:border-0">
                                                                    <TableCell className="px-8 py-6">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className={cn(
                                                                                "h-2.5 w-2.5 rounded-full transition-all",
                                                                                isOnline ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" : "bg-muted-foreground/30"
                                                                            )} />
                                                                            <span className={cn(
                                                                                "text-[10px] font-black uppercase",
                                                                                isOnline ? "text-green-600" : "text-muted-foreground"
                                                                            )}>
                                                                                {isOnline ? "En Línea" : "Offline"}
                                                                            </span>
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center font-black text-xs text-primary border border-primary/10">
                                                                                {record.username.substring(0, 2).toUpperCase()}
                                                                            </div>
                                                                            <div>
                                                                                <p className="font-black text-xs uppercase text-primary leading-tight">{record.username}</p>
                                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                                    <Mail className="h-2.5 w-2.5 text-muted-foreground opacity-40" />
                                                                                    <span className="text-[9px] font-bold text-muted-foreground lowercase">{record.email}</span>
                                                                                </div>
                                                                                <Badge variant="outline" className="mt-1 bg-muted/20 text-[7px] font-black uppercase border-primary/10 h-4 px-1.5">
                                                                                    ROL: {record.role}
                                                                                </Badge>
                                                                            </div>
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div className="flex items-center gap-2">
                                                                            <Clock className="h-3.5 w-3.5 text-muted-foreground opacity-40" />
                                                                            <span className="text-[10px] font-black text-[#1A1A1A]">
                                                                                {record.ultima_actividad ? (
                                                                                    format(record.ultima_actividad.toDate(), "dd/MM/yyyy HH:mm:ss", { locale: es })
                                                                                ) : "SIN REGISTRO"}
                                                                            </span>
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div className="flex items-center gap-2">
                                                                            <MonitorPlay className="h-3.5 w-3.5 text-primary/40" />
                                                                            <Badge variant="secondary" className="bg-primary/5 text-primary border-none text-[8px] font-black uppercase px-3 py-1">
                                                                                {record.ruta_actual === '/' ? 'INICIO' : record.ruta_actual.replace('/', '').toUpperCase()}
                                                                            </Badge>
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="text-right px-8">
                                                                        <AlertDialog>
                                                                            <AlertDialogTrigger asChild>
                                                                                <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive/40 hover:text-destructive hover:bg-destructive/5 rounded-full" disabled={isDeleting === record.usuario_id}>
                                                                                    {isDeleting === record.usuario_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-5 w-5" />}
                                                                                </Button>
                                                                            </AlertDialogTrigger>
                                                                            <AlertDialogContent className="rounded-3xl border-none shadow-2xl p-8">
                                                                                <AlertDialogHeader className="space-y-4">
                                                                                    <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto border-4 border-destructive/20">
                                                                                        <ShieldAlert className="h-8 w-8 text-destructive" />
                                                                                    </div>
                                                                                    <AlertDialogTitle className="font-black uppercase tracking-tight text-center text-xl">¿ELIMINAR ACCESO DE USUARIO?</AlertDialogTitle>
                                                                                    <AlertDialogDescription className="text-xs font-bold uppercase leading-relaxed text-muted-foreground text-center">
                                                                                        Esta acción es definitiva. Se borrará el perfil de <span className="text-primary font-black">{record.username}</span> y se le revocará todo permiso de acceso al sistema de forma inmediata.
                                                                                    </AlertDialogDescription>
                                                                                </AlertDialogHeader>
                                                                                <AlertDialogFooter className="mt-8 sm:justify-center gap-4">
                                                                                    <AlertDialogCancel className="h-12 rounded-xl font-black uppercase text-[10px] px-8 border-2">CANCELAR</AlertDialogCancel>
                                                                                    <AlertDialogAction onClick={() => handleDeleteUserRecord(record)} className="h-12 bg-destructive hover:bg-destructive/90 text-white rounded-xl font-black uppercase text-[10px] px-8 shadow-xl">
                                                                                        SÍ, ELIMINAR ACCESO
                                                                                    </AlertDialogAction>
                                                                                </AlertDialogFooter>
                                                                            </AlertDialogContent>
                                                                        </AlertDialog>
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        )}

        <div className="text-center pb-12 pt-8">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40 italic leading-relaxed">
                * Monitor de seguridad institucional. Los administradores pueden revocar accesos en tiempo real.
            </p>
        </div>
      </main>
    </div>
  );
}
