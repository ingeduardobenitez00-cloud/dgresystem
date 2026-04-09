
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
  TableProperties, 
  CheckCircle2, 
  DatabaseZap, 
  AlertCircle, 
  Search, 
  Printer, 
  FileText, 
  Calendar as CalendarIcon, 
  Landmark,
  Camera,
  ImageIcon,
  X,
  FileUp,
  Users,
  Clock,
  Globe
} from 'lucide-react';
import { useUser, useFirebase, useCollection, useMemoFirebase, useCollectionOnce, useStorage } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy } from 'firebase/firestore';
import { type InformeDivulgador, type Dato } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDateToDDMMYYYY, cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from "@/components/ui/separator";
import { Badge } from '@/components/ui/badge';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Image from 'next/image';
import { recordAuditLog } from '@/lib/audit';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { DateRange } from "react-day-picker";

const normalizeGeo = (str: string) => {
  if (!str) return '';
  return str.toUpperCase()
    .replace(/^\d+[\s-]*\s*/, '') // Elimina "10 - ", "10-", "10 " al inicio
    .trim();
};

export default function InformeSemanalAnexoIVPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { uploadFile, isUploading: isStorageUploading } = useStorage();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: undefined,
    to: undefined,
  });

  const profile = user?.profile;
  
  const isAdminView = ['admin', 'director', 'coordinador'].includes(profile?.role || '') || profile?.permissions?.includes('admin_filter');
  const isDistView = !isAdminView && (profile?.permissions?.includes('district_filter') || profile?.role === 'funcionario');
  const isJefeView = !isAdminView && !isDistView && (profile?.role === 'jefe' || profile?.permissions?.includes('department_filter'));

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollection<Dato>(datosQuery);

  const departments = useMemo(() => {
    if (!datosData) return [];
    return [...new Set(datosData.map(d => d.departamento))].sort();
  }, [datosData]);

  const districts = useMemo(() => {
    if (!datosData || !selectedDepartment || selectedDepartment === 'ALL') return [];
    return [...new Set(datosData.filter(d => d.departamento === selectedDepartment).map(d => d.distrito))].sort();
  }, [datosData, selectedDepartment]);

  useEffect(() => {
    if (!isUserLoading && profile) {
      if (!isAdminView) {
        if (profile.departamento) setSelectedDepartment(profile.departamento);
        if (isDistView && profile.distrito) setSelectedDistrict(profile.distrito);
      } else if (!selectedDepartment) {
        setSelectedDepartment('ALL');
        setSelectedDistrict('ALL');
      }
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
  }, [isUserLoading, profile, isAdminView, isDistView]);

  const informesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    const colRef = collection(firestore, 'informes-divulgador');
    
    if (isAdminView) {
        if (!selectedDepartment || selectedDepartment === 'ALL') return colRef;
        if (!selectedDistrict || selectedDistrict === 'ALL') return query(colRef, where('departamento', '==', selectedDepartment));
        return query(colRef, where('departamento', '==', selectedDepartment), where('oficina', '==', selectedDistrict));
    }

    if (!selectedDepartment || !selectedDistrict) return null;
    // Quitamos los filtros where estrictos de FireStore para filtrar en memoria con normalizeGeo
    return colRef;
  }, [firestore]);

  const { data: rawInformesAnexoIII, isLoading: isLoadingInformes } = useCollection<InformeDivulgador>(informesQuery);

  const informesAnexoIII = useMemo(() => {
    if (!rawInformesAnexoIII || !selectedDepartment || !selectedDistrict) return [];
    
    // Normalizamos objetivos de búsqueda
    const targetDepto = normalizeGeo(selectedDepartment);
    const targetDist = normalizeGeo(selectedDistrict);
    const isDeptoAll = selectedDepartment === 'ALL';
    const isDistAll = selectedDistrict === 'ALL';

    let filtered = rawInformesAnexoIII.filter(inf => {
        const matchesDepto = isDeptoAll || normalizeGeo(inf.departamento) === targetDepto;
        const matchesDist = isDistAll || normalizeGeo(inf.oficina) === targetDist;
        return matchesDepto && matchesDist;
    });
    
    if (dateRange?.from && dateRange?.to) {
        const fromStr = format(dateRange.from, "yyyy-MM-dd");
        const toStr = format(dateRange.to, "yyyy-MM-dd");
        filtered = filtered.filter(inf => inf.fecha >= fromStr && inf.fecha <= toStr);
    }
    
    return filtered.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [rawInformesAnexoIII, selectedDepartment, selectedDistrict, dateRange]);

  const totalCapacitados = useMemo(() => {
    return informesAnexoIII.reduce((acc, curr) => acc + (curr.total_personas || 0), 0);
  }, [informesAnexoIII]);

  const totalDivulgadores = useMemo(() => {
    const cedulas = new Set(informesAnexoIII.map(inf => inf.cedula_divulgador || (inf as any).divulgador_cedula));
    return cedulas.size;
  }, [informesAnexoIII]);

  const compressImage = (file: File, currentPhotoCount: number = 0): Promise<string> => {
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
          // Compresión adaptativa: si hay muchas fotos, reducimos más el tamaño
          const MAX_WIDTH = currentPhotoCount > 8 ? 600 : 800;
          const scaleSize = Math.min(1, MAX_WIDTH / img.width);
          canvas.width = img.width * scaleSize;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          // Calidad 0.4 para asegurar cumplimiento de 1MB
          resolve(canvas.toDataURL('image/jpeg', 0.4));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const startCamera = () => {
    setIsCameraOpen(true);
    setTimeout(async () => {
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
    }, 100);
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
      const photoCount = photos.length + 1;
      const MAX_WIDTH = photoCount > 8 ? 600 : 800;
      const scaleSize = Math.min(1, MAX_WIDTH / videoRef.current.videoWidth);
      canvas.width = videoRef.current.videoWidth * scaleSize;
      canvas.height = videoRef.current.videoHeight * scaleSize;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUri = canvas.toDataURL('image/jpeg', 0.4);
        setPhotos(prev => [...prev, dataUri].slice(0, 12));
        stopCamera();
      }
    }
  };

  const handlePhotosUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const remaining = 12 - photos.length;
      const selection = Array.from(files).slice(0, remaining);
      for (const file of selection) {
        try {
          const compressed = await compressImage(file, photos.length + 1);
          setPhotos(prev => [...prev, compressed].slice(0, 12));
        } catch (err) {
          toast({ variant: 'destructive', title: "Error al procesar fotos" });
        }
      }
    }
  };

  const generatePDF = () => {
    if (!logoBase64) return;
    const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.addImage(logoBase64, 'PNG', margin, 10, 20, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text("Justicia Electoral", pageWidth / 2, 15, { align: "center" });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text("Custodio de la Voluntad Popular", pageWidth / 2, 22, { align: "center" });

    const barW = 4; const barH = 15; const barX = pageWidth - margin - (barW * 3);
    doc.setFillColor(200, 0, 0); doc.rect(barX, 10, barW, barH, 'F');
    doc.setFillColor(255, 255, 255); doc.rect(barX + barW, 10, barW, barH, 'F');
    doc.setFillColor(0, 0, 200); doc.rect(barX + (barW * 2), 10, barW, barH, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text("ANEXO IV", pageWidth / 2, 35, { align: "center" });
    doc.text("INFORME SEMANAL PUNTOS FIJOS DE DIVULGACIÓN 2026", pageWidth / 2, 40, { align: "center" });

    doc.setFontSize(9);
    const d1 = dateRange?.from ? format(dateRange.from, "dd/MM/yyyy") : '__/__/____';
    const d2 = dateRange?.to ? format(dateRange.to, "dd/MM/yyyy") : '__/__/____';
    doc.text(`SEMANA DEL LUNES:  ${d1}   AL DOMINGO:  ${d2}`, margin, 50);
    
    const isGlobal = selectedDepartment === 'ALL' || selectedDistrict === 'ALL';
    doc.text(`DISTRITO:  ${isGlobal ? 'TODOS (REPORTE CONSOLIDADO)' : (selectedDistrict || '').toUpperCase()}`, margin, 55);
    doc.text(`DEPARTAMENTO:  ${selectedDepartment === 'ALL' ? 'NACIONAL' : (selectedDepartment || '').toUpperCase()}`, pageWidth / 2 - 20, 55);

    const tableBody = informesAnexoIII.map((inf, idx) => {
        const nombre = inf.nombre_divulgador || (inf as any).divulgador_nombre || '';
        const ci = inf.cedula_divulgador || (inf as any).divulgador_cedula || '';
        const vinc = inf.vinculo || (inf as any).divulgador_vinculo || '';
        const horario = `${inf.hora_desde} A ${inf.hora_hasta} HS`;
        
        return [
            idx + 1,
            `${isGlobal ? '[' + inf.distrito + '] ' : ''}${inf.lugar_divulgacion.toUpperCase()}`,
            inf.fecha.split('-').reverse().join('/'),
            horario,
            nombre.toUpperCase(),
            ci,
            vinc.toUpperCase(),
            inf.total_personas
        ];
    });

    // Fila de Total Consolidado
    tableBody.push([
        { content: 'TOTAL GENERAL DE CAPACITADOS EN EL PERIODO', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
        { content: totalCapacitados.toString(), styles: { halign: 'center', fontStyle: 'bold', fillColor: [240, 240, 240] } }
    ]);

    while (tableBody.length < 12) {
        tableBody.push([tableBody.length + 1, '', '', '', '', '', '', '']);
    }

    autoTable(doc, {
        startY: 60,
        margin: { left: margin, right: margin },
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
        headStyles: { fillColor: [240, 240, 240], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
            0: { cellWidth: 8, halign: 'center' },
            1: { cellWidth: 60 },
            2: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 25, halign: 'center' },
            4: { cellWidth: 60 },
            5: { cellWidth: 20, halign: 'center' },
            6: { cellWidth: 35, halign: 'center' },
            7: { cellWidth: 20, halign: 'center' }
        },
        head: [['N.º', 'LUGAR DE DIVULGACIÓN', 'FECHA', 'HORARIO', 'NOMBRE COMPLETO FUNCIONARIO DIVULGADOR', 'C.I.C. N.º', 'VÍNCULO', 'CANTIDAD']],
        body: tableBody,
    });

    const finalY = (doc as any).lastAutoTable.finalY + 25;
    
    // Matriz de firmas para Jefatura
    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    doc.line(pageWidth - margin - 70, finalY, pageWidth - margin - 10, finalY);
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text("FIRMA Y SELLO JEFATURA DE OFICINA", pageWidth - margin - 40, finalY + 5, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    doc.text("Aclaración: ____________________________________", pageWidth - margin - 40, finalY + 10, { align: 'center' });

    doc.setFontSize(7);
    doc.text("- Reporte generado a través del Sistema de Gestión CIDEE.", margin, finalY + 15);
    doc.setFont('helvetica', 'bold');
    doc.text("- TOTAL CONSOLIDADO DE CIUDADANOS CAPACITADOS: " + totalCapacitados, margin, finalY + 19);

    doc.save(`AnexoIV-${isGlobal ? 'NACIONAL' : selectedDistrict?.replace(/\s+/g, '-')}-Semana.pdf`);
  };

  const handleSubmit = () => {
    if (!firestore || !user) return;
    if (!informesAnexoIII || informesAnexoIII.length === 0) {
        toast({ variant: "destructive", title: "Sin datos", description: "No hay informes de Anexo III para consolidar." }); return;
    }
    if (selectedDepartment === 'ALL' || selectedDistrict === 'ALL') {
        toast({ variant: "destructive", title: "Seleccione ubicación", description: "Para guardar el reporte oficial debe seleccionar un distrito específico." }); return;
    }
    if (photos.length === 0) {
        toast({ variant: "destructive", title: "Respaldo Requerido", description: "Debe adjuntar al menos una foto del Anexo IV físico firmado." }); return;
    }

    setIsSubmitting(true);
    
    const performSubmit = async () => {
      try {
        const idBatch = Date.now();
        const distPath = selectedDistrict?.replace(/\s+/g, '_') || 'desconocido';
        
        // 1. Subir todas las fotos a Storage
        const uploadPromises = photos.map((foto, idx) => {
          const type = idx === 0 ? 'respaldo' : 'evidencia';
          return uploadFile(
            `anexo-iv/${distPath}/${idBatch}_${type}_${idx}.jpg`, 
            foto
          );
        });
        
        const uploadedUrls = await Promise.all(uploadPromises);

        const docData = {
          departamento: selectedDepartment || '',
          distrito: selectedDistrict || '',
          semana_desde: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : '',
          semana_hasta: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : '',
          foto_respaldo_documental: uploadedUrls[0], // Primera URL es el respaldo
          fotos_evidencia: uploadedUrls.slice(1),   // El resto son evidencia
          total_capacitados: totalCapacitados,
          filas: informesAnexoIII.map(inf => ({
            lugar: inf.lugar_divulgacion,
            fecha: inf.fecha,
            hora_desde: inf.hora_desde,
            hora_hasta: inf.hora_hasta,
            nombre_divulgador: inf.nombre_divulgador || (inf as any).divulgador_nombre || '',
            cedula: inf.cedula_divulgador || (inf as any).divulgador_cedula || '',
            vinculo: inf.vinculo || (inf as any).divulgador_vinculo || '',
            cantidad_personas: inf.total_personas || 0,
          })),
          usuario_id: user.uid,
          fecha_creacion: new Date().toISOString(),
          server_timestamp: serverTimestamp(),
        };

        await addDoc(collection(firestore, 'informes-semanales-anexo-iv'), docData);
        
        recordAuditLog(firestore, {
          usuario_id: user.uid,
          usuario_nombre: user.profile?.username || user.email || 'Admin',
          usuario_rol: user.profile?.role || 'admin',
          accion: 'CREAR',
          modulo: 'informe-semanal-anexo-iv',
          detalles: `Consolidado semanal guardado en Storage para ${selectedDistrict}`
        });

        toast({ title: "¡Consolidado Guardado!", description: "El informe semanal ha sido archivado en el sistema." });
        setPhotos([]);
      } catch (error: any) {
        console.error("Error submitting anexo iv:", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo guardar el informe." });
      } finally {
        setIsSubmitting(false);
      }
    };

    performSubmit();
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Anexo IV - Informe Semanal" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Anexo IV - Informe Semanal</h1>
                <p className="text-muted-foreground text-xs font-bold uppercase flex items-center gap-2 mt-1">
                    <TableProperties className="h-3.5 w-3.5" /> Consolida automáticamente los Anexos III del distrito.
                </p>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" className="font-black uppercase text-[10px] border-2 h-10 gap-2 shadow-sm" onClick={generatePDF} disabled={informesAnexoIII.length === 0}>
                    <Printer className="mr-2 h-4 w-4" /> GENERAR PDF HORIZONTAL
                </Button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Card className="lg:col-span-1 shadow-lg border-none">
                <CardHeader className="bg-black text-white py-4">
                    <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
                        <Search className="h-4 w-4" /> FILTROS DE JURISDICCIÓN
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Departamento</Label>
                        {isAdminView ? (
                          <Select onValueChange={(v) => { setSelectedDepartment(v); setSelectedDistrict('ALL'); }} value={selectedDepartment || undefined}>
                            <SelectTrigger className="h-11 font-bold border-2"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL" className="font-black text-primary flex items-center gap-2"><Globe className="h-3 w-3 mr-2" /> NACIONAL (TODOS)</SelectItem>
                                {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : <Input value={selectedDepartment || ''} readOnly className="bg-muted/30 font-black uppercase text-xs h-11 border-2" />}
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Distrito / Oficina</Label>
                        {(isAdminView || isJefeView) ? (
                          <Select onValueChange={setSelectedDistrict} value={selectedDistrict || undefined} disabled={!selectedDepartment || selectedDepartment === 'ALL'}>
                            <SelectTrigger className="h-11 font-bold border-2"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL" className="font-black text-primary">TODOS LOS DISTRITOS</SelectItem>
                                {districts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : <Input value={selectedDistrict || ''} readOnly className="bg-muted/30 font-black uppercase text-xs h-11 border-2" />}
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[11px] font-black uppercase text-black tracking-tight">RANGO SEMANAL</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <div className="relative group cursor-pointer">
                                <div className={cn(
                                    "h-14 w-full flex items-center px-5 font-black text-xs border-2 rounded-xl bg-white group-hover:border-primary transition-all",
                                    !dateRange?.from && "text-muted-foreground/40"
                                )}>
                                  {dateRange?.from ? (
                                    dateRange.to ? (
                                      <>
                                        {format(dateRange.from, "dd/MM/yyyy")} - {format(dateRange.to, "dd/MM/yyyy")}
                                      </>
                                    ) : (
                                      format(dateRange.from, "dd/MM/yyyy")
                                    )
                                  ) : (
                                    <span className="tracking-widest">__/__/____ - __/__/____</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-30" />
                                </div>
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 shadow-2xl rounded-2xl border-none overflow-hidden" align="center">
                            <Calendar
                              initialFocus
                              mode="range"
                              defaultMonth={dateRange?.from}
                              selected={dateRange}
                              onSelect={setDateRange}
                              numberOfMonths={1}
                              locale={es}
                              className="bg-white"
                            />
                          </PopoverContent>
                        </Popover>
                    </div>

                    <Separator className="border-dashed" />

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-black uppercase text-primary flex items-center gap-2">
                                <FileText className="h-4 w-4" /> Respaldo Anexo IV Firmado ({photos.length}/12)
                            </Label>
                            {photos.length > 0 && photos.length < 12 && (
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-primary/5 hover:bg-primary/10 text-primary" onClick={startCamera}>
                                        <Camera className="h-3.5 w-3.5" />
                                    </Button>
                                    <label className="h-7 w-7 rounded-full bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center cursor-pointer transition-all">
                                        <FileUp className="h-3.5 w-3.5" />
                                        <input type="file" accept="image/*,.pdf" multiple className="hidden" onChange={handlePhotosUpload} />
                                    </label>
                                </div>
                            )}
                        </div>

                        {photos.length > 0 ? (
                            <div className="grid grid-cols-3 gap-2">
                                {photos.map((photo, i) => (
                                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden border-2 border-primary shadow-sm group">
                                        {photo.startsWith('data:application/pdf') ? (
                                            <div className="w-full h-full flex flex-col items-center justify-center bg-muted/30">
                                                <FileText className="h-8 w-8 text-primary opacity-40 mb-1" />
                                                <p className="text-[7px] font-black uppercase text-primary/60">PDF</p>
                                            </div>
                                        ) : (
                                            <Image src={photo} alt={`Foto ${i+1}`} fill className="object-cover" />
                                        )}
                                        <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}>
                                            <X className="h-3 w-3" />
                                        </Button>
                                        <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[7px] px-1.5 py-0.5 rounded-md font-black">
                                            {i === 0 ? "PRINCIPAL" : i + 1}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                <Button variant="outline" className="h-20 flex flex-col items-center justify-center border-dashed border-2 rounded-xl gap-1 hover:bg-primary/5 hover:border-primary transition-all" onClick={startCamera}>
                                    <Camera className="h-5 w-5 opacity-40" />
                                    <span className="text-[9px] font-black uppercase">CÁMARA</span>
                                </Button>
                                <label className="h-20 flex flex-col items-center justify-center border-2 border-dashed rounded-xl gap-1 cursor-pointer hover:bg-primary/5 hover:border-primary transition-all">
                                    <FileUp className="h-5 w-5 opacity-40" />
                                    <span className="text-[9px] font-black uppercase">SUBIR</span>
                                    <Input type="file" accept="image/*,.pdf" multiple className="hidden" onChange={handlePhotosUpload} />
                                </label>
                            </div>
                        )}
                    </div>

                    <div className="pt-4">
                        <Button onClick={handleSubmit} disabled={isSubmitting || isStorageUploading || informesAnexoIII.length === 0 || photos.length === 0 || selectedDepartment === 'ALL'} className="w-full font-black uppercase h-12 bg-black hover:bg-black/90">
                            {isSubmitting || isStorageUploading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <DatabaseZap className="mr-2 h-4 w-4" />}
                            GUARDAR REPORTE
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="lg:col-span-3 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-white border-2 shadow-sm p-6 rounded-2xl flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-primary/5 flex items-center justify-center">
                            <Users className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">FUNCIONARIOS ACTIVOS</p>
                            <p className="text-2xl font-black">{totalDivulgadores}</p>
                        </div>
                    </Card>
                    <Card className="bg-black text-white p-6 rounded-2xl flex items-center gap-4 shadow-xl">
                        <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
                            {selectedDepartment === 'ALL' ? <Globe className="h-6 w-6 text-white animate-pulse" /> : <CheckCircle2 className="h-6 w-6 text-white" />}
                        </div>
                        <div>
                            <p className="text-[9px] font-black uppercase opacity-60 tracking-widest leading-none mb-1">
                                {selectedDepartment === 'ALL' ? 'TOTAL PAÍS CAPACITADOS' : 'TOTAL DISTRITO CAPACITADOS'}
                            </p>
                            <p className="text-2xl font-black">{totalCapacitados}</p>
                        </div>
                    </Card>
                </div>

                <Card className="shadow-xl border-none overflow-hidden">
                    <CardHeader className="bg-primary text-white py-4">
                        <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                            <FileText className="h-4 w-4" /> VISTA PREVIA DE CONSOLIDACIÓN ({informesAnexoIII.length} REGISTROS)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-auto max-h-[600px]">
                            <Table>
                                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                    <TableRow>
                                        <TableHead className="text-[9px] font-black uppercase w-10">N.º</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase">Lugar</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase">Fecha</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase">Horario</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase">Funcionario Divulgador</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase">C.I.</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase">Vínculo</TableHead>
                                        <TableHead className="text-right text-[9px] font-black uppercase">Cantidad</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="bg-white">
                                    {isLoadingInformes ? (
                                        <TableRow><TableCell colSpan={8} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow>
                                    ) : informesAnexoIII.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-20">
                                                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground opacity-20 mb-4" />
                                                <p className="text-xs font-black text-muted-foreground uppercase">
                                                    {!selectedDepartment ? "Seleccione un departamento para buscar informes" : `No hay informes individuales para este rango en la selección actual`}
                                                </p>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        informesAnexoIII.map((inf, idx) => {
                                            const nombre = inf.nombre_divulgador || (inf as any).divulgador_nombre || '---';
                                            const ci = inf.cedula_divulgador || (inf as any).divulgador_cedula || '---';
                                            const vinc = inf.vinculo || (inf as any).divulgador_vinculo || '---';

                                            return (
                                                <TableRow key={inf.id} className="hover:bg-muted/30 transition-colors border-b">
                                                    <TableCell className="font-black text-xs text-muted-foreground">{idx + 1}</TableCell>
                                                    <TableCell className="font-black text-[10px] uppercase text-primary leading-tight">
                                                        {(selectedDepartment === 'ALL' || selectedDistrict === 'ALL') && (
                                                            <span className="block text-[7px] text-muted-foreground mb-0.5">[{inf.distrito}]</span>
                                                        )}
                                                        {inf.lugar_divulgacion}
                                                    </TableCell>
                                                    <TableCell className="text-[9px] font-bold">{formatDateToDDMMYYYY(inf.fecha)}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1 text-[9px] font-black uppercase text-muted-foreground">
                                                            <Clock className="h-2.5 w-2.5" /> {inf.hora_desde} A {inf.hora_hasta} HS
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-black text-[10px] uppercase text-primary">{nombre}</TableCell>
                                                    <TableCell className="text-[10px] font-bold">C.I. {ci}</TableCell>
                                                    <TableCell><Badge variant="secondary" className="text-[8px] font-black uppercase bg-primary/5 text-primary border-none">{vinc}</Badge></TableCell>
                                                    <TableCell className="text-right font-black text-primary">{inf.total_personas}</TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                    <CardFooter className="bg-muted/30 p-4 flex justify-between border-t">
                        <p className="text-[10px] font-black uppercase text-muted-foreground italic">
                            Total {selectedDepartment === 'ALL' ? 'Nacional' : 'DISTRITO'} consolidado en periodo:
                        </p>
                        <p className="text-xl font-black text-primary">{totalCapacitados} Ciudadanos</p>
                    </CardFooter>
                </Card>
            </div>
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
