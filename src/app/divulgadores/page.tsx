
"use client";

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserPlus, Users, Loader2, Edit, Trash2, Search, Building2, Landmark, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirebase, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
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
import { cn } from '@/lib/utils';

export default function DivulgadoresPage() {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { user: currentUser, isUserLoading } = useUser();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingDivulgador, setEditingDivulgador] = useState<Divulgador | null>(null);

  // Geo Data
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

  // Divulgadores Data
  const divulQuery = useMemoFirebase(() => {
    if (!firestore || !currentUser) return null;
    const colRef = collection(firestore, 'divulgadores');
    // Si es Jefe, solo ve los de su distrito
    if (currentUser.profile?.role === 'jefe' || currentUser.profile?.role === 'funcionario') {
        return query(colRef, where('distrito', '==', currentUser.profile.distrito || ''));
    }
    return query(colRef, orderBy('nombre'));
  }, [firestore, currentUser]);

  const { data: divulgadores, isLoading: isLoadingDivul } = useCollection<Divulgador>(divulQuery);

  const filteredDivul = useMemo(() => {
    if (!divulgadores) return [];
    const term = searchTerm.toLowerCase().trim();
    return divulgadores.filter(d => 
      d.nombre.toLowerCase().includes(term) || 
      d.cedula.includes(term) || 
      d.distrito.toLowerCase().includes(term)
    );
  }, [divulgadores, searchTerm]);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !currentUser) return;
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const docData = {
      nombre: formData.get('nombre') as string,
      cedula: formData.get('cedula') as string,
      vinculo: formData.get('vinculo') as any,
      departamento: formData.get('departamento') as string,
      distrito: formData.get('distrito') as string,
      fecha_registro: new Date().toISOString()
    };

    try {
      await addDoc(collection(firestore, 'divulgadores'), docData);
      toast({ title: "¡Divulgador Registrado!", description: "Ahora puede ser asignado en la agenda." });
      (e.target as HTMLFormElement).reset();
      setSelectedDept('');
    } catch (err) {
      toast({ variant: 'destructive', title: "Error al guardar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !editingDivulgador) return;
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const updatedData = {
      nombre: formData.get('edit-nombre') as string,
      cedula: formData.get('edit-cedula') as string,
      vinculo: formData.get('edit-vinculo') as any,
      departamento: formData.get('edit-departamento') as string,
      distrito: formData.get('edit-distrito') as string,
    };

    try {
      await updateDoc(doc(firestore, 'divulgadores', editingDivulgador.id), updatedData);
      toast({ title: "Registro Actualizado" });
      setEditModalOpen(false);
    } catch (err) {
      toast({ variant: 'destructive', title: "Error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'divulgadores', id));
      toast({ title: "Registro eliminado" });
    } catch (err) {
      toast({ variant: 'destructive', title: "Error al eliminar" });
    }
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/5">
      <Header title="Gestión de Divulgadores" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Formulario de Registro */}
          <Card className="lg:col-span-1 border-t-4 border-t-primary shadow-lg h-fit">
            <form onSubmit={handleRegister}>
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="uppercase font-black text-sm flex items-center gap-2">
                  <UserPlus className="h-4 w-4" /> Nuevo Divulgador
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase">Registro de personal operativo CIDEE.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Nombre Completo</Label>
                  <Input name="nombre" required className="font-bold" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Cédula de Identidad</Label>
                  <Input name="cedula" required className="font-bold" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Vínculo Laboral</Label>
                  <Select name="vinculo" required defaultValue="CONTRATADO">
                    <SelectTrigger className="font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERMANENTE">PERMANENTE</SelectItem>
                      <SelectItem value="CONTRATADO">CONTRATADO</SelectItem>
                      <SelectItem value="COMISIONADO">COMISIONADO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Departamento</Label>
                  <Select name="departamento" required onValueChange={setSelectedDept} value={selectedDept}>
                    <SelectTrigger className="font-bold">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Distrito / Oficina</Label>
                  <Select name="distrito" required disabled={!selectedDept}>
                    <SelectTrigger className="font-bold">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {districts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/30 border-t p-4">
                <Button type="submit" className="w-full font-black uppercase text-xs h-11 shadow-md" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : "GUARDAR DIVULGADOR"}
                </Button>
              </CardFooter>
            </form>
          </Card>

          {/* Listado */}
          <Card className="lg:col-span-2 shadow-lg border-none">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="uppercase font-black text-sm flex items-center gap-2">
                <Users className="h-4 w-4" /> Directorio Operativo
              </CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Buscar por nombre o C.I..." className="pl-9 h-9 text-[10px] font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto border-t">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="text-[9px] font-black uppercase">Divulgador</TableHead>
                      <TableHead className="text-[9px] font-black uppercase">Jurisdicción</TableHead>
                      <TableHead className="text-[9px] font-black uppercase">Vínculo</TableHead>
                      <TableHead className="text-right text-[9px] font-black uppercase">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingDivul ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" /></TableCell></TableRow>
                    ) : filteredDivul.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground text-[10px] font-bold uppercase">No hay divulgadores registrados.</TableCell></TableRow>
                    ) : filteredDivul.map(d => (
                      <TableRow key={d.id} className="group/row">
                        <TableCell className="py-3">
                          <p className="font-black text-xs uppercase leading-none">{d.nombre}</p>
                          <p className="text-[9px] text-muted-foreground font-bold mt-1">C.I. {d.cedula}</p>
                        </TableCell>
                        <TableCell className="py-3">
                          <p className="text-[10px] font-black uppercase text-primary">{d.departamento}</p>
                          <p className="text-[9px] font-bold text-muted-foreground">{d.distrito}</p>
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge variant="secondary" className="text-[8px] font-black uppercase">{d.vinculo}</Badge>
                        </TableCell>
                        <TableCell className="text-right py-3">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingDivulgador(d); setSelectedDept(d.departamento); setEditModalOpen(true); }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="uppercase font-black text-destructive">¿Eliminar registro?</AlertDialogTitle>
                                  <AlertDialogDescription className="text-xs font-bold uppercase">Esta acción eliminará al divulgador de la base de datos de asignación.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="font-bold text-xs uppercase">Cancelar</AlertDialogCancel>
                                  <AlertDialogAction className="bg-destructive font-black text-xs uppercase" onClick={() => handleDelete(d.id)}>Eliminar</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Modal Editar */}
      <Dialog open={isEditModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-primary text-white shrink-0">
            <DialogTitle className="uppercase font-black text-xl">Editar Divulgador</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase">Nombre Completo</Label>
              <Input name="edit-nombre" defaultValue={editingDivulgador?.nombre} required className="font-bold" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase">Cédula de Identidad</Label>
              <Input name="edit-cedula" defaultValue={editingDivulgador?.cedula} required className="font-bold" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase">Vínculo Laboral</Label>
              <Select name="edit-vinculo" required defaultValue={editingDivulgador?.vinculo}>
                <SelectTrigger className="font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERMANENTE">PERMANENTE</SelectItem>
                  <SelectItem value="CONTRATADO">CONTRATADO</SelectItem>
                  <SelectItem value="COMISIONADO">COMISIONADO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase">Departamento</Label>
                <Select name="edit-departamento" required onValueChange={setSelectedDept} defaultValue={editingDivulgador?.departamento}>
                  <SelectTrigger className="font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase">Distrito</Label>
                <Select name="edit-distrito" required defaultValue={editingDivulgador?.distrito} disabled={!selectedDept}>
                  <SelectTrigger className="font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {districts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-4 gap-2">
              <DialogClose asChild><Button variant="outline" className="font-bold text-xs uppercase">Cancelar</Button></DialogClose>
              <Button type="submit" className="font-black text-xs uppercase flex-1 shadow-lg" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : "ACTUALIZAR REGISTRO"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
