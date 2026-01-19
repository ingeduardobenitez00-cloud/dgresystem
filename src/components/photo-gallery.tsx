'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, ImageIcon, Loader2, Trash2, AlertCircle, Download } from 'lucide-react';
import { type Dato, type District, type ImageData } from '@/lib/data';
import { UploadDialog } from '@/components/upload-dialog';
import { ImageViewerDialog } from '@/components/image-viewer-dialog';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, doc, getDocs, query, where, deleteDoc, addDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
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
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}


type DepartmentWithDistricts = {
  id: string;
  name: string;
  districts: District[];
};

export default function PhotoGallery() {
  const { firestore, user, isUserLoading } = useFirebase();
  const { toast } = useToast();

  const datosQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'datos') : null), [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollection<Dato>(datosQuery);

  const [departments, setDepartments] = useState<DepartmentWithDistricts[]>([]);
  const [images, setImages] = useState<Record<string, ImageData[]>>({});
  const [loadingDepartments, setLoadingDepartments] = useState<Set<string>>(new Set());
  const [errorDepartments, setErrorDepartments] = useState<Set<string>>(new Set());
  
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isUploadOpen, setUploadOpen] = useState(false);
  const [activeDistrict, setActiveDistrict] = useState<{ deptName: string, distName: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [logo1Base64, setLogo1Base64] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

   useEffect(() => {
    const fetchLogo = async (path: string, setter: (data: string | null) => void) => {
        try {
            const response = await fetch(path);
            const blob = await response.blob();
            const reader = new FileReader();
            reader.onloadend = () => setter(reader.result as string);
            reader.readAsDataURL(blob);
        } catch (error) {
            console.error(`Error fetching logo ${path}:`, error);
        }
    };
    fetchLogo('/logo1.png', setLogo1Base64);
    fetchLogo('/logo.png', setLogoBase64);
  }, []);

  const currentImageList = useMemo(() => {
    if (!selectedImage) return [];
    const key = `${selectedImage.departamento}-${selectedImage.distrito}`;
    return images[key] || [];
  }, [selectedImage, images]);
  
  const currentImageIndex = useMemo(() => {
    if (!selectedImage) return -1;
    return currentImageList.findIndex(img => img.id === selectedImage.id);
  }, [selectedImage, currentImageList]);


  useEffect(() => {
    if (isUserLoading) return; // Wait for user to be loaded

    // If the user is a 'funcionario' with an assigned location, only show that location.
    if (user?.profile?.role === 'funcionario' && user.profile.departamento && user.profile.distrito) {
      const { departamento, distrito } = user.profile;
      
      const funcionarioDept: DepartmentWithDistricts = {
        id: departamento,
        name: departamento,
        districts: [{
          id: distrito,
          name: distrito,
          departmentId: departamento,
        }],
      };
      setDepartments([funcionarioDept]);

    } else if (datosData) {
      // For admins or other roles with full data access
      const depts: Record<string, Set<string>> = {};
      datosData.forEach(d => {
        if (!depts[d.departamento]) {
          depts[d.departamento] = new Set();
        }
        depts[d.departamento].add(d.distrito);
      });

      const deptsArray: DepartmentWithDistricts[] = Object.keys(depts).sort().map(deptName => ({
        id: deptName,
        name: deptName,
        districts: Array.from(depts[deptName]).sort().map(distName => ({
          id: distName,
          name: distName,
          departmentId: deptName,
        })),
      }));
      setDepartments(deptsArray);
    } else {
        // If no data (e.g. non-admin, non-funcionario), show an empty list.
        setDepartments([]);
    }
  }, [datosData, user, isUserLoading]);
  
  const getImagesForDepartment = async (department: DepartmentWithDistricts) => {
    if (!firestore || !user || loadingDepartments.has(department.id) || images[Object.keys(images).find(k => k.startsWith(department.name))!] !== undefined) return;

    setLoadingDepartments(prev => new Set(prev).add(department.id));
    setErrorDepartments(prev => {
        const newSet = new Set(prev);
        newSet.delete(department.id);
        return newSet;
    });
    
    try {
        const imageQueries = department.districts.map(dist => 
          getDocs(query(
            collection(firestore, 'imagenes'),
            where('departamento', '==', department.name),
            where('distrito', '==', dist.name)
          ))
        );
        const querySnapshots = await Promise.all(imageQueries);
        const newImagesState: Record<string, ImageData[]> = {};
        
        querySnapshots.forEach((snapshot, index) => {
            const district = department.districts[index];
            const imagesKey = `${department.name}-${district.name}`;
            const fetchedImages: ImageData[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ImageData));
            newImagesState[imagesKey] = fetchedImages;
        });

        setImages(prev => ({ ...prev, ...newImagesState }));

    } catch (error) {
        setErrorDepartments(prev => new Set(prev).add(department.id));
        const contextualError = new FirestorePermissionError({
            operation: 'list',
            path: `imagenes where departamento == ${department.name}`,
        });
        errorEmitter.emit('permission-error', contextualError);
    } finally {
        setLoadingDepartments(prev => {
            const newSet = new Set(prev);
            newSet.delete(department.id);
            return newSet;
        });
    }
  };


  const handleOpenUpload = (deptName: string, distName: string) => {
    setActiveDistrict({ deptName, distName });
    setUploadOpen(true);
  };

  const handleImagesUploaded = async (newImages: Omit<ImageData, 'id' | 'departamento' | 'distrito'>[]) => {
    if (!activeDistrict || !firestore || !user) return;
    
    setUploadOpen(false); // Close dialog immediately
    setUploadProgress(0);

    const { deptName, distName } = activeDistrict;
    const imagesCollectionRef = collection(firestore, 'imagenes');
    const totalImages = newImages.length;
    let uploadedCount = 0;

    const uploadedImages: ImageData[] = [];

    for (const newImage of newImages) {
        const fullImageData = {
            ...newImage,
            departamento: deptName,
            distrito: distName,
        };
        try {
            const docRef = await addDoc(imagesCollectionRef, fullImageData);
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
        const imagesKey = `${deptName}-${distName}`;
        setImages(prev => ({
            ...prev,
            [imagesKey]: [...(prev[imagesKey] || []), ...uploadedImages]
        }));
    }
    
    toast({
      title: 'Subida Completada',
      description: `${uploadedCount} de ${totalImages} imágenes subidas con éxito.`,
    });

    // Hide progress bar after a short delay
    setTimeout(() => {
      setUploadProgress(null);
      setActiveDistrict(null);
    }, 2000);
  };

  const handleDeleteImage = async (imageToDelete: ImageData) => {
    if (!firestore || !user) return;

    try {
        await deleteDoc(doc(firestore, 'imagenes', imageToDelete.id));
        
        const imagesKey = `${imageToDelete.departamento}-${imageToDelete.distrito}`;
        setImages(prev => ({
            ...prev,
            [imagesKey]: (prev[imagesKey] || []).filter(img => img.id !== imageToDelete.id)
        }));
        
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
  
  const handleOpenImageViewer = (image: ImageData) => {
    setSelectedImage(image);
    setIsViewerOpen(true);
  };

  const handleNextImage = () => {
    if (currentImageIndex < currentImageList.length - 1) {
        setSelectedImage(currentImageList[currentImageIndex + 1]);
    }
  };

  const handlePreviousImage = () => {
      if (currentImageIndex > 0) {
          setSelectedImage(currentImageList[currentImageIndex - 1]);
      }
  };
  
  const calculateCompletionPercentage = (department: DepartmentWithDistricts): number | null => {
    const isDepartmentDataLoaded = department.districts.some(dist => images[`${department.name}-${dist.name}`] !== undefined);
    if (!isDepartmentDataLoaded) {
      return null;
    }

    const totalDistricts = department.districts.length;
    if (totalDistricts === 0) {
      return 100;
    }

    const districtsWithImages = department.districts.reduce((count, district) => {
      const imagesKey = `${department.name}-${district.name}`;
      if (images[imagesKey] && images[imagesKey].length > 0) {
        return count + 1;
      }
      return count;
    }, 0);

    return Math.floor((districtsWithImages / totalDistricts) * 100);
  };

  const handleGenerateMissingImagesPdf = async () => {
    if (!departments.length || !logo1Base64 || !logoBase64) return;
    setIsGeneratingPdf(true);
    toast({ title: "Generando reporte...", description: "Cargando todos los datos, esto puede tardar un momento." });

    // Ensure all department data is loaded
    await Promise.all(departments.map(dept => getImagesForDepartment(dept)));

    const districtsWithoutImages: { department: string, district: string }[] = [];
    
    departments.forEach(department => {
        department.districts.forEach(district => {
            const imagesKey = `${department.name}-${district.name}`;
            if (!images[imagesKey] || images[imagesKey].length === 0) {
                districtsWithoutImages.push({ department: department.name, district: district.name });
            }
        });
    });


    if (districtsWithoutImages.length === 0) {
        toast({ title: "¡Todo completo!", description: "No se encontraron distritos sin imágenes." });
        setIsGeneratingPdf(false);
        return;
    }
    
    try {
      const doc = new jsPDF() as jsPDFWithAutoTable;
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
          doc.text('Reporte de Distritos Sin Imágenes', pageWidth / 2, 22, { align: 'center' });
      };

      const addFooter = (data: any) => {
          doc.setFontSize(10);
          doc.text(`Página ${data.pageNumber}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      };

      const groupedByDept: { [key: string]: string[] } = districtsWithoutImages.reduce((acc, { department, district }) => {
          if (!acc[department]) {
              acc[department] = [];
          }
          acc[department].push(district);
          return acc;
      }, {} as { [key: string]: string[] });
      
      let finalBody: any[] = [];
      Object.keys(groupedByDept).sort().forEach(department => {
        finalBody.push([{ content: `Departamento: ${department}`, colSpan: 1, styles: { fontStyle: 'bold', halign: 'left', fillColor: [230, 230, 230] } }]);
        groupedByDept[department].forEach(district => {
          finalBody.push([district]);
        });
      });

      autoTable(doc, {
          head: [['Distrito']],
          body: finalBody,
          startY: 35,
          theme: 'grid',
          headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
          didDrawPage: (data) => {
              addHeader();
              addFooter(data);
          },
          margin: { top: 35, bottom: 20 }
      });

      doc.save('Reporte-Distritos-Sin-Imagenes.pdf');
    } catch(e) {
        console.error("PDF Generation failed", e);
        toast({variant: 'destructive', title: 'Error', description: 'No se pudo generar el PDF.'});
    } finally {
        setIsGeneratingPdf(false);
    }
  };


  if (isLoadingDatos || isUserLoading) {
      return (
          <div className="flex items-center justify-center h-full flex-1">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
      );
  }

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
       {uploadProgress !== null && (
          <div className="fixed top-14 left-0 right-0 z-50 p-4 bg-background/80 backdrop-blur-sm">
             <div className="max-w-4xl mx-auto space-y-2">
                <p className="text-sm font-medium text-center">Subiendo imágenes... {Math.round(uploadProgress)}%</p>
                <Progress value={uploadProgress} className="w-full" />
             </div>
          </div>
        )}
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Imágenes de los Registros Electorales
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Explore y gestione las imágenes de los registros organizadas por ubicación.
          </p>
        </div>
        {user?.profile?.role === 'admin' && (
          <Button onClick={handleGenerateMissingImagesPdf} disabled={isGeneratingPdf}>
            {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Generar Reporte Sin Imágenes
          </Button>
        )}
      </div>

      <Accordion type="single" collapsible className="w-full" onValueChange={(value) => {
          const department = departments.find(d => d.id === value);
          if (department) {
              getImagesForDepartment(department);
          }
      }}>
        {departments.map((department) => {
          const completionPercentage = calculateCompletionPercentage(department);
          return (
            <AccordionItem value={department.id} key={department.id}>
                <AccordionTrigger className="text-lg font-medium hover:no-underline data-[state=open]:text-primary flex-1">
                    <div className="flex items-center gap-4">
                      <span>{department.name}</span>
                      {completionPercentage !== null && user?.profile?.role === 'admin' && (
                        <Badge variant={completionPercentage === 100 ? 'default' : 'secondary'} className="text-sm">
                          {completionPercentage}%
                        </Badge>
                      )}
                    </div>
                </AccordionTrigger>
              <AccordionContent>
                {loadingDepartments.has(department.id) && (
                    <div className="flex justify-center items-center h-48">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                )}
                {errorDepartments.has(department.id) && (
                    <Alert variant="destructive" className="m-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error de Permisos</AlertTitle>
                        <AlertDescription>
                            No se pudieron cargar las imágenes para este departamento. Revisa tus permisos de Firestore.
                        </AlertDescription>
                    </Alert>
                )}
                {!loadingDepartments.has(department.id) && !errorDepartments.has(department.id) &&(
                    <Accordion type="multiple" className="w-full space-y-4 px-4">
                    {department.districts.map((district) => {
                        const imagesKey = `${department.name}-${district.name}`;
                        const isLoaded = images[imagesKey] !== undefined;
                        const districtImages = isLoaded ? images[imagesKey] : [];
                        const hasImages = districtImages.length > 0;

                        return (
                        <AccordionItem value={district.id} key={district.id}>
                            <div className="flex w-full items-center">
                                <AccordionTrigger
                                    className={cn(
                                        "flex-1 text-md font-medium border-b-0",
                                        !hasImages && isLoaded && "text-destructive hover:text-destructive"
                                    )}
                                >
                                    {district.name}
                                </AccordionTrigger>
                                <Button variant="outline" size="sm" onClick={() => handleOpenUpload(department.name, district.name)} className="ml-4 shrink-0">
                                    <Upload className="mr-2 h-4 w-4" />
                                    Subir Foto
                                </Button>
                            </div>
                            <AccordionContent className="pt-4">
                            {isLoaded ? (
                            hasImages ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {districtImages.map((image) => (
                                <Card
                                    key={image.id}
                                    className="group/image-card overflow-hidden transition-all hover:shadow-lg"
                                >
                                    <CardContent className="p-0 relative">
                                        <div className='cursor-pointer' onClick={() => handleOpenImageViewer(image)}>
                                            <Image
                                                src={image.src}
                                                alt={image.alt}
                                                width={600}
                                                height={400}
                                                className="aspect-[3/2] w-full object-cover transition-transform group-hover/image-card:scale-[1.02]"
                                                data-ai-hint={image.hint}
                                            />
                                        </div>
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
                                    </CardContent>
                                </Card>
                                ))}
                            </div>
                            ) : (
                              <div className="w-full text-center py-12 border-2 border-dashed rounded-lg flex flex-col items-center justify-center">
                                  <ImageIcon className="h-8 w-8 text-muted-foreground mb-4" />
                                  <p className="text-lg font-semibold text-foreground">No hay imágenes</p>
                                  <p className="text-sm text-muted-foreground mt-1 mb-4">Añade las fotos para este distrito.</p>
                                  <Button onClick={() => handleOpenUpload(department.name, district.name)}>
                                      <Upload className="mr-2 h-4 w-4" />
                                      Añadir Imágenes
                                  </Button>
                              </div>
                            )
                            ) : (
                                <div className="flex justify-center items-center h-24">
                                    <p className="text-sm text-muted-foreground">Expande una sección para cargar imágenes.</p>
                                </div>
                            )}
                            </AccordionContent>
                        </AccordionItem>
                        );
                    })}
                    </Accordion>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <UploadDialog
        isOpen={isUploadOpen}
        onOpenChange={setUploadOpen}
        onImagesUploaded={handleImagesUploaded}
      />

      <ImageViewerDialog
        isOpen={isViewerOpen}
        onOpenChange={setIsViewerOpen}
        image={selectedImage}
        onNext={handleNextImage}
        onPrevious={handlePreviousImage}
        canNavigateNext={currentImageIndex < currentImageList.length - 1}
        canNavigatePrevious={currentImageIndex > 0}
      />
    </div>
  );
}
