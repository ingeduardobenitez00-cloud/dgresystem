"use client";

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/header';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Printer, 
  Save, 
  CheckCircle2, 
  Building2, 
  Landmark,
  Camera,
  Trash2,
  X,
  ImageIcon,
  FileText,
  Calendar as CalendarIcon,
  Clock
} from 'lucide-react';
import { useUser, useFirebase } from '@/firebase';
import { collection, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, addDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

type AnexoIFila = {
  lugar: string;
  direccion: string;
  fecha_desde: string;
  fecha_hasta: string;
  hora_desde: string;
  hora_hasta: string;
}

export default function AnexoIPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [tipoOficina, setTipoOficina] = useState<'REGISTRO' | 'CENTRO_CIVICO'>('REGISTRO');
  
  // Estados de Archivo/Cámara
  const [fotoRespaldo, setFotoRespaldo] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Inicialización limpia (campos vacíos para forzar carga manual AM/PM)
  const [filas, setFilas] = useState<AnexoIFila[]>(
    Array.from({ length: 10 }, () => ({
      lugar: '',
      direccion: '',
      fecha_desde: '',
      fecha_hasta: '',
      hora_desde: '',
      hora_hasta: ''
    }))
  );

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

  const profile = user?.profile;

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
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUri = canvas.toDataURL('image/jpeg', 0.8);
        setFotoRespaldo(dataUri);
        stopCamera();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFotoRespaldo(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleFilaChange = (index: number, field: keyof AnexoIFila, value: string) => {
    const newFilas = [...filas];
    newFilas[index][field] = value;
    setFilas(newFilas);
  };

  const handleSave = () => {
    if (!firestore || !user) return;
    
    const filledFilas = filas.filter(f => f.lugar.trim() !== '' && f.fecha_desde && f.fecha_hasta && f.hora_desde && f.hora_hasta);
    
    if (filledFilas.length === 0) {
      toast({ variant: "destructive", title: "Datos incompletos", description: "Complete al menos una fila con Lugar, Fechas y Horarios para agendar." });
      return;
    }

    if (!fotoRespaldo) {
      toast({ variant: "destructive", title: "Respaldo requerido", description: "Debe adjuntar la foto del formulario físico firmado." });
      return;
    }

    setIsSubmitting(true);
    
    const batch = writeBatch(firestore);
    const anexoRef = doc(collection(firestore, 'anexo-i'));
    
    const anexoData = {
      tipo_oficina: tipoOficina,
      departamento: profile?.departamento || '',
      distrito: profile?.distrito || '',
      filas: filledFilas,
      foto_respaldo: fotoRespaldo,
      usuario_id: user.uid,
      fecha_creacion: new Date().toISOString(),
      server_timestamp: serverTimestamp(),
    };

    batch.set(anexoRef, anexoData);

    filledFilas.forEach(f => {
      const start = parseISO(f.fecha_desde);
      const end = parseISO(f.fecha_hasta);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

      let current = start;
      let count = 0;
      while (current <= end && count < 365) {
        const agendaRef = doc(collection(firestore, 'solicitudes-capacitacion'));
        const dayStr = format(current, "yyyy-MM-dd");
        
        batch.set(agendaRef, {
          solicitante_entidad: tipoOficina === 'REGISTRO' ? 'OFICINA REGISTRO ELECTORAL' : 'CENTRO CÍVICO',
          tipo_solicitud: 'Lugar Fijo',
          fecha: dayStr,
          hora_desde: f.hora_desde,
          hora_hasta: f.hora_hasta,
          lugar_local: f.lugar.toUpperCase(),
          direccion_calle: f.direccion.toUpperCase(),
          barrio_compania: '',
          departamento: profile?.departamento || '',
          distrito: profile?.distrito || '',
          rol_solicitante: 'otro',
          nombre_completo: 'PLANIFICACIÓN ANEXO I',
          cedula: '',
          telefono: '',
          gps: '',
          usuario_id: user.uid,
          fecha_creacion: new Date().toISOString(),
          server_timestamp: serverTimestamp()
        });
        
        current = addDays(current, 1);
        count++;
      }
    });

    batch.commit()
      .then(() => {
        toast({ title: "Planificación Guardada", description: "Los lugares fijos han sido agendados con éxito." });
        setFotoRespaldo(null);
        setIsSubmitting(false);
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: 'anexo-i (batch)',
          operation: 'write',
          requestResourceData: anexoData,
        });
        errorEmitter.emit('permission-error', permissionError);
        setIsSubmitting(false);
      });
  };

  const generatePDF = () => {
    if (!logoBase64) return;
    const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();

    // Helper para formato AM/PM
    const formatTo12h = (t: string) => {
      if (!t) return '';
      const [h, m] = t.split(':');
      const hh = parseInt(h);
      const suffix = hh >= 12 ? 'PM' : 'AM';
      const h12 = hh % 12 || 12;
      return `${h12}:${m} ${suffix}`;
    };

    // Header
    doc.addImage(logoBase64, 'PNG', margin, 10, 15, 15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text("ANEXO I", 35, 15);
    doc.text("LUGARES FIJOS PARA DIVULGACIÓN MV - INTERIOR", 35, 21);
    doc.setFontSize(11);
    doc.text("Práctica con la Máquina de Votación", 35, 27);

    let y = 40;
    doc.setFontSize(9);
    doc.text("OFICINA DEL REGISTRO ELECTORAL", margin, y);
    doc.rect(margin + 60, y - 4, 5, 5);
    if(tipoOficina === 'REGISTRO') doc.text("X", margin + 61, y);

    doc.text("CENTRO CÍVICO", margin + 80, y);
    doc.rect(margin + 110, y - 4, 5, 5);
    if(tipoOficina === 'CENTRO_CIVICO') doc.text("X", margin + 111, y);

    y += 10;
    doc.text(`DISTRITO DE: _________________________________`, margin, y);
    doc.text((profile?.distrito || '').toUpperCase(), margin + 25, y - 0.5);
    
    doc.text(`DEPARTAMENTO: _________________________________`, margin + 120, y);
    doc.text((profile?.departamento || '').toUpperCase(), margin + 155, y - 0.5);

    const tableBody = filas.map((f, i) => {
      const fechaStr = (f.fecha_desde && f.fecha_hasta) 
        ? `DEL: ${format(parseISO(f.fecha_desde), "dd/MM")} AL: ${format(parseISO(f.fecha_hasta), "dd/MM")} / 2026`
        : 'DEL:   /   AL:   /   / 2026';
      
      const horaStr = (f.hora_desde && f.hora_hasta)
        ? `DE: ${formatTo12h(f.hora_desde)} A: ${formatTo12h(f.hora_hasta)}`
        : 'DE:       A:       ';

      return [
        i + 1,
        f.lugar.toUpperCase(),
        f.direccion.toUpperCase(),
        fechaStr,
        horaStr
      ];
    });

    autoTable(doc, {
      startY: y + 10,
      head: [['N.º', 'LUGAR FIJO PARA DIVULGACIÓN', 'DIRECCIÓN', 'FECHA', 'HORARIO (AM/PM)']],
      body: tableBody,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1 },
      headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 80 },
        2: { cellWidth: 80 },
        3: { cellWidth: 50, halign: 'center' },
        4: { cellWidth: 40, halign: 'center' }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 25;
    doc.text("Firma, aclaración y sello jefes", pageWidth - margin - 60, finalY, { align: 'center' });

    doc.setFontSize(7);
    const footerY = doc.internal.pageSize.getHeight() - 15;
    doc.text("Completar todos los datos de lugares fijos y remitir hasta el jueves antes de la semana de inicio de la divulgación a la Coordinación Departamental correspondiente.", margin, footerY);
    doc.text("Coordinación departamental remite a la Dirección del CIDEE.", margin, footerY + 4);

    doc.save(`AnexoI-${(profile?.distrito || 'Planificacion').replace(/\s+/g, '-')}.pdf`);
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Anexo I - Lugares Fijos" />
      <main className="flex-1 p-4 md:p-8 max-[1400px] mx-auto w-full space-y-6">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
                <Image src="/logo.png" alt="Logo" width={50} height={50} className="object-contain" />
                <div>
                    <h1 className="text-2xl font-black uppercase text-primary leading-tight">ANEXO I</h1>
                    <h2 className="text-lg font-black uppercase leading-tight tracking-tight">LUGARES FIJOS PARA DIVULGACIÓN MV</h2>
                </div>
            </div>
            <div className="flex gap-3">
                <Button variant="outline" className="font-black uppercase text-[10px] border-2 h-11 gap-2 shadow-sm" onClick={generatePDF}>
                    <Printer className="h-4 w-4" /> VISTA PREVIA PDF (AM/PM)
                </Button>
                <Button className="font-black uppercase text-[10px] h-11 gap-2 shadow-xl" onClick={handleSave} disabled={isSubmitting || !fotoRespaldo}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    GUARDAR Y AGENDAR
                </Button>
            </div>
        </div>

        <Card className="shadow-2xl border-none overflow-hidden rounded-[2rem] bg-white">
          <CardContent className="p-8 space-y-10">
            
            <div className="flex flex-col md:flex-row gap-12 items-center justify-center p-6 bg-muted/10 rounded-3xl border-2 border-dashed">
                <RadioGroup 
                    value={tipoOficina} 
                    onValueChange={(v: any) => setTipoOficina(v)}
                    className="flex flex-col sm:flex-row gap-10"
                >
                    <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setTipoOficina('REGISTRO')}>
                        <div className={cn("h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all", tipoOficina === 'REGISTRO' ? "border-black bg-black text-white" : "border-muted-foreground/30")}>
                            {tipoOficina === 'REGISTRO' && <CheckCircle2 className="h-4 w-4" />}
                        </div>
                        <Label className="font-black text-xs uppercase cursor-pointer">OFICINA DEL REGISTRO ELECTORAL</Label>
                        <RadioGroupItem value="REGISTRO" className="hidden" />
                    </div>
                    <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setTipoOficina('CENTRO_CIVICO')}>
                        <div className={cn("h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all", tipoOficina === 'CENTRO_CIVICO' ? "border-black bg-black text-white" : "border-muted-foreground/30")}>
                            {tipoOficina === 'CENTRO_CIVICO' && <CheckCircle2 className="h-4 w-4" />}
                        </div>
                        <Label className="font-black text-xs uppercase cursor-pointer">CENTRO CÍVICO</Label>
                        <RadioGroupItem value="CENTRO_CIVICO" className="hidden" />
                    </div>
                </RadioGroup>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2">
                        <Landmark className="h-3.5 w-3.5" /> Departamento
                    </Label>
                    <Input value={profile?.departamento || ''} readOnly className="h-12 font-black uppercase bg-muted/20 border-2" />
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5" /> Distrito
                    </Label>
                    <Input value={profile?.distrito || ''} readOnly className="h-12 font-black uppercase bg-muted/20 border-2" />
                </div>
            </div>

            <div className="border-2 border-black rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-black text-white">
                                <th className="p-4 text-[9px] font-black uppercase w-12 text-center">N.º</th>
                                <th className="p-4 text-[9px] font-black uppercase text-left">Lugar Fijo para Divulgación</th>
                                <th className="p-4 text-[9px] font-black uppercase text-left">Dirección</th>
                                <th className="p-4 text-[9px] font-black uppercase text-center w-[300px]">Fecha (Desde - Hasta)</th>
                                <th className="p-4 text-[9px] font-black uppercase text-center w-[220px]">Horario (AM/PM)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/10">
                            {filas.map((fila, idx) => (
                                <tr key={idx} className="hover:bg-muted/5 transition-colors">
                                    <td className="p-4 text-center font-black text-xs text-muted-foreground border-r">{idx + 1}</td>
                                    <td className="p-2 border-r">
                                        <Input 
                                            value={fila.lugar} 
                                            onChange={e => handleFilaChange(idx, 'lugar', e.target.value.toUpperCase())}
                                            placeholder="Nombre del local..."
                                            className="border-0 focus-visible:ring-0 font-bold uppercase text-[11px] h-10 bg-transparent"
                                        />
                                    </td>
                                    <td className="p-2 border-r">
                                        <Input 
                                            value={fila.direccion} 
                                            onChange={e => handleFilaChange(idx, 'direccion', e.target.value.toUpperCase())}
                                            placeholder="Calle o referencia..."
                                            className="border-0 focus-visible:ring-0 font-bold uppercase text-[11px] h-10 bg-transparent"
                                        />
                                    </td>
                                    <td className="p-2 border-r">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className={cn(
                                                        "w-full justify-start text-left font-black h-10 border-2 rounded-xl text-[11px] bg-white transition-all",
                                                        !fila.fecha_desde && "text-muted-foreground/40 border-dashed"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4 opacity-30" />
                                                    {fila.fecha_desde ? (
                                                        fila.fecha_hasta ? (
                                                            <span className="tracking-tight">
                                                                {format(parseISO(fila.fecha_desde), "dd/MM/yy")} - {format(parseISO(fila.fecha_hasta), "dd/MM/yy")}
                                                            </span>
                                                        ) : (
                                                            format(parseISO(fila.fecha_desde), "dd/MM/yy")
                                                        )
                                                    ) : (
                                                        <span className="uppercase font-bold text-[9px]">Seleccionar Rango</span>
                                                    )}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-2xl overflow-hidden" align="center">
                                                <Calendar
                                                    initialFocus
                                                    mode="range"
                                                    defaultMonth={fila.fecha_desde ? parseISO(fila.fecha_desde) : undefined}
                                                    selected={{
                                                        from: fila.fecha_desde ? parseISO(fila.fecha_desde) : undefined,
                                                        to: fila.fecha_hasta ? parseISO(fila.fecha_hasta) : undefined,
                                                    }}
                                                    onSelect={(range) => {
                                                        handleFilaChange(idx, 'fecha_desde', range?.from ? format(range.from, "yyyy-MM-dd") : '');
                                                        handleFilaChange(idx, 'fecha_hasta', range?.to ? format(range.to, "yyyy-MM-dd") : '');
                                                    }}
                                                    numberOfMonths={1}
                                                    locale={es}
                                                    className="bg-white"
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </td>
                                    <td className="p-2">
                                        <div className="flex flex-col gap-1 items-center justify-center">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[8px] font-black text-muted-foreground w-4">DE:</span>
                                                <Input 
                                                    type="time" 
                                                    value={fila.hora_desde} 
                                                    onChange={e => handleFilaChange(idx, 'hora_desde', e.target.value)}
                                                    className="border-2 rounded-xl text-[10px] font-bold h-8 w-24 px-1 text-center"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[8px] font-black text-muted-foreground w-4">A:</span>
                                                <Input 
                                                    type="time" 
                                                    value={fila.hora_hasta} 
                                                    onChange={e => handleFilaChange(idx, 'hora_hasta', e.target.value)}
                                                    className="border-2 rounded-xl text-[10px] font-bold h-8 w-24 px-1 text-center"
                                                />
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* SECCIÓN DE RESPALDO DOCUMENTAL */}
            <div className="space-y-6 pt-6 border-t-2 border-dashed">
                <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <Label className="font-black uppercase text-xs">Respaldo Documental (Anexo I Firmado) *</Label>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {fotoRespaldo ? (
                        <div className="relative aspect-video rounded-3xl overflow-hidden border-4 border-white shadow-2xl group">
                            {fotoRespaldo.startsWith('data:application/pdf') ? (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-muted/30">
                                    <FileText className="h-16 w-16 text-primary opacity-40 mb-2" />
                                    <p className="text-[10px] font-black uppercase text-primary/60">Documento PDF Cargado</p>
                                </div>
                            ) : (
                                <Image src={fotoRespaldo} alt="Respaldo Anexo I" fill className="object-cover" />
                            )}
                            <Button 
                                variant="destructive" 
                                size="icon" 
                                className="absolute top-4 right-4 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                onClick={() => setFotoRespaldo(null)}
                            >
                                <Trash2 className="h-5 w-5" />
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            <div 
                                className="flex flex-col items-center justify-center h-48 border-4 border-dashed rounded-[2.5rem] cursor-pointer hover:bg-muted/50 transition-all bg-white group"
                                onClick={startCamera}
                            >
                                <Camera className="h-12 w-12 text-muted-foreground group-hover:text-primary mb-2 transition-colors" />
                                <span className="font-black uppercase text-[10px] text-muted-foreground">Capturar Formulario Físico</span>
                            </div>
                            <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-muted transition-all text-muted-foreground">
                                <ImageIcon className="h-4 w-4" />
                                <span className="text-[10px] font-black uppercase">Subir desde Galería / PDF</span>
                                <Input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileUpload} />
                            </label>
                        </div>
                    )}
                    
                    <div className="flex flex-col justify-center p-8 bg-muted/20 rounded-[2.5rem] border-2 border-dashed">
                        <p className="text-[11px] font-bold text-muted-foreground uppercase leading-relaxed italic text-center">
                            Es obligatorio adjuntar la fotografía o el archivo PDF del Anexo I con la firma y el sello de la jefatura para validar la planificación semanal.
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-6 bg-muted/20 rounded-3xl text-center">
                <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed max-w-3xl mx-auto italic">
                    * Al guardar este formulario, el sistema generará automáticamente las entradas en la Agenda para cada día comprendido en los rangos de fecha seleccionados, facilitando la asignación del personal.
                </p>
            </div>

          </CardContent>
        </Card>
      </main>

      {/* DIÁLOGO DE CÁMARA */}
      <Dialog open={isCameraOpen} onOpenChange={(o) => !o && stopCamera()}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none bg-black rounded-[2rem]">
          <div className="relative aspect-[3/4] w-full bg-black flex items-center justify-center">
            <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
            <div className="absolute inset-8 border-2 border-white/20 rounded-xl pointer-events-none border-dashed" />
          </div>
          <DialogFooter className="p-8 bg-black/80 flex flex-row items-center justify-between gap-4">
            <Button variant="outline" className="rounded-full h-14 w-14 border-white/20 bg-white/10 text-white" onClick={stopCamera}><X className="h-6 w-6" /></Button>
            <Button className="flex-1 h-16 rounded-full bg-white text-black font-black uppercase text-sm shadow-2xl" onClick={takePhoto}>CAPTURAR FORMULARIO</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
