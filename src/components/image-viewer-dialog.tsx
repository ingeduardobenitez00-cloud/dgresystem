
"use client";

import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { ImageData } from '@/lib/data';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cleanFileName } from '@/lib/utils';

type ImageViewerDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  image: ImageData | null;
};

export function ImageViewerDialog({ isOpen, onOpenChange, image }: ImageViewerDialogProps) {
  if (!image) return null;
  
  const cleanedTitle = cleanFileName(image.alt);


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{cleanedTitle}</DialogTitle>
          <DialogDescription>
            {image.alt}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg">
            <Image
              src={image.src}
              alt={image.alt}
              fill
              className="object-contain"
              data-ai-hint={image.hint}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
