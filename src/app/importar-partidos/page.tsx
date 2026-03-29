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
import { FileUp, Loader2, CheckCircle2, TableIcon, Flag, Download } from 'lucide-react';
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
import { type PartidoPolitico } from '@/lib/data';
import { useFirebase } from '@/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export default function ImportarPartidosPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewData, setPreviewData] = useState<Omit<PartidoPolitico, 'id'>[]>([]);
  const { toast } = useToast();

  const { firestore } = useFirebase();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'text/csv' ||
        file.name.endsWith('.csv')
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
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (json.length === 0) {
          throw new Error("El archivo Excel está vacío.");
        }

        const headers = Object.keys(json[0]);
        const findHeader = (possibleNames: string[]) => {
          for (const name of possibleNames) {
            const foundHeader = headers.find(h => h.toUpperCase().trim() === name.toUpperCase());
            if (foundHeader) return foundHeader;
          }
          return null;
        };

        const partidoHeader = findHeader(['PARTIDOS_POLITICOS', 'PARTIDO', 'NOMBRE']);
        const siglasHeader = findHeader(['SIGLAS', 'SIGLA']);
        const movimientoHeader = findHeader(['MOVIMIENTO POLITICO', 'MOVIMIENTO', 'INTERNO']);

        if (!partidoHeader) {
          throw new Error('No se encontró la columna "PARTIDOS_POLITICOS".');
        }

        const parsedData: Omit<PartidoPolitico, 'id'>[] = json.map((row) => ({
          nombre: String(row[partidoHeader] || '').trim(),
          siglas: siglasHeader ? String(row[siglasHeader] || '').trim() : '',
          movimiento: movimientoHeader ? String(row[movimientoHeader] || '').trim() : '',
        })).filter(p => p.nombre !== "");

        setPreviewData(parsedData);
        toast({
          title: 'Vista previa generada',
          description: `Se han detectado ${parsedData.length} registros listos para importar.`,
        });
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Error al procesar',
          description: error.message,
        });
        setFileName(null);
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveData = async () => {
    if (!firestore || previewData.length === 0) return;
    setIsUploading(true);

    const BATCH_SIZE = 100;
    const colRef = collection(firestore, 'partidos-politicos');

    try {
      for (let i = 0; i < previewData.length; i += BATCH_SIZE) {
        const batch = writeBatch(firestore);
        const chunk = previewData.slice(i, i + BATCH_SIZE);
        chunk.forEach((p) => {
          const newDoc = doc(colRef);
          batch.set(newDoc, p);
        });
        await batch.commit();
        await delay(500);
      }

      toast({
        title: 'Carga Completada',
        description: 'El directorio de partidos y movimientos ha sido actualizado.',
        action: <CheckCircle2 className="text-green-500" />,
      });
      setPreviewData([]);
      setFileName(null);
    } catch (error) {
      toast({
        title: 'Error al guardar',
        description: 'No se pudieron guardar los datos en la nube.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = "PARTIDOS_POLITICOS,SIGLAS,MOVIMIENTO POLITICO\n";
    const example = "PARTIDO COLORADO,ANR,MOVIMIENTO HONOR COLORADO\nPARTIDO LIBERAL,PLRA,MOVIMIENTO NUEVO PAIS";
    const blob = new Blob([headers + example], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "proforma_partidos_movimientos.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/10">
      <Header title="Importar Partidos Políticos" />
      <main className="flex flex-1 flex-col items-center p-4 md:p-8 gap-8">
        <div className="w-full max-w-4xl flex justify-end">
            <Button variant="outline" className="font-black uppercase text-[10px] gap-2 h-10 border-2" onClick={downloadTemplate}>
                <Download className="h-4 w-4" /> Descargar Plantilla (Proforma)
            </Button>
        </div>

        <Card className="w-full max-w-4xl shadow-md">
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center gap-2 uppercase font-black text-primary">
              <Flag className="h-5 w-5" />
              Importar Directorio de Partidos
            </CardTitle>
            <CardDescription>
              Sube un archivo Excel con los nombres, siglas y movimientos internos (Columnas: PARTIDOS_POLITICOS, SIGLAS, MOVIMIENTO POLITICO).
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <label
              htmlFor="partido-upload"
              className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer hover:bg-white transition-all bg-muted/20"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <FileUp className="w-10 h-10 mb-3 text-primary opacity-40" />
                <p className="mb-2 text-sm text-muted-foreground">
                  <span className="font-black uppercase text-primary">Haz clic para subir</span> o arrastra y suelta
                </p>
                <p className="text-xs text-muted-foreground uppercase font-bold">XLSX o CSV oficial</p>
              </div>
              <Input id="partido-upload" type="file" className="hidden" onChange={handleFileChange} accept=".xlsx,.csv" disabled={isParsing || isUploading} />
            </label>
            {fileName && (
              <p className="text-sm text-center font-black text-primary uppercase">
                Archivo detectado: {fileName}
              </p>
            )}
          </CardContent>
        </Card>

        {previewData.length > 0 && (
          <Card className="w-full max-w-5xl animate-in fade-in zoom-in duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm uppercase font-black">
                <TableIcon className="h-4 w-4 text-primary" />
                Vista Previa de Organizaciones ({previewData.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-auto border rounded-lg">
                <Table>
                  <TableHeader className="bg-muted sticky top-0">
                    <TableRow>
                      <TableHead className="uppercase font-black text-[10px]">Partido / Organización</TableHead>
                      <TableHead className="uppercase font-black text-[10px]">Siglas</TableHead>
                      <TableHead className="uppercase font-black text-[10px]">Movimiento Político</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-xs font-bold uppercase">{row.nombre}</TableCell>
                        <TableCell className="text-xs font-black text-primary">{row.siglas}</TableCell>
                        <TableCell className="text-xs font-medium text-muted-foreground uppercase italic">{row.movimiento || '---'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button
                onClick={handleSaveData}
                className="w-full mt-6 h-12 font-black uppercase shadow-lg"
                disabled={isUploading}
              >
                {isUploading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                Guardar Directorio Actualizado
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
