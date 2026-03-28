"use client";

import { useMemo, useState, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { Loader2, Activity, Globe, Clock, UserCheck, ShieldCheck, MapPin, Trash2, Search, Mail, UserPlus, ShieldAlert } from 'lucide-react';
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

/**
 * AJUSTE DE TOLERANCIA HORARIA:
 * Se amplía a 75 minutos (1h 15m) para compensar desfases de zona horaria (Paraguay UTC-4 vs Server).
 */
const ONLINE_THRESHOLD_MS = 4500000;

export default function ConexionesPage() {
  const { user: currentUser, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [now, setNow] = useState(Date.now());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const presenceQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading) return null;
    return collection(firestore, 'presencia');
  }, [firestore, isUserLoading]);

  const { data: presenceData, isLoading } = useCollection<PresenceRecord>(presenceQuery);

  const filteredRecords = useMemo(() => {
    if (!presenceData) return [];
    const term = searchTerm.toLowerCase().trim();
    
    return presenceData
      .filter(p => 
        p.username.toLowerCase().includes(term) || 
        p.email.toLowerCase().includes(term)
      )
      .sort((a, b) => {
        const timeA = a.ultima_actividad?.toMillis?.() || 0;
        const timeB = b.ultima_actividad?.toMillis?.() || 0;
        return timeB - timeA;
      });
  }, [presenceData, searchTerm]);

  const activeCount = useMemo(() => {
    if (!presenceData) return 0;
    return presenceData.filter(p => {
      const last = p.ultima_actividad?.toMillis?.() || 0;
      return Math.abs(now - last) < ONLINE_THRESHOLD_MS;
    }).length;
  }, [presenceData, now]);

  const handleDeletePresence = (id: string) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'presencia', id);
    deleteDoc(docRef)
        .then(() => {
            toast({ title: "Registro removido", description: "La entrada de conexión ha sido borrada manualmente." });
        })
        .catch(() => {
            toast({ variant: 'destructive', title: "Error", description: "No se pudo eliminar el registro." });
        });
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
                    <Activity className="h-3.5 w-3.5" /> Monitoreo de actividad de usuarios en tiempo real
                </p>
            </div>
            <div className="flex flex-col md:flex-row items-end gap-4 w-full md:w-auto">
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                    <Input 
                        placeholder="Buscar por email o nombre..." 
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
                        <div className="text-2xl font-black">{presenceData?.length || 0}</div>
                    </Card>
                </div>
            </div>
        </div>

        <Card className="shadow-2xl border-none overflow-hidden rounded-[2rem] bg-white">
            <CardHeader className="bg-muted/5 border-b p-8">
                <CardTitle className="uppercase font-black text-sm tracking-widest flex items-center gap-3">
                    <UserCheck className="h-5 w-5 text-primary" /> LISTADO DE ACTIVIDAD RECIENTE
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow>
                                <TableHead className="text-[9px] font-black uppercase tracking-widest px-8">Estado</TableHead>
                                <TableHead className="text-[9px] font-black uppercase tracking-widest">Funcionario / Registro</TableHead>
                                <TableHead className="text-[9px] font-black uppercase tracking-widest">Origen Registro</TableHead>
                                <TableHead className="text-[9px] font-black uppercase tracking-widest">Jurisdicción</TableHead>
                                <TableHead className="text-[9px] font-black uppercase tracking-widest">Última Actividad</TableHead>
                                <TableHead className="text-[9px] font-black uppercase tracking-widest">Sección Actual</TableHead>
                                <TableHead className="text-right text-[9px] font-black uppercase tracking-widest px-8">Acción</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRecords.map((record) => {
                                const lastMillis = record.ultima_actividad?.toMillis?.() || 0;
                                const isOnline = Math.abs(now - lastMillis) < ONLINE_THRESHOLD_MS;
                                
                                return (
                                    <TableRow key={record.id} className="hover:bg-muted/20 transition-colors border-b">
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
                                                    {isOnline ? "Online" : "Offline"}
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
                                            {record.registration_method === 'auto_registro_jefe' ? (
                                                <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[8px] font-black uppercase gap-1.5 py-1 px-3">
                                                    <UserPlus className="h-3 w-3" /> AUTO-REGISTRO (JEFE)
                                                </Badge>
                                            ) : record.registration_method === 'creado_por_admin' ? (
                                                <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[8px] font-black uppercase gap-1.5 py-1 px-3">
                                                    <ShieldCheck className="h-3 w-3" /> CREADO POR ADMIN
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-muted-foreground/40 border-muted text-[8px] font-black uppercase py-1 px-3">
                                                    NO ESPECIFICADO
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <MapPin className="h-3 w-3 opacity-30" />
                                                <div>
                                                    <p className="text-[10px] font-black uppercase leading-tight">{record.departamento}</p>
                                                    <p className="text-[9px] font-bold text-muted-foreground uppercase">{record.distrito}</p>
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
                                            <Badge variant="secondary" className="bg-primary/5 text-primary border-none text-[8px] font-black uppercase px-3 py-1">
                                                {record.ruta_actual === '/' ? 'INICIO' : record.ruta_actual.replace('/', '').toUpperCase()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right px-8">
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/40 hover:text-destructive hover:bg-destructive/5 rounded-full">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle className="font-black uppercase tracking-tight">¿REMOVER REGISTRO?</AlertDialogTitle>
                                                        <AlertDialogDescription className="text-xs font-bold uppercase leading-relaxed text-muted-foreground">
                                                            Esta acción borrará la entrada de conexión de <span className="text-primary">{record.username}</span> del monitor. El registro se volverá a crear automáticamente si el usuario vuelve a navegar en el sistema.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter className="mt-6">
                                                        <AlertDialogCancel className="rounded-xl font-black uppercase text-[10px]">CANCELAR</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeletePresence(record.id)} className="bg-destructive hover:bg-destructive/90 text-white rounded-xl font-black uppercase text-[10px] px-8">
                                                            ELIMINAR ENTRADA
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
            </CardContent>
        </Card>
      </main>
    </div>
  );
}
