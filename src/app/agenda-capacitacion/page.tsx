
"use client";

import { useState, useMemo, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { type SolicitudCapacitacion, type Dato, type Divulgador, type MovimientoMaquina, type InformeDivulgador, type EncuestaSatisfaccion } from '@/lib/data';
import { Loader2, MapPin, Calendar, Clock, UserPlus, QrCode, Building2, LayoutList, Globe, UserCheck, Search, ChevronRight, Copy, Check, AlertTriangle, FileWarning, PackageSearch, CalendarX, Trash2, FileDown, Printer, Users, Power, PowerOff, MessageSquarePlus, MessageSquareHeart } from 'lucide-react';
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

export default function AgendaCapacitacionPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [assigningSolicitud, setAssigningSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [qrSolicitud, setQrSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [cancellingSolicitud, setCancellingSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [deletingSolicitud, setDeletingSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCompletedAlert, setShowCompletedAlert] = useState(false);
  
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

  const encuestasQuery = useMemoFirebase(() => firestore ? collection(firestore, 'encuestas-satisfaccion') : null, [firestore]);
  const { data: encuestasData } = useCollection<EncuestaSatisfaccion>(encuestasQuery);

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

  const groupedData = useMemo(() => {
    if (!rawSolicitudes || !datosData) return [];

    const today = new Date().toISOString().split('T')[0];

    const activeSolicitudes = rawSolicitudes.filter(sol => {
        if (sol.cancelada) return false;
        const mov = movimientosData?.find(m => m.solicitud_id === sol.id);
        const inf = informesData?.find(i => i.solicitud_id === sol.id);
        const isPast = sol.fecha < today;
        const isClosed = mov?.fecha_devolucion && inf;
        return !(isPast && isClosed);
    });

    const depts: Record<string, { label: string, code: string, dists: Record<string, { label: string, code: string, items: SolicitudCapacitacion[] }> }> = {};

    activeSolicitudes.forEach(sol => {
      const deptName = sol.departamento || 'SIN DEPARTAMENTO';
      const distName = sol.distrito || 'SIN DISTRITO';
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
    if (!rawDivulgadores || !assigningSolicitud) return [];
    const term = divulSearch.toLowerCase().trim();
    const assignedIds = new Set((assigningSolicitud.divulgadores || []).map(d => d.id));

    return rawDivulgadores.filter(d => 
      d.distrito === assigningSolicitud.distrito &&
      !assignedIds.has(d.id) &&
      (d.nombre.toLowerCase().includes(term) || d.cedula.includes(term))
    );
  }, [rawDivulgadores, divulSearch, assigningSolicitud]);

  const handleAssignDivulgador = (divulgador: Divulgador) => {
    if (!assigningSolicitud || !firestore) return;
    setIsUpdating(true);
    const docRef = doc(firestore, 'solicitudes-capacitacion', assigningSolicitud.id);
    
    const newDivulgador = {
      id: divulgador.id,
      nombre: divulgador.nombre,
      cedula: divulgador.cedula,
      vinculo: divulgador.vinculo
    };

    updateDoc(docRef, { divulgadores: arrayUnion(newDivulgador) })
      .then(() => {
        toast({ title: "Personal Asignado" });
        setAssigningSolicitud(prev => prev ? { ...prev, divulgadores: [...(prev.divulgadores || []), newDivulgador] } : null);
        setIsUpdating(false);
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update' }));
        setIsUpdating(false);
      });
  };

  const handleRemoveDivulgador = (divulgadorId: string) => {
    if (!assigningSolicitud || !firestore) return;
    const docRef = doc(firestore, 'solicitudes-capacitacion', assigningSolicitud.id);
    const divulgadorToRemove = (assigningSolicitud.divulgadores || []).find(d => d.id === divulgadorId);

    if (!divulgadorToRemove) return;

    updateDoc(docRef, { divulgadores: arrayRemove(divulgadorToRemove) })
      .then(() => {
          toast({ title: "Personal Removido" });
          setAssigningSolicitud(prev => prev ? { ...prev, divulgadores: (prev.divulgadores || []).filter(d => d.id !== divulgadorId) } : null);
      })
      .catch(error => { 
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update' }));
      });
  };
  
  const handleToggleQrStatus = (solicitud: SolicitudCapacitacion) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'solicitudes-capacitacion', solicitud.id);
    const newStatus = !solicitud.qr_enabled;
    updateDoc(docRef, { qr_enabled: newStatus })
        .then(() => toast({ title: `QR ${newStatus ? 'Activado' : 'Desactivado'}`}))
        .catch(error => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update' })));
  };

  const handleCompleteActivity = () => {
    setShowCompletedAlert(true);
    setTimeout(() => {
      setShowCompletedAlert(false);
    }, 5000);
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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Enlace copiado" });
  };

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
        doc.text(`FECHA: ${formatDateToDDMMYYYY(qrSolicitud.fecha)} | HORARIO: ${qrSolicitud.hora_desde} A ${qrSolicitud.hora_hasta} HS`, pageWidth / 2, 91, { align: 'center' });
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
        {showCompletedAlert && (
          <div className="fixed top-10 right-10 bg-green-500 text-white p-4 rounded-lg shadow-lg z-50 animate-in slide-in-from-right duration-300">
            <p className="font-black uppercase text-xs">Ciclo cerrado. Se agendará en Historia/Archivo.</p>
          </div>
        )}
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
                                const hasAlert = isPast && (!mov?.fecha_devolucion || !inf);

                                const missing = [];
                                if (!mov?.fecha_devolucion) missing.push("DEVOLUCIÓN DE MÁQUINA");
                                if (!inf) missing.push("INFORME ANEXO III");
                                const alertLabel = `ALERTA: ACTIVIDAD VENCIDA - FALTA COMPLETAR: ${missing.join(" Y ")}`;

                                // Lógica de encuestas
                                const itemEncuestas = encuestasData?.filter(e => e.solicitud_id === item.id) || [];
                                const qrSurveys = itemEncuestas.filter(e => e.usuario_id === 'CIUDADANO_EXTERNO').length;
                                const physicalSurveys = itemEncuestas.length - qrSurveys;
                                const hasSurveys = itemEncuestas.length > 0;

                                return (
                                    <Card key={item.id} className={cn("border-2 shadow-sm rounded-2xl relative overflow-hidden", hasAlert ? "border-destructive/40 bg-destructive/[0.02]" : "border-muted/20 bg-white")}>
                                        <CardContent className="p-8">
                                            {hasAlert && (
                                                <div className="mb-6 bg-destructive text-white px-4 py-2 rounded-xl flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <FileWarning className="h-5 w-5" />
                                                        <span className="font-black uppercase text-[10px] tracking-widest">{alertLabel}</span>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                                                <div className="lg:col-span-4 space-y-3">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">SOLICITANTE</p>
                                                        {item.anexo_id && <Badge variant="secondary" className="bg-primary/5 text-primary text-[7px] font-black uppercase">Lote: {item.anexo_id.substring(0, 6)}</Badge>}
                                                    </div>
                                                    <p className="font-black text-base uppercase leading-tight text-[#1A1A1A]">{item.solicitante_entidad || item.otra_entidad}</p>
                                                    <Badge variant="secondary" className="bg-[#E2E8F0] text-[#475569] font-black uppercase text-[9px] tracking-widest px-3 py-1 rounded-md">{item.tipo_solicitud}</Badge>
                                                </div>

                                                <div className="lg:col-span-3 space-y-4">
                                                    <div className="flex items-center gap-3">
                                                        <MapPin className="h-4 w-4 text-muted-foreground" />
                                                        <p className="font-black text-[12px] uppercase text-[#1A1A1A]">{item.lugar_local}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <Calendar className={cn("h-4 w-4", hasAlert ? "text-destructive" : "text-muted-foreground")} />
                                                        <p className={cn("font-black text-[12px] uppercase", hasAlert ? "text-destructive" : "text-[#1A1A1A]")}>
                                                            {formatDateToDDMMYYYY(item.fecha)} | {item.hora_desde} A {item.hora_hasta} HS
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="lg:col-span-2 space-y-4">
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">PERSONAL</p>
                                                        {(item.divulgadores || item.asignados || []).length > 0 ? (
                                                            <div className="flex items-center gap-2 text-[#16A34A]">
                                                                <Users className="h-4 w-4" />
                                                                <p className="font-black text-[11px] uppercase">{(item.divulgadores || item.asignados).length} ASIGNADOS</p>
                                                            </div>
                                                        ) : (
                                                            <p className="text-[10px] font-black text-destructive italic uppercase">SIN ASIGNAR</p>
                                                        )}
                                                    </div>
                                                    
                                                    {/* SECCIÓN DE ENCUESTAS */}
                                                    <div className="pt-2 border-t border-dashed">
                                                        {hasSurveys ? (
                                                            <div className="space-y-1.5">
                                                                <div className="flex items-center gap-2 text-primary">
                                                                    <MessageSquareHeart className="h-3.5 w-3.5" />
                                                                    <span className="text-[9px] font-black uppercase">ENCUESTAS: {itemEncuestas.length}</span>
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <Badge variant="outline" className="text-[7px] font-black px-1.5 h-4 border-primary/20">QR: {qrSurveys}</Badge>
                                                                    <Badge variant="outline" className="text-[7px] font-black px-1.5 h-4 border-primary/20">FÍS: {physicalSurveys}</Badge>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex items-center gap-2 text-muted-foreground/40">
                                                                    <AlertTriangle className="h-3.5 w-3.5" />
                                                                    <span className="text-[8px] font-black uppercase leading-tight">SIN ENCUESTAS REGISTRADAS</span>
                                                                </div>
                                                                <Link href={`/encuesta-satisfaccion?solicitudId=${item.id}`}>
                                                                    <Button variant="link" className="h-auto p-0 text-[8px] font-black text-primary uppercase underline tracking-tighter">
                                                                        ¿Desea registrar encuestas físicas?
                                                                    </Button>
                                                                </Link>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="lg:col-span-3 flex flex-col items-end gap-3">
                                                    <div className="flex gap-2 w-full max-w-[220px]">
                                                        <Button variant="outline" size="sm" className="h-11 flex-1 rounded-xl font-black uppercase text-[11px] border-2" onClick={() => setAssigningSolicitud(item)}>
                                                          <UserPlus className="h-4 w-4 mr-2" /> GESTIONAR
                                                        </Button>
                                                        <Button variant="outline" size="icon" className={cn("h-11 w-11 rounded-xl border-2", item.qr_enabled ? "border-green-500/50 text-green-600" : "border-muted/30")} onClick={() => handleToggleQrStatus(item)}>
                                                            {item.qr_enabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                                                        </Button>
                                                        <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl border-2 border-destructive/20 text-destructive" onClick={() => setCancellingSolicitud(item)}>
                                                            <CalendarX className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    
                                                    <div className="flex gap-2 w-full max-w-[220px]">
                                                        <Button variant="outline" size="sm" className="h-11 flex-1 rounded-xl font-black uppercase text-[10px] border-2" onClick={() => setQrSolicitud(item)}  disabled={!item.qr_enabled}>
                                                            <QrCode className="h-4 w-4" />
                                                        </Button>
                                                        <Button 
                                                            className={cn("h-11 w-full rounded-xl font-black uppercase text-[11px] shadow-lg flex-1", inf ? "bg-[#16A34A] hover:bg-[#15803D]" : "bg-black hover:bg-black/90")}
                                                            onClick={() => {
                                                              if (inf) {
                                                                  handleCompleteActivity();
                                                              } else {
                                                                  const link = document.createElement('a');
                                                                  link.href = `/informe-divulgador?solicitudId=${item.id}`;
                                                                  document.body.appendChild(link);
                                                                  link.click();
                                                                  document.body.removeChild(link);
                                                              }
                                                          }}>
                                                          {inf ? 'CUMPLIDO' : 'INFORME'}
                                                        </Button>
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
        <DialogContent className="max-w-2xl rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden [&>button]:text-white [&>button]:opacity-100">
          <DialogHeader className="bg-black text-white p-6">
            <DialogTitle className="font-black uppercase tracking-widest text-sm flex items-center gap-2">
                <Users className="h-4 w-4" /> GESTIONAR DIVULGADORES - {assigningSolicitud?.distrito?.toUpperCase() || 'SIN DISTRITO'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-x-6">
            <div className="p-6 space-y-4 bg-white">
                <h3 className="font-bold uppercase text-xs text-muted-foreground">Personal Asignado</h3>
                <ScrollArea className="h-[350px] pr-2">
                    {(assigningSolicitud?.divulgadores || []).length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 opacity-40 text-center">
                            <UserCheck className="h-12 w-12 mb-2 mx-auto" />
                            <p className="text-[10px] font-black uppercase">Aún no hay personal asignado</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {(assigningSolicitud?.divulgadores || []).map(d => (
                                <div key={d.id} className="p-4 border-2 rounded-2xl flex justify-between items-center">
                                    <div>
                                        <p className="font-black text-xs uppercase">{d.nombre}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="text-[8px] font-black">C.I. {d.cedula}</Badge>
                                            <span className="text-[9px] font-bold text-muted-foreground uppercase">{d.vinculo}</span>
                                        </div>
                                    </div>
                                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleRemoveDivulgador(d.id)}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </div>
            <div className="p-6 space-y-4 bg-white border-l">
                <h3 className="font-bold uppercase text-xs text-muted-foreground">Añadir Personal Disponible</h3>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar por nombre o cédula..." value={divulSearch} onChange={e => setDivulSearch(e.target.value)} className="h-12 pl-10 font-bold border-2 rounded-xl" />
                </div>
                <ScrollArea className="h-[280px] pr-2">
                {filteredDivul.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-40 text-center">
                        <UserPlus className="h-12 w-12 mb-2 mx-auto" />
                        <p className="text-[10px] font-black uppercase">No hay más personal disponible</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredDivul.map(d => (
                        <div key={d.id} className="p-4 border-2 rounded-2xl cursor-pointer hover:bg-black hover:text-white transition-all group" onClick={() => handleAssignDivulgador(d)}>
                            <p className="font-black text-xs uppercase">{d.nombre}</p>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-[8px] font-black bg-muted group-hover:bg-white/20">C.I. {d.cedula}</Badge>
                                <span className="text-[9px] font-bold text-muted-foreground uppercase group-hover:text-white/60">{d.vinculo}</span>
                            </div>
                        </div>
                        ))}
                    </div>
                )}
                </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialogo para Cancelar Actividad */}
      <Dialog open={!!cancellingSolicitud} onOpenChange={(o) => !o && setCancellingSolicitud(null)}>
        <DialogContent className="max-w-md rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden [&>button]:text-white [&>button]:opacity-100">
          <DialogHeader className="bg-destructive text-white p-8">
            <DialogTitle className="font-black uppercase tracking-widest text-center text-sm">ANULAR ACTIVIDAD</DialogTitle>
          </DialogHeader>
          <div className="p-8 space-y-6 bg-white">
            <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">MOTIVO (OBLIGATORIO)</Label>
                <Textarea placeholder="Ej: Suspensión por inclemencia del tiempo..." className="min-h-[120px] font-bold border-2 rounded-xl uppercase" value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="h-12 rounded-xl font-black uppercase text-[10px]" onClick={() => setCancellingSolicitud(null)}>CANCELAR</Button>
                <Button className="h-12 rounded-xl font-black uppercase text-[10px] bg-destructive hover:bg-destructive/90 shadow-lg" disabled={!cancelReason.trim() || isUpdating} onClick={handleConfirmCancel}>
                    {isUpdating ? <Loader2 className="animate-spin h-4 w-4" /> : "CONFIRMAR"}
                </Button>
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

      {/* Dialogo para Código QR de Encuesta */}
      <Dialog open={!!qrSolicitud} onOpenChange={(o) => !o && setQrSolicitud(null)}>
        <DialogContent className="max-w-sm rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden [&>button]:text-white [&>button]:opacity-100">
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
                    <Button variant="outline" className="h-12 rounded-xl font-black uppercase text-[10px] border-2 gap-2" onClick={copyToClipboard}>
                        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />} {copied ? "COPIADO" : "COPIAR ENLACE"}
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
    </div>
  );
}
