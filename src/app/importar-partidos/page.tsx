'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { FileUp, Loader2, CheckCircle2, TableIcon, Flag, Download, Trash2, X, Scale, Archive, Sparkles } from 'lucide-react';
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
import { type PartidoPolitico, LISTAS_CONSEJO_MAGISTRATURA } from '@/lib/data';
import { useFirebase } from '@/firebase';
import { collection, doc, writeBatch, getDocs } from 'firebase/firestore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export default function ImportarPartidosPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [previewData, setPreviewData] = useState<Omit<PartidoPolitico, 'id'>[]>([]);
  const [detectedType, setDetectedType] = useState<'consejo' | 'partidos'>('consejo');
  const { toast } = useToast();

  const { firestore } = useFirebase();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'text/csv' ||
        file.name.endsWith('.csv') ||
        file.name.endsWith('.xlsx')
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

        const listaHeader = findHeader([
          'LISTA', 'NOMBRE_LISTA', 'NOMBRE', 'PARTIDOS_POLITICOS', 'PARTIDO', 'MOVIMIENTO', 'ORGANIZACION'
        ]);
        const numeroListaHeader = findHeader([
          'NUMERO_LISTA', 'NUMERO', 'LISTA_NUMERO', 'NRO_LISTA', 'NRO'
        ]);
        const estamentoHeader = findHeader([
          'ESTAMENTO', 'GREMIO', 'SECTOR', 'MOVIMIENTO POLITICO', 'MOVIMIENTO', 'INTERNO'
        ]);
        const siglasHeader = findHeader(['SIGLAS', 'SIGLA']);
        const candidatosHeader = findHeader([
          'CANDIDATOS', 'TITULARES', 'POSTULANTES', 'CANDIDATO'
        ]);

        if (!listaHeader) {
          throw new Error('No se encontró una columna de nombre de lista o partido (ej: "LISTA", "NOMBRE" o "PARTIDOS_POLITICOS").');
        }

        const isConsejoFormat = !!(numeroListaHeader || estamentoHeader || candidatosHeader);
        setDetectedType(isConsejoFormat ? 'consejo' : 'partidos');

        const parsedData: Omit<PartidoPolitico, 'id'>[] = json.map((row) => {
          const nombreVal = String(row[listaHeader] || '').trim().toUpperCase();
          const numVal = numeroListaHeader ? String(row[numeroListaHeader] || '').trim().toUpperCase() : '';
          const estamentoVal = estamentoHeader ? String(row[estamentoHeader] || '').trim().toUpperCase() : '';
          const siglasVal = siglasHeader ? String(row[siglasHeader] || '').trim().toUpperCase() : numVal;
          const candidatosVal = candidatosHeader ? String(row[candidatosHeader] || '').trim().toUpperCase() : '';

          return {
            nombre: nombreVal,
            numero_lista: numVal,
            estamento: estamentoVal || 'GENERAL',
            siglas: siglasVal || numVal,
            movimiento: estamentoVal,
            candidatos: candidatosVal,
          };
        }).filter(p => p.nombre !== "");

        if (parsedData.length === 0) {
          throw new Error("No se detectaron registros válidos en el archivo.");
        }

        setPreviewData(parsedData);
        toast({
          title: 'Vista previa generada',
          description: `Se han detectado ${parsedData.length} listas/organizaciones listas para importar.`,
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

  const handleArchivePartidosPrevios = async () => {
    if (!firestore) return;
    setIsArchiving(true);
    try {
      const snap = await getDocs(collection(firestore, 'partidos-politicos'));
      if (snap.empty) {
        toast({ title: 'Sin registros', description: 'La colección activa de partidos ya se encuentra limpia.' });
        return;
      }

      const batch = writeBatch(firestore);
      snap.docs.forEach(d => {
        batch.set(doc(firestore, 'partidos-politicos_generales_2026', d.id), d.data());
        batch.delete(d.ref);
      });
      await batch.commit();

      toast({
        title: 'Partidos Previos Archivados',
        description: `Se archivaron ${snap.docs.length} organizaciones a "partidos-politicos_generales_2026". Base lista para las listas del Consejo.`,
        action: <CheckCircle2 className="text-emerald-500" />
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error al archivar', description: e.message });
    } finally {
      setIsArchiving(false);
    }
  };

  const handleLoadOfficial4Lists = async () => {
    if (!firestore) return;
    setIsUploading(true);
    try {
      // 1. Archivar previos a generales_2026 si aún existen
      const snap = await getDocs(collection(firestore, 'partidos-politicos'));
      const batch = writeBatch(firestore);
      if (!snap.empty) {
        snap.docs.forEach(d => {
          batch.set(doc(firestore, 'partidos-politicos_generales_2026', d.id), d.data());
          batch.delete(d.ref);
        });
      }

      // 2. Insertar exactamente las 4 listas oficiales
      const colRef = collection(firestore, 'partidos-politicos');
      LISTAS_CONSEJO_MAGISTRATURA.forEach(lista => {
        const docRef = doc(colRef, lista.id);
        batch.set(docRef, {
          nombre: lista.nombre,
          siglas: lista.siglas,
          numero_lista: lista.numero_lista,
          estamento: lista.estamento,
          movimiento: '',
          candidatos: ''
        });
      });

      await batch.commit();

      toast({
        title: '4 Listas Oficiales Registradas',
        description: 'Se han guardado Lista A, Lista B, Lista J y Lista S como listas oficiales del Consejo de la Magistratura.',
        action: <CheckCircle2 className="text-emerald-500" />
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error al registrar listas', description: e.message });
    } finally {
      setIsUploading(false);
    }
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
        await delay(300);
      }

      toast({
        title: 'Carga Completada Exitosamente',
        description: `Se han guardado ${previewData.length} registros en el directorio activo para las Elecciones del Consejo de la Magistratura.`,
        action: <CheckCircle2 className="text-green-500" />,
      });
      setPreviewData([]);
      setFileName(null);
    } catch (error: any) {
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

  const downloadTemplateConsejo = () => {
    const headers = "LISTA,NUMERO_LISTA,ESTAMENTO,SIGLAS,CANDIDATOS\n";
    const example = "MOVIMIENTO GREMIAL RENOVACION,LISTA 1,ABOGADOS,MGR,DR. JUAN PEREZ / DRA. MARIA GOMEZ\nDOCENTES UNIDOS POR EL DERECHO,LISTA 2,DOCENTES,DUD,DR. CARLOS LOPEZ / DRA. ANA RUIZ";
    const blob = new Blob([headers + example], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "plantilla_listas_consejo_magistratura.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadTemplateTradicional = () => {
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
      <Header title="Directorio de Listas y Organizaciones" />
      <main className="flex flex-1 flex-col items-center p-4 md:p-8 gap-8 max-w-6xl mx-auto w-full">
        
        {/* Cabecera de Página */}
        <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-emerald-600 text-white font-black text-[9px] uppercase tracking-widest">
                  <Scale className="h-3 w-3 mr-1" /> CONSEJO DE LA MAGISTRATURA
                </Badge>
              </div>
              <h1 className="text-2xl md:text-3xl font-black uppercase text-primary tracking-tight">
                Carga de Listas Inscriptas
              </h1>
              <p className="text-xs text-muted-foreground uppercase font-bold mt-1">
                Importación y gestión del directorio de listas gremiales (Abogados y Docentes).
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                className="font-black uppercase text-[10px] gap-2 h-11 border-2 bg-white border-emerald-600 text-emerald-800 hover:bg-emerald-50" 
                onClick={downloadTemplateConsejo}
              >
                  <Download className="h-4 w-4 text-emerald-600" /> Plantilla Listas Consejo
              </Button>
              <Button 
                variant="outline" 
                className="font-black uppercase text-[10px] gap-2 h-11 border-2 bg-white text-muted-foreground" 
                onClick={downloadTemplateTradicional}
              >
                  <Download className="h-4 w-4" /> Plantilla Tradicional
              </Button>
            </div>
        </div>

        {/* Tarjeta de Respaldo / Archivo Previo */}
        <Card className="w-full border-2 border-dashed border-indigo-200 bg-gradient-to-r from-indigo-50/60 to-white rounded-[2rem] p-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1 max-w-2xl">
              <div className="flex items-center gap-2">
                <Archive className="h-4 w-4 text-indigo-700" />
                <h3 className="text-xs font-black uppercase text-indigo-950 tracking-wider">
                  ¿Aún tienes partidos de las elecciones anteriores?
                </h3>
              </div>
              <p className="text-[11px] font-medium text-indigo-900/80">
                Puedes respaldar los partidos tradicionales a <span className="font-black text-indigo-700">partidos-politicos_generales_2026</span> con un clic para dejar la lista limpia antes de importar las nuevas listas del Consejo.
              </p>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="font-black uppercase text-[10px] border-2 border-indigo-300 text-indigo-900 hover:bg-indigo-100 h-10 px-4 rounded-xl shrink-0 gap-2"
                  disabled={isArchiving}
                >
                  {isArchiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4 text-indigo-700" />}
                  Archivar Partidos a Generales 2026
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-black uppercase text-indigo-700 flex items-center gap-2">
                    <Archive className="h-6 w-6" /> ¿ARCHIVAR PARTIDOS PREVIOS A GENERALES 2026?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-xs font-bold uppercase leading-relaxed text-foreground/80">
                    Se moverán todos los partidos existentes a la colección histórica <span className="text-indigo-600 font-black">partidos-politicos_generales_2026</span>. La colección activa quedará libre para recibir únicamente las listas del Consejo de la Magistratura.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-8 gap-4">
                  <AlertDialogCancel className="h-14 rounded-xl font-black uppercase text-[10px] border-2">CANCELAR</AlertDialogCancel>
                  <AlertDialogAction onClick={handleArchivePartidosPrevios} className="h-14 flex-1 bg-indigo-700 text-white hover:bg-indigo-800 font-black uppercase text-[10px]">
                    CONFIRMAR ARCHIVADO
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </Card>

        {/* Tarjeta de las 4 Listas Oficiales */}
        <Card className="w-full border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-50/50 via-white to-slate-50 rounded-[2rem] p-6 sm:p-8 shadow-xl overflow-hidden relative">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-600 text-white font-black text-[10px] uppercase tracking-wider px-3 py-1">
                  <Scale className="h-3.5 w-3.5 mr-1.5" /> 4 LISTAS OFICIALES INSCRIPTAS
                </Badge>
                <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">
                  CONSEJO DE LA MAGISTRATURA
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-slate-900 tracking-tight">
                Listas Habilitadas para Pugnar en las Elecciones
              </h2>
              <p className="text-xs text-muted-foreground uppercase font-bold">
                Estas son las únicas 4 listas oficiales para el gremio, sin movimientos internos:
              </p>

              {/* Grid de las 4 listas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {LISTAS_CONSEJO_MAGISTRATURA.map(lista => (
                  <div key={lista.id} className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border-2 border-emerald-100 shadow-sm">
                    <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shrink-0">
                      {lista.siglas.replace('LISTA ', '')}
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-xs uppercase text-slate-900 truncate">
                        {lista.nombre}
                      </p>
                      <p className="text-[9px] font-bold text-emerald-700 uppercase">
                        {lista.siglas} • Sin movimientos internos
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-full lg:w-auto shrink-0 flex flex-col gap-3">
              <Button
                onClick={handleLoadOfficial4Lists}
                disabled={isUploading}
                className="h-16 px-8 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-black uppercase text-xs tracking-wider shadow-xl flex items-center gap-3 cursor-pointer"
              >
                {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                HABILITAR ESTAS 4 LISTAS EN FIRESTORE
              </Button>
              <p className="text-[9px] font-bold text-center text-muted-foreground uppercase">
                Registra Lista A, B, J y S como únicas opciones en el sistema
              </p>
            </div>
          </div>
        </Card>

        {/* Zona de Carga de Archivo */}
        <Card className="w-full shadow-xl border-none rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="bg-primary/5 border-b py-6 px-8">
            <CardTitle className="flex items-center gap-3 uppercase font-black text-primary text-sm tracking-widest">
              <Flag className="h-5 w-5" />
              SUBIR ARCHIVO EXCEL DE LISTAS / ORGANIZACIONES
            </CardTitle>
            <CardDescription className="text-xs font-medium uppercase mt-1">
              Admite columnas para listas gremiales: <span className="font-black text-primary">LISTA, NUMERO_LISTA, ESTAMENTO (Abogados/Docentes), SIGLAS, CANDIDATOS</span> o formato tradicional.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-8 pb-8 px-8">
            {!fileName ? (
                <label
                    htmlFor="partido-upload"
                    className="flex flex-col items-center justify-center w-full h-52 border-4 border-dashed rounded-[2rem] cursor-pointer hover:bg-muted/5 transition-all bg-muted/5 group"
                >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <div className="h-16 w-16 rounded-full bg-primary/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <FileUp className="w-8 h-8 text-primary opacity-40" />
                        </div>
                        <p className="mb-2 text-sm text-muted-foreground">
                            <span className="font-black uppercase text-primary">Haz clic para subir</span> o arrastra tu archivo aquí
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">XLSX o CSV OFICIAL</p>
                    </div>
                    <Input id="partido-upload" type="file" className="hidden" onChange={handleFileChange} accept=".xlsx,.csv" disabled={isParsing || isUploading} />
                </label>
            ) : (
                <div className="flex flex-col items-center justify-center p-8 bg-green-50 border-2 border-green-200 rounded-[2rem] animate-in zoom-in duration-300">
                    <CheckCircle2 className="h-12 w-12 text-green-600 mb-2" />
                    <p className="font-black text-primary uppercase text-sm">{fileName}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className="bg-emerald-600 font-black text-[9px] uppercase">
                        {detectedType === 'consejo' ? "Formato: Listas Consejo de la Magistratura" : "Formato: Directorio Tradicional"}
                      </Badge>
                    </div>
                    <Button variant="ghost" className="mt-4 text-destructive font-black uppercase text-[10px] gap-2 hover:bg-destructive/10" onClick={clearSelection} disabled={isUploading}>
                        <X className="h-4 w-4" /> CAMBIAR ARCHIVO
                    </Button>
                </div>
            )}

            {(isParsing || isUploading) && (
              <div className="mt-8 space-y-4 flex flex-col items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-[10px] font-black uppercase text-center tracking-widest">
                  {isUploading ? 'Guardando listas en la nube...' : 'Analizando celdas del archivo...'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vista Previa de Datos */}
        {previewData.length > 0 && !isUploading && (
          <Card className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-2xl border-none rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="bg-slate-900 text-white flex flex-row items-center justify-between py-5 px-8">
              <div className="flex items-center gap-3">
                <TableIcon className="h-5 w-5 text-emerald-400" />
                <div>
                  <CardTitle className="text-xs uppercase font-black tracking-[0.2em]">
                      VISTA PREVIA ({previewData.length} REGISTROS DETECTADOS)
                  </CardTitle>
                  <p className="text-[9px] text-white/70 font-bold uppercase mt-0.5">
                    Verifique que los nombres de listas, números y estamentos sean correctos antes de confirmar.
                  </p>
                </div>
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
                      <TableHead className="uppercase font-black text-[10px] px-8">Lista / Movimiento Gremial</TableHead>
                      <TableHead className="uppercase font-black text-[10px]">N° Lista / Siglas</TableHead>
                      <TableHead className="uppercase font-black text-[10px]">Estamento / Sector</TableHead>
                      <TableHead className="uppercase font-black text-[10px]">Candidatos / Titulares</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, index) => (
                      <TableRow key={index} className="hover:bg-muted/30 transition-colors border-b last:border-0">
                        <TableCell className="text-[11px] font-black uppercase px-8 py-4 text-primary leading-tight">
                          {row.nombre}
                        </TableCell>
                        <TableCell className="text-[11px] font-black text-emerald-700">
                          {row.numero_lista || row.siglas || '---'}
                        </TableCell>
                        <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">
                          <Badge variant="outline" className="text-[9px] font-black uppercase">
                            {row.estamento || row.movimiento || 'GENERAL'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[10px] font-medium text-muted-foreground uppercase italic max-w-xs truncate">
                          {row.candidatos || '---'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/20 p-8 border-t flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="text-[11px] font-bold uppercase text-muted-foreground">
                  Total a importar: <span className="font-black text-primary">{previewData.length} listas</span>
                </div>
                <Button
                    onClick={handleSaveData}
                    className="w-full sm:w-auto h-14 px-10 font-black uppercase text-sm shadow-2xl bg-emerald-700 hover:bg-emerald-800 tracking-wider rounded-xl text-white gap-2"
                    disabled={isUploading}
                >
                    {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                    CONFIRMAR Y GUARDAR LISTAS DEL CONSEJO
                </Button>
            </CardFooter>
          </Card>
        )}
      </main>
    </div>
  );
}
