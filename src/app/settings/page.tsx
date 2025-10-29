"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { FileUp, Loader2, CheckCircle2 } from 'lucide-react';
import Header from '@/components/header';

export default function SettingsPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.type === 'text/csv') {
        setFileName(file.name);
      } else {
        toast({
          variant: 'destructive',
          title: 'Archivo no válido',
          description: 'Por favor, selecciona un archivo .xlsx o .csv',
        });
        e.target.value = ''; // Reset input
      }
    }
  };

  const handleImport = () => {
    if (!fileName) {
      toast({
        variant: 'destructive',
        title: 'Ningún archivo seleccionado',
        description: 'Por favor, selecciona un archivo para importar.',
      });
      return;
    }
    setIsImporting(true);
    setProgress(0);
    
    // Simulate import progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) {
          return prev;
        }
        return prev + Math.floor(Math.random() * 10);
      });
    }, 300);

    setTimeout(() => {
      clearInterval(interval);
      setProgress(100);
      setTimeout(() => {
        toast({
          title: 'Importación completada',
          description: `El archivo ${fileName} ha sido importado con éxito.`,
          action: <CheckCircle2 className="text-green-500" />,
        });
        setIsImporting(false);
        setFileName(null);
      }, 500);
    }, 4000);
  };

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Configuración" />
      <main className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <FileUp className="h-6 w-6" />
              Importar Datos
            </CardTitle>
            <CardDescription>
              Sube un archivo .xlsx o .csv con los datos de los registros (DEPARTAMENTO, DISTRITO). La importación se procesará en segundo plano.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <FileUp className="w-10 h-10 mb-3 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Haz clic para subir</span> o arrastra y suelta
                  </p>
                  <p className="text-xs text-muted-foreground">XLSX o CSV</p>
                </div>
                <Input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept=".xlsx,.csv" disabled={isImporting} />
              </label>
              {fileName && !isImporting && (
                <p className="text-sm text-center text-muted-foreground">Archivo seleccionado: {fileName}</p>
              )}
            </div>
            
            {isImporting && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-center">Importando {fileName}...</p>
                <Progress value={progress} className="w-full" />
                <p className="text-xs text-center text-muted-foreground">{Math.round(progress)}% completado</p>
              </div>
            )}
            
            <Button onClick={handleImport} className="w-full" size="lg" disabled={isImporting || !fileName}>
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                'Iniciar Importación'
              )}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
