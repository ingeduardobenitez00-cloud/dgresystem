
import PhotoGallery from '@/components/photo-gallery';
import Header from '@/components/header';

export default function FotosPage() {
  return (
    <div className="flex min-h-screen w-full flex-col">
       <Header title="Galería de Fotos" />
      <main className="flex-1">
        <PhotoGallery />
      </main>
    </div>
  );
}
