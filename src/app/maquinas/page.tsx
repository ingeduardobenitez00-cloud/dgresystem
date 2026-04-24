
"use client";

import { useState, useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Cpu, 
  Search, 
  Plus, 
  Trash2, 
  FileUp, 
  CheckCircle2, 
  Download, 
  Building2, 
  Landmark,
  ShieldAlert,
  Edit,
  Database,
  X,
  ChevronDown
} from 'lucide-react';
import { useUser, useFirebase, useCollectionOnce, useCollectionPaginated, useMemoFirebase } from '@/firebase';
import { collection, doc, writeBatch, addDoc, deleteDoc, query, where, updateDoc, orderBy, limit } from 'firebase/firestore';
import { type MaquinaVotacion, type Dato } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import * as XLSX from 'xlsx';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn, getFuzzyMatch, normalizeGeo } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { getDocs } from 'firebase/firestore';

// normalizeGeo movido a src/lib/utils.ts

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const normalizeHeader = (str: string) => 
  str.normalize("NFD")
     .replace(/[\u0300-\u036f]/g, "")
     .toLowerCase()
     .trim();

export default function MaquinasPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [maqSearch, setMaqSearch] = useState('');
  const [isParsingMaq, setIsParsingMaq] = useState(false);
  const [isUploadingMaq, setIsUploadingMaq] = useState(false);
  const [fileNameMaq, setFileNameMaq] = useState<string | null>(null);
  const [previewMaq, setPreviewMaq] = useState<Omit<MaquinaVotacion, 'id' | 'fecha_registro'>[]>([]);

  const [editingMaquinaId, setEditingMaquinaId] = useState<string | null>(null);
  const [manualMaq, setManualMaq] = useState({
    codigo: '',
    departamento: '',
    distrito: ''
  });

  // Estados para importación inteligente
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [verifiedMaq, setVerifiedMaq] = useState<(Omit<MaquinaVotacion, 'id' | 'fecha_registro'> & { status: 'new' | 'duplicate' | 'warning', message?: string })[]>([]);

  // Estados para filtros
  const [selDept, setSelDept] = useState<string>('');
  const [selDist, setSelDist] = useState<string>('');
  const [execDept, setExecDept] = useState<string>('');
  const [execDist, setExecDist] = useState<string>('');

  const profile = user?.profile;
  const isAdminView = ['admin', 'director'].includes(profile?.role || '') || profile?.permissions?.includes('admin_filter');

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollectionOnce<Dato>(datosQuery);

  const maquinasQuery = useMemoFirebase(() => {
    if (!firestore || !profile) return null;
    const colRef = collection(firestore, 'maquinas');
    let q;

    if (isAdminView) {
        if (execDept) {
            const deptoNorm = normalizeGeo(execDept);
            const variations = Array.from(new Set([
                execDept,
                deptoNorm,
                execDept.replace(/^[\d\s-]*/, '').trim()
            ])).filter(Boolean);

            q = query(colRef, where('departamento', 'in', variations), orderBy('codigo', 'asc'));
        } else if (maqSearch && maqSearch.length >= 3) {
            const term = maqSearch.toUpperCase().trim();
            q = query(colRef, where('codigo', '>=', term), where('codigo', '<=', term + '\uf8ff'), orderBy('codigo', 'asc'));
        } else {
            q = query(colRef, orderBy('codigo', 'asc'));
        }
    } else if (profile.departamento) {
        const depto = profile.departamento;
        const variations = Array.from(new Set([depto, normalizeGeo(depto)])).filter(Boolean);
        q = query(colRef, where('departamento', 'in', variations), orderBy('codigo', 'asc'));
    } else return null;

    return q;
  }, [firestore, profile, isAdminView, execDept, execDist, maqSearch]);

  const { 
    data: maquinasData, 
    isLoading: isLoadingMaquinas,
    error: errorMaquinas,
    hasMore: hasMoreMaquinas,
    loadMore: loadMoreMaquinas,
    isLoadingMore: isLoadingMoreMaquinas,
    refetch: refetchMaquinas
  } = useCollectionPaginated<MaquinaVotacion>(maquinasQuery, 100);

  const departments = useMemo(() => {
    if (!datosData) return [];
    return [...new Set(datosData.map(d => d.departamento))].sort();
  }, [datosData]);

  const filteredMaquinas = useMemo(() => {
    let list = maquinasData || [];
    
    // Filtro local de Distrito - para evitar limitación de Firestore (múltiples 'in')
    if (execDist) {
        const distNorm = normalizeGeo(execDist);
        list = list.filter(m => 
            m.distrito === execDist || 
            normalizeGeo(m.distrito) === distNorm
        );
    }

    // Ordenar por código (cliente) para no requerir índices compuestos en Firestore
    return [...list].sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [maquinasData, execDist]);

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
        
        if (json.length === 0) return;
        const headers = Object.keys(json[0]);
        const findHeader = (possibleNames: string[]) => {
          const normalizedPossibles = possibleNames.map(normalizeHeader);
          return headers.find(h => normalizedPossibles.includes(normalizeHeader(h)));
        };

        const codKey = findHeader(['SERIE', 'CODIGO', 'CÓDIGO', 'NRO_SERIE', 'SERIAL']);
        const depKey = findHeader(['DEPARTAMENTO', 'DEPTO', 'DPTO']);
        const distKey = findHeader(['DISTRITO', 'OFICINA', 'LOCALIDAD']);

        const mapped = json.map((row: any) => {
          const rawDep = String(depKey ? row[depKey] : '').trim();
          const rawDist = String(distKey ? row[distKey] : '').trim();
          const rawCod = String(codKey ? row[codKey] : '').trim().toUpperCase();
          
          const normDep = normalizeGeo(rawDep);
          const normDist = normalizeGeo(rawDist);

          // Fuzzy match para geografía
          let officialEntry = datosData?.find(d => 
            normalizeGeo(d.departamento) === normDep && 
            normalizeGeo(d.distrito) === normDist
          );

          let status: 'new' | 'warning' = 'new';
          let message = '';

          if (!officialEntry && datosData) {
            // Buscar mejor coincidencia por fuzzy match en el departamento
            const deptoEntries = (datosData as Dato[]).filter((d: Dato) => normalizeGeo(d.departamento) === normDep);
            let bestMatch: Dato | null = null;
            let bestScore = 0;

            deptoEntries.forEach((d) => {
              const score = getFuzzyMatch(normDist, (d as Dato).distrito);
              if (score > bestScore) {
                bestScore = score;
                bestMatch = d;
              }
            });

            if (bestMatch && bestScore > 0.7) {
              officialEntry = bestMatch;
              status = 'warning';
              message = `Corregido de "${rawDist}" a "${bestMatch.distrito}"`;
            } else {
              status = 'warning';
              message = `Jurisdicción no encontrada: ${rawDist}`;
            }
          }

          return {
            codigo: rawCod,
            departamento: officialEntry ? officialEntry.departamento : rawDep,
            distrito: officialEntry ? officialEntry.distrito : rawDist,
            status,
            message
          };
        }).filter(m => m.codigo);

        setVerifiedMaq(mapped);
        toast({ title: "Archivo analizado", description: "Verifica el lote antes de confirmar." });
      } catch (err) { toast({ variant: 'destructive', title: 'Error al procesar archivo' }); }
      finally { setIsParsingMaq(false); }
    };
    reader.readAsBinaryString(file);
  };

  const checkDuplicates = async () => {
    if (!firestore || verifiedMaq.length === 0) return;
    setIsCheckingDuplicates(true);
    try {
      const BATCH_SIZE = 30;
      const updated = [...verifiedMaq];
      
      for (let i = 0; i < updated.length; i += BATCH_SIZE) {
        const chunk = updated.slice(i, i + BATCH_SIZE);
        const q = query(collection(firestore, 'maquinas'), where('codigo', 'in', chunk.map(m => m.codigo)));
        const snap = await getDocs(q);
        const existingCodes = snap.docs.map(d => d.data().codigo);
        
        chunk.forEach(m => {
          if (existingCodes.includes(m.codigo)) {
            const idx = updated.findIndex(u => u.codigo === m.codigo);
            updated[idx].status = 'duplicate';
            updated[idx].message = 'Este equipo ya está registrado';
          }
        });
      }
      setVerifiedMaq(updated);
      toast({ title: "Verificación completada", description: "Se han identificado los duplicados." });
    } catch (err) {
      toast({ variant: 'destructive', title: "Error al verificar duplicados" });
    } finally {
      setIsCheckingDuplicates(false);
    }
  };

  const handleSaveMaquinas = async () => {
    if (!firestore || verifiedMaq.length === 0) return;
    const toSave = verifiedMaq.filter(m => m.status !== 'duplicate');
    if (toSave.length === 0) {
        toast({ variant: 'destructive', title: "Nada que guardar", description: "Todos los equipos son duplicados." });
        return;
    }

    setIsUploadingMaq(true);
    setUploadProgress(0);
    try {
      const BATCH_SIZE = 100;
      for (let i = 0; i < toSave.length; i += BATCH_SIZE) {
        const batch = writeBatch(firestore);
        const chunk = toSave.slice(i, i + BATCH_SIZE);
        chunk.forEach(item => {
          const { status, message, ...data } = item;
          const newDoc = doc(collection(firestore, 'maquinas'));
          batch.set(newDoc, { ...data, fecha_registro: new Date().toISOString() });
        });
        await batch.commit(); 
        setUploadProgress(Math.round(((i + chunk.length) / toSave.length) * 100));
        await delay(300);
      }
      toast({ title: 'Inventario Actualizado', description: `Se guardaron ${toSave.length} máquinas.` }); 
      setVerifiedMaq([]); 
      setPreviewMaq([]); 
      setFileNameMaq(null);
    } catch (err) { toast({ variant: 'destructive', title: 'Error al guardar' }); }
    finally { setIsUploadingMaq(false); setUploadProgress(0); }
  };

  const handleManualSaveMaq = async () => {
    if (!firestore || !manualMaq.codigo || !manualMaq.departamento || !manualMaq.distrito) {
      toast({ variant: 'destructive', title: 'Faltan datos' }); return;
    }
    setIsUploadingMaq(true);
    try {
      const docData = {
        codigo: manualMaq.codigo.toUpperCase().trim(),
        departamento: manualMaq.departamento,
        distrito: manualMaq.distrito
      };

      if (editingMaquinaId) {
        await updateDoc(doc(firestore, 'maquinas', editingMaquinaId), docData);
        toast({ title: 'Máquina actualizada' });
        setEditingMaquinaId(null);
      } else {
        await addDoc(collection(firestore, 'maquinas'), {
          ...docData,
          fecha_registro: new Date().toISOString()
        });
        toast({ title: 'Máquina registrada' });
      }
      setManualMaq({ codigo: '', departamento: '', distrito: '' });
    } catch (err) { toast({ variant: 'destructive', title: 'Error' }); }
    finally { setIsUploadingMaq(false); }
  };

  const handleEditClick = (maq: MaquinaVotacion) => {
    setEditingMaquinaId(maq.id);
    setManualMaq({
      codigo: maq.codigo,
      departamento: maq.departamento,
      distrito: maq.distrito
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteMaquina = (id: string) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'maquinas', id);
    deleteDoc(docRef).then(() => toast({ title: "Registro eliminado" }))
      .catch(error => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' })));
  };

  const [isNormalizing, setIsNormalizing] = useState(false);
  const handleNormalizeAll = async () => {
    if (!firestore || !maquinasData || !datosData || !isAdminView) return;
    setIsNormalizing(true);
    try {
      const BATCH_SIZE = 50;
      let count = 0;
      for (let i = 0; i < maquinasData.length; i += BATCH_SIZE) {
        const batch = writeBatch(firestore);
        const chunk = maquinasData.slice(i, i + BATCH_SIZE);
        let batchNeeded = false;
        
        chunk.forEach(maq => {
          const normDep = normalizeGeo(maq.departamento);
          const normDist = normalizeGeo(maq.distrito);
          const official = datosData.find(d => normalizeGeo(d.departamento) === normDep && normalizeGeo(d.distrito) === normDist);
          
          if (official && (official.departamento !== maq.departamento || official.distrito !== maq.distrito)) {
            batch.update(doc(firestore, 'maquinas', maq.id), {
              departamento: official.departamento,
              distrito: official.distrito
            });
            batchNeeded = true;
            count++;
          }
        });
        
        if (batchNeeded) await batch.commit();
      }
      toast({ title: "Normalización completada", description: `Se actualizaron ${count} máquinas.` });
    } catch (err) { toast({ variant: 'destructive', title: "Error al normalizar" }); }
    finally { setIsNormalizing(false); }
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Inventario de Máquinas" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h1 className="text-3xl font-black uppercase text-primary tracking-tight">Gestión de Equipos</h1>
                <p className="text-muted-foreground text-[10px] font-bold uppercase mt-1 tracking-widest">
                    <Cpu className="h-3.5 w-3.5" /> Stock institucional de Máquinas de Votación por jurisdicción
                </p>
            </div>
            {isAdminView && (
                <div className="flex gap-3">
                    <Button variant="outline" className="h-11 rounded-xl font-black uppercase text-[10px] gap-2 border-2 border-orange-500 text-orange-600 hover:bg-orange-50" onClick={handleNormalizeAll} disabled={isNormalizing}>
                        {isNormalizing ? <Loader2 className="animate-spin h-4 w-4" /> : <Database className="h-4 w-4" />} {isNormalizing ? "NORMALIZANDO..." : "NORMALIZAR GEOGRAFÍA"}
                    </Button>
                    <label className="flex items-center gap-2 px-6 h-11 bg-black text-white rounded-xl font-black uppercase text-[10px] cursor-pointer hover:bg-black/90 shadow-xl">
                        <FileUp className="h-4 w-4" /> Importar Excel
                        <input type="file" className="hidden" accept=".xlsx,.csv" onChange={handleMaqFile} disabled={isParsingMaq || isUploadingMaq} />
                    </label>
                </div>
            )}
        </div>
        
        {/* Panel de Filtros Avanzados */}
        <Card className="border-none shadow-xl bg-white overflow-hidden rounded-[2.5rem]">
            <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                    <div className="md:col-span-4 space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Departamento / Jurisdicción</Label>
                        <Select 
                            value={selDept} 
                            onValueChange={(v) => { setSelDept(v); setSelDist(''); }}
                            disabled={!isAdminView}
                        >
                            <SelectTrigger className="h-12 rounded-2xl border-2 font-black uppercase text-xs bg-muted/30">
                                <SelectValue placeholder={!isAdminView ? (profile?.departamento || "Cargando...") : "TODOS LOS DEPARTAMENTOS"} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all" className="font-black text-xs uppercase text-primary">MOSTRAR TODOS</SelectItem>
                                {departments.map(d => (
                                    <SelectItem key={d} value={d} className="font-bold text-xs uppercase">{d}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    
                    <div className="md:col-span-4 space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Distrito / Localidad</Label>
                        <Select 
                            value={selDist} 
                            onValueChange={setSelDist}
                            disabled={!selDept && isAdminView}
                        >
                            <SelectTrigger className="h-12 rounded-2xl border-2 font-black uppercase text-xs bg-muted/30">
                                <SelectValue placeholder="TODOS LOS DISTRITOS" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all" className="font-black text-xs uppercase text-primary">TODOS LOS DISTRITOS</SelectItem>
                                {datosData?.filter(d => d.departamento === (selDept || profile?.departamento)).map(d => (
                                    <SelectItem key={d.distrito} value={d.distrito} className="font-bold text-xs uppercase">{d.distrito}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="md:col-span-4 flex gap-2">
                        <Button 
                            className="flex-1 h-12 rounded-2xl bg-black hover:bg-black/90 text-white font-black uppercase text-xs shadow-lg shadow-black/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            onClick={() => {
                                setExecDept(selDept === 'all' ? '' : selDept);
                                setExecDist(selDist === 'all' ? '' : selDist);
                                // Forzar refresco inmediato con el nuevo filtro
                                setTimeout(() => refetchMaquinas && refetchMaquinas(), 50);
                            }}
                        >
                            <Search className="h-4 w-4 mr-2" /> EJECUTAR FILTRO
                        </Button>
                        <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-12 w-12 rounded-2xl border-2 hover:bg-muted"
                            onClick={() => {
                                setSelDept('');
                                setSelDist('');
                                setExecDept('');
                                setExecDist('');
                                setMaqSearch('');
                            }}
                            title="Limpiar Filtros"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-6">
                <Card className={cn("shadow-lg border-t-4", editingMaquinaId ? "border-t-primary" : "border-t-black")}>
                    <CardHeader className="bg-muted/10 border-b flex flex-row items-center justify-between py-4">
                        <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
                            {editingMaquinaId ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />} 
                            {editingMaquinaId ? "Editar Máquina" : "Registro Individual"}
                        </CardTitle>
                        {editingMaquinaId && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => { setEditingMaquinaId(null); setManualMaq({codigo: '', departamento: '', distrito: ''}); }}>
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase text-muted-foreground">Serie de Máquina</Label>
                            <Input value={manualMaq.codigo} onChange={e => setManualMaq({...manualMaq, codigo: e.target.value.toUpperCase()})} placeholder="MV-XXXX" className="h-11 font-black uppercase border-2 text-sm" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase text-muted-foreground">Departamento</Label>
                            <Select value={manualMaq.departamento} onValueChange={(v) => setManualMaq({...manualMaq, departamento: v, distrito: ''})}>
                                <SelectTrigger className="h-11 font-black uppercase border-2 text-[10px]"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                                <SelectContent>{departments.map(d => <SelectItem key={d} value={d} className="text-xs font-bold">{d}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase text-muted-foreground">Distrito</Label>
                            <Select value={manualMaq.distrito} onValueChange={(v) => setManualMaq({...manualMaq, distrito: v})} disabled={!manualMaq.departamento}>
                                <SelectTrigger className="h-11 font-black uppercase border-2 text-[10px]"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                                <SelectContent>{datosData?.filter(d => d.departamento === manualMaq.departamento).map(d => <SelectItem key={d.distrito} value={d.distrito} className="text-xs font-bold">{d.distrito}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                    <CardFooter className="bg-muted/30 border-t p-4 gap-2">
                        {editingMaquinaId && (
                            <Button variant="outline" className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => { setEditingMaquinaId(null); setManualMaq({codigo: '', departamento: '', distrito: ''}); }}>
                                CANCELAR
                            </Button>
                        )}
                        <Button className="flex-[2] font-black uppercase text-[10px] h-12 shadow-md" onClick={handleManualSaveMaq} disabled={isUploadingMaq || !manualMaq.codigo || !manualMaq.distrito}>
                            {isUploadingMaq ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} 
                            {editingMaquinaId ? "ACTUALIZAR DATOS" : "GUARDAR MÁQUINA"}
                        </Button>
                    </CardFooter>
                </Card>

                {verifiedMaq.length > 0 && (
                    <Card className="shadow-2xl border-none animate-in zoom-in duration-300 col-span-full">
                        <CardHeader className="bg-black text-white py-4 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-xs font-black uppercase">Verificación de Lote ({verifiedMaq.length} equipos)</CardTitle>
                                <p className="text-[9px] font-bold text-white/60 uppercase">Analiza el estado de cada registro antes de confirmar</p>
                            </div>
                            <div className="flex gap-2">
                                <Button 
                                    className="bg-white text-black hover:bg-white/90 font-black uppercase text-[10px] h-9" 
                                    onClick={checkDuplicates} 
                                    disabled={isCheckingDuplicates || isUploadingMaq}
                                >
                                    {isCheckingDuplicates ? <Loader2 className="animate-spin mr-2 h-3 w-3" /> : <Search className="mr-2 h-3 w-3" />} 
                                    {isCheckingDuplicates ? "VERIFICANDO..." : "DETECTAR DUPLICADOS"}
                                </Button>
                                <Button variant="ghost" className="text-white hover:bg-white/10 font-black uppercase text-[10px] h-9" onClick={() => setVerifiedMaq([])}>CANCELAR</Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[300px]">
                                <Table>
                                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                        <TableRow>
                                            <TableHead className="text-[10px] font-black uppercase">Serie</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase">Destino</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase">Estado</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase">Observación</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {verifiedMaq.map((m, idx) => (
                                            <TableRow key={idx} className={cn(m.status === 'duplicate' ? "bg-red-50" : m.status === 'warning' ? "bg-orange-50" : "")}>
                                                <TableCell className="font-black text-xs uppercase">{m.codigo}</TableCell>
                                                <TableCell className="text-[10px] font-bold uppercase">{m.distrito}, {m.departamento}</TableCell>
                                                <TableCell>
                                                    <Badge className={cn(
                                                        "text-[9px] font-black uppercase",
                                                        m.status === 'new' ? "bg-green-100 text-green-700 hover:bg-green-100" :
                                                        m.status === 'duplicate' ? "bg-red-100 text-red-700 hover:bg-red-100" :
                                                        "bg-orange-100 text-orange-700 hover:bg-orange-100"
                                                    )}>
                                                        {m.status === 'new' ? "LISTO" : m.status === 'duplicate' ? "DUPLICADO" : "ALERTA"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-[10px] font-medium text-muted-foreground italic">{m.message || 'Datos correctos'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </CardContent>
                        <CardFooter className="p-6 bg-muted/30 border-t flex flex-col gap-4">
                            {isUploadingMaq && (
                                <div className="w-full space-y-2">
                                    <div className="flex justify-between text-[10px] font-black uppercase">
                                        <span>Procesando equipos...</span>
                                        <span>{uploadProgress}%</span>
                                    </div>
                                    <Progress value={uploadProgress} className="h-2" />
                                </div>
                            )}
                            <div className="flex justify-between items-center w-full">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase max-w-md">
                                    Se guardarán <span className="text-primary font-black">{verifiedMaq.filter(m => m.status !== 'duplicate').length}</span> equipos. Los duplicados serán ignorados automáticamente.
                                </p>
                                <Button className="px-10 h-12 bg-green-600 hover:bg-green-700 font-black uppercase text-[10px] shadow-lg shadow-green-200" onClick={handleSaveMaquinas} disabled={isUploadingMaq || isCheckingDuplicates}>
                                    {isUploadingMaq ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />} 
                                    {isUploadingMaq ? "SUBIENDO..." : "CONFIRMAR IMPORTACIÓN"}
                                </Button>
                            </div>
                        </CardFooter>
                    </Card>
                )}
            </div>

            <div className="lg:col-span-8">
                <Card className="shadow-lg border-none overflow-hidden h-full">
                    <CardHeader className="bg-primary text-white flex flex-row items-center justify-between py-4 px-8">
                        <div className="flex items-center gap-3">
                            <Cpu className="h-5 w-5 opacity-50" />
                            <CardTitle className="text-xs font-black uppercase tracking-widest">Inventario de Equipos ({filteredMaquinas.length})</CardTitle>
                        </div>
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                            <Input placeholder="Buscar por serie o distrito..." className="h-10 pl-10 text-[10px] font-bold bg-white/10 border-white/20 text-white rounded-full placeholder:text-white/40" value={maqSearch} onChange={e => setMaqSearch(e.target.value)} />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[600px]">
                            <Table>
                                <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                                    <TableRow>
                                        <TableHead className="text-[10px] font-black uppercase px-8">Serie</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase">Jurisdicción</TableHead>
                                        <TableHead className="text-right text-[10px] font-black uppercase px-8">Acción</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="bg-white">
                                    {isLoadingMaquinas ? (
                                        <TableRow><TableCell colSpan={3} className="text-center py-20"><Loader2 className="h-10 w-10 animate-spin mx-auto text-primary opacity-20"/></TableCell></TableRow>
                                    ) : errorMaquinas ? (
                                        <TableRow><TableCell colSpan={3} className="text-center py-10 px-8">
                                            <div className="bg-red-50 p-6 rounded-2xl border border-red-200">
                                                <div className="flex items-center gap-3 text-red-600 mb-2">
                                                    <ShieldAlert className="h-5 w-5" />
                                                    <span className="font-black text-[10px] uppercase">Error de Consulta</span>
                                                </div>
                                                <p className="text-[10px] font-bold text-red-800 uppercase leading-relaxed">
                                                    {(errorMaquinas as any)?.message?.includes('index') ? 
                                                        "Falta un índice en la base de datos para esta combinación de filtros. Por favor, revisa la consola de Firebase." : 
                                                        errorMaquinas.message || "No se ha podido cargar el inventario."}
                                                </p>
                                            </div>
                                        </TableCell></TableRow>
                                    ) : filteredMaquinas.length === 0 ? (
                                        <TableRow><TableCell colSpan={3} className="text-center py-20 text-[10px] font-black uppercase opacity-20">Sin equipos registrados</TableCell></TableRow>
                                    ) : (
                                        filteredMaquinas.map(m => (
                                            <TableRow key={m.id} className="hover:bg-muted/30 transition-colors group">
                                                <TableCell className="px-8 py-4"><span className="font-black text-sm text-primary tracking-tighter">{m.codigo}</span></TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black uppercase text-[#1A1A1A]">{m.distrito}</span>
                                                        <span className="text-[8px] font-bold text-muted-foreground uppercase">{m.departamento}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right px-8">
                                                    <div className="flex justify-end gap-2">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-9 w-9 text-primary opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-primary/10"
                                                            onClick={() => handleEditClick(m)}
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent className="rounded-[2.5rem]">
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle className="font-black uppercase tracking-tight">¿ELIMINAR EQUIPO DEL STOCK?</AlertDialogTitle>
                                                                    <AlertDialogDescription className="text-xs font-bold uppercase text-muted-foreground">Se borrará permanentemente la máquina {m.codigo} de este distrito. Esta acción no afecta a los movimientos históricos ya cerrados.</AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter className="pt-6">
                                                                    <AlertDialogCancel className="rounded-xl font-black uppercase text-[10px]">CANCELAR</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleDeleteMaquina(m.id)} className="bg-destructive text-white rounded-xl font-black uppercase text-[10px] px-8">ELIMINAR EQUIPO</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                            {hasMoreMaquinas && (
                                <div className="p-6 flex justify-center border-t bg-muted/5">
                                    <Button 
                                        onClick={loadMoreMaquinas} 
                                        disabled={isLoadingMoreMaquinas}
                                        variant="outline"
                                        className="rounded-xl font-black text-[10px] uppercase tracking-widest px-8 border-2 shadow-sm hover:bg-primary hover:text-white transition-all gap-2"
                                    >
                                        {isLoadingMoreMaquinas ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <>Cargar más equipos <ChevronDown className="h-4 w-4" /></>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
      </main>
    </div>
  );
}
