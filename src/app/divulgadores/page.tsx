
"use client";

import { useState, useMemo, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserPlus, Users, Loader2, Edit, Trash2, Search, AlertCircle, UserCircle, MapPin, Landmark, Navigation, FileUp, CheckCircle2, TableIcon, X, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirebase, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy, writeBatch } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type Dato, type Divulgador } from '@/lib/data';

export default function DivulgadoresPage() {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { user: currentUser, isUserLoading } = useUser();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedDist, setSelectedDist] = useState<string>('');

  // States para Importación
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [importPreview, setImportPreview] = useState<Omit<Divulgador, 'id' | 'fecha_registro'>[]>([]);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);

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
    if (profile) {
      if (hasDeptFilter || hasDistFilter) setSelectedDept(profile.departamento || '');
      if (hasDistFilter) setSelectedDist(profile.distrito || '');
    }
  }, [profile, hasDeptFilter, hasDistFilter]);

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData } = useCollection<Dato>(datosQuery);

  const departments = useMemo(() => {
    if (!datosData) return [];
    return [...new Set(datosData.map(d => d.departamento))].sort();
  }, [datosData]);

  const districts = useMemo(() => {
    if (!datosData || !selectedDept) return [];
    return [...new Set(datosData.filter(d => d.departamento === selectedDept).map(d => d.distrito))].sort();
  }, [datosData, selectedDept]);

  const divulQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !currentUser?.uid || !profile) return null;
    const colRef = collection(firestore, 'divulgadores');
    
    if (hasAdminFilter) return colRef;
    if (hasDeptFilter && profile.departamento) return query(colRef, where('departamento', '==', profile.departamento));
    if (hasDistFilter && profile.departamento && profile.distrito) {
        return query(colRef, where('departamento', '==', profile.departamento), where('distrito', '==', profile.distrito));
    }
    return null;
  }, [firestore, currentUser, isUserLoading, profile, hasAdminFilter, hasDeptFilter, hasDistFilter]);

  const { data: rawDivulgadores, isLoading: isLoadingDivul } = useCollection<Divulgador>(divulQuery);

  const divulgadores = useMemo(() => {
    if (!rawDivulgadores) return null;
    return [...rawDivulgadores].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [rawDivulgadores]);

  const filteredDivul = useMemo(() => {
    if (!divulgadores) return [];
    const term = searchTerm.toLowerCase().trim();
    return divulgadores.filter(d => d.nombre.toLowerCase().includes(term) || d.cedula.includes(term));
  }, [divulgadores, searchTerm]);

  const handleRegister = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !profile) return;
    
    const finalDept = hasAdminFilter ? selectedDept : (profile.departamento || '');
    const finalDist = (hasAdminFilter || hasDeptFilter) ? selectedDist : (profile.distrito || '');

    if (!finalDept || !finalDist) {
      toast({ variant: 'destructive', title: "Faltan datos" });
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const docData = {
      nombre: (formData.get('nombre') as string).toUpperCase(),
      cedula: formData.get('cedula') as string,
      vinculo: formData.get('vinculo') as any,
      departamento: finalDept,
      distrito: finalDist,
      fecha_registro: new Date().toISOString()
    };

    addDoc(collection(firestore, 'divulgadores'), docData)
      .then(() => {
        toast({ title: "¡Registrado!" });
        (e.target as HTMLFormElement).reset();
        setIsSubmitting(false);
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'divulgadores',
          operation: 'create',
          requestResourceData: docData
        }));
        setIsSubmitting(false);
      });
  };

  const handleDelete = (id: string) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'divulgadores', id);
    deleteDoc(docRef).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' }));
    });
  };

  // Lógica de Importación Reforzada
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsParsing(true);
    setImportErrors([]);
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

        // Validación de encabezados
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

        let skippedRows = 0;
        const mappedData: Omit<Divulgador, 'id' | 'fecha_registro'>[] = json.map((row, index) => {
          const cedulaRaw = String(row.CEDULA || '').trim();
          const nombreRaw = String(row['NOMBRES Y APELLIDOS'] || row.NOMBRE || '').trim();
          
          if (!cedulaRaw || !nombreRaw) {
            skippedRows++;
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
            throw new Error("No se encontraron registros válidos en el archivo. Verifique que el nombre y la cédula no estén vacíos.");
        }

        if (skippedRows > 0) {
            toast({ 
                variant: "warning", 
                title: "Registros incompletos", 
                description: `Se ignoraron ${skippedRows} filas porque les faltaba información básica.` 
            });
        }

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
    } catch (err) {
      toast({ variant: 'destructive', title: "Error al guardar en la nube" });
    } finally {
      setIsUploading(false);
    }
  };

  const resetImport = () => {
    setImportPreview([]);
    setImportFileName(null);
    setImportErrors([]);
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/5">
      <Header title="Directorio de Divulgadores" />
      <main className="flex-1 p-4 md:p-8 max-7xl mx-auto w-full space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-1 border-t-4 border-t-primary shadow-lg h-fit">
            <form onSubmit={handleRegister}>
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="uppercase font-black text-sm flex items-center gap-2 text-primary">
                  <UserPlus className="h-4 w-4" /> Registro Individual
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Nombre Completo</Label>
                  <Input name="nombre" required className="font-bold uppercase h-11 border-2" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Cédula</Label>
                  <Input name="cedula" required className="font-black h-11 border-2" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Vínculo</Label>
                  <Select name="vinculo" required defaultValue="CONTRATADO">
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
                      <Select name="departamento" required onValueChange={setSelectedDept} value={selectedDept}>
                        <SelectTrigger className="font-bold h-11"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                        <SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <div className="h-11 flex items-center px-3 font-black uppercase text-sm bg-muted/50 border-2 rounded-md">{profile?.departamento}</div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-primary">Distrito</Label>
                    {hasDistFilter ? (
                      <div className="h-11 flex items-center px-3 font-black uppercase text-sm bg-muted/50 border-2 rounded-md">{profile?.distrito}</div>
                    ) : (
                      <Select name="distrito" required onValueChange={setSelectedDist} value={selectedDist} disabled={!selectedDept && hasAdminFilter}>
                        <SelectTrigger className="font-bold h-11"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                        <SelectContent>{districts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/30 border-t p-4">
                <Button type="submit" className="w-full font-black uppercase h-12" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : "GUARDAR PERSONAL"}
                </Button>
              </CardFooter>
            </form>
          </Card>

          <Card className="lg:col-span-2 shadow-lg overflow-hidden border-none">
            <CardHeader className="bg-primary px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-col">
                <CardTitle className="uppercase font-black text-xs text-white">LISTA DE PERSONAL ({filteredDivul.length})</CardTitle>
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
                    placeholder="Buscar..." 
                    className="h-9 pl-9 text-[10px] bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-full focus-visible:ring-white/30" 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 bg-white">
                <Table>
                  <TableHeader className="bg-muted/50"><TableRow><TableHead className="text-[9px] font-black uppercase tracking-widest px-6">Divulgador</TableHead><TableHead className="text-[9px] font-black uppercase tracking-widest px-6">Jurisdicción</TableHead><TableHead className="text-[9px] font-black uppercase tracking-widest px-6">Vínculo</TableHead><TableHead className="text-right text-[9px] font-black uppercase tracking-widest px-6">Acción</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {isLoadingDivul ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow>
                    ) : filteredDivul.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-20 opacity-20"><Users className="h-12 w-12 mx-auto mb-2"/><p className="text-[10px] font-black uppercase">No hay personal registrado</p></TableCell></TableRow>
                    ) : (
                      filteredDivul.map(d => (
                        <TableRow key={d.id} className="border-b hover:bg-muted/30 transition-colors">
                          <TableCell className="py-4 px-6"><p className="font-black text-xs uppercase text-primary">{d.nombre}</p><p className="text-[9px] text-muted-foreground font-bold">C.I. {d.cedula}</p></TableCell>
                          <TableCell className="py-4 px-6"><p className="text-[10px] font-black uppercase">{d.departamento}</p><p className="text-[9px] font-bold text-muted-foreground">{d.distrito}</p></TableCell>
                          <TableCell className="py-4 px-6"><Badge variant="secondary" className="text-[8px] font-black uppercase bg-primary/5 text-primary border-none">{d.vinculo}</Badge></TableCell>
                          <TableCell className="text-right px-6">
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/40 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle className="font-black uppercase">¿Eliminar registro?</AlertDialogTitle><AlertDialogDescription className="text-xs">Esta acción es permanente y revocará al personal de las agendas futuras.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel className="font-bold text-[10px] uppercase">Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(d.id)} className="bg-destructive text-white font-black text-[10px] uppercase">Confirmar Eliminación</AlertDialogAction></AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Modal de Importación */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
          <DialogHeader className="bg-black text-white p-8">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                <FileUp className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black uppercase leading-none">Importar Divulgadores</DialogTitle>
                <DialogDescription className="text-white/60 font-bold uppercase text-[9px] tracking-widest mt-2">
                  Cargue masivamente el personal operativo desde Excel
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto p-8 space-y-8 bg-[#F8F9FA]">
            {importErrors.length > 0 && (
                <div className="bg-destructive/10 border-2 border-destructive p-6 rounded-2xl flex items-start gap-4 animate-in shake duration-500">
                    <AlertTriangle className="h-6 w-6 text-destructive shrink-0 mt-1" />
                    <div>
                        <p className="font-black uppercase text-sm text-destructive">Error en el archivo</p>
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
                    <p className="font-black uppercase text-sm text-primary">{isParsing ? "Procesando Archivo..." : "Seleccionar Archivo Excel"}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">CEDULA, VINCULO, NOMBRES Y APELLIDOS, DISTRITO, DEPARTAMENTO</p>
                  </div>
                </div>
                <Input type="file" accept=".xlsx,.csv" className="hidden" onChange={handleFileImport} disabled={isParsing} />
              </label>
            )}

            {importPreview.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-black uppercase text-xs">Archivo: {importFileName}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">{importPreview.length} Registros válidos detectados</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={resetImport} className="text-destructive font-black uppercase text-[10px] gap-2">
                    <X className="h-4 w-4" /> Cambiar Archivo
                  </Button>
                </div>

                <div className="border rounded-2xl overflow-hidden bg-white shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="text-[9px] font-black uppercase px-6">Cédula</TableHead>
                        <TableHead className="text-[9px] font-black uppercase px-6">Nombres y Apellidos</TableHead>
                        <TableHead className="text-[9px] font-black uppercase px-6">Jurisdicción</TableHead>
                        <TableHead className="text-[9px] font-black uppercase px-6">Vínculo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPreview.slice(0, 10).map((row, idx) => (
                        <TableRow key={idx} className="border-b last:border-0">
                          <TableCell className="px-6 py-3 font-bold text-[11px]">{row.cedula}</TableCell>
                          <TableCell className="px-6 py-3 font-black text-[11px] uppercase text-primary">{row.nombre}</TableCell>
                          <TableCell className="px-6 py-3">
                            <p className="text-[9px] font-black uppercase leading-none">{row.departamento}</p>
                            <p className="text-[8px] font-bold text-muted-foreground uppercase">{row.distrito}</p>
                          </TableCell>
                          <TableCell className="px-6 py-3"><Badge variant="outline" className="text-[8px] font-black uppercase">{row.vinculo}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {importPreview.length > 10 && (
                    <div className="p-4 bg-muted/20 text-center border-t">
                      <p className="text-[9px] font-black text-muted-foreground uppercase">Y {importPreview.length - 10} registros más...</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="bg-white border-t p-6 gap-4">
            <Button variant="outline" onClick={() => setIsImportModalOpen(false)} className="font-black uppercase text-[10px] h-12 px-8">Cancelar</Button>
            <Button 
              onClick={handleSaveImportData} 
              disabled={importPreview.length === 0 || isUploading}
              className="flex-1 font-black uppercase text-xs h-12 shadow-xl bg-black hover:bg-black/90"
            >
              {isUploading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <TableIcon className="mr-2 h-4 w-4" />}
              GUARDAR IMPORTACIÓN MASIVA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
