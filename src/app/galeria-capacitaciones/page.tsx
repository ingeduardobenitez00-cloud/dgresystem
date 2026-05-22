'use client';

import { useState, useMemo } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  deleteDoc, 
  doc, 
  where,
  updateDoc,
  arrayRemove,
  arrayUnion
} from 'firebase/firestore';
import { useFirebase, useMemoFirebase } from '@/firebase/provider';
import { useStorage } from '@/firebase/storage/use-storage';
import { useUser } from '@/firebase/auth/use-user';
import { useCollectionOnce } from '@/firebase/firestore/use-collection-once';
import Header from '@/components/header';
import { 
  Loader2, 
  Search, 
  ImageOff, 
  Images, 
  Landmark, 
  Building2, 
  MapPin, 
  Calendar, 
  UserCheck, 
  Users, 
  Trash2, 
  AlertTriangle,
  FileText,
  Maximize2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  Upload,
  Camera
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
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
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { formatDateToDDMMYYYY } from '@/lib/utils';
import Image from 'next/image';
import { normalizeGeo } from '@/lib/utils';
import { compressImage } from '@/lib/image-utils';

interface InformeDivulgador {
  id: string;
  departamento: string;
  distrito: string;
  lugar_divulgacion: string;
  fecha: string;
  nombre_divulgador: string;
  cedula_divulgador: string;
  vinculo: string;
  total_personas: number;
  fotos?: string[];
  foto_evidencia?: string[];
  foto_respaldo_documental?: string;
}

// Componente para manejar la paginación local y renderizado de evidencias de un distrito
function DistrictGallerySection({ 
    distName, 
    items, 
    isAdmin, 
    isOwner, 
    isJefe,
    handleDeleteInforme, 
    handleDeletePhoto,
    handleUploadPhoto,
    isUploading,
    setSelectedPhotoData 
}: { 
    distName: string, 
    items: InformeDivulgador[], 
    isAdmin?: boolean, 
    isOwner?: boolean,
    isJefe?: boolean,
    handleDeleteInforme: (id: string) => void,
    handleDeletePhoto: (informeId: string, photoUrl: string, type: 'evidencia' | 'respaldo') => void,
    handleUploadPhoto: (informeId: string, files: FileList | null, type: 'evidencia' | 'respaldo') => Promise<void>,
    isUploading?: boolean,
    setSelectedPhotoData: (data: {urls: string[], currentIndex: number}) => void
}) {
    const [visibleCount, setVisibleCount] = useState(10);
    const visibleItems = items.slice(0, visibleCount);

    return (
        <AccordionItem value={distName} className="border-none">
            <AccordionTrigger className="hover:no-underline py-4 bg-[#F8F9FA] rounded-2xl px-6 group border border-dashed">
                <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-black uppercase text-sm tracking-tight text-left">
                        {distName}
                    </h3>
                    <Badge variant="secondary" className="bg-black text-white text-[8px] font-black px-2">
                        {items.length} ACTIVIDADES
                    </Badge>
                </div>
            </AccordionTrigger>
            <AccordionContent className="pt-6 space-y-8 px-2">
                {visibleItems.map((inf) => {
                    const reportPhotos = inf.fotos || (inf as any).foto_evidencia || [];
                    const allPhotos: string[] = [];
                    if (inf.foto_respaldo_documental) allPhotos.push(inf.foto_respaldo_documental);
                    allPhotos.push(...reportPhotos);
                    
                    return (
                        <Card key={inf.id} className="border-none shadow-lg rounded-[2rem] overflow-hidden bg-white group/card relative">
                            {(isAdmin || isOwner) && (
                                <div className="absolute top-6 right-6 z-10">
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
                                    {inf.foto_respaldo_documental && (
                                        <div className="relative aspect-video rounded-xl overflow-hidden border-4 border-primary/20 shadow-md group/photo transition-transform hover:scale-[1.05]">
                                            <div 
                                                className="absolute inset-0 cursor-pointer"
                                                onClick={() => setSelectedPhotoData({ urls: allPhotos, currentIndex: 0 })}
                                            >
                                                <Image 
                                                    src={inf.foto_respaldo_documental || ''} 
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

                                            {(isAdmin || isOwner) && (
                                                <button 
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (confirm("¿Estás seguro de que deseas eliminar este respaldo documental de forma permanente?")) {
                                                            handleDeletePhoto(inf.id, inf.foto_respaldo_documental!, 'respaldo');
                                                        }
                                                    }}
                                                    className="absolute top-2 right-2 h-7 w-7 rounded-lg bg-destructive hover:bg-destructive/90 text-white flex items-center justify-center shadow-md z-20 opacity-0 group-hover/photo:opacity-100 transition-opacity"
                                                    title="Eliminar Respaldo"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    {reportPhotos.map((photo: string, pIdx: number) => (
                                        <div 
                                            key={pIdx} 
                                            className="relative aspect-video rounded-xl overflow-hidden border-2 border-white shadow-md group/photo transition-transform hover:scale-[1.05]"
                                        >
                                            <div 
                                                className="absolute inset-0 cursor-pointer"
                                                onClick={() => setSelectedPhotoData({ urls: allPhotos, currentIndex: inf.foto_respaldo_documental ? pIdx + 1 : pIdx })}
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

                                            {(isAdmin || isOwner) && (
                                                <button 
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (confirm("¿Estás seguro de que deseas eliminar esta foto de evidencia de forma permanente?")) {
                                                            handleDeletePhoto(inf.id, photo, 'evidencia');
                                                        }
                                                    }}
                                                    className="absolute top-2 right-2 h-7 w-7 rounded-lg bg-destructive hover:bg-destructive/90 text-white flex items-center justify-center shadow-md z-20 opacity-0 group-hover/photo:opacity-100 transition-opacity"
                                                    title="Eliminar Evidencia"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    
                                    {/* Upload buttons for Evidencias (Only for Admins/Owners/Jefes) */}
                                    {(isAdmin || isOwner || isJefe) && (
                                        <label className="relative aspect-video rounded-xl overflow-hidden border-2 border-dashed border-primary/40 shadow-sm hover:bg-primary/5 transition-colors cursor-pointer flex flex-col items-center justify-center text-primary group/upload">
                                            <div className="bg-primary/10 p-3 rounded-full mb-2 group-hover/upload:scale-110 transition-transform">
                                                {isUploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-center px-2">Añadir<br/>Evidencia</span>
                                            <input 
                                                type="file" 
                                                className="hidden" 
                                                multiple 
                                                accept="image/*"
                                                disabled={isUploading}
                                                onChange={(e) => handleUploadPhoto(inf.id, e.target.files, 'evidencia')}
                                            />
                                        </label>
                                    )}

                                    {/* Upload button for Respaldo (Only if none exists and user is Admin/Owner/Jefe) */}
                                    {(isAdmin || isOwner || isJefe) && !inf.foto_respaldo_documental && (
                                        <label className="relative aspect-video rounded-xl overflow-hidden border-2 border-dashed border-primary/40 shadow-sm hover:bg-primary/5 transition-colors cursor-pointer flex flex-col items-center justify-center text-primary group/upload">
                                            <div className="bg-primary/10 p-3 rounded-full mb-2 group-hover/upload:scale-110 transition-transform">
                                                {isUploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Plus className="h-6 w-6" />}
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-center px-2">Añadir<br/>Respaldo</span>
                                            <input 
                                                type="file" 
                                                className="hidden" 
                                                accept="image/*"
                                                disabled={isUploading}
                                                onChange={(e) => handleUploadPhoto(inf.id, e.target.files, 'respaldo')}
                                            />
                                        </label>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
                {visibleCount < items.length && (
                    <div className="flex justify-center pt-4">
                        <Button 
                            variant="ghost" 
                            className="font-black text-[10px] uppercase tracking-widest gap-2"
                            onClick={() => setVisibleCount(prev => prev + 10)}
                        >
                            Ver más actividades <ChevronDown className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </AccordionContent>
        </AccordionItem>
    );
}

// Componente para manejar la carga inteligente (Smart Loading) por departamento
function DepartmentGallerySection({ 
    deptName, 
    firestore, 
    isAdmin, 
    isOwner, 
    isJefe,
    handleDeleteInforme, 
    handleDeletePhoto,
    handleUploadPhoto,
    isUploading,
    setSelectedPhotoData,
    datosData,
    profile,
    initialOpen = false
}: { 
    deptName: string, 
    firestore: any, 
    isAdmin?: boolean, 
    isOwner?: boolean,
    isJefe?: boolean,
    handleDeleteInforme: (id: string) => void,
    handleDeletePhoto: (informeId: string, photoUrl: string, type: 'evidencia' | 'respaldo') => void,
    handleUploadPhoto: (informeId: string, files: FileList | null, type: 'evidencia' | 'respaldo') => Promise<void>,
    isUploading?: boolean,
    setSelectedPhotoData: (data: {urls: string[], currentIndex: number}) => void,
    datosData: any[],
    profile: any,
    initialOpen?: boolean
}) {
    const [isExpanded, setIsExpanded] = useState(initialOpen);

    // Consulta de evidencias solo si el departamento está expandido
    const informesQuery = useMemoFirebase(() => {
        if (!firestore || !isExpanded) return null;
        return query(
            collection(firestore, 'informes-divulgador'),
            where('departamento', '==', deptName)
        );
    }, [firestore, deptName, isExpanded]);

    const { data: rawInformes, isLoading } = useCollectionOnce<InformeDivulgador>(informesQuery);

    const informes = useMemo(() => {
        if (!rawInformes) return null;
        return [...rawInformes].sort((a, b) => {
            const dateA = new Date(a.fecha).getTime();
            const dateB = new Date(b.fecha).getTime();
            return dateB - dateA;
        });
    }, [rawInformes]);

    const districtsInDept = useMemo(() => {
        const dists = datosData
            .filter((d: any) => normalizeGeo(d.departamento) === normalizeGeo(deptName))
            .map((d: any) => d.distrito);
        return Array.from(new Set(dists)).sort();
    }, [datosData, deptName]);

    const groupedByDistrict = useMemo(() => {
        if (!informes) return [];
        
        // Filtrar solo los que tienen evidencias
        const withEvidence = informes.filter(inf => {
            const photos = inf.fotos || (inf as any).foto_evidencia || [];
            return photos.length > 0 || !!inf.foto_respaldo_documental;
        });

        const activeDists = Array.from(new Set(withEvidence.map(inf => inf.distrito)));
        
        return activeDists
            .sort((a, b) => a.localeCompare(b))
            .map(dName => ({
                name: dName,
                items: withEvidence.filter(inf => inf.distrito === dName)
            }));
    }, [informes]);

    return (
        <AccordionItem 
            value={deptName} 
            className="border-none bg-white rounded-[2rem] shadow-sm overflow-hidden"
        >
            <AccordionTrigger 
                className="hover:no-underline px-8 py-6 bg-white group"
                onClick={() => setIsExpanded(true)}
            >
                <div className="flex items-center gap-4 text-left">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <Landmark className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight text-[#1A1A1A]">{deptName}</h2>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            {isExpanded ? `${groupedByDistrict.length} DISTRITOS CON EVIDENCIAS` : 'CLIC PARA CARGAR EVIDENCIAS'}
                        </p>
                    </div>
                </div>
            </AccordionTrigger>
            <AccordionContent className="px-8 pb-8 pt-2">
                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
                    </div>
                ) : groupedByDistrict.length === 0 ? (
                    <div className="text-center py-12 opacity-30">
                        <ImageOff className="h-12 w-12 mx-auto mb-2" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">No hay evidencias registradas en este departamento</p>
                    </div>
                ) : (
                    <Accordion type="multiple" className="space-y-4">
                        {groupedByDistrict.map((dist) => (
                            <DistrictGallerySection 
                                key={dist.name}
                                distName={dist.name}
                                items={dist.items}
                                isAdmin={isAdmin}
                                isOwner={isOwner}
                                isJefe={isJefe}
                                handleDeleteInforme={handleDeleteInforme}
                                handleDeletePhoto={handleDeletePhoto}
                                handleUploadPhoto={handleUploadPhoto}
                                isUploading={isUploading}
                                setSelectedPhotoData={setSelectedPhotoData}
                            />
                        ))}
                    </Accordion>
                )}
            </AccordionContent>
        </AccordionItem>
    );
}

export default function GaleriaCapacitacionesPage() {
  const { user, isUserLoading, userError } = useUser();
  const { firestore } = useFirebase();
  const isAdmin = user?.isAdmin;
  const isOwner = user?.isOwner;
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPhotoData, setSelectedPhotoData] = useState<{urls: string[], currentIndex: number} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);
  const { uploadFile, isUploading } = useStorage();

  const handleUploadPhoto = async (informeId: string, files: FileList | null, type: 'evidencia' | 'respaldo') => {
    if (!firestore || !files || files.length === 0) return;
    try {
      toast({ title: "Subiendo imagen...", description: "Por favor espere." });
      const docRef = doc(firestore, 'informes-divulgador', informeId);
      
      if (type === 'respaldo') {
         const compressed = await compressImage(files[0]);
         const url = await uploadFile(`informes-divulgador/${informeId}/respaldo_${Date.now()}.jpg`, compressed);
         await updateDoc(docRef, {
           foto_respaldo_documental: url
         });
      } else {
         const urls = [];
         for (let i = 0; i < files.length; i++) {
             const compressed = await compressImage(files[i]);
             const url = await uploadFile(`informes-divulgador/${informeId}/evidencia_${Date.now()}_${i}.jpg`, compressed);
             urls.push(url);
         }
         await updateDoc(docRef, {
             fotos: arrayUnion(...urls)
         });
      }
      
      toast({ title: "¡Subida exitosa!", description: "La imagen se ha subido correctamente." });
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Error al subir la foto", 
        description: error.message 
      });
    }
  };

  const handleDeleteInforme = async (id: string) => {
    if (!firestore) return;
    setIsDeleting(true);
    try {
        await deleteDoc(doc(firestore, 'informes-divulgador', id));
        toast({ title: "Informe eliminado correctamente" });
        setTimeout(() => {
          window.location.reload();
        }, 500);
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

  const handleDeletePhoto = async (informeId: string, photoUrl: string, type: 'evidencia' | 'respaldo') => {
    if (!firestore) return;
    setIsDeletingPhoto(true);
    try {
      const docRef = doc(firestore, 'informes-divulgador', informeId);
      
      if (type === 'respaldo') {
        await updateDoc(docRef, {
          foto_respaldo_documental: null
        });
      } else {
        await updateDoc(docRef, {
          fotos: arrayRemove(photoUrl)
        });
      }
      
      toast({ title: "Evidencia eliminada correctamente" });
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Error al eliminar la foto", 
        description: error.message 
      });
    } finally {
      setIsDeletingPhoto(false);
    }
  };

  const profile = user?.profile;
  const isJefe = profile?.role?.toLowerCase() === 'jefe';

  const datosQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading) return null;
    return collection(firestore, 'datos');
  }, [firestore, isUserLoading]);
  const { data: datosData, isLoading: isDatosLoading } = useCollectionOnce<any>(datosQuery);

  const filterableDepts = useMemo(() => {
    if (!datosData) return [];
    const depts = new Set<string>();
    datosData.forEach((d: any) => depts.add(d.departamento));
    return Array.from(depts).sort();
  }, [datosData]);

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
                    <ImageOff className="h-20 w-20 mb-4" />
                    <p className="font-black uppercase tracking-widest text-sm">No se encontraron departamentos registrados</p>
                </div>
            </Card>
        ) : (
            <Accordion type="multiple" className="space-y-6">
                {filteredDepts.map((deptName) => (
                    <DepartmentGallerySection 
                        key={deptName}
                        deptName={deptName}
                        firestore={firestore}
                        isAdmin={isAdmin}
                        isOwner={isOwner}
                        isJefe={isJefe}
                        handleDeleteInforme={handleDeleteInforme}
                        handleDeletePhoto={handleDeletePhoto}
                        handleUploadPhoto={handleUploadPhoto}
                        isUploading={isUploading}
                        setSelectedPhotoData={setSelectedPhotoData}
                        datosData={datosData || []}
                        profile={profile}
                        initialOpen={filteredDepts.length === 1}
                    />
                ))}
            </Accordion>
        )}

        <div className="text-center pb-10">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40 italic">
                * Archivo visual oficial del Centro de Información, Documentación y Educación Electoral (CIDEE).
            </p>
        </div>
      </main>

      <Dialog open={!!selectedPhotoData} onOpenChange={(o) => !o && setSelectedPhotoData(null)}>
        <DialogContent className="max-w-7xl h-[90vh] p-0 overflow-hidden border-none bg-black/95 rounded-[2rem]">
            {selectedPhotoData && (
                <div className="relative w-full h-full flex items-center justify-center">
                    <Image 
                        src={selectedPhotoData.urls[selectedPhotoData.currentIndex]} 
                        alt="Vista ampliada" 
                        fill 
                        className="object-contain" 
                        priority
                    />
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute top-6 right-6 h-12 w-12 rounded-full bg-white/10 text-white hover:bg-white/20 border border-white/20 z-50"
                        onClick={() => setSelectedPhotoData(null)}
                    >
                        <X className="h-6 w-6" />
                    </Button>

                    {selectedPhotoData.urls.length > 1 && (
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute left-6 top-1/2 -translate-y-1/2 h-14 w-14 rounded-full bg-black/50 text-white hover:bg-black/70 border border-white/20 z-50"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPhotoData(prev => prev ? {
                                        ...prev,
                                        currentIndex: prev.currentIndex === 0 ? prev.urls.length - 1 : prev.currentIndex - 1
                                    } : null);
                                }}
                            >
                                <ChevronLeft className="h-8 w-8" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-6 top-1/2 -translate-y-1/2 h-14 w-14 rounded-full bg-black/50 text-white hover:bg-black/70 border border-white/20 z-50"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPhotoData(prev => prev ? {
                                        ...prev,
                                        currentIndex: prev.currentIndex === prev.urls.length - 1 ? 0 : prev.currentIndex + 1
                                    } : null);
                                }}
                            >
                                <ChevronRight className="h-8 w-8" />
                            </Button>
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full text-sm font-bold tracking-widest border border-white/20 z-50">
                                {selectedPhotoData.currentIndex + 1} / {selectedPhotoData.urls.length}
                            </div>
                        </>
                    )}
                </div>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
