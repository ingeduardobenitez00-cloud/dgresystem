
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
import { Upload, ImageIcon, Loader2, Trash2 } from 'lucide-react';
import { type Dato, type District, type ImageData } from '@/lib/data';
import { UploadDialog } from '@/components/upload-dialog';
import { ImageViewerDialog } from '@/components/image-viewer-dialog';
import { useFirebase, useMemoFirebase, useUser } from '@/firebase';
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

type DepartmentWithDistricts = {
  id: string;
  name: string;
  districts: District[];
};

export default function PhotoGallery() {
  const { firestore } = useFirebase();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const datosQuery = useMemoFirebase(() => (firestore && user ? collection(firestore, 'datos') : null), [firestore, user]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollection<Dato>(datosQuery);

  const [departments, setDepartments] = useState<DepartmentWithDistricts[]>([]);
  const [images, setImages] = useState<Record<string, ImageData[]>>({});
  const [checkedDepartments, setCheckedDepartments] = useState<Set<string>>(new Set());
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isUploadOpen, setUploadOpen] = useState(false);
  const [activeDistrict, setActiveDistrict] = useState<{ deptName: string, distName: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  
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
    if (datosData) {
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
    }
  }, [datosData]);
  
  const getImagesForDepartment = async (department: DepartmentWithDistricts) => {
    if (!firestore || !user || checkedDepartments.has(department.id)) return;

    setCheckedDepartments(prev => new Set(prev.add(department.id)));
    
    const imageQueries = department.districts.map(dist => 
      getDocs(query(
        collection(firestore, 'imagenes'),
        where('departamento', '==', department.name),
        where('distrito', '==', dist.name)
      ))
    );

    try {
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
        const contextualError = new FirestorePermissionError({
            operation: 'list',
            path: `imagenes`,
        });
        errorEmitter.emit('permission-error', contextualError);
    }
  };


  const handleOpenUpload = (deptName: string, distName: string) => {
    setActiveDistrict({ deptName, distName });
    setUploadOpen(true);
  };

  const handleImagesUploaded = async (newImages: Omit<ImageData, 'id' | 'departamento' | 'distrito'>[]) => {
    if (!activeDistrict || !firestore) return;
    
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
    if (!firestore) return;

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


  if (isLoadingDatos || isUserLoading) {
      return (
          <div className="flex items-center justify-center h-full">
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Imágenes de los Registros Electorales
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          Explore y gestione las imágenes de los registros organizadas por ubicación.
        </p>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {departments.map((department) => {
          const districtsWithImages = department.districts.filter(
            (dist) => (images[`${department.name}-${dist.name}`] || []).length > 0
          ).length;
          
          const completionPercentage = checkedDepartments.has(department.id)
            ? (districtsWithImages / department.districts.length) * 100
            : 0;

          return (
            <AccordionItem value={department.id} key={department.id} onFocus={() => getImagesForDepartment(department)}>
              <div className='flex flex-col'>
                <div className='flex items-center w-full'>
                    <AccordionTrigger className="text-lg font-medium hover:no-underline data-[state=open]:text-primary flex-1">
                    <div className='flex flex-col items-start gap-2'>
                        <span>{department.name}</span>
                        <div className="w-full flex items-center gap-2 pr-4">
                            <Progress value={completionPercentage} className="h-2 w-full max-w-xs" />
                            <span className="text-xs font-mono text-muted-foreground">{Math.round(completionPercentage)}%</span>
                        </div>
                    </div>
                    </AccordionTrigger>
                </div>
              </div>
              <AccordionContent>
                <Accordion type="multiple" className="w-full space-y-4 px-4">
                  {department.districts.map((district) => {
                    const imagesKey = `${department.name}-${district.name}`;
                    const districtImages = images[imagesKey] || [];
                    const hasImages = districtImages.length > 0;
                    return (
                      <AccordionItem value={district.id} key={district.id}>
                          <div className="flex w-full items-center">
                              <AccordionTrigger
                                  className={cn(
                                      "flex-1 text-md font-medium border-b-0",
                                      !hasImages && checkedDepartments.has(department.id) && "text-destructive hover:text-destructive"
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
                        {images[imagesKey] ? (
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
                          <button
                            onClick={() => handleOpenUpload(department.name, district.name)}
                            className="w-full text-center py-12 border-2 border-dashed rounded-lg flex flex-col items-center justify-center hover:bg-muted/50 transition-colors"
                          >
                            <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                            <p className="text-destructive font-medium">No hay imágenes en este distrito.</p>
                            <p className="text-sm text-muted-foreground">Haz clic aquí para subir una.</p>
                          </button>
                          )
                        ) : (
                             <div className="flex justify-center items-center h-24">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
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
