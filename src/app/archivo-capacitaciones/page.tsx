
"use client";

import { useMemo, useState } from 'react';
import Header from '@/components/header';
import { Card, CardContent } from '@/components/ui/card';
import { useUser, useFirebase, useCollectionOnce, useMemoFirebase } from '@/firebase';
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
    Building2,
    ShieldAlert,
    Users,
    UserCheck,
    FileWarning,
    ChevronDown,
    Building,
    FileText,
    Eye
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDateToDDMMYYYY, cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useCollectionPaginated } from '@/firebase';
import { orderBy, limit } from 'firebase/firestore';

function ActivityRow({ item }: { item: SolicitudCapacitacion }) {
    const { firestore } = useFirebase();
    
    // Carga perezosa de datos vinculados
    const movQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'movimientos-maquinas'), where('solicitud_id', '==', item.id), limit(1)) : null
    , [firestore, item.id]);
    const { data: movs } = useCollectionOnce<MovimientoMaquina>(movQuery);
    const mov = movs?.[0];

    const infQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'informes-divulgador'), where('solicitud_id', '==', item.id)) : null
    , [firestore, item.id]);
    const { data: reports } = useCollectionOnce<InformeDivulgador>(infQuery);

    const denQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'denuncias-lacres'), where('solicitud_id', '==', item.id), limit(1)) : null
    , [firestore, item.id]);
    const { data: dens } = useCollectionOnce<any>(denQuery);
    const denuncia = dens?.[0];

    const isCancelled = item.cancelada;
    const hasReport = (reports || []).length > 0;
    const isFinished = mov?.fecha_devolucion && hasReport;
    const totalCapacitados = reports?.reduce((acc, r) => acc + (r.total_personas || 0), 0) || 0;

    return (
        <tr className={cn("border-b hover:bg-muted/10 transition-colors", isCancelled && "bg-destructive/[0.01]")}>
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
                        <span className="font-black text-[11px] uppercase truncate max-w-[200px] inline-block">{item.lugar_local}</span>
                    </div>
                </div>
            </td>
            <td className="px-4 py-6">
                <p className="font-black text-[10px] uppercase leading-tight text-muted-foreground mb-2 truncate max-w-[150px]">{item.solicitante_entidad || item.otra_entidad}</p>
                <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/10 px-3 py-0.5 rounded-full whitespace-nowrap">
                    {item.tipo_solicitud}
                </Badge>
            </td>
            <td className="px-4 py-6">
                <div className="space-y-2">
                    {(item.divulgadores || item.asignados || []).slice(0, 2).map((div: any) => {
                        const report = reports?.find(r => r.divulgador_id === div.id);
                        return (
                            <div key={div.id} className="flex items-center justify-between gap-4 border-b border-dashed border-muted pb-1 last:border-0 min-w-[120px]">
                                <div>
                                    <p className="font-black text-[9px] uppercase text-primary leading-none truncate max-w-[80px]">{div.nombre}</p>
                                    <p className="text-[7px] font-bold text-muted-foreground uppercase">C.I. {div.cedula}</p>
                                </div>
                                <Badge variant="secondary" className="bg-primary/5 text-primary text-[8px] font-black h-4 min-w-[20px] justify-center px-1">
                                    {report ? report.total_personas : '0'}
                                </Badge>
                            </div>
                        );
                    })}
                    {(item.divulgadores || item.asignados || []).length > 2 && (
                        <p className="text-[7px] font-black text-muted-foreground text-center">+{(item.divulgadores || item.asignados || []).length - 2} DIVULGADORES</p>
                    )}
                    {(item.divulgadores || item.asignados || []).length === 0 && (
                        <p className="text-[9px] font-bold text-muted-foreground italic">SIN PERSONAL</p>
                    )}
                </div>
            </td>
            <td className="px-4 py-6">
                {isCancelled ? (
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-destructive">
                            <XCircle className="h-3 w-3" />
                            <span className="text-[8px] font-black uppercase">ANULADA</span>
                        </div>
                        <p className="text-[7px] font-bold uppercase italic text-destructive/60 truncate max-w-[100px]">{item.motivo_cancelacion}</p>
                    </div>
                ) : isFinished ? (
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            <span className="text-[8px] font-black uppercase">COMPLETADO</span>
                        </div>
                        {denuncia ? (
                            <div className="bg-destructive/10 px-1.5 py-0.5 rounded flex items-center gap-1 text-destructive w-fit">
                                <FileWarning className="h-2.5 w-2.5" />
                                <span className="text-[7px] font-black uppercase">DENUNCIA</span>
                            </div>
                        ) : (
                            <div className="bg-green-50 px-1.5 py-0.5 rounded flex items-center gap-1 text-green-700 w-fit">
                                <ShieldAlert className="h-2.5 w-2.5 opacity-40" />
                                <span className="text-[7px] font-black uppercase">OK</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 text-amber-500">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="text-[8px] font-black uppercase">PROCESANDO</span>
                    </div>
                )}
            </td>
            <td className="px-8 py-6 text-right">
                <div className="flex flex-col items-end">
                    <span className={cn("text-xl font-black leading-none", isCancelled ? "text-muted-foreground/30" : "text-primary")}>
                        {isCancelled ? '---' : totalCapacitados}
                    </span>
                    <span className="text-[7px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                        {isCancelled ? 'SIN EJECUCION' : 'PERSONAS'}
                    </span>
                </div>
            </td>
        </tr>
    );
}

export default function ArchivoCapacitacionesPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const profile = user?.profile;

  // Carga de solicitudes segmentada por fecha y jurisdicción
  const solicitudesQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !profile) return null;
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    
    let constraints: any[] = [];
    
    // Filtros de Jurisdicción
    const hasAdminFilter = ['admin', 'director'].includes(profile.role || '') || profile.permissions?.includes('admin_filter');
    const hasDeptFilter = !hasAdminFilter && profile.permissions?.includes('department_filter');
    const hasDistFilter = !hasAdminFilter && !hasDeptFilter && (profile.permissions?.includes('district_filter') || profile.role === 'jefe' || profile.role === 'funcionario');

    if (hasDeptFilter && profile.departamento) {
        constraints.push(where('departamento', '==', profile.departamento));
    } else if (hasDistFilter && profile.departamento && profile.distrito) {
        constraints.push(where('departamento', '==', profile.departamento));
        constraints.push(where('distrito', '==', profile.distrito));
    }

    // Filtros de Tiempo
    if (selectedMonth !== 'all') {
        const monthPrefix = `${selectedYear}-${selectedMonth.padStart(2, '0')}`;
        constraints.push(where('fecha', '>=', monthPrefix));
        constraints.push(where('fecha', '<=', `${monthPrefix}-31`));
    } else {
        constraints.push(where('fecha', '>=', `${selectedYear}-01-01`));
        constraints.push(where('fecha', '<=', `${selectedYear}-12-31`));
    }

    constraints.push(orderBy('fecha', 'desc'));

    return query(colRef, ...constraints);
  }, [firestore, isUserLoading, profile, selectedYear, selectedMonth]);

  const { 
    data: allSolicitudes, 
    isLoading: isLoadingSolicitudes,
    hasMore,
    loadMore,
    isLoadingMore 
  } = useCollectionPaginated<SolicitudCapacitacion>(solicitudesQuery, 30);

  const groupedData = useMemo(() => {
    if (!allSolicitudes) return [];
    
    const term = searchTerm.toLowerCase().trim();
    
    const filtered = allSolicitudes.filter(sol => {
        const matchesSearch = !term || sol.lugar_local.toLowerCase().includes(term) || 
                             sol.solicitante_entidad.toLowerCase().includes(term);
        return matchesSearch;
    });

    const depts: Record<string, Record<string, SolicitudCapacitacion[]>> = {};

    filtered.forEach(sol => {
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
  }, [allSolicitudes, searchTerm]);

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
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-8">
            <div className="relative w-full md:max-w-md group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input 
                    placeholder="Buscar por local o entidad..." 
                    className="pl-12 h-14 bg-white border-none shadow-sm rounded-2xl font-bold text-xs uppercase focus-visible:ring-primary/20 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl shadow-sm border border-muted/20">
                    <Calendar className="h-4 w-4 text-primary" />
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-[100px] border-none shadow-none font-black text-[10px] uppercase h-8 focus:ring-0">
                            <SelectValue placeholder="Año" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-2xl">
                            <SelectItem value="2024" className="text-[10px] font-bold uppercase">2024</SelectItem>
                            <SelectItem value="2025" className="text-[10px] font-bold uppercase">2025</SelectItem>
                            <SelectItem value="2026" className="text-[10px] font-bold uppercase">2026</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl shadow-sm border border-muted/20">
                    <History className="h-4 w-4 text-primary" />
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-[130px] border-none shadow-none font-black text-[10px] uppercase h-8 focus:ring-0">
                            <SelectValue placeholder="Mes" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-2xl">
                            <SelectItem value="all" className="text-[10px] font-bold uppercase">Todos los meses</SelectItem>
                            <SelectItem value="01" className="text-[10px] font-bold uppercase">Enero</SelectItem>
                            <SelectItem value="02" className="text-[10px] font-bold uppercase">Febrero</SelectItem>
                            <SelectItem value="03" className="text-[10px] font-bold uppercase">Marzo</SelectItem>
                            <SelectItem value="04" className="text-[10px] font-bold uppercase">Abril</SelectItem>
                            <SelectItem value="05" className="text-[10px] font-bold uppercase">Mayo</SelectItem>
                            <SelectItem value="06" className="text-[10px] font-bold uppercase">Junio</SelectItem>
                            <SelectItem value="07" className="text-[10px] font-bold uppercase">Julio</SelectItem>
                            <SelectItem value="08" className="text-[10px] font-bold uppercase">Agosto</SelectItem>
                            <SelectItem value="09" className="text-[10px] font-bold uppercase">Septiembre</SelectItem>
                            <SelectItem value="10" className="text-[10px] font-bold uppercase">Octubre</SelectItem>
                            <SelectItem value="11" className="text-[10px] font-bold uppercase">Noviembre</SelectItem>
                            <SelectItem value="12" className="text-[10px] font-bold uppercase">Diciembre</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
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
            <>
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
                                                        <table className="w-full">
                                                            <thead className="bg-muted/30">
                                                                <tr className="text-left">
                                                                    <th className="px-8 py-4 text-[9px] font-black text-muted-foreground uppercase tracking-widest">Actividad</th>
                                                                    <th className="px-4 py-4 text-[9px] font-black text-muted-foreground uppercase tracking-widest">Solicitante</th>
                                                                    <th className="px-4 py-4 text-[9px] font-black text-muted-foreground uppercase tracking-widest">Personal</th>
                                                                    <th className="px-4 py-4 text-[9px] font-black text-muted-foreground uppercase tracking-widest">Estatus</th>
                                                                    <th className="px-8 py-4 text-right text-[9px] font-black text-muted-foreground uppercase tracking-widest">Impacto</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-muted/50">
                                                                {dist.items.map((item) => (
                                                                    <ActivityRow key={item.id} item={item} />
                                                                ))}
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
                {hasMore && (
                    <div className="py-8 flex justify-center">
                        <Button 
                            onClick={loadMore} 
                            disabled={isLoadingMore}
                            variant="ghost"
                            className="rounded-2xl font-black text-[10px] uppercase tracking-widest py-8 px-12 border-2 border-dashed border-primary/20 hover:border-primary hover:bg-white transition-all gap-3 bg-transparent text-primary/60 hover:text-primary"
                        >
                            {isLoadingMore ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <>Cargar más registros históricos <ChevronDown className="h-4 w-4" /></>
                            )}
                        </Button>
                    </div>
                )}
            </>
        )}

        <div className="text-center pb-10 mt-12">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40 italic">
                * Los registros se archivan automáticamente una vez finalizado el ciclo logístico o por anulación justificada.
            </p>
        </div>
      </main>
    </div>
  );
}
