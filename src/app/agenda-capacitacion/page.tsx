
"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import Header from '@/components/header';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { type SolicitudCapacitacion, type Dato, type Divulgador, type MovimientoMaquina, type InformeDivulgador, type Asignado } from '@/lib/data';
import { 
  Loader2, 
  MapPin, 
  Calendar, 
  UserPlus, 
  QrCode, 
  Building2, 
  LayoutList, 
  Globe, 
  Search, 
  Trash2, 
  Printer, 
  CheckCircle2, 
  User, 
  Copy, 
  Check, 
  CalendarX, 
  AlertCircle, 
  Clock, 
  ImageIcon, 
  Power, 
  PowerOff,
  Eye,
  FileText,
  Navigation,
  Phone,
  Download,
  Users,
  X
} from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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
import Image from 'next/image';

export default function AgendaCapacitacionPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const qrExportRef = useRef<HTMLDivElement>(null);

  const [assigningSolicitud, setAssigningSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [qrSolicitud, setQrSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [cancellingSolicitud, setCancellingSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [deletingSolicitud, setDeletingSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [viewingSolicitud, setViewingSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingPng, setIsGeneratingPng] = useState(false);
  const [divulSearch, setDivulSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [pendingArchiveIds, setPendingArchiveIds] = useState<Set<string>>(new Set());

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

  useEffect(() => {
    if (!rawSolicitudes || !movimientosData || !informesData) return;

    rawSolicitudes.forEach(sol => {
      const mov = movimientosData.find(m => m.solicitud_id === sol.id);
      const isClosed = !!(mov?.maquinas.every(m => !!m.lacre_estado) && informesData.some(i => i.solicitud_id === sol.id));

      if (isClosed && !hiddenIds.has(sol.id) && !pendingArchiveIds.has(sol.id)) {
        setPendingArchiveIds(prev => new Set(prev).add(sol.id));
        setTimeout(() => {
          setHiddenIds(prev => new Set(prev).add(sol.id));
        }, 120000); 
      }
    });
  }, [rawSolicitudes, movimientosData, informesData, hiddenIds, pendingArchiveIds]);

  const groupedData = useMemo(() => {
    if (!rawSolicitudes || !datosData) return [];

    const activeSolicitudes = rawSolicitudes.filter(sol => !hiddenIds.has(sol.id) && !sol.cancelada);

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
  }, [rawSolicitudes, datosData, hiddenIds]);

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
        toast({ title: "Personal Agregado" });
        setIsUpdating(false);
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update' }));
        setIsUpdating(false);
      });
  };

  const handleRemoveDivulgador = (solId: string, asignado: Asignado) => {
    if (!firestore) return;
    setIsUpdating(true);
    const docRef = doc(firestore, 'solicitudes-capacitacion', solId);
    updateDoc(docRef, {
      asignados: arrayRemove(asignado)
    })
      .then(() => {
        toast({ title: "Personal Removido" });
        setIsUpdating(false);
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update' }));
        setIsUpdating(false);
      });
  };

  const handleToggleQrStatus = (solicitud: SolicitudCapacitacion) => {
    if (!firestore) return;
    setIsUpdating(true);
    const newStatus = !solicitud.qr_habilitado;
    const docRef = doc(firestore, 'solicitudes-capacitacion', solicitud.id);
    
    updateDoc(docRef, { qr_habilitado: newStatus })
      .then(() => {
        toast({ 
          title: newStatus ? "Encuesta Habilitada" : "Encuesta Deshabilitada",
          description: newStatus ? "Los ciudadanos ya pueden acceder al formulario." : "El acceso público ha sido cerrado."
        });
        setIsUpdating(false);
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update' }));
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

  const surveyUrl = (sol: SolicitudCapacitacion) => {
    if (typeof window === 'undefined' || !sol) return '';
    return `${window.location.origin}/encuesta-satisfaccion?solicitudId=${sol.id}`;
  };

  const copyToClipboard = (sol: SolicitudCapacitacion) => {
    navigator.clipboard.writeText(surveyUrl(sol));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Enlace copiado" });
  };

  const generateQrPDF = async (sol: SolicitudCapacitacion) => {
    if (!sol || !logoBase64) return;
    setIsGeneratingPdf(true);
    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(surveyUrl(sol))}`;
        
        doc.addImage(logoBase64, 'PNG', 20, 10, 25, 25);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text("JUSTICIA ELECTORAL", pageWidth / 2, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.text("SISTEMA DE DIVULGACIÓN", pageWidth / 2, 28, { align: 'center' });
        doc.setLineWidth(0.5);
        doc.line(20, 40, pageWidth - 20, 40);
        doc.setFontSize(18);
        doc.text("CÓDIGO QR - ENCUESTA DE SATISFACCIÓN", pageWidth / 2, 55, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`LOCAL: ${sol.lugar_local.toUpperCase()}`, pageWidth / 2, 75, { align: 'center' });
        doc.text(`DISTRITO: ${sol.distrito.toUpperCase()} | DEPTO: ${sol.departamento.toUpperCase()}`, pageWidth / 2, 83, { align: 'center' });
        
        doc.text(`FECHA: ${formatDateToDDMMYYYY(sol.fecha)}`, pageWidth / 2, 91, { align: 'center' });
        doc.text(`HABILITADO DE: ${sol.hora_desde} A ${sol.hora_hasta} HS.`, pageWidth / 2, 99, { align: 'center' });
        
        const response = await fetch(qrUrl);
        const blob = await response.blob();
        const qrBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
        const qrSize = 100;
        doc.addImage(qrBase64, 'PNG', (pageWidth - qrSize) / 2, 110, qrSize, qrSize);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text("Instrucciones: Escanee este código con la cámara de su teléfono", pageWidth / 2, 220, { align: 'center' });
        doc.text("para acceder al formulario oficial de satisfacción ciudadana.", pageWidth / 2, 226, { align: 'center' });
        doc.save(`QR-Encuesta-${sol.lugar_local.replace(/\s+/g, '-')}.pdf`);
        toast({ title: "PDF Generado con éxito" });
    } catch (error) {
        toast({ variant: 'destructive', title: "Error al generar PDF" });
    } finally {
        setIsGeneratingPdf(false);
    }
  };

  const generateQrPNG = async () => {
    if (!qrExportRef.current || !qrSolicitud) return;
    setIsGeneratingPng(true);
    try {
        const canvas = await html2canvas(qrExportRef.current, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true
        });
        const image = canvas.toDataURL("image/png");
        const link = document.createElement('a');
        link.href = image;
        link.download = `QR-Encuesta-${qrSolicitud.lugar_local.replace(/\s+/g, '-')}.png`;
        link.click();
        toast({ title: "Imagen PNG generada" });
    } catch (error) {
        toast({ variant: 'destructive', title: "Error al generar imagen" });
    } finally {
        setIsGeneratingPng(false);
    }
  };

  const filteredDivul = useMemo(() => {
    if (!rawDivulgadores || !assigningSolicitud) return [];
    const term = divulSearch.toLowerCase().trim();
    const alreadyAsignados = new Set(assigningSolicitud.asignados?.map(a => a.id) || []);
    return rawDivulgadores.filter(d => 
      d.distrito === assigningSolicitud.distrito &&
      !alreadyAsignados.has(d.id) &&
      (d.nombre.toLowerCase().includes(term) || d.cedula.includes(term))
    );
  }, [rawDivulgadores, divulSearch, assigningSolicitud]);

  if (isUserLoading || isLoadingSolicitudes || isLoadingDivul) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Agenda de Actividades" />
      
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
                <span className="text-[9px] font-black uppercase text-muted-foreground">MONITOR EN TIEMPO REAL</span>
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
                    <div className="h-14 w-14 rounded-full bg-primary text-white flex items-center justify-center font-black text-lg shadow-xl">
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
                    {Object.values(dept.dists).map((dist) => {
                        const batches: Record<string, SolicitudCapacitacion[]> = {};
                        dist.items.forEach(item => {
                            const key = `${item.solicitante_entidad}-${item.lugar_local}-${item.tipo_solicitud}`;
                            if (!batches[key]) batches[key] = [];
                            batches[key].push(item);
                        });

                        return (
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
                                <AccordionContent className="pt-6 space-y-6 px-2">
                                    {Object.values(batches).map((batch, bIdx) => {
                                        const head = batch[0];
                                        return (
                                            <Card key={bIdx} className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white group/card">
                                                <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch min-h-[140px]">
                                                    <div className="lg:col-span-3 p-8 bg-muted/5 border-r border-dashed border-black/10 flex flex-col justify-center gap-3">
                                                        <p className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.2em]">SOLICITANTE</p>
                                                        <h4 className="font-black text-sm uppercase leading-tight text-[#1A1A1A]">
                                                            {head.solicitante_entidad || head.otra_entidad}
                                                        </h4>
                                                        <Badge variant="secondary" className="w-fit bg-[#E2E8F0] text-[#475569] font-black uppercase text-[8px] tracking-widest px-3 py-1 rounded-md">
                                                            {head.tipo_solicitud === 'Lugar Fijo' ? 'LUGAR FIJO' : head.tipo_solicitud.toUpperCase()}
                                                        </Badge>
                                                    </div>

                                                    <div className="lg:col-span-9 p-8 flex flex-col gap-6">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <MapPin className="h-5 w-5 text-muted-foreground" />
                                                                <h3 className="text-lg font-black uppercase tracking-tight text-primary">{head.lugar_local}</h3>
                                                            </div>
                                                            <Button 
                                                                variant="outline" 
                                                                size="sm" 
                                                                className="rounded-full font-black text-[9px] uppercase gap-2"
                                                                onClick={() => setViewingSolicitud(head)}
                                                            >
                                                                <Eye className="h-3 w-3" /> VER SOLICITUD
                                                            </Button>
                                                        </div>

                                                        <div className="space-y-4">
                                                            {batch.sort((a,b) => a.fecha.localeCompare(b.fecha)).map((item) => {
                                                                const mov = movimientosData?.find(m => m.solicitud_id === item.id);
                                                                const inf = informesData?.filter(i => i.solicitud_id === item.id);
                                                                
                                                                // Evento cumplido si hay informe por cada asignado y máquinas devueltas
                                                                const asignadosCount = item.asignados?.length || 0;
                                                                const isClosed = !!(mov?.maquinas.every(m => !!m.lacre_estado) && inf && inf.length >= asignadosCount && asignadosCount > 0);
                                                                
                                                                const today = new Date().toISOString().split('T')[0];
                                                                const hasAlert = item.fecha < today && !isClosed;

                                                                return (
                                                                    <div key={item.id} className={cn(
                                                                        "flex flex-col md:flex-row items-center gap-6 p-4 rounded-2xl border-2 transition-all",
                                                                        isClosed ? "bg-green-50/30 border-green-200" : hasAlert ? "bg-destructive/[0.02] border-destructive/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]" : "bg-[#F8F9FA] border-transparent hover:border-black/5"
                                                                    )}>
                                                                        <div className="flex items-center gap-3 md:w-48">
                                                                            <Calendar className={cn("h-4 w-4", hasAlert ? "text-destructive" : "text-muted-foreground")} />
                                                                            <p className={cn("font-black text-xs uppercase tracking-tighter", hasAlert ? "text-destructive" : "text-[#1A1A1A]")}>
                                                                                {formatDateToDDMMYYYY(item.fecha)} | {item.hora_desde} HS
                                                                            </p>
                                                                        </div>

                                                                        <div className="flex-1 flex flex-col gap-1">
                                                                            <p className="text-[7px] font-black text-muted-foreground uppercase tracking-widest">PERSONAL OPERATIVO ({item.asignados?.length || 0})</p>
                                                                            {item.asignados && item.asignados.length > 0 ? (
                                                                                <div className="flex flex-wrap gap-1.5">
                                                                                    {item.asignados.map(a => (
                                                                                        <Badge key={a.id} variant="secondary" className="bg-white border-2 border-primary/5 text-[8px] font-black uppercase flex items-center gap-1.5 py-1">
                                                                                            <User className="h-2.5 w-2.5" />
                                                                                            {a.nombre}
                                                                                            <button onClick={() => handleRemoveDivulgador(item.id, a)} className="hover:text-destructive">
                                                                                                <X className="h-2.5 w-2.5" />
                                                                                            </button>
                                                                                        </Badge>
                                                                                    ))}
                                                                                </div>
                                                                            ) : (
                                                                                <span className="font-black text-[9px] text-destructive uppercase italic">SIN ASIGNAR</span>
                                                                            )}
                                                                        </div>

                                                                        <div className="md:w-32 flex flex-col gap-1">
                                                                            <p className="text-[7px] font-black text-muted-foreground uppercase tracking-widest">ESTADO</p>
                                                                            {isClosed ? (
                                                                                <div className="flex items-center gap-1.5 text-green-600 animate-in fade-in zoom-in duration-500">
                                                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                                                    <span className="font-black text-[9px] uppercase tracking-tighter">CUMPLIDO</span>
                                                                                </div>
                                                                            ) : hasAlert ? (
                                                                                <div className="flex flex-col gap-0.5">
                                                                                    <div className="flex items-center gap-1.5 text-destructive animate-pulse">
                                                                                        <AlertCircle className="h-3.5 w-3.5" />
                                                                                        <span className="font-black text-[9px] uppercase tracking-tighter">PENDIENTE</span>
                                                                                    </div>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="flex items-center gap-1.5 text-blue-600">
                                                                                    <Clock className="h-3.5 w-3.5" />
                                                                                    <span className="font-black text-[9px] uppercase tracking-tighter">EN AGENDA</span>
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        <div className="flex flex-col gap-1.5 md:w-[280px]">
                                                                            <div className="flex gap-1.5 w-full">
                                                                                <Button 
                                                                                    variant="outline" 
                                                                                    size="sm" 
                                                                                    className="h-8 flex-1 rounded-lg font-black uppercase text-[9px] border-2 bg-white gap-2" 
                                                                                    onClick={() => setAssigningSolicitud(item)} 
                                                                                    disabled={isClosed}
                                                                                >
                                                                                    <UserPlus className="h-3 w-3" /> ASIGNAR PERSONAL
                                                                                </Button>
                                                                                <div className="flex gap-1">
                                                                                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-2 border-destructive/10 text-destructive/60 hover:text-destructive" onClick={() => setCancellingSolicitud(item)} disabled={isClosed}>
                                                                                        <CalendarX className="h-3.5 w-3.5" />
                                                                                    </Button>
                                                                                    {profile?.role === 'admin' && (
                                                                                        <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-2 border-destructive/10 text-destructive/60 hover:text-destructive" onClick={() => setDeletingSolicitud(item)} disabled={isClosed}>
                                                                                            <Trash2 className="h-3.5 w-3.5" />
                                                                                        </Button>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex gap-1.5 w-full">
                                                                                <div className="flex flex-col gap-1">
                                                                                    <Button 
                                                                                        variant="outline" 
                                                                                        size="icon" 
                                                                                        className="h-8 w-12 rounded-lg border-2 bg-white" 
                                                                                        onClick={() => setQrSolicitud(item)}
                                                                                    >
                                                                                        <QrCode className="h-3.5 w-3.5" />
                                                                                    </Button>
                                                                                    <Button
                                                                                        variant="outline"
                                                                                        size="icon"
                                                                                        className={cn(
                                                                                            "h-8 w-12 rounded-lg border-2",
                                                                                            item.qr_habilitado ? "border-destructive text-destructive bg-destructive/5" : "border-green-600 text-green-600 bg-green-50"
                                                                                        )}
                                                                                        onClick={() => handleToggleQrStatus(item)}
                                                                                        disabled={isUpdating}
                                                                                    >
                                                                                        {item.qr_habilitado ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                                                                                    </Button>
                                                                                </div>
                                                                                <Link href={`/informe-divulgador?solicitudId=${item.id}`} className="flex-1 flex items-center">
                                                                                    <Button className={cn("h-full w-full rounded-lg font-black uppercase text-[9px] shadow-sm", inf && inf.length > 0 ? "bg-green-600 hover:bg-green-700" : "bg-black hover:bg-black/90")}>
                                                                                        {inf && inf.length > 0 ? `ANEXO III (${inf.length})` : 'INFORME'}
                                                                                    </Button>
                                                                                </Link>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
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
        )}
      </main>

      <Dialog open={!!assigningSolicitud} onOpenChange={(o) => !o && setAssigningSolicitud(null)}>
        <DialogContent className="max-w-md rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-black text-white p-6">
            <DialogTitle className="font-black uppercase tracking-widest text-sm flex items-center gap-2">
              <Users className="h-4 w-4" /> ASIGNAR EQUIPO - {assigningSolicitud?.distrito?.toUpperCase()}
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
                <div className="flex flex-col items-center justify-center py-20 opacity-20 text-center">
                  <UserPlus className="h-12 w-12 mb-2 mx-auto" />
                  <p className="font-black text-[10px] uppercase">No hay más divulgadores disponibles en este distrito</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredDivul.map((d) => (
                    <Button
                      key={d.id}
                      variant="outline"
                      className="w-full justify-start h-auto p-4 rounded-2xl border-2 hover:border-primary hover:bg-primary/5 transition-all gap-4"
                      onClick={() => handleAddDivulgador(d)}
                      disabled={isUpdating}
                    >
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="text-left">
                        <p className="font-black text-xs uppercase text-[#1A1A1A]">{d.nombre}</p>
                        <p className="text-[9px] font-bold text-muted-foreground">C.I.: {d.cedula} | {d.vinculo}</p>
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!cancellingSolicitud} onOpenChange={(o) => !o && setCancellingSolicitud(null)}>
        <AlertDialogContent className="rounded-[2rem] border-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase">¿Cancelar esta actividad?</AlertDialogTitle>
            <div className="text-xs font-bold uppercase py-4">
              Por favor, ingrese el motivo de la cancelación. Esta acción quedará registrada.
              <Textarea 
                className="mt-4 font-bold uppercase border-2 rounded-xl min-h-[100px]" 
                placeholder="MOTIVO DE CANCELACIÓN..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-black uppercase text-[10px]">Cerrar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmCancel}
              className="rounded-xl bg-destructive hover:bg-destructive/90 font-black uppercase text-[10px]"
              disabled={!cancelReason.trim() || isUpdating}
            >
              Confirmar Cancelación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingSolicitud} onOpenChange={(o) => !o && setDeletingSolicitud(null)}>
        <AlertDialogContent className="rounded-[2rem] border-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> ¿Eliminar Registro Permanente?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-bold uppercase py-2">
              Esta acción eliminará la solicitud de la base de datos de forma irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-black uppercase text-[10px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="rounded-xl bg-destructive hover:bg-destructive/90 font-black uppercase text-[10px]"
              disabled={isUpdating}
            >
              Eliminar Definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!qrSolicitud} onOpenChange={(o) => !o && setQrSolicitud(null)}>
        <DialogContent className="max-w-sm rounded-[2rem] border-none p-8">
          <DialogHeader>
            <DialogTitle className="font-black uppercase text-center text-sm mb-4">Encuesta de Satisfacción</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-6">
            <div className="p-4 bg-white border-2 border-dashed rounded-3xl overflow-hidden">
              {qrSolicitud && (
                <div ref={qrExportRef} className="bg-white p-6 flex flex-col items-center text-center">
                    {logoBase64 && <img src={logoBase64} alt="Logo" className="w-12 h-12 mb-4 object-contain" />}
                    <h2 className="text-[10px] font-black uppercase mb-1">Justicia Electoral</h2>
                    <h3 className="text-[8px] font-bold text-muted-foreground uppercase mb-4 tracking-widest">Sistema de Divulgación</h3>
                    
                    <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(surveyUrl(qrSolicitud))}`} 
                        alt="QR Code"
                        className="w-40 h-40 mb-4"
                    />
                    
                    <div className="space-y-1 mt-2">
                        <p className="text-[9px] font-black uppercase leading-tight text-primary">{qrSolicitud.lugar_local}</p>
                        <p className="text-[7px] font-bold text-muted-foreground uppercase">{qrSolicitud.distrito} | {qrSolicitud.departamento}</p>
                        <div className="h-px bg-muted w-full my-2" />
                        <p className="text-[8px] font-black uppercase">Fecha: {formatDateToDDMMYYYY(qrSolicitud.fecha)}</p>
                        <p className="text-[8px] font-black uppercase text-primary">Horario: {qrSolicitud.hora_desde} a {qrSolicitud.hora_hasta} HS</p>
                    </div>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-2 w-full">
              <Button variant="outline" className="font-black text-[9px] uppercase rounded-xl gap-2 h-10" onClick={() => qrSolicitud && copyToClipboard(qrSolicitud)}>
                {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />} 
                {copied ? 'Copiado' : 'Link'}
              </Button>
              <Button variant="outline" className="font-black text-[9px] uppercase rounded-xl gap-2 h-10" onClick={generateQrPNG} disabled={isGeneratingPng}>
                {isGeneratingPng ? <Loader2 className="animate-spin h-3 w-3" /> : <Download className="h-3 w-3" />}
                PNG
              </Button>
              <Button className="col-span-2 bg-black font-black text-[9px] uppercase rounded-xl gap-2 h-10" onClick={() => qrSolicitud && generateQrPDF(qrSolicitud)} disabled={isGeneratingPdf}>
                {isGeneratingPdf ? <Loader2 className="animate-spin h-3 w-3" /> : <Printer className="h-3 w-3" />}
                Exportar PDF Oficial
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingSolicitud} onOpenChange={(o) => !o && setViewingSolicitud(null)}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 border-none shadow-2xl overflow-hidden rounded-[2rem]">
          {viewingSolicitud && (
            <div className="flex flex-col h-full bg-[#F8F9FA]">
                <div className="bg-primary p-8 text-white shrink-0">
                    <DialogHeader>
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
                                <FileText className="h-6 w-6" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black uppercase leading-none">FICHA DE SOLICITUD - ANEXO V</DialogTitle>
                                <DialogDescription className="text-white/60 font-bold uppercase text-[10px] mt-2">
                                    ID: {viewingSolicitud.id.substring(0,8)} | REGISTRADO: {formatDateToDDMMYYYY(viewingSolicitud.fecha_creacion.split('T')[0])}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <ScrollArea className="flex-1 p-8">
                    <div className="space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="bg-white p-6 rounded-2xl border-2 shadow-sm space-y-1">
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Entidad Solicitante</p>
                                <p className="font-black text-sm uppercase text-primary leading-tight">{viewingSolicitud.solicitante_entidad || viewingSolicitud.otra_entidad}</p>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border-2 shadow-sm space-y-1">
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Tipo de Pedido</p>
                                <Badge className="bg-black text-white font-black uppercase text-[10px]">{viewingSolicitud.tipo_solicitud}</Badge>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border-2 shadow-sm space-y-1">
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Lugar de Evento</p>
                                <p className="font-black text-sm uppercase text-primary leading-tight">{viewingSolicitud.lugar_local}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <Card className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden">
                                <div className="bg-muted/30 px-6 py-3 border-b">
                                    <p className="text-[10px] font-black uppercase tracking-widest">Detalle de Ubicación</p>
                                </div>
                                <CardContent className="p-6 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Navigation className="h-4 w-4 text-primary opacity-40" />
                                        <p className="text-xs font-bold uppercase"><span className="text-muted-foreground">Calle:</span> {viewingSolicitud.direccion_calle || 'S/N'}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <MapPin className="h-4 w-4 text-primary opacity-40" />
                                        <p className="text-xs font-bold uppercase"><span className="text-muted-foreground">GPS:</span> {viewingSolicitud.gps || 'NO DISPONIBLE'}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Clock className="h-4 w-4 text-primary opacity-40" />
                                        <p className="text-xs font-bold uppercase"><span className="text-muted-foreground">Horario:</span> {viewingSolicitud.hora_desde} a {viewingSolicitud.hora_hasta} HS</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden">
                                <div className="bg-muted/30 px-6 py-3 border-b">
                                    <p className="text-[10px] font-black uppercase tracking-widest">Contacto del Solicitante</p>
                                </div>
                                <CardContent className="p-6 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <User className="h-4 w-4 text-primary opacity-40" />
                                        <p className="text-xs font-black uppercase">{viewingSolicitud.nombre_completo}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge variant="outline" className="text-[10px] font-bold">C.I. {viewingSolicitud.cedula}</Badge>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Phone className="h-4 w-4 text-primary opacity-40" />
                                        <p className="text-xs font-bold">{viewingSolicitud.telefono || 'SIN TELÉFONO'}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-3 px-2">
                                <ImageIcon className="h-5 w-5 text-primary" />
                                <h3 className="font-black uppercase text-xs">Respaldo Documental (Anexo V Firmado)</h3>
                            </div>
                            {viewingSolicitud.foto_firma ? (
                                <div className="relative aspect-video w-full rounded-[2.5rem] overflow-hidden border-8 border-white shadow-2xl bg-muted">
                                    {viewingSolicitud.foto_firma.startsWith('data:application/pdf') ? (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-white">
                                            <FileText className="h-20 w-20 text-primary opacity-40 mb-4" />
                                            <p className="text-sm font-black uppercase text-primary">Documento PDF Cargado</p>
                                            <Button variant="outline" className="mt-6 font-black uppercase text-[10px] border-2" asChild>
                                                <a href={viewingSolicitud.foto_firma} download={`AnexoV-${viewingSolicitud.lugar_local}.pdf`}>DESCARGAR ARCHIVO</a>
                                            </Button>
                                        </div>
                                    ) : (
                                        <Image src={viewingSolicitud.foto_firma} alt="Firma" fill className="object-cover" />
                                    )}
                                </div>
                            ) : (
                                <div className="p-20 text-center border-4 border-dashed rounded-[2.5rem] opacity-20">
                                    <ImageIcon className="h-16 w-16 mx-auto mb-4" />
                                    <p className="font-black uppercase text-sm">Sin respaldo visual registrado</p>
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>

                <div className="p-8 bg-white border-t flex justify-end">
                    <Button onClick={() => setViewingSolicitud(null)} className="font-black uppercase text-xs h-12 px-10 shadow-xl">Cerrar Ficha</Button>
                </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
