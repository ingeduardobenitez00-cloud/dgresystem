
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
import { Loader2, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams, useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function FichaPage() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData } = useCollection<Dato>(datosQuery);

  const [departments, setDepartments] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const pdfContainerRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (datosData) {
      const uniqueDepts = [...new Set(datosData.map(d => d.departamento))].sort();
      setDepartments(uniqueDepts);
    }
  }, [datosData]);
  
  useEffect(() => {
    if (datosData) {
        const deptFromUrl = searchParams.get('dept');
        const distFromUrl = searchParams.get('dist');
        
        if (deptFromUrl) {
          const decodedDept = decodeURIComponent(deptFromUrl);
          const deptExists = departments.some(d => d === decodedDept);
          if(deptExists) {
            setSelectedDept(decodedDept);
            const relatedDistricts = datosData
                .filter(d => d.departamento === decodedDept)
                .map(d => d.distrito)
                .sort();
            setDistricts([...new Set(relatedDistricts)]);

             if (distFromUrl) {
                const decodedDist = decodeURIComponent(distFromUrl);
                const distExists = relatedDistricts.some(d => d === decodedDist);
                if (distExists) {
                    setSelectedDistrict(decodedDist);
                }
             }
          }
        }
    }
  }, [searchParams, datosData, departments]);

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
    router.push('/ficha'); 

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
     router.push('/ficha'); 
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
    if (!pdfContainerRef.current) return;
    setIsGeneratingPdf(true);

    try {
        const canvas = await html2canvas(pdfContainerRef.current, {
            scale: 2,
            useCORS: true,
            onclone: (document) => {
              // This is a workaround for html2canvas not capturing images with crossOrigin="anonymous" correctly
              const images = document.getElementsByTagName('img');
              for (let i = 0; i < images.length; i++) {
                images[i].crossOrigin = '';
              }
            }
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const ratio = canvasWidth / canvasHeight;
        const width = pdfWidth - 20; // with margin
        const height = width / ratio;

        let position = 10;
        
        pdf.text(`Ficha de ${selectedDistrict}, ${selectedDept}`, 10, position);
        position += 10;

        pdf.addImage(imgData, 'PNG', 10, position, width, height > pdfHeight - position - 10 ? pdfHeight - position - 10 : height);

        pdf.save(`ficha-${selectedDistrict}-${selectedDept}.pdf`);
    } catch (error) {
        console.error("Error generating PDF:", error);
        toast({
            variant: "destructive",
            title: "Error al generar PDF",
            description: "Ocurrió un problema al intentar crear el archivo PDF.",
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
          <CardHeader className="flex-row items-center justify-between">
            <div>
                <CardTitle>Filtros de Visualización</CardTitle>
                <CardDescription>
                Selecciona un departamento y distrito para ver la información detallada.
                </CardDescription>
            </div>
             {selectedDept && selectedDistrict && (
                <Button onClick={handleGeneratePdf} disabled={isGeneratingPdf}>
                    {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileDown className="h-4 w-4 mr-2" />}
                    Generar PDF
                </Button>
            )}
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 space-y-2">
              <Label>Departamento</Label>
              <Select onValueChange={handleDeptChange} value={selectedDept || ''}>
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
                value={selectedDistrict || ''}
                disabled={!selectedDept}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar Distrito" />
                </Trigger>
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
                <div id="pdf-container" ref={pdfContainerRef} className='relative bg-background'>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-6xl mx-auto p-4 bg-inherit">
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
