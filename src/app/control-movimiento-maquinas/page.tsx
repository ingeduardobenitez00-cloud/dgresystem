
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
  Cpu,
  Minus,
  User
} from 'lucide-react';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, query, where, doc, updateDoc } from 'firebase/firestore';
import jsPDF from 'jspdf';
import { type SolicitudCapacitacion, type MovimientoMaquina, type MaquinaVotacion, type MaquinaMovimiento } from '@/lib/data';
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

  const [movimientoData, setMovimientoData] = useState({
    fecha_salida: '',
    hora_salida: '',
    fecha_devolucion: '',
    hora_devolucion: '',
    maquinas: [] as MaquinaMovimiento[],
  });

  useEffect(() => {
    const now = new Date();
    setMovimientoData(p => ({
      ...p,
      fecha_salida: now.toISOString().split('T')[0],
      hora_salida: now.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false }),
      fecha_devolucion: now.toISOString().split('T')[0],
      hora_devolucion: now.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false }),
      maquinas: [{ codigo: '', pendrive_serie: '', credencial: false, auricular: false, acrilico: false, boletas: false }]
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

  const agendaQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !profile) return null;
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    return query(colRef, where('departamento', '==', profile.departamento), where('distrito', '==', profile.distrito));
  }, [firestore, isUserLoading, profile]);

  const { data: rawAgendaItems, isLoading: isLoadingAgenda } = useCollection<SolicitudCapacitacion>(agendaQuery);

  const maquinasQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !profile) return null;
    return query(collection(firestore, 'maquinas'), where('departamento', '==', profile.departamento), where('distrito', '==', profile.distrito));
  }, [firestore, isUserLoading, profile]);

  const { data: maquinasInventario, isLoading: isLoadingMaquinas } = useCollection<MaquinaVotacion>(maquinasQuery);

  const movimientosQueryAll = useMemoFirebase(() => firestore ? collection(firestore, 'movimientos-maquinas') : null, [firestore]);
  const { data: allMovimientos } = useCollection<MovimientoMaquina>(movimientosQueryAll);

  const agendaItems = useMemo(() => {
    if (!rawAgendaItems) return [];
    return [...rawAgendaItems]
      .filter(item => {
        if (item.cancelada) return false;
        const mov = allMovimientos?.find(m => m.solicitud_id === item.id);
        const hasReturn = !!(mov?.fecha_devolucion);
        if (hasReturn && item.id !== selectedSolicitudId) return false;
        return true;
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [rawAgendaItems, allMovimientos, selectedSolicitudId]);

  const currentMovimiento = useMemo(() => {
    return allMovimientos?.find(m => m.solicitud_id === selectedSolicitudId) || null;
  }, [allMovimientos, selectedSolicitudId]);

  const selectedSolicitud = useMemo(() => {
    return rawAgendaItems?.find(item => item.id === selectedSolicitudId);
  }, [rawAgendaItems, selectedSolicitudId]);

  useEffect(() => {
    if (currentMovimiento) {
        setMovimientoData({
            fecha_salida: currentMovimiento.fecha_salida,
            hora_salida: currentMovimiento.hora_salida,
            fecha_devolucion: currentMovimiento.fecha_devolucion || new Date().toISOString().split('T')[0],
            hora_devolucion: currentMovimiento.hora_devolucion || new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false }),
            maquinas: currentMovimiento.maquinas
        });
        setSalidaFoto(currentMovimiento.foto_salida || null);
        setDevolucionFoto(currentMovimiento.foto_devolucion || null);
    } else {
        const now = new Date();
        setMovimientoData(p => ({
            ...p,
            fecha_salida: now.toISOString().split('T')[0],
            hora_salida: now.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false }),
            maquinas: [{ codigo: '', pendrive_serie: '', credencial: false, auricular: false, acrilico: false, boletas: false }]
        }));
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

  const handleAddMaquina = () => {
    if (movimientoData.maquinas.length < 3) {
        setMovimientoData(prev => ({
            ...prev,
            maquinas: [...prev.maquinas, { codigo: '', pendrive_serie: '', credencial: false, auricular: false, acrilico: false, boletas: false }]
        }));
    }
  };

  const handleRemoveMaquina = (index: number) => {
    setMovimientoData(prev => ({
        ...prev,
        maquinas: prev.maquinas.filter((_, i) => i !== index)
    }));
  };

  const updateMaquina = (index: number, field: keyof MaquinaMovimiento, value: any) => {
    const newMaquinas = [...movimientoData.maquinas];
    newMaquinas[index] = { ...newMaquinas[index], [field]: value };
    setMovimientoData(prev => ({ ...prev, maquinas: newMaquinas }));
  };

  const handleSaveSalida = () => {
    if (!firestore || !user || !selectedSolicitud) return;
    if (movimientoData.maquinas.some(m => !m.codigo)) {
      toast({ variant: 'destructive', title: 'Todas las máquinas deben tener Nº de Serie' });
      return;
    }
    if (!salidaFoto) {
      toast({ variant: 'destructive', title: 'Respaldo Documental requerido' });
      return;
    }

    setIsSubmitting(true);
    const docData: Omit<MovimientoMaquina, 'id'> = {
      solicitud_id: selectedSolicitudId!,
      departamento: selectedSolicitud.departamento || '',
      distrito: selectedSolicitud.distrito || '',
      maquinas: movimientoData.maquinas,
      fecha_salida: movimientoData.fecha_salida,
      hora_salida: movimientoData.hora_salida,
      foto_salida: salidaFoto,
      responsables: selectedSolicitud.divulgadores || [],
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
    if (movimientoData.maquinas.some(m => !m.lacre_estado)) {
        toast({ variant: 'destructive', title: 'Debe verificar el lacre de todas las máquinas' });
        return;
    }
    if (!devolucionFoto) {
      toast({ variant: 'destructive', title: 'Respaldo Documental requerido' });
      return;
    }

    setIsSubmitting(true);
    const updateData = {
      fecha_devolucion: movimientoData.fecha_devolucion,
      hora_devolucion: movimientoData.hora_devolucion,
      maquinas: movimientoData.maquinas,
      foto_devolucion: devolucionFoto
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
    
    const drawHeader = () => {
        const leftLogoSize = 22;
        doc.addImage(logoBase64, 'PNG', margin, 8, leftLogoSize, leftLogoSize);
        const rightLogoW = 38;
        const rightLogoH = 16;
        doc.addImage(logo1Base64, 'PNG', pageWidth - margin - rightLogoW, 10, rightLogoW, rightLogoH);
        doc.setLineWidth(0.4);
        doc.line(margin, 35, pageWidth - margin, 35);
        doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.text("FORMULARIO SALIDA / DEVOLUCIÓN DE EQUIPOS PARA DIVULGACIÓN", pageWidth / 2, 42, { align: "center" });
    };

    drawHeader();

    let y = 48;
    const sectionHeight = 100;
    doc.setLineWidth(0.2);
    doc.roundedRect(margin, y, pageWidth - (margin * 2), sectionHeight, 3, 3);
    doc.circle(margin + 8, y + 6, 2.5);
    doc.setFontSize(7); doc.text("A", margin + 8, y + 7, { align: 'center' });
    doc.setFontSize(8); doc.text("SALIDA DE EQUIPOS PARA DIVULGACIÓN", margin + 15, y + 6.5);
    
    y += 12; doc.setFontSize(6.5); doc.text("EQUIPO RESPONSABLE DE LA DIVULGACIÓN", margin + 5, y);
    y += 2; 
    const responsablesList = selectedSolicitud.divulgadores?.map(a => `${a.nombre} (CI: ${a.cedula})`).join(", ") || "SIN ASIGNAR";
    doc.roundedRect(margin + 5, y, 165, 8, 1, 1);
    doc.setFont('helvetica', 'normal'); 
    const splitResp = doc.splitTextToSize(responsablesList.toUpperCase(), 160);
    doc.text(splitResp, margin + 8, y + 3.5);

    y += 12; doc.setFont('helvetica', 'bold'); doc.text("HORA SALIDA:", margin + 5, y);
    doc.roundedRect(margin + 25, y - 4, 20, 5, 1, 1); doc.text(`${movimientoData.hora_salida} HS`, margin + 27, y - 0.5);
    doc.text("FECHA:", margin + 60, y); doc.text(formatDateToDDMMYYYY(movimientoData.fecha_salida), margin + 75, y);
    doc.text("LUGAR:", margin + 110, y); doc.text(selectedSolicitud.lugar_local.toUpperCase().substring(0, 30), margin + 125, y);

    y += 8;
    doc.setFontSize(7);
    doc.text("DETALLE TÉCNICO DE EQUIPOS (MÁX. 3)", margin + 5, y);
    
    movimientoData.maquinas.forEach((m, idx) => {
        y += 6;
        doc.setFont('helvetica', 'bold');
        doc.text(`${idx + 1}. SERIE: ${m.codigo || '---'}`, margin + 5, y);
        doc.text(`PENDRIVE: ${m.pendrive_serie || '---'}`, margin + 60, y);
        doc.setFont('helvetica', 'normal');
        doc.text(`KITS: ${m.credencial ? 'CRE ' : ''}${m.auricular ? 'AUR ' : ''}${m.acrilico ? 'ACR ' : ''}${m.boletas ? 'BOL' : ''}`, margin + 120, y);
    });

    y += 15;
    const drawSign = (x: number, yP: number, lbl: string) => {
        doc.line(x, yP, x + 40, yP); doc.setFontSize(5); doc.text(lbl, x + 20, yP + 3, { align: 'center' });
    }
    drawSign(margin + 5, y, "FIRMA JEFE"); drawSign(margin + 65, y, "FIRMA JEFE"); drawSign(margin + 125, y, "REPRESENTANTE EQUIPO");

    y = 155; 
    doc.roundedRect(margin, y, pageWidth - (margin * 2), sectionHeight, 3, 3);
    doc.circle(margin + 8, y + 6, 2.5); doc.setFontSize(7); doc.text("B", margin + 8, y + 7, { align: 'center' });
    doc.setFontSize(8); doc.text("DEVOLUCIÓN DE EQUIPOS PARA DIVULGACIÓN", margin + 15, y + 6.5);
    
    y += 12; doc.setFont('helvetica', 'bold'); doc.text("FECHA REINGRESO:", margin + 5, y); 
    doc.text(formatDateToDDMMYYYY(movimientoData.fecha_devolucion), margin + 35, y);
    doc.text("HORA:", margin + 80, y); doc.text(`${movimientoData.hora_devolucion} HS`, margin + 95, y);

    y += 8;
    movimientoData.maquinas.forEach((m, idx) => {
        y += 6;
        doc.text(`${idx + 1}. SERIE: ${m.codigo || '---'}`, margin + 5, y);
        doc.text(`LACRE: ${(m.lacre_estado || '---').toUpperCase()}`, margin + 80, y);
    });

    y += 25;
    drawSign(margin + 5, y, "FIRMA JEFE"); drawSign(margin + 65, y, "FIRMA JEFE"); drawSign(margin + 125, y, "REPRESENTANTE EQUIPO");

    doc.save(`Movimiento-Equipo-${selectedSolicitud.lugar_local.replace(/\s+/g, '-')}.pdf`);
  };

  if (isUserLoading || isLoadingAgenda || isLoadingMaquinas) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Movimiento de Máquinas" />
      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-4">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Control Logístico</h1>
                <p className="text-muted-foreground text-[10px] font-bold uppercase flex items-center gap-2 mt-1 tracking-widest">
                    <ArrowLeftRight className="h-3.5 w-3.5" /> Trazabilidad de equipos por evento
                </p>
            </div>
            {selectedSolicitudId && (
                <Button variant="outline" className="font-black uppercase text-[10px] border-2 h-11 gap-2 shadow-xl bg-white" onClick={generatePDF}>
                    <Printer className="h-4 w-4" /> GENERAR PROFORMA EQUIPO (A/B)
                </Button>
            )}
        </div>

        <Card className="border-primary/20 shadow-md">
          <CardHeader className="py-4 bg-primary/5">
            <CardTitle className="text-[10px] font-black flex items-center gap-2 uppercase tracking-widest text-primary">
              <CalendarDays className="h-4 w-4" /> SELECCIONAR ACTIVIDAD DE AGENDA
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
              <CardHeader className="p-8 border-b bg-[#F8F9FA]">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full border-4 border-black flex items-center justify-center font-black text-xl">A</div>
                    <div>
                        <CardTitle className="uppercase font-black text-xl leading-none">SALIDA DE EQUIPOS</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase mt-1">FORMULARIO 01 - REGISTRO DE SALIDA</CardDescription>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="p-10 space-y-10">
                
                <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Equipo de Trabajo Responsable</Label>
                    <div className="flex flex-wrap gap-3 p-6 bg-muted/20 rounded-[1.5rem] border-2 border-dashed">
                        {selectedSolicitud?.divulgadores && selectedSolicitud.divulgadores.length > 0 ? (
                            selectedSolicitud.divulgadores.map(a => (
                                <div key={a.id} className="bg-white border-2 border-black/5 rounded-2xl p-4 flex flex-col gap-1 shadow-sm min-w-[200px]">
                                    <div className="flex items-center gap-2 border-b pb-2 mb-1">
                                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                                            <User className="h-3 w-3 text-primary" />
                                        </div>
                                        <span className="text-[11px] font-black uppercase truncate">{a.nombre}</span>
                                    </div>
                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-[9px] font-bold text-muted-foreground uppercase">C.I. {a.cedula}</span>
                                        <Badge variant="outline" className="text-[7px] font-black uppercase py-0 px-2 h-4 border-primary/20">{a.vinculo}</Badge>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex items-center gap-3 text-destructive opacity-60">
                                <ShieldAlert className="h-5 w-5" />
                                <span className="text-[10px] font-black uppercase italic">Sin personal asignado en la agenda de este distrito</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary">Fecha de Salida</Label>
                        <Input type="date" value={movimientoData.fecha_salida} onChange={e => setMovimientoData(p => ({...p, fecha_salida: e.target.value}))} disabled={!!currentMovimiento} className="h-12 font-black border-2 rounded-2xl" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary">Hora de Salida</Label>
                        <Input type="time" value={movimientoData.hora_salida} onChange={e => setMovimientoData(p => ({...p, hora_salida: e.target.value}))} disabled={!!currentMovimiento} className="h-12 font-black border-2 rounded-2xl" />
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <Label className="text-[11px] font-black uppercase text-primary tracking-widest">DETALLE TÉCNICO DE MÁQUINAS</Label>
                        {!currentMovimiento && movimientoData.maquinas.length < 3 && (
                            <Button variant="outline" size="sm" onClick={handleAddMaquina} className="font-black text-[9px] uppercase gap-2 border-2 rounded-xl">
                                <Plus className="h-3.5 w-3.5" /> AGREGAR MÁQUINA
                            </Button>
                        )}
                    </div>

                    <div className="space-y-6">
                        {movimientoData.maquinas.map((maq, idx) => (
                            <div key={idx} className="p-8 border-2 border-black rounded-[2rem] space-y-6 relative bg-[#F8F9FA]/50">
                                <div className="absolute -top-3 left-8 bg-black text-white px-4 py-1 rounded-full text-[10px] font-black uppercase">
                                    MÁQUINA #{idx + 1}
                                </div>
                                {!currentMovimiento && idx > 0 && (
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveMaquina(idx)} className="absolute top-4 right-4 text-destructive hover:bg-destructive/10">
                                        <Minus className="h-4 w-4" />
                                    </Button>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-2">
                                            <Cpu className="h-3 w-3" /> Nº de Serie (Inventario)
                                        </Label>
                                        <Select 
                                            value={maq.codigo || undefined} 
                                            onValueChange={(v) => updateMaquina(idx, 'codigo', v)}
                                            disabled={!!currentMovimiento}
                                        >
                                            <SelectTrigger className="h-12 border-2 rounded-xl font-black uppercase">
                                                <SelectValue placeholder="Seleccione serie..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {maquinasInventario?.map(m => (
                                                    <SelectItem key={m.id} value={m.codigo} className="font-black text-xs uppercase">{m.codigo}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-2">
                                            Nº Serie del Pendrive
                                        </Label>
                                        <Input 
                                            value={maq.pendrive_serie} 
                                            onChange={(e) => updateMaquina(idx, 'pendrive_serie', e.target.value.toUpperCase())}
                                            disabled={!!currentMovimiento}
                                            className="h-12 border-2 rounded-xl font-bold uppercase"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { key: 'credencial', label: 'CREDENCIAL' },
                                        { key: 'auricular', label: 'AURICULAR' },
                                        { key: 'acrilico', label: 'ACRÍLICO' },
                                        { key: 'boletas', label: '5 BOLETAS' }
                                    ].map(k => (
                                        <div key={k.key} className="flex items-center gap-2 cursor-pointer" onClick={() => !currentMovimiento && updateMaquina(idx, k.key as any, !maq[k.key as keyof MaquinaMovimiento])}>
                                            <div className={cn("h-5 w-5 rounded-md border-2 border-black flex items-center justify-center", maq[k.key as keyof MaquinaMovimiento] ? "bg-black text-white" : "bg-white")}>
                                                {maq[k.key as keyof MaquinaMovimiento] && <Check className="h-3.5 w-3.5 stroke-[4]" />}
                                            </div>
                                            <span className="text-[9px] font-black uppercase">{k.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
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
                                    <p className="text-[10px] font-black uppercase text-primary/60">PDF Cargado</p>
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
                    <Button onClick={handleSaveSalida} disabled={isSubmitting || movimientoData.maquinas.some(m => !m.codigo) || !salidaFoto} className="w-full h-20 text-xl font-black uppercase bg-black hover:bg-black/90 rounded-none tracking-widest">
                        {isSubmitting ? <Loader2 className="animate-spin mr-3" /> : <Truck className="mr-3" />}
                        REGISTRAR SALIDA EQUIPO
                    </Button>
                </CardFooter>
              )}
            </Card>

            {/* SECCION B: DEVOLUCIÓN */}
            <Card className={cn("border-none shadow-2xl rounded-[2.5rem] overflow-hidden transition-all duration-500", !currentMovimiento ? "opacity-40 grayscale pointer-events-none" : "bg-white")}>
              <CardHeader className="p-8 border-b bg-muted/10">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full border-4 border-black flex items-center justify-center font-black text-xl">B</div>
                    <div>
                        <CardTitle className="uppercase font-black text-xl leading-none">DEVOLUCIÓN DE EQUIPOS</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase mt-1">FORMULARIO 02 - REINGRESO A OFICINA</CardDescription>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="p-10 space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-primary">Fecha de Reingreso</Label>
                                <Input type="date" value={movimientoData.fecha_devolucion} onChange={e => setMovimientoData(p => ({...p, fecha_devolucion: e.target.value}))} disabled={!!currentMovimiento?.fecha_devolucion} className="h-12 font-black border-2 rounded-2xl" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-primary">Hora de Reingreso</Label>
                                <Input type="time" value={movimientoData.hora_devolucion} onChange={e => setMovimientoData(p => ({...p, hora_devolucion: e.target.value}))} disabled={!!currentMovimiento?.fecha_devolucion} className="h-12 font-black border-2 rounded-2xl" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <Label className="text-[11px] font-black uppercase text-primary tracking-widest">VERIFICACIÓN DE LACRES AL REINGRESO</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {movimientoData.maquinas.map((maq, idx) => (
                            <div key={idx} className="p-6 border-2 border-black rounded-3xl space-y-4 bg-[#F8F9FA]">
                                <p className="text-center font-black text-[10px] uppercase">SERIE: {maq.codigo}</p>
                                <RadioGroup 
                                    value={maq.lacre_estado || ''} 
                                    onValueChange={(v: any) => updateMaquina(idx, 'lacre_estado', v)}
                                    disabled={!!currentMovimiento?.fecha_devolucion}
                                    className="flex justify-center gap-6"
                                >
                                    <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => !currentMovimiento?.fecha_devolucion && updateMaquina(idx, 'lacre_estado', 'correcto')}>
                                        <div className={cn("h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all", maq.lacre_estado === 'correcto' ? "border-black bg-black text-white" : "border-muted")}>
                                            <Check className="h-4 w-4 stroke-[4]" />
                                        </div>
                                        <span className="text-[8px] font-black uppercase">CORRECTO</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => !currentMovimiento?.fecha_devolucion && updateMaquina(idx, 'lacre_estado', 'violentado')}>
                                        <div className={cn("h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all", maq.lacre_estado === 'violentado' ? "border-destructive bg-destructive text-white" : "border-muted")}>
                                            <ShieldAlert className="h-4 w-4" />
                                        </div>
                                        <span className="text-[8px] font-black uppercase text-destructive">DAÑADO</span>
                                    </div>
                                </RadioGroup>
                            </div>
                        ))}
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
                            {currentMovimiento && !currentMovimiento.fecha_devolucion && (
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

                {movimientoData.maquinas.some(m => m.lacre_estado === 'violentado') && (
                    <Card className="border-4 border-destructive bg-destructive/5 animate-in shake duration-500">
                        <CardHeader className="bg-destructive text-white py-4">
                            <CardTitle className="text-sm font-black uppercase flex items-center gap-3">
                                <FileWarning className="h-6 w-6" /> IRREGULARIDAD DETECTADA EN LACRES
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 text-center space-y-6">
                            <p className="font-bold text-sm uppercase text-destructive">SE HA DETECTADO MANIPULACIÓN EN AL MENOS UN EQUIPO. ES OBLIGATORIO REGISTRAR LA DENUNCIA OFICIAL PARA CERRAR EL CICLO.</p>
                            <Link href={`/denuncia-lacres?solicitudId=${selectedSolicitudId}`} className="block">
                                <Button className="bg-destructive hover:bg-destructive/90 text-white font-black uppercase text-lg h-16 px-12 shadow-2xl rounded-2xl w-full max-w-md">
                                    <ShieldAlert className="mr-3 h-6 w-6" /> IR AL FORMULARIO DE DENUNCIA
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                )}
              </CardContent>
              {currentMovimiento && !currentMovimiento.fecha_devolucion && (
                <CardFooter className="p-0 border-t bg-black overflow-hidden">
                    <Button 
                        onClick={handleSaveDevolucion} 
                        disabled={isSubmitting || movimientoData.maquinas.some(m => m.lacre_estado === 'violentado') || movimientoData.maquinas.some(m => !m.lacre_estado) || !devolucionFoto} 
                        className={cn(
                            "w-full h-20 text-xl font-black uppercase rounded-none tracking-widest",
                            (movimientoData.maquinas.some(m => m.lacre_estado === 'violentado') || !devolucionFoto) ? "bg-muted text-muted-foreground" : "bg-primary hover:bg-primary/90"
                        )}
                    >
                        {isSubmitting ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : <Undo2 className="mr-3 h-6 w-6" />}
                        {movimientoData.maquinas.some(m => m.lacre_estado === 'violentado') ? 'BLOQUEADO POR ADULTERACIÓN' : 'REGISTRAR DEVOLUCIÓN EQUIPOS'}
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
