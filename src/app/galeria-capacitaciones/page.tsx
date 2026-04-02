
"use client";

import { useState, useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardContent } from '@/components/ui/card';
import { useFirebase, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection } from 'firebase/firestore';
import { type InformeDivulgador } from '@/lib/data';
import { 
  Loader2, 
  Images, 
  MapPin, 
  Calendar, 
  Users, 
  UserCheck, 
  Search, 
  ImageOff, 
  Maximize2, 
  Building2, 
  Landmark, 
  X,
  FileText,
  Camera,
  Trash2,
  AlertTriangle
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
} from "@/components/ui/alert-dialog";
import { deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { formatDateToDDMMYYYY, cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';

export default function GaleriaCapacitacionesPage() {
  const { isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { user, isAdmin, isOwner } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteInforme = async (id: string) => {
    if (!firestore) return;
    setIsDeleting(true);
    try {
        await deleteDoc(doc(firestore, 'informes-divulgador', id));
        toast({ title: "Informe eliminado correctamente" });
    } catch (error: any) {
        toast({ 
            variant: "destructive", 
            title: "Error al eliminar", 
            description: error.message 
        });
    } finally {
        setIsDeleting(false);
    }
  };

  // Consulta directa a informes-divulgador
  const informesRef = useMemoFirebase(() => (firestore ? collection(firestore, 'informes-divulgador') : null), [firestore]);
  const { data: informes, isLoading } = useCollection<InformeDivulgador>(informesRef);

  // Agrupación Jerárquica: Dept -> Dist -> Informes con Fotos o Respaldo
  const groupedInformes = useMemo(() => {
    if (!informes) return [];

    const term = searchTerm.toLowerCase().trim();
    
    // Filtrar informes que tengan fotos o el documento firmado (respaldo)
    const filtered = informes.filter(inf => {
        const reportPhotos = inf.fotos || (inf as any).foto_evidencia || [];
        const hasPhotos = Array.isArray(reportPhotos) && reportPhotos.length > 0;
        const hasRespaldo = !!inf.foto_respaldo_documental;
        
        if (!hasPhotos && !hasRespaldo) return false;

        if (!term) return true;

        const lugar = (inf.lugar_divulgacion || '').toLowerCase();
        const responsable = (inf.nombre_divulgador || '').toLowerCase();
        const dist = (inf.distrito || '').toLowerCase();
        const dept = (inf.departamento || '').toLowerCase();

        return lugar.includes(term) || responsable.includes(term) || dist.includes(term) || dept.includes(term);
    }).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

    const depts: Record<string, Record<string, InformeDivulgador[]>> = {};

    filtered.forEach(inf => {
      const dptName = inf.departamento || 'SIN DEPARTAMENTO';
      const dstName = inf.distrito || 'SIN DISTRITO';

      if (!depts[dptName]) depts[dptName] = {};
      if (!depts[dptName][dstName]) depts[dptName][dstName] = [];
      depts[dptName][dstName].push(inf);
    });

    return Object.entries(depts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, dists]) => ({
        name,
        districts: Object.entries(dists)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([dName, items]) => ({
            name: dName,
            items
          }))
      }));
  }, [informes, searchTerm]);

  if (isUserLoading || isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Galería de Evidencias" />
      
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-primary uppercase leading-none">Galería de Capacitaciones</h1>
                <p className="text-muted-foreground text-[10px] font-bold uppercase flex items-center gap-2 mt-2 tracking-widest">
                    <Images className="h-3.5 w-3.5" /> Evidencias fotográficas y respaldos documentales (Anexo III)
                </p>
            </div>
            <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                <Input 
                    placeholder="Buscar actividad, responsable o zona..." 
                    className="h-12 pl-10 font-bold border-2 rounded-2xl bg-white shadow-sm"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        {groupedInformes.length === 0 ? (
            <Card className="p-20 text-center border-dashed bg-white rounded-[2.5rem]">
                <div className="flex flex-col items-center justify-center opacity-20">
                    <ImageOff className="h-20 w-20 mb-4" />
                    <p className="font-black uppercase tracking-widest text-sm">No se encontraron informes con evidencias fotográficas</p>
                </div>
            </Card>
        ) : (
            <Accordion type="multiple" className="space-y-6">
                {groupedInformes.map((dept) => (
                    <AccordionItem key={dept.name} value={dept.name} className="border-none bg-white rounded-[2rem] shadow-sm overflow-hidden">
                        <AccordionTrigger className="hover:no-underline px-8 py-6 bg-white group">
                            <div className="flex items-center gap-4 text-left">
                                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                    <Landmark className="h-6 w-6" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black uppercase tracking-tight text-[#1A1A1A]">{dept.name}</h2>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                        {dept.districts.length} DISTRITOS CON EVIDENCIAS
                                    </p>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-8 pb-8 pt-2">
                            <Accordion type="multiple" className="space-y-4">
                                {dept.districts.map((dist) => (
                                    <AccordionItem key={dist.name} value={dist.name} className="border-none">
                                        <AccordionTrigger className="hover:no-underline py-4 bg-[#F8F9FA] rounded-2xl px-6 group border border-dashed">
                                            <div className="flex items-center gap-3">
                                                <Building2 className="h-5 w-5 text-muted-foreground" />
                                                <h3 className="font-black uppercase text-sm tracking-tight">
                                                    {dist.name}
                                                </h3>
                                                <Badge variant="secondary" className="bg-black text-white text-[8px] font-black px-2">
                                                    {dist.items.length} ACTIVIDADES
                                                </Badge>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-6 space-y-8 px-2">
                                            {dist.items.map((inf) => {
                                                const reportPhotos = inf.fotos || (inf as any).foto_evidencia || [];
                                                const hasRespaldo = !!inf.foto_respaldo_documental;
                                                
                                                return (
                                                    <Card key={inf.id} className="border-none shadow-lg rounded-[2rem] overflow-hidden bg-white group/card relative">
                                                        {(isAdmin || isOwner) && (
                                                            <div className="absolute top-6 right-6 z-10 transition-opacity">
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild>
                                                                        <Button variant="destructive" size="icon" className="h-10 w-10 rounded-xl shadow-xl">
                                                                            <Trash2 className="h-5 w-5" />
                                                                        </Button>
                                                                    </AlertDialogTrigger>
                                                                    <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl p-8">
                                                                        <AlertDialogHeader className="space-y-4">
                                                                            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto border-4 border-destructive/20">
                                                                                <AlertTriangle className="h-8 w-8 text-destructive" />
                                                                            </div>
                                                                            <AlertDialogTitle className="font-black uppercase tracking-tight text-center text-xl">¿ELIMINAR ESTE INFORME?</AlertDialogTitle>
                                                                            <AlertDialogDescription className="text-xs font-bold uppercase leading-relaxed text-muted-foreground text-center">
                                                                                Se borrarán todas las evidencias fotográficas y el registro de esta actividad de <span className="text-primary font-black">{inf.lugar_divulgacion}</span> de forma permanente.
                                                                            </AlertDialogDescription>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter className="mt-8 sm:justify-center gap-4">
                                                                            <AlertDialogCancel className="h-12 rounded-xl font-black uppercase text-[10px] px-8 border-2">CANCELAR</AlertDialogCancel>
                                                                            <AlertDialogAction 
                                                                                onClick={() => handleDeleteInforme(inf.id)} 
                                                                                className="h-12 bg-destructive hover:bg-destructive/90 text-white rounded-xl font-black uppercase text-[10px] px-8 shadow-xl"
                                                                            >
                                                                                SÍ, ELIMINAR TODO
                                                                            </AlertDialogAction>
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            </div>
                                                        )}
                                                        <div className="p-6 md:p-8 border-b bg-muted/5">
                                                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                                                                <div className="lg:col-span-6 space-y-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center shadow-lg">
                                                                            <MapPin className="h-5 w-5" />
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">LOCAL DE CAPACITACIÓN</p>
                                                                            <h2 className="text-lg font-black uppercase text-[#1A1A1A] leading-tight">{inf.lugar_divulgacion}</h2>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex flex-wrap gap-3">
                                                                        <Badge variant="secondary" className="bg-white border-2 text-[9px] font-black uppercase py-1 px-3 rounded-lg shadow-sm gap-2">
                                                                            <Calendar className="h-3 w-3" /> {formatDateToDDMMYYYY(inf.fecha)}
                                                                        </Badge>
                                                                        <Badge variant="secondary" className="bg-white border-2 text-[9px] font-black uppercase py-1 px-3 rounded-lg shadow-sm gap-2">
                                                                            <UserCheck className="h-3 w-3" /> {inf.nombre_divulgador}
                                                                        </Badge>
                                                                    </div>
                                                                </div>

                                                                <div className="lg:col-span-3 lg:border-l lg:pl-6 space-y-1">
                                                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">PERSONAL OPERATIVO</p>
                                                                    <p className="font-black text-[11px] uppercase text-[#1A1A1A]">{inf.vinculo}</p>
                                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">C.I. {inf.cedula_divulgador}</p>
                                                                </div>

                                                                <div className="lg:col-span-3 bg-black text-white p-5 rounded-2xl flex flex-col items-center justify-center shadow-xl">
                                                                    <Users className="h-5 w-5 mb-1 opacity-50" />
                                                                    <p className="text-[8px] font-black uppercase tracking-[0.2em] mb-1">PERSONAS CAPACITADAS</p>
                                                                    <span className="text-3xl font-black leading-none">{inf.total_personas}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <CardContent className="p-6 md:p-8">
                                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                                                {/* MOSTRAR PRIMERO EL RESPALDO DOCUMENTAL (EL QUE VEMOS EN EL SCREENSHOT) */}
                                                                {hasRespaldo && (
                                                                    <div 
                                                                        className="relative aspect-video rounded-xl overflow-hidden border-4 border-primary/20 shadow-md group/photo cursor-pointer transition-transform hover:scale-[1.05]"
                                                                        onClick={() => setSelectedPhoto(inf.foto_respaldo_documental)}
                                                                    >
                                                                        <Image 
                                                                            src={inf.foto_respaldo_documental} 
                                                                            alt="Respaldo Documental" 
                                                                            fill 
                                                                            className="object-cover" 
                                                                            sizes="200px"
                                                                        />
                                                                        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity">
                                                                            <FileText className="text-white h-6 w-6 mb-1" />
                                                                            <span className="text-[8px] font-black text-white uppercase tracking-widest">VER RESPALDO</span>
                                                                        </div>
                                                                        <div className="absolute top-2 left-2 bg-primary text-white text-[6px] font-black px-1.5 py-0.5 rounded-sm shadow-lg">DOCUMENTO FIRMADO</div>
                                                                    </div>
                                                                )}

                                                                {/* MOSTRAR FOTOS DE CAMPO ADICIONALES */}
                                                                {reportPhotos.map((photo: string, pIdx: number) => (
                                                                    <div 
                                                                        key={pIdx} 
                                                                        className="relative aspect-video rounded-xl overflow-hidden border-2 border-white shadow-md group/photo cursor-pointer transition-transform hover:scale-[1.05]"
                                                                        onClick={() => setSelectedPhoto(photo)}
                                                                    >
                                                                        <Image 
                                                                            src={photo} 
                                                                            alt={`Evidencia ${pIdx}`} 
                                                                            fill 
                                                                            className="object-cover" 
                                                                            sizes="200px"
                                                                        />
                                                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity">
                                                                            <Maximize2 className="text-white h-6 w-6" />
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                );
                                            })}
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        )}

        <div className="text-center pb-10">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40 italic">
                * Archivo visual oficial del Centro de Información, Documentación y Educación Electoral (CIDEE).
            </p>
        </div>
      </main>

      <Dialog open={!!selectedPhoto} onOpenChange={(o) => !o && setSelectedPhoto(null)}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden border-none bg-black/95 rounded-[2rem]">
            {selectedPhoto && (
                <div className="relative aspect-video w-full flex items-center justify-center">
                    <Image 
                        src={selectedPhoto} 
                        alt="Vista ampliada" 
                        fill 
                        className="object-contain" 
                        priority
                    />
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute top-6 right-6 h-12 w-12 rounded-full bg-white/10 text-white hover:bg-white/20 border border-white/20 z-50"
                        onClick={() => setSelectedPhoto(null)}
                    >
                        <X className="h-6 w-6" />
                    </Button>
                </div>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
