'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { FileUp, Loader2, CheckCircle2, TableIcon } from 'lucide-react';
import Header from '@/components/header';
import * as XLSX from 'xlsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { type LocalVotacion } from '@/lib/data';
import { useFirebase } from '@/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export default function ImportarLocalesPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewData, setPreviewData] = useState<Omit<LocalVotacion, 'id'>[]>([]);
  const { toast } = useToast();

  const { firestore, user: currentUser } = useFirebase();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (
        file.type ===
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'text/csv'
      ) {
        setFileName(file.name);
        parseFile(file);
      } else {
        toast({
          variant: 'destructive',
          title: 'Archivo no válido',
          description: 'Por favor, selecciona un archivo .xlsx o .csv',
        });
        e.target.value = '';
      }
    }
  };

  const parseFile = (file: File) => {
    setIsParsing(true);
    setPreviewData([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (json.length === 0) {
          throw new Error("El archivo Excel está vacío o no tiene el formato correcto.");
        }

        const headers = Object.keys(json[0]);
        const findHeader = (possibleNames: string[]) => {
          for (const name of possibleNames) {
            const foundHeader = headers.find(h => h.toLowerCase().trim() === name.toLowerCase());
            if (foundHeader) return foundHeader;
          }
          return null;
        };

        const depHeader = findHeader(['departamento']);
        const distHeader = findHeader(['distrito']);
        const localHeader = findHeader(['local']);
        const dirHeader = findHeader(['direccion', 'dirección']);

        if (!depHeader || !distHeader || !localHeader) {
          throw new Error('Columnas requeridas no encontradas. Asegúrate de que tu archivo contenga "departamento", "distrito" y "local".');
        }

        const parsedData: Omit<LocalVotacion, 'id'>[] = json.map((row) => ({
          departamento: String(row[depHeader] || ''),
          distrito: String(row[distHeader] || ''),
          local: String(row[localHeader] || ''),
          direccion: dirHeader ? String(row[dirHeader] || '') : '',
        }));

        setPreviewData(parsedData);
        toast({
          title: 'Vista previa de locales generada',
          description: `Se han encontrado ${parsedData.length} registros en el archivo.`,
        });
      } catch (error: any) {
        console.error('Error parsing file:', error);
        toast({
          variant: 'destructive',
          title: 'Error al procesar el archivo',
          description: error.message || 'El archivo no tiene el formato esperado. Revise las columnas.',
        });
        setFileName(null);
      } finally {
        setIsParsing(false);
      }
    };
    reader.onerror = () => {
      toast({
        variant: 'destructive',
        title: 'Error al leer el archivo',
        description: 'No se pudo leer el archivo seleccionado.',
      });
      setIsParsing(false);
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveData = async () => {
    if (!firestore || !currentUser || previewData.length === 0) return;
    setIsUploading(true);

    const BATCH_SIZE = 100;
    const localesCollection = collection(firestore, 'locales-votacion');

    try {
      for (let i = 0; i < previewData.length; i += BATCH_SIZE) {
        const batch = writeBatch(firestore);
        const chunk = previewData.slice(i, i + BATCH_SIZE);
        chunk.forEach((local) => {
          const newDocRef = doc(localesCollection);
          batch.set(newDocRef, local);
        });
        await batch.commit();
        await delay(1000); 
      }

      toast({
        title: 'Locales de votación guardados',
        description:
          'Los nuevos locales se han añadido con éxito a Firestore.',
        action: <CheckCircle2 className="text-green-500" />,
      });
      setPreviewData([]);
      setFileName(null);
    } catch (error) {
      console.error(error);
      const contextualError = new FirestorePermissionError({
        operation: 'write',
        path: 'locales-votacion (batch)',
      });
      errorEmitter.emit('permission-error', contextualError);
      toast({
        title: 'Error al guardar locales',
        description: 'No se pudieron guardar los datos.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Importar Locales de Votación" />
      <main className="flex flex-1 flex-col items-center p-4 gap-8">
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5" />
              Importar Locales de Votación
            </CardTitle>
            <CardDescription>
              Sube un archivo .xlsx o .csv con las columnas "departamento", "distrito", "local" y "direccion". El sistema es flexible con mayúsculas/minúsculas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label
                htmlFor="local-file-upload"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <FileUp className="w-8 h-8 mb-3 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Haz clic para subir</span> o
                    arrastra y suelta
                  </p>
                  <p className="text-xs text-muted-foreground">
                    XLSX o CSV para locales de votación
                  </p>
                </div>
                <Input
                  id="local-file-upload"
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                  accept=".xlsx,.csv"
                  disabled={isParsing || isUploading}
                />
              </label>
              {fileName && (
                <p className="text-sm text-center text-muted-foreground">
                  Archivo seleccionado: {fileName}
                </p>
              )}
            </div>

            {(isParsing || isUploading) && (
              <div className="space-y-2 flex items-center justify-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <p className="text-sm font-medium text-center">
                  {isUploading ? 'Guardando datos...' : 'Procesando archivo...'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {previewData.length > 0 && (
          <Card className="w-full max-w-6xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TableIcon className="h-5 w-5" />
                Vista Previa de Locales de Votación
              </CardTitle>
              <CardDescription>
                Revisa los datos que se importarán.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted">
                    <TableRow>
                      <TableHead>Departamento</TableHead>
                      <TableHead>Distrito</TableHead>
                      <TableHead>Local</TableHead>
                      <TableHead>Dirección</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{row.departamento}</TableCell>
                        <TableCell>{row.distrito}</TableCell>
                        <TableCell>{row.local}</TableCell>
                        <TableCell>{row.direccion}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button
                onClick={handleSaveData}
                className="w-full mt-6"
                size="lg"
                disabled={isUploading}
              >
                {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Locales de Votación
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
