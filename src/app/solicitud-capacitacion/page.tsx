
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
  CheckCircle2, 
  Clock, 
  Calendar as CalendarIcon, 
  Printer, 
  Check,
  FileText,
  X,
  ImageIcon,
  ShieldAlert,
  Flag,
  ChevronsUpDown,
  Globe,
  MapPin
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUser, useFirebase, useCollection, useMemoFirebase, useCollectionOnce, useStorage } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, where, getDocs, limit, doc, updateDoc } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn, formatDateToDDMMYYYY } from '@/lib/utils';
import { type PartidoPolitico, type MaquinaVotacion, type SolicitudCapacitacion, type Dato } from '@/lib/data';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const userHook = useUser();
  const { user, isUserLoading } = userHook;
  const { firestore } = useFirebase();
  const { uploadFile, isUploading: isStorageUploading } = useStorage();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    solicitante_entidad: '',
    otra_entidad: '',
    movimiento_politico: '',
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
    departamento: '',
    distrito: '',
  });

  const [photoDataUri, setPhotoDataUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPartyPopoverOpen, setIsPartyPopoverOpen] = useState(false);
  const [isMovementPopoverOpen, setIsMovementPopoverOpen] = useState(false);
  const [isSearchingCedula, setIsSearchingCedula] = useState(false);
  const [padronFound, setPadronFound] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const [isStockConflict, setIsStockConflict] = useState(false);
  const [conflictingFixedPlace, setConflictingFixedPlace] = useState<SolicitudCapacitacion | null>(null);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setIsMounted(true);
    const now = new Date();
    setFormData(prev => ({ 
      ...prev, 
      fecha: now.toISOString().split('T')[0],
      departamento: profile?.departamento || '',
      distrito: profile?.distrito || ''
    }));

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
  const isAdminView = ['admin', 'director', 'coordinador'].includes(profile?.role || '') || profile?.permissions?.includes('admin_filter');

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData } = useCollectionOnce<Dato>(datosQuery);

  const departments = useMemo(() => {
    if (!datosData) return [];
    return [...new Set(datosData.map(d => d.departamento))].sort();
  }, [datosData]);

  const districts = useMemo(() => {
    if (!datosData || !formData.departamento) return [];
    return [...new Set(datosData.filter(d => d.departamento === formData.departamento).map(d => d.distrito))].sort();
  }, [datosData, formData.departamento]);

  useEffect(() => {
    if (profile && !formData.departamento && !formData.distrito) {
      setFormData(prev => ({
        ...prev,
        departamento: profile.departamento || '',
        distrito: profile.distrito || ''
      }));
    }
  }, [profile, formData.departamento, formData.distrito]);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800; // Reducido para ahorrar espacio en Firestore
          const scaleSize = Math.min(1, MAX_WIDTH / img.width);
          canvas.width = img.width * scaleSize;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          // Calidad 0.4 para asegurar que el registro no exceda 1MB
          resolve(canvas.toDataURL('image/jpeg', 0.4));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const maquinasQuery = useMemoFirebase(() => {
    if (!firestore || !formData.departamento || !formData.distrito) return null;
    return query(collection(firestore, 'maquinas'), where('departamento', '==', formData.departamento), where('distrito', '==', formData.distrito));
  }, [firestore, formData.departamento, formData.distrito]);
  const { data: maquinasDistrito } = useCollection<MaquinaVotacion>(maquinasQuery);

  const solicitudesConflictQuery = useMemoFirebase(() => {
    if (!firestore || !formData.departamento || !formData.distrito || !formData.fecha) return null;
    return query(
        collection(firestore, 'solicitudes-capacitacion'), 
        where('departamento', '==', formData.departamento), 
        where('distrito', '==', formData.distrito),
        where('fecha', '==', formData.fecha)
    );
  }, [firestore, formData.departamento, formData.distrito, formData.fecha]);
  const { data: solicitudesMismoDia } = useCollection<SolicitudCapacitacion>(solicitudesConflictQuery);

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
      const MAX_WIDTH = 1200;
      const scaleSize = Math.min(1, MAX_WIDTH / videoRef.current.videoWidth);
      canvas.width = videoRef.current.videoWidth * scaleSize;
      canvas.height = videoRef.current.videoHeight * scaleSize;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUri = canvas.toDataURL('image/jpeg', 0.7);
        setPhotoDataUri(dataUri);
        stopCamera();
      }
    }
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file);
        setPhotoDataUri(compressed);
      } catch (err) {
        toast({ variant: 'destructive', title: "Error al procesar respaldo" });
      }
    }
  };

  const handleLocationSelect = useCallback((lat: number, lng: number) => {
    setFormData(prev => ({ ...prev, gps: `${lat.toFixed(6)}, ${lng.toFixed(6)}` }));
  }, []);

  const checkStockAvailability = () => {
    if (!maquinasDistrito || !solicitudesMismoDia) return true;
    
    const totalMaquinas = maquinasDistrito.length;
    if (totalMaquinas === 0) return false;

    const overlapping = solicitudesMismoDia.filter(s => {
        if (s.cancelada) return false;
        return (formData.hora_desde < s.hora_hasta) && (formData.hora_hasta > s.hora_desde);
    });

    if (overlapping.length >= totalMaquinas) {
        const fixedPlace = overlapping.find(s => s.tipo_solicitud === 'Lugar Fijo');
        if (fixedPlace) {
            setConflictingFixedPlace(fixedPlace);
        } else {
            setConflictingFixedPlace(null);
        }
        return false;
    }

    return true;
  };

  const handleSubmit = (bypassStock = false) => {
    if (!firestore || !user) return;
    const entidadFinal = formData.solicitante_entidad || formData.otra_entidad;
    
    if (!entidadFinal || !formData.lugar_local || !formData.nombre_completo || !photoDataUri) {
      toast({ 
        variant: "destructive", 
        title: "Faltan datos obligatorios",
        description: !photoDataUri ? "Debe capturar o subir una foto del respaldo documental." : "Complete todos los campos del formulario."
      }); 
      return;
    }

    if (!bypassStock && !checkStockAvailability()) {
        setIsStockConflict(true);
        return;
    }

    setIsSubmitting(true);
    
    const performSubmit = async () => {
      try {
        const idBatch = Date.now();
        
        // 1. Subir foto de respaldo a Storage
        const photoUrl = await uploadFile(
          `solicitudes/${formData.distrito}/${idBatch}.jpg`, 
          photoDataUri!
        );

        const docData = { 
          ...formData, 
          departamento: formData.departamento, 
          distrito: formData.distrito, 
          foto_firma: photoUrl, // Ahora es una URL de Storage
          usuario_id: user.uid, 
          creado_por: profile?.username || user.email,
          fecha_creacion: new Date().toISOString(), 
          server_timestamp: serverTimestamp() 
        };
        
        const docRef = await addDoc(collection(firestore, 'solicitudes-capacitacion'), docData);
        
        recordAuditLog(firestore, {
          usuario_id: user.uid,
          usuario_nombre: profile?.username || user.email || 'Usuario Desconocido',
          usuario_rol: profile?.role || 'funcionario',
          accion: 'CREAR',
          modulo: 'solicitud-capacitacion',
          documento_id: docRef.id,
          detalles: `Nueva solicitud para ${formData.lugar_local} (Storage)`
        });

        toast({ title: "¡Solicitud Registrada!" });
        setFormData(p => ({ 
            ...p, 
            solicitante_entidad: '', 
            otra_entidad: '', 
            movimiento_politico: '', 
            lugar_local: '', 
            nombre_completo: '', 
            cedula: '', 
            gps: '', 
            telefono: '' 
        }));
        setPhotoDataUri(null);
      } catch (error: any) {
        console.error("Error submitting solicitud:", error);
        const errorMsg = error.message || String(error);
        if (errorMsg.includes('too large') || errorMsg.includes('size limit')) {
          toast({ variant: 'destructive', title: 'Archivo muy pesado', description: 'El archivo supera el límite permitido.' });
        } else {
          toast({ variant: 'destructive', title: "Error", description: "No se pudo guardar la solicitud." });
        }
      } finally {
        setIsSubmitting(false);
      }
    };

    performSubmit();
  };

  const handleSuspendAndSave = async () => {
    if (!firestore || !conflictingFixedPlace) return;
    setIsSubmitting(true);
    
    try {
        const docRef = doc(firestore, 'solicitudes-capacitacion', conflictingFixedPlace.id);
        await updateDoc(docRef, {
            cancelada: true,
            motivo_cancelacion: `SUSPENSIÓN POR PRIORIDAD DE SOLICITUD EN ${formData.lugar_local}`,
            fecha_cancelacion: new Date().toISOString(),
            usuario_cancelacion: profile?.username || user?.email || 'SISTEMA'
        });

        toast({ title: "Lugar Fijo Suspendido", description: "Agenda liberada. Guardando nueva solicitud..." });
        setIsStockConflict(false);
        handleSubmit(true);
    } catch (e) {
        toast({ variant: 'destructive', title: "Error al suspender" });
        setIsSubmitting(false);
    }
  };

  const generatePDF = () => {
    if (!logoBase64) return;
    const doc = new jsPDF();
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    const distritoNombre = (formData.distrito || '').replace(/^\d+\s*-\s*/, '').toUpperCase();

    doc.addImage(logoBase64, 'PNG', margin, 8, 18, 18);
    doc.setFontSize(7); doc.setFont('helvetica', 'bold');
    doc.text("REPÚBLICA DEL PARAGUAY", margin + 20, 14);
    doc.text("Justicia Electoral", margin + 20, 18);
    
    doc.setFontSize(22); doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text("Justicia Electoral", pageWidth / 2, 16, { align: "center" });
    doc.setFontSize(14); doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text("Custodio de la Voluntad Popular", pageWidth / 2, 24, { align: "center" });

    const barW = 2.5; const barH = 18; const barX = pageWidth - margin - (barW * 3);
    doc.setFillColor(200, 0, 0); doc.rect(barX, 10, barW, barH, 'F');
    doc.setFillColor(240, 240, 240); doc.rect(barX + barW, 10, barW, barH, 'F');
    doc.setFillColor(0, 0, 200); doc.rect(barX + (barW * 2), 10, barW, barH, 'F');

    let y = 35;
    doc.setFillColor(235, 235, 235);
    doc.rect(margin, y, pageWidth - (margin * 2), 8, 'F');
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text("ANEXO V – PROFORMA DE SOLICITUD", pageWidth / 2, y + 5.5, { align: 'center' });

    y += 18;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text(`${distritoNombre}, ________ de ________________ de 2026`, pageWidth - margin, y, { align: 'right' });

    y += 15;
    doc.text("Señor/a", margin, y);
    y += 6; doc.setFont('helvetica', 'bold');
    doc.text("________________________________________", margin, y);
    y += 8;
    doc.text("Presente:", margin, y);

    y += 10;
    doc.setFont('helvetica', 'normal');
    const intro = "Tengo el agrado de dirigirme a usted/es, en virtud a las próximas Elecciones Internas simultáneas de las Organizaciones Políticas del 07 de junio del 2026, a los efectos de solicitar:";
    const introLines = doc.splitTextToSize(intro, pageWidth - (margin * 2) - 10);
    doc.text(introLines, margin + 5, y);

    y += 15;
    const drawSquare = (x: number, yPos: number, active: boolean) => {
        doc.rect(x, yPos - 4, 5, 5);
        if(active) { doc.setFont('helvetica', 'bold'); doc.text("X", x + 1, yPos); }
    }
    
    drawSquare(margin + 15, y, formData.tipo_solicitud === 'divulgacion');
    doc.setFont('helvetica', 'bold'); doc.text("Divulgación sobre el uso de la Máquina de Votación Electrónica.", margin + 23, y);
    
    y += 8;
    drawSquare(margin + 15, y, formData.tipo_solicitud === 'capacitacion');
    doc.setFont('helvetica', 'bold'); doc.text("Capacitación sobre las funciones de los miembros de mesa receptora de votos.", margin + 23, y);

    y += 12;
    const entidadFinal = formData.solicitante_entidad || formData.otra_entidad;
    const tableData = [
        ["ENTIDAD", `: ${entidadFinal.toUpperCase()}${formData.movimiento_politico ? ' - ' + formData.movimiento_politico : ''}`],
        ["FECHA", `: ${formData.fecha ? formatDateToDDMMYYYY(formData.fecha) : '    /    '} / 2026`],
        ["HORARIO", `: ${formData.hora_desde} A ${formData.hora_hasta} HS`],
        ["LUGAR Y/O LOCAL", `: ${formData.lugar_local.toUpperCase()}`],
        ["DIRECCIÓN", `CALLE: ${formData.direccion_calle.toUpperCase()}`],
        ["BARRIO - COMPAÑIA", `: ${formData.barrio_compania.toUpperCase()}`],
        ["DISTRITO", `: ${distritoNombre}`],
    ];

    autoTable(doc, {
        startY: y,
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
        margin: { left: margin, right: margin }
    });

    y = (doc as any).lastAutoTable.finalY + 5;
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text("DATOS DEL SOLICITANTE – APODERADO", margin + 5, y + 4);
    
    drawSquare(margin + 75, y + 4, formData.rol_solicitante === 'apoderado');
    doc.text("OTRO", margin + 85, y + 4);
    drawSquare(margin + 98, y + 4, formData.rol_solicitante === 'otro');

    y += 8;
    const applicantRows = [
        ["NOMBRE COMPLETO", `: ${formData.nombre_completo.toUpperCase()}`],
        ["C.I.C. N.º", `: ${formData.cedula}`],
        ["NÚMERO DE CONTACTO\n(CELULAR – LÍNEA BAJA)", `: ${formData.telefono}`]
    ];

    autoTable(doc, {
        startY: y,
        body: applicantRows,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
        margin: { left: margin, right: margin }
    });

    y = (doc as any).lastAutoTable.finalY + 2;
    doc.setFillColor(235, 235, 235);
    doc.rect(margin, y, pageWidth - (margin * 2), 18, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text("OBSERVACION", pageWidth / 2, y + 5, { align: 'center' });
    doc.setFont('helvetica', 'italic');
    doc.text("La recepción de solicitudes se realiza hasta 48 horas de antelación a la fecha del evento.", pageWidth / 2, y + 10, { align: 'center' });
    doc.text("En caso de cancelación de la actividad debe informarse con 24 horas de anticipación.", pageWidth / 2, y + 14, { align: 'center' });

    y += 25;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text("Se hace propicia la ocasión para saludarle muy cordialmente.", margin, y);

    y += 35;
    doc.setFont('helvetica', 'bold');
    doc.text("Firma del Solicitante: ________________________________________", margin, y);

    doc.save(`AnexoV-${formData.lugar_local.replace(/\s+/g, '-')}.pdf`);
  };

  const partidosQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'partidos-politicos'), orderBy('nombre')) : null, [firestore]);
  const { data: partidosData } = useCollectionOnce<PartidoPolitico>(partidosQuery);

  const uniqueParties = useMemo(() => {
    if (!partidosData) return [];
    const seen = new Set<string>();
    return partidosData.filter(p => {
        if (seen.has(p.nombre)) return false;
        seen.add(p.nombre);
        return true;
    });
  }, [partidosData]);

  const availableMovements = useMemo(() => {
    if (!partidosData || !formData.solicitante_entidad) return [];
    const movements = partidosData
        .filter(p => p.nombre === formData.solicitante_entidad && p.movimiento)
        .map(p => p.movimiento!)
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort();
    return movements;
  }, [partidosData, formData.solicitante_entidad]);

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
        toast({ variant: "destructive", title: "No encontrado" });
      }
    } catch (error) { setPadronFound(false); } finally { setIsSearchingCedula(false); }
  }, [firestore, toast]);

  const canSave = useMemo(() => {
    const entidadFinal = formData.solicitante_entidad || formData.otra_entidad;
    return !!(entidadFinal && formData.lugar_local && formData.nombre_completo && photoDataUri && formData.fecha);
  }, [formData, photoDataUri]);

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Anexo V - Solicitudes" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Registro de Solicitud</h1>
                <p className="text-muted-foreground text-xs font-bold uppercase flex items-center gap-2 mt-1">
                    <FileText className="h-3.5 w-3.5" /> Generación de proforma Anexo V y control de stock institucional.
                </p>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" className="font-black uppercase text-[10px] border-2 h-10 gap-2 shadow-sm" onClick={generatePDF}>
                    <Printer className="mr-2 h-3.5 w-3.5" /> PDF PRELIMINAR (PROFORMA)
                </Button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 shadow-2xl border-none overflow-hidden rounded-[2rem] bg-white">
            <CardHeader className="bg-black py-6 px-8">
              <CardTitle className="text-sm font-black uppercase text-white flex items-center gap-3">
                <Building className="h-5 w-5" /> DATOS DEL EVENTO
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-10">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Departamento</Label>
                    {isAdminView ? (
                      <Select 
                        onValueChange={(v) => setFormData(prev => ({ ...prev, departamento: v, distrito: '' }))} 
                        value={formData.departamento}
                      >
                        <SelectTrigger className="font-black uppercase border-2 h-12 rounded-xl bg-white shadow-sm">
                          <SelectValue placeholder="Seleccionar Departamento" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-2xl">
                          {departments.map(d => <SelectItem key={d} value={d} className="uppercase font-bold py-3">{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={formData.departamento} readOnly className="font-black bg-[#F8F9FA] uppercase border-2 h-12 rounded-xl" />
                    )}
                </div>
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Distrito / Oficina</Label>
                    {isAdminView ? (
                      <Select 
                        onValueChange={(v) => setFormData(prev => ({ ...prev, distrito: v }))} 
                        value={formData.distrito}
                        disabled={!formData.departamento}
                      >
                        <SelectTrigger className="font-black uppercase border-2 h-12 rounded-xl bg-white shadow-sm disabled:opacity-50">
                          <SelectValue placeholder="Seleccionar Distrito" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-2xl">
                          {districts.map(d => <SelectItem key={d} value={d} className="uppercase font-bold py-3">{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={formData.distrito} readOnly className="font-black bg-[#F8F9FA] uppercase border-2 h-12 rounded-xl" />
                    )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[9px] font-black uppercase text-primary">Grupo Político o Institución Solicitante *</Label>
                        <Popover open={isPartyPopoverOpen} onOpenChange={setIsPartyPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-between h-14 font-black text-lg border-2 rounded-xl overflow-hidden uppercase">
                                    <span className="truncate">{formData.solicitante_entidad || "Seleccionar..."}</span>
                                    <Search className="ml-2 h-5 w-5 opacity-30 shrink-0" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-2xl rounded-xl border-none overflow-hidden">
                                <Command>
                                    <CommandInput placeholder="Buscar partido..." />
                                    <CommandList>
                                        <CommandEmpty>No encontrado.</CommandEmpty>
                                        <CommandGroup>
                                            {uniqueParties.map(p => (
                                                <CommandItem key={p.id} value={p.nombre} onSelect={() => { 
                                                    setFormData(prev => ({...prev, solicitante_entidad: p.nombre, otra_entidad: '', movimiento_politico: ''})); 
                                                    setIsPartyPopoverOpen(false); 
                                                }} className="flex flex-col items-start gap-1 p-4 cursor-pointer hover:bg-muted">
                                                    <span className="font-black text-xs uppercase text-left">{p.nombre}</span>
                                                    <span className="text-[10px] font-black text-primary uppercase opacity-40">{p.siglas}</span>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[9px] font-black uppercase text-primary">Movimiento Político (Opcional)</Label>
                        <Popover open={isMovementPopoverOpen} onOpenChange={setIsMovementPopoverOpen}>
                            <PopoverTrigger asChild disabled={!formData.solicitante_entidad || availableMovements.length === 0}>
                                <Button variant="outline" className={cn(
                                    "w-full justify-between h-14 font-black text-lg border-2 rounded-xl overflow-hidden uppercase",
                                    (!formData.solicitante_entidad || availableMovements.length === 0) && "opacity-40 bg-muted/20"
                                )}>
                                    <span className="truncate">{formData.movimiento_politico || (availableMovements.length === 0 ? "Sin movimientos" : "Seleccionar...")}</span>
                                    <ChevronsUpDown className="ml-2 h-5 w-5 opacity-30 shrink-0" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-2xl rounded-xl border-none overflow-hidden">
                                <Command>
                                    <CommandInput placeholder="Buscar movimiento..." />
                                    <CommandList>
                                        <CommandEmpty>No encontrado.</CommandEmpty>
                                        <CommandGroup>
                                            {availableMovements.map(m => (
                                                <CommandItem key={m} value={m} onSelect={() => { 
                                                    setFormData(prev => ({...prev, movimiento_politico: m})); 
                                                    setIsMovementPopoverOpen(false); 
                                                }} className="p-4 cursor-pointer hover:bg-muted">
                                                    <Flag className="mr-2 h-4 w-4 opacity-40" />
                                                    <span className="font-black text-xs uppercase">{m}</span>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">En caso de no ser un partido (Opcional)</Label>
                    <Input placeholder="Ej: Comisión Vecinal, Cooperativa..." value={formData.otra_entidad} onChange={(e) => setFormData(prev => ({ ...prev, otra_entidad: e.target.value, solicitante_entidad: '', movimiento_politico: '' }))} className="h-12 font-bold border-2 rounded-xl" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="p-8 border-2 border-dashed rounded-[2rem] bg-muted/5 space-y-6">
                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest">TIPO DE SOLICITUD</Label>
                    <div className="space-y-4">
                        {[
                            { id: 'divulgacion', label: 'DIVULGACIÓN (MV)' },
                            { id: 'capacitacion', label: 'CAPACITACIÓN (MM)' }
                        ].map(t => (
                            <div key={t.id} className={cn("flex items-center space-x-4 p-5 rounded-2xl border-2 cursor-pointer transition-all", formData.tipo_solicitud === t.id ? "bg-white border-black shadow-lg scale-[1.02]" : "bg-muted/10 border-transparent")} onClick={() => setFormData(p => ({...p, tipo_solicitud: t.id as any}))}>
                                <div className={cn("h-6 w-6 rounded-lg border-2 flex items-center justify-center", formData.tipo_solicitud === t.id ? "bg-black text-white" : "border-muted-foreground/30")}>
                                  {formData.tipo_solicitud === t.id && <Check className="h-4 w-4 stroke-[4]" />}
                                </div>
                                <Label className="font-black uppercase text-sm cursor-pointer">{t.label}</Label>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex flex-col justify-center space-y-8">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary">FECHA DEL EVENTO *</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <div className="h-14 w-full flex items-center px-5 font-black text-xl border-2 rounded-[1.2rem] bg-white cursor-pointer hover:border-black transition-all">
                              <CalendarIcon className="mr-3 h-5 w-5 opacity-30" />
                              {formData.fecha ? formatDateToDDMMYYYY(formData.fecha) : "__/__/____"}
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl overflow-hidden" align="end">
                            <Calendar mode="single" selected={formData.fecha ? parseISO(formData.fecha) : undefined} onSelect={(date) => setFormData(p => ({ ...p, fecha: date ? format(date, "yyyy-MM-dd") : '' }))} locale={es} initialFocus className="bg-white" />
                          </PopoverContent>
                        </Popover>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <TimePickerInput label="HORA INICIO" value={formData.hora_desde} onChange={(val) => setFormData(p => ({ ...p, hora_desde: val }))} />
                        <TimePickerInput label="HORA FIN" value={formData.hora_hasta} onChange={(val) => setFormData(p => ({ ...p, hora_hasta: val }))} />
                    </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Local / Lugar *</Label>
                    <Input value={formData.lugar_local} onChange={e => setFormData(p => ({...p, lugar_local: e.target.value.toUpperCase()}))} className="h-12 font-black border-2 rounded-xl" />
                </div>
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Dirección (Calle / Referencia)</Label>
                    <Input value={formData.direccion_calle} onChange={e => setFormData(p => ({...p, direccion_calle: e.target.value.toUpperCase()}))} className="h-12 font-black border-2 rounded-xl" />
                </div>
              </div>

              <div className="space-y-8 pt-4">
                <div className="flex items-center gap-4">
                    <h3 className="font-black uppercase text-xs text-primary shrink-0">Solicitante Autorizado *</h3>
                    <Separator className="flex-1" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-2">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground">Nombre y Apellido</Label>
                        <Input value={formData.nombre_completo} readOnly={padronFound} className={cn("h-12 font-black uppercase border-2 rounded-xl", padronFound && "bg-green-50/50 border-green-200")} />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground">C.I.C. N°</Label>
                        <div className="flex gap-2">
                            <Input value={formData.cedula} onChange={e => setFormData(p => ({...p, cedula: e.target.value.toUpperCase(), nombre_completo: ''}))} className="h-12 font-black border-2 uppercase rounded-xl" />
                            <Button variant="secondary" size="icon" className="h-12 w-12 shrink-0 rounded-xl" onClick={() => searchCedulaInPadron(formData.cedula)} disabled={isSearchingCedula}>
                                {isSearchingCedula ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-8">
            <Card className="shadow-2xl border-none overflow-hidden rounded-[2rem] bg-white">
              <CardContent className="p-8">
                <MapModule onLocationSelect={handleLocationSelect} />
              </CardContent>
            </Card>
            
            <Card className="shadow-2xl border-none overflow-hidden rounded-[2rem] bg-white">
              <CardHeader className="bg-muted/10 border-b py-6 px-8">
                <CardTitle className="text-sm font-black uppercase text-primary flex items-center gap-3">
                    <Camera className="h-5 w-5" /> RESPALDO ANEXO V *
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-4">
                {photoDataUri ? (
                    <div className="relative aspect-video w-full rounded-2xl overflow-hidden border-4 border-white shadow-xl group">
                        {photoDataUri.startsWith('data:application/pdf') ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-muted/30">
                                <FileText className="h-12 w-12 text-primary opacity-40 mb-2" />
                                <p className="text-[9px] font-black uppercase text-primary/60">Documento PDF</p>
                            </div>
                        ) : (
                            <Image src={photoDataUri} alt="Respaldo" fill className="object-cover" />
                        )}
                        <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" onClick={() => setPhotoDataUri(null)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col items-center justify-center gap-2 h-24 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/10 transition-all bg-muted/5" onClick={startCamera}>
                            <Camera className="h-6 w-6 text-primary opacity-30" />
                            <span className="text-[8px] font-black uppercase text-primary/40">CÁMARA</span>
                        </div>
                        <label className="flex flex-col items-center justify-center gap-2 h-24 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/10 transition-all bg-muted/5">
                            <FileUp className="h-6 w-6 text-primary opacity-30" />
                            <span className="text-[8px] font-black uppercase text-primary/40">GALERÍA</span>
                            <Input type="file" accept="image/*,.pdf" className="hidden" onChange={handlePhotoCapture} />
                        </label>
                    </div>
                )}
              </CardContent>
            </Card>

            <Button 
              onClick={() => handleSubmit(false)} 
              disabled={isSubmitting || !canSave} 
              className={cn(
                "w-full h-20 font-black uppercase rounded-[1.5rem] tracking-[0.2em] shadow-2xl px-4 transition-all",
                canSave ? "bg-black hover:bg-black/90 text-white" : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {isSubmitting ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : <CheckCircle2 className="mr-3 h-6 w-6" />}
              {canSave ? "GUARDAR Y AGENDAR" : "COMPLETAR REQUISITOS *"}
            </Button>
          </div>
        </div>
      </main>

      <AlertDialog open={isStockConflict} onOpenChange={setIsStockConflict}>
        <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8">
            <AlertDialogHeader className="space-y-4">
                <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-2 border-4 border-destructive/20">
                    <ShieldAlert className="h-8 w-8 text-destructive" />
                </div>
                <AlertDialogTitle className="text-2xl font-black uppercase text-center tracking-tight">STOCK DE MÁQUINAS AGOTADO</AlertDialogTitle>
                <AlertDialogDescription className="text-center space-y-4">
                    <p className="text-xs font-bold uppercase text-muted-foreground leading-relaxed">
                        No hay equipos de votación disponibles para el periodo <span className="text-primary">{formData.hora_desde} A {formData.hora_hasta} HS</span> del día <span className="text-primary">{formatDateToDDMMYYYY(formData.fecha)}</span> en este distrito.
                    </p>
                    
                    {conflictingFixedPlace && (
                        <div className="bg-amber-50 border-2 border-dashed border-amber-200 p-6 rounded-2xl space-y-3">
                            <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Sugerencia de Optimización:</p>
                            <p className="text-xs font-bold uppercase text-amber-800 leading-tight">
                                Se ha detectado que un <span className="font-black">LUGAR FIJO</span> bloquea la agenda:
                                <br/><br/>
                                <span className="text-sm font-black underline">{conflictingFixedPlace.lugar_local}</span>
                            </p>
                            <p className="text-[9px] font-medium text-amber-600 uppercase italic">¿Desea suspender este lugar fijo para liberar una máquina?</p>
                        </div>
                    )}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-8 sm:justify-center gap-4">
                <AlertDialogCancel className="h-14 rounded-xl font-black uppercase text-[10px] px-8 border-2" onClick={() => setIsStockConflict(false)}>CERRAR</AlertDialogCancel>
                {conflictingFixedPlace && (
                    <Button 
                        variant="destructive" 
                        className="h-14 rounded-xl font-black uppercase text-[10px] px-8 shadow-xl bg-destructive hover:bg-destructive/90"
                        onClick={handleSuspendAndSave}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : "SUSPENDER FIJO Y AGENDAR"}
                    </Button>
                )}
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
