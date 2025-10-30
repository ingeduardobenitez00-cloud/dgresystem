
'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { cleanFileName } from '@/lib/utils';


export default function FichaPage() {
  const { firestore } = useFirebase();
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
    if (!selectedDept || !selectedDistrict) return;
    setIsGeneratingPdf(true);

    try {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        let y = margin;

        // Header
        pdf.setFontSize(22);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Informe Edilicio Registro Electoral', pageWidth / 2, y, { align: 'center' });
        y += 10;

        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`${selectedDept} - ${selectedDistrict}`, pageWidth / 2, y, { align: 'center' });
        y += 15;
        
        pdf.setLineWidth(0.5);
        pdf.line(margin, y - 5, pageWidth - margin, y - 5);


        // Report Details
        if (filteredReports && filteredReports.length > 0) {
            const report = filteredReports[0];
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Detalles del Informe', margin, y);
            y += 8;

            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'normal');

            const reportFields = Object.entries(report).filter(([key]) => !['id', 'departamento', 'distrito'].includes(key));
            
            for (const [key, value] of reportFields) {
                if (y > pageHeight - margin) {
                    pdf.addPage();
                    y = margin;
                }

                const label = key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                pdf.setFont('helvetica', 'bold');
                
                // Calculate space for label
                const labelWidth = pdf.getStringUnitWidth(label + ':') * pdf.getFontSize() / pdf.internal.scaleFactor;
                pdf.text(`${label}:`, margin, y);
                pdf.setFont('helvetica', 'normal');
                
                const valueX = margin + labelWidth + 2;
                const valueMaxWidth = pageWidth - margin - valueX;
                const textLines = pdf.splitTextToSize(String(value) || 'N/A', valueMaxWidth);

                pdf.text(textLines, valueX, y, { align: 'justify', maxWidth: valueMaxWidth });
                
                const textHeight = pdf.getTextDimensions(textLines).h;
                y += textHeight + 2; 
            }
        } else {
            pdf.setFontSize(12);
            pdf.setTextColor(255, 0, 0);
            pdf.setFont('helvetica', 'italic');
            pdf.text('NO REMITIÓ INFORME', margin, y);
            y += 10;
        }

        // Images section
        if (filteredImages && filteredImages.length > 0) {
            if (y > pageHeight - margin - 20) {
              pdf.addPage();
              y = margin;
            } else {
              y += 10;
            }

            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(0, 0, 0);
            pdf.text('Galería de Imágenes', margin, y);
            y += 10;

            const imgWidth = pageWidth - margin * 2;
            const imgHeight = imgWidth * (9 / 16); 
            const imageNameHeight = 10;
            
            for (let i = 0; i < filteredImages.length; i++) {
                const requiredSpace = imgHeight + imageNameHeight + 5; // Added some buffer
                if (y + requiredSpace > pageHeight - margin) {
                    pdf.addPage();
                    y = margin;
                }

                const image = filteredImages[i];
                try {
                    // Check if image src is valid data URL
                    if (image.src && image.src.startsWith('data:image')) {
                       pdf.addImage(image.src, 'PNG', margin, y, imgWidth, imgHeight);
                    } else {
                       throw new Error("Invalid image source");
                    }
                } catch (e) {
                    console.error("Error adding image to PDF:", e);
                    pdf.setFontSize(8);
                    pdf.text("Error al cargar imagen", margin + imgWidth / 2, y + imgHeight / 2, { align: 'center' });
                }
                
                y += imgHeight + 5;

                const imageName = cleanFileName(image.alt);
                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'italic');
                pdf.text(imageName, pageWidth / 2, y, { align: 'center' });
                
                y += imageNameHeight;
            }
        }

        pdf.save(`Ficha-${selectedDept}-${selectedDistrict}.pdf`);
    } catch (error) {
        console.error("Error generating PDF:", error);
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
                    <p>Cargando datos...</p>
                </div>
            ) : (
                <div id="pdf-content" className='relative'>
                    <Button 
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

    

    

    
