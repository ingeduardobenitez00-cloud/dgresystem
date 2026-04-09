"use client";

import { useState, useMemo, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  MapPin, 
  Search, 
  Download, 
  Filter, 
  Globe,
  Building2,
  Clock,
  Calendar as CalendarIcon,
  ChevronDown
} from 'lucide-react';
import { useUser, useFirebase, useCollection, useMemoFirebase, useCollectionOnce } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import * as XLSX from 'xlsx';
import { type Dato, type SolicitudCapacitacion } from '@/lib/data';
import { cn, formatDateToDDMMYYYY } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";

export default function PuntosFijosPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfWeek(new Date(), { weekStartsOn: 0 }),
    to: endOfWeek(new Date(), { weekStartsOn: 0 }),
  });
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);

  const profile = user?.profile;
  const isAdminView = ['admin', 'director', 'coordinador'].includes(profile?.role || '') || profile?.permissions?.includes('admin_filter');

  // Carga de departamentos y distritos para los filtros
  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData } = useCollectionOnce<Dato>(datosQuery);

  const departments = useMemo(() => {
    if (!datosData) return [];
    return [...new Set(datosData.map(d => d.departamento))].sort();
  }, [datosData]);

  const districts = useMemo(() => {
    if (!datosData || !selectedDepartment || selectedDepartment === 'ALL') return [];
    return [...new Set(datosData.filter(d => d.departamento === selectedDepartment).map(d => d.distrito))].sort();
  }, [datosData, selectedDepartment]);

  // Efecto para inicializar filtros basados en el perfil del usuario
  useEffect(() => {
    if (!isUserLoading && profile) {
      if (!isAdminView) {
        if (profile.departamento) setSelectedDepartment(profile.departamento);
        if (profile.distrito) setSelectedDistrict(profile.distrito);
      } else if (!selectedDepartment) {
        setSelectedDepartment('ALL');
        setSelectedDistrict('ALL');
      }
    }
  }, [isUserLoading, profile, isAdminView, selectedDepartment]);

  // Consulta de Puntos Fijos (Solicitudes tipo 'Lugar Fijo')
  const puntosFijosQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    // Quitamos 'orderBy' para evitar la necesidad de índices compuestos manuales. El ordenamiento se hace en memoria.
    return query(colRef, where('tipo_solicitud', '==', 'Lugar Fijo'));
  }, [firestore]);

  const { data: rawPuntosFijos, isLoading } = useCollection<SolicitudCapacitacion>(puntosFijosQuery);

  // Filtrado de datos en el cliente
  const filteredData = useMemo(() => {
    if (!rawPuntosFijos) return [];
    
    return rawPuntosFijos.filter(p => {
      const matchesDept = selectedDepartment === 'ALL' || !selectedDepartment || p.departamento === selectedDepartment;
      const matchesDist = selectedDistrict === 'ALL' || !selectedDistrict || p.distrito === selectedDistrict;
      
      let matchesDate = true;
      if (dateRange?.from && dateRange?.to) {
          const fromStr = format(dateRange.from, 'yyyy-MM-dd');
          const toStr = format(dateRange.to, 'yyyy-MM-dd');
          matchesDate = p.fecha >= fromStr && p.fecha <= toStr;
      }
      
      return matchesDept && matchesDist && matchesDate;
    }).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [rawPuntosFijos, selectedDepartment, selectedDistrict, dateRange]);

  const exportToExcel = () => {
    if (filteredData.length === 0) {
      toast({ variant: "destructive", title: "Sin datos para exportar" });
      return;
    }

    const dataToExport = filteredData.map(p => ({
      'DEPARTAMENTO': p.departamento,
      'DISTRITO': p.distrito,
      'LUGAR / PUNTO FIJO': p.lugar_local,
      'DIRECCIÓN': p.direccion_calle || 'S/D',
      'FECHA': formatDateToDDMMYYYY(p.fecha),
      'HORARIO': `${p.hora_desde} A ${p.hora_hasta} HS`,
      'ESTADO': p.cancelada ? 'SUSPENDIDO' : 'ACTIVO'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Puntos Fijos");
    
    // Auto-ajuste de columnas básicos
    const wscols = [
      { wch: 20 }, { wch: 20 }, { wch: 40 }, { wch: 40 }, { wch: 15 }, { wch: 20 }, { wch: 15 }
    ];
    ws['!cols'] = wscols;

    XLSX.writeFile(wb, `PuntosFijos_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
    toast({ title: "Excel Generado", description: "El archivo se ha descargado correctamente." });
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Módulo de Puntos Fijos" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Puntos Fijos de Divulgación</h1>
            <p className="text-muted-foreground text-xs font-bold uppercase flex items-center gap-2 mt-1">
              <MapPin className="h-3.5 w-3.5" /> Directorio nacional de lugares permanentes de divulgación.
            </p>
          </div>
          <Button 
            onClick={exportToExcel} 
            disabled={filteredData.length === 0}
            className="font-black uppercase h-12 px-8 bg-green-600 hover:bg-green-700 text-white shadow-xl rounded-xl gap-2 transition-all"
          >
            <Download className="h-5 w-5" /> EXPORTAR {dateRange?.from ? `SEMANA ${format(dateRange.from, 'dd/MM')}` : 'EXCEL'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Panel de Filtros */}
          <Card className="lg:col-span-1 shadow-lg border-none rounded-3xl overflow-hidden">
            <CardHeader className="bg-black text-white py-4">
              <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" /> FILTROS DE BÚSQUEDA
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
                  <Globe className="h-3 w-3" /> Departamento
                </Label>
                {isAdminView ? (
                  <Select onValueChange={(v) => { setSelectedDepartment(v); setSelectedDistrict('ALL'); }} value={selectedDepartment || undefined}>
                    <SelectTrigger className="h-11 font-bold border-2 rounded-xl bg-white"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="font-black text-primary">TODO EL PAÍS</SelectItem>
                      {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={selectedDepartment || ''} readOnly className="h-11 font-black bg-muted/20 border-2 rounded-xl" />
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Distrito / Oficina
                </Label>
                {isAdminView ? (
                  <Select onValueChange={setSelectedDistrict} value={selectedDistrict || undefined} disabled={!selectedDepartment || selectedDepartment === 'ALL'}>
                    <SelectTrigger className="h-11 font-bold border-2 rounded-xl bg-white"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="font-black text-primary">TODOS LOS DISTRITOS</SelectItem>
                      {districts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={selectedDistrict || ''} readOnly className="h-11 font-black bg-muted/20 border-2 rounded-xl" />
                )}
              </div>

              <div className="space-y-2 pt-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" /> Rango Semanal (Anexo IV)
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-14 justify-start text-left font-black text-xs border-2 rounded-xl bg-white hover:border-primary transition-all gap-3",
                        !dateRange && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="h-4 w-4 opacity-40" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "dd/MM")} - {format(dateRange.to, "dd/MM/yyyy")}
                          </>
                        ) : (
                          format(dateRange.from, "dd/MM/yyyy")
                        )
                      ) : (
                        <span>SELECCIONAR SEMANA</span>
                      )}
                      <ChevronDown className="ml-auto h-4 w-4 opacity-20" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-2xl overflow-hidden" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={(range) => {
                        if (range?.from) {
                          // Permitimos selección libre. Solo si es una selección incompleta (sin to), mantenemos el from.
                          setDateRange(range);
                        } else {
                          setDateRange(undefined);
                        }
                      }}
                      numberOfMonths={1}
                      locale={es}
                      className="bg-white"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>

          {/* Tabla de Resultados */}
          <Card className="lg:col-span-3 shadow-xl border-none rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-primary/5 border-b py-4">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center justify-between">
                <span>Registros Encontrados: {filteredData.length}</span>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="text-[9px] font-black uppercase py-4 pl-6">Ubicación</TableHead>
                      <TableHead className="text-[9px] font-black uppercase py-4">Lugar / Punto Fijo</TableHead>
                      <TableHead className="text-[9px] font-black uppercase py-4">Fecha</TableHead>
                      <TableHead className="text-[9px] font-black uppercase py-4">Horario</TableHead>
                      <TableHead className="text-[9px] font-black uppercase py-4 pr-6 text-center">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={5} className="py-20 text-center"><Loader2 className="h-10 w-10 animate-spin mx-auto text-primary/20"/></TableCell></TableRow>
                    ) : filteredData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-20 text-center text-muted-foreground uppercase font-black text-xs">
                          <MapPin className="h-12 w-12 mx-auto mb-4 opacity-10" />
                          No se encontraron puntos fijos en la búsqueda actual
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredData.map((p) => (
                        <TableRow key={p.id} className="hover:bg-muted/20 border-b last:border-0 transition-colors">
                          <TableCell className="py-4 pl-6">
                            <p className="text-[10px] font-black uppercase text-primary leading-none">{p.departamento}</p>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase">{p.distrito}</p>
                          </TableCell>
                          <TableCell className="py-4">
                            <p className="text-[11px] font-black uppercase leading-tight">{p.lugar_local}</p>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase truncate max-w-[200px]">{p.direccion_calle || 'Sin dirección registrada'}</p>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex items-center gap-1 text-[10px] font-black uppercase">
                              <CalendarIcon className="h-3 w-3 text-primary/40" />
                              {formatDateToDDMMYYYY(p.fecha)}
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex items-center gap-1 text-[10px] font-black uppercase">
                              <Clock className="h-3 w-3 text-primary/40" />
                              {p.hora_desde} - {p.hora_hasta} HS
                            </div>
                          </TableCell>
                          <TableCell className="py-4 pr-6 text-center">
                            <Badge variant={p.cancelada ? "destructive" : "secondary"} className="text-[8px] font-black uppercase tracking-widest border-none">
                              {p.cancelada ? 'SUSPENDIDO' : 'ACTIVO'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
