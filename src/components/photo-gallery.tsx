
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
import { Upload, ImageIcon } from 'lucide-react';
import { type Dato, type Department, type District, type ImageData } from '@/lib/data';
import { UploadDialog } from '@/components/upload-dialog';
import { ImageViewerDialog } from '@/components/image-viewer-dialog';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, doc, getDocs, addDoc, query, where } from 'firebase/firestore';

type DepartmentWithDistricts = {
  id: string;
  name: string;
  districts: District[];
};

export default function PhotoGallery() {
  const { firestore } = useFirebase();

  const datosQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'datos') : null), [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollection<Dato>(datosQuery);

  const [departments, setDepartments] = useState<DepartmentWithDistricts[]>([]);
  const [images, setImages] = useState<Record<string, ImageData[]>>({});
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [isUploadOpen, setUploadOpen] = useState(false);
  const [activeDistrict, setActiveDistrict] = useState<{ deptName: string, distName: string } | null>(null);

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
        })),
      }));
      setDepartments(deptsArray);
    }
  }, [datosData]);
  
  const getImagesForDistrict = async (deptName: string, distName: string) => {
    if (!firestore) return;
    const imagesKey = `${deptName}-${distName}`;
    if (images[imagesKey]) return; // Already fetched

    const q = query(
      collection(firestore, 'imagenes'),
      where('departamento', '==', deptName),
      where('distrito', '==', distName)
    );

    const querySnapshot = await getDocs(q);
    const fetchedImages: ImageData[] = [];
    querySnapshot.forEach((doc) => {
        fetchedImages.push({ id: doc.id, ...doc.data() } as ImageData);
    });

    setImages(prev => ({ ...prev, [imagesKey]: fetchedImages }));
  };

  const handleOpenUpload = (deptName: string, distName: string) => {
    setActiveDistrict({ deptName, distName });
    setUploadOpen(true);
  };

  const handleImagesUploaded = async (newImages: Omit<ImageData, 'id'>[]) => {
    if (!activeDistrict || !firestore) return;

    const { deptName, distName } = activeDistrict;
    const imagesCollectionRef = collection(firestore, 'imagenes');
    
    const addedImages: ImageData[] = [];

    for (const newImage of newImages) {
        const fullImageData = {
            ...newImage,
            departamento: deptName,
            distrito: distName,
        };
        const docRef = await addDoc(imagesCollectionRef, fullImageData);
        addedImages.push({ id: docRef.id, ...fullImageData });
    }

    const imagesKey = `${deptName}-${distName}`;
    setImages(prev => ({
        ...prev,
        [imagesKey]: [...(prev[imagesKey] || []), ...addedImages]
    }));

    setUploadOpen(false);
  };

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Galería de Fotos
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          Explore y gestione las imágenes de los registros organizadas por ubicación.
        </p>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {departments.map((department) => (
          <AccordionItem value={department.id} key={department.id}>
            <AccordionTrigger className="text-lg font-medium hover:no-underline data-[state=open]:text-primary">
              {department.name}
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-6 pl-4">
                {department.districts.map((district) => {
                  const imagesKey = `${department.name}-${district.name}`;
                  const districtImages = images[imagesKey] || [];
                  return (
                    <div key={district.id} onMouseOver={() => getImagesForDistrict(department.name, district.name)}>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-md font-medium text-foreground/90">{district.name}</h3>
                        <Button variant="outline" size="sm" onClick={() => handleOpenUpload(department.name, district.name)}>
                          <Upload className="mr-2 h-4 w-4" />
                          Subir Foto
                        </Button>
                      </div>
                      {districtImages.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                          {districtImages.map((image) => (
                            <Card
                              key={image.id}
                              className="overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
                              onClick={() => setSelectedImage(image)}
                            >
                              <CardContent className="p-0">
                                <Image
                                  src={image.src}
                                  alt={image.alt}
                                  width={600}
                                  height={400}
                                  className="aspect-[3/2] w-full object-cover"
                                  data-ai-hint={image.hint}
                                />
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
                          <p className="text-muted-foreground font-medium">No hay imágenes en este distrito.</p>
                          <p className="text-sm text-muted-foreground">Haz clic aquí para subir una.</p>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <UploadDialog
        isOpen={isUploadOpen}
        onOpenChange={setUploadOpen}
        onImagesUploaded={handleImagesUploaded}
      />

      <ImageViewerDialog
        isOpen={!!selectedImage}
        onOpenChange={() => setSelectedImage(null)}
        image={selectedImage}
      />
    </div>
  );
}

    