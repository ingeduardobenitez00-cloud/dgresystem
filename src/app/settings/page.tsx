
"use client";

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, Database, Search, AlertTriangle, FileUp, Plus, Trash2, X, Edit, Rocket, ShieldAlert } from 'lucide-react';
import Header from '@/components/header';
import * as XLSX from 'xlsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type Dato } from '@/lib/data';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useFirebase, useMemoFirebase, useUser, useCollectionOnce, useDocOnce } from '@/firebase';
import { collection, doc, setDoc, writeBatch, addDoc, deleteDoc, updateDoc, getDocs, query, limit } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { ACTION_LABELS, MODULE_STRUCTURE, GLOBAL_PERMS } from '@/lib/permissions-config';
import {
  Shield,
  FileCheck,
  Layout,
  Bookmark
} from 'lucide-react';
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

  const [isResetting, setIsResetting] = useState(false);
  const [isTogglingMaintenance, setIsTogglingMaintenance] = useState(false);

  // --- PERFILES DE ACCESO ---
  const [profiles, setProfiles] = useState<any[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');
  const [selectedProfileModules, setSelectedProfileModules] = useState<Set<string>>(new Set());
  const [selectedProfilePerms, setSelectedProfilePerms] = useState<Set<string>>(new Set());

  const fetchProfiles = async () => {
    if (!firestore) return;
    setIsLoadingProfiles(true);
    try {
      const snapshot = await getDocs(collection(firestore, 'permisos_perfiles'));
      setProfiles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) { console.error(err); }
    finally { setIsLoadingProfiles(false); }
  };

  useMemo(() => {
    fetchProfiles();
  }, [firestore]);

  const handleSaveProfile = async () => {
    if (!firestore || !profileName) return;
    setIsSavingProfile(true);
    try {
      const data = {
        name: profileName,
        modules: Array.from(selectedProfileModules),
        permissions: Array.from(selectedProfilePerms)
      };
      if (editingProfileId) {
        await updateDoc(doc(firestore, 'permisos_perfiles', editingProfileId), data);
        toast({ title: 'Perfil actualizado' });
      } else {
        await addDoc(collection(firestore, 'permisos_perfiles'), data);
        toast({ title: 'Perfil creado' });
      }
      setProfileName('');
      setSelectedProfileModules(new Set());
      setSelectedProfilePerms(new Set());
      setEditingProfileId(null);
      fetchProfiles();
    } catch (err) { toast({ variant: 'destructive', title: 'Error al guardar perfil' }); }
    finally { setIsSavingProfile(false); }
  };

  const handleDeleteProfile = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'permisos_perfiles', id));
      toast({ title: 'Perfil eliminado' });
      fetchProfiles();
    } catch (err) { toast({ variant: 'destructive', title: 'Error al eliminar' }); }
  };

  const handleEditProfile = (profile: any) => {
    setEditingProfileId(profile.id);
    setProfileName(profile.name);
    setSelectedProfileModules(new Set(profile.modules));
    setSelectedProfilePerms(new Set(profile.permissions));
  };

  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  
  const handleSyncProfileUsers = async (profile: any) => {
    if (!firestore) return;
    setIsSyncing(profile.id);
    try {
        const usersRef = collection(firestore, 'users');
        const q = query(usersRef, where('profileId', '==', profile.id));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            toast({ title: 'No hay usuarios vinculados a este perfil' });
            return;
        }

        const batch = writeBatch(firestore);
        snapshot.docs.forEach(uDoc => {
            batch.update(uDoc.ref, {
                modules: profile.modules,
                permissions: profile.permissions
            });
        });

        await batch.commit();
        toast({ title: `Sincronización completa: ${snapshot.size} usuarios actualizados` });
    } catch (err) {
        toast({ variant: 'destructive', title: 'Error al sincronizar usuarios' });
    } finally {
        setIsSyncing(null);
    }
  };

  const isAdminView = useMemo(() => 
    currentUser?.profile?.role === 'admin' || 
    currentUser?.profile?.role === 'director' || 
    currentUser?.profile?.permissions?.includes('admin_filter'),
    [currentUser]
  );

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: rawDatosData, isLoading: isLoadingDatos } = useCollectionOnce<Dato>(datosQuery);

  const datosData = useMemo(() => {
    if (!rawDatosData) return [];
    return [...rawDatosData].sort((a, b) => a.departamento.localeCompare(b.departamento) || a.distrito.localeCompare(b.distrito));
  }, [rawDatosData]);

  const departmentsWithDistricts = useMemo(() => {
    if (!datosData) return [];
    const deptsMap: Map<string, { id: string, name: string, districts: any[] }> = new Map();
    datosData.forEach((dato) => {
      if (!deptsMap.has(dato.departamento)) {
        deptsMap.set(dato.departamento, { id: dato.departamento, name: dato.departamento, districts: [] });
      }
      const dept = deptsMap.get(dato.departamento);
      if (dept && !dept.districts.some(d => d.name === dato.distrito)) {
        dept.districts.push({ 
            id: dato.id!, 
            name: dato.distrito,
            distrito_codigo: dato.distrito_codigo 
        });
      }
    });
    return Array.from(deptsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [datosData]);

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
        const depCodKey = findHeader(['DEPARTAMENTO_CODIGO', 'CODIGO_DPTO']);
        const distCodKey = findHeader(['DISTRITO_CODIGO', 'CODIGO_DIST']);

        const mapped = json.map((row: any) => ({
          departamento: String(depKey ? row[depKey] : '').trim().toUpperCase(),
          distrito: String(distKey ? row[distKey] : '').trim().toUpperCase(),
          departamento_codigo: String(depCodKey ? row[depCodKey] : '').trim(),
          distrito_codigo: String(distCodKey ? row[distCodKey] : '').trim(),
        })).filter(d => d.departamento && d.distrito);

        setPreviewGeo(mapped);
      } catch (err) { toast({ variant: 'destructive', title: 'Error al procesar' }); }
      finally { setIsParsingGeo(false); }
    };
    reader.readAsBinaryString(file);
  };

  const handleManualSaveGeo = async () => {
    if (!firestore || !manualGeo.departamento || !manualGeo.distrito) {
      toast({ variant: 'destructive', title: 'Faltan datos' }); return;
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
        await updateDoc(doc(firestore, 'datos', editingDatoId), docData);
        toast({ title: 'Actualizado' }); setEditingDatoId(null);
      } else {
        await addDoc(collection(firestore, 'datos'), docData);
        toast({ title: 'Guardado' });
      }
      setManualGeo({ ...manualGeo, distrito: '', distrito_codigo: '' });
    } catch (err) { toast({ variant: 'destructive', title: 'Error' }); }
    finally { setIsUploadingGeo(false); }
  };

  const handleDeleteDato = (id: string) => {
    if (!firestore) return;
    deleteDoc(doc(firestore, 'datos', id))
      .then(() => toast({ title: "Eliminado" }))
      .catch(error => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `datos/${id}`, operation: 'delete' })));
  };

  const handleSaveGeo = async () => {
    if (!firestore || previewGeo.length === 0) return;
    setIsUploadingGeo(true);
    try {
      const BATCH_SIZE = 100;
      for (let i = 0; i < previewGeo.length; i += BATCH_SIZE) {
        const batch = writeBatch(firestore);
        previewGeo.slice(i, i + BATCH_SIZE).forEach(item => {
          batch.set(doc(collection(firestore, 'datos')), item);
        });
        await batch.commit(); await delay(300);
      }
      toast({ title: 'Geografía Cargada' }); setPreviewGeo([]); setFileNameGeo(null);
    } catch (err) { toast({ variant: 'destructive', title: 'Error' }); }
    finally { setIsUploadingGeo(false); }
  };

  const handleResetCIDEE = async () => {
    if (!firestore || !isAdminView) return;
    setIsResetting(true);
    const collectionsToClear = ['solicitudes-capacitacion', 'informes-divulgador', 'informes-semanales-anexo-iv', 'movimientos-maquinas', 'denuncias-lacres', 'encuestas-satisfaccion'];
    try {
      for (const colName of collectionsToClear) {
        let hasMore = true;
        while (hasMore) {
          const q = query(collection(firestore, colName), limit(500));
          const snapshot = await getDocs(q);
          if (snapshot.empty) { hasMore = false; continue; }
          const batch = writeBatch(firestore);
          snapshot.docs.forEach(d => batch.delete(d.ref));
          await batch.commit(); await delay(200);
        }
      }
      toast({ title: 'Reseteo Completado' });
    } catch (err) { toast({ variant: 'destructive', title: 'Error' }); }
    finally { setIsResetting(false); }
  };

  const sysConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'sysconfig', 'status') : null, [firestore]);
  const { data: sysConfig, refetch: refetchSysConfig } = useDocOnce<{maintenance: boolean}>(sysConfigRef);
  const isMaintenanceActive = sysConfig?.maintenance === true;

  const handleToggleMaintenance = async () => {
    if (!firestore || !isAdminView) return;
    setIsTogglingMaintenance(true);
    try {
      await setDoc(doc(firestore, 'sysconfig', 'status'), { maintenance: !isMaintenanceActive }, { merge: true });
      toast({ 
        title: !isMaintenanceActive ? 'Mantenimiento Activado' : 'Mantenimiento Desactivado', 
        description: 'Todos los clientes serán afectados inmediatamente.' 
      });
      await refetchSysConfig();
    } catch(err) {
      toast({ variant: 'destructive', title: 'Error al cambiar estado' });
    } finally {
      setIsTogglingMaintenance(false);
    }
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary"/></div>;

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/5">
      <Header title="Configuración del Sistema" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        <div className="mb-4">
            <h1 className="text-3xl font-black uppercase text-primary">Configuración Maestra</h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1 tracking-widest">Administración de geografía y entorno de producción.</p>
        </div>

        <Tabs defaultValue="geografia" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px] bg-white border shadow-sm h-auto p-1">
            <TabsTrigger value="geografia" className="gap-2 font-black uppercase text-[10px] py-2">
                <Database className="h-3.5 w-3.5" /> Geografía
            </TabsTrigger>
            <TabsTrigger value="perfiles" className="gap-2 font-black uppercase text-[10px] py-2">
                <Shield className="h-3.5 w-3.5" /> Perfiles Acceso
            </TabsTrigger>
            <TabsTrigger value="produccion" className="gap-2 font-black uppercase text-[10px] py-2">
                <Rocket className="h-3.5 w-3.5" /> Producción
            </TabsTrigger>
          </TabsList>

          <TabsContent value="geografia" className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4 space-y-6">
                    <Card className={cn("shadow-lg border-t-4", editingDatoId ? "border-t-primary" : "border-t-black")}>
                        <CardHeader className="bg-muted/10 border-b flex flex-row items-center justify-between py-4">
                            <div>
                                <CardTitle className="text-xs font-black uppercase">{editingDatoId ? "Editar" : "Registro Manual"}</CardTitle>
                            </div>
                            {editingDatoId && (
                                <Button variant="ghost" size="icon" onClick={() => { setEditingDatoId(null); setManualGeo({departamento: '', departamento_codigo: '', distrito: '', distrito_codigo: ''}); }} className="h-8 w-8 text-muted-foreground"><X className="h-4 w-4" /></Button>
                            )}
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-2 space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase">Departamento</Label>
                                    <Input value={manualGeo.departamento} onChange={e => setManualGeo({...manualGeo, departamento: e.target.value.toUpperCase()})} className="h-10 font-bold border-2 text-xs uppercase" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase">Cód.</Label>
                                    <Input value={manualGeo.departamento_codigo} onChange={e => setManualGeo({...manualGeo, departamento_codigo: e.target.value})} className="h-10 font-bold border-2 text-xs text-center" />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-2 space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase">Distrito</Label>
                                    <Input value={manualGeo.distrito} onChange={e => setManualGeo({...manualGeo, distrito: e.target.value.toUpperCase()})} className="h-10 font-bold border-2 text-xs uppercase" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase">Cód.</Label>
                                    <Input value={manualGeo.distrito_codigo} onChange={e => setManualGeo({...manualGeo, distrito_codigo: e.target.value})} className="h-10 font-bold border-2 text-xs text-center" />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/10 border-t p-4">
                            <Button className="w-full font-black uppercase text-[10px] h-11" onClick={handleManualSaveGeo} disabled={isUploadingGeo || !manualGeo.departamento || !manualGeo.distrito}>
                                {isUploadingGeo ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : editingDatoId ? "ACTUALIZAR" : "AGREGAR UBICACIÓN"}
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card className="shadow-lg border-dashed">
                        <CardHeader className="bg-primary/5 border-b py-4"><CardTitle className="text-xs font-black uppercase">Importar Excel</CardTitle></CardHeader>
                        <CardContent className="pt-6">
                            <div className="border-2 border-dashed rounded-xl p-8 bg-muted/30 text-center hover:bg-white transition-all">
                                <label htmlFor="geo-up" className="cursor-pointer flex flex-col items-center">
                                    <FileUp className="h-10 w-10 mb-2 text-primary opacity-40" />
                                    <span className="text-[10px] font-black uppercase">Seleccionar Archivo</span>
                                </label>
                                <Input id="geo-up" type="file" className="hidden" accept=".xlsx,.csv" onChange={handleGeoFile} disabled={isParsingGeo || isUploadingGeo} />
                                {fileNameGeo && <p className="mt-4 text-[9px] font-black text-green-600 uppercase">{fileNameGeo}</p>}
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/30 border-t p-4">
                            <Button className="w-full font-black uppercase text-[10px] h-11" onClick={handleSaveGeo} disabled={previewGeo.length === 0 || isUploadingGeo}>
                                {isUploadingGeo ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : "GUARDAR LOTE"}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>

                <div className="lg:col-span-8">
                    <Card className="shadow-lg border-none overflow-hidden h-full">
                        <CardHeader className="bg-muted/30 border-b py-4 px-8"><CardTitle className="text-xs font-black uppercase">Directorio Geográfico Actual</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[600px]">
                                <Accordion type="single" collapsible className="w-full">
                                    {departmentsWithDistricts.map((dept) => (
                                        <AccordionItem key={dept.id} value={dept.id} className="px-8 border-b hover:bg-muted/5 transition-colors">
                                            <AccordionTrigger className="hover:no-underline font-black uppercase text-xs py-4">
                                                {dept.name} <span className="ml-2 text-[9px] text-muted-foreground font-bold">({dept.districts.length} DISTRITOS)</span>
                                            </AccordionTrigger>
                                            <AccordionContent className="pb-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {dept.districts.map(d => (
                                                        <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border group">
                                                            <span className="text-[10px] font-bold uppercase">{d.name} <span className="text-muted-foreground opacity-40 ml-1">({d.distrito_codigo || '??'})</span></span>
                                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteDato(d.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
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

          <TabsContent value="perfiles" className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-12">
                <Card className="shadow-2xl border-none rounded-[2.5rem] overflow-hidden bg-white">
                  <CardHeader className="bg-black text-white p-8">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                          <Shield className="h-6 w-6" />
                        </div>
                        <div>
                          <CardTitle className="text-xl font-black uppercase tracking-tight">Diseñador de Perfiles de Acceso</CardTitle>
                          <CardDescription className="text-white/60 font-bold uppercase text-[10px] tracking-widest mt-1">Crea plantillas de permisos para asignar a usuarios rápidamente.</CardDescription>
                        </div>
                      </div>
                      {editingProfileId && (
                        <Button variant="ghost" onClick={() => { setEditingProfileId(null); setProfileName(''); setSelectedProfileModules(new Set()); setSelectedProfilePerms(new Set()); }} className="text-white hover:bg-white/10 font-bold uppercase text-[10px]">
                          <X className="mr-2 h-4 w-4" /> Cancelar Edición
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-10 space-y-8">
                    <div className="max-w-md space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground mr-2">Nombre del Perfil (Template)</Label>
                        <div className="flex gap-4">
                          <Input 
                            value={profileName} 
                            onChange={e => setProfileName(e.target.value)} 
                            placeholder="Ej: JEFE DE OFICINA"
                            className="h-14 font-black uppercase border-2 rounded-2xl shadow-sm text-lg"
                          />
                          <Button 
                            className="h-14 px-8 font-black uppercase shadow-xl rounded-2xl gap-3" 
                            disabled={isSavingProfile || !profileName}
                            onClick={handleSaveProfile}
                          >
                            {isSavingProfile ? <Loader2 className="animate-spin h-5 w-5" /> : <Plus className="h-5 w-5" />}
                            {editingProfileId ? 'ACTUALIZAR' : 'CREAR PERFIL'}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-8 border-2 border-dashed rounded-[2rem] p-8 bg-muted/5">
                      <div className="flex justify-between items-center">
                        <h3 className="font-black uppercase text-sm tracking-widest text-primary flex items-center gap-3">
                          <Layout className="h-5 w-5" /> Configurar Matriz de Seguridad del Perfil
                        </h3>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-6">
                        {MODULE_STRUCTURE.map((cat) => (
                          <div key={cat.category} className="space-y-4">
                            <div className="flex items-center gap-4">
                              <div className="h-px flex-1 bg-muted"></div>
                              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{cat.category}</span>
                              <div className="h-px flex-1 bg-muted"></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {cat.items.map((item) => (
                                <Card key={item.id} className={cn(
                                  "p-4 border-2 transition-all cursor-pointer hover:border-primary/40",
                                  selectedProfileModules.has(item.id) ? "border-primary bg-primary/[0.02]" : "border-muted shadow-none"
                                )} onClick={() => {
                                  const newMods = new Set(selectedProfileModules);
                                  if (newMods.has(item.id)) {
                                    newMods.delete(item.id);
                                    // Remove all permissions for this module
                                    const newPerms = new Set(selectedProfilePerms);
                                    ACTION_LABELS.forEach(a => newPerms.delete(`${item.id}:${a.id}`));
                                    setSelectedProfilePerms(newPerms);
                                  } else {
                                    newMods.add(item.id);
                                    // Add 'view' permission by default
                                    const newPerms = new Set(selectedProfilePerms);
                                    newPerms.add(`${item.id}:view`);
                                    setSelectedProfilePerms(newPerms);
                                  }
                                  setSelectedProfileModules(newMods);
                                }}>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase">{item.label}</span>
                                    {selectedProfileModules.has(item.id) && <CheckCircle2 className="h-4 w-4 text-primary" />}
                                  </div>
                                  
                                  {selectedProfileModules.has(item.id) && (
                                    <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-dashed" onClick={e => e.stopPropagation()}>
                                      {ACTION_LABELS.map(a => (
                                        <Badge 
                                          key={a.id} 
                                          variant="outline" 
                                          className={cn(
                                            "text-[8px] font-black uppercase cursor-pointer py-1 px-3",
                                            selectedProfilePerms.has(`${item.id}:${a.id}`) ? "bg-black text-white" : "text-muted-foreground opacity-40"
                                          )}
                                          onClick={() => {
                                            const newPerms = new Set(selectedProfilePerms);
                                            if (newPerms.has(`${item.id}:${a.id}`)) newPerms.delete(`${item.id}:${a.id}`);
                                            else newPerms.add(`${item.id}:${a.id}`);
                                            setSelectedProfilePerms(newPerms);
                                          }}
                                        >
                                          {a.label}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </Card>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-4 pt-12">
                        <div className="flex items-center gap-4">
                          <div className="h-px flex-1 bg-muted"></div>
                          <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">FILTROS Y PERSMISOS GLOBALES</span>
                          <div className="h-px flex-1 bg-muted"></div>
                        </div>
                        <div className="flex flex-wrap gap-4 justify-center">
                          {GLOBAL_PERMS.map(p => (
                            <Button 
                              key={p.id}
                              variant={selectedProfilePerms.has(p.id) ? "default" : "outline"}
                              className={cn("h-12 px-6 font-black uppercase text-[10px] rounded-xl border-2", selectedProfilePerms.has(p.id) ? "bg-black" : "")}
                              onClick={() => {
                                const newPerms = new Set(selectedProfilePerms);
                                if (newPerms.has(p.id)) newPerms.delete(p.id);
                                else newPerms.add(p.id);
                                setSelectedProfilePerms(newPerms);
                              }}
                            >
                              {p.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-12">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-black uppercase text-primary flex items-center gap-3">
                    <Bookmark className="h-6 w-6" /> Perfiles Registrados
                  </h3>
                </div>
                
                {isLoadingProfiles ? (
                  <div className="flex justify-center py-20"><Loader2 className="animate-spin h-10 w-10 opacity-20" /></div>
                ) : profiles.length === 0 ? (
                  <Card className="p-20 text-center border-4 border-dashed rounded-[3rem] opacity-30 bg-white">
                    <p className="font-black uppercase tracking-widest">No hay perfiles configurados</p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {profiles.map((p) => (
                      <Card key={p.id} className="shadow-lg border-none rounded-[2rem] overflow-hidden bg-white group">
                        <CardHeader className="bg-muted/30 border-b p-6">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg font-black uppercase leading-tight">{p.name}</CardTitle>
                              <CardDescription className="text-[9px] font-bold uppercase mt-1">{p.modules?.length || 0} Módulos Activos</CardDescription>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className={cn("h-10 w-10 rounded-xl hover:bg-amber-500 hover:text-white", isSyncing === p.id && "animate-pulse")} 
                                onClick={() => handleSyncProfileUsers(p)}
                                title="Sincronizar Permisos a Usuarios"
                              >
                                {isSyncing === p.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-black hover:text-white" onClick={() => handleEditProfile(p)}><Edit className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-destructive hover:bg-destructive hover:text-white" onClick={() => handleDeleteProfile(p.id)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-6">
                            <ScrollArea className="h-32">
                                <div className="flex flex-wrap gap-2">
                                    {(p.modules || []).map((m: string) => (
                                        <Badge key={m} variant="secondary" className="text-[8px] font-black uppercase bg-muted text-muted-foreground">
                                            {MODULE_STRUCTURE.flatMap(cat => cat.items).find(i => i.id === m)?.label || m}
                                        </Badge>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="produccion" className="animate-in fade-in duration-500 space-y-6">
            <Card className="border-none shadow-2xl overflow-hidden rounded-[2.5rem] bg-white">
              <CardHeader className={cn("text-white p-8", isMaintenanceActive ? "bg-amber-600" : "bg-slate-800")}>
                <CardTitle className="text-xl font-black uppercase flex items-center gap-3">
                    <ShieldAlert className="h-8 w-8" /> MODO DE MANTENIMIENTO
                </CardTitle>
                <CardDescription className="text-white/80 font-bold uppercase text-[10px] tracking-widest mt-2">
                    {isMaintenanceActive ? "EL SISTEMA ESTÁ ACTUALMENTE BLOQUEADO PARA LOS FUNCIONARIOS." : "EL SISTEMA ESTÁ OPERANDO NORMALMENTE."}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-10 space-y-8 flex flex-col items-center text-center">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] max-w-lg">
                    ESTO DESCONECTA AL 100% DE LOS USUARIOS INMEDIATAMENTE. SOLO LOS ADMINISTRADORES PODRÁN INGRESAR PARA REVISAR O HABILITAR EL SISTEMA. NO GENERA COSTOS DE FUNCIONAMIENTO.
                </p>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant={isMaintenanceActive ? "outline" : "destructive"} className={cn("h-20 px-12 text-xl font-black uppercase rounded-[1.5rem] shadow-2xl gap-4", isMaintenanceActive ? "border-amber-600 text-amber-600" : "")} disabled={isTogglingMaintenance}>
                            {isTogglingMaintenance ? <Loader2 className="h-8 w-8 animate-spin" /> : <ShieldAlert className="h-8 w-8" />} 
                            {isMaintenanceActive ? "DESACTIVAR MANTENIMIENTO" : "ACTIVAR MANTENIMIENTO"}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="font-black uppercase text-amber-600">
                                {isMaintenanceActive ? "¿REABRIR EL SISTEMA A TODOS?" : "¿CERRAR EL SISTEMA A NIVEL NACIONAL?"}
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-xs font-bold uppercase">
                                {isMaintenanceActive ? "Los divulgadores podrán volver a ingresar a su dashboard." : "Se forzará una pantalla de mantenimiento a todos los usuarios, desconectando sus navegadores."}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-8 gap-4">
                            <AlertDialogCancel className="h-14 rounded-xl font-black uppercase text-[10px] border-2">CANCELAR</AlertDialogCancel>
                            <AlertDialogAction onClick={handleToggleMaintenance} className={cn("h-14 flex-1 font-black uppercase text-[10px]", isMaintenanceActive ? "bg-amber-600" : "bg-destructive")}>
                                CONFIRMAR
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>

            <Card className="border-none shadow-2xl overflow-hidden rounded-[2.5rem] bg-white">
              <CardHeader className="bg-destructive text-white p-8">
                <CardTitle className="text-xl font-black uppercase flex items-center gap-3"><ShieldAlert className="h-8 w-8" /> RESETEO CIDEE</CardTitle>
                <CardDescription className="text-white/80 font-bold uppercase text-[10px] tracking-widest mt-2">ESTA OPERACIÓN ES IRREVERSIBLE - PREPARACIÓN PARA ENTORNO DE PRODUCCIÓN</CardDescription>
              </CardHeader>
              <CardContent className="p-10 space-y-8 flex flex-col items-center text-center">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] max-w-lg">ESTO BORRARÁ TODA LA ACTIVIDAD TRANSACCIONAL (SOLICITUDES, AGENDAS, INFORMES, MOVIMIENTOS Y ENCUESTAS).</p>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="h-20 px-12 text-xl font-black uppercase rounded-[1.5rem] shadow-2xl gap-4" disabled={isResetting}>
                            {isResetting ? <Loader2 className="h-8 w-8 animate-spin" /> : <Rocket className="h-8 w-8" />} RESETEO CIDEE
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="font-black uppercase text-destructive">¿CONFIRMAR RESETEO TOTAL?</AlertDialogTitle>
                            <AlertDialogDescription className="text-xs font-bold uppercase">Esta acción borrará permanentemente todas las transacciones CIDEE de la base de datos.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-8 gap-4">
                            <AlertDialogCancel className="h-14 rounded-xl font-black uppercase text-[10px] border-2">CANCELAR</AlertDialogCancel>
                            <AlertDialogAction onClick={handleResetCIDEE} className="h-14 flex-1 bg-destructive font-black uppercase text-[10px]">BORRAR TRANSACCIONES</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
