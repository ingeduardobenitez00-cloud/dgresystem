
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { FileUp, Loader2, CheckCircle2, Database, Cpu, Search, Trash, AlertTriangle, TableIcon, Plus, Trash2, X, Edit, Rocket, ShieldAlert } from 'lucide-react';
import Header from '@/components/header';
import * as XLSX from 'xlsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type Dato, type Department, type District, type MaquinaVotacion } from '@/lib/data';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirebase, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, writeBatch, addDoc, deleteDoc, updateDoc, getDocs, query, limit } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
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

// Función auxiliar para normalizar encabezados (quitar acentos, espacios y pasar a minúsculas)
const normalizeHeader = (str: string) => 
  str.normalize("NFD")
     .replace(/[\u0300-\u036f]/g, "")
     .toLowerCase()
     .trim();

export default function SettingsPage() {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { user: currentUser, isUserLoading } = useUser();

  const [fileNameGeo, setFileNameGeo] = useState<string | null>(null);
  const [isParsingGeo, setIsParsingGeo] = useState(false);
  const [isUploadingGeo, setIsUploadingGeo] = useState(false);
  const [previewGeo, setPreviewGeo] = useState<Dato[]>([]);

  const [editingDatoId, setEditingDatoId] = useState<string | null>(null);
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

  const [isResetting, setIsResetting] = useState(false);

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
        
        if (json.length === 0) return;
        const headers = Object.keys(json[0]);
        
        const findHeader = (possibleNames: string[]) => {
          const normalizedPossibles = possibleNames.map(normalizeHeader);
          return headers.find(h => normalizedPossibles.includes(normalizeHeader(h)));
        };

        const depKey = findHeader(['DEPARTAMENTO', 'DEPTO', 'DPTO']);
        const distKey = findHeader(['DISTRITO', 'OFICINA', 'LOCALIDAD']);
        const depCodKey = findHeader(['DEPARTAMENTO_CODIGO', 'CODIGO_DPTO', 'COD_DPTO', 'COD_DEPTO']);
        const distCodKey = findHeader(['DISTRITO_CODIGO', 'CODIGO_DIST', 'COD_DIST']);

        const mapped = json.map((row: any) => ({
          departamento: String(depKey ? row[depKey] : '').trim().toUpperCase(),
          distrito: String(distKey ? row[distKey] : '').trim().toUpperCase(),
          departamento_codigo: String(depCodKey ? row[depCodKey] : '').trim(),
          distrito_codigo: String(distCodKey ? row[distCodKey] : '').trim(),
        })).filter(d => d.departamento && d.distrito);

        if (mapped.length === 0) {
            toast({ variant: 'destructive', title: 'Error de formato', description: 'No se encontraron las columnas Departamento y Distrito.' });
        } else {
            setPreviewGeo(mapped);
        }
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

      if (editingDatoId) {
        const docRef = doc(firestore, 'datos', editingDatoId);
        await updateDoc(docRef, docData);
        toast({ title: 'Ubicación actualizada con éxito' });
        setEditingDatoId(null);
      } else {
        await addDoc(collection(firestore, 'datos'), docData);
        toast({ title: 'Ubicación agregada con éxito' });
      }
      
      setManualGeo({ ...manualGeo, distrito: '', distrito_codigo: '' });
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
        
        if (json.length === 0) {
            toast({ variant: 'destructive', title: 'Archivo vacío', description: 'El archivo Excel no contiene datos.' });
            return;
        }

        const headers = Object.keys(json[0]);
        
        const findHeader = (possibleNames: string[]) => {
          const normalizedPossibles = possibleNames.map(normalizeHeader);
          return headers.find(h => normalizedPossibles.includes(normalizeHeader(h)));
        };

        // Búsqueda flexible de encabezados ignorando acentos
        const codKey = findHeader(['CODIGO', 'CÓDIGO', 'NRO_SERIE', 'SERIE', 'SERIAL', 'NRO SERIE', 'NRO. SERIE']);
        const depKey = findHeader(['DEPARTAMENTO', 'DEPTO', 'DPTO']);
        const distKey = findHeader(['DISTRITO', 'OFICINA', 'LOCALIDAD']);

        const mapped = json.map((row: any) => ({
          codigo: String(codKey ? row[codKey] : '').trim().toUpperCase(),
          departamento: String(depKey ? row[depKey] : '').trim().toUpperCase(),
          distrito: String(distKey ? row[distKey] : '').trim().toUpperCase(),
        })).filter(m => m.codigo && m.departamento && m.distrito);

        if (mapped.length === 0) {
            toast({ 
                variant: 'destructive', 
                title: 'No se detectaron columnas', 
                description: 'Verifique que los encabezados del Excel sean: Código, Departamento, Distrito.' 
            });
            setPreviewMaq([]);
        } else {
            setPreviewMaq(mapped);
            toast({ title: "Archivo procesado", description: `Se han detectado ${mapped.length} máquinas listas para importar.` });
        }
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

  const handleResetCIDEE = async () => {
    if (!firestore || !isAdmin) return;
    setIsResetting(true);
    
    const collectionsToClear = [
      'solicitudes-capacitacion',
      'informes-divulgador',
      'informes-semanales-anexo-iv',
      'movimientos-maquinas',
      'denuncias-lacres',
      'encuestas-satisfaccion'
    ];

    try {
      for (const colName of collectionsToClear) {
        let hasMore = true;
        while (hasMore) {
          const q = query(collection(firestore, colName), limit(500));
          const snapshot = await getDocs(q);
          if (snapshot.empty) {
            hasMore = false;
            continue;
          }
          const batch = writeBatch(firestore);
          snapshot.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
          await delay(200);
        }
      }
      toast({ title: 'Reseteo Completado', description: 'El área de transacciones CIDEE ha sido limpiada para producción.' });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error en el reseteo' });
    } finally {
      setIsResetting(false);
    }
  };

  const isAdminView = currentUser?.profile?.role === 'admin';

  if (!isAdminView) {
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
          <TabsList className="grid w-full grid-cols-3 lg:w-[600px] bg-white border shadow-sm h-auto p-1">
            <TabsTrigger value="geografia" className="gap-2 font-black uppercase text-[10px] py-2">
                <Database className="h-3.5 w-3.5" /> Geografía
            </TabsTrigger>
            <TabsTrigger value="maquinas" className="gap-2 font-black uppercase text-[10px] py-2">
                <Cpu className="h-3.5 w-3.5" /> Inventario Máquinas
            </TabsTrigger>
            <TabsTrigger value="produccion" className="gap-2 font-black uppercase text-[10px] py-2">
                <Rocket className="h-3.5 w-3.5" /> Producción
            </TabsTrigger>
          </TabsList>

          <TabsContent value="geografia" className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4 space-y-6">
                    <Card className={cn("shadow-lg border-t-4", editingDatoId ? "border-t-primary" : "border-t-black")}>
                        <CardHeader className="bg-muted/10 border-b flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
                                    {editingDatoId ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                    {editingDatoId ? "Editar Ubicación" : "Registro Manual"}
                                </CardTitle>
                                <CardDescription className="text-[10px] uppercase font-bold">
                                    {editingDatoId ? "Modifique los datos de la oficina." : "Agregue una ubicación individual."}
                                </CardDescription>
                            </div>
                            {editingDatoId && (
                                <Button variant="ghost" size="icon" onClick={() => { setEditingDatoId(null); setManualGeo({departamento: '', departamento_codigo: '', distrito: '', distrito_codigo: ''}); }} className="h-8 w-8 text-muted-foreground"><X className="h-4 w-4" /></Button>
                            )}
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
                                {isUploadingGeo ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : editingDatoId ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                                {editingDatoId ? "ACTUALIZAR UBICACIÓN" : "AGREGAR UBICACIÓN"}
                            </Button>
                        </CardFooter>
                    </Card>

                    {!editingDatoId && (
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
                    )}
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
                                            <div className="flex items-center justify-between">
                                                <AccordionTrigger className="hover:no-underline font-black uppercase text-xs py-4 flex-1">
                                                    <div className="flex items-center gap-3">
                                                        <Badge variant="outline" className="h-6 w-10 justify-center font-black text-primary border-primary/20">{datosData.find(d => d.departamento === dept.name)?.departamento_codigo || '??'}</Badge>
                                                        {dept.name} 
                                                        <span className="ml-2 text-[9px] text-muted-foreground font-bold">({dept.districts.length} REGISTROS)</span>
                                                    </div>
                                                </AccordionTrigger>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-8 px-3 font-black uppercase text-[9px] gap-2 border-primary/20 text-primary hover:bg-primary/5 mr-4"
                                                    onClick={(e) => {
                                                        const firstMatch = datosData.find(d => d.departamento === dept.name);
                                                        setManualGeo({
                                                            departamento: dept.name,
                                                            departamento_codigo: firstMatch?.departamento_codigo || '',
                                                            distrito: '',
                                                            distrito_codigo: ''
                                                        });
                                                        setEditingDatoId(null);
                                                        toast({ title: "Modo Edición", description: `Agregando oficinas a: ${dept.name}` });
                                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }}
                                                >
                                                    <Edit className="h-3.5 w-3.5" /> AGREGAR OFICINAS
                                                </Button>
                                            </div>
                                            <AccordionContent className="pb-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                                                    {dept.districts.map(d => (
                                                        <div key={d.id} className="flex items-start justify-between p-3 rounded-xl bg-primary/[0.03] border-2 border-primary/5 hover:border-primary/20 transition-all group">
                                                            <div className="flex flex-col flex-1 min-w-0 mr-2">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="text-[8px] font-black text-primary/40 uppercase">CÓD: {d.distrito_codigo || '??'}</span>
                                                                </div>
                                                                <span className="text-[10px] font-black uppercase leading-tight break-words">{d.name}</span>
                                                            </div>
                                                            
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-8 w-8 text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    onClick={() => {
                                                                        const dato = datosData.find(dt => dt.id === d.id);
                                                                        if (dato) {
                                                                            setManualGeo({
                                                                                departamento: dato.departamento,
                                                                                departamento_codigo: dato.departamento_codigo || '',
                                                                                distrito: dato.distrito,
                                                                                distrito_codigo: dato.distrito_codigo || ''
                                                                            });
                                                                            setEditingDatoId(d.id);
                                                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                                                        }
                                                                    }}
                                                                >
                                                                    <Edit className="h-4 w-4" />
                                                                </Button>
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
                        <Button className="w-full font-black uppercase h-12 shadow-lg" onClick={handleSaveMaquinas} disabled={previewMaq.length === 0 || isUploadingMaq}>
                            {isUploadingMaq ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Cpu className="mr-2 h-4 w-4" />}
                            GUARDAR INVENTARIO
                        </Button>
                    </CardFooter>
                </Card>

                <Card className="lg:col-span-2 shadow-lg overflow-hidden border-none">
                    <CardHeader className="bg-primary text-white flex flex-row items-center justify-between py-4 px-6">
                        <CardTitle className="text-xs font-black uppercase tracking-widest">Listado de Equipos ({filteredMaquinas.length})</CardTitle>
                        <div className="relative w-48">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 text-white/50" />
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

          <TabsContent value="produccion" className="space-y-6 animate-in fade-in duration-500">
            <Card className="border-none shadow-2xl overflow-hidden rounded-[2.5rem] bg-white">
              <CardHeader className="bg-destructive text-white p-8">
                <CardTitle className="text-xl font-black uppercase flex items-center gap-3">
                  <ShieldAlert className="h-8 w-8" /> RESETEO CIDEE
                </CardTitle>
                <CardDescription className="text-white/80 font-bold uppercase text-[10px] tracking-widest mt-2">
                  ESTA OPERACIÓN ES IRREVERSIBLE - PREPARACIÓN PARA ENTORNO DE PRODUCCIÓN
                </CardDescription>
              </CardHeader>
              <CardContent className="p-10 space-y-8">
                <div className="bg-destructive/5 border-2 border-destructive/20 p-8 rounded-[2rem] space-y-6">
                  <div className="flex items-start gap-4">
                    <AlertTriangle className="h-6 w-6 text-destructive shrink-0 mt-1" />
                    <div className="space-y-4">
                      <p className="font-black uppercase text-sm text-destructive">Advertencia de Seguridad Nacional</p>
                      <p className="text-xs font-bold text-muted-foreground uppercase leading-relaxed">
                        Al confirmar el reseteo, el sistema procederá a la eliminación permanente de:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ul className="space-y-2">
                          <li className="text-[9px] font-black text-destructive/70 flex items-center gap-2">• TODAS LAS SOLICITUDES (ANEXO V)</li>
                          <li className="text-[9px] font-black text-destructive/70 flex items-center gap-2">• TODOS LOS INFORMES INDIVIDUALES (ANEXO III)</li>
                          <li className="text-[9px] font-black text-destructive/70 flex items-center gap-2">• TODOS LOS INFORMES SEMANALES (ANEXO IV)</li>
                        </ul>
                        <ul className="space-y-2">
                          <li className="text-[9px] font-black text-destructive/70 flex items-center gap-2">• TODOS LOS MOVIMIENTOS Y DENUNCIAS</li>
                          <li className="text-[9px] font-black text-destructive/70 flex items-center gap-2">• TODAS LAS ENCUESTAS DE SATISFACCIÓN</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center p-8 text-center space-y-6">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] max-w-lg">
                    USE ESTA FUNCIÓN ÚNICAMENTE PARA LIMPIAR LOS DATOS DE PRUEBA ANTES DE LA SALIDA OFICIAL A PRODUCCIÓN. EL DIRECTORIO DE DIVULGADORES Y LA GEOGRAFÍA NO SE BORRARÁN.
                  </p>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="h-20 px-12 text-xl font-black uppercase rounded-[1.5rem] shadow-2xl bg-destructive hover:bg-destructive/90 gap-4" disabled={isResetting}>
                        {isResetting ? <Loader2 className="h-8 w-8 animate-spin" /> : <Rocket className="h-8 w-8" />}
                        RESETEO CIDEE
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8">
                      <AlertDialogHeader className="space-y-4">
                        <AlertDialogTitle className="text-2xl font-black uppercase text-destructive flex items-center gap-3">
                          <ShieldAlert className="h-8 w-8" /> ¿CONFIRMAR RESETEO TRANSACCIONAL?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-xs font-bold uppercase leading-relaxed text-muted-foreground">
                          Esta acción borrará permanentemente todas las solicitudes, agendas, informes y movimientos registrados. El Directorio de Divulgadores permanecerá intacto. ¿Desea continuar?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="mt-8 gap-4">
                        <AlertDialogCancel className="h-14 rounded-xl font-black uppercase text-[10px] border-2">CANCELAR OPERACIÓN</AlertDialogCancel>
                        <AlertDialogAction onClick={handleResetCIDEE} className="h-14 flex-1 bg-destructive hover:bg-destructive/90 text-white rounded-xl font-black uppercase text-[10px]">
                          SÍ, BORRAR TRANSACCIONES E INICIAR
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/30 border-t p-6">
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest text-center w-full italic">
                  * Los datos de Divulgadores, Geografía e Inventario de Máquinas no se verán afectados por este reseteo.
                </p>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
