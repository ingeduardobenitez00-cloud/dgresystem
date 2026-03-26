"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calendar as CalendarIcon, MapPin, Building2, Landmark, FileDown, CheckCircle2, Plus, Trash2, Camera, ImageIcon, ClipboardList, X, FileUp, Lock, FileText } from 'lucide-react';
import { useUser, useFirebase, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where, doc } from 'firebase/firestore';
import { type Dato, type InformeSemanalRegistro } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from "@/components/ui/separator";
import { formatDateToDDMMYYYY, cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import jsPDF from 'jsPDF';
import autoTable from 'jspdf-autotable';
import Image from 'next/image';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const TIPO_ORGANIZACION = [
  "COMISIÓN VECINAL",
  "COOPERATIVA",
  "SINDICATO",
  "CLUB SOCIAL",
  "ASOCIACIÓN",
  "CENTRO DE ESTUDIANTES",
  "ORGANIZACIÓN POLÍTICA",
  "OTRO"
];

export default function InformeSemanalRegistroPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: undefined,
    to: undefined,
  });

  const configRef = useMemoFirebase(() => firestore ? doc(firestore, 'config', 'reporte_semanal') : null, [firestore]);
  const { data: configData, isLoading: isLoadingConfig } = useDoc<any>(configRef);

  const [formData, setFormData] = useState({
    departamento: '',
    distrito: '',
    inscripciones_1ra_vez: 0,
    actualizacion_datos: 0,
    cambio_local: 0,
    cambio_distrito: 0,
    cant_organizaciones: 0,
    organizaciones_asistidas: [] as { tipo: string, nombre: string }[]
  });

  const profile = user?.profile;

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const scaleSize = Math.min(1, MAX_WIDTH / img.width);
          canvas.width = img.width * scaleSize;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  useEffect(() => {
    if (!isUserLoading && profile) {
      setFormData(prev => ({
        ...prev,
        departamento: profile.departamento || '',
        distrito: profile.distrito || ''
      }));
    }

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
  }, [isUserLoading, profile]);

  useEffect(() => {
    if (configData) {
      setDateRange({
        from: configData.fecha_desde ? new Date(configData.fecha_desde + 'T12:00:00') : undefined,
        to: configData.fecha_hasta ? new Date(configData.fecha_hasta + 'T12:00:00') : undefined,
      });
    }
  }, [configData]);

  useEffect(() => {
    const count = Math.max(0, formData.cant_organizaciones);
    const currentList = [...formData.organizaciones_asistidas];
    
    if (count > currentList.length) {
      const diff = count - currentList.length;
      for (let i = 0; i < diff; i++) {
        currentList.push({ tipo: '', nombre: '' });
      }
    } else if (count < currentList.length) {
      currentList.splice(count);
    }
    
    setFormData(prev => ({ ...prev, organizaciones_asistidas: currentList }));
  }, [formData.cant_organizaciones]);

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollection<Dato>(datosQuery);

  const departments = useMemo(() => {
    if (!datosData) return [];
    return [...new Set(datosData.map(d => d.departamento))].sort();
  }, [datosData]);

  const districts = useMemo(() => {
    if (!datosData || !formData.departamento) return [];
    return [...new Set(datosData.filter(d => d.departamento === formData.departamento).map(d => d.distrito))].sort();
  }, [datosData, formData.departamento]);

  const startCamera = async () => {
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
  };

  const takePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1200;
      const scaleSize = Math.min(1, MAX_WIDTH / videoRef.current.videoWidth);
      canvas.width = videoRef.current.videoWidth * scaleSize;
      canvas.height = videoRef.current.videoHeight * scaleSize;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUri = canvas.toDataURL('image/jpeg', 0.7);
        setPhotos(prev => [...prev, dataUri]);
        stopCamera();
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      for (const file of Array.from(files)) {
        try {
          const compressed = await compressImage(file);
          setPhotos(prev => [...prev, compressed]);
        } catch (err) {
          toast({ variant: 'destructive', title: "Error al procesar archivo" });
        }
      }
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const updateOrg = (index: number, field: 'tipo' | 'nombre', value: string) => {
    const newList = [...formData.organizaciones_asistidas];
    newList[index][field] = value;
    setFormData(prev => ({ ...prev, organizaciones_asistidas: newList }));
  };

  const handleSave = () => {
    if (!firestore || !user) return;
    if (!dateRange?.from || !dateRange?.to || !formData.departamento || !formData.distrito) {
      toast({ variant: "destructive", title: "Faltan datos obligatorios", description: "Seleccione el rango de fechas y la jurisdicción." });
      return;
    }

    setIsSubmitting(true);
    const docData = {
      ...formData,
      fecha_desde: format(dateRange.from, "yyyy-MM-dd"),
      fecha_hasta: format(dateRange.to, "yyyy-MM-dd"),
      fotos: photos,
      usuario_id: user.uid,
      fecha_creacion: new Date().toISOString(),
      server_timestamp: serverTimestamp(),
    };

    addDoc(collection(firestore, 'informes-semanales-registro'), docData)
      .then(() => {
        toast({ title: "¡Informe Guardado!", description: "El reporte operativo ha sido registrado con éxito." });
        setPhotos([]);
        setIsSubmitting(false);
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'informes-semanales-registro', operation: 'create', requestResourceData: docData }));
        setIsSubmitting(false);
      });
  };

  const generatePDF = () => {
    if (!logoBase64) return;
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.addImage(logoBase64, 'PNG', margin, 10, 20, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text("INFORME SEMANAL OPERATIVO", pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text("REGISTRO ELECTORAL", pageWidth / 2, 26, { align: 'center' });

    let y = 45;
    doc.setFontSize(9);
    const from = dateRange?.from ? format(dateRange.from, "dd/MM/yyyy") : '__/__/____';
    const to = dateRange?.to ? format(dateRange.to, "dd/MM/yyyy") : '__/__/____';
    doc.text(`PERIODO: ${from} AL ${to}`, margin, y);
    doc.text(`JURISDICCIÓN: ${formData.departamento} - ${formData.distrito}`, margin, y + 6);

    y += 15;
    const tableData = [
      ["ACTIVIDAD", "CANTIDAD"],
      ["INSCRIPCIONES 1RA VEZ", formData.inscripciones_1ra_vez],
      ["ACTUALIZACIÓN DE DATOS (AUTOMÁTICA)", formData.actualizacion_datos],
      ["CAMBIO DE LOCAL (MISMO DISTRITO)", formData.cambio_local],
      ["CAMBIO DE DISTRITO A DISTRITO", formData.cambio_distrito],
      ["ORGANIZACIONES INTERMEDIAS ASISTIDAS", formData.cant_organizaciones]
    ];

    autoTable(doc, {
      startY: y,
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [0, 0, 0] },
      margin: { left: margin, right: margin }
    });

    if (formData.organizaciones_asistidas.length > 0) {
      y = (doc as any).lastAutoTable.finalY + 10;
      doc.setFont('helvetica', 'bold');
      doc.text("DETALLE DE ORGANIZACIONES ASISTIDAS:", margin, y);
      
      const orgTable = formData.organizaciones_asistidas.map((o, i) => [i + 1, o.tipo, o.nombre]);
      autoTable(doc, {
        startY: y + 5,
        head: [['#', 'TIPO', 'NOMBRE DE LA ORGANIZACIÓN']],
        body: orgTable,
        theme: 'grid',
        margin: { left: margin, right: margin }
      });
    }

    y = (doc as any).lastAutoTable.finalY + 30;
    doc.line(margin, y, margin + 60, y);
    doc.text("FIRMA RESPONSABLE", margin + 30, y + 5, { align: 'center' });
    
    doc.line(pageWidth - margin - 60, y, pageWidth - margin, y);
    doc.text("FIRMA Y SELLO JEFE", pageWidth - margin - 30, y + 5, { align: 'center' });

    doc.save(`Informe-Operativo-${formData.distrito.replace(/\s+/g, '-')}.pdf`);
  };

  if (isUserLoading || isLoadingConfig) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  const isDateLocked = !!configData;

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Informe Semanal Operativo" />
      
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-[#1A1A1A] uppercase">Informe Semanal</h1>
                <p className="text-muted-foreground text-sm font-medium">Completa el formulario para enviar tu informe de actividades.</p>
            </div>
            <Button variant="outline" className="font-bold border-2 gap-2 h-11 shadow-sm rounded-xl" onClick={generatePDF}>
                <FileDown className="h-4 w-4" /> Descargar para Firma
            </Button>
        </div>

        <Card className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden">
          <CardContent className="p-10 space-y-12">
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                        Fecha del Informe {isDateLocked && <Lock className="h-3 w-3 text-primary" />}
                    </Label>
                    <Popover>
                        <PopoverTrigger asChild disabled={isDateLocked}>
                            <div className={cn(
                                "h-12 w-full flex items-center px-4 font-bold border-2 rounded-xl transition-colors",
                                isDateLocked ? "bg-primary/5 border-primary/20 text-primary cursor-default" : "bg-muted/20 cursor-pointer hover:bg-muted/30"
                            )}>
                                <CalendarIcon className="mr-2 h-4 w-4 opacity-40" />
                                {dateRange?.from ? (
                                    dateRange.to ? `${format(dateRange.from, "dd/MM/yy")} - ${format(dateRange.to, "dd/MM/yy")}` : format(dateRange.from, "dd/MM/yy")
                                ) : <span className="text-muted-foreground/50">No configurado</span>}
                            </div>
                        </PopoverTrigger>
                        {!isDateLocked && (
                            <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-2xl overflow-hidden" align="start">
                                <Calendar mode="range" selected={dateRange} onSelect={setDateRange} locale={es} initialFocus className="bg-white" />
                            </PopoverContent>
                        )}
                    </Popover>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">
                        {isDateLocked ? "Rango establecido por la Administración Nacional." : "Rango de fechas de configuración."}
                    </p>
                </div>

                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Departamento</Label>
                    {user?.profile?.role === 'admin' ? (
                        <Select value={formData.departamento} onValueChange={(v) => setFormData(p => ({...p, departamento: v, distrito: ''}))}>
                            <SelectTrigger className="h-12 border-2 rounded-xl font-bold"><SelectValue placeholder="Selecciona un departamento" /></SelectTrigger>
                            <SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                        </Select>
                    ) : <div className="h-12 flex items-center px-4 font-bold border-2 rounded-xl bg-muted/20">{formData.departamento || 'No asignado'}</div>}
                </div>

                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Distrito</Label>
                    {user?.profile?.role === 'admin' ? (
                        <Select value={formData.distrito} onValueChange={(v) => setFormData(p => ({...p, distrito: v}))} disabled={!formData.departamento}>
                            <SelectTrigger className="h-12 border-2 rounded-xl font-bold"><SelectValue placeholder="Selecciona un distrito" /></SelectTrigger>
                            <SelectContent>{districts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                        </Select>
                    ) : <div className="h-12 flex items-center px-4 font-bold border-2 rounded-xl bg-muted/20">{formData.distrito || 'No asignado'}</div>}
                </div>
            </div>

            <div className="space-y-8">
                <div className="flex items-center gap-4">
                    <h3 className="font-black uppercase text-sm text-primary tracking-widest">Detalle de Actividades</h3>
                    <div className="h-px bg-muted flex-1" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-tight">Cant. de Inscripciones 1ra Vez</Label>
                        <Input type="number" value={formData.inscripciones_1ra_vez} onChange={e => setFormData(p => ({...p, inscripciones_1ra_vez: parseInt(e.target.value) || 0}))} className="h-12 font-bold border-2 bg-muted/10 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-tight">Cant. de Actualización de Datos (Automática)</Label>
                        <Input type="number" value={formData.actualizacion_datos} onChange={e => setFormData(p => ({...p, actualizacion_datos: parseInt(e.target.value) || 0}))} className="h-12 font-bold border-2 bg-muted/10 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-tight">Cant. de Cambio de Local (Mismo Distrito)</Label>
                        <Input type="number" value={formData.cambio_local} onChange={e => setFormData(p => ({...p, cambio_local: parseInt(e.target.value) || 0}))} className="h-12 font-bold border-2 bg-muted/10 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-tight">Cant. de Cambio de Distrito a Distrito</Label>
                        <Input type="number" value={formData.cambio_distrito} onChange={e => setFormData(p => ({...p, cambio_distrito: parseInt(e.target.value) || 0}))} className="h-12 font-bold border-2 bg-muted/10 rounded-xl" />
                    </div>
                    <div className="col-span-full space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-tight">Cant. de Organizaciones Intermedias con Asistencia Brindada</Label>
                        <Input type="number" value={formData.cant_organizaciones} onChange={e => setFormData(p => ({...p, cant_organizaciones: parseInt(e.target.value) || 0}))} className="h-14 font-black text-xl border-2 border-black rounded-2xl text-center" />
                    </div>
                </div>
            </div>

            {formData.organizaciones_asistidas.length > 0 && (
                <div className="p-8 border-2 border-dashed rounded-[2.5rem] bg-muted/5 space-y-8 animate-in fade-in duration-500">
                    <h4 className="font-black uppercase text-xs text-primary/60 tracking-widest text-center">Detalle de Organizaciones Asistidas</h4>
                    <div className="space-y-6">
                        {formData.organizaciones_asistidas.map((org, idx) => (
                            <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end border-b border-muted pb-6 last:border-0 last:pb-0">
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">Tipo de Organización #{idx + 1}</Label>
                                    <Select value={org.tipo} onValueChange={(v) => updateOrg(idx, 'tipo', v)}>
                                        <SelectTrigger className="h-11 border-2 rounded-xl font-bold bg-white"><SelectValue placeholder="Selecciona tipo..." /></SelectTrigger>
                                        <SelectContent>
                                            {TIPO_ORGANIZACION.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">Nombre de la Organización</Label>
                                    <Input placeholder="Nombre de la organización" value={org.nombre} onChange={e => updateOrg(idx, 'nombre', e.target.value.toUpperCase())} className="h-11 border-2 rounded-xl font-bold bg-white uppercase" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <Separator />

            <div className="space-y-6">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Boletas de Inscripción y Otros</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    <div className="flex gap-3">
                        <label htmlFor="file-up" className="flex-1 flex items-center justify-center gap-2 h-12 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/20 transition-all font-black uppercase text-[10px]">
                            <FileUp className="h-4 w-4" /> Adjuntar Archivos / PDF
                            <Input id="file-up" type="file" multiple className="hidden" accept="image/*,.pdf" onChange={handleFileUpload} />
                        </label>
                        <Button variant="outline" className="flex-1 h-12 border-2 rounded-xl font-black uppercase text-[10px] gap-2" onClick={startCamera}>
                            <Camera className="h-4 w-4" /> Usar Cámara
                        </Button>
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60 leading-relaxed italic">
                        Adjunta fotos de boletas, documentos o archivos PDF relevantes. Puedes subir varios.
                    </p>
                </div>

                {photos.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4 pt-4">
                        {photos.map((p, i) => (
                            <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border-2 border-white shadow-lg group">
                                {p.startsWith('data:application/pdf') ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-muted/30">
                                        <FileText className="h-8 w-8 text-primary opacity-40 mb-1" />
                                        <p className="text-[8px] font-black uppercase text-primary/60">PDF</p>
                                    </div>
                                ) : (
                                    <Image src={p} alt={`Evidencia ${i}`} fill className="object-cover" />
                                )}
                                <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removePhoto(i)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

          </CardContent>
          <CardFooter className="p-0 border-t bg-black overflow-hidden">
            <Button onClick={handleSave} disabled={isSubmitting || !dateRange?.from} className="w-full h-16 bg-black hover:bg-black/90 text-white text-xl font-black uppercase rounded-none tracking-[0.2em]">
                {isSubmitting ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : <ClipboardList className="mr-3 h-6 w-6" />}
                ENVIAR INFORME SEMANAL
            </Button>
          </CardFooter>
        </Card>

        <div className="text-center pb-12">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40 italic">
                * Sistema de Reporte Operativo Oficial - Registro Electoral - Justicia Electoral
            </p>
        </div>
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
