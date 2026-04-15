
"use client";

import { useMemo, useState } from 'react';
import Header from '@/components/header';
import { Card, CardContent } from '@/components/ui/card';
import { useUser, useFirebase, useCollectionOnce, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { type SolicitudCapacitacion, type MovimientoMaquina, type InformeDivulgador, type Dato } from '@/lib/data';
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
import { formatDateToDDMMYYYY, cn, normalizeGeo } from '@/lib/utils';
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

    const itemDate = new Date(item.fecha + 'T23:59:59');
    const isPast = itemDate < new Date();

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
                    <div className={cn("flex items-center gap-1.5", isPast ? "text-red-500" : "text-amber-500")}>
                        {isPast ? <ShieldAlert className="h-3 w-3" /> : <Loader2 className="h-3 w-3 animate-spin" />}
                        <span className="text-[8px] font-black uppercase">
                            {isPast ? (hasReport ? 'PENDIENTE RETORNO' : 'PENDIENTE REPORTE') : 'PROCESANDO'}
                        </span>
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

function DistrictArchiveSection({ 
    deptName, 
    distName, 
    firestore, 
    searchTerm,
    allDeptItems = [],
    isDeptLoading = false,
    initialOpen = false
}: any) {
    const [isOpen, setIsOpen] = useState(initialOpen);
    
    const items = useMemo(() => {
        const target = normalizeGeo(distName);
        const term = (searchTerm || '').toLowerCase().trim();
        
        return (allDeptItems || []).filter((sol: any) => {
            const matchesDistrict = normalizeGeo(sol.distrito) === target;
            const matchesStatus = sol.cancelada || !!sol.fecha_cumplido;
            const matchesSearch = !term || 
                                 (sol.lugar_local || '').toLowerCase().includes(term) || 
                                 (sol.solicitante_entidad || '').toLowerCase().includes(term);
            return matchesDistrict && matchesStatus && matchesSearch;
        }).sort((a: any, b: any) => (b.fecha || '').localeCompare(a.fecha || ''));
    }, [allDeptItems, distName, searchTerm]);

    return (
        <AccordionItem value={distName} className="border-none">
            <AccordionTrigger 
                onClick={() => setIsOpen(!isOpen)} 
                className="hover:no-underline py-4 bg-[#F8F9FA] rounded-2xl px-6 group border border-dashed"
            >
                <div className="flex items-center gap-3">
                    <Building2 className={cn("h-5 w-5 transition-colors", isOpen ? "text-primary" : "text-muted-foreground")} />
                    <h3 className={cn("font-black uppercase text-sm tracking-tight", isOpen ? "text-primary" : "text-muted-foreground")}>
                        {distName}
                    </h3>
                    {items.length > 0 && (
                        <Badge variant="secondary" className="bg-black text-white text-[8px] font-black px-2">
                            {items.length} REGISTROS
                        </Badge>
                    )}
                </div>
            </AccordionTrigger>
            <AccordionContent className="pt-6 px-2 pb-6">
                {isDeptLoading && items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 opacity-40">
                        <Loader2 className="h-6 w-6 animate-spin mb-2" />
                        <p className="text-[9px] font-black uppercase tracking-widest">Buscando en el archivo...</p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 opacity-30 border-2 border-dashed rounded-3xl bg-muted/5">
                        <Archive className="h-8 w-8 mb-2" />
                        <p className="text-[9px] font-black uppercase tracking-widest">Sin registros archivados en este distrito</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <DistrictTable items={items} />
                    </div>
                )}
            </AccordionContent>
        </AccordionItem>
    );
}

