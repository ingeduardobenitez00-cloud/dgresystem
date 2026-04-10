
"use client";

import { useMemo, useState } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useUser, useFirebase, useCollectionOnce, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { type MovimientoMaquina, type Dato } from '@/lib/data';
import { Loader2, ArrowLeftRight, ShieldAlert, Building2, Landmark, Search, Calendar, MapPin, Truck, Undo2, FileWarning } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { formatDateToDDMMYYYY, cn } from '@/lib/utils';

export default function InformeMovimientosDenunciasPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const [search, setSearch] = useState('');

  const profile = user?.profile;

  const movementsQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !profile) return null;
    const colRef = collection(firestore, 'movimientos-maquinas');
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

  const { data: movements, isLoading: isLoadingMovs } = useCollectionOnce<MovimientoMaquina>(movementsQuery);

  const denunciasQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'denuncias-lacres');
  }, [firestore]);

  const { data: denuncias } = useCollectionOnce<any>(denunciasQuery);

  const groupedData = useMemo(() => {
    if (!movements) return [];
    
    const term = search.toLowerCase().trim();
    const filtered = movements.filter(m => {
        const place = (m.departamento || '') + ' ' + (m.distrito || '');
        const responsiblesStr = m.responsables?.map(r => r.nombre).join(' ') || '';
        const machinesStr = m.maquinas?.map(maq => maq.codigo).join(' ') || '';
        
        return place.toLowerCase().includes(term) || 
               responsiblesStr.toLowerCase().includes(term) || 
               machinesStr.toLowerCase().includes(term);
    }).sort((a, b) => b.fecha_creacion.localeCompare(a.fecha_creacion));

    const depts: Record<string, Record<string, MovimientoMaquina[]>> = {};

    filtered.forEach(m => {
      const dpt = m.departamento || 'SIN DEPARTAMENTO';
      const dst = m.distrito || 'SIN DISTRITO';
      if (!depts[dpt]) depts[dpt] = {};
      if (!depts[dpt][dst]) depts[dpt][dst] = [];
      depts[dpt][dst].push(m);
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
  }, [movements, search]);

  if (isUserLoading || isLoadingMovs) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Trazabilidad Logística" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-primary uppercase leading-none">Control de Movimientos</h1>
                <p className="text-muted-foreground text-[10px] font-bold uppercase flex items-center gap-2 mt-2 tracking-widest">
                    <ArrowLeftRight className="h-3.5 w-3.5" /> Auditoría de equipos y detección de irregularidades
                </p>
            </div>
            <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                <Input 
                    placeholder="Buscar local o responsable..." 
                    className="h-12 pl-10 font-bold border-2 rounded-2xl bg-white shadow-sm"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>
        </div>

        {groupedData.length === 0 ? (
            <Card className="p-20 text-center border-dashed bg-white rounded-[2.5rem]">
                <div className="flex flex-col items-center justify-center opacity-20">
                    <Truck className="h-20 w-20 mb-4" />
                    <p className="font-black uppercase tracking-widest text-sm">No hay registros de movimientos</p>
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
                                        {dept.districts.length} DISTRITOS ACTIVOS
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
                                        <AccordionContent className="pt-6 px-2 space-y-4">
                                            {dist.items.map(mov => {
                                                const hasDenuncia = denuncias?.some(d => d.solicitud_id === mov.solicitud_id);
                                                
                                                return (
                                                    <Card key={mov.id} className={cn(
                                                        "border-2 shadow-md transition-all rounded-2xl overflow-hidden",
                                                        hasDenuncia ? "border-destructive bg-destructive/[0.03]" : "border-muted/20 bg-white"
                                                    )}>
                                                        <div className="flex flex-col md:flex-row">
                                                            {/* INDICADOR LATERAL */}
                                                            <div className={cn(
                                                                "w-full md:w-2 min-h-[4px]",
                                                                hasDenuncia ? "bg-destructive" : "bg-primary/20"
                                                            )} />
                                                            
                                                            <div className="flex-1 p-6">
                                                                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                                                                    <div className="md:col-span-4 space-y-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <MapPin className="h-4 w-4 text-muted-foreground" />
                                                                            <span className="font-black uppercase text-[11px] truncate">{mov.departamento} - {mov.distrito}</span>
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {mov.maquinas?.map((maq, i) => (
                                                                                <Badge key={i} variant="outline" className={cn(
                                                                                    "font-black text-[9px] uppercase whitespace-nowrap",
                                                                                    hasDenuncia && (maq.lacre_estado === 'violentado') ? "border-destructive text-destructive bg-destructive/5" : "border-primary/20"
                                                                                )}>
                                                                                    {maq.codigo}
                                                                                </Badge>
                                                                            ))}
                                                                        </div>
                                                                    </div>

                                                                    <div className="md:col-span-3 space-y-1">
                                                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">RESPONSABLES</p>
                                                                        {mov.responsables?.map((resp, i) => (
                                                                            <div key={i} className="leading-tight">
                                                                                <p className="font-black text-[10px] uppercase truncate">{resp.nombre}</p>
                                                                                <p className="text-[8px] font-bold text-muted-foreground">C.I. {resp.cedula}</p>
                                                                            </div>
                                                                        ))}
                                                                    </div>

                                                                    <div className="md:col-span-3 grid grid-cols-2 gap-4">
                                                                        <div className="space-y-1">
                                                                            <div className="flex items-center gap-1.5 text-blue-600">
                                                                                <Truck className="h-3 w-3" />
                                                                                <span className="text-[9px] font-black uppercase">SALIDA</span>
                                                                            </div>
                                                                            <p className="text-[10px] font-bold">{mov.fecha_salida ? `${formatDateToDDMMYYYY(mov.fecha_salida)} ${mov.hora_salida} HS` : '---'}</p>
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <div className="flex items-center gap-1.5 text-green-600">
                                                                                <Undo2 className="h-3 w-3" />
                                                                                <span className="text-[9px] font-black uppercase">REGRESO</span>
                                                                            </div>
                                                                            <p className="text-[10px] font-bold">{mov.fecha_devolucion ? `${formatDateToDDMMYYYY(mov.fecha_devolucion)} ${mov.hora_devolucion} HS` : '---'}</p>
                                                                        </div>
                                                                    </div>

                                                                    <div className="md:col-span-2 flex justify-end">
                                                                        {hasDenuncia ? (
                                                                            <div className="bg-destructive text-white px-4 py-2 rounded-xl flex items-center gap-2 animate-pulse">
                                                                                <FileWarning className="h-4 w-4" />
                                                                                <span className="text-[9px] font-black uppercase tracking-tighter">DENUNCIA ACTIVA</span>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="bg-green-100 text-green-700 px-4 py-2 rounded-xl flex items-center gap-2">
                                                                                <ShieldAlert className="h-4 w-4 opacity-40" />
                                                                                <span className="text-[9px] font-black uppercase">SIN IRREGULARIDAD</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </Card>
                                                );
                                            })}
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
                * El sistema resalta en rojo los movimientos vinculados a denuncias oficiales de lacres violentados.
            </p>
        </div>
      </main>
    </div>
  );
}
