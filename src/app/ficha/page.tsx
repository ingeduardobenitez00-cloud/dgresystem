
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Image from 'next/image';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type Dato, type ReportData, type ImageData } from '@/lib/data';
import { Label } from '@/components/ui/label';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where } from 'firebase/firestore';
import { ImageViewerDialog } from '@/components/image-viewer-dialog';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import { logo1 } from '@/assets/logo1';
import { logo2 } from '@/assets/logo2';
import { cleanFileName } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';


export default function FichaPage() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData } = useCollection<Dato>(datosQuery);

  const [departments, setDepartments] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  useEffect(() => {
    if (datosData) {
      const uniqueDepts = [...new Set(datosData.map(d => d.departamento))].sort();
      setDepartments(uniqueDepts);
    }
  }, [datosData]);

  const reportsQuery = useMemoFirebase(() => {
    if (!firestore || !selectedDept || !selectedDistrict) return null;
    return query(
      collection(firestore, 'reports'), 
      where('departamento', '==', selectedDept),
      where('distrito', '==', selectedDistrict)
    );
  }, [firestore, selectedDept, selectedDistrict]);

  const { data: filteredReports, isLoading: isLoadingReports } = useCollection<ReportData>(reportsQuery);

  const imagesQuery = useMemoFirebase(() => {
    if (!firestore || !selectedDept || !selectedDistrict) return null;
    return query(
        collection(firestore, 'imagenes'),
        where('departamento', '==', selectedDept),
        where('distrito', '==', selectedDistrict)
    );
  }, [firestore, selectedDept, selectedDistrict]);

  const { data: filteredImages, isLoading: isLoadingImages } = useCollection<ImageData>(imagesQuery);


  const handleDeptChange = (deptName: string) => {
    setSelectedDistrict('');
    setDistricts([]);

    if (deptName === 'all-depts') {
        setSelectedDept('');
        return;
    }

    setSelectedDept(deptName);

    if (deptName && datosData) {
        const relatedDistricts = datosData
            .filter(d => d.departamento === deptName)
            .map(d => d.distrito)
            .sort();
        setDistricts([...new Set(relatedDistricts)]);
    }
  };

  const handleDistrictChange = (distName: string) => {
    if (distName === 'all-districts') {
      setSelectedDistrict('');
    } else {
      setSelectedDistrict(distName);
    }
  };

  const currentImageIndex = useMemo(() => {
    if (!selectedImage || !filteredImages) return -1;
    return filteredImages.findIndex(img => img.id === selectedImage.id);
  }, [selectedImage, filteredImages]);

  const handleNextImage = () => {
    if (filteredImages && currentImageIndex < filteredImages.length - 1) {
      setSelectedImage(filteredImages[currentImageIndex + 1]);
    }
  };

  const handlePreviousImage = () => {
    if (filteredImages && currentImageIndex > 0) {
      setSelectedImage(filteredImages[currentImageIndex - 1]);
    }
  };
  
  const handleOpenImageViewer = (image: ImageData) => {
    setSelectedImage(image);
    setIsViewerOpen(true);
  };

  const handleGeneratePdf = async () => {
    if (!filteredReports || !selectedDept || !selectedDistrict) return;
    setIsGeneratingPdf(true);

    try {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        let currentY = 25;

        // --- HEADER ---
        const logoWidth = 30;
        const logoHeight = 15;
        pdf.addImage(logo2, 'JPEG', margin, 5, logoWidth, logoHeight);
        pdf.addImage(logo1, 'JPEG', pageWidth - margin - logoWidth, 5, logoWidth, logoHeight);

        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        pdf.text("Informe Edilicio Registro Electoral", pageWidth / 2, currentY, { align: 'center' });
        currentY += 10;

        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`${selectedDept.toUpperCase()} - ${selectedDistrict.toUpperCase()}`, pageWidth / 2, currentY, { align: 'center' });
        currentY += 15;
        
        pdf.setLineWidth(0.5);
        pdf.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 10;


        // --- REPORT DETAILS ---
        if (filteredReports.length > 0) {
            const report = filteredReports[0];
            pdf.setFontSize(12);

            const reportEntries = Object.entries(report).filter(([key]) => !['id', 'departamento', 'distrito'].includes(key));
            
            for (const [key, value] of reportEntries) {
                if (currentY > pageHeight - margin - 10) { // Add some buffer
                    pdf.addPage();
                    currentY = margin;
                }

                const label = `${key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:`;
                const valueText = String(value);

                pdf.setFont('helvetica', 'bold');
                const labelWidth = pdf.getTextWidth(label + ' ');
                pdf.text(label, margin, currentY);
                
                pdf.setFont('helvetica', 'normal');
                const textLines = pdf.splitTextToSize(valueText, pageWidth - margin * 2 - labelWidth);
                
                pdf.text(textLines, margin + labelWidth, currentY, {
                    align: 'justify',
                    maxWidth: pageWidth - margin * 2 - labelWidth
                });

                currentY += (textLines.length * 5) + 5; 
            }
        } else {
             pdf.setFontSize(12);
             pdf.setFont('helvetica', 'italic');
             pdf.text("NO REMITIÓ INFORME", margin, currentY);
             currentY += 10;
        }

        // --- IMAGE GALLERY ---
        if (filteredImages && filteredImages.length > 0) {
            pdf.addPage();
            currentY = margin;

            const addGalleryHeader = () => {
                pdf.setFontSize(16);
                pdf.setFont('helvetica', 'bold');
                pdf.text("Imagenes de las Oficinas del Registro Electoral", pageWidth / 2, currentY, { align: 'center' });
                currentY += 8;

                pdf.setFontSize(12);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`${selectedDept.toUpperCase()} - ${selectedDistrict.toUpperCase()}`, pageWidth / 2, currentY, { align: 'center' });
                currentY += 12;
            };

            addGalleryHeader();
            
            for (const image of filteredImages) {
                const img = new (window as any).Image();
                img.src = image.src;
                img.crossOrigin = 'Anonymous';
                
                await new Promise((resolve) => {
                    img.onload = () => {
                        const imgWidth = img.width;
                        const imgHeight = img.height;
                        const ratio = imgWidth / imgHeight;

                        const pdfImageWidth = pageWidth - margin * 2;
                        const pdfImageHeight = pdfImageWidth / ratio;
                        const imageName = cleanFileName(image.alt);
                        const nameHeight = 10;
                        
                        const totalElementHeight = pdfImageHeight + nameHeight;

                        if (currentY + totalElementHeight > pageHeight - margin) {
                            pdf.addPage();
                            currentY = margin;
                            addGalleryHeader();
                        }

                        pdf.setFontSize(10);
                        pdf.setFont('helvetica', 'bold');
                        pdf.text(imageName, pageWidth / 2, currentY, { align: 'center' });
                        currentY += nameHeight - 3;

                        pdf.addImage(img, 'JPEG', margin, currentY, pdfImageWidth, pdfImageHeight);
                        currentY += pdfImageHeight + 5;

                        resolve(true);
                    };
                    img.onerror = () => {
                        console.error(`Could not load image: ${image.src}`);
                        resolve(false);
                    }
                });
            }
        }

        pdf.save(`Informe-${selectedDept}-${selectedDistrict}.pdf`);
    } catch (error) {
        console.error("Error generating PDF:", error);
        toast({
          variant: "destructive",
          title: "Error al generar PDF",
          description: "Hubo un problema al crear el archivo PDF.",
        });
    } finally {
        setIsGeneratingPdf(false);
    }
  };
  
  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Vista de Ficha" />
      <main className="flex flex-1 flex-col p-4 gap-8">
        <Card className="w-full max-w-6xl mx-auto">
          <CardHeader>
            <CardTitle>Filtros de Visualización</CardTitle>
            <CardDescription>
              Selecciona un departamento y distrito para ver la información detallada.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 space-y-2">
              <Label>Departamento</Label>
              <Select onValueChange={handleDeptChange} value={selectedDept || 'all-depts'}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar Departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-depts">Todos los Departamentos</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-2">
              <Label>Distrito</Label>
              <Select
                onValueChange={handleDistrictChange}
                value={selectedDistrict || 'all-districts'}
                disabled={!selectedDept}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar Distrito" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-districts">Todos los Distritos</SelectItem>
                  {districts.map((dist) => (
                    <SelectItem key={dist} value={dist}>
                      {dist}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {selectedDept && selectedDistrict ? (
            (isLoadingReports || isLoadingImages) ? (
                 <div className="col-span-full text-center py-12 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    <p className="mt-2">Cargando datos...</p>
                </div>
            ) : (
                <div id="pdf-container" className='relative'>
                    <Button 
                        id="pdf-generate-button"
                        onClick={handleGeneratePdf} 
                        disabled={isGeneratingPdf}
                        className='absolute -top-4 right-4 z-10'
                    >
                       {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                        Generar PDF
                    </Button>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-6xl mx-auto p-4 bg-background">
                        <div>
                        {filteredReports && filteredReports.length > 0 ? (
                            filteredReports.map((report) => (
                                <Card key={report.id}>
                                    <CardHeader>
                                        <CardTitle>{report.distrito}, {report.departamento}</CardTitle>
                                        <CardDescription>Detalles del informe.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-3 text-sm">
                                    {Object.entries(report).map(([key, value]) => {
                                        if (key === 'departamento' || key === 'distrito' || key === 'id') return null;
                                        return (
                                            <div key={key}>
                                            <p className="font-semibold capitalize text-muted-foreground">{key.replace(/-/g, ' ')}:</p>
                                            <p>{String(value)}</p>
                                            </div>
                                        );
                                    })}
                                    </CardContent>
                                </Card>
                            ))
                        ) : (
                             <Card>
                                <CardContent className="p-6 text-center">
                                    <p className="text-destructive italic font-semibold">NO REMITIÓ INFORME</p>
                                </CardContent>
                            </Card>
                        )}
                        </div>
                        
                        <div>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Imágenes</CardTitle>
                                    <CardDescription>Imágenes asociadas a la ubicación seleccionada.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                {filteredImages && filteredImages.length > 0 ? (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {filteredImages.map((image) => (
                                            <Card
                                                key={image.id}
                                                className="overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
                                                onClick={() => handleOpenImageViewer(image)}
                                            >
                                                <CardContent className="p-0">
                                                    <Image
                                                        src={image.src}
                                                        alt={image.alt}
                                                        width={600}
                                                        height={400}
                                                        className="aspect-[3/2] w-full object-cover"
                                                        data-ai-hint={image.hint}
                                                        crossOrigin="anonymous"
                                                    />
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <p className="text-muted-foreground">No hay imágenes para esta ubicación.</p>
                                    </div>
                                )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            )
        ) : (
            <div className="col-span-full text-center py-12 text-muted-foreground">
                <p>Por favor, selecciona un departamento y distrito para ver la información.</p>
            </div>
        )}
      </main>
      <ImageViewerDialog
        isOpen={isViewerOpen}
        onOpenChange={setIsViewerOpen}
        image={selectedImage}
        onNext={handleNextImage}
        onPrevious={handlePreviousImage}
        canNavigateNext={filteredImages ? currentImageIndex < filteredImages.length - 1 : false}
        canNavigatePrevious={currentImageIndex > 0}
      />
    </div>
  );
}
