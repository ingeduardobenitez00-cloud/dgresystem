
"use client";

import { useState, useTransition } from 'react';
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
import { Loader2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import type { ImageData } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { cleanFileName } from '@/lib/utils';

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
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isSubmitting, startTransition] = useTransition();
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles) return;

    const newFilePreviews: FilePreview[] = Array.from(selectedFiles).map(file => ({
      id: `${file.name}-${file.lastModified}`,
      file,
      previewUrl: '',
    }));
    
    setFiles(prev => [...prev, ...newFilePreviews]);

    newFilePreviews.forEach((filePreview) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const dataUri = canvas.toDataURL(filePreview.file.type, 0.7);

            setFiles(prev => prev.map(f => f.id === filePreview.id ? { ...f, previewUrl: dataUri } : f));
            
          } else {
             toast({ variant: 'destructive', title: 'Error', description: `No se pudo procesar la imagen: ${filePreview.file.name}.` });
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(filePreview.file);
    });
  };
  
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (files.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Por favor, selecciona al menos una imagen.' });
      return;
    }
    startTransition(() => {
      const newImages: Omit<ImageData, 'id' | 'departamento' | 'distrito'>[] = files.map(f => ({
        src: f.previewUrl,
        alt: cleanFileName(f.file.name),
        hint: 'building',
      }));

      onImagesUploaded(newImages);
      resetForm();
    });
  };

  const resetForm = () => {
    setFiles([]);
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  }

  const allFilesProcessed = files.every(f => f.previewUrl);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px] md:max-w-2xl lg:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Subir Nuevas Imágenes</DialogTitle>
          <DialogDescription>
            Selecciona una o varias imágenes para subir. Se eliminarán datos innecesarios de los nombres.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-6 py-4">
          <div className="space-y-2">
             <label
                htmlFor="picture"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-3 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Haz clic para subir</span> o arrastra y suelta
                  </p>
                  <p className="text-xs text-muted-foreground">Puedes seleccionar varias imágenes</p>
                </div>
                <Input id="picture" type="file" onChange={handleFileChange} accept="image/*" multiple className="hidden"/>
              </label>
          </div>

          {files.length > 0 && (
            <ScrollArea className="h-[450px] w-full pr-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {files.map((file) => (
                    <Card key={file.id} className="overflow-hidden">
                        <CardContent className="p-2 space-y-2">
                             <div className="relative aspect-video w-full overflow-hidden rounded-md">
                                {file.previewUrl ? (
                                    <Image src={file.previewUrl} alt={`Vista previa de ${file.file.name}`} fill style={{ objectFit: 'cover' }} />
                                ) : (
                                    <div className="w-full h-full bg-muted flex items-center justify-center">
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
                                    </div>
                                )}
                            </div>
                            <div className="p-2">
                                <p className="text-sm font-medium truncate" title={file.file.name}>{cleanFileName(file.file.name)}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={files.length === 0 || !allFilesProcessed || isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Subir {files.length > 0 ? `${files.length} imágen${files.length > 1 ? 'es' : ''}` : 'Imágenes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
