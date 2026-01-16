
"use client";

import { useState, useEffect } from 'react';
import Header from "@/components/header";
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { type Dato, type ReportData, type ImageData } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Loader2, Download, FileArchive } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cleanFileName } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

export default function InformeGeneralPage() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollection<Dato>(datosQuery);
  
  const allReportsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'reports') : null, [firestore]);
  const { data: allReportsData, isLoading: isLoadingAllReports } = useCollection<ReportData>(allReportsQuery);
  
  const allImagesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'imagenes') : null, [firestore]);
  const { data: allImagesData, isLoading: isLoadingAllImages } = useCollection<ImageData>(allImagesQuery);
  
  const [isGeneratingGeneralReport, setIsGeneratingGeneralReport] = useState(false);
  const [logo1Base64, setLogo1Base64] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchLogo = async (path: string, setter: (data: string | null) => void) => {
        try {
            const response = await fetch(path);
            const blob = await response.blob();
            const reader = new FileReader();
            reader.onloadend = () => {
                setter(reader.result as string);
            };
            reader.readAsDataURL(blob);
        } catch (error) {
            console.error(`Error fetching logo ${path}:`, error);
        }
    };

    fetchLogo('/logo1.png', setLogo1Base64);
    fetchLogo('/logo.png', setLogoBase64);
  }, []);

  const handleGenerateGeneralReport = async () => {
    if (!datosData || !allReportsData || !allImagesData || !logo1Base64 || !logoBase64) {
      toast({
        variant: "destructive",
        title: "Datos incompletos",
        description: "Espere a que todos los datos se carguen antes de generar el informe.",
      });
      return;
    }

    setIsGeneratingGeneralReport(true);
    toast({
      title: "Generando Informe General...",
      description: "Este proceso puede tardar varios minutos. Por favor, espera.",
      duration: 15000,
    });

    try {
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' }) as jsPDFWithAutoTable;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      
      const indexData: { title: string, page: number, type: 'department' | 'district' }[] = [];

      // --- 1. Main Cover Page ---
      doc.addImage(logo1Base64, 'PNG', margin, 40, 50, 50);
      doc.addImage(logoBase64, 'PNG', pageWidth - margin - 50, 40, 50, 50);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('Informe Edilicios de los Registros Electorales', pageWidth / 2, pageHeight / 2 - 10, { align: 'center' });
      doc.setFontSize(16);
      doc.setFont('helvetica', 'normal');
      doc.text(new Date().toLocaleDateString('es-PY'), pageWidth / 2, pageHeight / 2 + 10, { align: 'center' });
      
      const departmentsMap: Map<string, string[]> = new Map();
      datosData.forEach(d => {
        if (!departmentsMap.has(d.departamento)) {
          departmentsMap.set(d.departamento, []);
        }
        const districts = departmentsMap.get(d.departamento);
        if (districts && !districts.includes(d.distrito)) {
            districts.push(d.distrito);
        }
      });
      const sortedDepartments = Array.from(departmentsMap.keys()).sort();

      const addHeader = () => {
        if (logo1Base64) doc.addImage(logo1Base64, 'PNG', margin, 5, 20, 20);
        if (logoBase64) doc.addImage(logoBase64, 'PNG', pageWidth - margin - 20, 5, 20, 20);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Tribunal Superior de Justicia Electoral', pageWidth / 2, 15, { align: 'center' });
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text('Dirección General del Registro Electoral', pageWidth / 2, 22, { align: 'center' });
      };

      // --- 2. Content Generation Loop ---
      for (const departmentName of sortedDepartments) {
        doc.addPage();
        const deptPage = doc.internal.getNumberOfPages();
        indexData.push({ title: `DEPARTAMENTO: ${departmentName.toUpperCase()}`, page: deptPage, type: 'department' });
        doc.setFontSize(32);
        doc.setFont('helvetica', 'bold');
        doc.text('DEPARTAMENTO', pageWidth / 2, pageHeight / 2 - 20, { align: 'center' });
        doc.setFontSize(24);
        doc.setFont('helvetica', 'normal');
        doc.text(departmentName.toUpperCase(), pageWidth / 2, pageHeight / 2, { align: 'center' });
        
        const districts = departmentsMap.get(departmentName)!.sort();
        for (const districtName of districts) {
            doc.addPage();
            const distPage = doc.internal.getNumberOfPages();
            indexData.push({ title: `   Distrito: ${districtName}`, page: distPage, type: 'district' });
            doc.setFontSize(32);
            doc.setFont('helvetica', 'bold');
            doc.text('DISTRITO', pageWidth / 2, pageHeight / 2 - 20, { align: 'center' });
            doc.setFontSize(24);
            doc.setFont('helvetica', 'normal');
            doc.text(districtName.toUpperCase(), pageWidth / 2, pageHeight / 2, { align: 'center' });
            
            const currentReport = allReportsData.find(r => r.departamento === departmentName && r.distrito === districtName);
            const currentImages = allImagesData.filter(i => i.departamento === departmentName && i.distrito === districtName);

            if (!currentReport && currentImages.length === 0) continue;

            doc.addPage();
            let contentY = 40;
            addHeader();

            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text(`${departmentName.toUpperCase()} - ${districtName.toUpperCase()}`, pageWidth / 2, contentY, { align: 'center' });
            contentY += 8;
            doc.setLineWidth(0.5);
            doc.line(margin, contentY, pageWidth - margin, contentY);
            contentY += 10;

            if (currentReport) {
                const reportBody = [
                  ['Estado Físico', currentReport['estado-fisico']],
                  ['Habitación Segura', currentReport['habitacion-segura']],
                  ['Lugar de Resguardo de Equipos', currentReport['lugar-resguardo']],
                  ['Descripción General de la Situación', currentReport['descripcion-situacion']],
                  ['Cantidad de Habitaciones', currentReport['cantidad-habitaciones']],
                  ['Dimensiones de Habitación Segura', currentReport['dimensiones-habitacion']],
                  ['Características de Habitación Segura', currentReport['caracteristicas-habitacion']],
                  ['Cantidad de Máquinas de Votación', currentReport['cantidad-maquinas']],
                ].filter(row => row[1]);

                if (reportBody.length > 0) {
                    autoTable(doc, {
                        startY: contentY,
                        head: [['Concepto', 'Descripción']],
                        body: reportBody,
                        theme: 'striped',
                        headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold' },
                        styles: { cellPadding: 3, fontSize: 10 },
                        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 }, 1: { cellWidth: 'auto' } },
                        didDrawPage: () => addHeader(),
                        margin: { top: 40, bottom: 20 }
                    });
                    contentY = (doc as any).lastAutoTable.finalY + 10;
                } else {
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'italic');
                    doc.text('No hay datos en el informe para este distrito.', margin, contentY);
                    contentY += 10;
                }
            } else {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'italic');
                doc.text('No se encontró informe para este distrito.', margin, contentY);
                contentY += 10;
            }

            if (currentImages.length > 0) {
                const desiredOrder = [ "FOTOGRAFIA 1", "FOTOGRAFIA 2", "FOTOGRAFIA 3", "FOTOGRAFIA 4", "FOTOGRAFIA 5", "FOTOGRAFIA 6", "FOTOGRAFIA 7", "FOTOGRAFIA 8" ];
                const sortedImages = [...currentImages].sort((a, b) => {
                    const getOrderIndex = (name: string) => {
                        const cleanedName = cleanFileName(name).toUpperCase();
                        for (let i = 0; i < desiredOrder.length; i++) {
                            if (cleanedName.startsWith(desiredOrder[i])) return i;
                        }
                        return Infinity;
                    };
                    const indexA = getOrderIndex(a.alt);
                    const indexB = getOrderIndex(b.alt);
                    if (indexA !== indexB) return indexA - indexB;
                    return cleanFileName(a.alt).localeCompare(cleanFileName(b.alt));
                });

                if (contentY > 40) { doc.addPage(); contentY = 40; addHeader(); }
                
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text('Imágenes', pageWidth / 2, contentY, { align: 'center' });
                contentY += 10;

                for (const image of sortedImages) {
                    try {
                        const img = new window.Image();
                        img.src = image.src;
                        await new Promise<void>((resolve, reject) => {
                            img.onload = () => resolve();
                            img.onerror = () => reject();
                        });

                        const imgWidth = 170;
                        const imgHeight = (img.height * imgWidth) / img.width;
                        const titleHeight = 10;

                        if (contentY + imgHeight + titleHeight > pageHeight - margin - 20) {
                            doc.addPage();
                            addHeader();
                            contentY = 40;
                        }
                        
                        doc.setFontSize(10);
                        doc.setFont('helvetica', 'bold');
                        const imageTitle = cleanFileName(image.alt).toUpperCase();
                        doc.text(imageTitle, pageWidth / 2, contentY, { align: 'center' });
                        contentY += 5;
                        doc.addImage(img, 'JPEG', (pageWidth - imgWidth) / 2, contentY, imgWidth, imgHeight);
                        contentY += imgHeight + 15;
                    } catch (error) { console.error(`Error al cargar imagen ${image.alt} para el PDF:`, error); }
                }
            }
        }
      }
      
      const tempDoc = new jsPDF() as jsPDFWithAutoTable;
      autoTable(tempDoc, { head: [['', '']], body: indexData.map(item => [item.title, item.page.toString()]) });
      const indexPageCount = tempDoc.internal.getNumberOfPages();

      indexData.forEach(item => item.page += indexPageCount);
      
      for (let i = 0; i < indexPageCount; i++) {
        doc.addPage();
        const page = doc.internal.pages.pop();
        if (page) doc.internal.pages.splice(1, 0, page);
      }

      doc.setPage(2);
      addHeader();
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Índice', pageWidth / 2, 40, { align: 'center' });
      
      autoTable(doc, {
        startY: 50,
        head: [['Contenido', 'Página']],
        body: indexData.map(item => [
            { content: item.title, styles: { fontStyle: item.type === 'department' ? 'bold' : 'normal' } },
            item.page.toString()
        ]),
        theme: 'striped',
        headStyles: { fillColor: [44, 62, 80], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 3 },
        didDrawPage: (data) => { if(data.pageNumber > 1) { addHeader(); } },
        margin: { top: 40 }
      });
      
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          if (i > 1) {
             doc.setFontSize(10);
             doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
          }
      }

      doc.save('Informe-General-Completo.pdf');

    } catch (error) {
        console.error("Error generating general PDF:", error);
        toast({
            variant: "destructive",
            title: "Error al generar Informe General",
            description: "Hubo un problema al crear el documento. Inténtelo de nuevo.",
        });
    } finally {
      setIsGeneratingGeneralReport(false);
    }
  };

  const isLoading = isLoadingDatos || isLoadingAllReports || isLoadingAllImages;
  
  if (!isClient) {
    return (
      <div className="flex min-h-screen w-full flex-col">
        <Header title="Informe General" />
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Informe General" />
      <main className="flex-1 p-4 sm:p-6 md:p-8">
        <Card className="w-full max-w-2xl mx-auto">
           <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <FileArchive className="h-6 w-6 text-primary" />
              <span>Informes Globales</span>
            </CardTitle>
            <CardDescription>
                Genera un documento PDF consolidado con todos los informes e imágenes del sistema. Este proceso puede tardar varios minutos.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <Button 
                onClick={handleGenerateGeneralReport} 
                disabled={isLoading || isGeneratingGeneralReport} 
                className="w-full"
                size="lg"
            >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isGeneratingGeneralReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                {isLoading ? 'Cargando datos...' : 'Generar Informe General'}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
