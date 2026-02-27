
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { FileUp, Loader2, CheckCircle2, Database, Cpu, Search, Trash, AlertTriangle, TableIcon, Plus, Trash2, X } from 'lucide-react';
import Header from '@/components/header';
import * as XLSX from 'xlsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type Dato, type Department, type District, type MaquinaVotacion } from '@/lib/data';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirebase, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, writeBatch, addDoc, deleteDoc } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
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

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export default function SettingsPage() {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { user: currentUser, isUserLoading } = useUser();

  const [fileNameGeo, setFileNameGeo] = useState<string | null>(null);
  const [isParsingGeo, setIsParsingGeo] = useState(false);
  const [isUploadingGeo, setIsUploadingGeo] = useState(false);
  const [previewGeo, setPreviewGeo] = useState<Dato[]>([]);

  const [manualGeo, setManualGeo] = useState({
    departamento: '',
    departamento_codigo: '',
    distrito: '',
    distrito_codigo: ''
  });

  const [fileNameMaq, setFileNameMaq] = useState<string | null>(null);
  const [isParsingMaq, setIsParsingMaq] = useState(false);
  const [isUploadingMaq, setIsUploadingMaq] = useState(false);
  const [previewMaq, setPreviewMaq] = useState<Omit<MaquinaVotacion, 'id' | 'fecha_registro'>[]>([]);

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: rawDatosData, isLoading: isLoadingDatos } = useCollection<Dato>(datosQuery);

  const maquinasQuery = useMemoFirebase(() => firestore ? collection(firestore, 'maquinas') : null, [firestore]);
  const { data: rawMaquinasData, isLoading: isLoadingMaquinas } = useCollection<MaquinaVotacion>(maquinasQuery);

  const datosData = useMemo(() => {
    if (!rawDatosData) return [];
    return [...rawDatosData].sort((a, b) => a.departamento.localeCompare(b.departamento) || a.distrito.localeCompare(b.distrito));
  }, [rawDatosData]);

  const maquinasData = useMemo(() => {
    if (!rawMaquinasData) return [];
    return [...rawMaquinasData].sort((a, b) => a.departamento.localeCompare(b.departamento) || a.distrito.localeCompare(b.distrito));
  }, [rawMaquinasData]);

  const departmentsWithDistricts = useMemo(() => {
    if (!datosData) return [];
    const deptsMap: Map<string, Department & { districts: (District & { distrito_codigo?: string })[] }> = new Map();
    datosData.forEach((dato) => {
      if (!deptsMap.has(dato.departamento)) {
        deptsMap.set(dato.departamento, { id: dato.departamento, name: dato.departamento, districts: [] });
      }
      const dept = deptsMap.get(dato.departamento);
      if (dept && !dept.districts.some(d => d.id === dato.id)) {
        dept.districts.push({ 
            id: dato.id!, 
            departmentId: dato.departamento, 
            name: dato.distrito,
            distrito_codigo: dato.distrito_codigo 
        });
      }
    });
    return Array.from(deptsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [datosData]);

  const [maqSearch, setMaqSearch] = useState('');
  const filteredMaquinas = useMemo(() => {
    if (!maquinasData) return [];
    const term = maqSearch.toLowerCase().trim();
    return maquinasData.filter(m => 
      m.codigo.toLowerCase().includes(term) || 
      m.departamento.toLowerCase().includes(term) || 
      m.distrito.toLowerCase().includes(term)
    );
  }, [maquinasData, maqSearch]);

  const handleGeoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsingGeo(true);
    setFileNameGeo(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(sheet);
        setPreviewGeo(json.map((row: any) => ({
          departamento: String(row.DEPARTAMENTO || row.departamento || '').trim().toUpperCase(),
          distrito: String(row.DISTRITO || row.distrito || '').trim().toUpperCase(),
          departamento_codigo: String(row.DEPARTAMENTO_CODIGO || row.codigo_dpto || '').trim(),
          distrito_codigo: String(row.DISTRITO_CODIGO || row.codigo_dist || '').trim(),
        })).filter(d => d.departamento && d.distrito));
      } catch (err) { 
        toast({ variant: 'destructive', title: 'Error al procesar archivo' }); 
      } finally { 
        setIsParsingGeo(false); 
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleManualSaveGeo = async () => {
    if (!firestore || !manualGeo.departamento || !manualGeo.distrito) {
      toast({ variant: 'destructive', title: 'Faltan datos obligatorios' });
      return;
    }
    setIsUploadingGeo(true);
    try {
      const docData = {
        departamento: manualGeo.departamento.toUpperCase().trim(),
        departamento_codigo: manualGeo.departamento_codigo.trim(),
        distrito: manualGeo.distrito.toUpperCase().trim(),
        distrito_codigo: manualGeo.distrito_codigo.trim()
      };
      await addDoc(collection(firestore, 'datos'), docData);
      toast({ title: 'Ubicación agregada con éxito' });
      setManualGeo({ departamento: '', departamento_codigo: '', distrito: '', distrito_codigo: '' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error al guardar' });
    } finally {
      setIsUploadingGeo(false);
    }
  };

  const handleDeleteDato = (id: string) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'datos', id);
    deleteDoc(docRef)
      .then(() => toast({ title: "Registro eliminado" }))
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' }));
      });
  };

  const handleMaqFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsingMaq(true);
    setFileNameMaq(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(sheet);
        setPreviewMaq(json.map((row: any) => ({
          codigo: String(row.CODIGO || row.codigo || row.NRO_SERIE || '').trim().toUpperCase(),
          departamento: String(row.DEPARTAMENTO || row.departamento || '').trim().toUpperCase(),
          distrito: String(row.DISTRITO || row.distrito || '').trim().toUpperCase(),
        })).filter(m => m.codigo && m.departamento && m.distrito));
      } catch (err) { 
        toast({ variant: 'destructive', title: 'Error al procesar archivo' }); 
      } finally { 
        setIsParsingMaq(false); 
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveGeo = async () => {
    if (!firestore || previewGeo.length === 0) return;
    setIsUploadingGeo(true);
    try {
      const BATCH_SIZE = 100;
      for (let i = 0; i < previewGeo.length; i += BATCH_SIZE) {
        const batch = writeBatch(firestore);
        previewGeo.slice(i, i + BATCH_SIZE).forEach(item => {
          const newDoc = doc(collection(firestore, 'datos'));
          batch.set(newDoc, item);
        });
        await batch.commit(); 
        await delay(300);
      }
      toast({ title: 'Geografía Actualizada', description: `${previewGeo.length} registros cargados.` }); 
      setPreviewGeo([]); 
      setFileNameGeo(null);
    } catch (err) { 
      toast({ variant: 'destructive', title: 'Error al guardar' }); 
    } finally { 
      setIsUploadingGeo(false); 
    }
  };

  const handleSaveMaquinas = async () => {
    if (!firestore || previewMaq.length === 0) return;
    setIsUploadingMaq(true);
    try {
      const BATCH_SIZE = 100;
      for (let i = 0; i < previewMaq.length; i += BATCH_SIZE) {
        const batch = writeBatch(firestore);
        previewMaq.slice(i, i + BATCH_SIZE).forEach(item => {
          const newDoc = doc(collection(firestore, 'maquinas'));
          batch.set(newDoc, {
            ...item,
            fecha_registro: new Date().toISOString()
          });
        });
        await batch.commit(); 
        await delay(300);
      }
      toast({ title: 'Inventario Actualizado', description: `${previewMaq.length} máquinas registradas.` }); 
      setPreviewMaq([]); 
      setFileNameMaq(null);
    } catch (err) { 
      toast({ variant: 'destructive', title: 'Error al guardar inventario' }); 
    } finally { 
      setIsUploadingMaq(false); 
    }
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  const isAdmin = currentUser?.profile?.role === 'admin';

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col bg-muted/10">
        <Header title="Configuración" />
        <main className="flex-1 p-8 flex items-center justify-center">
          <Card className="max-w-md w-full text-center p-8 border-dashed">
            <AlertTriangle className="h-16 w-16 mx-auto text-muted-foreground opacity-20 mb-4" />
            <h2 className="text-xl font-black uppercase text-primary mb-2">Acceso Restringido</h2>
            <p className="text-xs text-muted-foreground font-bold uppercase">Solo los administradores nacionales pueden gestionar la configuración maestra.</p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/5">
      <Header title="Configuración del Sistema" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        <div className="mb-4">
            <h1 className="text-3xl font-black uppercase text-primary">Configuración Maestra</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase mt-1">Gestión de estructura geográfica e inventario técnico.</p>
        </div>

        <Tabs defaultValue="geografia" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px] bg-white border shadow-sm h-auto p-1">
            <TabsTrigger value="geografia" className="gap-2 font-black uppercase text-[10px] py-2">
                <Database className="h-3.5 w-3.5" /> Geografía
            </TabsTrigger>
            <TabsTrigger value="maquinas" className="gap-2 font-black uppercase text-[10px] py-2">
                <Cpu className="h-3.5 w-3.5" /> Inventario Máquinas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="geografia" className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4 space-y-6">
                    {/* Registro Manual */}
                    <Card className="shadow-lg border-t-4 border-t-black">
                        <CardHeader className="bg-muted/10 border-b">
                            <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
                                <Plus className="h-4 w-4" /> Registro Manual
                            </CardTitle>
                            <CardDescription className="text-[10px] uppercase font-bold">Agregue una ubicación individual.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-2 space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Departamento</Label>
                                    <Input 
                                        value={manualGeo.departamento} 
                                        onChange={e => setManualGeo({...manualGeo, departamento: e.target.value})} 
                                        placeholder="Ej: CAAGUAZU" 
                                        className="h-10 font-bold uppercase border-2 text-xs"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Cód.</Label>
                                    <Input 
                                        value={manualGeo.departamento_codigo} 
                                        onChange={e => setManualGeo({...manualGeo, departamento_codigo: e.target.value})} 
                                        placeholder="05" 
                                        className="h-10 font-bold border-2 text-xs text-center"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-2 space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Distrito / Oficina</Label>
                                    <Input 
                                        value={manualGeo.distrito} 
                                        onChange={e => setManualGeo({...manualGeo, distrito: e.target.value})} 
                                        placeholder="Ej: CORONEL OVIEDO" 
                                        className="h-10 font-bold uppercase border-2 text-xs"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Cód.</Label>
                                    <Input 
                                        value={manualGeo.distrito_codigo} 
                                        onChange={e => setManualGeo({...manualGeo, distrito_codigo: e.target.value})} 
                                        placeholder="01" 
                                        className="h-10 font-bold border-2 text-xs text-center"
                                    />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/10 border-t p-4">
                            <Button className="w-full font-black uppercase text-[10px] h-11" onClick={handleManualSaveGeo} disabled={isUploadingGeo || !manualGeo.departamento || !manualGeo.distrito}>
                                {isUploadingGeo ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                                AGREGAR UBICACIÓN
                            </Button>
                        </CardFooter>
                    </Card>

                    {/* Importar Excel */}
                    <Card className="shadow-lg border-dashed">
                        <CardHeader className="bg-primary/5 border-b">
                            <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
                                <FileUp className="h-4 w-4" /> Importar Estructura
                            </CardTitle>
                            <CardDescription className="text-[10px] uppercase font-bold">Suba el archivo Excel oficial.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="border-2 border-dashed rounded-xl p-8 bg-muted/30 text-center hover:bg-white transition-all">
                                <label htmlFor="geo-up" className="cursor-pointer flex flex-col items-center">
                                    <FileUp className="h-10 w-10 mb-2 text-primary opacity-40" />
                                    <span className="text-[10px] font-black uppercase text-primary">Seleccionar Excel</span>
                                </label>
                                <Input id="geo-up" type="file" className="hidden" accept=".xlsx,.csv" onChange={handleGeoFile} disabled={isParsingGeo || isUploadingGeo} />
                                {fileNameGeo && <p className="mt-4 text-[10px] font-black uppercase text-green-600 flex items-center justify-center gap-1"><CheckCircle2 className="h-3 w-3"/> {fileNameGeo}</p>}
                            </div>
                            {previewGeo.length > 0 && (
                                <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/10">
                                    <p className="text-[10px] font-black uppercase text-primary">Registros detectados: {previewGeo.length}</p>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="bg-muted/30 border-t p-4">
                            <Button className="w-full font-black uppercase text-[10px] h-11" onClick={handleSaveGeo} disabled={previewGeo.length === 0 || isUploadingGeo}>
                                {isUploadingGeo ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Database className="mr-2 h-4 w-4" />}
                                GUARDAR LOTE EXCEL
                            </Button>
                        </CardFooter>
                    </Card>
                </div>

                <div className="lg:col-span-8">
                    <Card className="shadow-lg border-none overflow-hidden h-full">
                        <CardHeader className="bg-muted/30 border-b">
                            <CardTitle className="text-xs font-black uppercase tracking-widest">Estructura Geográfica Actual</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[600px]">
                                <Accordion type="single" collapsible className="w-full">
                                    {departmentsWithDistricts.map((dept) => (
                                        <AccordionItem key={dept.id} value={dept.id} className="px-6 border-b hover:bg-muted/5 transition-colors">
                                            <AccordionTrigger className="hover:no-underline font-black uppercase text-xs py-4">
                                                <div className="flex items-center gap-3">
                                                    <Badge variant="outline" className="h-6 w-10 justify-center font-black text-primary border-primary/20">{datosData.find(d => d.departamento === dept.name)?.departamento_codigo || '??'}</Badge>
                                                    {dept.name} 
                                                    <span className="ml-2 text-[9px] text-muted-foreground font-bold">({dept.districts.length} REGISTROS)</span>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="pb-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                                                    {dept.districts.map(d => (
                                                        <div key={d.id} className="flex items-center justify-between p-3 rounded-xl bg-primary/[0.03] border-2 border-primary/5 hover:border-primary/20 transition-all group">
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[8px] font-black text-primary/40 uppercase">CÓD: {d.distrito_codigo || '??'}</span>
                                                                </div>
                                                                <span className="text-[10px] font-black uppercase truncate">{d.name}</span>
                                                            </div>
                                                            
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle className="font-black uppercase">¿ELIMINAR UBICACIÓN?</AlertDialogTitle>
                                                                        <AlertDialogDescription className="text-xs uppercase font-bold">
                                                                            Esta acción borrará el registro de {d.name} en el departamento {dept.name}. Esto podría afectar a los selectores de otros módulos.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel className="font-black uppercase text-[10px]">CANCELAR</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleDeleteDato(d.id)} className="bg-destructive text-white font-black uppercase text-[10px]">ELIMINAR REGISTRO</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </div>
                                                    ))}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </div>
          </TabsContent>

          <TabsContent value="maquinas" className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-1 shadow-lg h-fit">
                    <CardHeader className="bg-primary/5 border-b">
                        <CardTitle className="text-xs font-black uppercase">Importar Inventario</CardTitle>
                        <CardDescription className="text-[10px] uppercase font-bold">Cargue el lote de máquinas por jurisdicción.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="border-2 border-dashed rounded-xl p-8 bg-muted/30 text-center hover:bg-white transition-all">
                            <label htmlFor="maq-up" className="cursor-pointer flex flex-col items-center">
                                <FileUp className="h-10 w-10 mb-2 text-primary opacity-40" />
                                <span className="text-[10px] font-black uppercase text-primary">Seleccionar Inventario</span>
                            </label>
                            <Input id="maq-up" type="file" className="hidden" accept=".xlsx,.csv" onChange={handleMaqFile} disabled={isParsingMaq || isUploadingMaq} />
                            {fileNameMaq && <p className="mt-4 text-[10px] font-black uppercase text-green-600 flex items-center justify-center gap-1"><CheckCircle2 className="h-3 w-3"/> {fileNameMaq}</p>}
                        </div>
                        {previewMaq.length > 0 && (
                            <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/10">
                                <p className="text-[10px] font-black uppercase text-primary">Máquinas detectadas: {previewMaq.length}</p>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="bg-muted/30 border-t p-4">
                        <Button className="w-full font-black uppercase" onClick={handleSaveMaquinas} disabled={previewMaq.length === 0 || isUploadingMaq}>
                            {isUploadingMaq ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Cpu className="mr-2 h-4 w-4" />}
                            GUARDAR INVENTARIO
                        </Button>
                    </CardFooter>
                </Card>

                <Card className="lg:col-span-2 shadow-lg overflow-hidden border-none">
                    <CardHeader className="bg-primary text-white flex flex-row items-center justify-between py-4 px-6">
                        <CardTitle className="text-xs font-black uppercase tracking-widest">Listado de Equipos ({filteredMaquinas.length})</CardTitle>
                        <div className="relative w-48">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-white/50" />
                            <Input 
                                placeholder="Buscar código..." 
                                className="h-8 pl-8 text-[10px] bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-white/30" 
                                value={maqSearch} 
                                onChange={e => setMaqSearch(e.target.value)} 
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 bg-white">
                        <ScrollArea className="h-[500px]">
                            <Table>
                                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                    <TableRow>
                                        <TableHead className="text-[10px] font-black uppercase">Nº Serie</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase">Jurisdicción</TableHead>
                                        <TableHead className="text-right text-[10px] font-black uppercase">Estado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoadingMaquinas ? (
                                        <TableRow><TableCell colSpan={3} className="text-center py-10"><Loader2 className="animate-spin h-6 w-6 mx-auto text-primary"/></TableCell></TableRow>
                                    ) : filteredMaquinas.length === 0 ? (
                                        <TableRow><TableCell colSpan={3} className="text-center py-10 text-[10px] font-bold uppercase text-muted-foreground">No hay máquinas registradas.</TableCell></TableRow>
                                    ) : (
                                        filteredMaquinas.map(m => (
                                            <TableRow key={m.id} className="hover:bg-muted/30 transition-colors">
                                                <TableCell className="font-black text-xs text-primary">{m.codigo}</TableCell>
                                                <TableCell className="text-[9px] font-bold uppercase leading-tight">
                                                    {m.departamento}<br/>
                                                    <span className="text-muted-foreground">{m.distrito}</span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Badge className="bg-green-600 text-[8px] font-black uppercase">ACTIVA</Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
