
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
import { Loader2, FileText, ChevronsUpDown, Check, Calendar, User, X, Camera, Trash2, MapPin, Clock, Building2, Landmark, ImageIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn, formatDateToDDMMYYYY } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Link from 'next/link';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import Image from 'next/image';

function InformeContent() {
  const { firestore } = useFirebase();
  const { user, isUserLoading, isProfileLoading } = useUser();
  const userProfile = user?.profile;
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const solicitudIdFromUrl = searchParams.get('solicitudId');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedActivityKey, setSelectedActivityKey] = useState<string | undefined>(undefined);
  
  // Estado para el tablero de marcaciones (104 celdas)
  const [markedCells, setMarkedCells] = useState<Set<number>>(new Set());

  // Estados de Cámara
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Consulta de informes ya presentados
  const informesQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'informes-divulgador') : null), [firestore]);
  const { data: submittedInformes } = useCollection<InformeDivulgador>(informesQuery);

  // Consulta centralizada de solicitudes
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
          label: `${formatDateToDDMMYYYY(act.fecha)} | ${act.lugar_local.toUpperCase()} | ${div.nombre.toUpperCase()}`
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

  const startCamera = async () => {
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
  };

  const takePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        setPhoto(canvas.toDataURL('image/jpeg', 0.7));
        stopCamera();
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore || !user || !selectedEntry) {
      toast({ variant: 'destructive', title: 'Error', description: 'Seleccione una actividad válida.' });
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);

    const informeData: Omit<InformeDivulgador, 'id'> = {
      solicitud_id: selectedEntry.solicitudId,
      divulgador_id: selectedEntry.divulgador.id,
      divulgador_nombre: selectedEntry.divulgador.nombre,
      divulgador_cedula: selectedEntry.divulgador.cedula,
      divulgador_vinculo: selectedEntry.divulgador.vinculo,
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
      foto_respaldo_documental: photo || '',
      fecha_creacion: new Date().toISOString(),
      usuario_id: user.uid
    };

    try {
      const docId = `${selectedEntry.solicitudId}_${selectedEntry.divulgador.id}`;
      await setDoc(doc(firestore, 'informes-divulgador', docId), informeData);
      toast({ title: '¡Informe Guardado con Éxito!' });
      setSelectedActivityKey(undefined);
      setMarkedCells(new Set());
      setPhoto(null);
      event.currentTarget.reset();
    } catch (error) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'informes-divulgador', operation: 'create' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isUserLoading || isProfileLoading || isLoadingSolicitudes) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Anexo III - Informe Individual" />
      <main className="flex-1 p-4 md:p-8 flex flex-col items-center">
        
        <div className="w-full max-w-4xl mb-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-primary uppercase leading-tight tracking-tight">Registro de Capacitación</h1>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2 mt-1 tracking-widest">
                        <FileText className="h-3.5 w-3.5" /> Informe del Divulgador - Anexo III
                    </p>
                </div>
                <Link href="/agenda-capacitacion">
                    <Button variant="outline" className="rounded-full border-2 font-black uppercase text-[10px] gap-2 h-10 shadow-sm">
                        <X className="h-4 w-4" /> Cancelar Carga
                    </Button>
                </Link>
            </div>

            <Card className="border-primary/20 shadow-md">
                <CardHeader className="py-4 bg-primary/5">
                    <CardTitle className="text-[10px] font-black flex items-center gap-2 uppercase tracking-widest text-primary">
                        VINCULAR ACTIVIDAD DE LA AGENDA
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-14 font-black text-xs uppercase border-2 rounded-xl shadow-sm">
                            {selectedActivityKey ? linkedActivities.find((act) => act.id === selectedActivityKey)?.label : "Seleccionar actividad..."}
                            <ChevronsUpDown className="ml-2 h-5 w-5 opacity-30 shrink-0" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-2xl rounded-xl border-none overflow-hidden">
                            <Command>
                                <CommandInput placeholder="Buscar por local o divulgador..." className="h-12" />
                                <CommandList>
                                    <CommandEmpty className="py-10 text-center text-[10px] font-black uppercase text-muted-foreground">No hay actividades pendientes.</CommandEmpty>
                                    <CommandGroup>
                                    {linkedActivities.map((act) => (
                                        <CommandItem key={act.id} value={act.label} onSelect={() => { setSelectedActivityKey(act.id); setOpen(false);}} className="font-bold p-4 border-b last:border-0 cursor-pointer">
                                        {act.label}
                                        <Check className={cn("ml-auto h-4 w-4", selectedActivityKey === act.id ? "opacity-100" : "opacity-0")} />
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
          <form onSubmit={handleSubmit} className="w-full max-w-4xl animate-in fade-in duration-500 pb-20">
            <Card className="shadow-2xl border-none rounded-[2rem] overflow-hidden bg-white">
              <CardHeader className="bg-white border-b-2 p-8 md:p-12">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex items-center gap-6">
                        <Image src="/logo.png" alt="Logo TSJE" width={60} height={60} className="object-contain shrink-0" />
                        <div>
                            <h2 className="text-2xl font-black uppercase text-[#1A1A1A] leading-tight">ANEXO III</h2>
                            <h3 className="text-lg font-black uppercase text-muted-foreground tracking-tight">INFORME DEL DIVULGADOR</h3>
                        </div>
                    </div>
                    <div className="text-right hidden md:block">
                        <p className="text-[10px] font-black uppercase opacity-20 tracking-[0.3em]">Justicia Electoral</p>
                    </div>
                </div>
              </CardHeader>

              <CardContent className="p-8 md:p-12 space-y-12">
                
                {/* SECCION 1: DATOS DEL EVENTO */}
                <div className="grid grid-cols-1 gap-6 border-2 border-black rounded-2xl overflow-hidden bg-[#F8F9FA]/50">
                    <div className="p-6 border-b-2 border-black bg-white">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block mb-2">LUGAR DE DIVULGACIÓN:</Label>
                        <p className="font-black text-lg uppercase border-b border-black/10 pb-1">{selectedEntry.activityData.lugar_local}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2">
                        <div className="p-6 border-b-2 md:border-b-0 md:border-r-2 border-black bg-white">
                            <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block mb-2">FECHA:</Label>
                            <p className="font-black text-lg uppercase">{formatDateToDDMMYYYY(selectedEntry.activityData.fecha)} / 2026</p>
                        </div>
                        <div className="p-6 bg-white">
                            <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block mb-2">HORARIO:</Label>
                            <p className="font-black text-lg uppercase">DE: {selectedEntry.activityData.hora_desde} A: {selectedEntry.activityData.hora_hasta} HS.</p>
                        </div>
                    </div>
                </div>

                {/* SECCION 2: DATOS DEL DIVULGADOR */}
                <div className="grid grid-cols-1 gap-6 border-2 border-black rounded-2xl overflow-hidden bg-[#F8F9FA]/50">
                    <div className="p-6 border-b-2 border-black bg-white">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block mb-2">NOMBRE COMPLETO DIVULGADOR:</Label>
                        <p className="font-black text-lg uppercase border-b border-black/10 pb-1">{selectedEntry.divulgador.nombre}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2">
                        <div className="p-6 border-b-2 md:border-b-0 md:border-r-2 border-black bg-white">
                            <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block mb-2">C.I.C. N.º:</Label>
                            <p className="font-black text-lg uppercase">{selectedEntry.divulgador.cedula}</p>
                        </div>
                        <div className="p-6 bg-white">
                            <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block mb-2">VÍNCULO:</Label>
                            <p className="font-black text-lg uppercase">{selectedEntry.divulgador.vinculo}</p>
                        </div>
                    </div>
                </div>

                {/* SECCION 3: JURISDICCION */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-2 border-black rounded-2xl overflow-hidden bg-white">
                    <div className="p-6 border-b-2 md:border-b-0 md:border-r-2 border-black">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block mb-2">OFICINA:</Label>
                        <p className="font-black text-lg uppercase">{selectedEntry.activityData.distrito}</p>
                    </div>
                    <div className="p-6">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block mb-2">DEPARTAMENTO:</Label>
                        <p className="font-black text-lg uppercase">{selectedEntry.activityData.departamento}</p>
                    </div>
                </div>

                {/* TABLERO DE MARCACION 104 CELDAS */}
                <div className="space-y-6">
                    <div className="bg-black text-white p-4 rounded-xl text-center">
                        <h4 className="font-black uppercase text-xs tracking-[0.2em]">MARCA CON UNA "X" POR CADA CIUDADANO QUE PRACTICÓ</h4>
                    </div>
                    
                    <div className="grid grid-cols-4 sm:grid-cols-8 md:grid-cols-13 border-2 border-black rounded-xl overflow-hidden bg-[#F8F9FA]">
                        {Array.from({ length: 104 }, (_, i) => i + 1).map((num) => (
                            <div 
                                key={num} 
                                className={cn(
                                    "aspect-square flex flex-col items-center justify-center border border-black/20 cursor-pointer transition-all hover:bg-black/5 select-none",
                                    markedCells.has(num) ? "bg-white shadow-inner" : "bg-transparent"
                                )}
                                onClick={() => toggleCell(num)}
                            >
                                <span className="text-[8px] font-bold text-muted-foreground leading-none mb-1">{num}</span>
                                {markedCells.has(num) && (
                                    <span className="text-xl font-black leading-none animate-in zoom-in-50 duration-200">X</span>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center justify-center gap-4 py-8 border-y-2 border-dashed border-black/10">
                        <span className="text-lg font-black uppercase tracking-tight">TOTAL DE PERSONAS:</span>
                        <div className="h-16 w-32 border-b-4 border-black flex items-center justify-center">
                            <span className="text-4xl font-black">{markedCells.size}</span>
                        </div>
                        <span className="text-lg font-black uppercase tracking-tight">ciudadanos.</span>
                    </div>
                </div>

                {/* RESPALDO DOCUMENTAL */}
                <div className="space-y-6 pt-6 border-t-2 border-dashed">
                    <div className="flex items-center gap-3">
                        <Camera className="h-5 w-5 text-primary" />
                        <Label className="font-black uppercase text-xs">Respaldo Documental (Anexo III Firmado) *</Label>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {photo ? (
                            <div className="relative aspect-video rounded-3xl overflow-hidden border-4 border-white shadow-2xl group">
                                <Image src={photo} alt="Respaldo" fill className="object-cover" />
                                <Button variant="destructive" size="icon" className="absolute top-4 right-4 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" onClick={() => setPhoto(null)}>
                                    <Trash2 className="h-5 w-5" />
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                <div 
                                    className="flex flex-col items-center justify-center h-48 border-4 border-dashed rounded-[2.5rem] cursor-pointer hover:bg-muted/50 transition-all bg-white group"
                                    onClick={startCamera}
                                >
                                    <Camera className="h-12 w-12 text-muted-foreground group-hover:text-primary mb-2 transition-colors" />
                                    <span className="font-black uppercase text-[10px] text-muted-foreground">Capturar Formulario Físico</span>
                                </div>
                                <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-muted transition-all text-muted-foreground">
                                    <ImageIcon className="h-4 w-4" />
                                    <span className="text-[10px] font-black uppercase">Subir desde Galería / PDF</span>
                                    <Input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileUpload} />
                                </label>
                            </div>
                        )}
                        
                        <div className="flex flex-col justify-center p-8 bg-muted/20 rounded-[2.5rem] border-2 border-dashed">
                            <p className="text-[11px] font-bold text-muted-foreground uppercase leading-relaxed italic text-center">
                                * Es obligatorio adjuntar la fotografía del Anexo III físico con la firma y el sello de la jefatura para validar el informe semanal.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Observaciones Adicionales</Label>
                    <Input name="observaciones" placeholder="Detalles relevantes de la jornada (opcional)..." className="h-14 font-bold border-2 rounded-xl uppercase text-xs px-6" />
                </div>

              </CardContent>

              <CardFooter className="bg-muted/30 border-t p-10 md:p-12">
                <Button type="submit" className="w-full h-20 font-black uppercase text-xl tracking-[0.2em] shadow-2xl bg-black hover:bg-black/90 transition-transform active:scale-95" disabled={isSubmitting || !photo || markedCells.size === 0}>
                  {isSubmitting ? <Loader2 className="animate-spin mr-4 h-8 w-8" /> : "ENVIAR INFORME OFICIAL"}
                </Button>
              </CardFooter>
            </Card>
          </form>
        )}

        {!selectedEntry && (
            <div className="flex flex-col items-center justify-center py-32 border-4 border-dashed rounded-[3rem] bg-white text-muted-foreground opacity-40 max-w-2xl w-full">
                <FileText className="h-20 w-20 mb-6" />
                <p className="text-xl font-black uppercase tracking-widest text-center px-10">Seleccione una actividad de la agenda para comenzar el informe</p>
            </div>
        )}
      </main>

      {/* Diálogo de Cámara */}
      <Dialog open={isCameraOpen} onOpenChange={(open) => !open && stopCamera()}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-none bg-black rounded-[2rem]">
          <div className="relative aspect-[3/4] bg-black">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-8 border-2 border-white/20 rounded-xl pointer-events-none border-dashed" />
            <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-6 px-4">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={stopCamera}
                className="rounded-full h-16 w-16 bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <X className="h-6 w-6" />
              </Button>
              <Button 
                size="lg" 
                onClick={takePhoto}
                className="rounded-full h-20 w-20 bg-white hover:bg-white/90 text-black border-8 border-black/20"
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

// Exportación con Suspense para evitar errores de build con useSearchParams
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
