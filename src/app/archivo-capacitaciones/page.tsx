
"use client";

import { useMemo, useState } from 'react';
import Header from '@/components/header';
import { Card, CardContent } from '@/components/ui/card';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { type SolicitudCapacitacion, type MovimientoMaquina, type InformeDivulgador } from '@/lib/data';
import { 
    Loader2, 
    History, 
    Archive, 
    Search, 
    CheckCircle2, 
    Calendar, 
    MapPin, 
    XCircle, 
    FileX, 
    Landmark, 
    Building2 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDateToDDMMYYYY, cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

export default function ArchivoCapacitacionesPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const [search, setSearch] = useState('');

  const profile = user?.profile;

  // Carga de solicitudes filtradas por jurisdicción
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

  const movimientosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'movimientos-maquinas') : null, [firestore]);
  const { data: movimientosData } = useCollection<MovimientoMaquina>(movimientosQuery);

  const informesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'informes-divulgador') : null, [firestore]);
  const { data: informesData } = useCollection<InformeDivulgador>(informesQuery);

  // Filtrado y Agrupación Jerárquica
  const groupedData = useMemo(() => {
    if (!rawSolicitudes) return [];
    
    const term = search.toLowerCase().trim();
    
    const archived = rawSolicitudes.filter(sol => {
        const isCancelled = sol.cancelada;
        const mov = movimientosData?.find(m => m.solicitud_id === sol.id);
        const inf = informesData?.find(i => i.solicitud_id === sol.id);
        
        // El registro se considera "archivado" si está cancelado o si el ciclo logístico está cerrado
        const isFinished = mov?.fecha_devolucion && inf;
        const matchesSearch = sol.lugar_local.toLowerCase().includes(term) || 
                             sol.solicitante_entidad.toLowerCase().includes(term) ||
                             sol.divulgador_nombre?.toLowerCase().includes(term);

        return (isCancelled || isFinished) && matchesSearch;
    }).sort((a, b) => b.fecha.localeCompare(a.fecha));

    const depts: Record<string, Record<string, SolicitudCapacitacion[]>> = {};

    archived.forEach(sol => {
      const dpt = sol.departamento || 'SIN DEPARTAMENTO';
      const dst = sol.distrito || 'SIN DISTRITO';
      if (!depts[dpt]) depts[dpt] = {};
      if (!depts[dpt][dst]) depts[dpt][dst] = [];
      depts[dpt][dst].push(sol);
    });

    return Object.entries(depts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, dists]) => ({
        name,
        districts: Object.entries(dists)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([dName, items]) => ({
            name: dName,
            items
          }))
      }));
  }, [rawSolicitudes, movimientosData, informesData, search]);

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
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        {groupedData.length === 0 ? (
            <Card className="p-20 text-center border-dashed bg-white rounded-[2.5rem]">
                <div className="flex flex-col items-center justify-center opacity-20">
                    <Archive className="h-20 w-20 mb-4" />
                    <p className="font-black uppercase tracking-widest text-sm">No hay registros archivados</p>
                </div>
            </Card>
        ) : (
            <Accordion type="multiple" className="space-y-6">
                {groupedData.map((dept) => (
                    <AccordionItem key={dept.name} value={dept.name} className="border-none bg-white rounded-[2rem] shadow-sm overflow-hidden">
                        <AccordionTrigger className="hover:no-underline px-8 py-6 bg-white group">
                            <div className="flex items-center gap-4 text-left">
                                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                    <Landmark className="h-6 w-6" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black uppercase tracking-tight text-[#1A1A1A]">{dept.name}</h2>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                        {dept.districts.length} DISTRITOS CON HISTORIAL
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
                                                <Building2 className="h-5 w-5 text-muted-foreground" />
                                                <h3 className="font-black uppercase text-sm tracking-tight text-foreground/80">
                                                    {dist.name}
                                                </h3>
                                                <Badge variant="secondary" className="bg-black text-white text-[8px] font-black px-2">
                                                    {dist.items.length} REGISTROS
                                                </Badge>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-6 px-2">
                                            <Card className="border-none shadow-xl overflow-hidden rounded-[1.5rem]">
                                                <div className="bg-black text-white px-8 py-4 flex items-center gap-3">
                                                    <Archive className="h-4 w-4 opacity-50" />
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">REGISTRO DE ACTIVIDADES ARCHIVADAS</span>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full border-collapse">
                                                        <thead>
                                                            <tr className="bg-muted/50 border-b">
                                                                <th className="text-[9px] font-black uppercase tracking-widest px-8 py-4 text-left">FECHA / LOCAL</th>
                                                                <th className="text-[9px] font-black uppercase tracking-widest px-4 py-4 text-left">SOLICITANTE</th>
                                                                <th className="text-[9px] font-black uppercase tracking-widest px-4 py-4 text-left">DIVULGADOR</th>
                                                                <th className="text-[9px] font-black uppercase tracking-widest px-4 py-4 text-left">ESTADO FINAL</th>
                                                                <th className="text-[9px] font-black uppercase tracking-widest px-8 py-4 text-right">RESULTADO</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {dist.items.map(item => {
                                                                const informe = informesData?.find(inf => inf.solicitud_id === item.id);
                                                                const isCancelled = item.cancelada;

                                                                return (
                                                                    <tr key={item.id} className={cn("border-b hover:bg-muted/20 transition-colors", isCancelled && "bg-destructive/[0.02]")}>
                                                                        <td className="px-8 py-6">
                                                                            <div className="space-y-1.5">
                                                                                <div className="flex items-center gap-2">
                                                                                    <Calendar className="h-3 w-3 text-muted-foreground" />
                                                                                    <span className={cn("font-black text-xs", isCancelled ? "text-destructive" : "text-primary")}>
                                                                                        {formatDateToDDMMYYYY(item.fecha)}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="flex items-center gap-2">
                                                                                    <MapPin className="h-3 w-3 text-muted-foreground" />
                                                                                    <span className="font-black text-[11px] uppercase">{item.lugar_local}</span>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-4 py-6">
                                                                            <p className="font-black text-[10px] uppercase leading-tight text-muted-foreground mb-2">{item.solicitante_entidad || item.otra_entidad}</p>
                                                                            <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/10 px-3 py-0.5 rounded-full">
                                                                                {item.tipo_solicitud}
                                                                            </Badge>
                                                                        </td>
                                                                        <td className="px-4 py-6">
                                                                            <p className="font-black text-[10px] uppercase text-primary">{item.divulgador_nombre || '---'}</p>
                                                                            <p className="text-[9px] font-bold text-muted-foreground uppercase">{item.divulgador_vinculo}</p>
                                                                        </td>
                                                                        <td className="px-4 py-6">
                                                                            {isCancelled ? (
                                                                                <div className="space-y-1.5">
                                                                                    <div className="flex items-center gap-2 text-destructive">
                                                                                        <XCircle className="h-3.5 w-3.5" />
                                                                                        <span className="text-[9px] font-black uppercase">ACTIVIDAD ANULADA</span>
                                                                                    </div>
                                                                                    <div className="max-w-[180px] bg-destructive/10 p-2 rounded-lg border border-destructive/20">
                                                                                        <p className="text-[8px] font-bold uppercase leading-tight italic line-clamp-2">{item.motivo_cancelacion}</p>
                                                                                    </div>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="space-y-1.5">
                                                                                    <div className="flex items-center gap-2 text-green-600">
                                                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                                                        <span className="text-[9px] font-black uppercase">EQUIPO DEVUELTO</span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2 text-green-600">
                                                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                                                        <span className="text-[9px] font-black uppercase">INFORME CERRADO</span>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-8 py-6 text-right">
                                                                            <div className="flex flex-col items-end">
                                                                                <span className={cn("text-2xl font-black leading-none", isCancelled ? "text-muted-foreground/30" : "text-primary")}>
                                                                                    {isCancelled ? '---' : (informe?.total_personas || 0)}
                                                                                </span>
                                                                                <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                                                                                    {isCancelled ? 'SIN EJECUCIÓN' : 'CAPACITADOS'}
                                                                                </span>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </Card>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        )}

        <div className="text-center pb-10">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40 italic">
                * Los registros se archivan automáticamente una vez finalizado el ciclo logístico o por anulación justificada.
            </p>
        </div>
      </main>
    </div>
  );
}
