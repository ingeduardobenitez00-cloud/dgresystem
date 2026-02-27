'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Building, 
  Search, 
  Camera, 
  Trash2, 
  FileUp, 
  Landmark, 
  Navigation, 
  CheckCircle2, 
  Clock, 
  Calendar as CalendarIcon, 
  Printer, 
  Check,
  FileText,
  X,
} from 'lucide-react';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, where, getDocs, limit } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { type PartidoPolitico } from '@/lib/data';
import Image from 'next/image';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { recordAuditLog } from '@/lib/audit';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ScrollArea } from '@/components/ui/scroll-area';

const MapModule = dynamic(() => import('@/components/map-module'), { 
  ssr: false,
  loading: () => (
    <div className="h-[400px] w-full bg-muted/20 animate-pulse rounded-[2rem] flex flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40" />
      <span className="text-[10px] font-black uppercase text-muted-foreground/40 tracking-widest">Preparando Mapa...</span>
    </div>
  )
});

function TimePickerInput({ 
  label, 
  value, 
  onChange 
}: { 
  label: string, 
  value: string, 
  onChange: (val: string) => void 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = ["00", "15", "30", "45"];

  const currentHour = value.split(':')[0] || '08';
  const currentMinute = value.split(':')[1] || '00';

  const handleSelect = (h: string, m: string) => {
    onChange(`${h}:${m}`);
  };

  return (
    <div className="space-y-2">
      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-tight">{label}</Label>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="relative group cursor-pointer">
            <div className={cn(
              "h-14 w-full flex items-center justify-between px-5 font-black text-xl border-2 rounded-[1.2rem] bg-white transition-all",
              isOpen ? "border-black shadow-md" : "border-muted group-hover:border-primary/40"
            )}>
              <span className="tracking-tighter">{value || "00:00"}</span>
              <Clock className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-0 shadow-2xl rounded-2xl border-none overflow-hidden" align="center">
          <div className="flex h-64">
            <ScrollArea className="flex-1 border-r">
              <div className="p-2 space-y-1">
                <p className="text-[8px] font-black text-center text-muted-foreground uppercase mb-2">Hora</p>
                {hours.map(h => (
                  <Button 
                    key={h} 
                    variant={currentHour === h ? "default" : "ghost"} 
                    className="w-full h-8 font-black text-xs rounded-lg"
                    onClick={() => handleSelect(h, currentMinute)}
                  >
                    {h}
                  </Button>
                ))}
              </div>
            </ScrollArea>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                <p className="text-[8px] font-black text-center text-muted-foreground uppercase mb-2">Min</p>
                {minutes.map(m => (
                  <Button 
                    key={m} 
                    variant={currentMinute === m ? "default" : "ghost"} 
                    className="w-full h-8 font-black text-xs rounded-lg"
                    onClick={() => {
                      handleSelect(currentHour, m);
                      setIsOpen(false);
                    }}
                  >
                    {m}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function SolicitudCapacitacionPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    solicitante_entidad: '',
    otra_entidad: '',
    tipo_solicitud: 'divulgacion' as 'divulgacion' | 'capacitacion',
    fecha: '',
    hora_desde: '08:00',
    hora_hasta: '12:00',
    lugar_local: '',
    direccion_calle: '',
    barrio_compania: '',
    rol_solicitante: 'apoderado' as 'apoderado' | 'otro',
    nombre_completo: '',
    cedula: '',
    telefono: '',
    gps: '',
  });

  const [photoDataUri, setPhotoDataUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPartyPopoverOpen, setIsPartyPopoverOpen] = useState(false);
  const [isSearchingCedula, setIsSearchingCedula] = useState(false);
  const [padronFound, setPadronFound] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setIsMounted(true);
    const now = new Date();
    setFormData(prev => ({ ...prev, fecha: now.toISOString().split('T')[0] }));

    const fetchLogo = async () => {
      try {
        const response = await fetch('/logo.png');
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => setLogoBase64(reader.result as string);
        reader.readAsDataURL(blob);
      } catch (error) {
        console.error("Error fetching logo:", error);
      }
    };
    fetchLogo();
  }, []);

  const profile = user?.profile;

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
        const dataUri = canvas.toDataURL('image/jpeg', 0.8);
        setPhotoDataUri(dataUri);
        stopCamera();
      }
    }
  };

  const searchCedulaInPadron = useCallback(async (cedulaInput: string) => {
    const cleanTerm = (cedulaInput || '').trim().toUpperCase(); 
    if (!firestore || cleanTerm.length < 4) return;
    setIsSearchingCedula(true);
    try {
      const q = query(collection(firestore, 'padron'), where('cedula', '==', cleanTerm), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const found = snap.docs[0].data();
        setFormData(prev => ({ ...prev, nombre_completo: `${found.nombre} ${found.apellido}`.toUpperCase() }));
        setPadronFound(true);
      } else { 
        setPadronFound(false);
        toast({ variant: "destructive", title: "No encontrado", description: "Verifique si el número ingresado es correcto." });
      }
    } catch (error) { setPadronFound(false); } finally { setIsSearchingCedula(false); }
  }, [firestore, toast]);

  const handleCedulaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, cedula: e.target.value.toUpperCase(), nombre_completo: '' }));
    setPadronFound(false);
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhotoDataUri(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleLocationSelect = useCallback((lat: number, lng: number) => {
    setFormData(prev => ({ ...prev, gps: `${lat.toFixed(6)}, ${lng.toFixed(6)}` }));
  }, []);

  const handleSubmit = () => {
    if (!firestore || !user) return;
    const entidadFinal = formData.solicitante_entidad || formData.otra_entidad;
    if (!entidadFinal || !formData.lugar_local || !formData.nombre_completo) {
      toast({ variant: "destructive", title: "Faltan datos obligatorios" }); return;
    }
    setIsSubmitting(true);
    
    const docData = { 
      ...formData, 
      departamento: profile?.departamento || '', 
      distrito: profile?.distrito || '', 
      foto_firma: photoDataUri || '', 
      usuario_id: user.uid, 
      creado_por: profile?.username || user.email,
      fecha_creacion: new Date().toISOString(), 
      server_timestamp: serverTimestamp() 
    };
    
    addDoc(collection(firestore, 'solicitudes-capacitacion'), docData)
      .then((docRef) => {
        recordAuditLog(firestore, {
          usuario_id: user.uid,
          usuario_nombre: profile?.username || user.email || 'Usuario Desconocido',
          usuario_rol: profile?.role || 'funcionario',
          accion: 'CREAR',
          modulo: 'solicitud-capacitacion',
          documento_id: docRef.id,
          detalles: `Nueva solicitud para ${formData.lugar_local} (${entidadFinal})`
        });

        toast({ title: "¡Solicitud Registrada!" });
        setFormData(p => ({ ...p, solicitante_entidad: '', otra_entidad: '', lugar_local: '', nombre_completo: '', cedula: '', gps: '', telefono: '' }));
        setPhotoDataUri(null);
        setIsSubmitting(false);
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'solicitudes-capacitacion', operation: 'create', requestResourceData: docData }));
        setIsSubmitting(false);
      });
  };

  const generatePDF = () => {
    if (!logoBase64) return;
    
    if (user && firestore) {
        recordAuditLog(firestore, {
            usuario_id: user.uid,
            usuario_nombre: profile?.username || user.email || 'Anonimo',
            usuario_rol: profile?.role || 'funcionario',
            accion: 'PDF_GENERADO',
            modulo: 'solicitud-capacitacion',
            detalles: `Generación de Proforma PDF para ${formData.lugar_local}`
        });
    }

    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.addImage(logoBase64, 'PNG', margin, 5, 22, 22);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text("Justicia Electoral", pageWidth / 2, 15, { align: "center" });
    
    doc.save(`Solicitud-${formData.lugar_local.replace(/\s+/g, '-') || 'AnexoV'}.pdf`);
  };

  const partidosQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'partidos-politicos'), orderBy('nombre')) : null, [firestore]);
  const { data: partidosData } = useCollection<PartidoPolitico>(partidosQuery);

  const selectedParty = useMemo(() => partidosData?.find(p => p.nombre === formData.solicitante_entidad), [partidosData, formData.solicitante_entidad]);

  if (isUserLoading || !isMounted) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Nueva Solicitud" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Nueva Solicitud</h1>
                <p className="text-muted-foreground text-xs font-bold uppercase flex items-center gap-2 mt-1">
                    <FileText className="h-3.5 w-3.5" /> Registro oficial con trazabilidad de auditoría activa.
                </p>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" className="font-black uppercase text-[10px] border-2 h-10" onClick={generatePDF}>
                    <Printer className="mr-2 h-3.5 w-3.5" /> GENERAR PDF OFICIAL
                </Button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 shadow-2xl border-none overflow-hidden rounded-xl bg-white">
            <CardHeader className="bg-black py-4 px-6">
              <CardTitle className="text-sm font-black uppercase text-white flex items-center gap-2">
                <Building className="h-4 w-4" /> DATOS DE LA ACTIVIDAD
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-10">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1"><Landmark className="h-3 w-3"/> Departamento Asignado</Label>
                    <Input value={profile?.departamento || '00 - ASUNCION'} readOnly className="font-black bg-[#F8F9FA] uppercase border-2 h-11" />
                </div>
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1"><Navigation className="h-3 w-3"/> Distrito / Oficina</Label>
                    <Input value={profile?.distrito || 'SIN ASIGNAR'} readOnly className="font-black bg-[#F8F9FA] uppercase border-2 h-11" />
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Grupo Político Solicitante</Label>
                    <div className="flex gap-2">
                        <Popover open={isPartyPopoverOpen} onOpenChange={setIsPartyPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="flex-1 justify-between h-12 font-bold text-lg border-2 overflow-hidden">
                                    <span className="truncate">{selectedParty ? `${selectedParty.nombre} (${selectedParty.siglas})` : "Seleccionar de la lista..."}</span>
                                    <Search className="ml-2 h-5 w-5 opacity-30 shrink-0" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-2xl">
                                <Command>
                                    <CommandInput placeholder="Buscar partido..." />
                                    <CommandList>
                                        <CommandEmpty>No encontrado.</CommandEmpty>
                                        <CommandGroup>
                                            {partidosData?.map(p => (
                                                <CommandItem key={p.id} value={p.nombre} onSelect={() => { setFormData(prev => ({...prev, solicitante_entidad: p.nombre, otra_entidad: ''})); setIsPartyPopoverOpen(false); }} className="flex flex-col items-start gap-1 p-3 cursor-pointer">
                                                    <span className="font-black text-xs uppercase text-left">{p.nombre}</span>
                                                    <span className="text-[10px] font-black text-primary uppercase">{p.siglas}</span>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        {formData.solicitante_entidad && (
                            <Button variant="outline" size="icon" className="h-12 w-12 border-2 border-destructive text-destructive" onClick={() => setFormData(prev => ({...prev, solicitante_entidad: ''}))}><X className="h-5 w-5" /></Button>
                        )}
                    </div>
                </div>
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Otra Entidad</Label>
                    <Input placeholder="Especifique si no es un partido..." value={formData.otra_entidad} onChange={(e) => setFormData(prev => ({ ...prev, otra_entidad: e.target.value, solicitante_entidad: '' }))} className="h-11 font-bold border-2" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="p-8 border-2 border-dashed rounded-[2rem] bg-[#F8F9FA] space-y-6">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">TIPO DE SOLICITUD</Label>
                    <div className="space-y-4">
                        <div className={cn("flex items-center space-x-4 p-5 rounded-2xl border-2 cursor-pointer", formData.tipo_solicitud === 'divulgacion' ? "bg-white border-black" : "bg-[#F8F9FA] border-muted")} onClick={() => setFormData(p => ({...p, tipo_solicitud: 'divulgacion'}))}>
                            <div className={cn("h-6 w-6 rounded-md border-2 flex items-center justify-center", formData.tipo_solicitud === 'divulgacion' ? "bg-black text-white" : "border-muted-foreground/30")}>
                              {formData.tipo_solicitud === 'divulgacion' && <Check className="h-4 w-4 stroke-[4]" />}
                            </div>
                            <Label className="font-black uppercase text-sm cursor-pointer">DIVULGACIÓN (MÁQUINA)</Label>
                        </div>
                        <div className={cn("flex items-center space-x-4 p-5 rounded-2xl border-2 cursor-pointer", formData.tipo_solicitud === 'capacitacion' ? "bg-white border-black" : "bg-[#F8F9FA] border-muted")} onClick={() => setFormData(p => ({...p, tipo_solicitud: 'capacitacion'}))}>
                            <div className={cn("h-6 w-6 rounded-md border-2 flex items-center justify-center", formData.tipo_solicitud === 'capacitacion' ? "bg-black text-white" : "border-muted-foreground/30")}>
                              {formData.tipo_solicitud === 'capacitacion' && <Check className="h-4 w-4 stroke-[4]" />}
                            </div>
                            <Label className="font-black uppercase text-sm cursor-pointer">CAPACITACIÓN (MESA)</Label>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col justify-center space-y-8">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">FECHA PROPUESTA</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <div className="h-14 w-full flex items-center px-4 font-black text-lg border-2 rounded-xl bg-white cursor-pointer">
                              {formData.fecha ? format(parseISO(formData.fecha), "dd/MM/yyyy") : "SELECCIONAR FECHA"}
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 rounded-2xl border-none overflow-hidden" align="end">
                            <Calendar mode="single" selected={formData.fecha ? parseISO(formData.fecha) : undefined} onSelect={(date) => setFormData(p => ({ ...p, fecha: date ? format(date, "yyyy-MM-dd") : '' }))} locale={es} initialFocus className="bg-white" />
                          </PopoverContent>
                        </Popover>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <TimePickerInput label="DESDE" value={formData.hora_desde} onChange={(val) => setFormData(p => ({ ...p, hora_desde: val }))} />
                        <TimePickerInput label="HASTA" value={formData.hora_hasta} onChange={(val) => setFormData(p => ({ ...p, hora_hasta: val }))} />
                    </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Lugar y/o Local</Label>
                    <Input value={formData.lugar_local} onChange={e => setFormData(p => ({...p, lugar_local: e.target.value}))} className="h-11 font-bold border-2" />
                </div>
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Dirección (Calle)</Label>
                    <Input value={formData.direccion_calle} onChange={e => setFormData(p => ({...p, direccion_calle: e.target.value}))} className="h-11 font-bold border-2" />
                </div>
              </div>

              <div className="space-y-8 pt-4">
                <div className="flex items-center gap-4">
                    <h3 className="font-black uppercase text-xs shrink-0">Datos del Solicitante</h3>
                    <Separator className="flex-1" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-2">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground">Nombre Completo</Label>
                        <Input value={formData.nombre_completo} readOnly={padronFound} className={cn("h-11 font-bold uppercase border-2", padronFound && "bg-green-50")} />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground">C.I.C. N°</Label>
                        <div className="flex gap-2">
                            <Input value={formData.cedula} onChange={handleCedulaChange} className="h-11 font-black border-2 uppercase" />
                            <Button variant="secondary" size="icon" className="h-11 w-11 shrink-0" onClick={() => searchCedulaInPadron(formData.cedula)} disabled={isSearchingCedula}>
                                {isSearchingCedula ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground">Número de Celular</Label>
                        <Input 
                            value={formData.telefono} 
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                let formatted = val;
                                if (val.length > 4) formatted = `${val.slice(0, 4)}-${val.slice(4)}`;
                                if (val.length > 7) formatted = `${val.slice(0, 4)}-${val.slice(4, 7)}-${val.slice(7)}`;
                                setFormData(prev => ({ ...prev, telefono: formatted }));
                            }} 
                            placeholder="09XX-XXX-XXX"
                            className="h-11 font-bold border-2" 
                        />
                    </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-8">
            <Card className="shadow-2xl border-none overflow-hidden rounded-xl bg-white">
              <CardContent className="p-8">
                <MapModule onLocationSelect={handleLocationSelect} />
              </CardContent>
            </Card>
            <Card className="shadow-2xl border-none overflow-hidden rounded-xl bg-white">
              <CardHeader className="bg-white border-b py-6 px-8">
                <CardTitle className="text-lg font-black uppercase text-primary flex items-center gap-3">
                    <Camera className="h-5 w-5" /> RESPALDO DOCUMENTAL
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-4">
                {photoDataUri ? (
                    <div className="relative aspect-video w-full rounded-2xl overflow-hidden border-4 border-white shadow-xl group">
                        <Image src={photoDataUri} alt="Respaldo" fill className="object-cover" />
                        <Button variant="destructive" size="icon" className="absolute top-4 right-4 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setPhotoDataUri(null)}>
                            <Trash2 className="h-5 w-5" />
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex flex-col items-center justify-center gap-3 h-32 border-2 border-dashed rounded-[1.5rem] cursor-pointer hover:bg-muted/10 transition-all bg-muted/5 group" onClick={startCamera}>
                            <Camera className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest text-center">CÁMARA EN VIVO</span>
                        </div>
                        <label className="flex flex-col items-center justify-center gap-3 h-32 border-2 border-dashed rounded-[1.5rem] cursor-pointer hover:bg-muted/10 transition-all bg-muted/5 group">
                            <FileUp className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest text-center">GALERÍA / ARCHIVO</span>
                            <Input type="file" accept="image/*" className="hidden" onChange={handlePhotoCapture} />
                        </label>
                    </div>
                )}
              </CardContent>
            </Card>

            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting} 
              className="w-full h-20 bg-black hover:bg-black/90 text-white text-xs sm:text-sm md:text-base font-black uppercase rounded-2xl tracking-widest shadow-2xl px-4"
            >
              {isSubmitting ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : <CheckCircle2 className="mr-3 h-6 w-6" />}
              GUARDAR Y AGENDAR ACTIVIDAD
            </Button>
          </div>
        </div>
      </main>

      <Dialog open={isCameraOpen} onOpenChange={(o) => !o && stopCamera()}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none bg-black rounded-[2rem]">
          <div className="relative aspect-[3/4] w-full bg-black flex items-center justify-center">
            <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
            <div className="absolute inset-8 border-2 border-white/20 rounded-xl pointer-events-none border-dashed" />
          </div>
          <DialogFooter className="p-8 bg-black/80 flex flex-row items-center justify-between gap-4">
            <Button variant="outline" className="rounded-full h-14 w-14 border-white/20 bg-white/10 text-white" onClick={stopCamera}><X className="h-6 w-6" /></Button>
            <Button className="flex-1 h-16 rounded-full bg-white text-black font-black uppercase text-sm shadow-2xl" onClick={takePhoto}>CAPTURAR</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
