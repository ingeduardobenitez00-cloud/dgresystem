
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
  Users
} from 'lucide-react';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
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

export default function InformeSemanalAnexoIVPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [respaldoPhoto, setRespaldoPhoto] = useState<string | null>(null);
  
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: undefined,
    to: undefined,
  });

  const profile = user?.profile;
  
  const isAdminView = ['admin', 'director'].includes(profile?.role || '') || profile?.permissions?.includes('admin_filter');
  const isDistView = !isAdminView && (profile?.permissions?.includes('district_filter') || profile?.role === 'funcionario');
  const isJefeView = !isAdminView && !isDistView && (profile?.role === 'jefe' || profile?.permissions?.includes('department_filter'));

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollection<Dato>(datosQuery);

  const departments = useMemo(() => {
    if (!datosData) return [];
    return [...new Set(datosData.map(d => d.departamento))].sort();
  }, [datosData]);

  const districts = useMemo(() => {
    if (!datosData || !selectedDepartment) return [];
    return [...new Set(datosData.filter(d => d.departamento === selectedDepartment).map(d => d.distrito))].sort();
  }, [datosData, selectedDepartment]);

  useEffect(() => {
    if (!isUserLoading && profile) {
      if (!isAdminView) {
        if (profile.departamento) setSelectedDepartment(profile.departamento);
        if (isDistView && profile.distrito) setSelectedDistrict(profile.distrito);
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
    if (!firestore || !selectedDepartment || !selectedDistrict) return null;
    return query(
        collection(firestore, 'informes-divulgador'), 
        where('departamento', '==', selectedDepartment), 
        where('oficina', '==', selectedDistrict)
    );
  }, [firestore, selectedDepartment, selectedDistrict]);

  const { data: rawInformesAnexoIII, isLoading: isLoadingInformes } = useCollection<InformeDivulgador>(informesQuery);

  const informesAnexoIII = useMemo(() => {
    if (!rawInformesAnexoIII) return [];
    let filtered = [...rawInformesAnexoIII];
    
    if (dateRange?.from && dateRange?.to) {
        const fromStr = format(dateRange.from, "yyyy-MM-dd");
        const toStr = format(dateRange.to, "yyyy-MM-dd");
        filtered = filtered.filter(inf => inf.fecha >= fromStr && inf.fecha <= toStr);
    }
    
    return filtered.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [rawInformesAnexoIII, dateRange]);

  const totalCapacitados = useMemo(() => {
    return informesAnexoIII.reduce((acc, curr) => acc + (curr.total_personas || 0), 0);
  }, [informesAnexoIII]);

  const totalDivulgadores = useMemo(() => {
    const cedulas = new Set(informesAnexoIII.map(inf => inf.cedula_divulgador));
    return cedulas.size;
  }, [informesAnexoIII]);

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
        setRespaldoPhoto(dataUri);
        stopCamera();
      }
    }
  };

  const handleRespaldoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setRespaldoPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generatePDF = () => {
    if (!logoBase64 || !selectedDistrict) return;
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
    doc.text(`DISTRITO:  ${(selectedDistrict || '').toUpperCase()}`, margin, 55);
    doc.text(`DEPARTAMENTO:  ${(selectedDepartment || '').toUpperCase()}`, pageWidth / 2 - 20, 55);

    const tableBody = informesAnexoIII.map((inf, idx) => [
        idx + 1,
        inf.lugar_divulgacion.toUpperCase(),
        inf.fecha.split('-').reverse().join('/'),
        inf.nombre_divulgador.toUpperCase(),
        inf.cedula_divulgador,
        inf.vinculo.toUpperCase(),
        inf.total_personas
    ]);

    while (tableBody.length < 12) {
        tableBody.push([tableBody.length + 1, '', '', '', '', '', '']);
    }

    autoTable(doc, {
        startY: 60,
        margin: { left: margin, right: margin },
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
        headStyles: { fillColor: [240, 240, 240], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
            0: { cellWidth: 8, halign: 'center' },
            1: { cellWidth: 70 },
            2: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 70 },
            4: { cellWidth: 25, halign: 'center' },
            5: { cellWidth: 40, halign: 'center' },
            6: { cellWidth: 25, halign: 'center' }
        },
        head: [['N.º', 'LUGAR DE DIVULGACIÓN', 'FECHA', 'NOMBRE COMPLETO FUNCIONARIO DIVULGADOR', 'C.I.C. N.º', 'VÍNCULO', 'CANTIDAD']],
        body: tableBody,
    });

    const finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.line(pageWidth - margin - 60, finalY, pageWidth - margin, finalY);
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text("FIRMA Y SELLO DE LOS JEFES", pageWidth - margin - 30, finalY + 5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text("- Oficina del Registro Electoral o Centro Cívico remite a la Coordinación Departamental correspondiente hasta el martes posterior a la semana de divulgación realizada.", margin, finalY + 15);
    doc.text("- Coordinación Departamental remite a la Dirección del CIDEE.", margin, finalY + 19);

    doc.save(`AnexoIV-${selectedDistrict.replace(/\s+/g, '-')}-Semana.pdf`);
  };

  const handleSubmit = () => {
    if (!firestore || !user) return;
    if (!informesAnexoIII || informesAnexoIII.length === 0) {
        toast({ variant: "destructive", title: "Sin datos", description: "No hay informes de Anexo III para consolidar." }); return;
    }
    if (!respaldoPhoto) {
        toast({ variant: "destructive", title: "Respaldo Requerido", description: "Debe adjuntar la foto del Anexo IV físico firmado." }); return;
    }

    setIsSubmitting(true);
    const docData = {
      departamento: selectedDepartment || '',
      distrito: selectedDistrict || '',
      semana_desde: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : '',
      semana_hasta: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : '',
      foto_respaldo_documental: respaldoPhoto,
      filas: informesAnexoIII.map(inf => ({
        lugar: inf.lugar_divulgacion,
        fecha: inf.fecha,
        hora_desde: inf.hora_desde,
        hora_hasta: inf.hora_hasta,
        nombre_divulgador: inf.nombre_divulgador,
        cedula: inf.cedula_divulgador,
        vinculo: inf.vinculo,
        cantidad_personas: inf.total_personas || 0,
      })),
      usuario_id: user.uid,
      fecha_creacion: new Date().toISOString(),
      server_timestamp: serverTimestamp(),
    };

    addDoc(collection(firestore, 'informes-semanales-anexo-iv'), docData)
      .then(() => {
        toast({ title: "¡Consolidado Guardado!", description: "El informe semanal ha sido archivado en el sistema." });
        setRespaldoPhoto(null);
        setIsSubmitting(false);
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'informes-semanales-anexo-iv', operation: 'create', requestResourceData: docData }));
        setIsSubmitting(false);
      });
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
                          <Select onValueChange={(v) => { setSelectedDepartment(v); setSelectedDistrict(null); }} value={selectedDepartment || undefined}>
                            <SelectTrigger className="h-11 font-bold border-2"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                            <SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                          </Select>
                        ) : <Input value={selectedDepartment || ''} readOnly className="bg-muted/30 font-black uppercase text-xs h-11 border-2" />}
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Distrito / Oficina</Label>
                        {(isAdminView || isJefeView) ? (
                          <Select onValueChange={setSelectedDistrict} value={selectedDistrict || undefined} disabled={!selectedDepartment}>
                            <SelectTrigger className="h-11 font-bold border-2"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                            <SelectContent>{districts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                          </Select>
                        ) : <Input value={selectedDistrict || ''} readOnly className="bg-muted/30 font-black uppercase text-xs h-11 border-2" />}
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[11px] font-black uppercase text-black tracking-tight">RANGO SEMANAL (DESDE - HASTA)</Label>
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
                        <Label className="text-[10px] font-black uppercase text-primary flex items-center gap-2">
                            <FileText className="h-4 w-4" /> Respaldo Anexo IV Firmado *
                        </Label>
                        {respaldoPhoto ? (
                            <div className="relative aspect-video rounded-xl overflow-hidden border-2 border-primary shadow-md group">
                                {respaldoPhoto.startsWith('data:application/pdf') ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-muted/30">
                                        <FileText className="h-10 w-10 text-primary opacity-40 mb-1" />
                                        <p className="text-[8px] font-black uppercase text-primary/60">PDF Cargado</p>
                                    </div>
                                ) : (
                                    <Image src={respaldoPhoto} alt="Respaldo Anexo IV" fill className="object-cover" />
                                )}
                                <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setRespaldoPhoto(null)}>
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                <Button variant="outline" className="h-16 flex flex-col items-center justify-center border-dashed rounded-xl gap-1 hover:bg-primary/5 hover:border-primary transition-all" onClick={startCamera}>
                                    <Camera className="h-4 w-4 opacity-40" />
                                    <span className="text-[8px] font-black uppercase">CÁMARA</span>
                                </Button>
                                <label className="h-16 flex flex-col items-center justify-center border-2 border-dashed rounded-xl gap-1 cursor-pointer hover:bg-primary/5 hover:border-primary transition-all">
                                    <FileUp className="h-4 w-4 opacity-40" />
                                    <span className="text-[8px] font-black uppercase">SUBIR</span>
                                    <Input type="file" accept="image/*,.pdf" className="hidden" onChange={handleRespaldoUpload} />
                                </label>
                            </div>
                        )}
                    </div>

                    <div className="pt-4">
                        <Button onClick={handleSubmit} disabled={isSubmitting || informesAnexoIII.length === 0 || !respaldoPhoto} className="w-full font-black uppercase h-12 bg-black hover:bg-black/90">
                            {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <DatabaseZap className="mr-2 h-4 w-4" />}
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
                            <CheckCircle2 className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black uppercase opacity-60 tracking-widest leading-none mb-1">TOTAL CAPACITADOS</p>
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
                                        <TableHead className="text-[9px] font-black uppercase">Funcionario Divulgador</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase">C.I.</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase">Vínculo</TableHead>
                                        <TableHead className="text-right text-[9px] font-black uppercase">Cantidad</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="bg-white">
                                    {isLoadingInformes ? (
                                        <TableRow><TableCell colSpan={7} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow>
                                    ) : informesAnexoIII.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-20">
                                                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground opacity-20 mb-4" />
                                                <p className="text-xs font-black text-muted-foreground uppercase">
                                                    {!selectedDistrict ? "Seleccione un distrito para buscar informes" : `No hay informes individuales para este rango en ${selectedDistrict}`}
                                                </p>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        informesAnexoIII.map((inf, idx) => (
                                            <TableRow key={inf.id} className="hover:bg-muted/30 transition-colors border-b">
                                                <TableCell className="font-black text-xs text-muted-foreground">{idx + 1}</TableCell>
                                                <TableCell className="font-black text-[10px] uppercase text-primary leading-tight">{inf.lugar_divulgacion}</TableCell>
                                                <TableCell className="text-[9px] font-bold">{formatDateToDDMMYYYY(inf.fecha)}</TableCell>
                                                <TableCell className="font-black text-[10px] uppercase text-primary">{inf.nombre_divulgador}</TableCell>
                                                <TableCell className="text-[10px] font-bold">C.I. {inf.cedula_divulgador}</TableCell>
                                                <TableCell><Badge variant="secondary" className="text-[8px] font-black uppercase bg-primary/5 text-primary border-none">{inf.vinculo}</Badge></TableCell>
                                                <TableCell className="text-right font-black text-primary">{inf.total_personas}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                    <CardFooter className="bg-muted/30 p-4 flex justify-between border-t">
                        <p className="text-[10px] font-black uppercase text-muted-foreground italic">Total consolidado en semana:</p>
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
