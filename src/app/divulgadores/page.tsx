
"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import Header from '@/components/header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  UserPlus, 
  Users, 
  Loader2, 
  Edit, 
  Trash2, 
  Search, 
  AlertCircle, 
  UserCircle, 
  MapPin, 
  Landmark, 
  Navigation, 
  FileUp, 
  CheckCircle2, 
  TableIcon, 
  X, 
  AlertTriangle, 
  FileWarning, 
  Filter,
  Building2,
  ChevronDown 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirebase, useCollectionOnce, useMemoFirebase, useUser, useCollectionPaginated } from '@/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy, writeBatch, getDocs, limit, startAt, endAt } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import * as XLSX from 'xlsx';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type Dato, type Divulgador } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';

const normalizeGeo = (str: string) => {
    if (!str) return '';
    // Quita códigos numéricos iniciales tipo "00 - " solo si hay algo después
    const withoutCodes = str.toUpperCase().replace(/^[\d\s-]*/, "");
    return withoutCodes.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "").trim();
};

const normalizeSearch = (str: string) => {
    if (!str) return '';
    // Limpieza básica para búsqueda (Nombre o CI)
    return str.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "").trim();
};

export default function DivulgadoresPage() {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { user: currentUser, isUserLoading } = useUser();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // States para filtros del listado
  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterDist, setFilterDist] = useState<string>('all');
  // States para la ejecución del filtro (manual)
  const [execDept, setExecDept] = useState<string>('all');
  const [execDist, setExecDist] = useState<string>('all');

  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedDist, setSelectedDist] = useState<string>('');
  const [editingDivulgador, setEditingDivulgador] = useState<Divulgador | null>(null);

  // Form Controlled States
  const [formNombre, setFormNombre] = useState('');
  const [formCedula, setFormCedula] = useState('');
  const [isSearchingCedula, setIsSearchingCedula] = useState(false);

  // States para Importación
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [importPreview, setImportPreview] = useState<Omit<Divulgador, 'id' | 'fecha_registro'>[]>([]);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [skippedDetails, setSkippedDetails] = useState<{row: number, reason: string}[]>([]);

  const profile = currentUser?.profile;

  const hasAdminFilter = useMemo(() => 
    ['admin', 'director'].includes(profile?.role || '') || profile?.permissions?.includes('admin_filter'),
    [profile]
  );
  
  const hasDeptFilter = useMemo(() => 
    !hasAdminFilter && profile?.permissions?.includes('department_filter'),
    [profile, hasAdminFilter]
  );

  const hasDistFilter = useMemo(() => 
    !hasAdminFilter && !hasDeptFilter && (profile?.permissions?.includes('district_filter') || profile?.role === 'jefe' || profile?.role === 'funcionario'),
    [profile, hasAdminFilter, hasDeptFilter]
  );

  useEffect(() => {
    if (profile && !editingDivulgador) {
      if (hasDeptFilter || hasDistFilter) setSelectedDept(profile.departamento || '');
      if (hasDistFilter) setSelectedDist(profile.distrito || '');
    }
  }, [profile, hasDeptFilter, hasDistFilter, editingDivulgador]);

  useEffect(() => {
    if (editingDivulgador) {
      setFormNombre(editingDivulgador.nombre);
      setFormCedula(editingDivulgador.cedula);
    } else {
      setFormNombre('');
      setFormCedula('');
    }
  }, [editingDivulgador]);

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData } = useCollectionOnce<Dato>(datosQuery);

  const departments = useMemo(() => {
    let depts = datosData ? [...new Set(datosData.map(d => d.departamento))] : [];
    if (hasAdminFilter && !depts.includes('SEDE CENTRAL')) {
        depts.push('SEDE CENTRAL');
    }
    return depts.sort();
  }, [datosData, hasAdminFilter]);

  const districts = useMemo(() => {
    if (!datosData || !selectedDept) return [];
    return [...new Set(datosData.filter(d => normalizeGeo(d.departamento) === normalizeGeo(selectedDept)).map(d => d.distrito))].sort();
  }, [datosData, selectedDept]);

  // Distritos para el filtro de la tabla
  const filterDistrictsList = useMemo(() => {
    if (!datosData || filterDept === 'all') return [];
    const target = normalizeGeo(filterDept);
    return [...new Set(datosData.filter(d => normalizeGeo(d.departamento) === target).map(d => d.distrito))].sort();
  }, [datosData, filterDept]);

  const divulQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !currentUser?.uid || !profile) return null;
    const colRef = collection(firestore, 'divulgadores');
    
    let constraints: any[] = [];
    
    // Base segmentation must stay in the query for security/performance
    if (!hasAdminFilter) {
        const normDept = normalizeGeo(profile.departamento || '');
        const variations = Array.from(new Set([
            profile.departamento,
            normDept,
            profile.departamento?.replace(/^\d+\s*-\s*/, ""),
            profile.departamento?.split('-').pop()?.trim()
        ])).filter(Boolean);

        if (hasDeptFilter && profile.departamento) {
            constraints.push(where('departamento', 'in', variations));
        } else if (hasDistFilter && profile.departamento && profile.distrito) {
            constraints.push(where('departamento', 'in', variations));
        }
    }

    // Filtro de Departamento (Admin) con variaciones - USAMOS execDept
    if (execDept !== 'all' && hasAdminFilter) {
        const norm = normalizeGeo(execDept);
        const variations = Array.from(new Set([
            execDept,
            norm,
            execDept.replace(/^\d+\s*-\s*/, ""),
            execDept.split('-').pop()?.trim(),
            // Agregamos con tildes si el norm no tiene pero sabemos los comunes (esto es manual pero efectivo para los críticos)
            norm === 'ASUNCION' ? 'ASUNCIÓN' : null,
            norm === 'CONCEPCION' ? 'CONCEPCIÓN' : null,
            norm === 'CAAGUAZU' ? 'CAAGUAZÚ' : null,
            norm === 'GUAIRA' ? 'GUAIRÁ' : null,
            norm === 'ITAPUA' ? 'ITAPÚA' : null,
            norm === 'MISIONES' ? 'MISIONES' : null,
            norm === 'PARAGUARI' ? 'PARAGUARÍ' : null,
            norm === 'ALTO PARANA' ? 'ALTO PARANÁ' : null,
            norm === 'NEMBY' ? 'ÑEMBY' : null
        ])).filter(Boolean) as string[];
        
        constraints.push(where('departamento', 'in', variations));
    }

    // Restauramos orderBy para usar índices compuestos una vez creados
    constraints.push(orderBy('nombre'));

    return query(colRef, ...constraints);
  }, [firestore, currentUser, isUserLoading, profile, hasAdminFilter, hasDeptFilter, hasDistFilter, execDept]);

  const { 
    data: filteredDivul, 
    isLoading: isLoadingDivul, 
    hasMore, 
    loadMore, 
    isLoadingMore 
  } = useCollectionPaginated<Divulgador>(divulQuery, 100); // Aumentamos a 100 para mejor búsqueda local

  const displayList = useMemo(() => {
    let list = filteredDivul;

    // Filtro local de Distrito (con normalización agresiva)
    if (filterDist !== 'all') {
        const targetDist = normalizeGeo(filterDist);
        list = list.filter(d => normalizeGeo(d.distrito || '') === targetDist);
    } else if (hasDistFilter && profile?.distrito) {
        const targetDist = normalizeGeo(profile.distrito);
        list = list.filter(d => normalizeGeo(d.distrito || '') === targetDist);
    }

    // Filtro local de Búsqueda (Cualquier coincidencia)
    if (searchTerm.trim()) {
        const term = normalizeSearch(searchTerm);
        list = list.filter(d => 
            normalizeSearch(d.nombre || '').includes(term) || 
            normalizeSearch(d.cedula || '').includes(term)
        );
    }

    return list.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  }, [filteredDivul, searchTerm, filterDist, hasDistFilter, profile]);

  const searchCedulaInPadron = useCallback(async (cedulaInput: string) => {
    const cleanTerm = (cedulaInput || '').trim().toUpperCase();
    if (!firestore || cleanTerm.length < 4) return;
    
    setIsSearchingCedula(true);
    try {
      const q = query(collection(firestore, 'padron'), where('cedula', '==', cleanTerm), limit(1));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const found = snap.docs[0].data();
        setFormNombre(`${found.nombre} ${found.apellido}`.toUpperCase());
        toast({ title: "Datos encontrados", description: "Información recuperada del padrón electoral." });
      } else {
        toast({ variant: 'destructive', title: "No encontrado", description: "Verifique si el número ingresado es correcto." });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSearchingCedula(false);
    }
  }, [firestore, toast]);

  const resetImport = useCallback(() => {
    setImportPreview([]);
    setImportFileName(null);
    setImportErrors([]);
    setSkippedDetails([]);
  }, []);

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !profile) return;
    
    const finalDept = hasAdminFilter ? selectedDept : (profile.departamento || '');
    const finalDist = (hasAdminFilter || hasDeptFilter) ? selectedDist : (profile.distrito || '');

    if (!finalDept || !finalDist) {
      toast({ variant: 'destructive', title: "Faltan datos de ubicación" });
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const docData = {
      nombre: (formData.get('nombre') as string).toUpperCase(),
      cedula: (formData.get('cedula') as string).toUpperCase(),
      vinculo: formData.get('vinculo') as any,
      departamento: finalDept,
      distrito: finalDist,
    };

    if (editingDivulgador) {
      const docRef = doc(firestore, 'divulgadores', editingDivulgador.id);
      updateDoc(docRef, docData)
        .then(() => {
          toast({ title: "¡Actualizado!" });
          setEditingDivulgador(null);
          setIsSubmitting(false);
          (e.target as HTMLFormElement).reset();
        })
        .catch(async (error) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: docData
          }));
          setIsSubmitting(false);
        });
    } else {
      const newDocData = { 
        ...docData, 
        fecha_registro: new Date().toISOString() 
      };
      addDoc(collection(firestore, 'divulgadores'), newDocData)
        .then(() => {
          toast({ title: "¡Registrado!" });
          (e.target as HTMLFormElement).reset();
          setIsSubmitting(false);
        })
        .catch(async (error) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'divulgadores',
            operation: 'create',
            requestResourceData: newDocData
          }));
          setIsSubmitting(false);
        });
    }
  };

  const handleEditClick = useCallback((d: Divulgador) => {
    setEditingDivulgador(d);
    setSelectedDept(d.departamento);
    setSelectedDist(d.distrito);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleDelete = useCallback((id: string) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'divulgadores', id);
    deleteDoc(docRef).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' }));
    });
  }, [firestore]);

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsParsing(true);
    setImportErrors([]);
    setSkippedDetails([]);
    setImportFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        if (workbook.SheetNames.length === 0) {
            throw new Error("El archivo Excel no contiene hojas de trabajo.");
        }

        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(sheet);

        if (json.length === 0) {
            throw new Error("El archivo Excel parece estar vacío.");
        }

        const firstRow = json[0];
        const headers = Object.keys(firstRow).map(h => h.toUpperCase().trim());
        const requiredColumns = ['CEDULA', 'DISTRITO', 'DEPARTAMENTO'];
        const hasNameHeader = headers.includes('NOMBRES Y APELLIDOS') || headers.includes('NOMBRE');
        
        const missing = requiredColumns.filter(col => !headers.includes(col));
        if (!hasNameHeader) missing.push('NOMBRES Y APELLIDOS');

        if (missing.length > 0) {
            setImportErrors([`Estructura incorrecta. Faltan las siguientes columnas obligatorias: ${missing.join(', ')}`]);
            setIsParsing(false);
            return;
        }

        const errors: {row: number, reason: string}[] = [];
        const mappedData: Omit<Divulgador, 'id' | 'fecha_registro'>[] = json.map((row, index) => {
          const excelRow = index + 2; 
          const cedulaRaw = String(row.CEDULA || '').trim().toUpperCase();
          const nombreRaw = String(row['NOMBRES Y APELLIDOS'] || row.NOMBRE || '').trim();
          
          if (!cedulaRaw && !nombreRaw) {
            errors.push({ row: excelRow, reason: "Fila vacía" });
            return null;
          }
          if (!cedulaRaw) {
            errors.push({ row: excelRow, reason: "Falta Cédula" });
            return null;
          }
          if (!nombreRaw) {
            errors.push({ row: excelRow, reason: "Falta Nombre y Apellido" });
            return null;
          }

          let vinculo: any = String(row.VINCULO || '').toUpperCase();
          if (!['PERMANENTE', 'CONTRATADO', 'COMISIONADO'].includes(vinculo)) {
            vinculo = 'CONTRATADO'; 
          }

          return {
            cedula: cedulaRaw,
            nombre: nombreRaw.toUpperCase(),
            vinculo: vinculo,
            distrito: String(row.DISTRITO || '').trim().toUpperCase(),
            departamento: String(row.DEPARTAMENTO || '').trim().toUpperCase(),
          };
        }).filter(d => d !== null) as Omit<Divulgador, 'id' | 'fecha_registro'>[];

        if (mappedData.length === 0) {
            throw new Error("No se encontraron registros válidos en el archivo.");
        }

        setSkippedDetails(errors);
        setImportPreview(mappedData);
      } catch (err: any) {
        setImportErrors([err.message || "Error desconocido al procesar el Excel."]);
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveImportData = async () => {
    if (!firestore || importPreview.length === 0) return;
    setIsUploading(true);
    const colRef = collection(firestore, 'divulgadores');
    const BATCH_SIZE = 100;

    try {
      for (let i = 0; i < importPreview.length; i += BATCH_SIZE) {
        const batch = writeBatch(firestore);
        const chunk = importPreview.slice(i, i + BATCH_SIZE);
        
        chunk.forEach(item => {
          const newDoc = doc(colRef);
          batch.set(newDoc, {
            ...item,
            fecha_registro: new Date().toISOString()
          });
        });
        
        await batch.commit();
      }

      toast({ title: "Importación Exitosa", description: `${importPreview.length} divulgadores cargados.` });
      setIsImportModalOpen(false);
      setImportPreview([]);
      setImportFileName(null);
      setImportErrors([]);
      setSkippedDetails([]);
    } catch (err) {
      toast({ variant: 'destructive', title: "Error al guardar en la nube" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted/5">
      <Header title="Directorio de Divulgadores" />
      <main className="flex-1 p-4 md:p-8 max-7xl mx-auto w-full space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className={cn("lg:col-span-1 border-t-4 shadow-lg h-fit", editingDivulgador ? "border-t-black" : "border-t-primary")}>
            <form key={editingDivulgador?.id || 'new'} onSubmit={handleSave}>
              <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="uppercase font-black text-sm flex items-center gap-2 text-primary">
                    {editingDivulgador ? <Edit className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                    {editingDivulgador ? 'Editar Personal' : 'Registro Individual'}
                  </CardTitle>
                </div>
                {editingDivulgador && (
                  <Button variant="ghost" size="icon" onClick={() => { setEditingDivulgador(null); setSelectedDept(profile?.departamento || ''); setSelectedDist(profile?.distrito || ''); }} className="h-8 w-8"><X className="h-4 w-4"/></Button>
                )}
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Cédula</Label>
                  <div className="flex gap-2">
                    <Input 
                      name="cedula" 
                      required 
                      value={formCedula}
                      onChange={e => setFormCedula(e.target.value.toUpperCase())}
                      className="font-black h-11 border-2 uppercase" 
                    />
                    <Button 
                      type="button" 
                      variant="secondary" 
                      size="icon" 
                      className="h-11 w-11 shrink-0" 
                      onClick={() => searchCedulaInPadron(formCedula)}
                      disabled={isSearchingCedula || formCedula.length < 4}
                    >
                      {isSearchingCedula ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Nombre Completo</Label>
                  <Input 
                    name="nombre" 
                    required 
                    value={formNombre}
                    onChange={e => setFormNombre(e.target.value.toUpperCase())}
                    className="font-bold uppercase h-11 border-2" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Vínculo</Label>
                  <Select name="vinculo" required defaultValue={editingDivulgador?.vinculo || "CONTRATADO"}>
                    <SelectTrigger className="font-bold h-11 border-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERMANENTE">PERMANENTE</SelectItem>
                      <SelectItem value="CONTRATADO">CONTRATADO</SelectItem>
                      <SelectItem value="COMISIONADO">COMISIONADO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-primary">Departamento</Label>
                    {hasAdminFilter ? (
                      <Select name="departamento" required onValueChange={(v) => { setSelectedDept(v); setSelectedDist(''); }} value={selectedDept}>
                        <SelectTrigger className="font-bold h-11"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                        <SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <div className="h-11 flex items-center px-3 font-black uppercase text-sm bg-muted/50 border-2 rounded-md">{profile?.departamento}</div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-primary">Distrito / Oficina</Label>
                    {hasDistFilter ? (
                      <div className="h-11 flex items-center px-3 font-black uppercase text-sm bg-muted/50 border-2 rounded-md">{profile?.distrito}</div>
                    ) : (
                      <Select name="distrito" required onValueChange={setSelectedDist} value={selectedDist} disabled={!selectedDept && hasAdminFilter}>
                        <SelectTrigger className="font-bold h-11"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                        <SelectContent>
                          {districts.length === 0 ? (
                            <div className="p-4 text-center text-[10px] font-black uppercase text-muted-foreground">No hay oficinas registradas</div>
                          ) : (
                            districts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/30 border-t p-4">
                <div className="flex gap-2 w-full">
                  {editingDivulgador && (
                    <Button variant="outline" type="button" onClick={() => { setEditingDivulgador(null); setSelectedDept(profile?.departamento || ''); setSelectedDist(profile?.distrito || ''); }} className="flex-1 font-black uppercase h-12 border-2">CANCELAR</Button>
                  )}
                  <Button type="submit" className="flex-[2] font-black uppercase h-12" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : editingDivulgador ? "ACTUALIZAR" : "GUARDAR PERSONAL"}
                  </Button>
                </div>
              </CardFooter>
            </form>
          </Card>

          <Card className="lg:col-span-2 shadow-lg overflow-hidden border-none">
            <CardHeader className="bg-primary px-6 py-4 flex flex-col space-y-4">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex flex-col">
                  <CardTitle className="uppercase font-black text-xs text-white">LISTA DE PERSONAL ({displayList.length})</CardTitle>
                  <CardDescription className="text-white/60 text-[9px] uppercase font-bold">Personal operativo habilitado para capacitaciones</CardDescription>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20 font-black uppercase text-[10px] gap-2 h-9"
                    onClick={() => { resetImport(); setIsImportModalOpen(true); }}
                  >
                    <FileUp className="h-3.5 w-3.5" /> Importar Excel
                  </Button>
                  <div className="relative flex-1 md:w-48">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
                    <Input 
                      placeholder="Buscar por nombre o CI..." 
                      className="h-9 pl-9 text-[10px] bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-full focus-visible:ring-white/30" 
                      value={searchTerm} 
                      onChange={e => setSearchTerm(e.target.value)} 
                    />
                  </div>
                </div>
              </div>

              {/* Filtros de Ubicación para el Listado */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-white/10 items-end">
                <div className="flex items-center gap-2">
                  <Landmark className="h-3.5 w-3.5 text-white/40" />
                  <Select value={filterDept} onValueChange={(v) => { setFilterDept(v); setFilterDist('all'); }}>
                    <SelectTrigger className="h-10 bg-white/10 border-white/20 text-white text-[10px] font-black uppercase">
                      <SelectValue placeholder="DPTO: TODOS" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-[10px] font-bold">DPTO: TODOS</SelectItem>
                      {departments.map(d => <SelectItem key={d} value={d} className="text-[10px] font-bold">{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-white/40" />
                  <Select value={filterDist} onValueChange={setFilterDist} disabled={filterDept === 'all'}>
                    <SelectTrigger className="h-10 bg-white/10 border-white/20 text-white text-[10px] font-black uppercase">
                      <SelectValue placeholder="DIST: TODOS" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-[10px] font-bold">DIST: TODOS</SelectItem>
                      {filterDistrictsList.map(d => <SelectItem key={d} value={d} className="text-[10px] font-bold">{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={() => {
                    setExecDept(filterDept);
                    setExecDist(filterDist);
                  }}
                  disabled={isLoadingDivul}
                  className="h-10 bg-white text-primary hover:bg-white/90 font-black uppercase text-[10px] shadow-lg group"
                >
                  {isLoadingDivul ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Filter className="h-3 w-3 mr-2 transition-transform group-hover:scale-110" />}
                  EJECUTAR FILTRO
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 bg-white">
                <Table>
                  <TableHeader className="bg-muted/50"><TableRow><TableHead className="text-[9px] font-black uppercase tracking-widest px-6">Divulgador</TableHead><TableHead className="text-[9px] font-black uppercase tracking-widest px-6">Jurisdicción</TableHead><TableHead className="text-[9px] font-black uppercase tracking-widest px-6">Vínculo</TableHead><TableHead className="text-right text-[9px] font-black uppercase tracking-widest px-6">Acción</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {isLoadingDivul ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow>
                    ) : displayList.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-20 opacity-20"><Users className="h-12 w-12 mx-auto mb-2"/><p className="text-[10px] font-black uppercase">No se encontraron resultados</p></TableCell></TableRow>
                    ) : (
                      displayList.map(d => (
                        <TableRow key={d.id} className="border-b hover:bg-muted/30 transition-colors">
                          <TableCell className="py-4 px-6"><p className="font-black text-xs uppercase text-primary">{d.nombre}</p><p className="text-[9px] text-muted-foreground font-bold">C.I. {d.cedula}</p></TableCell>
                          <TableCell className="py-4 px-6"><p className="text-[10px] font-black uppercase">{d.departamento}</p><p className="text-[9px] font-bold text-muted-foreground">{d.distrito}</p></TableCell>
                          <TableCell className="py-4 px-6"><Badge variant="secondary" className="text-[8px] font-black uppercase bg-primary/5 text-primary border-none">{d.vinculo}</Badge></TableCell>
                          <TableCell className="text-right px-6">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-primary/40 hover:text-primary"
                                onClick={() => handleEditClick(d)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/40 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader><AlertDialogTitle className="font-black uppercase">¿Eliminar registro?</AlertDialogTitle><AlertDialogDescription className="text-xs">Esta acción es permanente y revocará al personal de las agendas futuras.</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter><AlertDialogCancel className="font-bold text-[10px] uppercase">Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(d.id)} className="bg-destructive text-white font-black text-[10px] uppercase">Confirmar Eliminación</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                {hasMore && (
                  <div className="p-4 bg-muted/10 border-t flex justify-center">
                    <Button 
                      variant="outline" 
                      onClick={loadMore} 
                      disabled={isLoadingMore}
                      className="font-black uppercase text-[10px] gap-2 h-10 border-2 px-8"
                    >
                      {isLoadingMore ? <Loader2 className="animate-spin h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      Cargar más personal
                    </Button>
                  </div>
                )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Modal de Importación */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
          <DialogHeader className="bg-black text-white p-8">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                <FileUp className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black uppercase leading-none">Importar Divulgadores</DialogTitle>
                <DialogDescription className="text-white/60 font-bold uppercase text-[9px] tracking-widest mt-2">
                  Motor de carga masiva institucional (Admite cédulas alfanuméricas)
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto p-8 space-y-8 bg-[#F8F9FA]">
            {importErrors.length > 0 && (
                <div className="bg-destructive/10 border-2 border-destructive p-6 rounded-2xl flex items-start gap-4 animate-in shake duration-500">
                    <AlertTriangle className="h-6 w-6 text-destructive shrink-0 mt-1" />
                    <div>
                        <p className="font-black uppercase text-sm text-destructive">Error crítico en el archivo</p>
                        {importErrors.map((err, idx) => <p key={idx} className="text-xs font-bold uppercase text-destructive/80 mt-1">{err}</p>)}
                        <Button variant="outline" size="sm" onClick={resetImport} className="mt-4 border-destructive text-destructive hover:bg-destructive hover:text-white font-black uppercase text-[10px]">REINTENTAR CARGA</Button>
                    </div>
                </div>
            )}

            {!importPreview.length && importErrors.length === 0 && (
              <label className="flex flex-col items-center justify-center h-64 border-4 border-dashed rounded-[2rem] border-primary/10 bg-white cursor-pointer hover:bg-primary/[0.02] hover:border-primary/30 transition-all group">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {isParsing ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <FileUp className="h-8 w-8 text-primary/40" />}
                  </div>
                  <div className="text-center">
                    <p className="font-black uppercase text-sm text-primary">{isParsing ? "Analizando Registros..." : "Seleccionar Archivo Excel"}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Columnas: CEDULA, VINCULO, NOMBRES Y APELLIDOS, DISTRITO, DEPARTAMENTO</p>
                  </div>
                </div>
                <Input type="file" accept=".xlsx,.csv" className="hidden" onChange={handleFileImport} disabled={isParsing} />
              </label>
            )}

            {importPreview.length > 0 && (
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-black uppercase text-xs">Análisis de: {importFileName}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">{importPreview.length} Registros listos para cargar</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={resetImport} className="text-destructive font-black uppercase text-[10px] gap-2">
                    <X className="h-4 w-4" /> Cancelar y Cambiar
                  </Button>
                </div>

                {skippedDetails.length > 0 && (
                    <Card className="border-2 border-amber-200 bg-amber-50/50 rounded-2xl overflow-hidden">
                        <CardHeader className="bg-amber-100/50 py-3 px-6 flex flex-row items-center gap-2">
                            <FileWarning className="h-4 w-4 text-amber-600" />
                            <CardTitle className="text-[10px] font-black uppercase text-amber-700 tracking-wider">REGISTROS IGNORADOS ({skippedDetails.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-32">
                                <div className="divide-y divide-amber-100">
                                    {skippedDetails.map((s, idx) => (
                                        <div key={idx} className="px-6 py-2 flex items-center justify-between text-[10px] font-bold uppercase text-amber-800/70">
                                            <span>Excel Fila: {s.row}</span>
                                            <span className="bg-amber-200/50 px-2 py-0.5 rounded italic">{s.reason}</span>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                )}

                <div className="border-2 rounded-2xl overflow-hidden bg-white shadow-sm">
                  <div className="bg-muted/30 px-6 py-3 border-b">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Vista previa de los primeros 10 registros</p>
                  </div>
                  <Table>
                    <TableHeader className="bg-white">
                      <TableRow>
                        <TableHead className="text-[9px] font-black uppercase px-6">Cédula</TableHead>
                        <TableHead className="text-[9px] font-black uppercase px-6">Nombres y Apellidos</TableHead>
                        <TableHead className="text-[9px] font-black uppercase px-6">Jurisdicción</TableHead>
                        <TableHead className="text-[9px] font-black uppercase px-6 text-center">Vínculo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPreview.slice(0, 10).map((row, idx) => (
                        <TableRow key={idx} className="border-b last:border-0">
                          <TableCell className="px-6 py-3 font-bold text-[11px] uppercase">{row.cedula}</TableCell>
                          <TableCell className="px-6 py-3 font-black text-[11px] uppercase text-primary">{row.nombre}</TableCell>
                          <TableCell className="px-6 py-3">
                            <p className="text-[9px] font-black uppercase leading-none">{row.departamento}</p>
                            <p className="text-[8px] font-bold text-muted-foreground uppercase">{row.distrito}</p>
                          </TableCell>
                          <TableCell className="px-6 py-3 text-center"><Badge variant="secondary" className="text-[8px] font-black uppercase bg-primary/5 text-primary border-none">{row.vinculo}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {importPreview.length > 10 && (
                    <div className="p-4 bg-muted/10 text-center border-t">
                      <p className="text-[9px] font-black text-muted-foreground uppercase">... Y {importPreview.length - 10} registros adicionales ...</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="bg-white border-t p-6 gap-4">
            <Button variant="outline" onClick={() => setIsImportModalOpen(false)} className="font-black uppercase text-[10px] h-12 px-8 rounded-xl border-2">Cerrar</Button>
            <Button 
              onClick={handleSaveImportData} 
              disabled={importPreview.length === 0 || isUploading}
              className="flex-1 font-black uppercase text-xs h-12 shadow-xl bg-black hover:bg-black/90 rounded-xl"
            >
              {isUploading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <TableIcon className="mr-2 h-4 w-4" />}
              CONFIRMAR CARGA DE {importPreview.length} REGISTROS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
