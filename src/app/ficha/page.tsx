"use client";

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Header from "@/components/header";
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { collection, query, where, doc, setDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { type Dato, type ReportData, type ImageData } from '@/lib/data';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Loader2, FileText, ImageIcon, Search, Download, Edit, Upload, Trash2, ShieldAlert } from 'lucide-react';
import Image from 'next/image';
import { ImageViewerDialog } from '@/components/image-viewer-dialog';
import { useToast } from '@/hooks/use-toast';
import { cleanFileName } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ReportForm } from '@/components/report-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { UploadDialog } from '@/components/upload-dialog';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

export default function FichaPage() {
  const { firestore } = useFirebase();
  const { user: currentUser } = useUser();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollection<Dato>(datosQuery);
  
  const [departments, setDepartments] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);

  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  
  const [shouldFetch, setShouldFetch] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);

  const [logo1Base64, setLogo1Base64] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  
  const [isUploadOpen, setUploadOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  
  const isAdmin = currentUser?.profile?.role === 'admin';
  const canViewReport = isAdmin || currentUser?.profile?.permissions?.includes('view_report');
  const canViewImages = isAdmin || currentUser?.profile?.permissions?.includes('view_images');
  const canEditReport = isAdmin || currentUser?.profile?.permissions?.includes('edit');
  const canAddImages = isAdmin || currentUser?.profile?.permissions?.includes('add');
  const canDeleteImages = isAdmin || (currentUser?.profile?.permissions?.includes('add') || currentUser?.profile?.permissions?.includes('delete'));


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

  const reportQuery = useMemoFirebase(() => {
    if (!firestore || !shouldFetch || !selectedDepartment || !selectedDistrict || !canViewReport) return null;
    return query(
      collection(firestore, 'reports'),
      where('departamento', '==', selectedDepartment),
      where('distrito', '==', selectedDistrict)
    );
  }, [firestore, shouldFetch, selectedDepartment, selectedDistrict, canViewReport]);

  const imagesQuery = useMemoFirebase(() => {
    if (!firestore || !shouldFetch || !selectedDepartment || !selectedDistrict || !canViewImages) return null;
    return query(
      collection(firestore, 'imagenes'),
      where('departamento', '==', selectedDepartment),
      where('distrito', '==', selectedDistrict)
    );
  }, [firestore, shouldFetch, selectedDepartment, selectedDistrict, canViewImages]);

  const { data: reportData, isLoading: isLoadingReport, error: reportError, setData: setReportData } = useCollection<ReportData>(reportQuery);
  const { data: imagesData, isLoading: isLoadingImages, setData: setImagesData } = useCollection<ImageData>(imagesQuery);
  
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [isViewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    if (datosData) {
      const uniqueDepts = [...new Set(datosData.map(d => d.departamento))].sort();
      setDepartments(uniqueDepts);

      const deptFromUrl = searchParams.get('dept');
      const distFromUrl = searchParams.get('dist');

      if (deptFromUrl && uniqueDepts.includes(decodeURIComponent(deptFromUrl))) {
        const decodedDept = decodeURIComponent(deptFromUrl);
        
        setSelectedDepartment(decodedDept);
        
        const districtsForDept = [...new Set(datosData.filter(d => d.departamento === decodedDept).map(d => d.distrito))].sort();
        setDistricts(districtsForDept);

        const decodedDist = decodeURIComponent(distFromUrl || "");
        if(decodedDist && districtsForDept.includes(decodedDist)) {
          setSelectedDistrict(decodedDist);
          setShouldFetch(true);
        }
      }
    }
  }, [datosData, searchParams]);

  useEffect(() => {
    if (selectedDepartment && datosData) {
      const uniqueDistricts = [...new Set(datosData.filter(d => d.departamento === selectedDepartment).map(d => d.distrito))].sort();
      setDistricts(uniqueDistricts);
    } else {
      setDistricts([]);
    }
  }, [selectedDepartment, datosData]);
  
  const handleDepartmentChange = (value: string) => {
    setSelectedDepartment(value);
    setSelectedDistrict(null);
    setShouldFetch(false);
  };
  
  const handleDistrictChange = (value: string) => {
    setSelectedDistrict(value);
    setShouldFetch(false);
  };

  const handleSearch = () => {
    if(selectedDepartment && selectedDistrict) {
      setShouldFetch(true);
    }
  };
  
  const handleOpenImageViewer = (image: ImageData) => {
    setSelectedImage(image);
    setViewerOpen(true);
  };

  const isLoading = isLoadingDatos || (shouldFetch && (isLoadingReport || isLoadingImages));
  const currentReport = reportData && reportData.length > 0 ? reportData[0] : null;

  const currentImageIndex = useMemo(() => {
    if (!selectedImage || !imagesData) return -1;
    return imagesData.findIndex(img => img.id === selectedImage.id);
  }, [selectedImage, imagesData]);

  const handleNextImage = () => {
    if (imagesData && currentImageIndex < imagesData.length - 1) {
      setSelectedImage(imagesData[currentImageIndex + 1]);
    }
  };

  const handlePreviousImage = () => {
    if (imagesData && currentImageIndex > 0) {
      setSelectedImage(imagesData[currentImageIndex - 1]);
    }
  };
  
  const handleGeneratePdf = async () => {
    if ((!currentReport && (!imagesData || imagesData.length === 0)) || !selectedDepartment || !selectedDistrict || !logo1Base64 || !logoBase64) return;
    setIsGeneratingPdf(true);
    
    try {
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' }) as jsPDFWithAutoTable;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;

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
            doc.text(`Página ${data.pageNumber} de ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        };

        let contentY = 40;

        if (currentReport) {
            
            doc.setFontSize(14);
            doc.setFont('helvetica', 'normal');
            doc.text(`${selectedDepartment.toUpperCase()} - ${selectedDistrict.toUpperCase()}`, pageWidth / 2, contentY, { align: 'center' });
            contentY += 8;

            doc.setLineWidth(0.5);
            doc.line(margin, contentY, pageWidth - margin, contentY);
            contentY += 10;
        
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
        }

        if (imagesData && imagesData.length > 0) {
            if (currentReport) {
                doc.addPage();
                contentY = 40;
                addHeader(); 
            } else {
                addHeader();
            }
            
            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            doc.text(`${selectedDepartment!.toUpperCase()} - ${selectedDistrict!.toUpperCase()}`, pageWidth / 2, contentY, { align: 'center' });
            contentY += 12;

            const desiredOrder = [
              "FOTOGRAFIA 1 DEL FRENTE DEL REGISTRO",
              "FOTOGRAFIA 2 COSTADO DERECHO DEL REGISTRO",
              "FOTOGRAFIA 3 COSTADOS IZQUIERDO DEL REGISTRO",
              "FOTOGRAFIA 4 DEL FONDO DEL REGISTRO",
              "FOTOGRAFIA 5 HABITACION SEGURA INTERIOR",
              "FOTOGRAFIA 6 HABITACION SEGURA TECHO",
              "FOTOGRAFIA 7 TODAS LAS HABITACIONES DEL REGISTRO ELECTORAL",
              "FOTOGRAFIA 8 DEL FORMULARIO FIRMADO Y SELLADO"
            ];
            
            const sortedImages = [...imagesData].sort((a, b) => {
                const cleanedA = cleanFileName(a.alt).toUpperCase();
                const cleanedB = cleanFileName(b.alt).toUpperCase();

                const getOrderIndex = (name: string) => {
                    for (let i = 0; i < desiredOrder.length; i++) {
                        if (name.startsWith(desiredOrder[i])) {
                            return i;
                        }
                    }
                    return Infinity;
                };

                const indexA = getOrderIndex(cleanedA);
                const indexB = getOrderIndex(cleanedB);

                if (indexA !== indexB) {
                    return indexA - indexB;
                }
                
                return cleanedA.localeCompare(cleanedB);
            });
            
            for (const image of sortedImages) {
                try {
                    const img = new window.Image();
                    img.src = image.src;
                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                    });
                    
                    const imgWidth = 170;
                    const imgHeight = (img.height * imgWidth) / img.width;
                    const titleHeight = 10;

                    if (contentY + imgHeight + titleHeight > pageHeight - margin - 20) {
                        addPageFooter({doc: doc, pageNumber: doc.internal.pages.length, settings: {}});
                        doc.addPage();
                        contentY = 40;
                        addHeader();
                        doc.setFontSize(12);
                        doc.setFont('helvetica', 'normal');
                        doc.text(`${selectedDepartment!.toUpperCase()} - ${selectedDistrict!.toUpperCase()}`, pageWidth / 2, contentY, { align: 'center' });
                        contentY += 12;
                    }
                    
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    const imageTitle = cleanFileName(image.alt).toUpperCase();
                    doc.text(imageTitle, pageWidth / 2, contentY, { align: 'center' });
                    contentY += 5;

                    doc.addImage(img, 'JPEG', (pageWidth - imgWidth) / 2, contentY, imgWidth, imgHeight);
                    contentY += imgHeight + 15;

                } catch (error) {
                    console.error("Error loading image for PDF:", error);
                    if (contentY + 10 > pageHeight - margin - 20) {
                        addPageFooter({doc: doc, pageNumber: doc.internal.pages.length, settings: {}});
                        doc.addPage();
                        contentY = 40;
                        addHeader();
                    }
                    doc.setFontSize(10);
                    doc.setTextColor(255, 0, 0);
                    doc.text('Error al cargar imagen', pageWidth / 2, contentY, { align: 'center' });
                    doc.setTextColor(0, 0, 0);
                    contentY += 10;
                }
            }
             addPageFooter({doc: doc, pageNumber: doc.internal.pages.length, settings: {}});
        }
        
        doc.save(`Informe-${cleanFileName(selectedDepartment)}-${cleanFileName(selectedDistrict)}.pdf`);

    } catch (error) {
        console.error("Error generating PDF:", error);
        toast({
            variant: "destructive",
            title: "Error al generar PDF",
            description: "Hubo un problema al crear el documento. Inténtelo de nuevo.",
        });
    } finally {
        setIsGeneratingPdf(false);
    }
  };

  const handleSaveReport = async (data: Omit<ReportData, 'id'>) => {
    if (!firestore || !currentUser) return;
    try {
      if (currentReport) {
        // Update existing report
        const reportRef = doc(firestore, 'reports', currentReport.id);
        await setDoc(reportRef, data, { merge: true });
        toast({ title: "Informe actualizado", description: "Los cambios han sido guardados." });
      } else {
        // Create new report
        await addDoc(collection(firestore, 'reports'), data);
        toast({ title: "Informe creado", description: "El nuevo informe ha sido guardado." });
      }
      setEditModalOpen(false);
      // Manually trigger a re-fetch if needed
      setShouldFetch(false); 
      setTimeout(() => setShouldFetch(true), 50);
    } catch(e) {
      console.error(e);
      toast({ title: "Error al guardar", description: "No se pudieron guardar los cambios.", variant: "destructive" });
    }
  };

  const handleImagesUploaded = async (newImages: Omit<ImageData, 'id' | 'departamento' | 'distrito'>[]) => {
    if (!selectedDepartment || !selectedDistrict || !firestore || !currentUser) return;
    
    setUploadOpen(false);
    setUploadProgress(0);

    const imagesCollectionRef = collection(firestore, 'imagenes');
    const totalImages = newImages.length;
    let uploadedCount = 0;
    const uploadedImages: ImageData[] = [];

    for (const newImage of newImages) {
        const fullImageData = {
            ...newImage,
            departamento: selectedDepartment,
            distrito: selectedDistrict,
        };
        try {
            const docRef = await addDoc(imagesCollectionRef, fullImageData);
            if (setImagesData) {
              setImagesData(prev => [...(prev || []), { id: docRef.id, ...fullImageData }]);
            }
            uploadedImages.push({ id: docRef.id, ...fullImageData });
            uploadedCount++;
            setUploadProgress((uploadedCount / totalImages) * 100);
        } catch (error) {
            const contextualError = new FirestorePermissionError({
                operation: 'create',
                path: 'imagenes',
                requestResourceData: fullImageData
            });
            errorEmitter.emit('permission-error', contextualError);
            toast({
                title: "Error de Subida",
                description: `No se pudo subir la imagen ${newImage.alt}.`,
                variant: 'destructive',
            });
        }
    }

    if (uploadedImages.length > 0) {
      toast({
        title: 'Subida Completada',
        description: `${uploadedCount} de ${totalImages} imágenes subidas con éxito.`,
      });
    }
    
    setTimeout(() => setUploadProgress(null), 2000);
  };
  
  const handleDeleteImage = async (imageToDelete: ImageData) => {
    if (!firestore || !currentUser) return;

    try {
        await deleteDoc(doc(firestore, 'imagenes', imageToDelete.id));
        if (setImagesData) {
          setImagesData(prev => (prev || []).filter(img => img.id !== imageToDelete.id));
        }
        
        toast({
            title: "Imagen eliminada",
            description: "La imagen ha sido eliminada con éxito.",
            variant: "destructive",
        });
    } catch (error) {
        const contextualError = new FirestorePermissionError({
            operation: 'delete',
            path: `imagenes/${imageToDelete.id}`,
        });
        errorEmitter.emit('permission-error', contextualError);
        toast({
            title: "Error al eliminar",
            description: "No se pudo eliminar la imagen.",
            variant: "destructive",
        });
    }
  };

  if (!isClient) {
    return (
      <div className="flex min-h-screen w-full flex-col">
        <Header title="Vista de Ficha" />
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
       {uploadProgress !== null && (
          <div className="fixed top-14 left-0 right-0 z-50 p-4 bg-background/80 backdrop-blur-sm">
             <div className="max-w-4xl mx-auto space-y-2">
                <p className="text-sm font-medium text-center">Subiendo imágenes... {Math.round(uploadProgress)}%</p>
                <Progress value={uploadProgress} className="w-full" />
             </div>
          </div>
        )}
      <Header title="Vista de Ficha" />
      <main className="flex flex-1 flex-col p-4 md:p-6 lg:p-8 gap-8">
        <Card className="w-full max-w-6xl mx-auto">
          <CardHeader>
            <CardTitle>Filtro de Búsqueda</CardTitle>
            <CardDescription>Selecciona un departamento y distrito para ver los detalles.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <label className="text-sm font-medium">Departamento</label>
                <Select onValueChange={handleDepartmentChange} value={selectedDepartment || ''} disabled={isLoadingDatos}>
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingDatos ? 'Cargando...' : 'Selecciona un departamento'} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Distrito</label>
                <Select onValueChange={handleDistrictChange} value={selectedDistrict || ''} disabled={!selectedDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder={!selectedDepartment ? 'Primero selecciona un dpto.' : 'Selecciona un distrito'} />
                  </SelectTrigger>
                  <SelectContent>
                    {districts.map(dist => <SelectItem key={dist} value={dist}>{dist}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSearch} disabled={!selectedDepartment || !selectedDistrict || isLoading} className="w-full md:w-auto">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Buscar
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {isLoading && (
            <div className="flex justify-center items-center py-10">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        )}

        {shouldFetch && !isLoading && (
          <>
            {(!canViewImages && !canViewReport) ? (
              <Card className="w-full max-w-6xl mx-auto text-center">
                <CardHeader>
                  <CardTitle className="flex items-center justify-center gap-3">
                    <ShieldAlert className="h-6 w-6 text-destructive" />
                    <span>Acceso Restringido</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-10">
                  <p className="text-muted-foreground">No tienes permisos para ver el informe o las imágenes de esta ficha.</p>
                  <p className="text-sm text-muted-foreground mt-2">Por favor, contacta a un administrador para solicitar acceso.</p>
                </CardContent>
              </Card>
            ) : (
              (reportError || (!currentReport && !canViewReport) && (!imagesData || imagesData.length === 0)) ? (
                <Card className="w-full max-w-6xl mx-auto">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3">
                        <FileText className="h-6 w-6 text-primary" />
                        <span>Informe del Distrito</span>
                      </CardTitle>
                      <CardDescription>{selectedDepartment} - {selectedDistrict}</CardDescription>
                  </CardHeader>
                  <CardContent className="py-10 text-center">
                      <p className="text-muted-foreground mb-4">No se encontraron datos para la ubicación seleccionada.</p>
                      {canEditReport && (
                        <Button onClick={() => setEditModalOpen(true)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Crear Informe
                        </Button>
                      )}
                  </CardContent>
                </Card>
              ) : (
              <div className="w-full max-w-6xl mx-auto space-y-8">
                  {canViewReport && (
                    <Card>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="flex items-center gap-3">
                              <FileText className="h-6 w-6 text-primary" />
                              <span>Informe del Distrito</span>
                            </CardTitle>
                            <CardDescription>{selectedDepartment} - {selectedDistrict}</CardDescription>
                          </div>
                          <div className="flex flex-col gap-2">
                             {canEditReport && (
                               <Button onClick={() => setEditModalOpen(true)} variant="outline" size="sm">
                                  <Edit className="mr-2 h-4 w-4" />
                                  Editar Informe
                               </Button>
                             )}
                             <Button onClick={handleGeneratePdf} disabled={isGeneratingPdf || (!currentReport && (!imagesData || imagesData.length === 0))} size="sm">
                                {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                Generar PDF
                             </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                         <ReportForm key={currentReport?.id} initialData={currentReport} readOnly={true} />
                      </CardContent>
                    </Card>
                  )}
                  
                  {canViewImages && imagesData && (
                    <Card>
                      <CardHeader>
                      <div className="flex justify-between items-start">
                          <div>
                              <CardTitle className="flex items-center gap-3">
                              <ImageIcon className="h-6 w-6 text-primary" />
                              <span>Imágenes</span>
                              </CardTitle>
                              <CardDescription>Imágenes asociadas a {selectedDistrict}</CardDescription>
                          </div>
                          {canAddImages && (
                            <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
                                <Upload className="mr-2 h-4 w-4" />
                                Subir Fotos
                            </Button>
                          )}
                      </div>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {imagesData.map(image => (
                        <Card key={image.id} className="overflow-hidden group/image-card">
                          <div className="relative aspect-video">
                            <Image src={image.src} alt={image.alt} fill className="object-cover transition-transform group-hover/image-card:scale-105" data-ai-hint={image.hint} onClick={() => handleOpenImageViewer(image)} />
                              {canDeleteImages && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover/image-card:opacity-100 transition-opacity"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>¿Estás seguro de que quieres eliminar esta imagen?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esta acción no se puede deshacer. La imagen se eliminará permanentemente.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteImage(image)} className="bg-destructive hover:bg-destructive/90">
                                                Eliminar
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                              )}
                          </div>
                        </Card>
                      ))}
                        {imagesData.length === 0 && (
                            <div className="col-span-full text-center py-12 border-2 border-dashed rounded-lg">
                              <p className="text-muted-foreground">No hay imágenes para este distrito.</p>
                            </div>
                        )}
                    </CardContent>
                    </Card>
                  )}
              </div>
              )
            )}
          </>
        )}
      </main>
      <Dialog open={isEditModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>
                    {currentReport ? 'Editar' : 'Crear'} Informe
                </DialogTitle>
                <DialogDescription>
                    {currentReport ? 'Modifica los detalles del informe para' : 'Crea un nuevo informe para'} {selectedDepartment} - {selectedDistrict}.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
               <ReportForm
                  key={currentReport?.id || 'new-edit'}
                  initialData={currentReport}
                  onSubmit={handleSaveReport}
                  departamento={selectedDepartment!}
                  distrito={selectedDistrict!}
               >
                 <DialogFooter className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-2">
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">Cancelar</Button>
                    </DialogClose>
                    <Button type="submit">Guardar Cambios</Button>
                </DialogFooter>
               </ReportForm>
            </div>
        </DialogContent>
      </Dialog>
       <ImageViewerDialog 
        isOpen={isViewerOpen} 
        onOpenChange={setViewerOpen} 
        image={selectedImage}
        onNext={handleNextImage}
        onPrevious={handlePreviousImage}
        canNavigateNext={imagesData ? currentImageIndex < imagesData.length - 1 : false}
        canNavigatePrevious={currentImageIndex > 0}
      />
      <UploadDialog
        isOpen={isUploadOpen}
        onOpenChange={setUploadOpen}
        onImagesUploaded={handleImagesUploaded}
      />
    </div>
  );
}
