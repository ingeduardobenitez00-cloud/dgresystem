
"use client";

import { useState, useEffect } from 'react';
import Header from "@/components/header";
import { useFirebase, useCollectionOnce, useMemoFirebase, useUser } from '@/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { type Dato, type ReportData, type ImageData } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Loader2, Download, FileArchive, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cleanFileName } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

export default function InformeGeneralPage() {
  const { firestore } = useFirebase();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [logo1, setLogo1] = useState<string | null>(null);
  const [logo2, setLogo2] = useState<string | null>(null);
  
  const canGenerate = currentUser?.profile?.role === 'admin' || currentUser?.profile?.permissions?.includes('generar_pdf');

  useEffect(() => {
    const fetchLogos = async () => {
        try {
            const [r1, r2] = await Promise.all([fetch('/logo1.png'), fetch('/logo.png')]);
            const [b1, b2] = await Promise.all([r1.blob(), r2.blob()]);
            const reader = new FileReader();
            reader.onloadend = () => setLogo1(reader.result as string);
            reader.readAsDataURL(b1);
            const reader2 = new FileReader();
            reader2.onloadend = () => setLogo2(reader2.result as string);
            reader2.readAsDataURL(b2);
        } catch (e) { console.error(e); }
    };
    fetchLogos();
  }, []);

  const handleGenerate = async () => {
    if (!firestore || !canGenerate) return;
    setIsGenerating(true);
    toast({ title: "Iniciando generación", description: "Esto puede tardar según el volumen de datos." });

    try {
        // Fetch ALL data on demand only to save memory on start
        const [datosSnap, reportsSnap, imagesSnap] = await Promise.all([
            getDocs(collection(firestore, 'datos')),
            getDocs(collection(firestore, 'reports')),
            getDocs(collection(firestore, 'imagenes'))
        ]);

        const datos = datosSnap.docs.map(d => d.data() as Dato);
        const reports = reportsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ReportData));
        const images = imagesSnap.docs.map(d => ({ id: d.id, ...d.data() } as ImageData));

        const doc = new jsPDF() as jsPDFWithAutoTable;
        const pageWidth = doc.internal.pageSize.getWidth();
        
        // Cover
        if (logo1) doc.addImage(logo1, 'PNG', pageWidth/2 - 50, 40, 45, 45);
        if (logo2) doc.addImage(logo2, 'PNG', pageWidth/2 + 5, 40, 45, 45);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('Informe Consolidado de Registros Electorales', pageWidth/2, 120, { align: 'center' });
        doc.setFontSize(14);
        doc.text(new Date().toLocaleDateString('es-PY'), pageWidth/2, 140, { align: 'center' });

        // Simple table for results to keep PDF light
        const tableData = datos.map(d => {
            const report = reports.find(r => r.departamento === d.departamento && r.distrito === d.distrito);
            return [d.departamento, d.distrito, report ? 'CARGADO' : 'PENDIENTE'];
        }).sort((a,b) => a[0].localeCompare(b[0]));

        doc.addPage();
        autoTable(doc, {
            head: [['Departamento', 'Distrito', 'Estado']],
            body: tableData,
            startY: 20,
            theme: 'striped',
            headStyles: { fillColor: [0, 0, 0] }
        });

        doc.save(`Informe-General-${new Date().getTime()}.pdf`);
        toast({ title: "Informe generado con éxito" });
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: "Error al generar" });
    } finally {
        setIsGenerating(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/5">
      <Header title="Generador de Informe General" />
      <main className="flex-1 p-8 flex items-center justify-center">
        <Card className="w-full max-w-lg shadow-xl">
           <CardHeader className="text-center">
            <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileArchive className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="uppercase font-black">Motor de Reportes PDF</CardTitle>
            <CardDescription>Genera un documento con el estado de carga de todo el país.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <p className="text-[10px] text-amber-800 font-bold uppercase leading-tight">
                    Este proceso consume altos recursos de memoria. Asegúrese de estar en una conexión estable y no cerrar la pestaña.
                </p>
             </div>
             {canGenerate ? (
                <Button onClick={handleGenerate} disabled={isGenerating} className="w-full h-14 font-black uppercase text-lg">
                    {isGenerating ? <Loader2 className="animate-spin mr-2" /> : <Download className="mr-2" />}
                    {isGenerating ? 'Procesando datos...' : 'Generar PDF Nacional'}
                </Button>
             ) : <p className="text-center text-xs font-bold text-muted-foreground uppercase">No tiene permisos para esta acción.</p>}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
