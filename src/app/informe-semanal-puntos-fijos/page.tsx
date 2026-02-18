
"use client";

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, TableProperties, CheckCircle2, FileDown, DatabaseZap, AlertCircle } from 'lucide-react';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { type InformeSemanalFila, type InformeDivulgador } from '@/lib/data';

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

  // Fetch Informes del Divulgador (Anexo III) to populate this summary
  const informesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.profile?.distrito) return null;
    return query(
      collection(firestore, 'informes-divulgador'),
      where('departamento', '==', user.profile.departamento),
      where('distrito', '==', user.profile.distrito),
      orderBy('fecha', 'desc')
    );
  }, [firestore, user]);

  const { data: informesAnexoIII, isLoading: isLoadingInformes } = useCollection<InformeDivulgador>(informesQuery);

  const consolidatedFilas = useMemo(() => {
    if (!informesAnexoIII) return Array(12).fill(null).map(() => ({
      lugar: '',
      fecha: '',
      hora_desde: '',
      hora_hasta: '',
      nombre_divulgador: '',
      cedula: '',
      vinculo: '',
      cantidad_personas: 0,
    }));

    // Map existing reports to the table structure
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

    // Ensure we always show at least 12 rows for the visual format
    const emptyRowsCount = Math.max(0, 12 - mapped.length);
    const emptyRows = Array(emptyRowsCount).fill(null).map(() => ({
      lugar: '',
      fecha: '',
      hora_desde: '',
      hora_hasta: '',
      nombre_divulgador: '',
      cedula: '',
      vinculo: '',
      cantidad_personas: 0,
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
        toast({ variant: "destructive", title: "Sin datos", description: "No hay informes del divulgador registrados para consolidar." });
        return;
    }

    setIsSubmitting(true);
    try {
      const informeData = {
        departamento: user.profile?.departamento || '',
        distrito: user.profile?.distrito || '',
        filas: consolidatedFilas.filter(f => f.lugar), // Solo guardar filas con datos reales
        usuario_id: user.uid,
        fecha_creacion: new Date().toISOString(),
        server_timestamp: serverTimestamp(),
      };
      await addDoc(collection(firestore, 'informes-semanales-anexo-iv'), informeData);
      
      toast({ title: "¡Consolidado Guardado!", description: "El informe semanal ha sido registrado con éxito." });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar el informe." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const generatePDF = () => {
    setIsGeneratingPdf(true);
    try {
        const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' }) as jsPDFWithAutoTable;
        const margin = 10;
        const pageWidth = doc.internal.pageSize.getWidth();

        if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', margin, 5, 15, 15);
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text("ANEXO IV", pageWidth / 2, 12, { align: "center" });
        doc.setFontSize(12);
        doc.text("INFORME SEMANAL PUNTOS FIJOS DE DIVULGACIÓN 2026", pageWidth / 2, 18, { align: "center" });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        
        const yInfo = 28;
        doc.text(`REPORTE CONSOLIDADO AL: ${new Date().toLocaleDateString('es-PY')}`, margin, yInfo);
        
        doc.text(`DISTRITO: ${(user?.profile?.distrito || '').toUpperCase()}`, margin, yInfo + 6);
        doc.text(`DEPARTAMENTO: ${(user?.profile?.departamento || '').toUpperCase()}`, margin + 80, yInfo + 6);

        const tableBody = consolidatedFilas.map((f, i) => [
            i + 1,
            f.lugar.toUpperCase(),
            f.fecha,
            f.hora_desde ? `DE: ${f.hora_desde} A: ${f.hora_hasta} HS.` : '',
            f.nombre_divulgador.toUpperCase(),
            f.cedula,
            f.vinculo.toUpperCase(),
            f.cantidad_personas || ''
        ]);

        autoTable(doc, {
            startY: 45,
            head: [[
                'N.º', 
                'LUGAR DE DIVULGACIÓN', 
                'FECHA', 
                'HORARIO', 
                'NOMBRE COMPLETO FUNCIONARIO DIVULGADOR', 
                'C.I.C. N.º', 
                'VÍNCULO', 
                'CANT. PERS.'
            ]],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', halign: 'center', fontSize: 7 },
            styles: { fontSize: 7, cellPadding: 2, halign: 'center' },
            columnStyles: {
                0: { cellWidth: 8 },
                1: { cellWidth: 45, halign: 'left' },
                2: { cellWidth: 20 },
                3: { cellWidth: 35 },
                4: { cellWidth: 50, halign: 'left' },
                5: { cellWidth: 20 },
                6: { cellWidth: 35 },
                7: { cellWidth: 15 },
            },
            margin: { left: margin, right: margin }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 20;
        doc.line(pageWidth - 80, finalY, pageWidth - margin, finalY);
        doc.setFontSize(8);
        doc.text("FIRMA Y SELLO DE LOS JEFES", pageWidth - 45, finalY + 5, { align: "center" });

        doc.save(`AnexoIV-${user?.profile?.distrito || 'Semanal'}.pdf`);
    } catch (error) {
        console.error(error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo generar el PDF." });
    } finally {
        setIsGeneratingPdf(false);
    }
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <Header title="Informe Semanal - Anexo IV" />
      <main className="flex-1 p-4 md:p-8">
        <Card className="mx-auto max-w-7xl shadow-xl border-t-4 border-t-primary">
          <CardHeader className="bg-primary/5">
            <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                        <TableProperties className="h-6 w-6 text-primary" />
                        ANEXO IV - INFORME SEMANAL PUNTOS FIJOS DE DIVULGACIÓN
                    </CardTitle>
                    <CardDescription>Resumen automatizado de actividades basado en los Informes del Divulgador (Anexo III).</CardDescription>
                </div>
                <div className="flex gap-2">
                    <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-2 text-right">
                        <p className="text-[10px] font-black text-primary uppercase leading-none">Departamento</p>
                        <p className="text-sm font-bold truncate">{user?.profile?.departamento || 'No asignado'}</p>
                    </div>
                    <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-2 text-right">
                        <p className="text-[10px] font-black text-primary uppercase leading-none">Distrito</p>
                        <p className="text-sm font-bold truncate">{user?.profile?.distrito || 'No asignado'}</p>
                    </div>
                </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            
            {isLoadingInformes ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Sincronizando con Anexo III...</p>
                </div>
            ) : informesAnexoIII && informesAnexoIII.length > 0 ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 bg-green-50 border border-green-100 p-3 rounded-md text-green-700">
                        <DatabaseZap className="h-4 w-4" />
                        <span className="text-xs font-bold uppercase">Se han vinculado {informesAnexoIII.length} informes del divulgador registrados recientemente.</span>
                    </div>
                    
                    <div className="overflow-x-auto border rounded-lg shadow-inner bg-background">
                        <table className="w-full text-xs">
                            <thead>
                            <tr className="bg-muted border-b">
                                <th className="p-2 text-center border-r w-10">N.º</th>
                                <th className="p-2 text-left border-r min-w-[200px]">LUGAR DE DIVULGACIÓN</th>
                                <th className="p-2 text-center border-r w-32">FECHA</th>
                                <th className="p-2 text-center border-r min-w-[180px]">HORARIO (DE / A)</th>
                                <th className="p-2 text-left border-r min-w-[200px]">FUNCIONARIO DIVULGADOR</th>
                                <th className="p-2 text-center border-r w-28">C.I.C. N.º</th>
                                <th className="p-2 text-center border-r w-32">VÍNCULO</th>
                                <th className="p-2 text-center w-24">CANT. PERS.</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y">
                            {consolidatedFilas.map((fila, i) => (
                                <tr key={i} className={fila.lugar ? "hover:bg-primary/5 transition-colors" : "bg-muted/5"}>
                                <td className="p-2 text-center font-bold border-r text-muted-foreground">{i + 1}</td>
                                <td className="p-2 border-r uppercase font-medium">{fila.lugar}</td>
                                <td className="p-2 border-r text-center">{fila.fecha}</td>
                                <td className="p-2 border-r text-center">
                                    {fila.hora_desde ? `${fila.hora_desde} - ${fila.hora_hasta}` : ''}
                                </td>
                                <td className="p-2 border-r uppercase">{fila.nombre_divulgador}</td>
                                <td className="p-2 border-r text-center">{fila.cedula}</td>
                                <td className="p-2 border-r uppercase text-center">{fila.vinculo}</td>
                                <td className="p-2 text-center font-black text-primary">
                                    {fila.lugar ? fila.cantidad_personas : ''}
                                </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 gap-4 border-2 border-dashed rounded-xl">
                    <AlertCircle className="h-12 w-12 text-muted-foreground" />
                    <div className="text-center">
                        <p className="text-lg font-black text-muted-foreground uppercase">No hay datos para consolidar</p>
                        <p className="text-sm text-muted-foreground">Primero debe registrar los informes individuales en el módulo <b>"Informe del Divulgador"</b>.</p>
                    </div>
                </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-4 bg-muted/10 border-t p-6">
            <Button onClick={generatePDF} variant="outline" className="w-full sm:w-auto font-bold h-12" disabled={isGeneratingPdf || !informesAnexoIII || informesAnexoIII.length === 0}>
              {isGeneratingPdf ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <FileDown className="mr-2 h-5 w-5" />} GENERAR ANEXO IV (PDF)
            </Button>
            <div className="flex-1" />
            <Button onClick={handleSubmit} disabled={isSubmitting || !informesAnexoIII || informesAnexoIII.length === 0} className="w-full sm:w-auto px-10 h-12 font-bold text-lg shadow-lg">
              {isSubmitting ? <><Loader2 className="animate-spin mr-2 h-5 w-5" /> GUARDANDO...</> : <><CheckCircle2 className="mr-2 h-5 w-5" /> GUARDAR CONSOLIDADO SEMANAL</>}
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
