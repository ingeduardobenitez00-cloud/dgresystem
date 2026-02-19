'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  DatabaseBackup, 
  FileUp, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  Database, 
  Play, 
  Pause,
  Trash2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useFirebase } from '@/firebase';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';

type ImportState = 'idle' | 'parsing' | 'uploading' | 'paused' | 'completed' | 'error';

export default function ImportarPadronPage() {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [status, setStatus] = useState<ImportState>('idle');
  const [fileName, setFileName] = useState<string | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [processedRecords, setProcessedRecords] = useState(0);
  
  // CRITICAL: Store data in a Ref to avoid React state overhead with 1M items
  const pendingDataRef = useRef<any[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const BATCH_SIZE = 500;
  const PAUSE_BETWEEN_BATCHES = 1000;

  useEffect(() => {
    return () => {
      pendingDataRef.current = [];
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setStatus('parsing');
    setTotalRecords(0);
    setProcessedRecords(0);
    setIsDataLoaded(false);

    // Yield control to browser to show the loader before heavy parsing
    setTimeout(() => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: 'binary', cellDates: false, bookVBA: false, bookProps: false });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
          
          if (json.length === 0) throw new Error("El archivo está vacío.");

          pendingDataRef.current = json;
          setTotalRecords(json.length);
          setIsDataLoaded(true);
          setStatus('idle');
          toast({ title: "Archivo procesado", description: `Se han detectado ${json.length.toLocaleString()} registros.` });
        } catch (err: any) {
          setStatus('error');
          toast({ variant: "destructive", title: "Error al leer archivo", description: err.message });
        }
      };
      reader.readAsBinaryString(file);
    }, 100);
  };

  const clearData = () => {
    pendingDataRef.current = [];
    setFileName(null);
    setTotalRecords(0);
    setProcessedRecords(0);
    setIsDataLoaded(false);
    setStatus('idle');
  };

  const startImport = async () => {
    if (!firestore || pendingDataRef.current.length === 0) return;
    
    setStatus('uploading');
    const colRef = collection(firestore, 'padron');
    let currentIdx = processedRecords;

    const runBatch = async () => {
      if (currentIdx >= pendingDataRef.current.length || status === 'paused') {
        if (currentIdx >= pendingDataRef.current.length) {
          setStatus('completed');
          toast({ title: "Importación finalizada" });
        }
        return;
      }

      const batch = writeBatch(firestore);
      const end = Math.min(currentIdx + BATCH_SIZE, pendingDataRef.current.length);
      const chunk = pendingDataRef.current.slice(currentIdx, end);

      chunk.forEach((item: any) => {
        const newDocRef = doc(colRef);
        batch.set(newDocRef, {
          cedula: String(item.CEDULA || item.cedula || '').trim(),
          nombre: String(item.NOMBRE || item.nombre || '').trim(),
          apellido: String(item.APELLIDO || item.apellido || '').trim(),
          departamento: String(item.DEPARTAMENTO || item.departamento || '').trim(),
          distrito: String(item.DISTRITO || item.distrito || '').trim(),
          local: String(item.LOCAL || item.local || '').trim(),
          fecha_carga: new Date().toISOString(),
          archivo_origen: fileName
        });
      });

      try {
        await batch.commit();
        currentIdx = end;
        setProcessedRecords(currentIdx);
        
        // Use a timeout to allow the browser to process UI updates and stay responsive
        setTimeout(runBatch, PAUSE_BETWEEN_BATCHES);
      } catch (err) {
        console.error("Batch error:", err);
        setStatus('error');
        toast({ variant: "destructive", title: "Error en la subida", description: "El proceso se ha detenido." });
      }
    };

    runBatch();
  };

  const progressPercentage = totalRecords > 0 ? Math.round((processedRecords / totalRecords) * 100) : 0;
  const estimatedCost = useMemo(() => (totalRecords / 100000) * 0.18, [totalRecords]);

  return (
    <div className="flex min-h-screen flex-col bg-muted/10">
      <Header title="Big Data Import" />
      <main className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black uppercase text-primary tracking-tight">Motor de Carga Masiva</h1>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              <DatabaseBackup className="h-4 w-4" />
              Gestión de archivos de gran volumen.
            </p>
          </div>
          {isDataLoaded && status !== 'uploading' && (
            <Button variant="ghost" size="sm" onClick={clearData} className="text-destructive font-bold uppercase text-[10px]">
              <Trash2 className="h-3 w-3 mr-1" /> Limpiar Memoria
            </Button>
          )}
        </div>

        <div className="grid gap-6">
          <Card className={cn("border-2 transition-all", status === 'uploading' ? "border-primary shadow-xl" : "")}>
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <FileUp className="h-4 w-4" /> SELECCIONAR ARCHIVO
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!fileName ? (
                <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-10 bg-muted/30 hover:bg-muted/50 transition-all cursor-pointer relative">
                  <label htmlFor="padron-file" className="flex flex-col items-center gap-2 cursor-pointer w-full text-center">
                    <Database className="h-12 w-12 text-primary opacity-40" />
                    <span className="text-sm font-bold uppercase text-muted-foreground">Subir archivo para procesar</span>
                    <Input id="padron-file" type="file" className="hidden" accept=".xlsx,.csv" onChange={handleFileChange} />
                  </label>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-primary/5 p-4 rounded-xl border">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-xs font-black uppercase text-primary leading-none">{fileName}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{totalRecords.toLocaleString()} registros detectados</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Costo Estimado</p>
                      <p className="text-sm font-bold text-green-600">${estimatedCost.toFixed(2)} USD</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase">
                      <span>Progreso: {progressPercentage}%</span>
                      <span>{processedRecords.toLocaleString()} / {totalRecords.toLocaleString()}</span>
                    </div>
                    <Progress value={progressPercentage} className="h-3" />
                  </div>
                </div>
              )}
            </CardContent>
            {fileName && status !== 'parsing' && (
              <CardFooter className="bg-muted/5 border-t p-6">
                {status === 'idle' && (
                  <Button className="w-full h-12 font-black uppercase" onClick={startImport}>
                    <Play className="mr-2 h-5 w-5" /> INICIAR IMPORTACIÓN
                  </Button>
                )}
                {status === 'uploading' && (
                  <Button variant="outline" className="w-full h-12 font-black uppercase border-primary text-primary" onClick={() => setStatus('paused')}>
                    <Pause className="mr-2 h-5 w-5" /> PAUSAR PROCESO
                  </Button>
                )}
                {status === 'paused' && (
                  <Button className="w-full h-12 font-black uppercase" onClick={() => setStatus('idle')}>
                    <Play className="mr-2 h-5 w-5" /> REANUDAR CARGA
                  </Button>
                )}
                {status === 'completed' && (
                  <div className="w-full flex items-center justify-center gap-3 text-green-600 font-black uppercase">
                    <CheckCircle2 className="h-6 w-6" /> PROCESO FINALIZADO
                  </div>
                )}
              </CardFooter>
            )}
          </Card>

          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-amber-800 text-[10px] font-black uppercase flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Importante: Rendimiento
              </CardTitle>
            </CardHeader>
            <CardContent className="text-[11px] text-amber-700 leading-relaxed font-medium">
              El procesamiento de archivos grandes bloquea momentáneamente el navegador. Si aparece el aviso "La página no responde", elija **ESPERAR**. El sistema está trabajando en segundo plano.
            </CardContent>
          </Card>
        </div>

        {status === 'parsing' && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <div className="bg-white max-w-md w-full rounded-2xl p-10 text-center shadow-2xl">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <h3 className="text-xl font-black uppercase">Analizando Datos...</h3>
              <p className="text-sm text-muted-foreground mt-2">Estamos preparando los registros. Por favor, no cierres esta pestaña.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
