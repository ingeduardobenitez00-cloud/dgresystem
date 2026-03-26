"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  ArrowLeftRight, 
  Truck, 
  Undo2, 
  CalendarDays, 
  Printer,
  ShieldAlert,
  FileWarning,
  Check,
  Camera,
  FileUp,
  X,
  Trash2,
  FileText,
  Cpu,
  Minus,
  User,
  Plus,
  CheckCircle2
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
    const isAdmin = ['admin', 'director'].includes(profile.role || '') || profile.permissions?.includes('admin_filter');
    
    if (isAdmin) return colRef;
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

  const denunciasQuery = useMemoFirebase(() => firestore ? collection(firestore, 'denuncias-lacres') : null, [firestore]);
  const { data: allDenuncias } = useCollection<any>(denunciasQuery);

  const agendaItems = useMemo(() => {
    if (!rawAgendaItems || !allMovimientos || !allDenuncias) return [];
    return [...rawAgendaItems]
      .filter(item => {
        if (item.cancelada) return false;
        
        const mov = allMovimientos.find(m => m.solicitud_id === item.id);
        const den = allDenuncias.find(d => d.solicitud_id === item.id);
        
        // 1. Si no hay movimiento, está pendiente de salida
        if (!mov) return true;
        
        // 2. Si hay movimiento pero NO tiene devolución, está pendiente de regreso
        if (!mov.fecha_devolucion) return true;
        
        // 3. Si hay devolución:
        const hasTampering = mov.maquinas.some(m => m.lacre_estado === 'violentado');
        
        // Si hay adulteración pero NO hay denuncia, el proceso sigue abierto (bloqueado)
        if (hasTampering && !den) return true;
        
        // Si todo está correcto O ya se denunció, el proceso terminó (se quita de la lista activa)
        return false;
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [rawAgendaItems, allMovimientos, allDenuncias]);

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
      toast({ variant: 'destructive', title: 'Falta Serie', description: 'Todas las máquinas deben tener Nº de Serie' });
      return;
    }
    if (!salidaFoto) {
      toast({ variant: 'destructive', title: 'Falta Respaldo', description: 'Debe capturar la foto del F01 firmado.' });
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
        toast({ variant: 'destructive', title: 'Verificación requerida', description: 'Debe verificar el lacre de todas las máquinas.' });
        return;
    }
    if (!devolucionFoto) {
      toast({ variant: 'destructive', title: 'Respaldo requerido', description: 'Debe capturar la foto del F02 firmado.' });
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
        const hasTampering = movimientoData.maquinas.some(m => m.lacre_estado === 'violentado');
        if (hasTampering) {
            toast({ title: 'Devolución parcial', description: 'Irregularidad detectada. Proceda a realizar la denuncia.' });
        } else {
            toast({ title: '¡Devolución Exitosa!', description: 'Ciclo logístico cerrado correctamente.' });
            setTimeout(() => setSelectedSolicitudId(null), 1500);
        }
        setIsSubmitting(false);
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: updateData }));
        setIsSubmitting(false);
      });
  };

  const generatePDF = () => {
    if (!selectedSolicitud || !logoBase64) return;
    const doc = new jsPDF();
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.addImage(logoBase64, 'PNG', margin, 8, 22, 22);
    doc.setLineWidth(0.4);
    doc.line(margin, 35, pageWidth - margin, 35);
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text("FORMULARIO SALIDA / DEVOLUCIÓN DE EQUIPOS", pageWidth / 2, 42, { align: "center" });

    let y = 48;
    doc.setLineWidth(0.2);
    doc.roundedRect(margin, y, pageWidth - (margin * 2), 100, 3, 3);
    doc.text("A. SALIDA DE EQUIPOS", margin + 15, y + 6.5);
    
    y += 15; doc.setFontSize(7); doc.text("EQUIPO RESPONSABLE:", margin + 5, y);
    y += 2; const responsablesList = selectedSolicitud.divulgadores?.map(a => `${a.nombre} (CI: ${a.cedula})`).join(", ") || "SIN ASIGNAR";
    doc.setFont('helvetica', 'normal'); doc.text(responsablesList.toUpperCase(), margin + 8, y + 4);

    y += 15; doc.setFont('helvetica', 'bold'); doc.text(`FECHA: ${formatDateToDDMMYYYY(movimientoData.fecha_salida)} | HORA: ${movimientoData.hora_salida} HS`, margin + 5, y);
    
    y += 10;
    movimientoData.maquinas.forEach((m, idx) => {
        y += 6; doc.text(`${idx + 1}. SERIE: ${m.codigo || '---'} | PENDRIVE: ${m.pendrive_serie || '---'}`, margin + 5, y);
    });

    y = 155; 
    doc.roundedRect(margin, y, pageWidth - (margin * 2), 100, 3, 3);
    doc.text("B. DEVOLUCIÓN DE EQUIPOS", margin + 15, y + 6.5);
    
    y += 12; doc.text(`FECHA REINGRESO: ${formatDateToDDMMYYYY(movimientoData.fecha_devolucion)} | HORA: ${movimientoData.hora_devolucion} HS`, margin + 5, y);

    y += 8;
    movimientoData.maquinas.forEach((m, idx) => {
        y += 6; doc.text(`${idx + 1}. SERIE: ${m.codigo || '---'} | LACRE: ${(m.lacre_estado || '---').toUpperCase()}`, margin + 5, y);
    });

    doc.save(`Movimiento-${selectedSolicitud.lugar_local.replace(/\s+/g, '-')}.pdf`);
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
                    <ArrowLeftRight className="h-3.5 w-3.5" /> Registro de trazabilidad por evento agendado
                </p>
            </div>
            {selectedSolicitudId && (
                <Button variant="outline" className="font-black uppercase text-[10px] border-2 h-11 gap-2 shadow-xl bg-white" onClick={generatePDF}>
                    <Printer className="h-4 w-4" /> GENERAR PROFORMA PDF
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
                  <div className="p-10 text-center space-y-2 opacity-40">
                    <CheckCircle2 className="h-8 w-8 mx-auto text-green-600" />
                    <p className="text-[9px] font-black uppercase tracking-widest">No hay actividades activas en agenda</p>
                  </div>
                ) : (
                  agendaItems?.map(item => (
                    <SelectItem key={item.id} value={item.id} className="font-bold text-xs uppercase">{formatDateToDDMMYYYY(item.fecha)} | {item.lugar_local}</SelectItem>
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
                        <CardDescription className="text-[10px] font-bold uppercase mt-1">REGISTRO DE DESPACHO (F01)</CardDescription>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="p-10 space-y-10">
                
                <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Personal Responsable Asignado</Label>
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
                            <div className="flex items-center gap-3 text-destructive opacity-60 py-4 w-full justify-center">
                                <ShieldAlert className="h-5 w-5" />
                                <span className="text-[10px] font-black uppercase italic">Sin personal asignado en la agenda</span>
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
                        <Label className="text-[11px] font-black uppercase text-primary tracking-widest">DETALLE TÉCNICO DE MÁQUINAS (MÁX. 3)</Label>
                        {!currentMovimiento && movimientoData.maquinas.length < 3 && (
                            <Button variant="outline" size="sm" onClick={handleAddMaquina} className="font-black text-[9px] uppercase gap-2 border-2 rounded-xl h-9">
                                <Plus className="h-3.5 w-3.5" /> SUMAR MÁQUINA
                            </Button>
                        )}
                    </div>

                    <div className="space-y-6">
                        {movimientoData.maquinas.map((maq, idx) => (
                            <div key={idx} className="p-8 border-2 border-black rounded-[2rem] space-y-6 relative bg-[#F8F9FA]/50 shadow-inner">
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
                                            <Cpu className="h-3 w-3" /> Nº de Serie del Inventario
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
                                                {maquinasInventario?.length === 0 ? (
                                                    <div className="p-4 text-center text-[9px] font-black uppercase text-destructive">No hay máquinas en inventario</div>
                                                ) : (
                                                    maquinasInventario?.map(m => (
                                                        <SelectItem key={m.id} value={m.codigo} className="font-black text-xs uppercase">{m.codigo}</SelectItem>
                                                    ))
                                                )}
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
                                            <span className="text-[9px] font-black uppercase tracking-tighter">{k.label}</span>
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
                        {isSubmitting ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : <Truck className="mr-3 h-6 w-6" />}
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
                        <CardDescription className="text-[10px] font-bold uppercase mt-1">RECEPCIÓN Y VERIFICACIÓN (F02)</CardDescription>
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
                    <Label className="text-[11px] font-black uppercase text-primary tracking-widest text-center block w-full">AUDITORÍA DE LACRES AL REINGRESO</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {movimientoData.maquinas.map((maq, idx) => (
                            <div key={idx} className="p-8 border-2 border-black rounded-[2rem] space-y-6 bg-white shadow-sm relative overflow-hidden transition-all hover:shadow-md">
                                <div className="absolute top-0 left-0 w-full h-1 bg-black/5" />
                                <div className="text-center space-y-1">
                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Identificación del Equipo</p>
                                    <p className="font-black text-[13px] uppercase tracking-tighter text-primary">{maq.codigo || 'S/N'}</p>
                                </div>
                                
                                <div className="flex justify-around items-center pt-2">
                                    <div 
                                        className="flex flex-col items-center gap-3 cursor-pointer group" 
                                        onClick={() => !currentMovimiento?.fecha_devolucion && updateMaquina(idx, 'lacre_estado', 'correcto')}
                                    >
                                        <div className={cn(
                                            "h-14 w-14 rounded-full border-[3px] flex items-center justify-center transition-all duration-300 shadow-sm", 
                                            maq.lacre_estado === 'correcto' 
                                                ? "border-black bg-black text-white scale-110" 
                                                : "border-muted-foreground/20 bg-muted/30 group-hover:border-black/30"
                                        )}>
                                            <Check className={cn("h-7 w-7 transition-all", maq.lacre_estado === 'correcto' ? "stroke-[4]" : "stroke-[2] opacity-30")} />
                                        </div>
                                        <span className={cn(
                                            "text-[9px] font-black uppercase tracking-widest transition-colors",
                                            maq.lacre_estado === 'correcto' ? "text-black" : "text-muted-foreground"
                                        )}>CORRECTO</span>
                                    </div>

                                    <div className="h-12 w-px bg-muted-foreground/10" />

                                    <div 
                                        className="flex flex-col items-center gap-3 cursor-pointer group" 
                                        onClick={() => !currentMovimiento?.fecha_devolucion && updateMaquina(idx, 'lacre_estado', 'violentado')}
                                    >
                                        <div className={cn(
                                            "h-14 w-14 rounded-full border-[3px] flex items-center justify-center transition-all duration-300 shadow-sm", 
                                            maq.lacre_estado === 'violentado' 
                                                ? "border-destructive bg-destructive text-white scale-110" 
                                                : "border-muted-foreground/20 bg-muted/30 group-hover:border-destructive/30"
                                        )}>
                                            <ShieldAlert className={cn("h-7 w-7 transition-all", maq.lacre_estado === 'violentado' ? "opacity-100" : "opacity-30")} />
                                        </div>
                                        <span className={cn(
                                            "text-[9px] font-black uppercase tracking-widest transition-colors",
                                            maq.lacre_estado === 'violentado' ? "text-destructive" : "text-muted-foreground"
                                        )}>VIOLENTADO</span>
                                    </div>
                                </div>
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
                    <Card className="border-4 border-destructive bg-destructive/5 animate-in shake duration-500 rounded-3xl">
                        <CardHeader className="bg-destructive text-white py-4 px-8">
                            <CardTitle className="text-sm font-black uppercase flex items-center gap-3">
                                <FileWarning className="h-6 w-6" /> IRREGULARIDAD DETECTADA EN SEGURIDAD
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-10 text-center space-y-6">
                            <p className="font-bold text-sm uppercase text-destructive leading-relaxed">
                                SE HA DETECTADO MANIPULACIÓN EN AL MENOS UN EQUIPO. EL CICLO LOGÍSTICO NO PODRÁ CERRARSE HASTA QUE SE REGISTRE LA DENUNCIA OFICIAL CORRESPONDIENTE.
                            </p>
                            <Link href={`/denuncia-lacres?solicitudId=${selectedSolicitudId}`} className="block">
                                <Button className="bg-destructive hover:bg-destructive/90 text-white font-black uppercase text-lg h-16 px-12 shadow-2xl rounded-2xl w-full max-w-md gap-3">
                                    <ShieldAlert className="h-6 w-6" /> IR AL MÓDULO DE DENUNCIA
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
                        disabled={isSubmitting || movimientoData.maquinas.some(m => !m.lacre_estado) || !devolucionFoto} 
                        className={cn(
                            "w-full h-20 text-xl font-black uppercase rounded-none tracking-widest",
                            (!devolucionFoto) ? "bg-muted text-muted-foreground" : "bg-primary hover:bg-primary/90"
                        )}
                    >
                        {isSubmitting ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : <Undo2 className="mr-3 h-6 w-6" />}
                        REGISTRAR RECEPCIÓN DE EQUIPOS
                    </Button>
                </CardFooter>
              )}
            </Card>
          </div>
        )}

        {!selectedSolicitudId && (
          <div className="flex flex-col items-center justify-center py-32 border-4 border-dashed rounded-[3rem] bg-white text-muted-foreground opacity-40">
            <ArrowLeftRight className="h-20 w-20 mb-6" />
            <p className="text-xl font-black uppercase tracking-widest">Seleccione una actividad para comenzar el control logístico</p>
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
