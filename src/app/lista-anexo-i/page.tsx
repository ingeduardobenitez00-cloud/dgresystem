
"use client";

import { useState, useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useUser, useFirebase, useCollectionOnce, useMemoFirebase, useCollectionPaginated } from '@/firebase';
import { collection, query, where, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { type AnexoI, type SolicitudCapacitacion } from '@/lib/data';
import { 
    Loader2, 
    Eye, 
    FileText, 
    MapPin, 
    Calendar, 
    Building2, 
    Landmark, 
    Search, 
    ClipboardList,
    ImageIcon,
    ChevronDown,
    X,
    Maximize2,
    Activity,
    Trash2,
    ShieldAlert
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateToDDMMYYYY, cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import Image from 'next/image';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
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
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { normalizeGeo } from '@/lib/utils';

type Dato = {
    departamento: string;
    distrito: string;
};

import { ImageViewerDialog } from '@/components/image-viewer-dialog';

const DistrictSection = ({ 
    deptName,
    distName, 
    allDeptItems, 
    setAllDeptItems,
    setViewingAnexo,
    initialOpen = false
}: any) => {
    const [isOpen, setIsOpen] = useState(initialOpen);
    const [visibleCount, setVisibleCount] = useState(5);
    const [isDeleting, setIsDeleting] = useState(false);
    const { toast } = useToast();
    const { firestore, user } = useFirebase();

    const isAdmin = !!user?.isAdmin || user?.profile?.role === 'superadmin' || user?.profile?.role === 'admin' || user?.isOwner;

    const handleDeleteAnexo = async (id: string) => {
        if (!firestore) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(firestore, 'anexo-i', id));
            toast({ title: 'Lote eliminado', description: 'El Anexo I ha sido borrado permanentemente.' });
            
            // ACTUALIZACIÓN OPTIMISTA (SIN REFRESH)
            if (setAllDeptItems) {
                setAllDeptItems((prev: any[] | null) => prev ? prev.filter(item => item.id !== id) : null);
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error al eliminar', description: 'No tienes permisos o ocurrió un error técnico.' });
        } finally {
            setIsDeleting(false);
        }
    };

    const districtItems = useMemo(() => {
        const target = normalizeGeo(distName);
        return (allDeptItems || []).filter((a: any) => normalizeGeo(a.distrito || '') === target);
    }, [allDeptItems, distName]);

    const hasMoreItems = districtItems.length > visibleCount;

    if (districtItems.length === 0) return null;

    return (
        <AccordionItem value={distName} className="border-none">
            <AccordionTrigger onClick={() => setIsOpen(true)} className="hover:no-underline py-4 bg-[#F8F9FA] rounded-2xl px-6 group border border-dashed hover:border-solid transition-all">
                <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-[#1A1A1A]" />
                    <h3 className="font-black uppercase text-sm tracking-tight text-primary/80">{distName}</h3>
                    <Badge variant="secondary" className="bg-black text-white text-[8px] font-black px-2">{districtItems.length}</Badge>
                </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 px-2 pb-6">
                <div className="grid grid-cols-1 gap-4">
                    {districtItems.slice(0, visibleCount).map((anexo: any) => (
                        <Card key={anexo.id} className="border-none shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden bg-white group border-2 border-transparent hover:border-primary/10">
                            <div className="flex flex-col md:flex-row items-center p-6 gap-6">
                                <div className="h-10 w-10 rounded-xl bg-primary/5 text-primary flex items-center justify-center shrink-0">
                                    <ClipboardList className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-1">
                                        <h2 className="text-base font-black uppercase text-[#1A1A1A] truncate">{anexo.distrito}</h2>
                                        <Badge variant="outline" className="text-[7px] font-black uppercase border-primary/10">{anexo.tipo_oficina}</Badge>
                                        <Badge className="bg-black text-white text-[6px] font-black uppercase h-4">LOTE: {anexo.id.substring(0,8)}</Badge>
                                    </div>
                                    <div className="flex flex-wrap gap-4 text-[9px] font-bold text-muted-foreground uppercase tracking-tight">
                                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> CREADO: {formatDateToDDMMYYYY(anexo.fecha_creacion?.split('T')[0] || '')}</span>
                                        <span className="flex items-center gap-1 text-primary font-black"><FileText className="h-3 w-3" /> {anexo.filas?.length || 0} LUGARES</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="h-10 rounded-xl border-2 hover:bg-primary hover:text-white transition-all font-black uppercase text-[10px] gap-2 px-4 shadow-sm"
                                        onClick={() => setViewingAnexo(anexo)}
                                    >
                                        <Eye className="h-4 w-4" /> VER DETALLE
                                    </Button>

                                    {isAdmin && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    disabled={isDeleting}
                                                    className="h-10 w-10 rounded-xl text-destructive/40 hover:text-destructive hover:bg-destructive/5 transition-all"
                                                >
                                                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl p-8">
                                                <AlertDialogHeader className="space-y-4">
                                                    <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto border-4 border-destructive/20">
                                                        <ShieldAlert className="h-8 w-8 text-destructive" />
                                                    </div>
                                                    <AlertDialogTitle className="font-black uppercase tracking-tight text-center text-xl">¿ELIMINAR LOTE DEFINITIVAMENTE?</AlertDialogTitle>
                                                    <AlertDialogDescription className="text-xs font-bold uppercase leading-relaxed text-muted-foreground text-center">
                                                        Esta acción borrará de forma permanente el lote <span className="text-primary font-black">#{anexo.id.substring(0,8)}</span> de la base de datos Firestore. Esta operación no se puede deshacer.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter className="mt-8 sm:justify-center gap-4">
                                                    <AlertDialogCancel className="h-12 rounded-xl font-black uppercase text-[10px] px-8 border-2">CANCELAR</AlertDialogCancel>
                                                    <AlertDialogAction 
                                                        onClick={() => handleDeleteAnexo(anexo.id)} 
                                                        className="h-12 bg-destructive hover:bg-destructive/90 text-white rounded-xl font-black uppercase text-[10px] px-8 shadow-xl"
                                                    >
                                                        SÍ, ELIMINAR LOTE
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
                    
                    {hasMoreItems && (
                        <div className="flex justify-center mt-4">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setVisibleCount(prev => prev + 10)}
                                className="font-black text-[9px] uppercase tracking-widest hover:bg-white gap-2 h-10 px-6 rounded-xl border border-dashed border-muted-foreground/20 shadow-sm"
                            >
                                VER MÁS LOTES ({districtItems.length - visibleCount})
                                <ChevronDown className="h-3 w-3" />
                            </Button>
                        </div>
                    )}
                </div>
            </AccordionContent>
        </AccordionItem>
    );
};

const DepartmentSection = ({ 
    deptName, 
    firestore, 
    profile, 
    datosData,
    setViewingAnexo,
    initialOpen = false 
}: any) => {
    const [isOpen, setIsOpen] = useState(initialOpen || !['admin', 'director'].includes(profile?.role || ''));

    const deptQuery = useMemoFirebase(() => {
        if (!firestore || !isOpen) return null;
        const norm = normalizeGeo(deptName);
        const variations = Array.from(new Set([deptName, norm, norm.charAt(0) + norm.slice(1).toLowerCase()])).filter(Boolean);
        return query(
            collection(firestore, 'anexo-i'),
            where('departamento', 'in', variations)
        );
    }, [firestore, isOpen, deptName]);

    const { data: allDeptItems, isLoading: isDeptLoading, setData: setAllDeptItems } = useCollectionOnce<AnexoI>(deptQuery);

    const districts = useMemo(() => {
        if (!datosData) return [];
        const role = (profile?.role || '').toLowerCase();
        const hasAdminFilter = ['admin', 'director'].includes(role) || profile?.permissions?.includes('admin_filter');
        const hasDeptFilter = !hasAdminFilter && (role === 'coordinador' || profile?.permissions?.includes('department_filter'));
        
        const dists = new Set<string>();
        datosData.forEach((d: Dato) => {
            if (normalizeGeo(d.departamento) === normalizeGeo(deptName)) {
                dists.add(d.distrito);
            }
        });

        const sortedDists = Array.from(dists).sort();

        if (!hasAdminFilter && !hasDeptFilter && (profile?.distrito)) {
            const targetDist = normalizeGeo(profile.distrito);
            return sortedDists.filter(d => normalizeGeo(d) === targetDist);
        }

        return sortedDists;
    }, [datosData, deptName, profile]);

    const itemsCount = (allDeptItems || []).length;

    return (
        <AccordionItem value={deptName} className="border-none bg-white rounded-[2rem] shadow-xl overflow-hidden">
            <AccordionTrigger onClick={() => setIsOpen(true)} className="hover:no-underline p-8 group">
                <div className="flex items-center gap-6 text-left">
                    <div className="h-16 w-16 rounded-[1.25rem] bg-primary/5 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all border-2 border-transparent group-hover:border-primary/20 shadow-inner">
                        <Landmark className="h-8 w-8" />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-2xl font-black uppercase tracking-tight text-[#1A1A1A]">{deptName}</h2>
                        <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="bg-black text-white font-black uppercase text-[8px] py-0 px-2 h-5">
                                {itemsCount} LOTES REGISTRADOS
                            </Badge>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hidden sm:block">
                                {isOpen ? `${districts.length} DISTRITOS CONFIGURADOS` : 'CLIC PARA EXPLORAR DEPARTAMENTO'}
                            </p>
                        </div>
                    </div>
                </div>
            </AccordionTrigger>
            
            <AccordionContent className="px-8 pb-8 pt-2">
                {isDeptLoading ? (
                    <div className="flex flex-col gap-4 py-8 items-center justify-center text-muted-foreground animate-pulse">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Cargando lotes del departamento...</p>
                    </div>
                ) : (
                    <Accordion type="multiple" className="space-y-4" defaultValue={districts.length === 1 ? [districts[0]] : undefined}>
                        {districts.map(dist => (
                            <DistrictSection 
                                key={dist}
                                deptName={deptName}
                                distName={dist}
                                allDeptItems={allDeptItems}
                                setAllDeptItems={setAllDeptItems}
                                setViewingAnexo={setViewingAnexo}
                                initialOpen={districts.length === 1}
                            />
                        ))}
                    </Accordion>
                )}
            </AccordionContent>
        </AccordionItem>
    );
};

export default function ListaAnexoIPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingAnexo, setViewingAnexo] = useState<AnexoI | null>(null);
  const [fullViewerImage, setFullViewerImage] = useState<string | null>(null);

  const profile = user?.profile;

  // Carga de la estructura de departamentos y distritos
  const datosQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading) return null;
    return collection(firestore, 'datos');
  }, [firestore, isUserLoading]);
  const { data: datosData, isLoading: isDatosLoading } = useCollectionOnce<Dato>(datosQuery);

  const filterableDepts = useMemo(() => {
    if (!datosData) return [];
    const depts = new Set<string>();
    datosData.forEach(d => depts.add(d.departamento));
    return Array.from(depts).sort();
  }, [datosData]);

  // Si el usuario tiene filtro de departamento, solo mostramos ese departamento
  const filteredDepts = useMemo(() => {
    const role = (profile?.role || '').toLowerCase();
    const hasAdminFilter = ['admin', 'director'].includes(role) || profile?.permissions?.includes('admin_filter');
    
    if (!hasAdminFilter && (role === 'coordinador' || profile?.permissions?.includes('department_filter'))) {
        return filterableDepts.filter(d => normalizeGeo(d) === normalizeGeo(profile?.departamento || ''));
    }
    
    if (searchTerm) {
        return filterableDepts.filter(d => d.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    
    return filterableDepts;
  }, [filterableDepts, profile, searchTerm]);

  if (isUserLoading || isDatosLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Listado de Anexo I" />
      
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-primary uppercase leading-none">Anexo I - Lugares Fijos</h1>
                <p className="text-muted-foreground text-[10px] font-bold uppercase flex items-center gap-2 mt-2 tracking-widest">
                    <ClipboardList className="h-3.5 w-3.5" /> Control por lotes de planificaciones enviadas
                </p>
            </div>
            <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                <Input 
                    placeholder="Buscar departamento..." 
                    className="h-12 pl-10 font-bold border-2 rounded-2xl bg-white shadow-sm"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        {filteredDepts.length === 0 ? (
            <Card className="p-20 text-center border-dashed bg-white rounded-[2.5rem]">
                <div className="flex flex-col items-center justify-center opacity-20">
                    <FileText className="h-20 w-20 mb-4" />
                    <p className="font-black uppercase tracking-widest text-sm">No se encontraron departamentos</p>
                </div>
            </Card>
        ) : (
            <Accordion type="multiple" className="space-y-4">
                {filteredDepts.map(dept => (
                    <DepartmentSection 
                        key={dept}
                        deptName={dept}
                        firestore={firestore}
                        profile={profile}
                        datosData={datosData}
                        setViewingAnexo={setViewingAnexo}
                        initialOpen={filteredDepts.length === 1}
                    />
                ))}
            </Accordion>
        )}
      </main>

      <Dialog open={!!viewingAnexo} onOpenChange={(o) => !o && setViewingAnexo(null)}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 border-none shadow-2xl overflow-hidden rounded-[2rem]">
          {viewingAnexo && (
            <div className="flex flex-col h-full bg-[#F8F9FA]">
                <div className="bg-black text-white p-8 shrink-0">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
                                    <ClipboardList className="h-6 w-6" />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-black uppercase leading-none">CONTROL DE LOTE - ANEXO I</DialogTitle>
                                    <DialogDescription className="text-white/60 font-bold uppercase text-[10px] mt-2">
                                        {viewingAnexo.distrito} | {viewingAnexo.departamento} | Lote: {viewingAnexo.id}
                                    </DialogDescription>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setViewingAnexo(null)} className="text-white/40 hover:text-white"><X className="h-6 w-6" /></Button>
                        </div>
                    </DialogHeader>
                </div>

                <ScrollArea className="flex-1 p-8">
                    <div className="space-y-10">
                        <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
                            <div className="bg-muted/30 px-6 py-3 border-b flex justify-between items-center">
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                    <Activity className="h-3.5 w-3.5" /> Lugares Planificados en este Lote
                                </p>
                                <Badge variant="secondary" className="bg-black text-white text-[8px] font-black">{viewingAnexo.filas?.length} FILAS</Badge>
                            </div>
                            <Table>
                                <TableHeader className="bg-white">
                                    <TableRow>
                                        <TableHead className="text-[9px] font-black uppercase px-6">Lugar</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase">Dirección</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase text-center">Periodo</TableHead>
                                        <TableHead className="text-right text-[9px] font-black uppercase px-6">Horario</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {viewingAnexo.filas?.map((f, idx) => (
                                        <TableRow key={idx} className="border-b last:border-0">
                                            <TableCell className="px-6 py-4 font-black text-[11px] uppercase text-primary">{f.lugar}</TableCell>
                                            <TableCell className="text-[10px] font-bold uppercase text-muted-foreground">{f.direccion}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="secondary" className="bg-muted/50 text-[9px] font-bold">
                                                    {formatDateToDDMMYYYY(f.fecha_desde)} al {formatDateToDDMMYYYY(f.fecha_hasta)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right px-6 font-black text-[10px] text-primary">
                                                {f.hora_desde} a {f.hora_hasta} HS
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>

                        <div className="space-y-4">
                            <div className="flex items-center gap-3 px-2">
                                <ImageIcon className="h-5 w-5 text-primary" />
                                <h3 className="font-black uppercase text-xs">Respaldo Documental Firmado del Lote</h3>
                            </div>
                            {viewingAnexo.foto_respaldo ? (
                                <div className="relative aspect-video w-full rounded-[2.5rem] overflow-hidden border-8 border-white shadow-2xl bg-muted group">
                                    {viewingAnexo.foto_respaldo.startsWith('data:application/pdf') || viewingAnexo.foto_respaldo.includes('.pdf') ? (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-white">
                                            <FileText className="h-20 w-20 text-primary opacity-40 mb-4" />
                                            <p className="text-sm font-black uppercase text-primary">Documento PDF Guardado</p>
                                            <Button variant="outline" className="mt-6 font-black uppercase text-[10px] border-2 h-12 px-8" asChild>
                                                <a href={viewingAnexo.foto_respaldo} target="_blank">VER DOCUMENTO PDF</a>
                                            </Button>
                                        </div>
                                    ) : (
                                        <>
                                            <Image 
                                                src={viewingAnexo.foto_respaldo} 
                                                alt="Respaldo" 
                                                fill 
                                                className="object-cover cursor-pointer transition-transform hover:scale-[1.02]" 
                                                onClick={() => setFullViewerImage(viewingAnexo.foto_respaldo)}
                                            />
                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                                <div className="bg-white/20 backdrop-blur-md p-4 rounded-full">
                                                    <Maximize2 className="h-10 w-10 text-white" />
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="p-20 text-center border-4 border-dashed rounded-[2.5rem] opacity-20 bg-white">
                                    <ImageIcon className="h-16 w-16 mx-auto mb-4" />
                                    <p className="font-black uppercase text-sm">Sin respaldo visual registrado</p>
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>

                <div className="p-8 bg-white border-t flex justify-end">
                    <Button onClick={() => setViewingAnexo(null)} className="font-black uppercase text-xs h-12 px-10 shadow-xl bg-black hover:bg-black/90 rounded-xl">Cerrar Control</Button>
                </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ImageViewerDialog 
        isOpen={!!fullViewerImage}
        onOpenChange={(o) => !o && setFullViewerImage(null)}
        image={fullViewerImage}
      />
    </div>
  );
}
