
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { FileUp, Loader2, CheckCircle2, TableIcon, Database, PlusCircle, Trash2, Edit, Cpu, Search, Trash } from 'lucide-react';
import Header from '@/components/header';
import * as XLSX from 'xlsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type Dato, type Department, type District, type MaquinaVotacion } from '@/lib/data';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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
} from '@/components/ui/alert-dialog';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { collection, doc, writeBatch, getDocs, deleteDoc, addDoc, updateDoc, where, query, orderBy } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export default function SettingsPage() {
  const { toast } = useToast();
  const { firestore, user: currentUser } = useFirebase();

  // --- TAB 1: GEOGRAFIA ---
  const [fileNameGeo, setFileNameGeo] = useState<string | null>(null);
  const [isParsingGeo, setIsParsingGeo] = useState(false);
  const [isUploadingGeo, setIsUploadingGeo] = useState(false);
  const [previewGeo, setPreviewGeo] = useState<Dato[]>([]);

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollection<Dato>(datosQuery);

  const departmentsWithDistricts = useMemo(() => {
    if (!datosData) return [];
    const deptsMap: Map<string, Department & { districts: District[] }> = new Map();
    datosData.forEach((dato) => {
      if (!deptsMap.has(dato.departamento)) {
        deptsMap.set(dato.departamento, { id: dato.departamento, name: dato.departamento, districts: [] });
      }
      const department = deptsMap.get(dato.departamento);
      if (department && !department.districts.some(d => d.name === dato.distrito)) {
        department.districts.push({ id: dato.id!, departmentId: dato.departamento, name: dato.distrito });
      }
    });
    return Array.from(deptsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [datosData]);

  // --- TAB 2: MAQUINAS ---
  const [fileNameMaq, setFileNameMaq] = useState<string | null>(null);
  const [isParsingMaq, setIsParsingMaq] = useState(false);
  const [isUploadingMaq, setIsUploadingMaq] = useState(false);
  const [previewMaq, setPreviewMaq] = useState<Omit<MaquinaVotacion, 'id'>[]>([]);
  const [maqSearch, setMaqSearch] = useState('');

  const maquinasQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'maquinas'), orderBy('departamento'), orderBy('distrito')) : null, [firestore]);
  const { data: maquinasData, isLoading: isLoadingMaquinas } = useCollection<MaquinaVotacion>(maquinasQuery);

  const filteredMaquinas = useMemo(() => {
    if (!maquinasData) return [];
    const term = maqSearch.toLowerCase();
    return maquinasData.filter(m => 
      m.codigo.toLowerCase().includes(term) || 
      m.departamento.toLowerCase().includes(term) || 
      m.distrito.toLowerCase().includes(term)
    );
  }, [maquinasData, maqSearch]);

  // --- HANDLERS GEOGRAFIA ---
  const handleGeoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsingGeo(true);
    setFileNameGeo(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        const parsed = json.map((row: any) => ({
          departamento: String(row.DEPARTAMENTO || '').trim(),
          distrito: String(row.DISTRITO || '').trim(),
          departamento_codigo: String(row.DEPARTAMENTO_CODIGO || '').trim(),
          distrito_codigo: String(row.DISTRITO_CODIGO || '').trim(),
        })).filter(d => d.departamento && d.distrito);
        setPreviewGeo(parsed);
      } catch (err) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo procesar el archivo.' });
      } finally { setIsParsingGeo(false); }
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveGeo = async () => {
    if (!firestore || previewGeo.length === 0) return;
    setIsUploadingGeo(true);
    const batchSize = 100;
    try {
      for (let i = 0; i < previewGeo.length; i += batchSize) {
        const batch = writeBatch(firestore);
        previewGeo.slice(i, i + batchSize).forEach(item => {
          batch.set(doc(collection(firestore, 'datos')), item);
        });
        await batch.commit();
        await delay(1000);
      }
      toast({ title: '¡Éxito!', description: 'Departamentos y distritos importados.' });
      setPreviewGeo([]);
      setFileNameGeo(null);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo completar la importación.' });
    } finally { setIsUploadingGeo(false); }
  };

  // --- HANDLERS MAQUINAS ---
  const handleMaqFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsingMaq(true);
    setFileNameMaq(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        const parsed = json.map((row: any) => ({
          codigo: String(row.CODIGO || row.SERIAL || row.MAQUINA || '').trim(),
          departamento: String(row.DEPARTAMENTO || '').trim(),
          distrito: String(row.DISTRITO || '').trim(),
          fecha_registro: new Date().toISOString()
        })).filter(m => m.codigo && m.departamento && m.distrito);
        setPreviewMaq(parsed);
      } catch (err) {
        toast({ variant: 'destructive', title: 'Error', description: 'Error al procesar archivo de máquinas.' });
      } finally { setIsParsingMaq(false); }
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveMaq = async () => {
    if (!firestore || previewMaq.length === 0) return;
    setIsUploadingMaq(true);
    const batchSize = 100;
    try {
      for (let i = 0; i < previewMaq.length; i += batchSize) {
        const batch = writeBatch(firestore);
        previewMaq.slice(i, i + batchSize).forEach(item => {
          batch.set(doc(collection(firestore, 'maquinas')), item);
        });
        await batch.commit();
        await delay(500);
      }
      toast({ title: 'Inventario Actualizado', description: 'Se han cargado los códigos de máquinas.' });
      setPreviewMaq([]);
      setFileNameMaq(null);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Error al guardar el inventario.' });
    } finally { setIsUploadingMaq(false); }
  };

  const handleDeleteMaquina = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'maquinas', id));
      toast({ title: 'Máquina eliminada' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error' });
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/5">
      <Header title="Configuración del Sistema" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        
        <Tabs defaultValue="geografia" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="geografia" className="gap-2"><Database className="h-4 w-4" /> Geografía</TabsTrigger>
            <TabsTrigger value="maquinas" className="gap-2"><Cpu className="h-4 w-4" /> Inventario Máquinas</TabsTrigger>
          </TabsList>

          {/* TAB: GEOGRAFIA */}
          <TabsContent value="geografia" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-primary flex items-center gap-2">
                  <Database className="h-5 w-5" /> Importar Estructura Geográfica
                </CardTitle>
                <CardDescription>Cargue los departamentos y distritos oficiales desde Excel (Columnas: DEPARTAMENTO, DISTRITO).</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 bg-muted/30">
                  <label htmlFor="geo-up" className="cursor-pointer flex flex-col items-center">
                    <FileUp className="h-10 w-10 text-muted-foreground mb-2" />
                    <span className="text-sm font-bold uppercase text-muted-foreground">Seleccionar Excel Geográfico</span>
                    <Input id="geo-up" type="file" className="hidden" accept=".xlsx,.csv" onChange={handleGeoFile} disabled={isParsingGeo || isUploadingGeo} />
                  </label>
                  {fileNameGeo && <p className="mt-2 text-xs font-black text-primary">{fileNameGeo}</p>}
                </div>
                {previewGeo.length > 0 && (
                  <div className="mt-6 border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-muted">
                        <TableRow>
                          <TableHead className="text-[10px] font-black uppercase">Departamento</TableHead>
                          <TableHead className="text-[10px] font-black uppercase">Distrito</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewGeo.slice(0, 10).map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs uppercase">{row.departamento}</TableCell>
                            <TableCell className="text-xs uppercase">{row.distrito}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {previewGeo.length > 10 && <p className="p-2 text-[10px] text-center bg-muted/50 font-bold">Y {previewGeo.length - 10} registros más...</p>}
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button className="w-full font-black uppercase" onClick={handleSaveGeo} disabled={previewGeo.length === 0 || isUploadingGeo}>
                  {isUploadingGeo ? <Loader2 className="animate-spin mr-2" /> : <Database className="mr-2 h-4 w-4" />}
                  Guardar Estructura Geográfica
                </Button>
              </CardFooter>
            </Card>

            {departmentsWithDistricts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Estructura Actual</CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {departmentsWithDistricts.map((dept) => (
                      <AccordionItem key={dept.id} value={dept.id}>
                        <AccordionTrigger className="uppercase font-bold text-sm">{dept.name}</AccordionTrigger>
                        <AccordionContent>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pl-4">
                            {dept.districts.map(dist => (
                              <div key={dist.id} className="text-[10px] font-bold p-2 bg-muted/50 rounded uppercase border border-dashed">
                                {dist.name}
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* TAB: MAQUINAS */}
          <TabsContent value="maquinas" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Importador Máquinas */}
              <Card className="lg:col-span-1 border-primary/20">
                <CardHeader className="bg-primary/5">
                  <CardTitle className="text-primary flex items-center gap-2 text-sm uppercase font-black">
                    <Cpu className="h-4 w-4" /> Cargar Inventario
                  </CardTitle>
                  <CardDescription className="text-[10px] uppercase font-bold">Importe códigos de máquinas por ubicación.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 bg-muted/30 hover:bg-muted/50 transition-colors">
                    <label htmlFor="maq-up" className="cursor-pointer flex flex-col items-center text-center">
                      <FileUp className="h-8 w-8 text-primary mb-2" />
                      <span className="text-[10px] font-black uppercase text-muted-foreground">Archivo Excel Máquinas</span>
                      <span className="text-[8px] text-muted-foreground mt-1">(CODIGO, DEPARTAMENTO, DISTRITO)</span>
                      <Input id="maq-up" type="file" className="hidden" accept=".xlsx,.csv" onChange={handleMaqFile} disabled={isParsingMaq || isUploadingMaq} />
                    </label>
                    {fileNameMaq && <p className="mt-2 text-[10px] font-black text-primary truncate w-full">{fileNameMaq}</p>}
                  </div>
                  
                  {previewMaq.length > 0 && (
                    <div className="space-y-2">
                      <Badge variant="secondary" className="w-full justify-center py-1 text-[10px] font-black uppercase">
                        {previewMaq.length} Equipos Listos
                      </Badge>
                      <Button className="w-full font-black uppercase h-12" onClick={handleSaveMaq} disabled={isUploadingMaq}>
                        {isUploadingMaq ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        PROCESAR INVENTARIO
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Listado de Máquinas */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <CardTitle className="text-sm font-black uppercase tracking-widest">Maquinas Registradas</CardTitle>
                      <CardDescription className="text-[10px] font-bold uppercase">{maquinasData?.length || 0} Equipos en base de datos</CardDescription>
                    </div>
                    <div className="relative w-full md:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input 
                        placeholder="Buscar por código o ubicación..." 
                        className="pl-9 h-9 text-xs" 
                        value={maqSearch}
                        onChange={(e) => setMaqSearch(e.target.value)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingMaquinas ? (
                    <div className="flex justify-center py-10"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="text-[9px] font-black uppercase">Código Máquina</TableHead>
                            <TableHead className="text-[9px] font-black uppercase">Departamento</TableHead>
                            <TableHead className="text-[9px] font-black uppercase">Distrito</TableHead>
                            <TableHead className="text-right text-[9px] font-black uppercase">Acción</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredMaquinas.length > 0 ? (
                            filteredMaquinas.slice(0, 50).map((maq) => (
                              <TableRow key={maq.id} className="group hover:bg-primary/5 transition-colors">
                                <TableCell className="font-black text-xs text-primary">{maq.codigo}</TableCell>
                                <TableCell className="text-[10px] uppercase font-bold">{maq.departamento}</TableCell>
                                <TableCell className="text-[10px] uppercase font-bold">{maq.distrito}</TableCell>
                                <TableCell className="text-right">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleDeleteMaquina(maq.id)}
                                  >
                                    <Trash className="h-3.5 w-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-10 text-muted-foreground text-xs uppercase font-bold">
                                No se encontraron máquinas registradas.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                      {filteredMaquinas.length > 50 && (
                        <div className="p-3 bg-muted/30 text-center text-[10px] font-bold uppercase text-muted-foreground">
                          Mostrando los primeros 50 de {filteredMaquinas.length} resultados. Use el buscador para filtrar.
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          </TabsContent>
        </Tabs>

      </main>
    </div>
  );
}
