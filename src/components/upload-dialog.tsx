
"use client";

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Upload, Trash2, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import type { ImageData } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { cleanFileName } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { compressImage } from '@/lib/image-utils';

const photoCategories = [
    { id: 'frente', label: 'FOTOGRAFIA #1 DEL FRENTE DEL REGISTRO', multiple: false, max: 1 },
    { id: 'costado-derecho', label: 'FOTOGRAFIA #2 COSTADO DERECHO DEL REGISTRO', multiple: false, max: 1 },
    { id: 'costado-izquierdo', label: 'FOTOGRAFIA #3 COSTADOS IZQUIERDO DEL REGISTRO', multiple: false, max: 1 },
    { id: 'fondo', label: 'FOTOGRAFIA #4 DEL FONDO DEL REGISTRO', multiple: false, max: 1 },
    { id: 'habitacion-interior', label: 'FOTOGRAFIA #5 HABITACION SEGURA INTERIOR', multiple: false, max: 1 },
    { id: 'habitacion-techo', label: 'FOTOGRAFIA #6 HABITACION SEGURA TECHO', multiple: false, max: 1 },
    { id: 'todas-habitaciones', label: 'FOTOGRAFIA #7 TODAS LAS HABITACIONES DEL REGISTRO ELECTORAL', multiple: true, max: 10 },
    { id: 'formulario', label: 'FOTOGRAFIA #8 DEL FORMULARIO FIRMADO Y SELLADO', multiple: false, max: 1 },
];

type UploadDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onImagesUploaded: (newImages: Omit<ImageData, 'id' | 'departamento' | 'distrito'>[]) => void;
};

type FilePreview = {
  id: string;
  file: File;
  previewUrl: string;
};

