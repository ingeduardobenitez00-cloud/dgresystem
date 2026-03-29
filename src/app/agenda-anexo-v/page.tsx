
"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import Header from '@/components/header';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, writeBatch } from 'firebase/firestore';
import { type SolicitudCapacitacion, type Dato, type Divulgador, type MovimientoMaquina, type InformeDivulgador, type EncuestaSatisfaccion } from '@/lib/data';
import { 
  Loader2, 
  MapPin, 
  Calendar, 
  UserPlus, 
  QrCode, 
  Building2, 
  Search, 
  Trash2, 
  Users, 
  MessageSquareHeart, 
  Eye,
  FileText,
  Activity,
  X,
  Copy,
  CheckCircle2,
  AlertCircle,
  Power,
  PowerOff,
  ShieldAlert,
  Printer,
  Ban,
  ImageIcon
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { formatDateToDDMMYYYY, cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
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
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function AgendaAnexoVPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [assigningSolicitud, setAssigningSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [viewingActivity, setViewingActivity] = useState<SolicitudCapacitacion | null>(null);
  const [qrSolicitud, setQrSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [deletingSolicitud, setDeletingSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [suspendingSolicitud, setSuspendingSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [deletingDistrict, setDeletingDistrict] = useState<{ dept: string, dist: string, items: SolicitudCapacitacion[] } | null>(null);
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [divulSearch, setDivulSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  const qrContainerRef = useRef<HTMLDivElement>(null);

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

  const solicitudesQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !profile) return null;
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    let q;
    if (hasAdminFilter) q = colRef;
    else if (hasDeptFilter && profile.departamento) q = query(colRef, where('departamento', '==', profile.departamento));
    else if (hasDistFilter && profile.departamento && profile.distrito) {
        q = query(colRef, where('departamento', '==', profile.departamento), where('distrito', '==', profile.distrito));
    } else return null;

    return query(q, where('tipo_solicitud', 'in', ['divulgacion', 'capacitacion']));
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

  const { data: rawDivulgadores } = useCollection<Divulgador>(divulgadoresQuery);

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

  const handleToggleQr = (solicitud: SolicitudCapacitacion) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'solicitudes-capacitacion', solicitud.id);
    const newState = !solicitud.qr_enabled;
    
    updateDoc(docRef, { qr_enabled: newState })
      .then(() => {
        toast({ 
          title: newState ? "Encuesta Habilitada" : "Encuesta Deshabilitada",
          description: newState ? "Los ciudadanos ya pueden escanear el QR." : "El acceso público vía QR ha sido cerrado."
        });
      })
      .catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update' }));
      });
  };

  const handleConfirmSuspend = () => {
    if (!suspendingSolicitud || !firestore || !suspensionReason) return;
    setIsUpdating(true);
    const docRef = doc(firestore, 'solicitudes-capacitacion', suspendingSolicitud.id);
    
    updateDoc(docRef, {
        cancelada: true,
        motivo_cancelacion: suspensionReason.toUpperCase(),
        fecha_cancelacion: new Date().toISOString(),
        usuario_cancelacion: profile?.username || user?.email || 'SISTEMA'
    })
    .then(() => {
        toast({ title: "Solicitud Suspendida", description: "Se ha registrado el motivo en el historial." });
        setSuspendingSolicitud(null);
        setSuspensionReason('');
        setIsUpdating(false);
    })
    .catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update' }));
        setIsUpdating(false);
    });
  };

  const handleConfirmDelete = () => {
    if (!deletingSolicitud || !firestore) return;
    setIsUpdating(true);
    const docRef = doc(firestore, 'solicitudes-capacitacion', deletingSolicitud.id);
    deleteDoc(docRef)
        .then(() => {
            toast({ title: "Solicitud Eliminada" });
            setDeletingSolicitud(null);
            setIsUpdating(false);
        })
        .catch(async (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' }));
            setIsUpdating(false);
        });
  };

  const handleConfirmDeleteDistrict = () => {
    if (!deletingDistrict || !firestore) return;
    setIsUpdating(true);
    const batch = writeBatch(firestore);
    
    deletingDistrict.items.forEach(item => {
        const docRef = doc(firestore, 'solicitudes-capacitacion', item.id);
        batch.delete(docRef);
    });

    batch.commit()
        .then(() => {
            toast({ title: "Distrito Limpiado" });
            setDeletingDistrict(null);
            setIsUpdating(false);
        })
        .catch(async (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'solicitudes-capacitacion (batch-district)', operation: 'delete' }));
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

  const handleDownloadPng = async () => {
    if (!qrSolicitud || !qrContainerRef.current) return;
    try {
      const canvas = await html2canvas(qrContainerRef.current, {
        backgroundColor: '#ffffff',
        scale: 3,
        useCORS: true,
        logging: false
      });
      const link = document.createElement('a');
      const entity = qrSolicitud.solicitante_entidad || qrSolicitud.otra_entidad || 'Solicitud';
      link.download = `QR-${entity.replace(/\s+/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast({ title: "Imagen Generada", description: "Se ha descargado el PNG." });
    } catch (e) {
      toast({ variant: 'destructive', title: "Error al generar imagen" });
    }
  };

  const handlePrintQr = async () => {
    if (!qrSolicitud || !logoBase64) return;
    
    try {
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        
        doc.addImage(logoBase64, 'PNG', pageWidth/2 - 15, 15, 30, 30);
        
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text("JUSTICIA ELECTORAL", pageWidth/2, 55, { align: 'center' });
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text("ENCUESTA DE SATISFACCIÓN CIUDADANA", pageWidth/2, 62, { align: 'center' });

        const response = await fetch(qrImageUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        const qrBase64: string = await new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });

        const qrSize = 100;
        doc.addImage(qrBase64, 'PNG', (pageWidth - qrSize)/2, 75, qrSize, qrSize);

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        const entity = qrSolicitud.solicitante_entidad || qrSolicitud.otra_entidad || '';
        doc.text(entity.toUpperCase(), pageWidth/2, 190, { align: 'center' });
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`${formatDateToDDMMYYYY(qrSolicitud.fecha)} HS.`, pageWidth/2, 200, { align: 'center' });

        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text("Escanée el código para participar de la encuesta oficial.", pageWidth/2, 215, { align: 'center' });

        doc.save(`QR-${entity.replace(/\s+/g, '-')}.pdf`);
        toast({ title: "PDF Generado", description: "El QR está listo para imprimir." });
    } catch (e) {
        toast({ variant: 'destructive', title: "Error al generar PDF" });
    }
  };

  if (isUserLoading || isLoadingSolicitudes) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Agenda Anexo V - Solicitudes" />
      
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
                <h1 className="text-3xl font-black uppercase text-primary">Agenda Solicitudes</h1>
                <p className="text-muted-foreground text-xs font-bold uppercase mt-1 flex items-center gap-2">
                    <Activity className="h-4 w-4" /> Seguimiento de pedidos de partidos y organizaciones.
                </p>
            </div>
            <div className="bg-white px-4 py-2 rounded-full border border-dashed flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[#2563EB] animate-pulse" />
                <span className="text-[9px] font-black uppercase text-muted-foreground">VISTA OPERATIVA</span>
            </div>
        </div>

        {groupedData.length === 0 ? (
          <Card className="p-20 text-center border-dashed bg-white rounded-3xl">
            <p className="font-black text-muted-foreground uppercase tracking-widest opacity-30">No hay solicitudes agendadas en su jurisdicción</p>
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
                        <h2 className="text-2xl font-black uppercase tracking-tight text-[#1A1A1A]">{dept.label}</h2>
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
                                    {dist.label}
                                </h3>
                                <Badge variant="secondary" className="bg-black text-white text-[8px] font-black px-2">
                                    {dist.items.length}
                                </Badge>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-6 space-y-4 px-2">
                            {dist.items.length > 0 && hasAdminFilter && (
                                <div className="flex justify-end mb-2 px-2">
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="text-[9px] font-black uppercase text-destructive hover:bg-destructive/10 h-8 gap-2"
                                        onClick={() => setDeletingDistrict({ dept: dept.label, dist: dist.label, items: dist.items })}
                                        title="Eliminar todas las solicitudes de este distrito"
                                    >
                                        <Trash2 className="h-3 w-3" /> VACIAR DISTRITO
                                    </Button>
                                </div>
                            )}
                            {dist.items.sort((a,b) => a.fecha.localeCompare(b.fecha)).map((item) => {
                                const today = new Date().toISOString().split('T')[0];
                                const isPast = item.fecha < today;
                                const mov = movimientosData?.find(m => m.solicitud_id === item.id);
                                const inf = informesData?.find(i => i.solicitud_id === item.id);
                                
                                const missingF02 = isPast && !mov?.fecha_devolucion;
                                const missingAnexoIII = isPast && !inf;
                                const hasAlert = missingF02 || missingAnexoIII;
                                const isFulfilled = mov?.fecha_devolucion && inf;

                                const itemEncuestas = encuestasData?.filter(e => e.solicitud_id === item.id) || [];

                                return (
                                    <Card key={item.id} className={cn("border-2 shadow-sm rounded-2xl relative overflow-hidden", hasAlert ? "border-destructive/40 bg-destructive/[0.02]" : isFulfilled ? "border-green-200 bg-green-50/10" : "border-muted/20 bg-white")}>
                                        <CardContent className="p-8">
                                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                                                <div className="lg:col-span-4 space-y-3">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">SOLICITANTE</p>
                                                        {isFulfilled && (
                                                            <Badge className="bg-green-600 text-white font-black uppercase text-[7px] px-2 py-0 h-4">CICLO COMPLETADO</Badge>
                                                        )}
                                                    </div>
                                                    <p className="font-black text-base uppercase leading-tight text-[#1A1A1A]">{item.solicitante_entidad || item.otra_entidad}</p>
                                                    <Badge className="bg-[#E2E8F0] text-[#475569] font-black uppercase text-[8px] px-3">{item.tipo_solicitud}</Badge>
                                                </div>

                                                <div className="lg:col-span-3 space-y-4">
                                                    <div className="flex items-center gap-3">
                                                        <MapPin className="h-4 w-4 text-muted-foreground" />
                                                        <p className="font-black text-[12px] uppercase text-[#1A1A1A]">{item.lugar_local}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <Calendar className={cn("h-4 w-4", hasAlert ? "text-destructive" : "text-muted-foreground")} />
                                                        <p className={cn("font-black text-[12px] uppercase", hasAlert ? "text-destructive font-black" : "text-[#1A1A1A]")}>
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
                                                    <div className="flex items-center gap-2 text-primary pt-2 border-t border-dashed">
                                                        <MessageSquareHeart className="h-3.5 w-3.5" />
                                                        <span className="text-[9px] font-black uppercase">ENCUESTAS: {itemEncuestas.length}</span>
                                                    </div>
                                                </div>

                                                <div className="lg:col-span-3 flex flex-col items-end gap-3">
                                                    {hasAlert && (
                                                        <div className="w-full max-w-[220px] mb-2 flex flex-col gap-1">
                                                            {missingF02 && (
                                                                <div className="flex items-center gap-2 bg-destructive/10 text-destructive px-3 py-1 rounded-lg border border-destructive/20">
                                                                    <ShieldAlert className="h-3 w-3" />
                                                                    <span className="text-[8px] font-black uppercase">FALTA RETORNO (F02)</span>
                                                                </div>
                                                            )}
                                                            {missingAnexoIII && (
                                                                <div className="flex items-center gap-2 bg-destructive/10 text-destructive px-3 py-1 rounded-lg border border-destructive/20">
                                                                    <AlertCircle className="h-3 w-3" />
                                                                    <span className="text-[8px] font-black uppercase">FALTA INFORME (ANEXO III)</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="flex gap-2 w-full max-w-[220px]">
                                                        <Button variant="outline" size="sm" className="h-11 flex-1 rounded-xl font-black uppercase text-[11px] border-2" onClick={() => setAssigningSolicitud(item)} title="Gestionar Personal Asignado">
                                                          <UserPlus className="h-4 w-4 mr-2" /> ASIGNAR
                                                        </Button>
                                                        <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl border-2" onClick={() => setViewingActivity(item)} title="Ver Ficha de Detalles">
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl border-2 border-orange-200 text-orange-600 hover:bg-orange-50 transition-all" onClick={() => setSuspendingSolicitud(item)} title="Suspender Solicitud">
                                                            <Ban className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl border-2 border-destructive/40 text-destructive hover:bg-destructive hover:text-white transition-all" onClick={() => setDeletingSolicitud(item)} title="Eliminar Registro Definitivamente">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    
                                                    <div className="flex gap-2 w-full max-w-[220px]">
                                                        <Button 
                                                            variant="outline" 
                                                            size="icon" 
                                                            className={cn("h-11 w-11 rounded-xl border-2 transition-all", item.qr_enabled ? "bg-green-600 border-green-600 text-white" : "border-muted-foreground/30 text-muted-foreground")} 
                                                            onClick={() => handleToggleQr(item)}
                                                            title={item.qr_enabled ? "Deshabilitar Encuesta Pública" : "Habilitar Encuesta Pública vía QR"}
                                                        >
                                                            {item.qr_enabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                                                        </Button>
                                                        <Button variant="outline" size="sm" className="h-11 flex-1 rounded-xl font-black uppercase text-[10px] border-2" onClick={() => setQrSolicitud(item)} disabled={!item.qr_enabled} title="Ver y Descargar Código QR">
                                                            <QrCode className="h-4 w-4 mr-2" /> QR
                                                        </Button>
                                                        <Button 
                                                            className={cn("h-11 w-full rounded-xl font-black uppercase text-[11px] shadow-lg flex-1", inf ? "bg-[#16A34A] hover:bg-[#15803D]" : "bg-black hover:bg-black/90")}
                                                            onClick={() => {
                                                              if (!inf) {
                                                                  window.location.href = `/informe-divulgador?solicitudId=${item.id}`;
                                                              }
                                                          }}
                                                          title={inf ? "Informe enviado" : "Cargar Informe de Marcación"}
                                                        >
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

      <Dialog open={!!viewingActivity} onOpenChange={(o) => !o && setViewingActivity(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 border-none shadow-2xl overflow-hidden rounded-[2.5rem]">
          {viewingActivity && (
            <div className="flex flex-col h-full bg-white">
                <div className="bg-black text-white p-8 shrink-0">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
                                    <FileText className="h-6 w-6" />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-black uppercase leading-none tracking-tight">FICHA DE SOLICITUD ANEXO V</DialogTitle>
                                    <DialogDescription className="text-white/60 font-bold uppercase text-[10px] mt-2 tracking-widest">
                                        ID DE CONTROL: {viewingActivity.id}
                                    </DialogDescription>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setViewingActivity(null)} className="text-white/40 hover:text-white" title="Cerrar Ventana"><X className="h-6 w-6" /></Button>
                        </div>
                    </DialogHeader>
                </div>

                <ScrollArea className="flex-1 p-8">
                    <div className="space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1 p-4 bg-muted/20 rounded-2xl border">
                                <p className="text-[8px] font-black text-muted-foreground uppercase">Solicitante</p>
                                <p className="text-xs font-black uppercase">{viewingActivity.solicitante_entidad || viewingActivity.otra_entidad}</p>
                            </div>
                            <div className="space-y-1 p-4 bg-muted/20 rounded-2xl border">
                                <p className="text-[8px] font-black text-muted-foreground uppercase">Fecha Programada</p>
                                <p className="text-xs font-black uppercase">{formatDateToDDMMYYYY(viewingActivity.fecha)}</p>
                            </div>
                            <div className="space-y-1 p-4 bg-muted/20 rounded-2xl border">
                                <p className="text-[8px] font-black text-muted-foreground uppercase">Horario Pactado</p>
                                <p className="text-xs font-black uppercase">{viewingActivity.hora_desde} A {viewingActivity.hora_hasta} HS</p>
                            </div>
                        </div>

                        <Separator className="border-dashed" />

                        <div className="space-y-6">
                            <div className="flex items-center gap-3">
                                <Activity className="h-5 w-5 text-primary" />
                                <h3 className="font-black uppercase text-xs tracking-widest">Trazabilidad Logística</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {(() => {
                                    const mov = movimientosData?.find(m => m.solicitud_id === viewingActivity.id);
                                    const inf = informesData?.find(i => i.solicitud_id === viewingActivity.id);
                                    
                                    return (
                                        <>
                                            <div className={cn("p-5 rounded-2xl border-2 flex flex-col items-center text-center gap-2", mov ? "bg-green-50 border-green-200" : "bg-muted/10 border-transparent opacity-40")}>
                                                <div className={cn("h-8 w-8 rounded-full flex items-center justify-center", mov ? "bg-green-600 text-white" : "bg-muted text-muted-foreground")}>
                                                    <CheckCircle2 className="h-4 w-4" />
                                                </div>
                                                <p className="text-[9px] font-black uppercase">SALIDA MV</p>
                                            </div>
                                            <div className={cn("p-5 rounded-2xl border-2 flex flex-col items-center text-center gap-2", mov?.fecha_devolucion ? "bg-green-50 border-green-200" : "bg-muted/10 border-transparent opacity-40")}>
                                                <div className={cn("h-8 w-8 rounded-full flex items-center justify-center", mov?.fecha_devolucion ? "bg-green-600 text-white" : "bg-muted text-muted-foreground")}>
                                                    <CheckCircle2 className="h-4 w-4" />
                                                </div>
                                                <p className="text-[9px] font-black uppercase">RETORNO MV</p>
                                            </div>
                                            <div className={cn("p-5 rounded-2xl border-2 flex flex-col items-center text-center gap-2", inf ? "bg-green-50 border-green-200" : "bg-muted/10 border-transparent opacity-40")}>
                                                <div className={cn("h-8 w-8 rounded-full flex items-center justify-center", inf ? "bg-green-600 text-white" : "bg-muted text-muted-foreground")}>
                                                    <CheckCircle2 className="h-4 w-4" />
                                                </div>
                                                <p className="text-[9px] font-black uppercase">INFORME</p>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!assigningSolicitud} onOpenChange={(o) => !o && setAssigningSolicitud(null)}>
        <DialogContent className="max-w-2xl rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-black text-white p-6">
            <DialogTitle className="font-black uppercase text-sm flex items-center gap-2">
                <Users className="h-4 w-4" /> GESTIONAR DIVULGADORES - {assigningSolicitud?.solicitante_entidad?.toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-x-6">
            <div className="p-6 space-y-4 bg-white">
                <h3 className="font-bold uppercase text-xs text-muted-foreground">Personal Asignado</h3>
                <ScrollArea className="h-[350px] pr-2">
                    {(assigningSolicitud?.divulgadores || []).map(d => (
                        <div key={d.id} className="p-4 border-2 rounded-2xl flex justify-between items-center mb-2">
                            <div>
                                <p className="font-black text-xs uppercase">{d.nombre}</p>
                                <span className="text-[8px] font-bold text-muted-foreground uppercase">{d.vinculo}</span>
                            </div>
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleRemoveDivulgador(d.id)} title="Quitar Personal"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                    ))}
                </ScrollArea>
            </div>
            <div className="p-6 space-y-4 bg-white border-l">
                <h3 className="font-bold uppercase text-xs text-muted-foreground">Añadir Disponible</h3>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar..." value={divulSearch} onChange={e => setDivulSearch(e.target.value)} className="h-10 pl-10 font-bold border-2 rounded-xl" />
                </div>
                <ScrollArea className="h-[280px] pr-2">
                    {filteredDivul.map(d => (
                        <div key={d.id} className="p-4 border-2 rounded-2xl cursor-pointer hover:bg-black hover:text-white transition-all group mb-2" onClick={() => handleAssignDivulgador(d)} title="Asignar a esta actividad">
                            <p className="font-black text-xs uppercase">{d.nombre}</p>
                            <span className="text-[8px] font-bold opacity-60 uppercase">{d.vinculo}</span>
                        </div>
                    ))}
                </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!qrSolicitud} onOpenChange={(o) => !o && setQrSolicitud(null)}>
        <DialogContent className="max-w-sm rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden">
          <div className="p-10 flex flex-col items-center bg-white space-y-6">
            <div ref={qrContainerRef} className="flex flex-col items-center bg-white p-4 rounded-xl">
                <div className="p-4 bg-white border-4 border-muted/20 rounded-[2rem] shadow-inner mb-4">
                    {qrSolicitud && (
                        <img 
                            src={qrImageUrl} 
                            alt="QR" 
                            width={220} 
                            height={220} 
                            className="rounded-xl" 
                            crossOrigin="anonymous" 
                        />
                    )}
                </div>
                
                <div className="text-center space-y-1">
                    <h3 className="font-black uppercase text-sm leading-tight">
                        {qrSolicitud?.solicitante_entidad || qrSolicitud?.otra_entidad}
                    </h3>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{formatDateToDDMMYYYY(qrSolicitud?.fecha)} HS.</p>
                </div>
            </div>

            <div className="w-full grid grid-cols-1 gap-2">
                <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="h-14 rounded-2xl font-black uppercase text-[9px] border-2 flex flex-col gap-1 items-center justify-center p-2" onClick={copyToClipboard} title="Copiar enlace de encuesta">
                        <Copy className={cn("h-4 w-4", copied ? "text-green-600" : "text-muted-foreground")} />
                        <span>COPIAR ENLACE</span>
                    </Button>
                    <Button variant="outline" className="h-14 rounded-2xl font-black uppercase text-[9px] border-2 flex flex-col gap-1 items-center justify-center p-2" onClick={handlePrintQr} title="Descargar PDF para imprimir">
                        <Printer className="h-4 w-4 text-muted-foreground" />
                        <span>IMPRIMIR QR</span>
                    </Button>
                </div>
                <Button variant="outline" className="h-14 rounded-2xl font-black uppercase text-[9px] border-2 flex flex-col gap-1 items-center justify-center p-2" onClick={handleDownloadPng} title="Generar imagen PNG para WhatsApp">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    <span>GENERAR IMAGEN EN PNG</span>
                </Button>
            </div>
            
            <Button className="w-full h-14 rounded-2xl font-black uppercase text-xs bg-black text-white shadow-xl" onClick={() => setQrSolicitud(null)}>CERRAR VENTANA</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!suspendingSolicitud} onOpenChange={(o) => !o && setSuspendingSolicitud(null)}>
        <DialogContent className="max-w-md rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
            <DialogHeader className="bg-orange-600 text-white p-6">
                <DialogTitle className="font-black uppercase text-sm flex items-center gap-2">
                    <Ban className="h-4 w-4" /> SUSPENDER SOLICITUD
                </DialogTitle>
            </DialogHeader>
            <div className="p-8 space-y-6 bg-white">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Motivo de la Suspensión *</Label>
                    <Textarea 
                        placeholder="Especifique el motivo de la suspensión..." 
                        className="min-h-[100px] border-2 font-bold uppercase rounded-xl"
                        value={suspensionReason}
                        onChange={e => setSuspensionReason(e.target.value)}
                    />
                </div>
                <div className="flex gap-3 pt-2">
                    <Button variant="outline" className="flex-1 h-12 rounded-xl font-black uppercase text-[10px] border-2" onClick={() => setSuspendingSolicitud(null)}>CANCELAR</Button>
                    <Button className="flex-[2] h-12 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black uppercase text-[10px]" onClick={handleConfirmSuspend} disabled={!suspensionReason || isUpdating}>
                        {isUpdating ? <Loader2 className="animate-spin h-4 w-4" /> : "CONFIRMAR SUSPENSIÓN"}
                    </Button>
                </div>
            </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingSolicitud} onOpenChange={(o) => !o && setDeletingSolicitud(null)}>
        <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase">¿ELIMINAR DEFINITIVAMENTE?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-medium uppercase leading-relaxed text-muted-foreground pt-2">
                Esta acción es irreversible. Se borrará la solicitud seleccionada del sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-6">
            <AlertDialogCancel className="rounded-xl font-black uppercase text-[10px] border-2">CANCELAR</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90 text-white rounded-xl font-black uppercase text-[10px] px-8">
                SÍ, ELIMINAR REGISTRO
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingDistrict} onOpenChange={(o) => !o && setDeletingDistrict(null)}>
        <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase text-destructive">¿VACIAR DISTRITO COMPLETO?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-bold uppercase leading-relaxed text-muted-foreground pt-2">
                Usted va a eliminar todas las solicitudes del distrito de <span className="text-primary font-black">{deletingDistrict?.dist}</span>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-6">
            <AlertDialogCancel className="rounded-xl font-black uppercase text-[10px] border-2">CANCELAR</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteDistrict} className="bg-destructive hover:bg-destructive/90 text-white rounded-xl font-black uppercase text-[10px] px-8">
                SÍ, VACIAR DISTRITO
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
