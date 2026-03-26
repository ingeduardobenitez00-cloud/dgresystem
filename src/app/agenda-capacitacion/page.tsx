
"use client";

import { useState, useMemo, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { type SolicitudCapacitacion, type Dato, type Divulgador, type MovimientoMaquina, type InformeDivulgador, type Asignado } from '@/lib/data';
import { Loader2, MapPin, Calendar, Clock, UserPlus, QrCode, Building2, LayoutList, Globe, UserCheck, Search, ChevronRight, Copy, Check, AlertTriangle, FileWarning, PackageSearch, CalendarX, Trash2, FileDown, Printer, Power, UserMinus, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
import { Label } from '@/components/ui/label';
import jsPDF from 'jspdf';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from '@/components/ui/separator';

export default function AgendaCapacitacionPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [assigningSolicitud, setAssigningSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [qrSolicitud, setQrSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [cancellingSolicitud, setCancellingSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [deletingSolicitud, setDeletingSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [divulSearch, setDivulSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  const profile = user?.profile;

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const response = await fetch('/logo.png');
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => setLogoBase64(reader.result as string);
        reader.readAsDataURL(blob);
      } catch (error) {
        console.error("Error fetching logo:", error);
      }
    };
    fetchLogo();
  }, []);

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

  const { data: rawDivulgadores, isLoading: isLoadingDivul } = useCollection<Divulgador>(divuladoresQuery);

  const groupedHierarchy = useMemo(() => {
    if (!rawSolicitudes || !datosData) return [];

    const depts: Record<string, { label: string, code: string, dists: Record<string, { label: string, code: string, batches: Record<string, { solicitor: string, local: string, type: string, items: SolicitudCapacitacion[] }> }> }> = {};

    rawSolicitudes.forEach(sol => {
      const deptName = sol.departamento || 'SIN DEPARTAMENTO';
      const distName = sol.distrito || 'SIN DISTRITO';
      const dato = datosData.find(d => d.departamento === deptName && d.distrito === distName);
      
      const deptCode = dato?.departamento_codigo || '00';
      const distCode = `${deptCode} - 00 - 00 - ${dato?.distrito_codigo || '00'}`;

      if (!depts[deptName]) depts[deptName] = { label: deptName, code: deptCode, dists: {} };
      if (!depts[deptName].dists[distName]) depts[deptName].dists[distName] = { label: distName, code: distCode, batches: {} };

      const batchKey = `${sol.solicitante_entidad || sol.otra_entidad}-${sol.lugar_local}`;
      if (!depts[deptName].dists[distName].batches[batchKey]) {
        depts[deptName].dists[distName].batches[batchKey] = {
            solicitor: sol.solicitante_entidad || sol.otra_entidad || '',
            local: sol.lugar_local,
            type: sol.tipo_solicitud,
            items: []
        };
      }
      depts[deptName].dists[distName].batches[batchKey].items.push(sol);
    });

    return Object.values(depts).sort((a, b) => a.code.localeCompare(b.code));
  }, [rawSolicitudes, datosData]);

  const filteredDivul = useMemo(() => {
    if (!rawDivulgadores || !assigningSolicitud) return [];
    const term = divulSearch.toLowerCase().trim();
    return rawDivulgadores.filter(d => 
      d.distrito === assigningSolicitud.distrito &&
      (d.nombre.toLowerCase().includes(term) || d.cedula.includes(term))
    );
  }, [rawDivulgadores, divulSearch, assigningSolicitud]);

  const handleToggleQR = (item: SolicitudCapacitacion) => {
    if (!firestore) return;
    const newStatus = !item.qr_habilitado;
    const docRef = doc(firestore, 'solicitudes-capacitacion', item.id);
    updateDoc(docRef, { qr_habilitado: newStatus })
        .then(() => toast({ title: newStatus ? "QR Habilitado" : "QR Desactivado" }))
        .catch(async () => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update' })));
  };

  const handleAddDivulgador = (divulgador: Divulgador) => {
    if (!assigningSolicitud || !firestore) return;
    setIsUpdating(true);
    
    const newAsignado: Asignado = {
      id: divulgador.id,
      nombre: divulgador.nombre,
      cedula: divulgador.cedula,
      vinculo: divulgador.vinculo
    };

    const docRef = doc(firestore, 'solicitudes-capacitacion', assigningSolicitud.id);
    
    updateDoc(docRef, {
      asignados: arrayUnion(newAsignado)
    })
      .then(() => {
        toast({ title: "Personal Sumado al Equipo" });
        setIsUpdating(false);
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update' }));
        setIsUpdating(false);
      });
  };

  const handleRemoveDivulgador = (solId: string, asignado: Asignado) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'solicitudes-capacitacion', solId);
    updateDoc(docRef, {
        asignados: arrayRemove(asignado)
    }).then(() => toast({ title: "Personal removido" }));
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
            toast({ title: "Actividad Cancelada" });
            setCancellingSolicitud(null);
            setCancelReason('');
            setIsUpdating(false);
        })
        .catch(async (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: updateData }));
            setIsUpdating(false);
        });
  };

  const handleConfirmDelete = () => {
    if (!deletingSolicitud || !firestore) return;
    setIsUpdating(true);
    const docRef = doc(firestore, 'solicitudes-capacitacion', deletingSolicitud.id);
    deleteDoc(docRef)
        .then(() => {
            toast({ title: "Actividad Eliminada" });
            setDeletingSolicitud(null);
            setIsUpdating(false);
        })
        .catch(async (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' }));
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

  const generateQrPDF = async () => {
    if (!qrSolicitud || !logoBase64) return;
    setIsGeneratingPdf(true);
    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        doc.addImage(logoBase64, 'PNG', 20, 10, 25, 25);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text("JUSTICIA ELECTORAL", pageWidth / 2, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.text("SISTEMA DE DIVULGACION", pageWidth / 2, 28, { align: 'center' });
        doc.setLineWidth(0.5);
        doc.line(20, 40, pageWidth - 20, 40);
        doc.setFontSize(18);
        doc.text("CÓDIGO QR - ENCUESTA DE SATISFACCIÓN", pageWidth / 2, 55, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`LOCAL: ${qrSolicitud.lugar_local.toUpperCase()}`, pageWidth / 2, 75, { align: 'center' });
        doc.text(`DISTRITO: ${qrSolicitud.distrito.toUpperCase()} | DEPTO: ${qrSolicitud.departamento.toUpperCase()}`, pageWidth / 2, 83, { align: 'center' });
        doc.text(`FECHA: ${formatDateToDDMMYYYY(qrSolicitud.fecha)} | HORARIO: ${qrSolicitud.hora_desde} HS.`, pageWidth / 2, 91, { align: 'center' });
        const response = await fetch(qrImageUrl);
        const blob = await response.blob();
        const qrBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
        const qrSize = 100;
        doc.addImage(qrBase64, 'PNG', (pageWidth - qrSize) / 2, 105, qrSize, qrSize);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text("Instrucciones: Escanee este código con la cámara de su teléfono", pageWidth / 2, 220, { align: 'center' });
        doc.text("para acceder al formulario oficial de satisfacción ciudadana.", pageWidth / 2, 226, { align: 'center' });
        doc.setLineWidth(0.2);
        doc.setDrawColor(200);
        doc.line(40, 240, pageWidth - 40, 240);
        doc.setFontSize(8);
        doc.text("CUSTODIO DE LA VOLUNTAD POPULAR - REPÚBLICA DEL PARAGUAY", pageWidth / 2, 250, { align: 'center' });
        doc.save(`QR-Encuesta-${qrSolicitud.lugar_local.replace(/\s+/g, '-')}.pdf`);
        toast({ title: "PDF Generado con éxito" });
    } catch (error) {
        toast({ variant: 'destructive', title: "Error al generar PDF" });
    } finally {
        setIsGeneratingPdf(false);
    }
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
                <span className="text-[9px] font-black uppercase text-muted-foreground">ALERTAS ACTIVAS</span>
            </div>
        </div>

        {groupedHierarchy.length === 0 ? (
          <Card className="p-20 text-center border-dashed bg-white rounded-3xl">
            <p className="font-black text-muted-foreground uppercase tracking-widest opacity-30">No hay actividades agendadas en su jurisdicción</p>
          </Card>
        ) : (
          <Accordion type="multiple" className="space-y-6">
            {groupedHierarchy.map((dept) => (
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
                  <Accordion type="multiple" className="space-y-8">
                    {Object.values(dept.dists).map((dist) => (
                      <AccordionItem key={dist.label} value={dist.label} className="border-none">
                        <AccordionTrigger className="hover:no-underline py-4 bg-[#F8F9FA] rounded-2xl px-6 group border border-dashed">
                            <div className="flex items-center gap-3">
                                <Building2 className="h-5 w-5 text-[#1A1A1A]" />
                                <h3 className="font-black uppercase text-sm tracking-tight text-primary/80">
                                    {dist.code} {dist.label}
                                </h3>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-8 px-4 space-y-12">
                            {Object.values(dist.batches).map((batch, bIdx) => (
                                <div key={bIdx} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative">
                                    {/* COLUMNA IZQUIERDA: INFO DEL LOTE / SOLICITANTE */}
                                    <div className="lg:col-span-3 space-y-6 sticky top-24">
                                        <div className="flex items-center gap-2 mb-2">
                                            <MapPin className="h-4 w-4 text-primary" />
                                            <h4 className="font-black text-lg uppercase leading-tight tracking-tight">{batch.local}</h4>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.2em]">SOLICITANTE</p>
                                                <p className="font-black text-xs uppercase leading-tight text-[#1A1A1A]">{batch.solicitor}</p>
                                            </div>
                                            <Badge variant="secondary" className="bg-[#E2E8F0] text-[#475569] font-black uppercase text-[8px] tracking-widest px-3 py-1 rounded-md">
                                                {batch.type}
                                            </Badge>
                                        </div>
                                        <div className="hidden lg:block h-[100px] border-l-2 border-dashed border-muted-foreground/20 ml-2" />
                                    </div>

                                    {/* COLUMNA DERECHA: TARJETAS DE FECHAS */}
                                    <div className="lg:col-span-9 space-y-4">
                                        {batch.items.sort((a,b) => a.fecha.localeCompare(b.fecha)).map((item) => {
                                            const today = new Date().toISOString().split('T')[0];
                                            const isPast = item.fecha < today;
                                            const mov = movimientosData?.find(m => m.solicitud_id === item.id);
                                            const inf = informesData?.find(i => i.solicitud_id === item.id);
                                            const hasAlert = isPast && (!mov?.foto_devolucion || !inf);

                                            return (
                                                <Card key={item.id} className={cn(
                                                    "border-2 shadow-sm rounded-[1.5rem] relative overflow-hidden transition-all", 
                                                    hasAlert ? "border-destructive/40 bg-destructive/[0.02]" : "border-muted/20 bg-white"
                                                )}>
                                                    <CardContent className="p-6">
                                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                                                            
                                                            {/* FECHA Y HORA */}
                                                            <div className="lg:col-span-3 flex items-center gap-3">
                                                                <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", hasAlert ? "bg-destructive/10 text-destructive" : "bg-primary/5 text-primary")}>
                                                                    <Calendar className="h-5 w-5" />
                                                                </div>
                                                                <div>
                                                                    <p className={cn("font-black text-sm uppercase leading-none", hasAlert ? "text-destructive" : "text-[#1A1A1A]")}>
                                                                        {formatDateToDDMMYYYY(item.fecha)}
                                                                    </p>
                                                                    <p className="text-[10px] font-bold text-muted-foreground mt-1">{item.hora_desde} HS</p>
                                                                </div>
                                                            </div>

                                                            {/* PERSONAL ASIGNADO (DINÁMICO) */}
                                                            <div className="lg:col-span-3 space-y-2">
                                                                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.2em]">PERSONAL OPERATIVO</p>
                                                                <div className="space-y-1">
                                                                    {item.asignados && item.asignados.length > 0 ? (
                                                                        item.asignados.map(asig => (
                                                                            <div key={asig.id} className="flex items-center justify-between group/user">
                                                                                <div className="flex items-center gap-2 text-[#16A34A]">
                                                                                    <div className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
                                                                                    <p className="font-black text-[10px] uppercase truncate max-w-[120px]">{asig.nombre}</p>
                                                                                </div>
                                                                                <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover/user:opacity-100 text-destructive" onClick={() => handleRemoveDivulgador(item.id, asig)}>
                                                                                    <UserMinus className="h-3 w-3" />
                                                                                </Button>
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <p className="text-[10px] font-black text-destructive italic uppercase">SIN ASIGNAR</p>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* ESTADO */}
                                                            <div className="lg:col-span-2 flex flex-col items-center justify-center text-center px-4 border-x-2 border-dashed border-muted/20 min-h-[60px]">
                                                                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">ESTADO</p>
                                                                {hasAlert ? (
                                                                    <div className="flex items-center gap-1.5 text-destructive animate-pulse">
                                                                        <AlertCircle className="h-3.5 w-3.5" />
                                                                        <span className="text-[9px] font-black uppercase">INCUMPLIMIENTO</span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-1.5 text-blue-600">
                                                                        <Clock className="h-3.5 w-3.5" />
                                                                        <span className="text-[9px] font-black uppercase">EN AGENDA</span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* ACCIONES DE CONTROL */}
                                                            <div className="lg:col-span-4 flex flex-col gap-2">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <Button variant="outline" size="sm" className="h-10 flex-1 rounded-xl font-black uppercase text-[9px] border-2 gap-2" onClick={() => setAssigningSolicitud(item)}>
                                                                        <UserPlus className="h-3.5 w-3.5" /> {item.asignados && item.asignados.length > 0 ? 'REASIGNAR' : 'ASIGNAR'}
                                                                    </Button>
                                                                    <div className="flex gap-1">
                                                                        <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-2" onClick={() => setQrSolicitud(item)}>
                                                                            <QrCode className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button 
                                                                            variant="outline" 
                                                                            size="icon" 
                                                                            className={cn("h-10 w-10 rounded-xl border-2 transition-all", item.qr_habilitado ? "bg-green-500 text-white border-green-600" : "text-destructive border-destructive/20")} 
                                                                            onClick={() => handleToggleQR(item)}
                                                                        >
                                                                            <Power className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <Button className={cn("h-10 flex-1 rounded-xl font-black uppercase text-[10px] shadow-lg", inf ? "bg-[#16A34A] hover:bg-[#15803D]" : "bg-black hover:bg-black/90")} asChild>
                                                                        <Link href={inf ? '#' : `/informe-divulgador?solicitudId=${item.id}`}>
                                                                            {inf ? 'CUMPLIDO' : 'INFORME'}
                                                                        </Link>
                                                                    </Button>
                                                                    <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-2 border-destructive/10 text-destructive/40 hover:text-destructive" onClick={() => setDeletingSolicitud(item)}>
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </div>
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

      {/* Dialogo para Asignar Personal */}
      <Dialog open={!!assigningSolicitud} onOpenChange={(o) => !o && setAssigningSolicitud(null)}>
        <DialogContent className="max-w-md rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-black text-white p-6">
            <DialogTitle className="font-black uppercase tracking-widest text-sm flex items-center gap-2">
                <UserPlus className="h-4 w-4" /> ASIGNAR PERSONAL - {assigningSolicitud?.distrito?.toUpperCase() || 'SIN DISTRITO'}
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4 bg-white">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nombre o cédula..." value={divulSearch} onChange={e => setDivulSearch(e.target.value)} className="h-12 pl-10 font-bold border-2 rounded-xl" />
            </div>
            
            <div className="p-3 bg-muted/20 rounded-xl">
                <p className="text-[10px] font-black uppercase text-primary mb-2">Equipo Actual ({assigningSolicitud?.asignados?.length || 0})</p>
                <div className="flex flex-wrap gap-2">
                    {assigningSolicitud?.asignados?.map(as => (
                        <Badge key={as.id} variant="secondary" className="bg-white border-2 text-[8px] font-black py-1">
                            {as.nombre}
                        </Badge>
                    ))}
                </div>
            </div>

            <ScrollArea className="h-[300px] pr-2">
              {filteredDivul.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-20 text-center">
                    <UserPlus className="h-12 w-12 mb-2 mx-auto" />
                    <p className="text-[10px] font-black uppercase">No hay personal en este distrito</p>
                </div>
              ) : (
                <div className="space-y-2">
                    {filteredDivul.map(d => (
                    <div key={d.id} className="p-4 border-2 rounded-2xl cursor-pointer hover:bg-black hover:text-white transition-all group flex items-center justify-between" onClick={() => handleAddDivulgador(d)}>
                        <div>
                            <p className="font-black text-xs uppercase">{d.nombre}</p>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-[8px] font-black bg-muted group-hover:bg-white/20">C.I. {d.cedula}</Badge>
                                <span className="text-[9px] font-bold text-muted-foreground uppercase group-hover:text-white/60">{d.vinculo}</span>
                            </div>
                        </div>
                        <Plus className="h-4 w-4 opacity-0 group-hover:opacity-100" />
                    </div>
                    ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialogo para Código QR de Encuesta */}
      <Dialog open={!!qrSolicitud} onOpenChange={(o) => !o && setQrSolicitud(null)}>
        <DialogContent className="max-sm rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-primary p-8 text-white">
            <DialogTitle className="font-black uppercase text-center tracking-widest text-lg">ENCUESTA DE SATISFACCIÓN</DialogTitle>
          </DialogHeader>
          <div className="p-10 flex flex-col items-center bg-white space-y-8">
            <div className="p-4 bg-white border-4 border-muted/20 rounded-[2rem] shadow-inner">
                {qrSolicitud && (
                    <Image src={qrImageUrl} alt="QR Encuesta" width={220} height={220} className="rounded-xl" />
                )}
            </div>
            <div className="text-center space-y-2">
                <p className="font-black uppercase text-sm text-primary">{qrSolicitud?.lugar_local}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{qrSolicitud ? formatDateToDDMMYYYY(qrSolicitud.fecha) : ''} HS.</p>
            </div>
            <div className="w-full space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="h-12 rounded-xl font-black uppercase text-[10px] border-2 gap-2" onClick={() => navigator.clipboard.writeText(surveyUrl).then(() => toast({title: "Enlace Copiado"}))}>
                        <Copy className="h-4 w-4" /> COPIAR ENLACE
                    </Button>
                    <Button variant="outline" className="h-12 rounded-xl font-black uppercase text-[10px] border-2 gap-2 text-primary border-primary/20" onClick={generateQrPDF} disabled={isGeneratingPdf}>
                        {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} IMPRIMIR QR
                    </Button>
                </div>
                <Button className="w-full h-12 rounded-xl font-black uppercase text-[10px] bg-black text-white hover:bg-black/90" onClick={() => setQrSolicitud(null)}>CERRAR VENTANA</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialogo para Eliminar Actividad (Admin) */}
      <AlertDialog open={!!deletingSolicitud} onOpenChange={(o) => !o && setDeletingSolicitud(null)}>
        <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase tracking-tight text-xl flex items-center gap-2">
                <Trash2 className="h-6 w-6 text-destructive" /> ¿ELIMINAR DEFINITIVAMENTE?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-medium uppercase leading-relaxed text-muted-foreground pt-2">
                Esta acción es irreversible. Se borrarán todos los datos vinculados a la actividad de {deletingSolicitud?.lugar_local}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-6">
            <AlertDialogCancel className="rounded-xl font-black uppercase text-[10px] border-2">CANCELAR</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90 text-white rounded-xl font-black uppercase text-[10px] px-8" disabled={isUpdating}>
                {isUpdating ? <Loader2 className="animate-spin h-4 w-4" /> : "SÍ, ELIMINAR REGISTRO"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
