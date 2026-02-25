
"use client";

import { useState, useMemo, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { type SolicitudCapacitacion, type Dato, type Divulgador } from '@/lib/data';
import { Loader2, MapPin, Calendar, Clock, UserPlus, QrCode, Building2, LayoutList, Globe, UserCheck, Search, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { formatDateToDDMMYYYY } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';

export default function AgendaCapacitacionPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [assigningSolicitud, setAssigningSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [divulSearch, setDivulSearch] = useState('');

  const profile = user?.profile;

  // Permisos de filtrado
  const hasAdminFilter = useMemo(() => 
    ['admin', 'director'].includes(profile?.role || '') || profile?.permissions?.includes('admin_filter'),
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

  // Queries
  const solicitudesQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !profile) return null;
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    if (hasAdminFilter) return colRef;
    if (hasDeptFilter && profile.departamento) return query(colRef, where('departamento', '==', profile.departamento));
    if (hasDistFilter && profile.departamento && profile.distrito) {
        return query(colRef, where('departamento', '==', profile.departamento), where('distrito', '==', profile.distrito));
    }
    return null;
  }, [firestore, isUserLoading, profile, hasAdminFilter, hasDeptFilter, hasDistFilter]);

  const { data: rawSolicitudes, isLoading: isLoadingSolicitudes } = useCollection<SolicitudCapacitacion>(solicitudesQuery);

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData } = useCollection<Dato>(datosQuery);

  const divulgadoresQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !profile) return null;
    const colRef = collection(firestore, 'divulgadores');
    if (hasAdminFilter) return colRef;
    if (hasDeptFilter && profile.departamento) return query(colRef, where('departamento', '==', profile.departamento));
    if (hasDistFilter && profile.departamento && profile.distrito) {
      return query(colRef, where('departamento', '==', profile.departamento), where('distrito', '==', profile.distrito));
    }
    return null;
  }, [firestore, isUserLoading, profile, hasAdminFilter, hasDeptFilter, hasDistFilter]);

  const { data: rawDivulgadores, isLoading: isLoadingDivul } = useCollection<Divulgador>(divulgadoresQuery);

  // Agrupación jerárquica
  const groupedData = useMemo(() => {
    if (!rawSolicitudes || !datosData) return [];

    const depts: Record<string, { label: string, code: string, dists: Record<string, { label: string, code: string, items: SolicitudCapacitacion[] }> }> = {};

    rawSolicitudes.forEach(sol => {
      const deptName = sol.departamento;
      const distName = sol.distrito;
      const dato = datosData.find(d => d.departamento === deptName && d.distrito === distName);
      
      const deptCode = dato?.departamento_codigo || '00';
      const distCode = `${deptCode} - 00 - 00 - ${dato?.distrito_codigo || '00'}`;

      if (!depts[deptName]) {
        depts[deptName] = { label: deptName, code: deptCode, dists: {} };
      }
      if (!depts[deptName].dists[distName]) {
        depts[deptName].dists[distName] = { label: distName, code: distCode, items: [] };
      }
      depts[deptName].dists[distName].items.push(sol);
    });

    return Object.values(depts).sort((a, b) => a.code.localeCompare(b.code));
  }, [rawSolicitudes, datosData]);

  const filteredDivul = useMemo(() => {
    if (!rawDivulgadores) return [];
    const term = divulSearch.toLowerCase().trim();
    return rawDivulgadores.filter(d => d.nombre.toLowerCase().includes(term) || d.cedula.includes(term));
  }, [rawDivulgadores, divulSearch]);

  const handleAssignDivulgador = (divulgador: Divulgador) => {
    if (!assigningSolicitud || !firestore) return;
    setIsUpdating(true);
    const updateData = {
      divulgador_id: divulgador.id,
      divulgador_nombre: divulgador.nombre,
      divulgador_cedula: divulgador.cedula,
      divulgador_vinculo: divulgador.vinculo
    };
    const docRef = doc(firestore, 'solicitudes-capacitacion', assigningSolicitud.id);
    
    updateDoc(docRef, updateData)
      .then(() => {
        toast({ title: "Personal Asignado" });
        setAssigningSolicitud(null);
        setIsUpdating(false);
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: updateData }));
        setIsUpdating(false);
      });
  };

  if (isUserLoading || isLoadingSolicitudes || isLoadingDivul) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Agenda de Capacitaciones" />
      
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        <div className="flex gap-2 mb-8">
            <Button variant="outline" size="sm" className="rounded-full bg-white font-black uppercase text-[9px] border-none shadow-sm gap-2">
                <LayoutList className="h-3 w-3" /> GESTIÓN DE ACTIVIDADES
            </Button>
            <Button size="sm" className="rounded-full bg-[#2563EB] hover:bg-blue-700 font-black uppercase text-[9px] shadow-sm gap-2">
                <Globe className="h-3 w-3" /> VISTA GLOBAL
            </Button>
        </div>

        {groupedData.length === 0 ? (
          <Card className="p-20 text-center border-dashed bg-white rounded-3xl">
            <p className="font-black text-muted-foreground uppercase tracking-widest opacity-30">No hay actividades agendadas en su jurisdicción</p>
          </Card>
        ) : (
          <Accordion type="multiple" defaultValue={groupedData.map(d => d.label)} className="space-y-6">
            {groupedData.map((dept) => (
              <AccordionItem key={dept.label} value={dept.label} className="border-none bg-white rounded-[2rem] shadow-sm overflow-hidden">
                <AccordionTrigger className="hover:no-underline px-8 py-6 bg-white group">
                  <div className="flex items-center gap-6 text-left">
                    <div className="h-14 w-14 rounded-full bg-black text-white flex items-center justify-center font-black text-lg shadow-xl">
                        {dept.code}
                    </div>
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight text-[#1A1A1A]">{dept.code} - {dept.label}</h2>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                            {Object.values(dept.dists).reduce((acc, d) => acc + d.items.length, 0)} ACTIVIDADES PROGRAMADAS
                        </p>
                    </div>
                  </div>
                </AccordionTrigger>
                
                <AccordionContent className="px-8 pb-8 pt-2">
                  <Accordion type="multiple" className="space-y-4">
                    {Object.values(dept.dists).map((dist) => (
                      <AccordionItem key={dist.label} value={dist.label} className="border-none bg-muted/5 rounded-2xl overflow-hidden px-2">
                        <AccordionTrigger className="hover:no-underline py-4 px-4 group/dist">
                          <div className="flex items-center gap-3">
                            <Building2 className="h-5 w-5 text-[#1A1A1A]" />
                            <h3 className="font-black uppercase text-sm tracking-tight text-primary/80 group-hover/dist:text-primary transition-colors">
                              {dist.code} {dist.label} <span className="ml-2 text-[10px] font-bold text-muted-foreground">({dist.items.length})</span>
                            </h3>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-6 space-y-4">
                          {dist.items.sort((a,b) => a.fecha.localeCompare(b.fecha)).map((item) => (
                            <Card key={item.id} className="border-none shadow-sm bg-white rounded-2xl hover:shadow-md transition-all">
                                <CardContent className="p-6">
                                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-center">
                                        <div className="space-y-2">
                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">SOLICITANTE</p>
                                            <p className="font-black text-sm uppercase leading-tight">{item.solicitante_entidad || item.otra_entidad}</p>
                                            <Badge variant="secondary" className="bg-[#F1F5F9] text-[#475569] font-black uppercase text-[8px] tracking-widest px-2 py-0.5">
                                                {item.tipo_solicitud}
                                            </Badge>
                                        </div>

                                        <div className="lg:col-span-1 space-y-3">
                                            <div className="flex items-center gap-3">
                                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                                <p className="font-black text-[11px] uppercase truncate">{item.lugar_local}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                <p className="font-black text-[11px] uppercase">{formatDateToDDMMYYYY(item.fecha)} | {item.hora_desde} HS</p>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">DIVULGADOR ASIGNADO</p>
                                            {item.divulgador_nombre ? (
                                                <div className="flex items-center gap-2 text-[#16A34A]">
                                                    <UserCheck className="h-4 w-4" />
                                                    <p className="font-black text-xs uppercase">{item.divulgador_nombre}</p>
                                                </div>
                                            ) : (
                                                <p className="text-xs font-black text-destructive italic uppercase">SIN ASIGNAR</p>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap justify-end gap-2">
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="h-10 px-4 rounded-xl font-black uppercase text-[10px] border-2 gap-2"
                                                onClick={() => setAssigningSolicitud(item)}
                                            >
                                                <UserPlus className="h-3.5 w-3.5" /> {item.divulgador_nombre ? 'REASIGNAR' : 'ASIGNAR'}
                                            </Button>
                                            
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="h-10 px-4 rounded-xl font-black uppercase text-[10px] border-2 gap-2"
                                            >
                                                <QrCode className="h-3.5 w-3.5" /> QR ENCUESTA
                                            </Button>

                                            <Link href={`/informe-divulgador?solicitudId=${item.id}`}>
                                                <Button className="h-10 px-6 rounded-xl font-black uppercase text-[10px] bg-black hover:bg-black/90 shadow-lg">
                                                    INFORME
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                          ))}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </main>

      <Dialog open={!!assigningSolicitud} onOpenChange={(o) => !o && setAssigningSolicitud(null)}>
        <DialogContent className="max-w-md rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-black text-white p-6">
            <DialogTitle className="font-black uppercase tracking-widest text-sm flex items-center gap-2">
                <UserPlus className="h-4 w-4" /> ASIGNAR PERSONAL OPERATIVO
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4 bg-white">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Buscar por nombre o cédula..." 
                    value={divulSearch} 
                    onChange={e => setDivulSearch(e.target.value)} 
                    className="h-12 pl-10 font-bold border-2 rounded-xl"
                />
            </div>
            <ScrollArea className="h-[350px] pr-2">
              {filteredDivul.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-20">
                    <UserPlus className="h-12 w-12 mb-2" />
                    <p className="text-[10px] font-black uppercase">No se encontró personal</p>
                </div>
              ) : (
                <div className="space-y-2">
                    {filteredDivul.map(d => (
                    <div 
                        key={d.id} 
                        className="p-4 border-2 rounded-2xl cursor-pointer hover:bg-black hover:text-white hover:border-black transition-all group" 
                        onClick={() => handleAssignDivulgador(d)}
                    >
                        <p className="font-black text-xs uppercase">{d.nombre}</p>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-[8px] font-black bg-muted group-hover:bg-white/20 group-hover:text-white">C.I. {d.cedula}</Badge>
                            <span className="text-[9px] font-bold text-muted-foreground uppercase group-hover:text-white/60">{d.vinculo}</span>
                        </div>
                    </div>
                    ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
