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
      duration: 10000,
    });

    try {
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' }) as jsPDFWithAutoTable;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      let isFirstPage = true;

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

      const addPageFooter = (data: any) => {
        const pageCount = data.doc.internal.getNumberOfPages();
        doc.setFontSize(10);
        doc.text(`Página ${data.pageNumber}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      };

      for (const departmentName of sortedDepartments) {
        const districts = departmentsMap.get(departmentName)!.sort();

        for (const districtName of districts) {
          if (isFirstPage) {
            isFirstPage = false;
          } else {
            doc.addPage();
          }
          let contentY = 40;
          addHeader();

          doc.setFontSize(16);
          doc.setFont('helvetica', 'bold');
          doc.text(`${departmentName.toUpperCase()} - ${districtName.toUpperCase()}`, pageWidth / 2, contentY, { align: 'center' });
          contentY += 8;
          doc.setLineWidth(0.5);
          doc.line(margin, contentY, pageWidth - margin, contentY);
          contentY += 10;

          const currentReport = allReportsData.find(r => r.departamento === departmentName && r.distrito === districtName);
          const currentImages = allImagesData.filter(i => i.departamento === departmentName && i.distrito === districtName);

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
                didDrawPage: (data) => {
                   addHeader();
                   addPageFooter(data);
                },
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
            const desiredOrder = [
                "FOTOGRAFIA #1 DEL FRENTE DEL REGISTRO",
                "FOTOGRAFIA #2 COSTADO DERECHO DEL REGISTRO",
                "FOTOGRAFIA #3 COSTADOS IZQUIERDO DEL REGISTRO",
                "FOTOGRAFIA #4 DEL FONDO DEL REGISTRO",
                "FOTOGRAFIA #5 HABITACION SEGURA INTERIOR",
                "FOTOGRAFIA #6 HABITACION SEGURA TECHO",
                "FOTOGRAFIA #7 TODAS LAS HABITACIONES DEL REGISTRO ELECTORAL",
                "FOTOGRAFIA #8 DEL FORMULARIO FIRMADO Y SELLADO"
            ];

            const sortedImages = [...currentImages].sort((a, b) => {
              const cleanedA = cleanFileName(a.alt).toUpperCase();
              const cleanedB = cleanFileName(b.alt).toUpperCase();
              const getOrderIndex = (name: string) => {
                  if (name.startsWith(desiredOrder[7])) return 7;
                  if (name.startsWith(desiredOrder[6])) return 6;
                  const index = desiredOrder.findIndex(orderKey => name.startsWith(orderKey));
                  return index === -1 ? Infinity : index;
              };
              const indexA = getOrderIndex(cleanedA);
              const indexB = getOrderIndex(cleanedB);
              if (indexA !== indexB) {
                  return indexA - indexB;
              }
              return cleanedA.localeCompare(cleanedB);
            });

            if (contentY + 15 > pageHeight - margin) {
              doc.addPage();
              addHeader();
              contentY = 40;
            }
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
                  addPageFooter({doc: doc, pageNumber: doc.internal.pages.length, settings: {}});
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
              } catch (error) {
                  console.error(`Error al cargar imagen ${image.alt} para el PDF:`, error);
              }
            }
          }
          addPageFooter({doc: doc, pageNumber: doc.internal.pages.length, settings: {}});
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
