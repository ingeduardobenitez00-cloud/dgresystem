"use client";

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, TableProperties, CheckCircle2, FileDown, DatabaseZap, AlertCircle, Search, Printer, FileText, Calendar as CalendarIcon, Landmark } from 'lucide-react';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy } from 'firebase/firestore';
import { type InformeDivulgador, type Dato } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDateToDDMMYYYY, cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import jsPDF from 'jspdf';
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

export default function InformeSemanalAnexoIVPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: undefined,
    to: undefined,
  });

  const profile = user?.profile;
  
  const isAdminView = ['admin', 'director'].includes(profile?.role || '') || profile?.permissions?.includes('admin_filter');
  const isDistView = !isAdminView && (profile?.permissions?.includes('district_filter') || profile?.role === 'funcionario');
  const isJefeView = !isAdminView && !isDistView && (profile?.role === 'jefe' || profile?.permissions?.includes('department_filter'));

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData } = useCollection<Dato>(datosQuery);

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
        `DE: ${inf.hora_desde} A: ${inf.hora_hasta} HS.`,
        inf.nombre_divulgador.toUpperCase(),
        inf.cedula_divulgador,
        inf.vinculo.toUpperCase(),
        inf.total_personas
    ]);

    while (tableBody.length < 12) {
        tableBody.push([tableBody.length + 1, '', '', 'DE:    A:    HS.', '', '', '', '']);
    }

    autoTable(doc, {
        startY: 60,
        margin: { left: margin, right: margin },
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
        headStyles: { fillColor: [240, 240, 240], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
            0: { cellWidth: 8, halign: 'center' },
            1: { cellWidth: 55 },
            2: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 35, halign: 'center' },
            4: { cellWidth: 60 },
            5: { cellWidth: 20, halign: 'center' },
            6: { cellWidth: 40, halign: 'center' },
            7: { cellWidth: 25, halign: 'center' }
        },
        head: [['N.º', 'LUGAR DE DIVULGACIÓN', 'FECHA', 'HORARIO', 'NOMBRE COMPLETO FUNCIONARIO DIVULGADOR', 'C.I.C. N.º', 'VÍNCULO', 'CANTIDAD DE PERSONAS']],
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
    if (!firestore || !user || !informesAnexoIII || informesAnexoIII.length === 0) {
        toast({ variant: "destructive", title: "Sin datos", description: "No hay informes de Anexo III para consolidar." }); return;
    }

    setIsSubmitting(true);
    const docData = {
      departamento: selectedDepartment || '',
      distrito: selectedDistrict || '',
      semana_desde: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : '',
      semana_hasta: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : '',
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
                <Button variant="outline" className="font-black uppercase text-[10px] border-2 h-10 shadow-sm" onClick={generatePDF} disabled={informesAnexoIII.length === 0}>
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

                    <div className="pt-4">
                        <Button onClick={handleSubmit} disabled={isSubmitting || informesAnexoIII.length === 0} className="w-full font-black uppercase h-12 bg-black hover:bg-black/90">
                            {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <DatabaseZap className="mr-2 h-4 w-4" />}
                            GUARDAR REPORTE
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="lg:col-span-3 shadow-xl border-none overflow-hidden">
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
                                    <TableHead className="text-[9px] font-black uppercase">Lugar de Divulgación</TableHead>
                                    <TableHead className="text-[9px] font-black uppercase">Fecha</TableHead>
                                    <TableHead className="text-[9px] font-black uppercase">Divulgador</TableHead>
                                    <TableHead className="text-right text-[9px] font-black uppercase">Personas</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody className="bg-white">
                                {isLoadingInformes ? (
                                    <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow>
                                ) : informesAnexoIII.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-20">
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
                                            <TableCell className="font-black text-[11px] uppercase text-primary">{inf.lugar_divulgacion}</TableCell>
                                            <TableCell className="text-[10px] font-bold">{formatDateToDDMMYYYY(inf.fecha)}</TableCell>
                                            <TableCell>
                                                <p className="font-black text-[10px] uppercase leading-tight">{inf.nombre_divulgador}</p>
                                                <p className="text-[9px] font-bold text-muted-foreground uppercase">{inf.vinculo}</p>
                                            </TableCell>
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
      </main>
    </div>
  );
}
