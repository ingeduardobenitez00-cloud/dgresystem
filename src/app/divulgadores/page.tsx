
"use client";

import { useState, useMemo, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserPlus, Users, Loader2, Edit, Trash2, Search, AlertCircle, UserCircle, MapPin, Landmark, Navigation } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirebase, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
import { type Dato, type Divulgador } from '@/lib/data';

export default function DivulgadoresPage() {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { user: currentUser, isUserLoading } = useUser();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedDist, setSelectedDist] = useState<string>('');

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

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/5">
      <Header title="Directorio de Divulgadores" />
      <main className="flex-1 p-4 md:p-8 max-7xl mx-auto w-full space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-1 border-t-4 border-t-primary shadow-lg h-fit">
            <form onSubmit={handleRegister}>
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="uppercase font-black text-sm flex items-center gap-2">
                  <UserPlus className="h-4 w-4" /> Nuevo Divulgador
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
            <CardHeader className="bg-primary px-6 py-4 flex flex-row items-center justify-between">
              <CardTitle className="uppercase font-black text-xs text-white">LISTA DE PERSONAL ({filteredDivul.length})</CardTitle>
              <Input 
                placeholder="Buscar..." 
                className="max-w-[200px] h-8 text-[10px] bg-white/10 border-white/20 text-white placeholder:text-white/40" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
            </CardHeader>
            <CardContent className="p-0 bg-white">
                <Table>
                  <TableHeader className="bg-muted/50"><TableRow><TableHead className="text-[9px] font-black uppercase">Divulgador</TableHead><TableHead className="text-[9px] font-black uppercase">Jurisdicción</TableHead><TableHead className="text-[9px] font-black uppercase">Vínculo</TableHead><TableHead className="text-right text-[9px] font-black uppercase">Acción</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredDivul.map(d => (
                      <TableRow key={d.id} className="border-b">
                        <TableCell className="py-4 px-6"><p className="font-black text-xs uppercase text-primary">{d.nombre}</p><p className="text-[9px] text-muted-foreground">C.I. {d.cedula}</p></TableCell>
                        <TableCell className="py-4 px-6"><p className="text-[10px] font-black uppercase">{d.departamento}</p><p className="text-[9px] font-bold text-muted-foreground">{d.distrito}</p></TableCell>
                        <TableCell className="py-4 px-6"><Badge variant="secondary" className="text-[8px] font-black uppercase">{d.vinculo}</Badge></TableCell>
                        <TableCell className="text-right px-6">
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/40 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle className="font-black uppercase">¿Eliminar registro?</AlertDialogTitle><AlertDialogDescription className="text-xs">Esta acción es permanente.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel className="font-bold text-[10px] uppercase">Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(d.id)} className="bg-destructive text-white font-black text-[10px] uppercase">Eliminar</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
