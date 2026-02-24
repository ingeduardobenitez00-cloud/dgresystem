
"use client";

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, TableProperties, CheckCircle2, FileDown, DatabaseZap, AlertCircle, Search } from 'lucide-react';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { type InformeDivulgador, type Dato } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDateToDDMMYYYY } from '@/lib/utils';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

export default function InformeSemanalAnexoIVPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);

  const profile = user?.profile;
  const hasAdminFilter = ['admin', 'director'].includes(profile?.role || '') || profile?.permissions?.includes('admin_filter');
  const hasDeptFilter = !hasAdminFilter && profile?.permissions?.includes('department_filter');
  const hasDistFilter = !hasAdminFilter && !hasDeptFilter && (profile?.permissions?.includes('district_filter') || profile?.role === 'jefe' || profile?.role === 'funcionario');

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollection<Dato>(datosQuery);

  useEffect(() => {
    if (!isUserLoading && profile) {
      if (hasAdminFilter) {
        // Libre navegación
      } else if (hasDeptFilter && profile.departamento) {
        setSelectedDepartment(profile.departamento);
      } else if (hasDistFilter && profile.departamento && profile.distrito) {
        setSelectedDepartment(profile.departamento);
        setSelectedDistrict(profile.distrito);
      }
    }
  }, [isUserLoading, profile, hasAdminFilter, hasDeptFilter, hasDistFilter]);

  useEffect(() => {
    if (datosData) {
      const uniqueDepts = [...new Set(datosData.map(d => d.departamento))].sort();
      setDepartments(uniqueDepts);
      
      if (selectedDepartment) {
        const uniqueDistricts = [...new Set(datosData.filter(d => d.departamento === selectedDepartment).map(d => d.distrito))].sort();
        setDistricts(uniqueDistricts);
      }
    }
  }, [datosData, selectedDepartment]);

  const informesQuery = useMemoFirebase(() => {
    if (!firestore || !selectedDepartment || !selectedDistrict) return null;
    return query(
      collection(firestore, 'informes-divulgador'),
      where('departamento', '==', selectedDepartment),
      where('distrito', '==', selectedDistrict)
    );
  }, [firestore, selectedDepartment, selectedDistrict]);

  const { data: rawInformesAnexoIII, isLoading: isLoadingInformes } = useCollection<InformeDivulgador>(informesQuery);

  // Ordenamiento en memoria
  const informesAnexoIII = useMemo(() => {
    if (!rawInformesAnexoIII) return null;
    return [...rawInformesAnexoIII].sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [rawInformesAnexoIII]);

  const consolidatedFilas = useMemo(() => {
    const emptyRows = Array(12).fill(null).map(() => ({
      lugar: '',
      fecha: '',
      hora_desde: '',
      hora_hasta: '',
      nombre_divulgador: '',
      cedula: '',
      vinculo: '',
      cantidad_personas: 0,
    }));

    if (!informesAnexoIII || informesAnexoIII.length === 0) return emptyRows;

    const mapped = informesAnexoIII.map(inf => ({
      lugar: inf.lugar_divulgacion,
      fecha: inf.fecha,
      hora_desde: inf.hora_desde,
      hora_hasta: inf.hora_hasta,
      nombre_divulgador: inf.nombre_divulgador,
      cedula: inf.cedula_divulgador,
      vinculo: inf.vinculo,
      cantidad_personas: inf.total_personas || 0,
    }));

    return [...mapped, ...emptyRows].slice(0, 12);
  }, [informesAnexoIII]);

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

  const handleSubmit = async () => {
    if (!firestore || !user || !informesAnexoIII || informesAnexoIII.length === 0) {
        toast({ variant: "destructive", title: "Sin datos", description: "No hay informes registrados para consolidar." });
        return;
    }

    setIsSubmitting(true);
    const docData = {
      departamento: selectedDepartment || '',
      distrito: selectedDistrict || '',
      filas: consolidatedFilas.filter(f => f.lugar),
      usuario_id: user.uid,
      fecha_creacion: new Date().toISOString(),
      server_timestamp: serverTimestamp(),
    };

    try {
      await addDoc(collection(firestore, 'informes-semanales-anexo-iv'), docData);
      toast({ title: "¡Consolidado Guardado!" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error" });
    } finally { setIsSubmitting(false); }
  };

  const generatePDF = () => {
    setIsGeneratingPdf(true);
    try {
        const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' }) as jsPDFWithAutoTable;
        const margin = 10;
        const pageWidth = doc.internal.pageSize.getWidth();

        if (logoBase64) doc.addImage(logoBase64, 'PNG', margin, 5, 15, 15);

        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text("ANEXO IV", pageWidth / 2, 12, { align: "center" });
        doc.setFontSize(12); doc.text("INFORME SEMANAL PUNTOS FIJOS DE DIVULGACIÓN 2026", pageWidth / 2, 18, { align: "center" });

        doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        doc.text(`REPORTE CONSOLIDADO AL: ${new Date().toLocaleDateString('es-PY')}`, margin, 28);
        doc.text(`DISTRITO: ${(selectedDistrict || '').toUpperCase()}`, margin, 34);
        doc.text(`DEPARTAMENTO: ${(selectedDepartment || '').toUpperCase()}`, margin + 80, 34);

        const tableBody = consolidatedFilas.map((f, i) => [
            i + 1,
            f.lugar.toUpperCase(),
            formatDateToDDMMYYYY(f.fecha),
            f.hora_desde ? `DE: ${f.hora_desde} A: ${f.hora_hasta} HS.` : '',
            f.nombre_divulgador.toUpperCase(),
            f.cedula,
            f.vinculo.toUpperCase(),
            f.cantidad_personas || ''
        ]);

        autoTable(doc, {
            startY: 45,
            head: [['N.º', 'LUGAR DE DIVULGACIÓN', 'FECHA', 'HORARIO', 'FUNCIONARIO DIVULGADOR', 'C.I.C. N.º', 'VÍNCULO', 'CANT. PERS.']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', halign: 'center', fontSize: 7 },
            styles: { fontSize: 7, cellPadding: 2, halign: 'center' },
            columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 45, halign: 'left' }, 4: { cellWidth: 50, halign: 'left' } },
            margin: { left: margin, right: margin }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 30;
        doc.text("__________________________________", margin + 50, finalY, { align: "center" });
        doc.text("Firma y aclaración Divulgador", margin + 50, finalY + 5, { align: "center" });
        doc.text("__________________________________", pageWidth - margin - 50, finalY, { align: "center" });
        doc.text("Firma, aclaración y sello Jefes", pageWidth - margin - 50, finalY + 5, { align: "center" });

        doc.save(`AnexoIV-${selectedDistrict || 'Semanal'}.pdf`);
    } catch (error) { toast({ variant: "destructive", title: "Error al generar PDF" }); } finally { setIsGeneratingPdf(false); }
  };

  if (isUserLoading || isLoadingDatos) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <Header title="Informe Semanal - Anexo IV" />
      <main className="flex-1 p-4 md:p-8">
        
        <div className="mx-auto max-w-7xl mb-6">
          <Card className="bg-white border-primary/20 shadow-sm">
            <CardHeader className="py-4">
              <CardTitle className="text-[10px] font-black flex items-center gap-2 uppercase tracking-widest text-primary">
                <Search className="h-4 w-4" /> FILTRO DE JURISDICCIÓN
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[9px] uppercase font-black text-muted-foreground">Departamento</Label>
                  <Select 
                    onValueChange={(v) => { setSelectedDepartment(v); setSelectedDistrict(null); }} 
                    value={selectedDepartment || undefined}
                    disabled={hasDeptFilter || hasDistFilter}
                  >
                    <SelectTrigger className="h-11 font-bold">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map(d => <SelectItem key={d} value={d} className="font-bold">{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] uppercase font-black text-muted-foreground">Distrito</Label>
                  <Select 
                    onValueChange={setSelectedDistrict} 
                    value={selectedDistrict || undefined} 
                    disabled={hasDistFilter || !selectedDepartment}
                  >
                    <SelectTrigger className="h-11 font-bold">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {districts.map(d => <SelectItem key={d} value={d} className="font-bold">{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mx-auto max-w-7xl shadow-xl border-t-4 border-t-primary">
          <CardHeader className="bg-primary/5">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 font-black uppercase text-lg">
                        <TableProperties className="h-6 w-6 text-primary" />
                        Anexo IV - Consolidado Semanal
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase">Sincronización automática con los registros del Anexo III.</CardDescription>
                </div>
                <div className="flex gap-2">
                    <div className="bg-white border-2 border-primary/10 rounded-lg px-4 py-2 text-right">
                        <p className="text-[8px] font-black text-primary uppercase leading-none mb-1">Zona Reportada</p>
                        <p className="text-xs font-black uppercase truncate max-w-[200px]">{selectedDistrict || 'PENDIENTE'} - {selectedDepartment || ''}</p>
                    </div>
                </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {!selectedDepartment || !selectedDistrict ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 border-2 border-dashed rounded-xl bg-white/50">
                  <Search className="h-12 w-12 text-muted-foreground opacity-20" />
                  <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">Seleccione ubicación para cargar datos</p>
              </div>
            ) : isLoadingInformes ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Compilando Informes Individuales...</p>
                </div>
            ) : informesAnexoIII && informesAnexoIII.length > 0 ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 bg-green-50 border-2 border-green-100 p-3 rounded-xl text-green-700">
                        <DatabaseZap className="h-4 w-4" />
                        <span className="text-[10px] font-black uppercase">Se han vinculado {informesAnexoIII.length} registros para este reporte.</span>
                    </div>
                    
                    <div className="overflow-x-auto border-2 rounded-xl shadow-inner bg-background">
                        <table className="w-full text-[10px]">
                            <thead>
                            <tr className="bg-muted/50 border-b-2">
                                <th className="p-3 text-center border-r w-10 font-black">N.º</th>
                                <th className="p-3 text-left border-r min-w-[200px] font-black">LUGAR DE DIVULGACIÓN</th>
                                <th className="p-3 text-center border-r w-32 font-black">FECHA</th>
                                <th className="p-3 text-center border-r min-w-[180px] font-black">HORARIO</th>
                                <th className="p-3 text-left border-r min-w-[200px] font-black">FUNCIONARIO</th>
                                <th className="p-3 text-center border-r w-28 font-black">C.I.C.</th>
                                <th className="p-3 text-center border-r w-32 font-black">VÍNCULO</th>
                                <th className="p-3 text-center w-24 font-black">CANT.</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y-2">
                            {consolidatedFilas.map((fila, i) => (
                                <tr key={i} className={fila.lugar ? "hover:bg-primary/5 transition-colors" : "bg-muted/5"}>
                                <td className="p-3 text-center font-bold border-r text-muted-foreground">{i + 1}</td>
                                <td className="p-3 border-r uppercase font-bold text-primary">{fila.lugar}</td>
                                <td className="p-3 border-r text-center font-bold">{formatDateToDDMMYYYY(fila.fecha)}</td>
                                <td className="p-3 border-r text-center font-medium">{fila.hora_desde ? `${fila.hora_desde} - ${fila.hora_hasta}` : ''}</td>
                                <td className="p-3 border-r uppercase font-bold">{fila.nombre_divulgador}</td>
                                <td className="p-3 border-r text-center font-black">{fila.cedula}</td>
                                <td className="p-3 border-r uppercase text-center font-bold">{fila.vinculo}</td>
                                <td className="p-3 text-center font-black text-primary text-sm">{fila.lugar ? fila.cantidad_personas : ''}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 gap-4 border-2 border-dashed rounded-xl bg-muted/10">
                    <AlertCircle className="h-12 w-12 text-destructive opacity-30" />
                    <div className="text-center space-y-1">
                        <p className="text-sm font-black text-muted-foreground uppercase">Sin registros en {selectedDistrict}</p>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase">No hay Anexos III cargados para consolidar esta semana.</p>
                    </div>
                </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-4 bg-muted/10 border-t p-6">
            <Button onClick={generatePDF} variant="outline" className="w-full sm:w-auto font-black uppercase text-[10px] h-12 px-8 border-2 border-primary/20 text-primary" disabled={isGeneratingPdf || !informesAnexoIII || informesAnexoIII.length === 0}>
              {isGeneratingPdf ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <FileDown className="mr-2 h-4 w-4" />} GENERAR PDF (ANEXO IV)
            </Button>
            <div className="flex-1" />
            <Button onClick={handleSubmit} disabled={isSubmitting || !informesAnexoIII || informesAnexoIII.length === 0} className="w-full sm:w-auto px-12 h-12 font-black uppercase shadow-xl text-xs">
              {isSubmitting ? <><Loader2 className="animate-spin mr-2 h-4 w-4" /> GUARDANDO...</> : <><CheckCircle2 className="mr-2 h-4 w-4" /> GUARDAR REPORTE OFICIAL</>}
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
