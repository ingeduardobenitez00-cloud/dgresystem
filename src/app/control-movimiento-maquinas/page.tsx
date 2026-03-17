
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  ArrowLeftRight, 
  CheckCircle2, 
  Truck, 
  Undo2, 
  CalendarDays, 
  Lock,
  Printer,
  ShieldAlert,
  FileWarning,
  Plus,
  Check,
  Camera,
  FileUp,
  X,
  Trash2,
  ImageIcon,
  FileText,
  Cpu
} from 'lucide-react';
import { useUser, useFirebase, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, addDoc, query, where, doc, updateDoc } from 'firebase/firestore';
import jsPDF from 'jspdf';
import { type SolicitudCapacitacion, type MovimientoMaquina, type MaquinaVotacion } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatDateToDDMMYYYY } from '@/lib/utils';
import Image from 'next/image';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function ControlMovimientoMaquinasPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [logo1Base64, setLogo1Base64] = useState<string | null>(null);
  const [selectedSolicitudId, setSelectedSolicitudId] = useState<string | null>(null);
  
  // Camera States
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeCameraTarget, setActiveCameraTarget] = useState<'salida' | 'devolucion' | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Photos States
  const [salidaFoto, setSalidaFoto] = useState<string | null>(null);
  const [devolucionFoto, setDevolucionFoto] = useState<string | null>(null);

  const [salidaData, setSalidaData] = useState({
    codigo_maquina: '',
    fecha: '',
    hora: '',
    pendrive_serie: '',
    credencial: false,
    auricular: false,
    acrilico: false,
    boletas: false,
  });

  const [devolucionData, setDevolucionData] = useState({
    fecha: '',
    hora: '',
    lacre_estado: 'correcto' as 'correcto' | 'violentado',
    pendrive_serie: '',
    credencial: false,
    auricular: false,
    acrilico: false,
    boletas: false,
  });

  useEffect(() => {
    const now = new Date();
    setSalidaData(p => ({
      ...p,
      fecha: now.toISOString().split('T')[0],
      hora: now.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false })
    }));
    setDevolucionData(p => ({
      ...p,
      fecha: now.toISOString().split('T')[0],
      hora: now.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false })
    }));
  }, []);

  useEffect(() => {
    const fetchLogos = async () => {
      try {
        const r1 = await fetch('/logo.png');
        const b1 = await r1.blob();
        const reader1 = new FileReader();
        reader1.onloadend = () => setLogoBase64(reader1.result as string);
        reader1.readAsDataURL(b1);

        const r2 = await fetch('/logo1.png');
        const b2 = await r2.blob();
        const reader2 = new FileReader();
        reader2.onloadend = () => setLogo1Base64(reader2.result as string);
        reader2.readAsDataURL(b2);
      } catch (error) {
        console.error("Error fetching logos:", error);
      }
    };
    fetchLogos();
  }, []);

  const profile = user?.profile;

  // Lógica de permisos para filtrado
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

  // Consulta de Actividades
  const agendaQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !profile) return null;
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    
    if (hasAdminFilter) return colRef;
    if (hasDeptFilter && profile.departamento) return query(colRef, where('departamento', '==', profile.departamento));
    if (hasDistFilter && profile.departamento && profile.distrito) {
        return query(colRef, where('departamento', '==', profile.departamento), where('distrito', '==', profile.distrito));
    }
    return null;
  }, [firestore, isUserLoading, profile, hasAdminFilter, hasDeptFilter, hasDistFilter]);

  const { data: rawAgendaItems, isLoading: isLoadingAgenda } = useCollection<SolicitudCapacitacion>(agendaQuery);

  // Consulta de Inventario de Máquinas (Filtrado por jurisdicción del usuario)
  const maquinasQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !profile) return null;
    const colRef = collection(firestore, 'maquinas');
    
    if (hasAdminFilter) return colRef;
    if (hasDeptFilter && profile.departamento) return query(colRef, where('departamento', '==', profile.departamento));
    if (hasDistFilter && profile.departamento && profile.distrito) {
        return query(colRef, where('departamento', '==', profile.departamento), where('distrito', '==', profile.distrito));
    }
    return null;
  }, [firestore, isUserLoading, profile, hasAdminFilter, hasDeptFilter, hasDistFilter]);

  const { data: maquinasInventario, isLoading: isLoadingMaquinas } = useCollection<MaquinaVotacion>(maquinasQuery);

  const movimientosQueryAll = useMemoFirebase(() => firestore ? collection(firestore, 'movimientos-maquinas') : null, [firestore]);
  const { data: allMovimientos } = useCollection<MovimientoMaquina>(movimientosQueryAll);

  const agendaItems = useMemo(() => {
    if (!rawAgendaItems) return [];
    
    return [...rawAgendaItems]
      .filter(item => {
        if (item.cancelada) return false;
        const mov = allMovimientos?.find(m => m.solicitud_id === item.id);
        const hasReturn = !!mov?.devolucion;
        if (hasReturn && item.id !== selectedSolicitudId) return false;
        return true;
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [rawAgendaItems, allMovimientos, selectedSolicitudId]);

  const movimientosQuery = useMemoFirebase(() => {
    if (!firestore || !user || !selectedSolicitudId) return null;
    return query(collection(firestore, 'movimientos-maquinas'), where('solicitud_id', '==', selectedSolicitudId));
  }, [firestore, user, selectedSolicitudId]);

  const { data: movimientosData } = useCollection<MovimientoMaquina>(movimientosQuery);
  const currentMovimiento = movimientosData && movimientosData.length > 0 ? movimientosData[0] : null;

  const selectedSolicitud = useMemo(() => {
    return rawAgendaItems?.find(item => item.id === selectedSolicitudId);
  }, [rawAgendaItems, selectedSolicitudId]);

  useEffect(() => {
    if (currentMovimiento) {
        const s = currentMovimiento.salida as any;
        if (s) {
            setSalidaData({
                codigo_maquina: s.codigo_maquina || '',
                fecha: s.fecha || '',
                hora: s.hora || '',
                pendrive_serie: s.pendrive_serie || '',
                credencial: s.credencial || false,
                auricular: s.auricular || false,
                acrilico: s.acrilico || false,
                boletas: s.boletas || false,
            });
            setSalidaFoto(s.foto_respaldo || null);
        }

        const d = currentMovimiento.devolucion as any;
        if (d) {
            setDevolucionData({
                fecha: d.fecha || '',
                hora: d.hora || '',
                lacre_estado: d.lacre_estado || 'correcto',
                pendrive_serie: d.pendrive_serie || '',
                credencial: d.credencial || false,
                auricular: d.auricular || false,
                acrilico: d.acrilico || false,
                boletas: d.boletas || false,
            });
            setDevolucionFoto(d.foto_respaldo || null);
        } else if (s) {
            setDevolucionData(prev => ({
                ...prev,
                pendrive_serie: s.pendrive_serie || ''
            }));
        }
    } else {
        setSalidaFoto(null);
        setDevolucionFoto(null);
    }
  }, [currentMovimiento]);

  const startCamera = async (target: 'salida' | 'devolucion') => {
    setActiveCameraTarget(target);
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', aspectRatio: { ideal: 0.75 } } 
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; }
    } catch (err) {
      toast({ variant: "destructive", title: "Error de Cámara" });
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
    setActiveCameraTarget(null);
  };

  const takePhoto = () => {
    if (videoRef.current && activeCameraTarget) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUri = canvas.toDataURL('image/jpeg', 0.8);
        if (activeCameraTarget === 'salida') setSalidaFoto(dataUri);
        else setDevolucionFoto(dataUri);
        stopCamera();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'salida' | 'devolucion') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (target === 'salida') setSalidaFoto(reader.result as string);
        else setDevolucionFoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveSalida = () => {
    if (!firestore || !user || !selectedSolicitud) return;
    if (!salidaData.codigo_maquina) {
      toast({ variant: 'destructive', title: 'Nº de Serie requerido' });
      return;
    }
    if (!salidaFoto) {
      toast({ variant: 'destructive', title: 'Respaldo Documental requerido', description: 'Debe adjuntar la foto del formulario físico de salida.' });
      return;
    }

    setIsSubmitting(true);
    const docData = {
      solicitud_id: selectedSolicitudId!,
      departamento: selectedSolicitud.departamento || '',
      distrito: selectedSolicitud.distrito || '',
      salida: {
        ...salidaData,
        nombre: selectedSolicitud.divulgador_nombre || '',
        cedula: selectedSolicitud.divulgador_cedula || '',
        vinculo: selectedSolicitud.divulgador_vinculo || '',
        lugar: selectedSolicitud.lugar_local,
        foto_respaldo: salidaFoto,
      },
      fecha_creacion: new Date().toISOString(),
    };

    addDoc(collection(firestore, 'movimientos-maquinas'), docData)
      .then(() => {
        toast({ title: '¡Salida Registrada!' });
        setIsSubmitting(false);
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'movimientos-maquinas', operation: 'create', requestResourceData: docData }));
        setIsSubmitting(false);
      });
  };

  const handleSaveDevolucion = () => {
    if (!firestore || !user || !selectedSolicitud || !currentMovimiento) return;
    if (!devolucionFoto) {
      toast({ variant: 'destructive', title: 'Respaldo Documental requerido', description: 'Debe adjuntar la foto del formulario físico de devolución.' });
      return;
    }

    setIsSubmitting(true);
    const updateData = {
      devolucion: {
        ...devolucionData,
        nombre: selectedSolicitud.divulgador_nombre || '',
        cedula: selectedSolicitud.divulgador_cedula || '',
        vinculo: selectedSolicitud.divulgador_vinculo || '',
        codigo_maquina: salidaData.codigo_maquina,
        lugar: selectedSolicitud.lugar_local,
        foto_respaldo: devolucionFoto,
      }
    };

    const docRef = doc(firestore, 'movimientos-maquinas', currentMovimiento.id);
    updateDoc(docRef, updateData)
      .then(() => {
        toast({ title: '¡Devolución Registrada!' });
        setIsSubmitting(false);
        setTimeout(() => setSelectedSolicitudId(null), 2000);
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: updateData }));
        setIsSubmitting(false);
      });
  };

  const generatePDF = () => {
    if (!selectedSolicitud || !logoBase64 || !logo1Base64) return;
    const doc = new jsPDF();
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Improved Header Logos and Text
    doc.addImage(logoBase64, 'PNG', margin, 5, 15, 15);
    doc.setFontSize(7); doc.setFont('helvetica', 'bold');
    doc.text("REPÚBLICA DEL PARAGUAY", margin, 24);
    doc.setFont('helvetica', 'normal');
    doc.text("Justicia Electoral", margin, 27);

    const rightLogoW = 25;
    const rightX = pageWidth - margin - rightLogoW;
    doc.addImage(logo1Base64, 'PNG', rightX, 5, rightLogoW, 12);
    
    const centerXRight = rightX + (rightLogoW / 2);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text("DGRE", centerXRight, 21, { align: 'center' });
    doc.setFontSize(7); doc.setFont('helvetica', 'bold');
    doc.text("DIRECCIÓN GENERAL DEL", centerXRight, 24, { align: 'center' });
    doc.text("REGISTRO ELECTORAL", centerXRight, 27, { align: 'center' });

    doc.setLineWidth(0.3);
    doc.line(margin, 30, pageWidth - margin, 30);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text("FORMULARIO SALIDA / DEVOLUCIÓN DE MAQUINAS DE VOTACIÓN PARA DIVULGACIÓN", pageWidth / 2, 36, { align: "center" });

    let y = 40;
    const sectionHeight = 100;
    doc.setLineWidth(0.2);
    doc.roundedRect(margin, y, pageWidth - (margin * 2), sectionHeight, 3, 3);
    doc.circle(margin + 8, y + 6, 2.5);
    doc.setFontSize(7); doc.text("A", margin + 8, y + 7, { align: 'center' });
    doc.setFontSize(8); doc.text("SALIDA DE MÁQUINA DE VOTACIÓN PARA DIVULGACIÓN", margin + 15, y + 6.5);
    y += 12; doc.setFontSize(6.5); doc.text("NOMBRE Y APELLIDO DEL FUNCIONARIO RESPONSABLE DE LA DIVULGACIÓN", margin + 5, y);
    y += 2; doc.roundedRect(margin + 5, y, 165, 5, 1, 1);
    doc.setFont('helvetica', 'normal'); doc.text((selectedSolicitud.divulgador_nombre || '').toUpperCase(), margin + 8, y + 3.5);
    y += 8; doc.setFont('helvetica', 'bold'); doc.text("Nº C.I:", margin + 5, y);
    doc.roundedRect(margin + 15, y - 4, 25, 5, 1, 1);
    doc.setFont('helvetica', 'normal'); doc.text(selectedSolicitud.divulgador_cedula || '', margin + 17, y - 0.5);
    doc.setFont('helvetica', 'bold'); doc.text("VÍNCULO:", margin + 45, y);
    const v = (selectedSolicitud.divulgador_vinculo || '').toUpperCase();
    const drawCheck = (lbl: string, checked: boolean, x: number, yPos: number) => {
        doc.rect(x, yPos - 3, 3, 3); doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.text(lbl, x + 5, yPos - 0.5); if(checked) doc.text("X", x + 0.5, yPos - 0.5);
    }
    drawCheck("PERMANENTE", v === 'PERMANENTE', margin + 65, y);
    drawCheck("CONTRATADO", v === 'CONTRATADO', margin + 95, y);
    drawCheck("COMISIONADO", v === 'COMISIONADO', margin + 130, y);
    y += 8; doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.text("HORA DE SALIDA:", margin + 5, y);
    doc.roundedRect(margin + 30, y - 4, 20, 5, 1, 1); doc.setFont('helvetica', 'normal'); 
    doc.text(`${salidaData.hora} HS`, margin + 32, y - 0.5);
    doc.setFont('helvetica', 'bold'); doc.text("FECHA:", margin + 100, y); 
    doc.text(`${formatDateToDDMMYYYY(salidaData.fecha)}`, margin + 115, y);
    y += 8; doc.setFont('helvetica', 'bold'); doc.text("NÚMERO DE SERIE DE LA MÁQUINA DE VOTACIÓN", margin + 5, y);
    y += 2; doc.roundedRect(margin + 5, y, 60, 5, 1, 1); doc.setFont('helvetica', 'normal'); 
    doc.text(salidaData.codigo_maquina.toUpperCase(), margin + 8, y + 3.5);
    y += 8; doc.setFont('helvetica', 'bold'); doc.text("LUGAR DE LA DIVULGACIÓN", margin + 5, y);
    y += 2; doc.roundedRect(margin + 5, y, 165, 5, 1, 1); doc.setFont('helvetica', 'normal'); text(selectedSolicitud.lugar_local.toUpperCase(), margin + 8, y + 3.5);
    y += 12;
    const signW = 45;
    const drawSign = (x: number, yP: number, lbl: string) => {
        doc.setLineWidth(0.1); doc.line(x, yP, x + signW, yP); doc.setFontSize(5); doc.setFont('helvetica', 'bold'); doc.text(lbl, x + signW/2, yP + 3, { align: 'center' }); doc.text("ACLARACIÓN:", x, yP + 6);
    }
    drawSign(margin + 5, y, "FIRMA JEFE"); drawSign(margin + 65, y, "FIRMA JEFE"); drawSign(margin + 125, y, "FIRMA DEL DIVULGADOR");
    y += 12; doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.text("KITS DE LA MÁQUINA DE VOTACION", margin + 10, y);
    const drawKitLine = (lbl: string, checked: boolean, curY: number) => {
        doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.text(`•  ${lbl}`, margin + 15, curY); doc.circle(margin + 65, curY - 1, 1.5); if(checked) { doc.setFont('helvetica', 'bold'); doc.text("X", margin + 64.2, curY); }
    }
    y += 4; doc.setFont('helvetica', 'normal'); doc.text("•  Nº DE SERIE DEL PENDRIVE", margin + 15, y);
    doc.roundedRect(margin + 65, y - 3.5, 40, 4.5, 1, 1); 
    doc.setFont('helvetica', 'bold'); doc.text(salidaData.pendrive_serie || '', margin + 68, y - 0.5);
    
    y += 4; drawKitLine("CREDENCIAL GENERICA", !!salidaData.credencial, y);
    y += 4; drawKitLine("AURICULAR GENERICO", !!salidaData.auricular, y);
    y += 4; drawKitLine("ACRILICO GENERICO", !!salidaData.acrilico, y);
    y += 4; drawKitLine("5 BOLETAS DE CAPACITACION", !!salidaData.boletas, y);
    y += 6; doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.text("OBS: ANEXAR A ESTE FORMULARIO: ANEXO I LUGAR FIJO DE DIVULGACIÓN / ANEXO V PROFORMA DE SOLICITUD", pageWidth / 2, y, { align: 'center' });

    y = 145; doc.roundedRect(margin, y, pageWidth - (margin * 2), sectionHeight, 3, 3);
    doc.circle(margin + 8, y + 6, 2.5); doc.setFontSize(7); doc.text("B", margin + 8, y + 7, { align: 'center' });
    doc.setFontSize(8); doc.text("DEVOLUCIÓN DE MÁQUINA DE VOTACIÓN PARA DIVULGACIÓN", margin + 15, y + 6.5);
    y += 12; doc.setFont('helvetica', 'bold'); doc.text("FECHA:", margin + 5, y); 
    doc.setFont('helvetica', 'normal'); doc.text(`${formatDateToDDMMYYYY(devolucionData.fecha)}`, margin + 18, y);
    doc.setFont('helvetica', 'bold'); doc.text("HORA DE DEVOLUCION:", margin + 100, y); doc.roundedRect(margin + 135, y - 4, 20, 5, 1, 1); 
    doc.setFont('helvetica', 'normal'); doc.text(`${devolucionData.hora} HS`, margin + 137, y - 0.5);
    y += 8; doc.setFont('helvetica', 'bold'); doc.text("NÚMERO DE SERIE DE LA MÁQUINA DE VOTACIÓN", margin + 5, y);
    y += 2; doc.roundedRect(margin + 5, y, 60, 5, 1, 1); 
    doc.setFont('helvetica', 'normal'); doc.text(salidaData.codigo_maquina.toUpperCase(), margin + 8, y + 3.5);
    const boxX = margin + 100; doc.roundedRect(boxX, y - 6, 65, 12, 2, 2); doc.setFontSize(5.5); doc.text("ESTADO DE LOS LACRES A LA DEVOLUCIÓN", boxX + 5, y - 2);
    
    doc.circle(boxX + 15, y + 3, 2); doc.text("CORRECTO", boxX + 20, y + 3.5); if(devolucionData.lacre_estado === 'correcto') doc.text("X", boxX + 14.3, y+3.7);
    doc.circle(boxX + 40, y + 3, 2); doc.text("VIOLENTADO", boxX + 45, y + 3.5); if(devolucionData.lacre_estado === 'violentado') doc.text("X", boxX + 39.3, y+3.7);
    y += 18; drawSign(margin + 5, y, "FIRMA JEFE"); drawSign(margin + 65, y, "FIRMA JEFE"); drawSign(margin + 125, y, "FIRMA DEL DIVULGADOR");
    y += 12; doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.text("KITS DE LA MAQUINA DE VOTACION", margin + 10, y);
    
    y += 4; doc.setFont('helvetica', 'normal'); doc.text("•  Nº DE SERIE DEL PENDRIVE", margin + 15, y);
    doc.roundedRect(margin + 65, y - 3.5, 40, 4.5, 1, 1); 
    doc.setFont('helvetica', 'bold'); doc.text(devolucionData.pendrive_serie || '', margin + 68, y - 0.5);
    y += 4; drawKitLine("CREDENCIAL GENERICA", !!devolucionData.credencial, y);
    y += 4; drawKitLine("AURICULAR GENERICO", !!devolucionData.auricular, y);
    y += 4; drawKitLine("ACRILICO GENERICO", !!devolucionData.acrilico, y);
    y += 4; drawKitLine("5 BOLETAS DE CAPACITACION", !!devolucionData.boletas, y);
    
    doc.save(`Proforma-Movimiento-${selectedSolicitud.lugar_local.replace(/\s+/g, '-')}.pdf`);
  };

  if (isUserLoading || isLoadingAgenda || isLoadingMaquinas) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Movimiento de Máquinas" />
      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-4">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Control Logístico</h1>
                <p className="text-muted-foreground text-[10px] font-bold uppercase flex items-center gap-2 mt-1 tracking-widest">
                    <ArrowLeftRight className="h-3.5 w-3.5" /> Trazabilidad oficial de equipos de votación
                </p>
            </div>
            {selectedSolicitudId && (
                <Button variant="outline" className="font-black uppercase text-[10px] border-2 h-11 gap-2 shadow-xl bg-white" onClick={generatePDF}>
                    <Printer className="h-4 w-4" /> GENERAR PROFORMA OFICIAL (A/B)
                </Button>
            )}
        </div>

        <Card className="border-primary/20 shadow-md">
          <CardHeader className="py-4 bg-primary/5">
            <CardTitle className="text-[10px] font-black flex items-center gap-2 uppercase tracking-widest text-primary">
              <CalendarDays className="h-4 w-4" /> VINCULAR ACTIVIDAD DE AGENDA
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Select onValueChange={setSelectedSolicitudId} value={selectedSolicitudId || undefined}>
              <SelectTrigger className="h-12 border-2 font-bold"><SelectValue placeholder="Seleccione actividad..." /></SelectTrigger>
              <SelectContent>
                {agendaItems?.length === 0 ? (
                  <div className="p-4 text-center text-xs font-bold text-muted-foreground uppercase">No hay actividades pendientes</div>
                ) : (
                  agendaItems?.map(item => (
                    <SelectItem key={item.id} value={item.id}>{formatDateToDDMMYYYY(item.fecha)} | {item.lugar_local}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedSolicitudId && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            
            {/* SECCION A: SALIDA */}
            <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
              <CardHeader className="p-8 border-b bg-[#F8F9FA] flex flex-row items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full border-4 border-black flex items-center justify-center font-black text-xl">A</div>
                    <div>
                        <CardTitle className="uppercase font-black text-xl leading-none">SALIDA DE MÁQUINA DE VOTACIÓN</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase mt-1">PARA DIVULGACIÓN (FORMULARIO 01)</CardDescription>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="p-10 space-y-8">
                <div className="space-y-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Funcionario Responsable de la Divulgación</Label>
                        <Input value={selectedSolicitud?.divulgador_nombre || ''} readOnly className="h-12 font-black uppercase border-2 rounded-2xl bg-muted/20" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Nº C.I.</Label>
                            <Input value={selectedSolicitud?.divulgador_cedula || ''} readOnly className="h-12 font-black border-2 rounded-2xl bg-muted/20" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Vínculo Institucional</Label>
                            <Input value={selectedSolicitud?.divulgador_vinculo || ''} readOnly className="h-12 font-black uppercase border-2 rounded-2xl bg-muted/20" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-primary">Hora de Salida</Label>
                            <Input type="time" value={salidaData.hora} onChange={e => setSalidaData(p => ({...p, hora: e.target.value}))} disabled={!!currentMovimiento} className="h-12 font-black text-lg border-2 rounded-2xl" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-primary">Fecha</Label>
                            <Input type="date" value={salidaData.fecha} onChange={e => setSalidaData(p => ({...p, fecha: e.target.value}))} disabled={!!currentMovimiento} className="h-12 font-black text-lg border-2 rounded-2xl" />
                        </div>
                    </div>
                    
                    {/* SELECTOR DE MÁQUINA DESDE INVENTARIO */}
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary flex items-center gap-2">
                            <Cpu className="h-3 w-3" /> Número de Serie de la Máquina de Votación (Inventario)
                        </Label>
                        {currentMovimiento ? (
                            <Input value={salidaData.codigo_maquina} readOnly className="h-14 font-black text-xl border-2 rounded-2xl bg-muted/20" />
                        ) : (
                            <Select onValueChange={v => setSalidaData(p => ({...p, codigo_maquina: v}))} value={salidaData.codigo_maquina || undefined}>
                                <SelectTrigger className="h-14 border-2 rounded-2xl font-black text-xl uppercase">
                                    <SelectValue placeholder="Seleccione serie de máquina..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {!maquinasInventario || maquinasInventario.length === 0 ? (
                                        <div className="p-4 text-center text-[10px] font-black uppercase text-destructive italic">
                                            Sin máquinas cargadas en este distrito
                                        </div>
                                    ) : (
                                        maquinasInventario.map(m => (
                                            <SelectItem key={m.id} value={m.codigo} className="font-black text-sm uppercase">
                                                {m.codigo}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        )}
                        {!currentMovimiento && (!maquinasInventario || maquinasInventario.length === 0) && (
                            <p className="text-[9px] font-bold text-destructive uppercase mt-1">
                                No hay equipos asignados a esta jurisdicción en el Inventario. Contacte al Administrador.
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Lugar de la Divulgación</Label>
                        <Input value={selectedSolicitud?.lugar_local || ''} readOnly className="h-12 font-black uppercase border-2 rounded-2xl bg-muted/20" />
                    </div>
                </div>

                <div className="p-8 border-2 border-black rounded-3xl space-y-6">
                    <Label className="font-black uppercase text-xs text-primary">KITS DE LA MÁQUINA DE VOTACIÓN (SALIDA)</Label>
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <span className="text-[10px] font-bold uppercase shrink-0">• Nº DE SERIE DEL PENDRIVE:</span>
                            <Input value={salidaData.pendrive_serie} onChange={e => setSalidaData(p => ({...p, pendrive_serie: e.target.value}))} disabled={!!currentMovimiento} className="h-10 font-bold border-0 border-b-2 border-black rounded-none px-0" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { key: 'credencial', label: 'CREDENCIAL GENERICA' },
                                { key: 'auricular', label: 'AURICULAR GENERICO' },
                                { key: 'acrilico', label: 'ACRILICO GENERICO' },
                                { key: 'boletas', label: '5 BOLETAS DE CAPACITACION' }
                            ].map(k => (
                                <div key={k.key} className="flex items-center gap-3 cursor-pointer" onClick={() => !currentMovimiento && setSalidaData(p => ({...p, [k.key]: !(p as any)[k.key]}))}>
                                    <div className={cn("h-6 w-6 rounded-full border-2 border-black flex items-center justify-center transition-colors", (salidaData as any)[k.key] ? "bg-black text-white" : "bg-white")}>
                                        {(salidaData as any)[k.key] && <Check className="h-4 w-4 stroke-[4]" />}
                                    </div>
                                    <span className="text-[10px] font-black uppercase">{k.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-8 border-2 border-dashed border-primary/20 rounded-[2rem] space-y-6 bg-muted/5">
                    <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-primary" />
                        <Label className="font-black uppercase text-xs">Respaldo Documental Salida (F01 Firmado) *</Label>
                    </div>
                    {salidaFoto ? (
                        <div className="relative aspect-video rounded-xl overflow-hidden border-4 border-white shadow-xl group">
                            {salidaFoto.startsWith('data:application/pdf') ? (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-muted/30">
                                    <FileText className="h-16 w-16 text-primary opacity-40 mb-2" />
                                    <p className="text-[10px] font-black uppercase text-primary/60">Documento PDF Cargado</p>
                                </div>
                            ) : (
                                <Image src={salidaFoto} alt="Respaldo Salida" fill className="object-cover" />
                            )}
                            {!currentMovimiento && (
                                <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" onClick={() => setSalidaFoto(null)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/50 transition-all group bg-white" onClick={() => startCamera('salida')}>
                                <Camera className="h-8 w-8 text-muted-foreground group-hover:text-primary mb-1" />
                                <span className="text-[10px] font-black uppercase text-muted-foreground">Capturar F01</span>
                            </div>
                            <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/50 transition-all group bg-white">
                                <FileUp className="h-8 w-8 text-muted-foreground group-hover:text-primary mb-1" />
                                <span className="text-[10px] font-black uppercase text-muted-foreground">Subir de Galería</span>
                                <Input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => handleFileUpload(e, 'salida')} />
                            </label>
                        </div>
                    )}
                </div>
              </CardContent>
              {!currentMovimiento && (
                <CardFooter className="p-0 border-t">
                    <Button onClick={handleSaveSalida} disabled={isSubmitting || !salidaData.codigo_maquina || !salidaFoto} className="w-full h-20 text-xl font-black uppercase bg-black hover:bg-black/90 rounded-none tracking-widest">
                        {isSubmitting ? <Loader2 className="animate-spin mr-3" /> : <Truck className="mr-3" />}
                        REGISTRAR SALIDA Y GENERAR F01
                    </Button>
                </CardFooter>
              )}
            </Card>

            {/* SECCION B: DEVOLUCIÓN */}
            <Card className={cn("border-none shadow-2xl rounded-[2.5rem] overflow-hidden transition-all duration-500", !currentMovimiento ? "opacity-40 grayscale pointer-events-none" : "bg-white")}>
              <CardHeader className="p-8 border-b bg-muted/10 flex flex-row items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full border-4 border-black flex items-center justify-center font-black text-xl">B</div>
                    <div>
                        <CardTitle className="uppercase font-black text-xl leading-none">DEVOLUCIÓN DE MÁQUINA DE VOTACIÓN</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase mt-1">REINGRESO A OFICINA (FORMULARIO 02)</CardDescription>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="p-10 space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-primary">Fecha de Devolución</Label>
                                <Input type="date" value={devolucionData.fecha} onChange={e => setDevolucionData(p => ({...p, fecha: e.target.value}))} disabled={!!currentMovimiento?.devolucion} className="h-12 font-black border-2 rounded-2xl" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-primary">Hora de Devolución</Label>
                                <Input type="time" value={devolucionData.hora} onChange={e => setDevolucionData(p => ({...p, hora: e.target.value}))} disabled={!!currentMovimiento?.devolucion} className="h-12 font-black border-2 rounded-2xl" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Número de Serie de la Máquina</Label>
                            <Input value={salidaData.codigo_maquina} readOnly className="h-12 font-black border-2 rounded-2xl bg-muted/20" />
                        </div>
                    </div>

                    <div className="p-6 border-2 border-black rounded-3xl flex flex-col justify-center items-center gap-4 bg-[#F8F9FA]">
                        <Label className="font-black uppercase text-xs text-primary text-center">ESTADO DE LOS LACRES A LA DEVOLUCIÓN</Label>
                        <RadioGroup 
                            value={currentMovimiento?.devolucion?.lacre_estado || devolucionData.lacre_estado} 
                            onValueChange={(v: any) => setDevolucionData(p => ({...p, lacre_estado: v}))}
                            disabled={!!currentMovimiento?.devolucion}
                            className="flex gap-10"
                        >
                            <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => !currentMovimiento?.devolucion && setDevolucionData(p => ({...p, lacre_estado: 'correcto'}))}>
                                <div className={cn("h-10 w-10 rounded-full border-4 flex items-center justify-center transition-all", (devolucionData.lacre_estado === 'correcto' || currentMovimiento?.devolucion?.lacre_estado === 'correcto') ? "border-black bg-black text-white" : "border-muted")}>
                                    <RadioGroupItem value="correcto" className="hidden" />
                                    <Check className="h-6 w-6 stroke-[4]" />
                                </div>
                                <span className="text-[9px] font-black uppercase">CORRECTO</span>
                            </div>
                            <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => !currentMovimiento?.devolucion && setDevolucionData(p => ({...p, lacre_estado: 'violentado'}))}>
                                <div className={cn("h-10 w-10 rounded-full border-4 flex items-center justify-center transition-all", (devolucionData.lacre_estado === 'violentado' || currentMovimiento?.devolucion?.lacre_estado === 'violentado') ? "border-destructive bg-destructive text-white" : "border-muted")}>
                                    <RadioGroupItem value="violentado" className="hidden" />
                                    <ShieldAlert className="h-6 w-6" />
                                </div>
                                <span className="text-[9px] font-black uppercase text-destructive">VIOLENTADO</span>
                            </div>
                        </RadioGroup>
                    </div>
                </div>

                <div className="p-8 border-2 border-black rounded-3xl space-y-6">
                    <Label className="font-black uppercase text-xs text-primary">KITS DE LA MÁQUINA DE VOTACIÓN (DEVOLUCIÓN)</Label>
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <span className="text-[10px] font-bold uppercase shrink-0">• Nº DE SERIE DEL PENDRIVE:</span>
                            <Input value={devolucionData.pendrive_serie} onChange={e => setDevolucionData(p => ({...p, pendrive_serie: e.target.value}))} disabled={!!currentMovimiento?.devolucion} className="h-10 font-bold border-0 border-b-2 border-black rounded-none px-0" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { key: 'credencial', label: 'CREDENCIAL GENERICA' },
                                { key: 'auricular', label: 'AURICULAR GENERICO' },
                                { key: 'acrilico', label: 'ACRILICO GENERICO' },
                                { key: 'boletas', label: '5 BOLETAS DE CAPACITACION' }
                            ].map(k => (
                                <div key={k.key} className="flex items-center gap-3 cursor-pointer" onClick={() => !currentMovimiento?.devolucion && setDevolucionData(p => ({...p, [k.key]: !(p as any)[k.key]}))}>
                                    <div className={cn("h-6 w-6 rounded-full border-2 border-black flex items-center justify-center transition-colors", (devolucionData as any)[k.key] ? "bg-black text-white" : "bg-white")}>
                                        {(devolucionData as any)[k.key] && <Check className="h-4 w-4 stroke-[4]" />}
                                    </div>
                                    <span className="text-[10px] font-black uppercase">{k.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-8 border-2 border-dashed border-primary/20 rounded-[2rem] space-y-6 bg-muted/5">
                    <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-primary" />
                        <Label className="font-black uppercase text-xs">Respaldo Documental Devolución (F02 Firmado) *</Label>
                    </div>
                    {devolucionFoto ? (
                        <div className="relative aspect-video rounded-xl overflow-hidden border-4 border-white shadow-xl group">
                            {devolucionFoto.startsWith('data:application/pdf') ? (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-muted/30">
                                    <FileText className="h-16 w-16 text-primary opacity-40 mb-2" />
                                    <p className="text-[10px] font-black uppercase text-primary/60">Documento PDF Cargado</p>
                                </div>
                            ) : (
                                <Image src={devolucionFoto} alt="Respaldo Devolución" fill className="object-cover" />
                            )}
                            {currentMovimiento && !currentMovimiento.devolucion && (
                                <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" onClick={() => setDevolucionFoto(null)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/50 transition-all group bg-white" onClick={() => startCamera('devolucion')}>
                                <Camera className="h-8 w-8 text-muted-foreground group-hover:text-primary mb-1" />
                                <span className="text-[10px] font-black uppercase text-muted-foreground">Capturar F02</span>
                            </div>
                            <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/50 transition-all group bg-white">
                                <FileUp className="h-8 w-8 text-muted-foreground group-hover:text-primary mb-1" />
                                <span className="text-[10px] font-black uppercase text-muted-foreground">Subir de Galería</span>
                                <Input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => handleFileUpload(e, 'devolucion')} />
                            </label>
                        </div>
                    )}
                </div>

                {(devolucionData.lacre_estado === 'violentado' || currentMovimiento?.devolucion?.lacre_estado === 'violentado') && (
                    <Card className="border-4 border-destructive bg-destructive/5 animate-in shake duration-500">
                        <CardHeader className="bg-destructive text-white py-4">
                            <CardTitle className="text-sm font-black uppercase flex items-center gap-3">
                                <FileWarning className="h-6 w-6" /> IRREGULARIDAD DETECTADA: LACRE VIOLENTADO
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 text-center space-y-6">
                            <p className="font-bold text-sm uppercase text-destructive">EL SISTEMA HA DETECTADO QUE LOS LACRES HAN SIDO ADULTERADOS. ES OBLIGATORIO REGISTRAR LA DENUNCIA OFICIAL PARA CERRAR ESTE CICLO.</p>
                            <Link href={`/denuncia-lacres?solicitudId=${selectedSolicitudId}`} className="block">
                                <Button className="bg-destructive hover:bg-destructive/90 text-white font-black uppercase text-lg h-16 px-12 shadow-2xl rounded-2xl w-full max-w-md">
                                    <ShieldAlert className="mr-3 h-6 w-6" /> IR AL FORMULARIO DE DENUNCIA
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                )}
              </CardContent>
              {currentMovimiento && !currentMovimiento.devolucion && (
                <CardFooter className="p-0 border-t bg-black overflow-hidden">
                    <Button 
                        onClick={handleSaveDevolucion} 
                        disabled={isSubmitting || devolucionData.lacre_estado === 'violentado' || !devolucionFoto} 
                        className={cn(
                            "w-full h-20 text-xl font-black uppercase rounded-none tracking-widest",
                            (devolucionData.lacre_estado === 'violentado' || !devolucionFoto) ? "bg-muted text-muted-foreground" : "bg-primary hover:bg-primary/90"
                        )}
                    >
                        {isSubmitting ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : <Undo2 className="mr-3 h-6 w-6" />}
                        {devolucionData.lacre_estado === 'violentado' ? 'BLOQUEADO POR ADULTERACIÓN' : !devolucionFoto ? 'FALTA RESPALDO DOCUMENTAL' : 'REGISTRAR DEVOLUCIÓN Y GENERAR F02'}
                    </Button>
                </CardFooter>
              )}
            </Card>
          </div>
        )}

        {!selectedSolicitudId && (
          <div className="flex flex-col items-center justify-center py-32 border-4 border-dashed rounded-[3rem] bg-white text-muted-foreground opacity-40">
            <ArrowLeftRight className="h-20 w-20 mb-6" />
            <p className="text-xl font-black uppercase tracking-widest">Seleccione una actividad para comenzar el control</p>
          </div>
        )}
      </main>

      <Dialog open={isCameraOpen} onOpenChange={(o) => !o && stopCamera()}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none bg-black rounded-[2rem]">
          <div className="relative aspect-[3/4] w-full bg-black flex items-center justify-center">
            <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
            <div className="absolute inset-8 border-2 border-white/20 rounded-xl pointer-events-none border-dashed" />
          </div>
          <DialogFooter className="p-8 bg-black/80 flex flex-row items-center justify-between gap-4">
            <Button variant="outline" className="rounded-full h-14 w-14 border-white/20 bg-white/10 text-white" onClick={stopCamera}><X className="h-6 w-6" /></Button>
            <Button className="flex-1 h-16 rounded-full bg-white text-black font-black uppercase text-sm shadow-2xl" onClick={takePhoto}>CAPTURAR</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
