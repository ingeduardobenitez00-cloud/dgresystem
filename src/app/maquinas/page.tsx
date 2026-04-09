
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
  X
} from 'lucide-react';
import { useUser, useFirebase, useCollection, useMemoFirebase, useCollectionOnce } from '@/firebase';
import { collection, doc, writeBatch, addDoc, deleteDoc, query, where, updateDoc } from 'firebase/firestore';
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
import { cn } from '@/lib/utils';

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

  const profile = user?.profile;
  const isAdminView = ['admin', 'director'].includes(profile?.role || '') || profile?.permissions?.includes('admin_filter');

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollectionOnce<Dato>(datosQuery);

  const maquinasQuery = useMemoFirebase(() => {
    if (!firestore || !profile) return null;
    const colRef = collection(firestore, 'maquinas');
    if (isAdminView) return colRef;
    
    // GUARDIA: Si el perfil está incompleto, no realizar la consulta para evitar error de undefined
    if (!profile.departamento || !profile.distrito) return null;
    
    return query(colRef, where('departamento', '==', profile.departamento), where('distrito', '==', profile.distrito));
  }, [firestore, profile, isAdminView]);

  const { data: maquinasData, isLoading: isLoadingMaquinas } = useCollection<MaquinaVotacion>(maquinasQuery);

  const departments = useMemo(() => {
    if (!datosData) return [];
    return [...new Set(datosData.map(d => d.departamento))].sort();
  }, [datosData]);

  const filteredMaquinas = useMemo(() => {
    if (!maquinasData) return [];
    const term = maqSearch.toLowerCase().trim();
    return [...maquinasData].filter(m => 
      m.codigo.toLowerCase().includes(term) || 
      m.departamento.toLowerCase().includes(term) || 
      m.distrito.toLowerCase().includes(term)
    ).sort((a,b) => a.codigo.localeCompare(b.codigo));
  }, [maquinasData, maqSearch]);

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

        const mapped = json.map((row: any) => ({
          codigo: String(codKey ? row[codKey] : '').trim().toUpperCase(),
          departamento: String(depKey ? row[depKey] : '').trim().toUpperCase(),
          distrito: String(distKey ? row[distKey] : '').trim().toUpperCase(),
        })).filter(m => m.codigo && m.departamento && m.distrito);

        setPreviewMaq(mapped);
        toast({ title: "Archivo procesado", description: `Se han detectado ${mapped.length} máquinas.` });
      } catch (err) { toast({ variant: 'destructive', title: 'Error al procesar archivo' }); }
      finally { setIsParsingMaq(false); }
    };
    reader.readAsBinaryString(file);
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
          batch.set(newDoc, { ...item, fecha_registro: new Date().toISOString() });
        });
        await batch.commit(); 
        await delay(300);
      }
      toast({ title: 'Inventario Actualizado' }); setPreviewMaq([]); setFileNameMaq(null);
    } catch (err) { toast({ variant: 'destructive', title: 'Error al guardar' }); }
    finally { setIsUploadingMaq(false); }
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
                    <label className="flex items-center gap-2 px-6 h-11 bg-black text-white rounded-xl font-black uppercase text-[10px] cursor-pointer hover:bg-black/90 shadow-xl">
                        <FileUp className="h-4 w-4" /> Importar Excel
                        <Input type="file" className="hidden" accept=".xlsx,.csv" onChange={handleMaqFile} disabled={isParsingMaq || isUploadingMaq} />
                    </label>
                </div>
            )}
        </div>

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

                {previewMaq.length > 0 && (
                    <Card className="shadow-2xl border-none animate-in zoom-in duration-300">
                        <CardHeader className="bg-green-600 text-white py-4">
                            <CardTitle className="text-xs font-black uppercase">Lote para Cargar ({previewMaq.length})</CardTitle>
                        </CardHeader>
                        <CardFooter className="p-4 bg-muted/30">
                            <div className="flex flex-col gap-2 w-full">
                                <Button className="w-full h-12 bg-green-600 hover:bg-green-700 font-black uppercase text-[10px]" onClick={handleSaveMaquinas} disabled={isUploadingMaq}>
                                    {isUploadingMaq ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />} CONFIRMAR IMPORTACIÓN
                                </Button>
                                <Button variant="ghost" className="text-destructive font-black uppercase text-[9px]" onClick={() => setPreviewMaq([])}>CANCELAR</Button>
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
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
      </main>
    </div>
  );
}
