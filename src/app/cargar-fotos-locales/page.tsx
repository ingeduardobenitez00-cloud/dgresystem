'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { FileUp, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import Header from '@/components/header';
import Image from 'next/image';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { type LocalVotacion } from '@/lib/data';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';

type FilePreview = {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'processing' | 'matched' | 'unmatched' | 'error';
};

const BATCH_SIZE = 150; // Reduced to avoid exceeding the 10MB payload limit. The operation limit is 500.
const PREVIEW_LIMIT = 200;

export default function CargarFotosLocalesPage() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [filesToUpload, setFilesToUpload] = useState<FilePreview[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ matched: number; unmatched: number; errors: number } | null>(null);

  const localesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'locales-votacion') : null, [firestore]);
  const { data: localesData, isLoading: isLoadingLocales } = useCollection<LocalVotacion>(localesQuery);

  const filenameMap = useMemo(() => {
    if (!localesData) return new Map();

    const map = new Map<string, { docId: string; field: string }>();
    const fotoKeys: (keyof LocalVotacion)[] = ['foto_frente', 'foto2', 'foto3', 'foto4', 'foto5', 'foto6', 'foto7', 'foto8', 'foto9', 'foto10'];
    
    localesData.forEach(local => {
      fotoKeys.forEach(key => {
        const path = local[key] as string;
        if (path && typeof path === 'string' && !path.startsWith('data:image')) {
          const normalizedPath = path.replace(/\\/g, '/');
          const filename = normalizedPath.substring(normalizedPath.lastIndexOf('/') + 1);
          if (filename) {
            map.set(filename.trim().toLowerCase(), { docId: local.id, field: key });
          }
        }
      });
    });
    return map;
  }, [localesData]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const newFilePreviews: FilePreview[] = Array.from(selectedFiles).map(file => ({
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'pending',
    }));

    setFilesToUpload(prev => [...prev, ...newFilePreviews]);
    e.target.value = '';
    setResults(null);
  };

  const processFileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1200;
            const scaleSize = Math.min(1, MAX_WIDTH / img.width);
            canvas.width = img.width * scaleSize;
            canvas.height = img.height * scaleSize;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const dataUri = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUri);
            } else {
                reject(new Error(`No se pudo procesar: ${file.name}.`));
            }
        };
        img.onerror = () => reject(new Error(`Error al cargar: ${file.name}.`));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo.'));
      reader.readAsDataURL(file);
    });
  };

  const handleSaveData = async () => {
    if (!firestore || filesToUpload.length === 0 || !localesData) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No hay archivos para subir o los datos de los locales no están cargados.',
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setResults(null);
    let matchedCount = 0;
    let errorCount = 0;

    const totalFiles = filesToUpload.length;

    for (let i = 0; i < totalFiles; i += BATCH_SIZE) {
        const chunk = filesToUpload.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(firestore);
        let writesInBatch = 0;

        for (const filePreview of chunk) {
            setFilesToUpload(prev => prev.map(f => f.id === filePreview.id ? { ...f, status: 'processing' } : f));
            const match = filenameMap.get(filePreview.file.name.trim().toLowerCase());

            if (match) {
                try {
                    const dataUrl = await processFileToDataURL(filePreview.file);
                    const docRef = doc(firestore, 'locales-votacion', match.docId);
                    batch.update(docRef, { [match.field]: dataUrl });
                    writesInBatch++;
                    matchedCount++;
                    setFilesToUpload(prev => prev.map(f => f.id === filePreview.id ? { ...f, status: 'matched' } : f));
                } catch (error) {
                    console.error(`Error processing file ${filePreview.file.name}:`, error);
                    errorCount++;
                    setFilesToUpload(prev => prev.map(f => f.id === filePreview.id ? { ...f, status: 'error' } : f));
                }
            } else {
                setFilesToUpload(prev => prev.map(f => f.id === filePreview.id ? { ...f, status: 'unmatched' } : f));
            }
        }

        if (writesInBatch > 0) {
            try {
                await batch.commit();
            } catch(e) {
                 errorCount += writesInBatch; // Assume all writes in this batch failed
                 console.error("Error committing batch: ", e);
                 toast({
                    variant: 'destructive',
                    title: 'Error de Red',
                    description: 'No se pudo guardar un lote de imágenes. Revisa tu conexión y los permisos.',
                 });
            }
        }
        setProgress(Math.round(((i + chunk.length) / totalFiles) * 100));
    }

    setIsProcessing(false);
    const unmatchedCount = totalFiles - matchedCount - errorCount;
    setResults({ matched: matchedCount, unmatched: unmatchedCount, errors: errorCount });
    toast({
        title: 'Proceso completado',
        description: `${matchedCount} fotos guardadas, ${unmatchedCount} no coincidieron, ${errorCount} errores.`,
    });

    setTimeout(() => {
        setFilesToUpload([]);
        setResults(null);
    }, 4000);
  };

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Cargar Fotos de Locales" />
      <main className="flex flex-1 flex-col items-center p-4 gap-8">
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5" />
              Cargar Lote de Fotos
            </CardTitle>
            <CardDescription>
              Sube las imágenes de los locales. El sistema las asociará automáticamente a su local correspondiente usando el nombre del archivo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <label
              htmlFor="photo-upload"
              className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <FileUp className="w-10 h-10 mb-4 text-muted-foreground" />
                <p className="mb-2 text-lg text-muted-foreground">
                  <span className="font-semibold">Haz clic para subir</span> o arrastra y suelta
                </p>
                <p className="text-sm text-muted-foreground">Sube todas las fotos de los locales a la vez</p>
              </div>
              <Input id="photo-upload" type="file" className="hidden" onChange={handleFileChange} multiple accept="image/jpeg,image/jpg" disabled={isProcessing || isLoadingLocales} />
            </label>
            {isLoadingLocales && (
                <div className="flex items-center justify-center text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cargando datos de locales...
                </div>
            )}
          </CardContent>
        </Card>

        {filesToUpload.length > 0 && (
          <Card className="w-full max-w-6xl">
            <CardHeader>
              <CardTitle>Fotos para Subir ({filesToUpload.length})</CardTitle>
               <CardDescription>
                Revisa las imágenes seleccionadas. Las que tengan un nombre de archivo que coincida con la referencia del Excel se guardarán.
                {filesToUpload.length > PREVIEW_LIMIT && (
                  <span className="block mt-2 font-semibold text-primary">
                    Mostrando una previsualización de {PREVIEW_LIMIT} de {filesToUpload.length} imágenes para mantener la aplicación fluida.
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-80 w-full pr-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {filesToUpload.slice(0, PREVIEW_LIMIT).map(f => (
                            <div key={f.id} className="relative group">
                                <Image src={f.previewUrl} alt={f.file.name} width={200} height={150} className="object-cover rounded-md aspect-video" />
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-md">
                                    {f.status === 'matched' && <CheckCircle2 className="h-8 w-8 text-green-400" />}
                                    {f.status === 'unmatched' && <AlertTriangle className="h-8 w-8 text-yellow-400" />}
                                    {f.status === 'error' && <AlertTriangle className="h-8 w-8 text-red-500" />}
                                    {f.status === 'processing' && <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />}
                                </div>
                                <p className="text-xs mt-1 truncate" title={f.file.name}>{f.file.name}</p>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
              {isProcessing && <Progress value={progress} className="w-full mt-4" />}
              {results && (
                 <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                    <div className="p-2 bg-green-100 rounded-md dark:bg-green-900/50">
                        <p className="font-bold text-lg text-green-700 dark:text-green-300">{results.matched}</p>
                        <p className="text-sm text-green-600 dark:text-green-400">Coincidencias</p>
                    </div>
                    <div className="p-2 bg-yellow-100 rounded-md dark:bg-yellow-900/50">
                        <p className="font-bold text-lg text-yellow-700 dark:text-yellow-300">{results.unmatched}</p>
                        <p className="text-sm text-yellow-600 dark:text-yellow-400">Sin coincidencias</p>
                    </div>
                     <div className="p-2 bg-red-100 rounded-md dark:bg-red-900/50">
                        <p className="font-bold text-lg text-red-700 dark:text-red-300">{results.errors}</p>
                        <p className="text-sm text-red-600 dark:text-red-400">Errores</p>
                    </div>
                </div>
              )}
              <Button onClick={handleSaveData} className="w-full mt-6" size="lg" disabled={isProcessing || isLoadingLocales}>
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                {isProcessing ? 'Procesando...' : `Guardar ${filesToUpload.length} Foto${filesToUpload.length !== 1 ? 's' : ''}`}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
