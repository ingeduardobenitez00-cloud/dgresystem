
'use client';

import { useState, useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
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
  AlertCircle,
  DollarSign
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
  const [pendingData, setPendingData] = useState<any[]>([]);
  const [errors, setErrors] = useState<number>(0);

  const BATCH_SIZE = 500;
  const PAUSE_BETWEEN_BATCHES = 800; // ms to avoid hitting rate limits

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setStatus('parsing');
    setTotalRecords(0);
    setProcessedRecords(0);
    setPendingData([]);
    setErrors(0);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: false });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        
        if (json.length === 0) throw new Error("El archivo está vacío.");

        setTotalRecords(json.length);
        setPendingData(json);
        setStatus('idle');
        toast({ title: "Archivo procesado", description: `Se han encontrado ${json.length.toLocaleString()} registros.` });
      } catch (err: any) {
        setStatus('error');
        toast({ variant: "destructive", title: "Error al leer archivo", description: err.message });
      }
    };
    reader.readAsBinaryString(file);
  };

  const startImport = async () => {
    if (!firestore || pendingData.length === 0) return;
    
    setStatus('uploading');
    const colRef = collection(firestore, 'padron');
    let currentIdx = processedRecords;

    while (currentIdx < pendingData.length && status !== 'paused') {
      const batch = writeBatch(firestore);
      const end = Math.min(currentIdx + BATCH_SIZE, pendingData.length);
      const chunk = pendingData.slice(currentIdx, end);

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
        await new Promise(res => setTimeout(res, PAUSE_BETWEEN_BATCHES));
      } catch (err) {
        console.error("Batch error:", err);
        setErrors(prev => prev + chunk.length);
        currentIdx = end;
        setProcessedRecords(currentIdx);
      }

      if (currentIdx >= pendingData.length) {
        setStatus('completed');
        toast({ title: "Importación finalizada", description: `Se procesaron ${totalRecords.toLocaleString()} registros.` });
        break;
      }
    }
  };

  const progressPercentage = totalRecords > 0 ? Math.round((processedRecords / totalRecords) * 100) : 0;
  
  // Estimated cost calculation: $0.18 per 100k writes
  const estimatedCost = useMemo(() => {
    if (totalRecords === 0) return 0;
    return (totalRecords / 100000) * 0.18;
  }, [totalRecords]);

  return (
    <div className="flex min-h-screen flex-col bg-muted/10">
      <Header title="Importación Masiva de Padrón" />
      <main className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full">
        
        <div className="mb-8">
          <h1 className="text-3xl font-black uppercase text-primary tracking-tight">Big Data Import</h1>
          <p className="text-muted-foreground flex items-center gap-2 mt-1">
            <DatabaseBackup className="h-4 w-4" />
            Herramienta para carga de archivos de 1 millón de registros.
          </p>
        </div>

        <div className="grid gap-6">
          
          <Card className={cn("border-2 transition-all", status === 'uploading' ? "border-primary shadow-xl scale-[1.01]" : "")}>
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <FileUp className="h-4 w-4" /> SELECCIÓN DE ARCHIVO
              </CardTitle>
              <CardDescription>Formatos admitidos: .xlsx, .csv. Máximo recomendado: 1,000,000 registros por archivo.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-10 bg-muted/30 hover:bg-muted/50 transition-all cursor-pointer relative">
                <label htmlFor="padron-file" className="flex flex-col items-center gap-2 cursor-pointer w-full">
                  <Database className="h-12 w-12 text-primary opacity-40" />
                  <span className="text-sm font-bold uppercase text-muted-foreground">Haz clic para buscar archivo</span>
                  {fileName && <Badge variant="default" className="mt-2 text-xs py-1 px-4">{fileName}</Badge>}
                  <Input 
                    id="padron-file" 
                    type="file" 
                    className="hidden" 
                    accept=".xlsx,.csv" 
                    onChange={handleFileChange} 
                    disabled={status === 'uploading'}
                  />
                </label>
              </div>

              {totalRecords > 0 && (
                <div className="mt-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Progreso de Carga</p>
                      <p className="text-2xl font-black text-primary">{processedRecords.toLocaleString()} <span className="text-sm text-muted-foreground font-bold">/ {totalRecords.toLocaleString()}</span></p>
                    </div>
                    <div className="text-right space-y-1">
                        <p className="text-[10px] font-black uppercase text-muted-foreground">Costo Estimado Firestore</p>
                        <p className="text-xl font-black text-green-600">${estimatedCost.toFixed(2)} USD</p>
                    </div>
                  </div>
                  
                  <Progress value={progressPercentage} className="h-4" />

                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                      <p className="text-[9px] font-black uppercase text-muted-foreground">Lotes Restantes</p>
                      <p className="text-xl font-bold">{Math.ceil((totalRecords - processedRecords) / BATCH_SIZE)}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                      <p className="text-[9px] font-black uppercase text-green-600">Completados</p>
                      <p className="text-xl font-bold text-green-700">{processedRecords.toLocaleString()}</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                      <p className="text-[9px] font-black uppercase text-red-600">Errores</p>
                      <p className="text-xl font-bold text-red-700">{errors.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="bg-muted/5 border-t p-6 gap-4">
              {status === 'idle' && totalRecords > 0 && (
                <Button className="w-full h-12 font-black uppercase" onClick={startImport}>
                  <Play className="mr-2 h-5 w-5" /> INICIAR IMPORTACIÓN MASIVA
                </Button>
              )}
              {status === 'uploading' && (
                <Button variant="outline" className="w-full h-12 font-black uppercase border-primary text-primary" onClick={() => setStatus('paused')}>
                  <Pause className="mr-2 h-5 w-5" /> PAUSAR PROCESO
                </Button>
              )}
              {status === 'paused' && (
                <Button className="w-full h-12 font-black uppercase" onClick={startImport}>
                  <Play className="mr-2 h-5 w-5" /> REANUDAR CARGA
                </Button>
              )}
              {status === 'completed' && (
                <div className="w-full flex items-center justify-center gap-3 text-green-600 font-black uppercase py-2">
                  <CheckCircle2 className="h-6 w-6" /> IMPORTACIÓN COMPLETADA EXITOSAMENTE
                </div>
              )}
            </CardFooter>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-amber-200 bg-amber-50/50">
                <CardHeader className="pb-2">
                <CardTitle className="text-amber-800 text-xs font-black uppercase flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> ADVERTENCIA TÉCNICA
                </CardTitle>
                </CardHeader>
                <CardContent className="text-[11px] text-amber-700 font-medium leading-relaxed">
                <ul className="list-disc pl-4 space-y-1">
                    <li>Cargar 1 millón de registros puede tardar entre 30 y 60 minutos.</li>
                    <li>No cierre esta pestaña mientras el proceso esté activo.</li>
                    <li>El sistema procesa lotes de 500 registros para maximizar la eficiencia.</li>
                </ul>
                </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50/50">
                <CardHeader className="pb-2">
                <CardTitle className="text-blue-800 text-xs font-black uppercase flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> INFORMACIÓN DE COSTOS
                </CardTitle>
                </CardHeader>
                <CardContent className="text-[11px] text-blue-700 font-medium leading-relaxed">
                <ul className="list-disc pl-4 space-y-1">
                    <li>Firestore cobra por escritura. 1M de registros cuesta aprox. **$1.80 USD**.</li>
                    <li>**Plan Blaze es requerido**: El plan gratuito solo permite 20,000 registros al día.</li>
                    <li>El almacenamiento mensual de 9M de registros tendrá un costo recurrente aproximado de **$1 a $3 USD**.</li>
                </ul>
                </CardContent>
            </Card>
          </div>

          {status === 'parsing' && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
              <Card className="max-w-md w-full text-center p-10">
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                <h3 className="text-xl font-black uppercase mb-2">Procesando Excel...</h3>
                <p className="text-sm text-muted-foreground">Estamos preparando los millones de registros para la carga. Por favor, no cierres el navegador.</p>
              </Card>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