export function UploadDialog({ isOpen, onOpenChange, onImagesUploaded }: UploadDialogProps) {
  const [filesByCategory, setFilesByCategory] = useState<Record<string, FilePreview[]>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const resetForm = () => {
    setFilesByCategory({});
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, categoryId: string, maxFiles: number) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles) return;

    const currentFilesCount = filesByCategory[categoryId]?.length || 0;
    if (currentFilesCount + selectedFiles.length > maxFiles) {
        toast({
            variant: 'destructive',
            title: 'Límite de archivos excedido',
            description: `Puedes subir un máximo de ${maxFiles} archivo(s) para esta categoría.`,
        });
        return;
    }
    
    setIsProcessing(true);

    const processAndSetFiles = async (files: File[]) => {
      const filePreviews: FilePreview[] = files.map(file => ({
          id: `${file.name}-${file.lastModified}-${Math.random()}`,
          file,
          previewUrl: '',
      }));

      setFilesByCategory(prev => ({
          ...prev,
          [categoryId]: [...(prev[categoryId] || []), ...filePreviews],
      }));

      for (const filePreview of filePreviews) {
          try {
              const dataUri = await compressImage(filePreview.file);
              setFilesByCategory(prev => {
                  const updatedCategoryFiles = (prev[categoryId] || []).map(f =>
                      f.id === filePreview.id ? { ...f, previewUrl: dataUri } : f
                  );
                  return { ...prev, [categoryId]: updatedCategoryFiles };
              });
          } catch (error) {
              console.error('Error processing file:', error);
              toast({ variant: 'destructive', title: 'Error de Procesamiento', description: `No se pudo procesar: ${filePreview.file.name}` });
              setFilesByCategory(prev => ({
                  ...prev,
                  [categoryId]: (prev[categoryId] || []).filter(f => f.id !== filePreview.id)
              }));
          }
      }
    };
    
    const heicFiles: File[] = [];
    const otherFiles: File[] = [];
    Array.from(selectedFiles).forEach(file => {
        if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
            heicFiles.push(file);
        } else {
            otherFiles.push(file);
        }
    });

    if (otherFiles.length > 0) {
        await processAndSetFiles(otherFiles);
    }
    
    if (heicFiles.length > 0) {
        const convertedFiles: File[] = [];
        // Dynamic import to avoid SSR issues
        const heic2any = (await import('heic2any')).default;
        
        for (const heicFile of heicFiles) {
            try {
                const conversionResult = await heic2any({ blob: heicFile, toType: "image/jpeg", quality: 0.7 });
                const convertedBlob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
                convertedFiles.push(new File([convertedBlob], `${heicFile.name.split('.')[0]}.jpg`, { type: 'image/jpeg' }));
            } catch (error) {
                 console.error('Error converting HEIC file:', error);
                 toast({ variant: 'destructive', title: 'Error de Conversión', description: `No se pudo convertir: ${heicFile.name}` });
            }
        }
        if (convertedFiles.length > 0) {
           await processAndSetFiles(convertedFiles);
        }
    }

    setIsProcessing(false);
    event.target.value = ''; // Reset file input
  };
  

  const handleRemoveFile = (categoryId: string, fileId: string) => {
    setFilesByCategory(prev => ({
        ...prev,
        [categoryId]: (prev[categoryId] || []).filter(f => f.id !== fileId)
    }));
  };
  
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const allFiles = Object.values(filesByCategory).flat();

    if (allFiles.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Por favor, selecciona al menos una imagen.' });
      return;
    }
    if (isProcessing || allFiles.some(f => !f.previewUrl)) {
      toast({ variant: 'destructive', title: 'Error', description: 'Por favor, espera a que todas las imágenes se procesen.' });
      return;
    }
    
    const newImages: Omit<ImageData, 'id' | 'departamento' | 'distrito'>[] = [];
    for (const category of photoCategories) {
        const files = filesByCategory[category.id] || [];
        files.forEach((f, index) => {
            let altText = category.label;
            if (category.multiple) {
                altText = `${category.label} - Foto ${index + 1}`;
            }
             newImages.push({
                src: f.previewUrl,
                alt: altText,
                hint: 'building',
            });
        })
    }

    onImagesUploaded(newImages);
    handleOpenChange(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  const allFilesCount = Object.values(filesByCategory).flat().length;
  const allFilesProcessed = !isProcessing && allFilesCount > 0 && Object.values(filesByCategory).flat().every(f => f.previewUrl);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px] md:max-w-2xl lg:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Subir Imágenes Requeridas</DialogTitle>
          <DialogDescription>
            Completa las categorías de imágenes solicitadas. El peso de las imágenes se ajustará automáticamente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-6 py-4">
            <ScrollArea className="h-[60vh] w-full pr-4">
              <div className="space-y-6">
                {photoCategories.map((category) => (
                   <div key={category.id} className="space-y-2">
                       <Label className="font-semibold">{category.label} {category.multiple && `(hasta ${category.max})`}</Label>
                       <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                           {(filesByCategory[category.id] || []).map(file => (
                              <Card key={file.id} className="overflow-hidden group/preview">
                                  <CardContent className="p-2 space-y-2 relative">
                                      <div className="relative aspect-video w-full overflow-hidden rounded-md">
                                          {file.previewUrl ? (
                                              <Image src={file.previewUrl} alt={`Vista previa de ${file.file.name}`} fill style={{ objectFit: 'cover' }} />
                                          ) : (
                                              <div className="w-full h-full bg-muted flex items-center justify-center">
                                                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
                                              </div>
                                          )}
                                      </div>
                                      <p className="text-xs font-medium truncate" title={file.file.name}>{cleanFileName(file.file.name)}</p>
                                      <Button type="button" variant="destructive" size="icon" className="absolute top-3 right-3 h-7 w-7 opacity-0 group-hover/preview:opacity-100 transition-opacity" onClick={() => handleRemoveFile(category.id, file.id)}>
                                          <Trash2 className="h-4 w-4" />
                                      </Button>
                                  </CardContent>
                              </Card>
                           ))}
                           {((filesByCategory[category.id]?.length || 0) < category.max) && (
                               <div className="flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed rounded-lg hover:bg-muted transition-colors p-2">
                                  <div className="flex items-center justify-center gap-4">
                                      <label htmlFor={`upload-${category.id}`} className="flex flex-col items-center justify-center text-center p-2 cursor-pointer rounded-md hover:bg-muted-foreground/10">
                                          <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                                          <p className="text-xs text-muted-foreground">
                                              <span className="font-semibold">Subir</span>
                                          </p>
                                          <Input id={`upload-${category.id}`} type="file" onChange={(e) => handleFileChange(e, category.id, category.max)} accept="image/*,.heic,.heif" multiple={category.multiple} className="hidden" disabled={isProcessing} />
                                      </label>
                                      <div className="w-px h-16 bg-border"></div>
                                      <label htmlFor={`camera-${category.id}`} className="flex flex-col items-center justify-center text-center p-2 cursor-pointer rounded-md hover:bg-muted-foreground/10">
                                          <Camera className="w-8 h-8 mb-2 text-muted-foreground" />
                                          <p className="text-xs text-muted-foreground">
                                              <span className="font-semibold">Cámara</span>
                                          </p>
                                          <Input id={`camera-${category.id}`} type="file" onChange={(e) => handleFileChange(e, category.id, category.max)} accept="image/*" capture="environment" multiple={category.multiple} className="hidden" disabled={isProcessing} />
                                      </label>
                                  </div>
                               </div>
                           )}
                       </div>
                   </div>
                ))}
              </div>
            </ScrollArea>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isProcessing || !allFilesProcessed && allFilesCount > 0}>
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Subir {allFilesCount > 0 ? `${allFilesCount} imágen${allFilesCount > 1 ? 'es' : ''}` : 'Imágenes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
