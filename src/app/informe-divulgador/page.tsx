"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/header';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFirebase, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, query, where } from 'firebase/firestore';
import { type SolicitudCapacitacion, type InformeDivulgador } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText, ChevronsUpDown, Check, Calendar, User, X, Camera, Trash2, MapPin, Clock, Building2, Landmark, ImageIcon, FileUp, Images } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Link from 'next/link';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import Image from 'next/image';

// Utility local para formato DD/MM/AAAA
const formatToOfficialDate = (dateStr: string | undefined) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

function InformeContent() {
  const { firestore } = useFirebase();
  const { user, isUserLoading, isProfileLoading } = useUser();
  const userProfile = user?.profile;
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const solicitudIdFromUrl = searchParams.get('solicitudId');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedActivityKey, setSelectedActivityKey] = useState<string | undefined>(undefined);
  
  const [markedCells, setMarkedCells] = useState<Set<number>>(new Set());

  // Photos state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeCameraTarget, setActiveCameraTarget] = useState<'respaldo' | 'evidencia' | null>(null);
  const [respaldoPhoto, setRespaldoPhoto] = useState<string | null>(null);
  const [evidencePhotos, setEvidencePhotos] = useState<string[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Helper de compresión robusto para evitar exceder 1MB de Firestore
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800; // Reducido para asegurar que quepan varias fotos en 1MB
          const scaleSize = Math.min(1, MAX_WIDTH / img.width);
          canvas.width = img.width * scaleSize;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.6)); // Calidad reducida para optimizar espacio
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const informesQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'informes-divulgador') : null), [firestore]);
  const { data: submittedInformes } = useCollection<InformeDivulgador>(informesQuery);

  const solicitudesQuery = useMemoFirebase(() => {
    if (!firestore || isProfileLoading || !userProfile) return null;
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    
    const role = userProfile.role;
    const permissions = userProfile.permissions || [];
    const isAdminGlobal = role === 'admin' || role === 'director' || permissions.includes('admin_filter');

    if (isAdminGlobal) return colRef;
    if (permissions.includes('department_filter') && userProfile.departamento) {
        return query(colRef, where('departamento', '==', userProfile.departamento));
    }
    if (role === 'jefe' || permissions.includes('district_filter')) {
        // GUARDIA: Evitar consulta si faltan campos requeridos
        if (!userProfile.departamento || !userProfile.distrito) return null;
        return query(colRef, where('departamento', '==', userProfile.departamento), where('distrito', '==', userProfile.distrito));
    }
    return colRef; 
  }, [firestore, isProfileLoading, userProfile]);

  const { data: rawSolicitudes, isLoading: isLoadingSolicitudes } = useCollection<SolicitudCapacitacion>(solicitudesQuery);

  const linkedActivities = useMemo(() => {
    if (!rawSolicitudes || !userProfile || !user) return [];
    
    const submittedReportKeys = new Set(submittedInformes?.map(inf => `${inf.solicitud_id}_${inf.divulgador_id}`) || []);
    const isManager = ['admin', 'director', 'jefe'].includes(userProfile.role || '') || userProfile.permissions?.includes('admin_filter');

    return rawSolicitudes.flatMap(act => {
      if (act.cancelada) return [];
      const divulgadores = act.asignados || act.divulgadores || [];
      return divulgadores
        .filter(div => {
          if (isManager) return true;
          return div.id === user.uid;
        })
        .filter(div => !submittedReportKeys.has(`${act.id}_${div.id}`))
        .map(div => ({
          id: `${act.id}-${div.id}`,
          solicitudId: act.id,
          divulgador: div,
          activityData: act,
          label: `${formatToOfficialDate(act.fecha)} | ${act.lugar_local.toUpperCase()} | ${div.nombre.toUpperCase()}`
        }));
    });
  }, [rawSolicitudes, submittedInformes, user, userProfile]);

  const selectedEntry = useMemo(() => {
    return linkedActivities.find(act => act.id === selectedActivityKey);
  }, [selectedActivityKey, linkedActivities]);

  useEffect(() => {
    if (solicitudIdFromUrl && linkedActivities.length > 0 && !selectedActivityKey) {
      const matching = linkedActivities.find(act => act.solicitudId === solicitudIdFromUrl);
      if (matching) setSelectedActivityKey(matching.id);
    }
  }, [solicitudIdFromUrl, linkedActivities, selectedActivityKey]);

  const toggleCell = (num: number) => {
    setMarkedCells(prev => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  };

  const startCamera = async (target: 'respaldo' | 'evidencia') => {
    setActiveCameraTarget(target);
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', aspectRatio: { ideal: 0.75 } } 
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; }
    } catch (err) {
      toast({ variant: "destructive", title: "Error de Cámara" });
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
    setActiveCameraTarget(null);
  };

  const takePhoto = () => {
    if (videoRef.current && activeCameraTarget) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        // Usamos compresión directa al capturar
        const dataUri = canvas.toDataURL('image/jpeg', 0.6);
        if (activeCameraTarget === 'respaldo') {
            setRespaldoPhoto(dataUri);
        } else {
            setEvidencePhotos(prev => [...prev, dataUri].slice(0, 5));
        }
        stopCamera();
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'respaldo' | 'evidencia') => {
    const files = e.target.files;
    if (files) {
        if (target === 'respaldo') {
            const file = files[0];
            try {
                const compressed = await compressImage(file);
                setRespaldoPhoto(compressed);
            } catch (err) {
                toast({ variant: 'destructive', title: "Error al procesar archivo" });
            }
        } else {
            const selection = Array.from(files).slice(0, 5 - evidencePhotos.length);
            for (const file of selection) {
                try {
                    const compressed = await compressImage(file);
                    setEvidencePhotos(prev => [...prev, compressed].slice(0, 5));
                } catch (err) {
                    toast({ variant: 'destructive', title: "Error al procesar evidencia" });
                }
            }
        }
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore || !user || !selectedEntry) {
      toast({ variant: 'destructive', title: 'Error', description: 'Seleccione una actividad válida.' });
      return;
    }

    if (!respaldoPhoto) {
        toast({ variant: 'destructive', title: 'Faltan documentos', description: 'Debe adjuntar la foto del Anexo III firmado.' });
        return;
    }

    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);

    const informeData: Omit<InformeDivulgador, 'id'> = {
      solicitud_id: selectedEntry.solicitudId,
      divulgador_id: selectedEntry.divulgador.id,
      nombre_divulgador: selectedEntry.divulgador.nombre,
      cedula_divulgador: selectedEntry.divulgador.cedula,
      vinculo: selectedEntry.divulgador.vinculo,
      lugar_divulgacion: selectedEntry.activityData.lugar_local,
      fecha: selectedEntry.activityData.fecha,
      hora_desde: selectedEntry.activityData.hora_desde,
      hora_hasta: selectedEntry.activityData.hora_hasta,
      oficina: selectedEntry.activityData.distrito,
      distrito: selectedEntry.activityData.distrito,
      departamento: selectedEntry.activityData.departamento,
      total_personas: markedCells.size,
      marcaciones: Array.from(markedCells),
      observaciones: (formData.get('observaciones') as string || '').toUpperCase(),
      foto_respaldo_documental: respaldoPhoto,
      fotos: evidencePhotos,
      fecha_creacion: new Date().toISOString(),
      usuario_id: user.uid
    };

    try {
      const docId = `${selectedEntry.solicitudId}_${selectedEntry.divulgador.id}`;
      await setDoc(doc(firestore, 'informes-divulgador', docId), informeData);
      
      setSubmitSuccess(true);
      toast({ title: '¡ENVIADO!', description: 'El informe ha sido enviado correctamente.' });

      setTimeout(() => {
        setSubmitSuccess(false);
        setSelectedActivityKey(undefined);
        setMarkedCells(new Set());
        setRespaldoPhoto(null);
        setEvidencePhotos([]);
        if (formRef.current) formRef.current.reset();
        setIsSubmitting(false);
      }, 2000);

    } catch (error: any) {
      // Manejo de errores de permisos o tamaño excedido
      const isSizeError = error.message?.includes('too large') || error.code === 'out-of-range';
      errorEmitter.emit('permission-error', new FirestorePermissionError({ 
        path: 'informes-divulgador', 
        operation: 'create',
        requestResourceData: isSizeError ? { error: "El informe excede el tamaño máximo permitido por Firestore (1MB). Intente con fotos más ligeras." } : undefined
      }));
      setIsSubmitting(false);
    }
  };

  if (isUserLoading || isProfileLoading || isLoadingSolicitudes) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Anexo III - Informe Individual" />
      <main className="flex-1 p-2 md:p-4 flex flex-col items-center">
        
        <div className="w-full max-w-2xl mb-2 space-y-2">
            <div className="flex items-center justify-between px-2">
                <div>
                    <h1 className="text-lg font-black text-primary uppercase leading-tight tracking-tighter">Informe Individual</h1>
                    <p className="text-[7px] font-bold text-muted-foreground uppercase flex items-center gap-1 mt-0.5 tracking-widest">
                        <FileText className="h-2 w-2" /> Anexo III
                    </p>
                </div>
                <Link href="/agenda-capacitacion">
                    <Button variant="outline" className="rounded-full border-2 font-black uppercase text-[7px] gap-1 h-7 shadow-sm">
                        <X className="h-2.5 w-2.5" /> Cancelar
                    </Button>
                </Link>
            </div>

            <Card className="border-primary/20 shadow-sm">
                <CardHeader className="py-1.5 px-3 bg-primary/5">
                    <CardTitle className="text-[7px] font-black flex items-center gap-2 uppercase tracking-widest text-primary">
                        VINCULAR ACTIVIDAD ASIGNADA
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-9 font-black text-[9px] uppercase border-2 rounded-lg shadow-sm">
                            <span className="truncate">{selectedActivityKey ? linkedActivities.find((act) => act.id === selectedActivityKey)?.label : "Seleccionar actividad..."}</span>
                            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 opacity-30 shrink-0" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-2xl rounded-lg border-none overflow-hidden">
                            <Command>
                                <CommandInput placeholder="Buscar..." className="h-9 text-[10px]" />
                                <CommandList>
                                    <CommandEmpty className="py-4 text-center text-[8px] font-black uppercase text-muted-foreground">No hay actividades pendientes.</CommandEmpty>
                                    <CommandGroup>
                                    {linkedActivities.map((act) => (
                                        <CommandItem key={act.id} value={act.label} onSelect={() => { setSelectedActivityKey(act.id); setOpen(false);}} className="font-bold p-2 border-b last:border-0 cursor-pointer text-[9px]">
                                        {act.label}
                                        <Check className={cn("ml-auto h-3 w-3", selectedActivityKey === act.id ? "opacity-100" : "opacity-0")} />
                                        </CommandItem>
                                    ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </CardContent>
            </Card>
        </div>

        {selectedEntry && (
          <form ref={formRef} onSubmit={handleSubmit} className="w-full max-w-2xl animate-in fade-in duration-500 pb-10 px-1">
            <Card className="shadow-lg border-none rounded-xl overflow-hidden bg-white">
              <CardHeader className="bg-white border-b p-3 md:p-4">
                <div className="flex items-center gap-3">
                    <Image src="/logo.png" alt="Logo" width={30} height={30} className="object-contain shrink-0" />
                    <div>
                        <h2 className="text-sm font-black uppercase text-[#1A1A1A] leading-tight">ANEXO III</h2>
                        <h3 className="text-[8px] font-black uppercase text-muted-foreground tracking-tight">INFORME DEL DIVULGADOR</h3>
                    </div>
                </div>
              </CardHeader>

              <CardContent className="p-3 md:p-4 space-y-4">
                
                <div className="grid grid-cols-1 gap-2 border border-black rounded-lg overflow-hidden bg-[#F8F9FA]/50">
                    <div className="p-2 border-b border-black bg-white">
                        <Label className="text-[7px] font-black uppercase text-muted-foreground tracking-widest block mb-0.5">LUGAR DE DIVULGACIÓN:</Label>
                        <p className="font-black text-xs uppercase">{selectedEntry.activityData.lugar_local}</p>
                    </div>
                    <div className="grid grid-cols-2">
                        <div className="p-2 border-r border-black bg-white">
                            <Label className="text-[7px] font-black uppercase text-muted-foreground tracking-widest block mb-0.5">FECHA:</Label>
                            <p className="font-black text-xs uppercase">{formatToOfficialDate(selectedEntry.activityData.fecha)}</p>
                        </div>
                        <div className="p-2 bg-white">
                            <Label className="text-[7px] font-black uppercase text-muted-foreground tracking-widest block mb-0.5">HORARIO:</Label>
                            <p className="font-black text-xs uppercase">{selectedEntry.activityData.hora_desde} A {selectedEntry.activityData.hora_hasta} HS.</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-2 border border-black rounded-lg overflow-hidden bg-[#F8F9FA]/50">
                    <div className="p-2 border-b border-black bg-white">
                        <Label className="text-[7px] font-black uppercase text-muted-foreground tracking-widest block mb-0.5">NOMBRE COMPLETO DIVULGADOR:</Label>
                        <p className="font-black text-xs uppercase">{selectedEntry.divulgador.nombre}</p>
                    </div>
                    <div className="grid grid-cols-2">
                        <div className="p-2 border-r border-black bg-white">
                            <Label className="text-[7px] font-black uppercase text-muted-foreground tracking-widest block mb-0.5">C.I.C. N.º:</Label>
                            <p className="font-black text-xs uppercase">{selectedEntry.divulgador.cedula}</p>
                        </div>
                        <div className="p-2 bg-white">
                            <Label className="text-[7px] font-black uppercase text-muted-foreground tracking-widest block mb-0.5">VÍNCULO:</Label>
                            <p className="font-black text-xs uppercase">{selectedEntry.divulgador.vinculo}</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="bg-black text-white p-1 rounded-md text-center">
                        <h4 className="font-black uppercase text-[8px] tracking-widest">MARCACIÓN CIUDADANA (X)</h4>
                    </div>
                    
                    <div className="grid grid-cols-8 sm:grid-cols-13 border border-black rounded-lg overflow-hidden bg-[#F8F9FA]">
                        {Array.from({ length: 104 }, (_, i) => i + 1).map((num) => (
                            <div 
                                key={num} 
                                className={cn(
                                    "aspect-square flex flex-col items-center justify-center border border-black/10 cursor-pointer transition-all hover:bg-black/5 select-none",
                                    markedCells.has(num) ? "bg-white shadow-inner" : "bg-transparent"
                                )}
                                onClick={() => toggleCell(num)}
                            >
                                <span className="text-[5px] font-bold text-muted-foreground leading-none mb-0.5">{num}</span>
                                {markedCells.has(num) && (
                                    <span className="text-sm font-black leading-none animate-in zoom-in-50 duration-200">X</span>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center justify-center gap-3 py-2 border-y border-dashed border-black/10">
                        <span className="text-[9px] font-black uppercase tracking-tight text-muted-foreground">TOTAL PERSONAS:</span>
                        <div className="h-8 w-16 border-b-2 border-black flex items-center justify-center">
                            <span className="text-xl font-black">{markedCells.size}</span>
                        </div>
                    </div>
                </div>

                {/* EVIDENCIAS DE CAMPO */}
                <div className="space-y-2 pt-2 border-t-2 border-dashed">
                    <div className="flex items-center gap-2">
                        <Images className="h-3.5 w-3.5 text-primary" />
                        <Label className="font-black uppercase text-[8px]">Evidencias de Campo (Máx 5)</Label>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" className="h-14 flex-1 flex flex-col items-center justify-center border-dashed rounded-lg gap-1" onClick={() => startCamera('evidencia')}>
                                <Camera className="h-4 w-4 opacity-40" />
                                <span className="text-[7px] font-black uppercase">CÁMARA</span>
                            </Button>
                            <label className="h-14 flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg gap-1 cursor-pointer hover:bg-muted/50 transition-all bg-white text-muted-foreground">
                                <FileUp className="h-4 w-4 opacity-40" />
                                <span className="text-[7px] font-black uppercase">SUBIR</span>
                                <Input type="file" multiple accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'evidencia')} />
                            </label>
                        </div>
                        <div className="p-2 bg-muted/20 rounded-lg flex items-center justify-center border border-dashed">
                            <p className="text-[7px] font-bold text-muted-foreground uppercase leading-tight italic text-center">Capture fotos de la actividad. Se comprimirán automáticamente.</p>
                        </div>
                    </div>

                    {evidencePhotos.length > 0 && (
                        <div className="grid grid-cols-5 gap-2 pt-2">
                            {evidencePhotos.map((p, i) => (
                                <div key={i} className="relative aspect-square rounded-lg overflow-hidden border shadow-sm group">
                                    <Image src={p} alt={`Evidencia ${i}`} fill className="object-cover" />
                                    <Button variant="destructive" size="icon" className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setEvidencePhotos(prev => prev.filter((_, idx) => idx !== i))}>
                                        <X className="h-2 w-2" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="space-y-2 pt-2 border-t border-dashed">
                    <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-primary" />
                        <Label className="font-black uppercase text-[8px]">Respaldo Documental (Anexo III Firmado) *</Label>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {respaldoPhoto ? (
                            <div className="relative aspect-video rounded-lg overflow-hidden border border-muted shadow-md group">
                                <Image src={respaldoPhoto} alt="Respaldo" fill className="object-cover" />
                                <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" onClick={() => setRespaldoPhoto(null)}>
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                <div 
                                    className="flex flex-col items-center justify-center h-16 border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-all bg-white"
                                    onClick={() => startCamera('respaldo')}
                                >
                                    <Camera className="h-5 w-5 text-muted-foreground mb-0.5" />
                                    <span className="font-black uppercase text-[7px] text-muted-foreground">CÁMARA</span>
                                </div>
                                <label className="flex flex-col items-center justify-center h-16 border border-dashed rounded-lg cursor-pointer hover:bg-muted transition-all bg-white text-muted-foreground">
                                    <ImageIcon className="h-5 w-5 mb-0.5" />
                                    <span className="font-black uppercase text-[7px] text-muted-foreground">ARCHIVO / PDF</span>
                                    <Input type="file" accept="image/*,.pdf" className="hidden" onChange={e => handleFileUpload(e, 'respaldo')} />
                                </label>
                            </div>
                        )}
                        <div className="flex flex-col justify-center p-2 bg-muted/20 rounded-lg border border-dashed text-center">
                            <p className="text-[7px] font-bold text-muted-foreground uppercase leading-tight italic">
                                Adjunte foto del Anexo III físico con firma y sello oficial.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label className="text-[7px] font-black uppercase text-muted-foreground tracking-widest">Observaciones</Label>
                    <Input name="observaciones" placeholder="Opcional..." className="h-8 font-bold border-2 rounded-md uppercase text-[9px] px-3" />
                </div>

              </CardContent>

              <CardFooter className="bg-muted/10 border-t p-3">
                <Button 
                    type="submit" 
                    className={cn(
                        "w-full h-12 font-black uppercase text-xs tracking-widest shadow-lg transition-all",
                        submitSuccess ? "bg-green-600 hover:bg-green-600" : "bg-black hover:bg-black/90"
                    )} 
                    disabled={isSubmitting || !respaldoPhoto || markedCells.size === 0 || submitSuccess}
                >
                  {isSubmitting ? (
                    submitSuccess ? <span className="animate-in zoom-in duration-300">¡ENVIADO CORRECTAMENTE!</span> : <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  ) : "ENVIAR INFORME"}
                </Button>
              </CardFooter>
            </Card>
          </form>
        )}

        {!selectedEntry && (
            <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-[1.5rem] bg-white text-muted-foreground opacity-30 max-w-md w-full">
                <FileText className="h-10 w-10 mb-3" />
                <p className="text-[9px] font-black uppercase tracking-widest text-center px-6 leading-relaxed">Seleccione una actividad de la agenda para comenzar el informe individual</p>
            </div>
        )}
      </main>

      {/* Diálogo de Cámara */}
      <Dialog open={isCameraOpen} onOpenChange={(open) => !open && stopCamera()}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-none bg-black">
          <div className="relative aspect-[3/4] bg-black">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4 px-4">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={stopCamera}
                className="rounded-full bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <X className="h-6 w-6" />
              </Button>
              <Button 
                size="lg" 
                onClick={takePhoto}
                className="rounded-full h-16 w-16 bg-white hover:bg-white/90 text-black border-4 border-black/20"
              >
                <Camera className="h-8 w-8" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AnexoIII() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-primary"/>
      </div>
    }>
      <InformeContent />
    </Suspense>
  );
}