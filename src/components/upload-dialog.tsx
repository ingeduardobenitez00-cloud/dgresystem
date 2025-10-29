"use client";

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarIcon, Loader2, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { ImageData } from '@/lib/data';
import { imageAutoTagging } from '@/lib/actions';

type UploadDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onImageUploaded: (newImage: ImageData) => void;
};

type FormData = {
  tags: string;
  category: string;
  date: Date;
};

export function UploadDialog({ isOpen, onOpenChange, onImageUploaded }: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);
  const [isSubmitting, startTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<FormData>({
    defaultValues: { tags: '', category: 'Fachada', date: new Date() },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUri = reader.result as string;
        setPreview(dataUri);
        handleTagGeneration(dataUri);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleTagGeneration = async (photoDataUri: string) => {
    setIsGeneratingTags(true);
    const result = await imageAutoTagging({ photoDataUri });
    if ('tags' in result) {
      form.setValue('tags', result.tags.join(', '));
      toast({
        title: 'Etiquetas generadas por IA',
        description: 'Se han sugerido etiquetas para tu imagen.',
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Error de IA',
        description: 'No se pudieron generar las etiquetas.',
      });
    }
    setIsGeneratingTags(false);
  };
  
  const onSubmit = form.handleSubmit((data) => {
    if (!file || !preview) {
      toast({ variant: 'destructive', title: 'Error', description: 'Por favor, selecciona una imagen.' });
      return;
    }
    startTransition(() => {
      const newImage: ImageData = {
        id: `img_${Date.now()}`,
        src: preview,
        alt: file.name,
        tags: data.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        date: format(data.date, 'yyyy-MM-dd'),
        category: data.category,
        hint: data.tags.split(',')[0] || 'building'
      };
      onImageUploaded(newImage);
      resetForm();
    });
  });

  const resetForm = () => {
    form.reset();
    setFile(null);
    setPreview(null);
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px] md:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Subir Nueva Imagen</DialogTitle>
          <DialogDescription>
            Selecciona una imagen y categorízala. La IA sugerirá etiquetas automáticamente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="picture">Imagen</Label>
            <Input id="picture" type="file" onChange={handleFileChange} accept="image/*" />
          </div>

          {preview && (
            <div className="space-y-4">
              <div className="relative aspect-video w-full overflow-hidden rounded-md">
                <Image src={preview} alt="Vista previa" fill style={{ objectFit: 'cover' }} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Categoría</Label>
                  <Select onValueChange={(value) => form.setValue('category', value)} defaultValue={form.getValues('category')}>
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fachada">Fachada</SelectItem>
                      <SelectItem value="Interior">Interior</SelectItem>
                      <SelectItem value="Infraestructura">Infraestructura</SelectItem>
                      <SelectItem value="Documento">Documento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Fecha</Label>
                   <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !form.watch('date') && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.watch('date') ? format(form.watch('date'), "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={form.watch('date')}
                        onSelect={(date) => date && form.setValue('date', date)}
                        initialFocus
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags" className="flex items-center">
                  Etiquetas (separadas por coma)
                  {isGeneratingTags && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  {!isGeneratingTags && <Sparkles className="ml-2 h-4 w-4 text-accent" />}
                </Label>
                <Input id="tags" {...form.register('tags')} disabled={isGeneratingTags} />
                 <p className="text-sm text-muted-foreground">
                    La IA ha sugerido etiquetas. Puedes modificarlas como desees.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={!preview || isGeneratingTags || isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Subir Imagen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
