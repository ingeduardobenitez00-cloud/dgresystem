"use client";

import { useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { type SolicitudCapacitacion, type MovimientoMaquina, type InformeDivulgador } from '@/lib/data';
import { Loader2, History, Archive, Search, CheckCircle2, Calendar, MapPin, BadgeCheck, XCircle, FileX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDateToDDMMYYYY, cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

export default function ArchivoCapacitacionesPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const [search, setSearch] = useState('');

  const profile = user?.profile;

  // Carga de todas las solicitudes para filtrar las archivadas
  const solicitudesQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !profile) return null;
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    const hasAdminFilter = ['admin', 'director'].includes(profile.role || '') || profile.permissions?.includes('admin_filter');
    const hasDeptFilter = !hasAdminFilter && profile.permissions?.includes('department_filter');
    const hasDistFilter = !hasAdminFilter && !hasDeptFilter && (profile.permissions?.includes('district_filter') || profile.role === 'jefe' || profile.role === 'funcionario');

    if (hasAdminFilter) return colRef;
    if (hasDeptFilter && profile.departamento) return query(colRef, where('departamento', '==', profile.departamento));
    if (hasDistFilter && profile.departamento && profile.distrito) {
        return query(colRef, where('departamento', '==', profile.departamento), where('distrito', '==', profile.distrito));
    }
    return null;
  }, [firestore, isUserLoading, profile]);

  const { data: rawSolicitudes, isLoading: isLoadingSolicitudes } = useCollection<SolicitudCapacitacion>(solicitudesQuery);

  // Carga de movimientos para verificar devolución
  const movimientosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'movimientos-maquinas') : null, [firestore]);
  const { data: movimientosData } = useCollection<MovimientoMaquina>(movimientosQuery);

  // Carga de informes para verificar cierre de ciclo
  const informesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'informes-divulgador') : null, [firestore]);
  const { data: informesData } = useCollection<InformeDivulgador>(informesQuery);

  const archivedActivities = useMemo(() => {
    if (!rawSolicitudes) return [];
    
    const today = new Date().toISOString().split('T')[0];
    
    return rawSolicitudes.filter(sol => {
        // CRITERIO 1: CANCELADA (Se archiva inmediatamente)
        if (sol.cancelada) return true;

        const movimiento = movimientosData?.find(m => m.solicitud_id === sol.id);
        const informe = informesData?.find(inf => inf.solicitud_id === sol.id);
        
        // CRITERIO 2: Movimiento devuelto Y Informe cargado Y Fecha pasada
        const isFinished = movimiento?.devolucion && informe;
        const isPast = sol.fecha < today;
        
        return isFinished && isPast;
    }).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [rawSolicitudes, movimientosData, informesData]);

  const filteredArchived = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return archivedActivities;
    return archivedActivities.filter(a => 
        a.lugar_local.toLowerCase().includes(term) || 
        a.solicitante_entidad.toLowerCase().includes(term) ||
        a.nombre_completo.toLowerCase().includes(term)
    );
  }, [archivedActivities, search]);

  if (isUserLoading || isLoadingSolicitudes) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Archivo Institucional" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-primary uppercase leading-none">Historial / Archivo</h1>
                <p className="text-muted-foreground text-[10px] font-bold uppercase flex items-center gap-2 mt-2 tracking-widest">
                    <History className="h-3.5 w-3.5" /> Actividades finalizadas y ciclo logístico cerrado
                </p>
            </div>
            <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                <Input 
                    placeholder="Buscar en archivo..." 
                    className="h-12 pl-10 font-bold border-2 rounded-2xl bg-white shadow-sm"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>
        </div>

        <Card className="shadow-2xl border-none overflow-hidden rounded-[2rem] bg-white">
            <CardHeader className="bg-black text-white p-6">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3">
                    <Archive className="h-4 w-4" /> REGISTRO DE ACTIVIDADES ARCHIVADAS ({filteredArchived.length})
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                {filteredArchived.length === 0 ? (
                    <div className="py-32 flex flex-col items-center justify-center opacity-20">
                        <Archive className="h-20 w-20 mb-4" />
                        <p className="font-black uppercase tracking-widest text-sm">No hay registros en el archivo</p>
                    </div>
                ) : (
                    <div className="overflow-auto">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest px-8">Fecha / Local</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Solicitante</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Divulgador</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Estado Final</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest px-8">Resultado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredArchived.map(item => {
                                    const informe = informesData?.find(inf => inf.solicitud_id === item.id);
                                    const isCancelled = item.cancelada;

                                    return (
                                        <TableRow key={item.id} className={cn("hover:bg-muted/30 transition-colors border-b", isCancelled && "bg-destructive/[0.02]")}>
                                            <TableCell className="py-6 px-8">
                                                <div className="space-y-1">
                                                    <p className={cn("font-black text-xs flex items-center gap-2", isCancelled ? "text-destructive" : "text-primary")}>
                                                        <Calendar className="h-3 w-3 opacity-40" /> {formatDateToDDMMYYYY(item.fecha)}
                                                    </p>
                                                    <p className="font-black text-[11px] uppercase flex items-center gap-2">
                                                        <MapPin className="h-3 w-3 opacity-40" /> {item.lugar_local}
                                                    </p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <p className="font-black text-[10px] uppercase leading-tight text-muted-foreground">{item.solicitante_entidad || item.otra_entidad}</p>
                                                <Badge variant="outline" className="mt-1 text-[8px] font-black uppercase border-primary/10">
                                                    {item.tipo_solicitud}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <p className="font-black text-[10px] uppercase">{item.divulgador_nombre || '---'}</p>
                                                <p className="text-[9px] font-bold text-muted-foreground uppercase">{item.divulgador_vinculo}</p>
                                            </TableCell>
                                            <TableCell>
                                                {isCancelled ? (
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center gap-2 text-destructive">
                                                            <XCircle className="h-3.5 w-3.5" />
                                                            <span className="text-[9px] font-black uppercase">ACTIVIDAD ANULADA</span>
                                                        </div>
                                                        <div className="max-w-[200px] bg-destructive/10 p-2 rounded-lg border border-destructive/20">
                                                            <p className="text-[8px] font-black uppercase text-destructive opacity-70 mb-1 flex items-center gap-1"><FileX className="h-2 w-2"/> Motivo:</p>
                                                            <p className="text-[9px] font-bold uppercase leading-tight italic">{item.motivo_cancelacion}</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-2">
                                                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                                                            <span className="text-[9px] font-black uppercase text-green-600">EQUIPO DEVUELTO</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                                                            <span className="text-[9px] font-black uppercase text-green-600">INFORME CERRADO</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right px-8">
                                                <div className="flex flex-col items-end">
                                                    <p className={cn("font-black text-xl leading-none", isCancelled ? "text-muted-foreground opacity-30" : "text-primary")}>
                                                        {isCancelled ? '---' : (informe?.total_personas || 0)}
                                                    </p>
                                                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                                                        {isCancelled ? 'SIN EJECUCIÓN' : 'Capacitados'}
                                                    </p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>

        <div className="text-center pb-10">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40 italic">
                * Los registros se archivan automáticamente una vez finalizado el ciclo logístico o por anulación justificada.
            </p>
        </div>
      </main>
    </div>
  );
}
