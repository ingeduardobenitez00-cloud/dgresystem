
"use client";

import { useState, useEffect } from 'react';
import PhotoGallery from '@/components/photo-gallery';
import Header from '@/components/header';
import { Loader2 } from 'lucide-react';

export default function FotosPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Imágenes de los Registros Electorales" />
      <main className="flex-1">
        {isClient ? (
          <PhotoGallery />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        )}
      </main>
    </div>
  );
}

    