
"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  ArrowLeftRight, 
  Truck, 
  Undo2, 
  CalendarDays, 
  Printer,
  ShieldAlert,
  Check,
  Camera,
  FileUp,
  X,
  Trash2,
  FileText,
  Cpu,
  Minus,
  User,
  Plus,
  CheckCircle2,
  PackageCheck,
  Power,
  PowerOff,
  AlertTriangle,
  Download,
  Search,
  ChevronsUpDown
} from 'lucide-react';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, query, where, doc, updateDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import jsPDF from 'jspdf';
import { type SolicitudCapacitacion, type MovimientoMaquina, type MaquinaVotacion, type MaquinaMovimiento } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatDateToDDMMYYYY } from '@/lib/utils';
import Image from 'next/image';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
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

const normalizeGeo = (str: string) => {
  if (!str) return '';
  return str.toUpperCase()
    .replace(/^\d+[\s-]*\s*/, '') // Elimina "10 - ", "10-", "10 " al inicio
    .trim();
};

function ControlMovimientoContent() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const solicitudIdFromUrl = searchParams.get('solicitudId');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [logoDGREBase64, setLogoDGREBase64] = useState<string | null>(null);
  const [logoCIDEEBase64, setLogoCIDEEBase64] = useState<string | null>(null);
  const [selectedSolicitudId, setSelectedSolicitudId] = useState<string | null>(null);
  const [isDevolucionGuardada, setIsDevolucionGuardada] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [openSelectors, setOpenSelectors] = useState<{ [key: number]: boolean }>({});
  
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeCameraTarget, setActiveCameraTarget] = useState<'salida' | 'devolucion' | 'denuncia_evidencia' | 'denuncia_respaldo' | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [salidaFotos, setSalidaFotos] = useState<string[]>([]);
  const [devolucionFotos, setDevolucionFotos] = useState<string[]>([]);
  
  const [denunciaDetalles, setDenunciaDetalles] = useState('');
  const [denunciaEvidencias, setDenunciaEvidencias] = useState<string[]>([]);
  const [denunciaRespaldo, setDenunciaRespaldo] = useState<string | null>(null);

  const [movimientoData, setMovimientoData] = useState({
    fecha_salida: '',
    hora_salida: '',
    fecha_devolucion: '',
    hora_devolucion: '',
    maquinas: [] as MaquinaMovimiento[],
  });

  useEffect(() => {
    const now = new Date();
    setMovimientoData(p => ({
      ...p,
      fecha_salida: now.toISOString().split('T')[0],
      hora_salida: now.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false }),
      fecha_devolucion: now.toISOString().split('T')[0],
      hora_devolucion: now.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false }),
      maquinas: [{ 
        codigo: '', 
        pendrive_serie: '', 
        credencial: false, 
        auricular: false, 
        acrilico: false, 
        boletas: false,
        retorno_credencial: false,
        retorno_auricular: false,
        retorno_acrilico: false,
        retorno_boletas: false
      }]
    }));
  }, []);

  useEffect(() => {
    const fetchLogos = async () => {
      try {
        const [r1, r2, r3] = await Promise.all([
          fetch('/logo.png'),
          fetch('/logo3.png'),
          fetch('/logo1.png')
        ]);
        const [b1, b2, b3] = await Promise.all([r1.blob(), r2.blob(), r3.blob()]);
        
        const readBlob = (blob: Blob): Promise<string> => new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        setLogoBase64(await readBlob(b1));
        setLogoDGREBase64(await readBlob(b2));
        setLogoCIDEEBase64(await readBlob(b3));
      } catch (error) {
        console.error("Error fetching logos:", error);
      }
    };
    fetchLogos();
  }, []);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800; // Optimización de espacio en Firestore
          const scaleSize = Math.min(1, MAX_WIDTH / img.width);
          canvas.width = img.width * scaleSize;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject('No context');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          // Calidad 0.4 para permitir más fotos por registro
          resolve(canvas.toDataURL('image/jpeg', 0.4));
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const profile = user?.profile;

  const agendaQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !profile) return null;
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    const isAdmin = ['admin', 'director'].includes(profile.role || '') || profile.permissions?.includes('admin_filter');
    
    if (isAdmin) return colRef;
    
    // GUARDIA: Evitar consulta si faltan campos requeridos en el perfil
    if (!profile.departamento || !profile.distrito) return null;
    
    return query(colRef, where('departamento', '==', profile.departamento), where('distrito', '==', profile.distrito));
  }, [firestore, isUserLoading, profile]);

  const { data: rawAgendaItems, isLoading: isLoadingAgenda } = useCollection<SolicitudCapacitacion>(agendaQuery);

  const selectedSolicitud = useMemo(() => {
    return rawAgendaItems?.find(item => item.id === selectedSolicitudId);
  }, [rawAgendaItems, selectedSolicitudId]);

  const maquinasQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !profile) return null;
    const colRef = collection(firestore, 'maquinas');
    const isAdmin = ['admin', 'director', 'coordinador'].includes(profile.role || '') || profile.permissions?.includes('admin_filter');

    const deptoOriginal = selectedSolicitud?.departamento || profile.departamento || '';
    const deptoNormalized = normalizeGeo(deptoOriginal);
    
    const variants = [deptoOriginal];
    if (deptoNormalized && deptoNormalized !== deptoOriginal) {
        variants.push(deptoNormalized);
    }

    // Usamos 'in' para traer solo las máquinas del departamento (con y sin prefijo numérico)
    // Esto es mucho más eficiente que cargar todo el inventario nacional para 500 usuarios.
    return query(colRef, where('departamento', 'in', variants));
  }, [firestore, isUserLoading, profile, selectedSolicitud?.departamento]);

  const { data: rawMaquinas, isLoading: isLoadingMaquinas } = useCollection<MaquinaVotacion>(maquinasQuery);

  const maquinasInventario = useMemo(() => {
    if (!rawMaquinas) return [];
    if (!selectedSolicitud) return rawMaquinas;

    const targetDepto = normalizeGeo(selectedSolicitud.departamento);
    const targetDist = normalizeGeo(selectedSolicitud.distrito);

    return rawMaquinas.filter(m => 
      normalizeGeo(m.departamento) === targetDepto && 
      normalizeGeo(m.distrito) === targetDist
    );
  }, [rawMaquinas, selectedSolicitud]);

  const movimientosQueryAll = useMemoFirebase(() => firestore ? collection(firestore, 'movimientos-maquinas') : null, [firestore]);
  const { data: allMovimientos } = useCollection<MovimientoMaquina>(movimientosQueryAll);

  const denunciasQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'denuncias-lacres');
  }, [firestore]);

  const { data: allDenuncias } = useCollection<any>(denunciasQuery);

  const agendaItems = useMemo(() => {
    if (!rawAgendaItems || !allMovimientos || !allDenuncias) return [];
    
    return [...rawAgendaItems]
      .filter(item => {
        if (item.cancelada) return false;
        const mov = allMovimientos.find(m => m.solicitud_id === item.id);
        const den = allDenuncias.find(d => d.solicitud_id === item.id);
        
        if (!mov) return true;
        if (!mov.fecha_devolucion) return true;
        
        const hasTampering = mov.maquinas.some(m => m.lacre_estado === 'violentado');
        if (hasTampering && !den) return true;
        
        return false;
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [rawAgendaItems, allMovimientos, allDenuncias]);

  const currentMovimiento = useMemo(() => {
    return allMovimientos?.find(m => m.solicitud_id === selectedSolicitudId) || null;
  }, [allMovimientos, selectedSolicitudId]);

  useEffect(() => {
    if (solicitudIdFromUrl && agendaItems.length > 0 && !selectedSolicitudId) {
      const matching = agendaItems.find(item => item.id === solicitudIdFromUrl);
      if (matching) setSelectedSolicitudId(matching.id);
    }
  }, [solicitudIdFromUrl, agendaItems, selectedSolicitudId]);

  useEffect(() => {
    // Solo inicializar si detectamos un cambio de ID de movimiento o de solicitud
    if (currentMovimiento) {
        setMovimientoData({
            fecha_salida: currentMovimiento.fecha_salida,
            hora_salida: currentMovimiento.hora_salida,
            fecha_devolucion: currentMovimiento.fecha_devolucion || new Date().toISOString().split('T')[0],
            hora_devolucion: currentMovimiento.hora_devolucion || new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false }),
            maquinas: currentMovimiento.maquinas.map(m => ({
                ...m,
                retorno_credencial: m.retorno_credencial ?? false,
                retorno_auricular: m.retorno_auricular ?? false,
                retorno_acrilico: m.retorno_acrilico ?? false,
                retorno_boletas: m.retorno_boletas ?? false
            }))
        });
        
        const existingSalida = Array.isArray(currentMovimiento.foto_salida) 
            ? currentMovimiento.foto_salida 
            : currentMovimiento.foto_salida ? [currentMovimiento.foto_salida] : [];
        
        const existingDevolucion = Array.isArray(currentMovimiento.foto_devolucion) 
            ? currentMovimiento.foto_devolucion 
            : currentMovimiento.foto_devolucion ? [currentMovimiento.foto_devolucion] : [];

        setSalidaFotos(existingSalida);
        setDevolucionFotos(existingDevolucion);
        setIsDevolucionGuardada(!!currentMovimiento.fecha_devolucion);
    } else {
        const now = new Date();
        setMovimientoData(p => ({
            ...p,
            fecha_salida: now.toISOString().split('T')[0],
            hora_salida: now.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false }),
            maquinas: [{ 
                codigo: '', 
                pendrive_serie: '', 
                credencial: false, 
                auricular: false, 
                acrilico: false, 
                boletas: false,
                retorno_credencial: false,
                retorno_auricular: false,
                retorno_acrilico: false,
                retorno_boletas: false
            }]
        }));
        setSalidaFotos([]);
        setDevolucionFotos([]);
        setIsDevolucionGuardada(false);
    }
  }, [currentMovimiento?.id, selectedSolicitudId]);

  const handleAddMaquina = () => {
    if (movimientoData.maquinas.length >= 3) {
        toast({ variant: 'destructive', title: "Límite alcanzado", description: "Máximo 3 equipos por solicitud." });
        return;
    }
    setMovimientoData(prev => ({
      ...prev,
      maquinas: [
        ...prev.maquinas,
        { 
          codigo: '', 
          pendrive_serie: '', 
          credencial: false, 
          auricular: false, 
          acrilico: false, 
          boletas: false,
          retorno_credencial: false,
          retorno_auricular: false,
          retorno_acrilico: false,
          retorno_boletas: false
        }
      ]
    }));
  };

  const handleRemoveMaquina = (index: number) => {
    if (movimientoData.maquinas.length <= 1) return;
    setMovimientoData(prev => ({
      ...prev,
      maquinas: prev.maquinas.filter((_, i) => i !== index)
    }));
  };

  const startCamera = async (target: any) => {
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
        // Compresión agresiva para asegurar envío de 5 fotos
        const dataUri = canvas.toDataURL('image/jpeg', 0.6);
        if (activeCameraTarget === 'salida') {
            setSalidaFotos(prev => [...prev, dataUri].slice(0, 5));
        }
        else if (activeCameraTarget === 'devolucion') {
            setDevolucionFotos(prev => [...prev, dataUri].slice(0, 5));
        }
        else if (activeCameraTarget === 'denuncia_evidencia') setDenunciaEvidencias(prev => [...prev, dataUri].slice(0, 5));
        else if (activeCameraTarget === 'denuncia_respaldo') setDenunciaRespaldo(dataUri);
        stopCamera();
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: any) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (target === 'salida' || target === 'devolucion') {
      const remaining = 5 - (target === 'salida' ? salidaFotos.length : devolucionFotos.length);
      const selection = Array.from(files).slice(0, remaining);
      for (const file of selection) {
        try {
          const result = await compressImage(file);
          if (target === 'salida') setSalidaFotos(prev => [...prev, result].slice(0, 5));
          else setDevolucionFotos(prev => [...prev, result].slice(0, 5));
        } catch (err) {
          toast({ variant: 'destructive', title: "Error al procesar imagen" });
        }
      }
    } else if (target === 'denuncia_respaldo') {
      const file = files[0];
      try {
        const result = await compressImage(file);
        setDenunciaRespaldo(result);
      } catch (err) {
        toast({ variant: 'destructive', title: "Error al procesar respaldo" });
      }
    } else if (target === 'denuncia_evidencia') {
      const remaining = 5 - denunciaEvidencias.length;
      const selection = Array.from(files).slice(0, remaining)
      for (const file of selection) {
        try {
          const result = await compressImage(file);
          setDenunciaEvidencias(prev => [...prev, result].slice(0, 5));
        } catch (err) {
          toast({ variant: 'destructive', title: "Error al procesar evidencia" });
        }
      }
    }
  };

  const updateMaquina = (index: number, field: keyof MaquinaMovimiento, value: any) => {
    const newMaquinas = [...movimientoData.maquinas];
    newMaquinas[index] = { ...newMaquinas[index], [field]: value };
    setMovimientoData(prev => ({ ...prev, maquinas: newMaquinas }));
  };

  const handleSaveSalida = () => {
    if (!firestore || !user || !selectedSolicitud) return;
    if (movimientoData.maquinas.some(m => !m.codigo)) {
      toast({ variant: 'destructive', title: 'Faltan Series', description: 'Todas las máquinas deben tener nro. de serie.' }); return;
    }
    if (salidaFotos.length === 0) {
      toast({ variant: 'destructive', title: 'Falta Respaldo', description: 'Cargue al menos una foto del F01 firmado.' }); return;
    }

    setIsSubmitting(true);
    const docData: Omit<MovimientoMaquina, 'id'> = {
      solicitud_id: selectedSolicitudId!,
      departamento: selectedSolicitud.departamento || '',
      distrito: selectedSolicitud.distrito || '',
      maquinas: movimientoData.maquinas,
      fecha_salida: movimientoData.fecha_salida,
      hora_salida: movimientoData.hora_salida,
      foto_salida: salidaFotos,
      responsables: selectedSolicitud.divulgadores || selectedSolicitud.asignados || [],
      fecha_creacion: new Date().toISOString(),
    };

    addDoc(collection(firestore, 'movimientos-maquinas'), docData)
      .then(() => {
        toast({ title: '¡Salida Registrada!' });
        setIsSubmitting(false);
      })
      .catch(error => {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes('too large') || errorMsg.includes('size limit')) {
          toast({ variant: 'destructive', title: 'Archivo muy pesado', description: 'El archivo que estás adjuntando supera el límite permitido (1MB). Por favor, intenta con una foto menos pesada.' });
        } else {
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'movimientos-maquinas', operation: 'create' }));
        }
        setIsSubmitting(false);
      });
  };

  const handleSaveDevolucion = () => {
    if (!firestore || !user || !selectedSolicitud || !currentMovimiento) return;
    if (movimientoData.maquinas.some(m => !m.lacre_estado)) {
        toast({ variant: 'destructive', title: 'Verificación incompleta', description: 'Verifique el lacre de todos los equipos.' }); return;
    }
    if (devolucionFotos.length === 0) {
      toast({ variant: 'destructive', title: 'Falta F02', description: 'Cargue al menos una foto del F02 firmado.' }); return;
    }

    setIsSubmitting(true);
    const updateData = {
      fecha_devolucion: movimientoData.fecha_devolucion,
      hora_devolucion: movimientoData.hora_devolucion,
      maquinas: movimientoData.maquinas,
      foto_devolucion: devolucionFotos
    };

    updateDoc(doc(firestore, 'movimientos-maquinas', currentMovimiento.id), updateData)
      .then(async () => {
        setIsDevolucionGuardada(true);
        const hasTampering = movimientoData.maquinas.some(m => m.lacre_estado === 'violentado');
        if (hasTampering) {
            toast({ title: 'Recepción Informada', description: 'Irregularidad detectada. Proceda a la denuncia.' });
        } else {
            toast({ title: '¡Devolución Completada!', description: 'Ciclo cerrado exitosamente.' });
            
            // Verificar si ya se envió el informe para marcar ciclo cumplido
            const infQuery = query(collection(firestore, 'informes-divulgador'), where('solicitud_id', '==', selectedSolicitud.id));
            const infSnap = await getDocs(infQuery);
            if (!infSnap.empty) {
                await updateDoc(doc(firestore, 'solicitudes-capacitacion', selectedSolicitud.id), {
                    fecha_cumplido: new Date().toISOString()
                });
            }

            setTimeout(() => setSelectedSolicitudId(null), 1500);
        }
        setIsSubmitting(false);
      })
      .catch(error => {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes('too large') || errorMsg.includes('size limit')) {
          toast({ variant: 'destructive', title: 'Archivo muy pesado', description: 'El archivo que estás adjuntando supera el límite permitido (1MB). Por favor, intenta con una foto menos pesada.' });
        } else {
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: currentMovimiento.id, operation: 'update' }));
        }
        setIsSubmitting(false);
      });
  };

  const handleSaveDenuncia = () => {
    if (!firestore || !user || !selectedSolicitud) return;
    if (!denunciaDetalles || !denunciaRespaldo) {
        toast({ variant: 'destructive', title: 'Datos incompletos', description: 'Complete el motivo y adjunte el respaldo físico.' }); return;
    }

    setIsSubmitting(true);
    const tampered = movimientoData.maquinas.filter(m => m.lacre_estado === 'violentado').map(m => m.codigo);
    
    const denunciaData = {
        solicitud_id: selectedSolicitudId,
        departamento: selectedSolicitud.departamento,
        distrito: selectedSolicitud.distrito,
        lugar: selectedSolicitud.lugar_local,
        maquinas_denunciadas: tampered,
        detalles: denunciaDetalles.toUpperCase(),
        foto_evidencia: denunciaEvidencias,
        foto_respaldo_documental: denunciaRespaldo,
        usuario_id: user.uid,
        username: profile?.username || user.email,
        fecha_denuncia: new Date().toISOString().split('T')[0],
        hora_denuncia: new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false }),
        fecha_creacion: new Date().toISOString(),
        server_timestamp: serverTimestamp(),
    };

    addDoc(collection(firestore, 'denuncias-lacres'), denunciaData)
        .then((docRef) => {
            recordAuditLog(firestore, {
                usuario_id: user.uid,
                usuario_nombre: profile?.username || user.email || 'Usuario',
                usuario_rol: profile?.role || 'funcionario',
                accion: 'CREAR',
                modulo: 'denuncia-lacres',
                documento_id: docRef.id,
                detalles: `Acta de denuncia para ${selectedSolicitud.lugar_local} - Máquinas: ${tampered.join(', ')}`
            });

            toast({ title: "¡Denuncia Registrada!", description: "El proceso ha sido cerrado formalmente." });
            setDenunciaDetalles('');
            setDenunciaEvidencias([]);
            setDenunciaRespaldo(null);
            setSelectedSolicitudId(null);
            setIsSubmitting(false);
        })
        .catch(error => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'denuncias-lacres', operation: 'create' }));
            setIsSubmitting(false);
        });
  };

  const generatePDF = () => {
    if (!selectedSolicitud || !logoBase64 || !logoDGREBase64) {
      toast({ variant: 'destructive', title: "Cargando recursos...", description: "Espere a que los logos se carguen." });
      return;
    }
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const boxWidth = pageWidth - (margin * 2);
    const responsibles = selectedSolicitud.divulgadores || selectedSolicitud.asignados || [];
    const isOnlySalida = !currentMovimiento;

    doc.addImage(logoBase64, 'PNG', margin, 8, 15, 15);
    doc.addImage(logoDGREBase64, 'PNG', pageWidth - margin - 35, 8, 35, 15);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text("FORMULARIO SALIDA / DEVOLUCIÓN DE MAQUINAS DE VOTACIÓN PARA DIVULGACIÓN", pageWidth / 2, 28, { align: "center" });

    let y = 35;
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.circle(margin + 8, y, 4);
    doc.setFontSize(10);
    doc.text("A", margin + 8, y + 1, { align: 'center' });
    doc.setFontSize(9);
    doc.text("SALIDA DE MÁQUINA DE VOTACIÓN PARA DIVULGACIÓN", pageWidth / 2, y + 1, { align: 'center' });

    y += 8;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text("NOMBRE Y APELLIDO DEL FUNCIONARIO RESPONSABLE DE LA DIVULGACIÓN", margin, y);

    y += 4;
    const cardW = (boxWidth - 10) / 3;
    const cardH = 14;
    for (let i = 0; i < 3; i++) {
        const cx = margin + (i * (cardW + 5));
        const resp = responsibles[i];
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.1);
        doc.roundedRect(cx, y, cardW, cardH, 3, 3, 'D');
        if (resp) {
            doc.setFontSize(7); doc.setFont('helvetica', 'bold');
            doc.text(resp.nombre.toUpperCase(), cx + (cardW / 2), y + 5, { align: 'center', maxWidth: cardW - 4 });
            doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
            doc.text(`C.I. ${resp.cedula}`, cx + 4, y + 11);
            doc.text(resp.vinculo.toUpperCase(), cx + cardW - 4, y + 11, { align: 'right' });
        }
    }

    y += cardH + 6;
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text(`HORA SALIDA:`, margin, y);
    doc.roundedRect(margin + 22, y - 4, 20, 6, 3, 3);
    doc.setFont('helvetica', 'normal');
    doc.text(`${movimientoData.hora_salida} HS`, margin + 32, y - 0.5, { align: 'center' });
    doc.text(`FECHA SALIDA: ${formatDateToDDMMYYYY(movimientoData.fecha_salida)}`, pageWidth - margin, y, { align: 'right' });

    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text("IDENTIFICACIÓN DEL EQUIPO (DESPACHO)", margin, y);
    
    movimientoData.maquinas.forEach((maq, idx) => {
        y += 2;
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(margin, y, boxWidth, 16, 4, 4);
        
        doc.setFontSize(7); doc.setFont('helvetica', 'bold');
        doc.text(`SERIE:`, margin + 5, y + 6);
        doc.roundedRect(margin + 15, y + 2, 40, 6, 3, 3);
        doc.setFont('helvetica', 'normal');
        doc.text(maq.codigo || '', margin + 18, y + 6);

        doc.setFont('helvetica', 'bold');
        doc.text(`LUGAR:`, margin + 65, y + 6);
        doc.roundedRect(margin + 78, y + 2, boxWidth - 83, 6, 3, 3);
        doc.setFont('helvetica', 'normal');
        doc.text(selectedSolicitud.lugar_local.toUpperCase(), margin + 82, y + 6);

        y += 10;
        const kitLabels = ["CREDENCIAL", "AURICULAR", "ACRILICO", "BOLETAS"];
        const kitVals = [maq.credencial, maq.auricular, maq.acrilico, maq.boletas];
        kitLabels.forEach((lbl, i) => {
            const kx = margin + 10 + (i * 45);
            doc.setDrawColor(0); doc.rect(kx, y, 4, 4);
            if (kitVals[i]) doc.text("X", kx + 1, y + 3.5);
            doc.setFontSize(7); doc.text(lbl, kx + 6, y + 3);
        });
        y += 10;
    });

    if (!isOnlySalida) {
        y += 5;
        doc.setDrawColor(0);
        doc.setLineWidth(0.3);
        doc.circle(margin + 8, y, 4);
        doc.setFontSize(10);
        doc.text("B", margin + 8, y + 1, { align: 'center' });
        doc.setFontSize(9);
        doc.text("DEVOLUCIÓN DE MÁQUINA DE VOTACIÓN PARA DIVULGACIÓN", pageWidth / 2, y + 1, { align: 'center' });

        y += 8;
        doc.setFontSize(8); doc.setFont('helvetica', 'bold');
        doc.text(`HORA REGRESO:`, margin, y);
        doc.roundedRect(margin + 25, y - 4, 20, 6, 3, 3);
        doc.setFont('helvetica', 'normal');
        doc.text(`${movimientoData.hora_devolucion || '__:__'} HS`, margin + 35, y - 0.5, { align: 'center' });
        doc.text(`FECHA REGRESO: ${movimientoData.fecha_devolucion ? formatDateToDDMMYYYY(movimientoData.fecha_devolucion) : '__/__/____'}`, pageWidth - margin, y, { align: 'right' });

        y += 8;
        doc.setFont('helvetica', 'bold');
        doc.text("AUDITORÍA DE RETORNO POR EQUIPO", margin, y);

        movimientoData.maquinas.forEach((maq, idx) => {
            y += 2;
            const isViolentado = maq.lacre_estado === 'violentado';
            
            if (isViolentado) { doc.setDrawColor(200, 0, 0); } else { doc.setDrawColor(200, 200, 200); }
            doc.setLineWidth(isViolentado ? 0.5 : 0.1);
            doc.roundedRect(margin, y, boxWidth, 22, 4, 4);
            
            doc.setFontSize(7); doc.setFont('helvetica', 'bold');
            if(isViolentado) doc.setTextColor(200, 0, 0);
            doc.text(`SERIE: ${maq.codigo}`, margin + 5, y + 6);
            doc.setTextColor(0, 0, 0);

            doc.text("ESTADO LACRE:", margin + 60, y + 6);
            doc.setDrawColor(0); doc.setLineWidth(0.2);
            doc.circle(margin + 85, y + 5.5, 2);
            if (maq.lacre_estado === 'correcto') { doc.setFillColor(0, 0, 0); doc.circle(margin + 85, y + 5.5, 1.2, 'F'); }
            doc.text("CORRECTO", margin + 89, y + 6);

            doc.circle(margin + 115, y + 5.5, 2);
            if (isViolentado) { 
                doc.setFillColor(200, 0, 0); 
                doc.circle(margin + 115, y + 5.5, 1.2, 'F'); 
                doc.setFont('helvetica', 'bold');
                doc.text("VIOLENTADO !!!", margin + 119, y + 6);
            } else {
                doc.text("VIOLENTADO", margin + 119, y + 6);
            }
            doc.setFont('helvetica', 'normal');

            y += 12;
            const kitRetLabels = ["RET. CREDENCIAL", "RET. AURICULAR", "RET. ACRILICO", "RET. 5 BOLETAS"];
            const kitRetVals = [maq.retorno_credencial, maq.retorno_auricular, maq.retorno_acrilico, maq.retorno_boletas];
            kitRetLabels.forEach((lbl, i) => {
                const kx = margin + 10 + (i * 45);
                doc.setDrawColor(0); doc.rect(kx, y, 4, 4);
                if (kitRetVals[i]) doc.text("X", kx + 1, y + 3.5);
                doc.setFontSize(7); doc.text(lbl, kx + 6, y + 3);
            });
            y += 12;
        });
    }

    const signatureStartY = doc.internal.pageSize.getHeight() - 65;
    y = Math.max(y + 10, signatureStartY);

    const sigSectionTitle = isOnlySalida ? "FIRMAS DE DESPACHO (SECCIÓN A - SALIDA)" : "MATRIZ DE FIRMAS INSTITUCIONALES (SECCIÓN A + B)";
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text(sigSectionTitle, pageWidth / 2, y, { align: 'center' });
    y += 4;

    const sigW_Jefe = (boxWidth - 10) / 2;
    const sigH = 15;

    doc.setDrawColor(0); doc.setLineWidth(0.3);
    doc.rect(margin, y, sigW_Jefe, sigH);
    doc.setFontSize(6);
    doc.text(isOnlySalida ? "ENTREGA (JEFATURA): ___________________" : "JEFE ENTREGA (A): _____________________", margin + 4, y + 6);
    doc.text("ACLARACIÓN: __________________________", margin + 4, y + 11);

    doc.rect(margin + sigW_Jefe + 10, y, sigW_Jefe, sigH);
    doc.text(isOnlySalida ? "ENTREGA (JEFATURA): ___________________" : "JEFE RECIBE (B): _______________________", margin + sigW_Jefe + 14, y + 6);
    doc.text("ACLARACIÓN: __________________________", margin + sigW_Jefe + 14, y + 11);

    y += sigH + 10;
    const sigTitleDivul = isOnlySalida ? "RESPONSABLES DE DIVULGACIÓN (RECIBEN CONFORME)" : "RESPONSABLES DE DIVULGACIÓN (ENTREGAN EQUIPOS)";
    doc.setFontSize(8); doc.text(sigTitleDivul, pageWidth / 2, y, { align: 'center' });
    y += 4;

    const sigW_Divul = (boxWidth - 10) / 3;
    for (let i = 0; i < 3; i++) {
        const sx = margin + (i * (sigW_Divul + 5));
        doc.rect(sx, y, sigW_Divul, sigH);
        doc.setFontSize(5);
        doc.text("FIRMA: ___________________", sx + 3, y + 6);
        doc.text("ACLARACIÓN: ______________", sx + 3, y + 11);
    }

    doc.save(`${isOnlySalida ? 'F01-Salida' : 'F02-Devolucion'}-${selectedSolicitud.lugar_local.replace(/\s+/g, '-')}.pdf`);
  };

  if (isUserLoading || isLoadingAgenda || isLoadingMaquinas) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Control Logístico Centralizado" />
      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Gestión de Equipos</h1>
                <p className="text-muted-foreground text-[10px] font-bold uppercase flex items-center gap-2 mt-1 tracking-widest">
                    <ArrowLeftRight className="h-3.5 w-3.5" /> Despacho, Retorno y Denuncia Integrada
                </p>
            </div>
            {selectedSolicitudId && (
                <Button variant="outline" className="font-black uppercase text-[10px] border-2 h-11 gap-2 shadow-xl bg-white" onClick={generatePDF}>
                    <Printer className="h-4 w-4" /> EXPORTAR PROFORMA {currentMovimiento ? 'F02' : 'F01'}
                </Button>
            )}
        </div>

        <Card className="border-primary/20 shadow-md">
          <CardHeader className="py-4 bg-primary/5">
            <CardTitle className="text-[10px] font-black flex items-center gap-2 uppercase tracking-widest text-primary">
              <CalendarDays className="h-4 w-4" /> ACTIVIDAD DE AGENDA SELECCIONADA
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Popover open={isSelectorOpen} onOpenChange={setIsSelectorOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={isSelectorOpen} className="w-full justify-between h-12 font-bold text-xs border-2 rounded-xl uppercase">
                        {selectedSolicitudId ? agendaItems.find(item => item.id === selectedSolicitudId)?.lugar_local.toUpperCase() : "Seleccione una actividad..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-30 shrink-0" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-2xl rounded-xl border-none overflow-hidden" align="start">
                    <Command>
                        <CommandInput placeholder="Buscar actividad..." className="h-11 font-bold" />
                        <CommandList>
                            <CommandEmpty className="py-6 text-center text-[10px] font-black uppercase text-muted-foreground">No se encontraron actividades.</CommandEmpty>
                            <CommandGroup>
                                {agendaItems.map((item) => (
                                    <CommandItem 
                                        key={item.id} 
                                        value={item.lugar_local} 
                                        onSelect={() => { setSelectedSolicitudId(item.id); setIsSelectorOpen(false); }}
                                        className="p-3 border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="flex flex-col gap-1">
                                            <span className="font-black text-[11px] uppercase text-primary">{item.lugar_local}</span>
                                            <span className="text-[9px] font-bold text-muted-foreground uppercase">{formatDateToDDMMYYYY(item.fecha)} | {item.distrito}</span>
                                        </div>
                                        <Check className={cn("ml-auto h-4 w-4 text-primary", selectedSolicitudId === item.id ? "opacity-100" : "opacity-0")} />
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
          </CardContent>
        </Card>

        {selectedSolicitudId && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            
            <Card className={cn("border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white", currentMovimiento && "opacity-60")}>
              <CardHeader className="p-8 border-b bg-[#F8F9FA]">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full border-4 border-black flex items-center justify-center font-black text-xl">A</div>
                    <div>
                        <CardTitle className="uppercase font-black text-xl leading-none">SALIDA DE EQUIPOS (F01)</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase mt-1">PERSONAL Y EQUIPO RESPONSABLE</CardDescription>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="p-10 space-y-10">
                <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Funcionarios Asignados</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-muted/20 rounded-3xl border-2 border-dashed">
                        {(selectedSolicitud?.divulgadores || selectedSolicitud?.asignados || []).slice(0, 3).map(a => (
                            <div key={a.id} className="bg-white border-2 rounded-2xl p-4 flex flex-col gap-1 shadow-sm">
                                <div className="flex items-center gap-2 border-b pb-2 mb-1">
                                    <User className="h-3 w-3 text-primary" />
                                    <span className="text-[11px] font-black uppercase truncate">{a.nombre}</span>
                                </div>
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-[9px] font-bold text-muted-foreground">C.I. {a.cedula}</span>
                                    <Badge variant="outline" className="text-[7px] font-black uppercase py-0 px-2 h-4 border-primary/20">{a.vinculo}</Badge>
                                </div>
                            </div>
                        ))}
                        {(selectedSolicitud?.divulgadores || selectedSolicitud?.asignados || []).length === 0 && (
                            <div className="col-span-full py-4 text-center text-[9px] font-black uppercase text-destructive italic">Sin personal asignado en agenda</div>
                        )}
                    </div>
                </div>

                {!currentMovimiento && (
                    <div className="space-y-8">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-primary">Fecha Salida</Label>
                                <Input type="date" value={movimientoData.fecha_salida} onChange={e => setMovimientoData(p => ({...p, fecha_salida: e.target.value}))} className="h-12 font-black border-2 rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-primary">Hora Salida</Label>
                                <Input type="time" value={movimientoData.hora_salida} onChange={e => setMovimientoData(p => ({...p, hora_salida: e.target.value}))} className="h-12 font-black border-2 rounded-xl" />
                            </div>
                        </div>

                        {movimientoData.maquinas.map((maq, idx) => (
                            <div key={idx} className="p-8 border-2 border-black rounded-[2rem] space-y-6 bg-muted/5 relative">
                                <div className="absolute -top-3 left-8 bg-black text-white px-4 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-3">
                                    EQUIPO #{idx + 1}
                                    {movimientoData.maquinas.length > 1 && (
                                        <Button variant="ghost" className="h-4 p-0 text-white hover:text-red-400" onClick={() => handleRemoveMaquina(idx)}>
                                            <Minus className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase text-muted-foreground">Serie de Máquina</Label>
                                        <Popover open={openSelectors[idx] || false} onOpenChange={(open) => setOpenSelectors(p => ({ ...p, [idx]: open }))}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" role="combobox" className="w-full h-12 border-2 rounded-xl font-black uppercase justify-between">
                                                    {maq.codigo || "Seleccione..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-30 shrink-0" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-2xl rounded-xl border-none overflow-hidden" align="start">
                                                <Command>
                                                    <CommandInput placeholder="Buscar serie..." className="h-11 font-bold" />
                                                    <CommandList>
                                                        <CommandEmpty className="py-6 text-center text-[10px] font-black uppercase text-muted-foreground">No se encontraron equipos.</CommandEmpty>
                                                        <CommandGroup>
                                                            {maquinasInventario?.map((m) => (
                                                                <CommandItem 
                                                                    key={m.id} 
                                                                    value={m.codigo} 
                                                                    onSelect={() => { 
                                                                        updateMaquina(idx, 'codigo', m.codigo); 
                                                                        setOpenSelectors(p => ({ ...p, [idx]: false }));
                                                                    }}
                                                                    className="p-3 border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors font-black text-xs uppercase flex items-center justify-between"
                                                                >
                                                                    {m.codigo}
                                                                    <Check className={cn("h-4 w-4 text-primary", maq.codigo === m.codigo ? "opacity-100" : "opacity-0")} />
                                                                </CommandItem>
                                                            ))}
                                                            {(!maquinasInventario || maquinasInventario.length === 0) && (
                                                                <div className="p-4 text-center text-[10px] font-black uppercase text-muted-foreground">Sin stock en este distrito</div>
                                                            )}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase text-muted-foreground">Serie Pendrive</Label>
                                        <Input value={maq.pendrive_serie} onChange={e => updateMaquina(idx, 'pendrive_serie', e.target.value.toUpperCase())} className="h-12 border-2 rounded-xl font-bold uppercase" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {['credencial', 'auricular', 'acrilico', 'boletas'].map(k => (
                                        <div key={k} className="flex items-center gap-2 cursor-pointer" onClick={() => updateMaquina(idx, k as any, !maq[k as keyof MaquinaMovimiento])}>
                                            <div className={cn("h-5 w-5 rounded-md border-2 border-black flex items-center justify-center", maq[k as keyof MaquinaMovimiento] ? "bg-black text-white" : "bg-white")}>
                                                {maq[k as keyof MaquinaMovimiento] && <Check className="h-3.5 w-3.5 stroke-[4]" />}
                                            </div>
                                            <span className="text-[9px] font-black uppercase">{k}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        <div className="flex justify-center pt-4">
                            <Button 
                                type="button" 
                                variant="outline" 
                                className="rounded-full border-2 font-black uppercase text-[10px] gap-2 h-10 px-6 hover:bg-black hover:text-white transition-all shadow-md"
                                onClick={handleAddMaquina}
                            >
                                <Plus className="h-4 w-4" /> AGREGAR OTRA MÁQUINA
                            </Button>
                        </div>

                        <div className="p-8 border-2 border-dashed border-primary/20 rounded-[2rem] space-y-4 bg-muted/5">
                            <Label className="font-black uppercase text-xs flex items-center gap-2"><FileText className="h-4 w-4" /> Respaldo F01 (Firma Jefatura) * <span className="text-primary opacity-40 ml-2">Máximo 5 fotos</span></Label>
                            
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                {salidaFotos.map((foto, i) => (
                                    <div key={i} className="relative aspect-video rounded-xl overflow-hidden border-2 border-white shadow-md group">
                                        <Image src={foto} alt={`F01-${i}`} fill className="object-cover" />
                                        <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" onClick={() => setSalidaFotos(prev => prev.filter((_, idx) => idx !== i))}><Trash2 className="h-3 w-3" /></Button>
                                    </div>
                                ))}
                                {salidaFotos.length < 5 && (
                                    <>
                                        <Button variant="outline" className="aspect-video flex-col border-dashed rounded-xl gap-1 hover:bg-white transition-all h-auto" onClick={() => startCamera('salida')}>
                                            <Camera className="h-5 w-5 opacity-40" /> 
                                            <span className="text-[7px] font-black uppercase">CÁMARA</span>
                                        </Button>
                                        <label className="aspect-video flex flex-col items-center justify-center border-2 border-dashed rounded-xl gap-1 cursor-pointer hover:bg-white transition-all">
                                            <FileUp className="h-5 w-5 opacity-40" /> 
                                            <span className="text-[7px] font-black uppercase">SUBIR</span>
                                            <Input type="file" multiple accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'salida')} />
                                        </label>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
              </CardContent>
              {!currentMovimiento && (
                <CardFooter className="p-0 border-t">
                    <Button onClick={handleSaveSalida} disabled={isSubmitting || salidaFotos.length === 0} className="w-full h-20 text-xl font-black uppercase bg-black hover:bg-black/90 rounded-none tracking-widest">
                        {isSubmitting ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : <Truck className="mr-3 h-6 w-6" />}
                        REGISTRAR SALIDA
                    </Button>
                </CardFooter>
              )}
            </Card>

            <Card className={cn("border-none shadow-2xl rounded-[2.5rem] overflow-hidden transition-all duration-500", !currentMovimiento || isDevolucionGuardada ? "opacity-40 grayscale pointer-events-none" : "bg-white")}>
              <CardHeader className="p-8 border-b bg-muted/10">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full border-4 border-black flex items-center justify-center font-black text-xl">B</div>
                    <div>
                        <CardTitle className="uppercase font-black text-xl leading-none">DEVOLUCIÓN DE EQUIPOS (F02)</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase mt-1">REINGRESO Y AUDITORÍA DE KITS</CardDescription>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="p-10 space-y-10">
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary">Fecha Reingreso</Label>
                        <Input type="date" value={movimientoData.fecha_devolucion} onChange={e => setMovimientoData(p => ({...p, fecha_devolucion: e.target.value}))} className="h-12 font-black border-2 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary">Hora Reingreso</Label>
                        <Input type="time" value={movimientoData.hora_devolucion} onChange={e => setMovimientoData(p => ({...p, hora_devolucion: e.target.value}))} className="h-12 font-black border-2 rounded-xl" />
                    </div>
                </div>

                <div className="bg-amber-50 border-2 border-dashed border-amber-200 p-6 rounded-[2rem] animate-pulse">
                  <p className="text-xs font-black text-amber-800 uppercase text-center leading-tight flex items-center justify-center gap-3">
                    <AlertTriangle className="h-5 w-5" />
                    ⚠️ NO TE OLVIDES DE MARCAR SI TU LACRE VOLVIÓ EN BUEN ESTADO O VIOLENTADO
                  </p>
                </div>

                <div className="space-y-8">
                    {movimientoData.maquinas.map((maq, idx) => (
                        <div key={idx} className="p-8 border-2 border-black rounded-[2rem] space-y-6 bg-white shadow-sm">
                            <div className="flex items-center justify-between border-b pb-4">
                                <span className="font-black text-xs uppercase text-muted-foreground tracking-widest">Identificación: <span className="text-primary">{maq.codigo}</span></span>
                                <div className="flex gap-4">
                                    <div className={cn("flex items-center gap-2 px-4 py-2 rounded-full border-2 cursor-pointer transition-all", maq.lacre_estado === 'correcto' ? "bg-black text-white border-black" : "bg-muted/30 border-transparent")} onClick={() => updateMaquina(idx, 'lacre_estado', 'correcto')}>
                                        <Check className={cn("h-4 w-4", maq.lacre_estado === 'correcto' ? "opacity-100" : "opacity-30")} /> <span className="text-[9px] font-black uppercase">LACRE CORRECTO</span>
                                    </div>
                                    <div className={cn("flex items-center gap-2 px-4 py-2 rounded-full border-2 cursor-pointer transition-all", maq.lacre_estado === 'violentado' ? "bg-destructive text-white border-destructive" : "bg-muted/30 border-transparent")} onClick={() => updateMaquina(idx, 'lacre_estado', 'violentado')}>
                                        <ShieldAlert className={cn("h-4 w-4", maq.lacre_estado === 'violentado' ? "opacity-100" : "opacity-30")} /> <span className="text-[9px] font-black uppercase">VIOLENTADO</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-muted/10 rounded-2xl border border-dashed">
                                {[
                                    { key: 'retorno_credencial', label: 'RETORNO CREDENCIAL' },
                                    { key: 'retorno_auricular', label: 'RETORNO AURICULAR' },
                                    { key: 'retorno_acrilico', label: 'RETORNO ACRÍLICO' },
                                    { key: 'retorno_boletas', label: 'RETORNO 5 BOLETAS' }
                                ].map(k => (
                                    <div key={k.key} className="flex items-center gap-2 cursor-pointer" onClick={() => updateMaquina(idx, k.key as any, !maq[k.key as keyof MaquinaMovimiento])}>
                                        <div className={cn("h-5 w-5 rounded-md border-2 border-black flex items-center justify-center transition-colors", maq[k.key as keyof MaquinaMovimiento] ? "bg-green-600 border-green-600 text-white" : "bg-white")}>
                                            {maq[k.key as keyof MaquinaMovimiento] && <Check className="h-3.5 w-3.5 stroke-[4]" />}
                                        </div>
                                        <span className="text-[9px] font-black uppercase text-[#1A1A1A]">{k.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-8 border-2 border-dashed border-primary/20 rounded-[2rem] space-y-4 bg-muted/5">
                    <Label className="font-black uppercase text-xs flex items-center gap-2"><FileText className="h-4 w-4" /> Respaldo F02 (Recibido conforme) * <span className="text-primary opacity-40 ml-2">Máximo 5 fotos</span></Label>
                    
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {devolucionFotos.map((foto, i) => (
                            <div key={i} className="relative aspect-video rounded-xl overflow-hidden border-2 border-white shadow-md group">
                                <Image src={foto} alt={`F02-${i}`} fill className="object-cover" />
                                <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" onClick={() => setDevolucionFotos(prev => prev.filter((_, idx) => idx !== i))}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                        ))}
                        {devolucionFotos.length < 5 && (
                            <>
                                <Button variant="outline" className="aspect-video flex-col border-dashed rounded-xl gap-1 hover:bg-white transition-all h-auto" onClick={() => startCamera('devolucion')}>
                                    <Camera className="h-5 w-5 opacity-40" /> 
                                    <span className="text-[7px] font-black uppercase">CÁMARA</span>
                                </Button>
                                <label className="aspect-video flex flex-col items-center justify-center border-2 border-dashed rounded-xl gap-1 cursor-pointer hover:bg-white transition-all">
                                    <FileUp className="h-5 w-5 opacity-40" /> 
                                    <span className="text-[7px] font-black uppercase">SUBIR</span>
                                    <Input type="file" multiple accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'devolucion')} />
                                </label>
                            </>
                        )}
                    </div>
                </div>

                {movimientoData.maquinas.some(m => !m.lacre_estado) && (
                    <div className="p-4 bg-amber-50 border-2 border-dashed border-amber-200 rounded-xl flex items-center gap-3 animate-pulse">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                        <p className="text-[10px] font-black uppercase text-amber-700 leading-tight">
                            Asegúrese de marcar el estado del lacre (Correcto o Violentado) en TODOS los equipos para habilitar el botón de recepción.
                        </p>
                    </div>
                )}
              </CardContent>
              <CardFooter className="p-0 border-t">
                <Button onClick={handleSaveDevolucion} disabled={isSubmitting || devolucionFotos.length === 0 || movimientoData.maquinas.some(m => !m.lacre_estado)} className="w-full h-20 text-xl font-black uppercase bg-primary hover:bg-primary/90 rounded-none tracking-widest">
                    {isSubmitting ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : <Undo2 className="mr-3 h-6 w-6" />}
                    INFORMAR RECEPCIÓN DE EQUIPOS
                </Button>
              </CardFooter>
            </Card>

            {isDevolucionGuardada && movimientoData.maquinas.some(m => m.lacre_estado === 'violentado') && (
                <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white animate-in zoom-in duration-500">
                    <CardHeader className="p-8 border-b bg-destructive text-white">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-full border-4 border-white flex items-center justify-center font-black text-xl">C</div>
                                <div>
                                    <CardTitle className="uppercase font-black text-xl leading-none">ACTA DE DENUNCIA POR VIOLENTACIÓN</CardTitle>
                                    <CardDescription className="text-[10px] font-bold uppercase mt-1 text-white/80">REQUERIMIENTO OBLIGATORIO DE SEGURIDAD</CardDescription>
                                </div>
                            </div>
                            <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 font-black uppercase text-[10px] h-11 gap-2 rounded-xl shadow-lg" onClick={() => {}}>
                                <Download className="h-4 w-4" /> DESCARGAR PROFORMA DENUNCIA
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-10 space-y-10">
                        <div className="bg-destructive/5 p-6 rounded-2xl border-2 border-destructive/20 space-y-2">
                            <p className="font-black uppercase text-[10px] text-destructive tracking-widest">Equipos Afectados:</p>
                            <div className="flex gap-2">
                                {movimientoData.maquinas.filter(m => m.lacre_estado === 'violentado').map(m => (
                                    <Badge key={m.codigo} variant="destructive" className="font-black text-[10px] uppercase">{m.codigo}</Badge>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase text-primary">DETALLE TÉCNICO DEL DAÑO / DESLACRE *</Label>
                            <Textarea 
                                value={denunciaDetalles} 
                                onChange={e => setDenunciaDetalles(e.target.value)} 
                                placeholder="Describa el estado de los lacres encontrados..." 
                                className="min-h-[120px] font-bold border-2 rounded-2xl uppercase p-6 shadow-inner"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase text-primary flex items-center gap-2"><Camera className="h-4 w-4" /> Evidencias Visuales (Máx 5)</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {denunciaEvidencias.map((img, i) => (
                                        <div key={i} className="relative aspect-square rounded-xl overflow-hidden border shadow-sm group">
                                            <Image src={img} alt={`Evidencia ${i}`} fill className="object-cover" />
                                            <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setDenunciaEvidencias(prev => prev.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></Button>
                                        </div>
                                    ))}
                                    {denunciaEvidencias.length < 5 && (
                                        <>
                                            <Button variant="outline" className="aspect-square flex-col border-dashed rounded-xl gap-1" onClick={() => startCamera('denuncia_evidencia')}>
                                                <Camera className="h-4 w-4 opacity-30" /> 
                                                <span className="text-[7px] font-black uppercase">FOTO</span>
                                            </Button>
                                            <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed rounded-xl gap-1 cursor-pointer hover:bg-muted/10 transition-all">
                                                <FileUp className="h-4 w-4 opacity-30" /> 
                                                <span className="text-[7px] font-black uppercase">SUBIR</span>
                                                <Input type="file" multiple accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'denuncia_evidencia')} />
                                            </label>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase text-primary flex items-center gap-2"><FileText className="h-4 w-4" /> Formulario de Denuncia Firmado *</Label>
                                {denunciaRespaldo ? (
                                    <div className="relative aspect-video rounded-2xl overflow-hidden border-4 border-white shadow-xl group">
                                        {denunciaRespaldo.startsWith('data:application/pdf') ? (
                                            <div className="w-full h-full flex flex-col items-center justify-center bg-muted/30">
                                                <FileText className="h-12 w-12 text-primary opacity-40 mb-2" />
                                                <p className="text-[10px] font-black uppercase text-primary/60">Documento PDF</p>
                                            </div>
                                        ) : (
                                            <Image src={denunciaRespaldo} alt="Respaldo Denuncia" fill className="object-cover" />
                                        )}
                                        <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" onClick={() => setDenunciaRespaldo(null)}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-4">
                                        <Button variant="outline" className="h-32 flex-col border-dashed rounded-xl gap-2 hover:bg-muted/10 transition-all" onClick={() => startCamera('denuncia_respaldo')}><Camera className="h-8 w-8 opacity-40" /> <span className="text-[8px] font-black uppercase">CÁMARA</span></Button>
                                        <label className="h-32 flex flex-col items-center justify-center border-2 border-dashed rounded-xl gap-2 cursor-pointer hover:bg-muted/10 transition-all">
                                            <FileUp className="h-8 w-8 opacity-40" /> <span className="text-[8px] font-black uppercase">SUBIR</span>
                                            <Input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => handleFileUpload(e, 'denuncia_respaldo')} />
                                        </label>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="p-0 border-t">
                        <Button onClick={handleSaveDenuncia} disabled={isSubmitting || !denunciaDetalles || !denunciaRespaldo} className="w-full h-20 text-xl font-black uppercase bg-destructive hover:bg-destructive/90 rounded-none tracking-widest text-white shadow-2xl">
                            {isSubmitting ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : <ShieldAlert className="mr-3 h-6 w-6" />}
                            GUARDAR DENUNCIA Y CERRAR CICLO
                        </Button>
                    </CardFooter>
                </Card>
            )}
          </div>
        )}
      </main>

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

export default function ControlMovimientoMaquinasPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-primary"/>
      </div>
    }>
      <ControlMovimientoContent />
    </Suspense>
  );
}
