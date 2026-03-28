
"use client";

import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { ImageData } from '@/lib/data';
import { cleanFileName } from '@/lib/utils';
import { useState, useRef, type MouseEvent, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

type ImageViewerDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  image: ImageData | string | null;
  onNext?: () => void;
  onPrevious?: () => void;
  canNavigateNext?: boolean;
  canNavigatePrevious?: boolean;
};

export function ImageViewerDialog({
  isOpen,
  onOpenChange,
  image,
  onNext,
  onPrevious,
  canNavigateNext = false,
  canNavigatePrevious = false,
}: ImageViewerDialogProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);
  const startPos = useRef({ x: 0, y: 0 });

  const resetState = () => {
    setScale(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
    setIsDragging(false);
  };
  
  useEffect(() => {
    if (isOpen) {
      resetState();
    }
  }, [isOpen, image]);

  if (!image) return null;
  
  const imgSrc = typeof image === 'string' ? image : image.src;
  const imgAlt = typeof image === 'string' ? 'Respaldo Documental' : image.alt;
  const cleanedTitle = typeof image === 'string' ? 'VISOR DE DOCUMENTO' : cleanFileName(image.alt);

  const handleZoomIn = () => setScale(s => Math.min(s + 0.2, 3));
  const handleZoomOut = () => {
    const newScale = Math.max(scale - 0.2, 1);
    if(newScale === 1) {
        setOffset({ x: 0, y: 0 });
    }
    setScale(newScale);
  };
  
  const handleRotate = () => setRotation(r => (r + 90) % 360);
  
  const handleReset = () => resetState();
  
  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (scale > 1) {
      setIsDragging(true);
      startPos.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
      e.currentTarget.style.cursor = 'grabbing';
    }
  };

  const handleMouseUp = (e: MouseEvent<HTMLDivElement>) => {
    setIsDragging(false);
    if (e.currentTarget) e.currentTarget.style.cursor = scale > 1 ? 'grab' : 'default';
  };
  
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (isDragging && imageRef.current) {
        const newX = e.clientX - startPos.current.x;
        const newY = e.clientY - startPos.current.y;
        
        const { width, height } = imageRef.current.getBoundingClientRect();
        const maxOffsetX = ((width * scale) - width) / 2;
        const maxOffsetY = ((height * scale) - height) / 2;

        setOffset({
            x: Math.max(-maxOffsetX, Math.min(maxOffsetX, newX)),
            y: Math.max(-maxOffsetY, Math.min(maxOffsetY, newY)),
        });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 border-none shadow-2xl overflow-hidden bg-black/95">
        <DialogHeader className="p-6 bg-black text-white shrink-0">
          <DialogTitle className="font-black uppercase tracking-widest text-sm">{cleanedTitle}</DialogTitle>
          <DialogDescription className="text-white/40 font-bold uppercase text-[9px]">
            {imgAlt}
          </DialogDescription>
        </DialogHeader>
        
        <div 
            className="flex-1 relative overflow-hidden flex items-center justify-center"
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseUp}
            ref={imageRef}
            style={{ cursor: scale > 1 ? 'grab' : 'default' }}
        >
            <div 
              className="relative w-full h-full transition-transform duration-300 ease-out"
              style={{
                transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px) rotate(${rotation}deg)`,
              }}
            >
              <Image
                src={imgSrc}
                alt={imgAlt}
                fill
                className="object-contain"
                priority
              />
            </div>

            {onPrevious && (
                 <Button
                    variant="ghost"
                    size="icon"
                    onClick={onPrevious}
                    disabled={!canNavigatePrevious}
                    className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-10 h-12 w-12 border border-white/10"
                >
                    <ChevronLeft className="h-8 w-8" />
                </Button>
            )}
            {onNext && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onNext}
                    disabled={!canNavigateNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-10 h-12 w-12 border border-white/10"
                >
                    <ChevronRight className="h-8 w-8" />
                </Button>
            )}
        </div>

        <DialogFooter className="bg-black/80 p-4 flex-row justify-center sm:justify-center border-t border-white/10 gap-4 shrink-0">
            <div className="flex items-center gap-3 bg-white/5 p-2 rounded-2xl border border-white/10">
                <Button variant="ghost" size="icon" onClick={handleZoomOut} disabled={scale <= 1} className="text-white hover:bg-white/10">
                    <ZoomOut className="h-5 w-5" />
                </Button>
                <div className="w-12 text-center text-[10px] font-black text-white/60">{Math.round(scale * 100)}%</div>
                <Button variant="ghost" size="icon" onClick={handleZoomIn} disabled={scale >= 3} className="text-white hover:bg-white/10">
                    <ZoomIn className="h-5 w-5" />
                </Button>
            </div>
            
            <div className="flex items-center gap-3 bg-white/5 p-2 rounded-2xl border border-white/10">
                <Button variant="ghost" size="icon" onClick={handleRotate} className="text-white hover:bg-white/10" title="Girar Imagen">
                    <RotateCw className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleReset} className="text-white hover:bg-white/10" title="Restablecer">
                    <RefreshCw className="h-5 w-5" />
                </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