function DepartmentSection({ dept, firestore, profile, searchTerm }: any) {
    const [isOpen, setIsOpen] = useState(false);

    // Fetch ALL department items for Anexo I (Lugar Fijo)
    const q = useMemoFirebase(() => {
        if (!firestore || !isOpen) return null;
        return query(
            collection(firestore, 'solicitudes-capacitacion'),
            where('tipo_solicitud', '==', 'Lugar Fijo'),
            where('departamento', '==', dept.name)
        );
    }, [firestore, dept.name, isOpen]);

    const { data: allDeptItems, isLoading: isDeptLoading } = useCollectionOnce<SolicitudCapacitacion>(q);

    const districts = useMemo(() => {
        if (!dept.name) return [];
        // Aquí podrías filtrar distritos de datosData si fuera necesario, 
        // pero vamos a usar la función ya definida en el componente padre
        return []; 
    }, [dept]);

    return (
        <AccordionItem value={dept.name} className="border-none bg-white rounded-[2rem] shadow-sm overflow-hidden">
            <AccordionTrigger 
                className="hover:no-underline px-8 py-6 bg-white group"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-4 text-left">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black transition-transform group-data-[state=open]:scale-110">
                        {dept.code}
                    </div>
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight text-[#1A1A1A]">{dept.name}</h2>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            {isOpen ? 'EXPLORANDO JURISDICCIÓN' : 'CLIC PARA VER DISTRITOS'}
                        </p>
                    </div>
                </div>
            </AccordionTrigger>
            <AccordionContent className="px-8 pb-8 pt-2">
                <Accordion type="multiple" className="space-y-4">
                    {isOpen && dept.districts.map((distName: string) => (
                        <DistrictArchiveSection 
                            key={distName}
                            deptName={dept.name}
                            distName={distName}
                            firestore={firestore}
                            searchTerm={searchTerm}
                            allDeptItems={allDeptItems}
                            isDeptLoading={isDeptLoading}
                        />
                    ))}
                </Accordion>
            </AccordionContent>
        </AccordionItem>
    );
}

function DistrictTable({ items }: { items: SolicitudCapacitacion[] }) {
    const [visibleCount, setVisibleCount] = useState(5);
    const hasMoreItems = items.length > visibleCount;

    return (
        <Card className="border-none shadow-xl overflow-hidden rounded-[1.5rem]">
            <div className="bg-black text-white px-8 py-4 flex items-center gap-3">
                <Archive className="h-4 w-4 opacity-50" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">ANEXO I - REGISTRO DE LUGARES FIJOS ARCHIVADOS</span>
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
                        {items.slice(0, visibleCount).map((item) => (
                            <ActivityRow key={item.id} item={item} />
                        ))}
                    </tbody>
                </table>
            </div>
            {hasMoreItems && (
                <div className="p-6 bg-muted/5 border-t border-dashed flex justify-center">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setVisibleCount(prev => prev + 10)}
                        className="font-black text-[9px] uppercase tracking-widest hover:bg-white gap-2 h-10 px-6 rounded-xl border border-dashed border-muted-foreground/20"
                    >
                        Expandir vista local ({items.length - visibleCount} más)
                        <ChevronDown className="h-3 w-3" />
                    </Button>
                </div>
            )}
        </Card>
    );
}

export default function ArchivoAnexoIPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const [searchTerm, setSearchTerm] = useState('');

  const profile = user?.profile;

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollectionOnce<Dato>(datosQuery);

  const depts = useMemo(() => {
    if (!datosData || !profile) return [];
    
    const hasAdminFilter = ['admin', 'director'].includes(profile.role || '') || profile.permissions?.includes('admin_filter');
    const role = (profile.role || '').toLowerCase();
    const isRestricted = !hasAdminFilter && (role === 'jefe' || role === 'funcionario' || profile.permissions?.includes('district_filter') || profile.permissions?.includes('department_filter'));

    let deptList = Array.from(new Set(datosData.map((d: Dato) => d.departamento))).map(name => {
        const dato = datosData.find((d: Dato) => d.departamento === name);
        let code = dato?.departamento_codigo || '00';
        if (code === '00' && /^\d+/.test(name)) code = name.match(/^\d+/)![0].padStart(2, '0');
        
        return { 
            name, 
            code,
            districts: Array.from(new Set(datosData.filter((d: Dato) => d.departamento === name).map((d: Dato) => d.distrito))).sort()
        };
    });

    if (isRestricted && profile.departamento) {
        deptList = deptList.filter(d => d.name === profile.departamento);
        if (profile.distrito) {
            deptList = deptList.map(d => ({
                ...d,
                districts: d.districts.filter(dist => normalizeGeo(dist) === normalizeGeo(profile.distrito || ''))
            }));
        }
    }

    return deptList.sort((a, b) => a.code.localeCompare(b.code));
  }, [datosData, profile]);

  if (isUserLoading || isLoadingDatos) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Archivo Anexo I" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-primary uppercase leading-none">Anexo I - Historial</h1>
                <p className="text-muted-foreground text-[10px] font-bold uppercase flex items-center gap-2 mt-2 tracking-widest">
                    <History className="h-3.5 w-3.5" /> Lugares Fijos con ciclo logístico cerrado
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
        </div>
        </div>

        <Accordion type="multiple" className="space-y-6">
            {depts.map((dept) => (
                <DepartmentSection 
                    key={dept.name} 
                    dept={dept} 
                    firestore={firestore} 
                    profile={profile}
                    searchTerm={searchTerm}
                />
            ))}
        </Accordion>

        <div className="text-center pb-10 mt-12">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40 italic">
                * Los registros se archivan automáticamente una vez finalizado el ciclo logístico o por anulación justificada.
            </p>
        </div>
      </main>
    </div>
  );
}
