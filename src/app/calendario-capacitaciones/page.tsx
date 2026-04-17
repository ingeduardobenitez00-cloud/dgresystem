
"use client";

import { useState, useMemo, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirebase, useCollectionOnce, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { type SolicitudCapacitacion, type Dato, type InformeDivulgador } from '@/lib/data';
import { 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  Info,
  Building2,
  Users,
  Printer,
  FileText,
  ClipboardCheck,
  Search,
  Filter,
  Landmark,
  AlertCircle,
  CheckCircle2,
  Maximize2,
  Image as ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  parseISO 
} from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { ImageViewerDialog } from '@/components/image-viewer-dialog';

export default function CalendarioCapacitacionesPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDayActivities, setSelectedDayActivities] = useState<SolicitudCapacitacion[] | null>(null);
  const [informesMap, setInformesMap] = useState<Map<string, InformeDivulgador>>(new Map());
  const [viewingReport, setViewingReport] = useState<InformeDivulgador | null>(null);
  const [fullViewerImage, setFullViewerImage] = useState<string | null>(null);

  // Estados de Filtro
  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterDist, setFilterDist] = useState<string>('all');
  const [searchDistrito, setSearchDistrito] = useState<string>('');

  const profile = user?.profile;

  const hasAdminFilter = useMemo(() => 
    ['admin', 'director', 'coordinador'].includes(profile?.role || '') || profile?.permissions?.includes('admin_filter'),
    [profile]
  );
  
  const hasDeptFilter = useMemo(() => 
    !hasAdminFilter && profile?.permissions?.includes('department_filter'),
    [profile, hasAdminFilter]
  );

  const hasDistFilter = useMemo(() => 
    !hasAdminFilter && !hasDeptFilter && (profile?.permissions?.includes('district_filter') || profile?.role === 'jefe' || profile?.role === 'funcionario'),
    [profile, hasAdminFilter, hasDeptFilter]
  );

  /**
   * OPTIMIZACIÓN: 
   * Filtramos por fecha en Firestore. El filtrado geográfico y por nombre se realiza en memoria.
   */
  const solicitudesQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !profile) return null;
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    
    // Rango de fechas del mes visible
    const start = format(startOfWeek(startOfMonth(currentMonth)), 'yyyy-MM-dd');
    const end = format(endOfWeek(endOfMonth(currentMonth)), 'yyyy-MM-dd');

    let q = query(colRef, where('fecha', '>=', start), where('fecha', '<=', end));

    if (hasAdminFilter) {
        if (filterDept !== 'all') {
            if (filterDist !== 'all') {
                q = query(colRef, 
                    where('departamento', '==', filterDept), 
                    where('distrito', '==', filterDist),
                    where('fecha', '>=', start), 
                    where('fecha', '<=', end)
                );
            } else {
                q = query(colRef, 
                    where('departamento', '==', filterDept), 
                    where('fecha', '>=', start), 
                    where('fecha', '<=', end)
                );
            }
        }
    } else {
        // Modo Restringido por Perfil
        const depto = profile.departamento;
        if (hasDeptFilter) {
             q = query(colRef, 
                where('departamento', '==', depto), 
                where('fecha', '>=', start), 
                where('fecha', '<=', end)
            );
        } else if (hasDistFilter) {
            q = query(colRef, 
                where('departamento', '==', depto), 
                where('distrito', '==', profile.distrito),
                where('fecha', '>=', start), 
                where('fecha', '<=', end)
            );
        }
    }

    return q;
  }, [firestore, isUserLoading, profile, currentMonth, filterDept, filterDist, hasAdminFilter, hasDeptFilter, hasDistFilter]);

  const { 
    data: rawActivities, 
    isLoading: isLoadingActivities,
    error: errorActivities
  } = useCollectionOnce<SolicitudCapacitacion>(solicitudesQuery);

  /**
   * Carga de Informes (Resultados) para las actividades cargadas
   */
  useEffect(() => {
    if (!firestore || !rawActivities || rawActivities.length === 0) return;

    const ids = rawActivities.map(a => a.id);
    const chunks = [];
    for (let i = 0; i < ids.length; i += 30) {
        chunks.push(ids.slice(i, i + 30));
    }

    Promise.all(chunks.map(chunk => 
        getDocs(query(collection(firestore, 'informes-divulgador'), where('solicitud_id', 'in', chunk)))
    )).then(snapshots => {
        const newMap = new Map();
        snapshots.forEach(snap => snap.docs.forEach(doc => {
            const data = doc.data() as InformeDivulgador;
            newMap.set(data.solicitud_id, { ...data, id: doc.id });
        }));
        setInformesMap(newMap);
    }).catch(e => console.error("Error cargando informes:", e));
  }, [firestore, rawActivities]);

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollectionOnce<Dato>(datosQuery);

  /**
   * Filtrado Geográfico y por Nombre en Cliente
   */
  const filteredActivities = useMemo(() => {
    if (!rawActivities) return [];
    const term = searchDistrito.toLowerCase().trim();
    if (!term) return rawActivities;

    // El filtrado geográfico ya lo hace Firestore. Aquí solo filtramos por texto si el usuario busca algo específico.
    return rawActivities.filter(act => 
        act.distrito.toLowerCase().includes(term) || 
        act.lugar_local.toLowerCase().includes(term)
    );
  }, [rawActivities, searchDistrito]);

  const departments = useMemo<string[]>(() => {
    if (!datosData) return [];
    return [...new Set(datosData.map((d: Dato) => d.departamento))].sort();
  }, [datosData]);

  const districts = useMemo<string[]>(() => {
    if (!datosData || filterDept === 'all') return [];
    return [...new Set(datosData.filter((d: Dato) => d.departamento === filterDept).map((d: Dato) => d.distrito))].sort();
  }, [datosData, filterDept]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  if (isUserLoading || isLoadingDatos) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Calendario de Actividades" />
      
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-4">
            <div className="flex items-center gap-4">
                <div className="bg-black text-white p-3 rounded-2xl shadow-xl">
                    <CalendarIcon className="h-6 w-6" />
                </div>
                <div>
                    <h1 className="text-3xl font-black uppercase text-primary tracking-tighter leading-none">Calendario Mensual</h1>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1 tracking-widest flex items-center gap-2">
                        Jurisdicción: {hasAdminFilter ? (filterDept === 'all' ? "NACIONAL" : filterDist === 'all' ? filterDept : `${filterDist} - ${filterDept}`) : profile?.distrito || profile?.departamento}
                    </p>
                </div>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                {hasAdminFilter ? (
                    <div className="flex flex-col md:flex-row items-center gap-2 bg-white border-2 rounded-2xl p-2 shadow-sm w-full md:w-auto">
                        <div className="flex items-center gap-2 px-2 border-r pr-4">
                            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[9px] font-black uppercase text-muted-foreground">Filtros</span>
                        </div>
                        <div className="flex items-center gap-2 w-full">
                            <Select value={filterDept} onValueChange={(v) => { setFilterDept(v); setFilterDist('all'); }}>
                                <SelectTrigger className="h-9 w-[130px] text-[10px] font-bold uppercase border-none focus:ring-0">
                                    <SelectValue placeholder="Dpto: Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">DPTO: TODOS</SelectItem>
                                    {departments.map((d: string) => <SelectItem key={d} value={d} className="text-[10px] font-bold uppercase">{d}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={filterDist} onValueChange={setFilterDist} disabled={filterDept === 'all'}>
                                <SelectTrigger className="h-9 w-[130px] text-[10px] font-bold uppercase border-none focus:ring-0">
                                    <SelectValue placeholder="Dist: Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">DIST: TODOS</SelectItem>
                                    {districts.map((d: string) => <SelectItem key={d} value={d} className="text-[10px] font-bold uppercase">{d}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <div className="relative w-full md:w-40 border-l pl-2">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground opacity-40" />
                                <Input 
                                    placeholder="BUSCAR DISTRITO..." 
                                    className="h-8 pl-7 text-[9px] font-black border-none bg-muted/30 rounded-lg uppercase"
                                    value={searchDistrito}
                                    onChange={e => setSearchDistrito(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-primary/5 px-6 py-2 rounded-2xl border border-primary/10 flex items-center gap-3">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span className="text-xs font-black uppercase tracking-tight text-primary">
                            {profile?.distrito}
                        </span>
                    </div>
                )}

                <div className="flex items-center gap-4 bg-white border-2 rounded-2xl p-2 shadow-sm">
                    <Button variant="ghost" size="icon" onClick={prevMonth} className="h-9 w-9 rounded-xl hover:bg-muted">
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="min-w-[140px] text-center">
                        <h2 className="text-sm font-black uppercase tracking-tight">
                            {format(currentMonth, 'MMMM yyyy', { locale: es })}
                        </h2>
                    </div>
                    <Button variant="ghost" size="icon" onClick={nextMonth} className="h-9 w-9 rounded-xl hover:bg-muted">
                        <ChevronRight className="h-5 w-5" />
                    </Button>
                </div>
            </div>
        </div>

        <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white relative">
            {isLoadingActivities && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-20 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Sincronizando agenda...</p>
                    </div>
                </div>
            )}

            {errorActivities && (
                <div className="absolute inset-x-0 top-0 z-30 p-6">
                    <div className="bg-red-50 border border-red-200 rounded-3xl p-6 shadow-2xl animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-center gap-3 text-red-600 mb-2">
                            <AlertCircle className="h-5 w-5" />
                            <span className="font-black text-[11px] uppercase tracking-tighter">Error de Sincronización</span>
                        </div>
                        <p className="text-[10px] font-bold text-red-800 uppercase leading-relaxed">
                            {errorActivities.message.includes('index') ? 
                                "Falta un índice compuesto en Firestore para este mes. Por favor, abre la consola del navegador para crearlo con el enlace proporcionado por Firebase." : 
                                "No se han podido cargar las actividades de este mes."}
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-7 bg-black text-white border-b border-black">
                {[
                    { f: 'Domingo', s: 'DOM' },
                    { f: 'Lunes', s: 'LUN' },
                    { f: 'Martes', s: 'MAR' },
                    { f: 'Miércoles', s: 'MIE' },
                    { f: 'Jueves', s: 'JUE' },
                    { f: 'Viernes', s: 'VIE' },
                    { f: 'Sábado', s: 'SAB' }
                ].map(day => (
                    <div key={day.f} className="py-4 text-center">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] hidden md:inline">{day.f}</span>
                        <span className="text-[10px] font-black uppercase tracking-[0.1em] md:hidden">{day.s}</span>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 auto-rows-[minmax(140px,auto)]">
                {calendarDays.map((day, idx) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const dayActivities = filteredActivities.filter(a => a.fecha === dateKey && !a.cancelada) || [];
                    const isToday = isSameDay(day, new Date());
                    const isCurrentMonth = isSameMonth(day, currentMonth);

                    return (
                        <div 
                            key={idx} 
                            className={cn(
                                "border-r border-b min-h-[140px] p-2 transition-all group relative",
                                !isCurrentMonth ? "bg-muted/20 opacity-40" : "bg-white",
                                isToday && "ring-2 ring-primary ring-inset z-10"
                            )}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className={cn(
                                    "text-sm font-black p-1.5 rounded-lg min-w-[28px] text-center",
                                    isToday ? "bg-primary text-white" : "text-muted-foreground"
                                )}>
                                    {format(day, 'd')}
                                </span>
                                {dayActivities.length > 0 && (
                                    <Badge variant="secondary" className="bg-primary/5 text-primary border-none text-[8px] font-black h-5">
                                        {dayActivities.length}
                                    </Badge>
                                )}
                            </div>

                            <div className="space-y-1.5 overflow-hidden">
                                {dayActivities.slice(0, 4).map((act) => {
                                    const isAnexoI = act.tipo_solicitud === 'Lugar Fijo';

                                    return (
                                        <div 
                                            key={act.id} 
                                            onClick={() => setSelectedDayActivities(dayActivities)}
                                            className={cn(
                                                "px-2 py-1.5 rounded-lg border-l-4 cursor-pointer transition-all hover:translate-x-1 shadow-sm text-left mb-1 last:mb-0",
                                                informesMap.has(act.id) ? "bg-green-100/50 border-l-green-600 ring-1 ring-green-600/20" :
                                                act.tipo_solicitud === 'divulgacion' ? "bg-blue-50 border-l-blue-600" :
                                                act.tipo_solicitud === 'capacitacion' ? "bg-blue-50 border-l-blue-600" :
                                                "bg-green-50 border-l-green-600"
                                            )}
                                        >
                                            <div className="flex justify-between items-start gap-1">
                                                <p className="text-[8px] font-black text-primary uppercase truncate leading-none">
                                                    {act.distrito}
                                                </p>
                                                <Badge variant="outline" className={cn(
                                                    "text-[5.5px] font-black px-1 py-0 h-3 border-primary/10",
                                                    isAnexoI ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                                                )}>
                                                    {isAnexoI ? 'ANEXO I' : act.tipo_solicitud === 'divulgacion' ? 'DIV. MV' : 'CAP. MM'}
                                                </Badge>
                                            </div>
                                            <p className="text-[7.5px] font-bold uppercase truncate text-muted-foreground leading-tight mt-0.5">
                                                {act.lugar_local}
                                            </p>
                                            <div className="flex items-center gap-1 mt-0.5 opacity-60">
                                                <Clock className="h-2 w-2" />
                                                <span className="text-[6.5px] font-bold uppercase">{act.hora_desde} A {act.hora_hasta} HS</span>
                                            </div>
                                            {informesMap.has(act.id) && (
                                                <div className="flex items-center gap-1 mt-1 text-green-700">
                                                    <CheckCircle2 className="h-2 w-2" />
                                                    <span className="text-[6.5px] font-black uppercase tracking-tighter">REPORTADO: {informesMap.get(act.id)?.total_personas}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {dayActivities.length > 4 && (
                                    <p className="text-[8px] font-black text-center text-muted-foreground uppercase py-1">
                                        + {dayActivities.length - 4} actividades
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>

        {/* LEYENDA INSTITUCIONAL */}
        <div className="flex flex-col md:flex-row justify-center items-center gap-12 py-8 px-10 bg-white border-2 rounded-[2.5rem] border-dashed shadow-sm">
            <div className="flex flex-col items-center gap-3">
                <span className="text-[11px] font-black uppercase italic tracking-wider text-primary">Solicitudes (ANEXO V)</span>
                <div className="flex gap-8">
                    <div className="flex items-center gap-2.5">
                        <div className="h-3.5 w-3.5 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]" />
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">DIVULGACIÓN MV</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <div className="h-3.5 w-3.5 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]" />
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">CAPACITACIÓN MM</span>
                    </div>
                </div>
            </div>
            
            <div className="h-12 w-px bg-muted hidden md:block" />
            
            <div className="flex items-center gap-3">
                <div className="h-3.5 w-3.5 rounded-full bg-green-600 shadow-[0_0_8px_rgba(22,163,74,0.4)]" />
                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">LUGAR FIJO (ANEXO I)</span>
            </div>
        </div>
      </main>

      <Sheet open={!!selectedDayActivities} onOpenChange={(o) => !o && setSelectedDayActivities(null)}>
        <SheetContent className="sm:max-w-md border-l-8 border-l-primary overflow-y-auto">
          <SheetHeader className="mb-8">
            <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center mb-4">
                <Info className="h-6 w-6 text-primary" />
            </div>
            <SheetTitle className="text-2xl font-black uppercase tracking-tight">Actividades del Día</SheetTitle>
            <SheetDescription className="font-bold uppercase text-[10px] tracking-widest">
                {selectedDayActivities?.[0] && format(parseISO(selectedDayActivities[0].fecha), 'EEEE d MMMM yyyy', { locale: es })}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6">
            {selectedDayActivities?.map((act) => (
                <Card key={act.id} className="border-2 rounded-2xl overflow-hidden group hover:border-primary/20 transition-all">
                    <div className={cn(
                        "h-1.5 w-full",
                        act.tipo_solicitud === 'Lugar Fijo' ? "bg-green-600" : "bg-blue-600"
                    )} />
                    <CardContent className="p-6 space-y-4">
                        <div className="space-y-1">
                            <div className="flex items-center justify-between mb-2">
                                <Badge variant="secondary" className="font-black text-[8px] uppercase tracking-widest bg-muted/50">
                                    {act.tipo_solicitud === 'divulgacion' ? 'DIVULGACIÓN MV' : act.tipo_solicitud === 'capacitacion' ? 'CAPACITACIÓN MM' : 'LUGAR FIJO'}
                                </Badge>
                                <Badge className={cn(
                                    "text-[8px] font-black uppercase",
                                    act.tipo_solicitud === 'Lugar Fijo' ? "bg-green-600" : "bg-blue-600"
                                )}>
                                    {act.tipo_solicitud === 'Lugar Fijo' ? 'ANEXO I' : 'ANEXO V'}
                                </Badge>
                            </div>
                            <h4 className="text-sm font-black uppercase leading-tight text-primary">{act.lugar_local}</h4>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-[10px] font-bold">{act.hora_desde} A {act.hora_hasta} HS</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-[10px] font-bold uppercase truncate">{(act.divulgadores || act.asignados || []).length} ASIGNADOS</span>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-dashed flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Building2 className="h-3.5 w-3.5 text-primary opacity-40" />
                                <span className="text-[9px] font-black uppercase opacity-60">{act.distrito}</span>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="sm" className="h-8 font-black uppercase text-[8px] tracking-widest hover:bg-black hover:text-white" asChild>
                                    <Link href={`${act.tipo_solicitud === 'Lugar Fijo' ? '/agenda-anexo-i' : '/agenda-anexo-v'}?id=${act.id}&dept=${encodeURIComponent(act.departamento)}&dist=${encodeURIComponent(act.distrito)}`}>
                                        VER EN AGENDA
                                    </Link>
                                </Button>
                                {informesMap.has(act.id) && (
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="h-8 font-black uppercase text-[8px] tracking-widest border-green-600 text-green-600 hover:bg-green-600 hover:text-white"
                                        onClick={() => setViewingReport(informesMap.get(act.id)!)}
                                    >
                                        VER RESULTADOS
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!viewingReport} onOpenChange={(o) => !o && setViewingReport(null)}>
        <DialogContent className="max-w-4xl h-[90vh] p-0 border-none shadow-2xl overflow-hidden rounded-[2.5rem] flex flex-col">
          {viewingReport && (
            <div className="flex flex-col h-full bg-white">
                                <div className="bg-green-600 text-white p-8 shrink-0">
                                    <DialogHeader>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center shadow-lg">
                                                    <ClipboardCheck className="h-6 w-6" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <DialogTitle className="text-2xl font-black uppercase leading-none tracking-tight">RESULTADOS DE ACTIVIDAD</DialogTitle>
                                                        <Badge className="bg-white text-green-700 font-black uppercase text-[10px]">CUMPLIDO</Badge>
                                                    </div>
                                                    <DialogDescription className="text-white/80 font-bold uppercase text-[10px] mt-2 tracking-widest flex items-center gap-2">
                                                        {viewingReport.departamento} | {viewingReport.distrito}
                                                    </DialogDescription>
                                                </div>
                                            </div>
                                        </div>
                                    </DialogHeader>
                                </div>

                                <div className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-black/10">
                                    <div className="space-y-10">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-4">
                                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">MÉTRICAS CLAVE</p>
                                                <Card className="border-2 border-green-100 bg-green-50/30 overflow-hidden shadow-sm">
                                                    <CardContent className="p-8">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <h3 className="text-4xl font-black text-green-700 tracking-tighter">{viewingReport.total_personas || 0}</h3>
                                                                <p className="text-[10px] font-black uppercase text-green-600/60 mt-2">CIUDADANOS ALCANZADOS</p>
                                                            </div>
                                                            <div className="h-16 w-16 rounded-2xl bg-green-600/10 flex items-center justify-center">
                                                                <Users className="h-8 w-8 text-green-600" />
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            </div>

                                            <div className="space-y-4">
                                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">INFORME DE GESTIÓN</p>
                                                <div className="p-8 bg-[#F8F9FA] rounded-[2rem] border-2 border-dashed border-muted/20">
                                                    <p className="text-xs font-black uppercase text-muted-foreground mb-4 leading-none">Resumen del Divulgador:</p>
                                                    <p className="text-[13px] font-bold text-primary leading-relaxed whitespace-pre-wrap italic">
                                                        {viewingReport.observaciones || viewingReport.lugar_divulgacion || 'SIN OBSERVACIONES REGISTRADAS'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <Separator className="border-dashed" />

                                        <div className="space-y-6">
                                            <div className="flex items-center gap-3">
                                                <ImageIcon className="h-5 w-5 text-green-600" />
                                                <h3 className="font-black uppercase text-[10px] tracking-[0.2em]">Galería de Evidencia</h3>
                                            </div>
                                            
                                            {viewingReport.fotos && viewingReport.fotos.length > 0 ? (
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-10">
                                                    {viewingReport.fotos.map((foto, idx) => (
                                                        <div 
                                                            key={idx} 
                                                            className="group relative aspect-square rounded-2xl overflow-hidden border-2 border-muted/20 bg-muted cursor-pointer hover:border-green-600 transition-all shadow-sm"
                                                            onClick={() => setFullViewerImage(foto)}
                                                        >
                                                            <Image src={foto} alt={`Evidencia ${idx + 1}`} fill className="object-cover transition-transform group-hover:scale-110" />
                                                            <div className="absolute inset-0 bg-green-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <Maximize2 className="h-6 w-6 text-white" />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="p-20 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center opacity-20 bg-muted/20">
                                                    <ImageIcon className="h-10 w-10 mb-2" />
                                                    <p className="text-[10px] font-black uppercase">SIN REGISTRO FOTOGRÁFICO</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 bg-[#F8F9FA] border-t shrink-0 flex justify-end">
                                    <Button className="h-12 px-8 bg-black text-white rounded-xl font-black uppercase text-[10px]" onClick={() => setViewingReport(null)}>
                                        CERRAR INFORME
                                    </Button>
                                </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ImageViewerDialog 
        isOpen={!!fullViewerImage}
        onOpenChange={(o) => !o && setFullViewerImage(null)}
        image={fullViewerImage}
      />
    </div>
  );
}
