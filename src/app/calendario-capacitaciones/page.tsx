
"use client";

import { useState, useMemo, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { type SolicitudCapacitacion, type Dato } from '@/lib/data';
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
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { useToast } from '@/hooks/use-toast';

export default function CalendarioCapacitacionesPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDayActivities, setSelectedDayActivities] = useState<SolicitudCapacitacion[] | null>(null);

  // Estados de Filtro
  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterDist, setFilterDist] = useState<string>('all');

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
   * OPTIMIZACIÓN CRÍTICA: 
   * Para evitar errores de "Missing Index", solo filtramos por fecha en Firestore.
   * El filtrado geográfico se realiza en memoria (client-side) en el useMemo posterior.
   */
  const solicitudesQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !profile) return null;
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    
    // Rango de fechas del mes visible
    const start = format(startOfWeek(startOfMonth(currentMonth)), 'yyyy-MM-dd');
    const end = format(endOfWeek(endOfMonth(currentMonth)), 'yyyy-MM-dd');

    // Consulta simplificada para evitar necesidad de índices compuestos
    return query(colRef, where('fecha', '>=', start), where('fecha', '<=', end));
  }, [firestore, isUserLoading, profile, currentMonth]);

  const { data: rawActivities, isLoading: isLoadingActivities, error: activityError } = useCollection<SolicitudCapacitacion>(solicitudesQuery);

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollection<Dato>(datosQuery);

  /**
   * Filtrado Geográfico en Cliente
   */
  const filteredActivities = useMemo(() => {
    if (!rawActivities || !profile) return [];

    return rawActivities.filter(act => {
        // 1. Filtrado por permisos de usuario (Seguridad)
        if (!hasAdminFilter) {
            if (hasDeptFilter && act.departamento !== profile.departamento) return false;
            if (hasDistFilter && (act.departamento !== profile.departamento || act.distrito !== profile.distrito)) return false;
        }

        // 2. Filtrado por UI (Filtros del Administrador)
        if (hasAdminFilter) {
            if (filterDept !== 'all' && act.departamento !== filterDept) return false;
            if (filterDist !== 'all' && act.distrito !== filterDist) return false;
        }

        return true;
    });
  }, [rawActivities, profile, hasAdminFilter, hasDeptFilter, hasDistFilter, filterDept, filterDist]);

  const departments = useMemo(() => {
    if (!datosData) return [];
    return [...new Set(datosData.map(d => d.departamento))].sort();
  }, [datosData]);

  const districts = useMemo(() => {
    if (!datosData || filterDept === 'all') return [];
    return [...new Set(datosData.filter(d => d.departamento === filterDept).map(d => d.distrito))].sort();
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
                {hasAdminFilter && (
                    <div className="flex items-center gap-2 bg-white border-2 rounded-2xl p-2 shadow-sm w-full md:w-auto">
                        <div className="flex items-center gap-2 px-2 border-r pr-4">
                            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[9px] font-black uppercase text-muted-foreground">Filtros</span>
                        </div>
                        <Select value={filterDept} onValueChange={(v) => { setFilterDept(v); setFilterDist('all'); }}>
                            <SelectTrigger className="h-9 w-[140px] text-[10px] font-bold uppercase border-none focus:ring-0">
                                <SelectValue placeholder="Dpto: Todos" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">DPTO: TODOS</SelectItem>
                                {departments.map(d => <SelectItem key={d} value={d} className="text-[10px] font-bold uppercase">{d}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={filterDist} onValueChange={setFilterDist} disabled={filterDept === 'all'}>
                            <SelectTrigger className="h-9 w-[140px] text-[10px] font-bold uppercase border-none focus:ring-0">
                                <SelectValue placeholder="Dist: Todos" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">DIST: TODOS</SelectItem>
                                {districts.map(d => <SelectItem key={d} value={d} className="text-[10px] font-bold uppercase">{d}</SelectItem>)}
                            </SelectContent>
                        </Select>
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

            <div className="grid grid-cols-7 bg-black text-white border-b border-black">
                {['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map(day => (
                    <div key={day} className="py-4 text-center">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">{day}</span>
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
                                    const dato = datosData?.find(d => d.departamento === act.departamento && d.distrito === act.distrito);
                                    const deptCode = dato?.departamento_codigo || '00';
                                    const isAnexoI = act.tipo_solicitud === 'Lugar Fijo';

                                    return (
                                        <div 
                                            key={act.id} 
                                            onClick={() => setSelectedDayActivities(dayActivities)}
                                            className={cn(
                                                "px-2 py-1.5 rounded-lg border-l-4 cursor-pointer transition-all hover:translate-x-1 shadow-sm text-left mb-1 last:mb-0",
                                                act.tipo_solicitud === 'divulgacion' ? "bg-blue-50 border-l-blue-600" :
                                                act.tipo_solicitud === 'capacitacion' ? "bg-purple-50 border-l-purple-600" :
                                                "bg-green-50 border-l-green-600"
                                            )}
                                        >
                                            <div className="flex justify-between items-start gap-1">
                                                <p className="text-[6.5px] font-black text-primary/60 uppercase truncate">
                                                    {deptCode} - 00 - 00 {act.distrito}
                                                </p>
                                                <Badge variant="outline" className={cn(
                                                    "text-[5.5px] font-black px-1 py-0 h-3 border-primary/10",
                                                    isAnexoI ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                                                )}>
                                                    {isAnexoI ? 'ANEXO I' : 'ANEXO V'}
                                                </Badge>
                                            </div>
                                            <p className="text-[8px] font-black uppercase truncate text-[#1A1A1A] leading-tight mt-0.5">
                                                {act.lugar_local}
                                            </p>
                                            <div className="flex items-center gap-1 mt-0.5 opacity-60">
                                                <Clock className="h-2 w-2" />
                                                <span className="text-[6.5px] font-bold uppercase">{act.hora_desde} A {act.hora_hasta} HS</span>
                                            </div>
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

        <div className="flex justify-center gap-8 py-4 px-8 bg-white border-2 rounded-3xl border-dashed">
            <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-blue-600" />
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Divulgación MV</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-purple-600" />
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Capacitación MM</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-600" />
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Lugar Fijo (Anexo I)</span>
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
                        act.tipo_solicitud === 'divulgacion' ? "bg-blue-600" :
                        act.tipo_solicitud === 'capacitacion' ? "bg-purple-600" :
                        "bg-green-600"
                    )} />
                    <CardContent className="p-6 space-y-4">
                        <div className="space-y-1">
                            <div className="flex items-center justify-between mb-2">
                                <Badge variant="secondary" className="font-black text-[8px] uppercase tracking-widest bg-muted/50">
                                    {act.tipo_solicitud}
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
                            <Button variant="ghost" size="sm" className="h-8 font-black uppercase text-[8px] tracking-widest hover:bg-black hover:text-white" asChild>
                                <Link href={act.tipo_solicitud === 'Lugar Fijo' ? '/agenda-anexo-i' : '/agenda-anexo-v'}>
                                    VER EN AGENDA
                                </Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
