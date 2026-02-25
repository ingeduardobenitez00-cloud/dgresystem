"use client";

import { useState, useMemo, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { type SolicitudCapacitacion, type Dato, type Divulgador, type MovimientoMaquina, type InformeDivulgador } from '@/lib/data';
import { Loader2, MapPin, Calendar, Clock, UserPlus, QrCode, Building2, LayoutList, Globe, UserCheck, Search, ChevronRight, Copy, Check, AlertTriangle, FileWarning, PackageSearch, CalendarX, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { formatDateToDDMMYYYY, cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Image from 'next/image';
import { Textarea } from '@/components/ui/textarea';

export default function AgendaCapacitacionPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [assigningSolicitud, setAssigningSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [qrSolicitud, setQrSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [cancellingSolicitud, setCancellingSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [divulSearch, setDivulSearch] = useState('');
  const [copied, setCopied] = useState(false);

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

  const movimientosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'movimientos-maquinas') : null, [firestore]);
  const { data: movimientosData } = useCollection<MovimientoMaquina>(movimientosQuery);

  const informesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'informes-divulgador') : null, [firestore]);
  const { data: informesData } = useCollection<InformeDivulgador>(informesQuery);

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

  // Agrupación jerárquica con LÓGICA DE ALERTA Y ARCHIVO
  const groupedData = useMemo(() => {
    if (!rawSolicitudes || !datosData) return [];

    const today = new Date().toISOString().split('T')[0];

    // LÓGICA: Mostrar si es futura O si es pasada pero le falta algo (Devolución o Informe)
    // EXCLUIR CANCELADAS
    const activeSolicitudes = rawSolicitudes.filter(sol => {
        if (sol.cancelada) return false;

        const mov = movimientosData?.find(m => m.solicitud_id === sol.id);
        const inf = informesData?.find(i => i.solicitud_id === sol.id);
        
        const isPast = sol.fecha < today;
        const isClosed = mov?.devolucion && inf;

        // Se ARCHIVA (no se muestra aquí) si pasó la fecha Y está todo cerrado
        const shouldArchive = isPast && isClosed;
        return !shouldArchive;
    });

    const depts: Record<string, { label: string, code: string, dists: Record<string, { label: string, code: string, items: SolicitudCapacitacion[] }> }> = {};

    activeSolicitudes.forEach(sol => {
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
  }, [rawSolicitudes, datosData, movimientosData, informesData]);

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

  const handleConfirmCancel = () => {
    if (!cancellingSolicitud || !firestore || !cancelReason.trim()) return;
    setIsUpdating(true);
    
    const updateData = {
        cancelada: true,
        motivo_cancelacion: cancelReason.toUpperCase(),
        fecha_cancelacion: new Date().toISOString(),
        usuario_cancelacion: user?.profile?.username || ''
    };

    const docRef = doc(firestore, 'solicitudes-capacitacion', cancellingSolicitud.id);
    
    updateDoc(docRef, updateData)
        .then(() => {
            toast({ title: "Actividad Cancelada", description: "El registro se ha movido al archivo." });
            setCancellingSolicitud(null);
            setCancelReason('');
            setIsUpdating(false);
        })
        .catch(async (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: updateData }));
            setIsUpdating(false);
        });
  };

  const surveyUrl = useMemo(() => {
    if (typeof window === 'undefined' || !qrSolicitud) return '';
    return `${window.location.origin}/encuesta-satisfaccion?solicitudId=${qrSolicitud.id}`;
  }, [qrSolicitud]);

  const qrImageUrl = useMemo(() => {
    if (!surveyUrl) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(surveyUrl)}`;
  }, [surveyUrl]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Enlace copiado" });
  };

  if (isUserLoading || isLoadingSolicitudes || isLoadingDivul) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Agenda de Capacitaciones" />
      
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-full bg-white font-black uppercase text-[9px] border-none shadow-sm gap-2">
                    <LayoutList className="h-3 w-3" /> GESTIÓN DE ACTIVIDADES
                </Button>
                <Button size="sm" className="rounded-full bg-[#2563EB] hover:bg-blue-700 font-black uppercase text-[9px] shadow-sm gap-2">
                    <Globe className="h-3 w-3" /> VISTA GLOBAL
                </Button>
            </div>
            <div className="bg-white px-4 py-2 rounded-full border border-dashed flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                <span className="text-[9px] font-black uppercase text-muted-foreground">ALERTAS DE INCUMPLIMIENTO ACTIVAS</span>
            </div>
        </div>

        {groupedData.length === 0 ? (
          <Card className="p-20 text-center border-dashed bg-white rounded-3xl">
            <p className="font-black text-muted-foreground uppercase tracking-widest opacity-30">No hay actividades agendadas en su jurisdicción</p>
          </Card>
        ) : (
          <Accordion type="multiple" className="space-y-6">
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
                            {Object.values(dept.dists).length} DISTRITOS CON ACTIVIDADES
                        </p>
                    </div>
                  </div>
                </AccordionTrigger>
                
                <AccordionContent className="px-8 pb-8 pt-2">
                  <Accordion type="multiple" className="space-y-4">
                    {Object.values(dept.dists).map((dist) => (
                      <AccordionItem key={dist.label} value={dist.label} className="border-none">
                        <AccordionTrigger className="hover:no-underline py-4 bg-[#F8F9FA] rounded-2xl px-6 group border border-dashed">
                            <div className="flex items-center gap-3">
                                <Building2 className="h-5 w-5 text-[#1A1A1A]" />
                                <h3 className="font-black uppercase text-sm tracking-tight text-primary/80">
                                    {dist.code} {dist.label}
                                </h3>
                                <Badge variant="secondary" className="bg-black text-white text-[8px] font-black px-2">
                                    {dist.items.length}
                                </Badge>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-6 space-y-4 px-2">
                            {dist.items.sort((a,b) => a.fecha.localeCompare(b.fecha)).map((item) => {
                                const today = new Date().toISOString().split('T')[0];
                                const isPast = item.fecha < today;
                                const mov = movimientosData?.find(m => m.solicitud_id === item.id);
                                const inf = informesData?.find(i => i.solicitud_id === item.id);
                                
                                const missingReturn = !mov?.devolucion;
                                const missingReport = !inf;
                                const hasAlert = isPast && (missingReturn || missingReport);

                                return (
                                    <Card 
                                        key={item.id} 
                                        className={cn(
                                            "border-2 shadow-sm rounded-2xl transition-all relative overflow-hidden",
                                            hasAlert ? "border-destructive/40 bg-destructive/[0.02] ring-1 ring-destructive/20" : "border-muted/20 bg-white"
                                        )}
                                    >
                                        <CardContent className="p-8">
                                            {hasAlert && (
                                                <div className="mb-6 bg-destructive text-white px-4 py-2 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                                                    <div className="flex items-center gap-3">
                                                        <FileWarning className="h-5 w-5" />
                                                        <span className="font-black uppercase text-[10px] tracking-widest">ALERTA DE INCUMPLIMIENTO: ACTIVIDAD VENCIDA</span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        {missingReturn && <Badge className="bg-white text-destructive font-black text-[8px] uppercase">PENDIENTE DEVOLUCIÓN</Badge>}
                                                        {missingReport && <Badge className="bg-white text-destructive font-black text-[8px] uppercase">PENDIENTE INFORME</Badge>}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                                                
                                                {/* Columna 1: Solicitante */}
                                                <div className="lg:col-span-4 space-y-3">
                                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">SOLICITANTE</p>
                                                    <p className="font-black text-base uppercase leading-tight text-[#1A1A1A]">{item.solicitante_entidad || item.otra_entidad}</p>
                                                    <Badge variant="secondary" className="bg-[#E2E8F0] text-[#475569] font-black uppercase text-[9px] tracking-widest px-3 py-1 rounded-md">
                                                        {item.tipo_solicitud}
                                                    </Badge>
                                                </div>

                                                {/* Columna 2: Ubicación y Fecha */}
                                                <div className="lg:col-span-3 space-y-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-full bg-muted/30 flex items-center justify-center">
                                                            <MapPin className="h-4 w-4 text-muted-foreground" />
                                                        </div>
                                                        <p className="font-black text-[12px] uppercase text-[#1A1A1A]">{item.lugar_local}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn("h-8 w-8 rounded-full flex items-center justify-center", hasAlert ? "bg-destructive/20" : "bg-muted/30")}>
                                                            <Calendar className={cn("h-4 w-4", hasAlert ? "text-destructive" : "text-muted-foreground")} />
                                                        </div>
                                                        <p className={cn("font-black text-[12px] uppercase", hasAlert ? "text-destructive" : "text-[#1A1A1A]")}>
                                                            {formatDateToDDMMYYYY(item.fecha)} | {item.hora_desde} HS
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Columna 3: Divulgador */}
                                                <div className="lg:col-span-2 space-y-2">
                                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">DIVULGADOR ASIGNADO</p>
                                                    {item.divulgador_nombre ? (
                                                        <div className="flex items-center gap-2 text-[#16A34A]">
                                                            <UserCheck className="h-5 w-5" />
                                                            <p className="font-black text-[13px] uppercase">{item.divulgador_nombre}</p>
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs font-black text-destructive italic uppercase">SIN ASIGNAR</p>
                                                    )}
                                                </div>

                                                {/* Columna 4: Acciones */}
                                                <div className="lg:col-span-3 flex flex-col items-end gap-3">
                                                    <div className="flex gap-2 w-full max-w-[180px]">
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            className="h-11 flex-1 rounded-xl font-black uppercase text-[11px] border-2 gap-2 bg-white hover:bg-muted/10"
                                                            onClick={() => setAssigningSolicitud(item)}
                                                        >
                                                            <UserPlus className="h-4 w-4" /> {item.divulgador_nombre ? 'REASIGNAR' : 'ASIGNAR'}
                                                        </Button>
                                                        <Button 
                                                            variant="outline" 
                                                            size="icon" 
                                                            className="h-11 w-11 rounded-xl border-2 border-destructive/20 text-destructive hover:bg-destructive hover:text-white transition-all"
                                                            onClick={() => setCancellingSolicitud(item)}
                                                            title="Anular Actividad"
                                                        >
                                                            <CalendarX className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    
                                                    <div className="flex gap-2 w-full max-w-[180px]">
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            className="h-11 flex-1 rounded-xl font-black uppercase text-[10px] border-2 gap-2 bg-white hover:bg-muted/10"
                                                            onClick={() => setQrSolicitud(item)}
                                                        >
                                                            <QrCode className="h-4 w-4" />
                                                        </Button>

                                                        <Link href={`/informe-divulgador?solicitudId=${item.id}`} className="flex-1">
                                                            <Button className={cn(
                                                                "h-11 w-full rounded-xl font-black uppercase text-[11px] shadow-lg",
                                                                missingReport && isPast ? "bg-destructive hover:bg-destructive/90 text-white" : "bg-black hover:bg-black/90 text-white"
                                                            )}>
                                                                INFORME
                                                            </Button>
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
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
      </main>

      {/* Dialogo para Asignar Personal */}
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

      {/* Dialogo para Cancelar Actividad */}
      <Dialog open={!!cancellingSolicitud} onOpenChange={(o) => !o && setCancellingSolicitud(null)}>
        <DialogContent className="max-w-md rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-destructive text-white p-8">
            <DialogTitle className="font-black uppercase tracking-widest text-center text-sm flex items-center justify-center gap-3">
                <CalendarX className="h-5 w-5" /> ANULAR ACTIVIDAD DE AGENDA
            </DialogTitle>
            <DialogDescription className="text-white/60 text-[10px] font-bold text-center uppercase mt-2">Esta acción moverá el registro al archivo con estado suspendido</DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-6 bg-white">
            <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">MOTIVO DE LA ANULACIÓN (OBLIGATORIO)</Label>
                <Textarea 
                    placeholder="Ej: Suspensión por inclemencia del tiempo, pedido del apoderado, etc..." 
                    className="min-h-[120px] font-bold border-2 rounded-xl uppercase"
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
                />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="h-12 rounded-xl font-black uppercase text-[10px] border-2" onClick={() => setCancellingSolicitud(null)}>CANCELAR</Button>
                <Button 
                    className="h-12 rounded-xl font-black uppercase text-[10px] bg-destructive hover:bg-destructive/90 shadow-lg" 
                    disabled={!cancelReason.trim() || isUpdating}
                    onClick={handleConfirmCancel}
                >
                    {isUpdating ? <Loader2 className="animate-spin h-4 w-4" /> : "CONFIRMAR ANULACIÓN"}
                </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialogo para Código QR de Encuesta */}
      <Dialog open={!!qrSolicitud} onOpenChange={(o) => !o && setQrSolicitud(null)}>
        <DialogContent className="max-w-sm rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-primary p-8 text-white">
            <DialogTitle className="font-black uppercase text-center tracking-widest text-lg">ENCUESTA DE SATISFACCIÓN</DialogTitle>
            <DialogDescription className="text-white/60 font-bold text-[10px] text-center uppercase mt-2">Escanee para registrar feedback ciudadano</DialogDescription>
          </DialogHeader>
          <div className="p-10 flex flex-col items-center bg-white space-y-8">
            <div className="p-4 bg-white border-4 border-muted/20 rounded-[2rem] shadow-inner relative group">
                {qrSolicitud && (
                    <Image 
                        src={qrImageUrl} 
                        alt="QR Encuesta" 
                        width={220} 
                        height={220} 
                        className="rounded-xl"
                    />
                )}
            </div>
            
            <div className="text-center space-y-2">
                <p className="font-black uppercase text-sm text-primary">{qrSolicitud?.lugar_local}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    {qrSolicitud ? formatDateToDDMMYYYY(qrSolicitud.fecha) : ''}
                </p>
            </div>

            <div className="w-full space-y-3">
                <Button 
                    variant="outline" 
                    className="w-full h-12 rounded-xl font-black uppercase text-[10px] border-2 gap-2"
                    onClick={copyToClipboard}
                >
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    {copied ? "COPIADO" : "COPIAR ENLACE MANUAL"}
                </Button>
                <Button 
                    className="w-full h-12 rounded-xl font-black uppercase text-[10px] bg-black text-white hover:bg-black/90"
                    onClick={() => setQrSolicitud(null)}
                >
                    CERRAR VENTANA
                </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
