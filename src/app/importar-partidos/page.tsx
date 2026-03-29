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
import { FileUp, Loader2, CheckCircle2, TableIcon, Flag, Download, Trash2, X } from 'lucide-react';
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
            const foundHeader = headers.find(h => h.toLowerCase().trim() === name.toLowerCase());
            if (foundHeader) return foundHeader;
          }
          return null;
        };

        const partidoHeader = findHeader(['PARTIDOS_POLITICOS', 'PARTIDO', 'NOMBRE']);
        const siglasHeader = findHeader(['SIGLAS', 'SIGLA']);
        const movimientoHeader = findHeader(['MOVIMIENTO POLITICO', 'MOVIMIENTO', 'INTERNO']);

        if (!partidoHeader) {
          throw new Error('No se encontró la columna requerida "PARTIDOS_POLITICOS".');
        }

        const parsedData: Omit<PartidoPolitico, 'id'>[] = json.map((row) => ({
          nombre: String(row[partidoHeader] || '').trim().toUpperCase(),
          siglas: String(siglasHeader ? row[siglasHeader] : '').trim().toUpperCase(),
          movimiento: String(movimientoHeader ? row[movimientoHeader] : '').trim().toUpperCase(),
        })).filter(p => p.nombre !== "");

        if (parsedData.length === 0) {
            throw new Error("No se detectaron registros válidos en el archivo.");
        }

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
        description: 'El directorio de partidos y movimientos ha sido actualizado exitosamente.',
        action: <CheckCircle2 className="text-green-500" />,
      });
      setPreviewData([]);
      setFileName(null);
    } catch (error) {
      toast({
        title: 'Error al guardar',
        description: 'No se pudieron guardar los datos en la nube. Verifique sus permisos.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const clearSelection = () => {
    setPreviewData([]);
    setFileName(null);
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
        
        <div className="w-full max-w-4xl flex justify-between items-center">
            <h1 className="text-2xl font-black uppercase text-primary tracking-tight">Carga de Organizaciones</h1>
            <Button variant="outline" className="font-black uppercase text-[10px] gap-2 h-10 border-2 bg-white" onClick={downloadTemplate}>
                <Download className="h-4 w-4" /> Descargar Plantilla Oficial
            </Button>
        </div>

        <Card className="w-full max-w-4xl shadow-xl border-none rounded-[1.5rem] overflow-hidden bg-white">
          <CardHeader className="bg-primary/5 border-b py-6">
            <CardTitle className="flex items-center gap-3 uppercase font-black text-primary text-sm tracking-widest">
              <Flag className="h-5 w-5" />
              IMPORTAR DIRECTORIO DE PARTIDOS
            </CardTitle>
            <CardDescription className="text-xs font-medium uppercase mt-1">
              Suba un archivo Excel con los nombres, siglas y movimientos internos (Columnas: PARTIDOS_POLITICOS, SIGLAS, MOVIMIENTO POLITICO).
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-8 pb-8 px-8">
            {!fileName ? (
                <label
                    htmlFor="partido-upload"
                    className="flex flex-col items-center justify-center w-full h-48 border-4 border-dashed rounded-[2rem] cursor-pointer hover:bg-muted/5 transition-all bg-muted/5 group"
                >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <div className="h-16 w-16 rounded-full bg-primary/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <FileUp className="w-8 h-8 text-primary opacity-40" />
                        </div>
                        <p className="mb-2 text-sm text-muted-foreground">
                            <span className="font-black uppercase text-primary">Haz clic para subir</span> o arrastra y suelta
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">XLSX o CSV OFICIAL</p>
                    </div>
                    <Input id="partido-upload" type="file" className="hidden" onChange={handleFileChange} accept=".xlsx,.csv" disabled={isParsing || isUploading} />
                </label>
            ) : (
                <div className="flex flex-col items-center justify-center p-8 bg-green-50 border-2 border-green-200 rounded-[2rem] animate-in zoom-in duration-300">
                    <CheckCircle2 className="h-12 w-12 text-green-600 mb-2" />
                    <p className="font-black text-primary uppercase text-sm">{fileName}</p>
                    <p className="text-[10px] font-bold text-green-700 uppercase mt-1">Archivo procesado correctamente</p>
                    <Button variant="ghost" className="mt-4 text-destructive font-black uppercase text-[10px] gap-2 hover:bg-destructive/10" onClick={clearSelection} disabled={isUploading}>
                        <X className="h-4 w-4" /> CAMBIAR ARCHIVO
                    </Button>
                </div>
            )}

            {(isParsing || isUploading) && (
              <div className="mt-8 space-y-4 flex flex-col items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-[10px] font-black uppercase text-center tracking-widest">
                  {isUploading ? 'Guardando en la nube...' : 'Analizando celdas del Excel...'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {previewData.length > 0 && !isUploading && (
          <Card className="w-full max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-2xl border-none rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="bg-black text-white flex flex-row items-center justify-between py-5 px-8">
              <div className="flex items-center gap-3">
                <TableIcon className="h-5 w-5 opacity-50" />
                <CardTitle className="text-xs uppercase font-black tracking-[0.2em]">
                    VISTA PREVIA DE IMPORTACIÓN ({previewData.length} REGISTROS)
                </CardTitle>
              </div>
              <Button variant="ghost" size="sm" className="text-white/60 hover:text-white font-black text-[10px] uppercase gap-2" onClick={clearSelection}>
                <Trash2 className="h-4 w-4" /> LIMPIAR
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader className="bg-muted sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="uppercase font-black text-[10px] px-8">Partido / Organización</TableHead>
                      <TableHead className="uppercase font-black text-[10px]">Siglas</TableHead>
                      <TableHead className="uppercase font-black text-[10px]">Movimiento Político</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, index) => (
                      <TableRow key={index} className="hover:bg-muted/30 transition-colors border-b last:border-0">
                        <TableCell className="text-[11px] font-black uppercase px-8 py-4 text-primary leading-tight">{row.nombre}</TableCell>
                        <TableCell className="text-[11px] font-black text-muted-foreground">{row.siglas || '---'}</TableCell>
                        <TableCell className="text-[10px] font-medium text-muted-foreground uppercase italic">{row.movimiento || 'S/M'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/20 p-8 border-t">
                <Button
                    onClick={handleSaveData}
                    className="w-full h-16 font-black uppercase text-lg shadow-2xl bg-black hover:bg-black/90 tracking-widest rounded-xl"
                    disabled={isUploading}
                >
                    {isUploading ? <Loader2 className="mr-3 h-6 w-6 animate-spin" /> : <CheckCircle2 className="mr-3 h-6 w-6" />}
                    CONFIRMAR Y GUARDAR DIRECTORIO
                </Button>
            </CardFooter>
          </Card>
        )}
      </main>
    </div>
  );
}
