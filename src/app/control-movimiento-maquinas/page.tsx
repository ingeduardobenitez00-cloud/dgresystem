
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
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
  PowerOff
} from 'lucide-react';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
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

export default function ControlMovimientoMaquinasPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [logoDGREBase64, setLogoDGREBase64] = useState<string | null>(null);
  const [selectedSolicitudId, setSelectedSolicitudId] = useState<string | null>(null);
  const [isDevolucionGuardada, setIsDevolucionGuardada] = useState(false);
  
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeCameraTarget, setActiveCameraTarget] = useState<'salida' | 'devolucion' | 'denuncia_evidencia' | 'denuncia_respaldo' | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [salidaFoto, setSalidaFoto] = useState<string | null>(null);
  const [devolucionFoto, setDevolucionFoto] = useState<string | null>(null);
  
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
        const [r1, r2] = await Promise.all([
          fetch('/logo.png'),
          fetch('/logo3.png')
        ]);
        const [b1, b2] = await Promise.all([r1.blob(), r2.blob()]);
        
        const readBlob = (blob: Blob): Promise<string> => new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        const [l1, l2] = await Promise.all([readBlob(b1), readBlob(b2)]);
        setLogoBase64(l1);
        setLogoDGREBase64(l2);
      } catch (error) {
        console.error("Error fetching logos:", error);
      }
    };
    fetchLogos();
  }, []);

  const profile = user?.profile;

  const agendaQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !profile) return null;
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    const isAdmin = ['admin', 'director'].includes(profile.role || '') || profile.permissions?.includes('admin_filter');
    
    if (isAdmin) return colRef;
    return query(colRef, where('departamento', '==', profile.departamento), where('distrito', '==', profile.distrito));
  }, [firestore, isUserLoading, profile]);

  const { data: rawAgendaItems, isLoading: isLoadingAgenda } = useCollection<SolicitudCapacitacion>(agendaQuery);

  const maquinasQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !profile) return null;
    return query(collection(firestore, 'maquinas'), where('departamento', '==', profile.departamento), where('distrito', '==', profile.distrito));
  }, [firestore, isUserLoading, profile]);

  const { data: maquinasInventario, isLoading: isLoadingMaquinas } = useCollection<MaquinaVotacion>(maquinasQuery);

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

  const selectedSolicitud = useMemo(() => {
    return rawAgendaItems?.find(item => item.id === selectedSolicitudId);
  }, [rawAgendaItems, selectedSolicitudId]);

  useEffect(() => {
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
        setSalidaFoto(currentMovimiento.foto_salida || null);
        setDevolucionFoto(currentMovimiento.foto_devolucion || null);
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
        setSalidaFoto(null);
        setDevolucionFoto(null);
        setIsDevolucionGuardada(false);
    }
  }, [currentMovimiento]);

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
        const dataUri = canvas.toDataURL('image/jpeg', 0.8);
        if (activeCameraTarget === 'salida') setSalidaFoto(dataUri);
        else if (activeCameraTarget === 'devolucion') setDevolucionFoto(dataUri);
        else if (activeCameraTarget === 'denuncia_evidencia') setDenunciaEvidencias(prev => [...prev, dataUri].slice(0, 5));
        else if (activeCameraTarget === 'denuncia_respaldo') setDenunciaRespaldo(dataUri);
        stopCamera();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: any) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (target === 'salida' || target === 'devolucion' || target === 'denuncia_respaldo') {
      const file = files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (target === 'salida') setSalidaFoto(result);
        else if (target === 'devolucion') setDevolucionFoto(result);
        else if (target === 'denuncia_respaldo') setDenunciaRespaldo(result);
      };
      reader.readAsDataURL(file);
    } else if (target === 'denuncia_evidencia') {
      const remaining = 5 - denunciaEvidencias.length;
      Array.from(files).slice(0, remaining).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          setDenunciaEvidencias(prev => [...prev, result].slice(0, 5));
        };
        reader.readAsDataURL(file);
      });
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
    if (!salidaFoto) {
      toast({ variant: 'destructive', title: 'Falta Respaldo', description: 'Capture el F01 firmado.' }); return;
    }

    setIsSubmitting(true);
    const docData: Omit<MovimientoMaquina, 'id'> = {
      solicitud_id: selectedSolicitudId!,
      departamento: selectedSolicitud.departamento || '',
      distrito: selectedSolicitud.distrito || '',
      maquinas: movimientoData.maquinas,
      fecha_salida: movimientoData.fecha_salida,
      hora_salida: movimientoData.hora_salida,
      foto_salida: salidaFoto,
      responsables: selectedSolicitud.divulgadores || selectedSolicitud.asignados || [],
      fecha_creacion: new Date().toISOString(),
    };

    addDoc(collection(firestore, 'movimientos-maquinas'), docData)
      .then(() => {
        toast({ title: '¡Salida Registrada!' });
        setIsSubmitting(false);
      })
      .catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'movimientos-maquinas', operation: 'create' }));
        setIsSubmitting(false);
      });
  };

  const handleSaveDevolucion = () => {
    if (!firestore || !user || !selectedSolicitud || !currentMovimiento) return;
    if (movimientoData.maquinas.some(m => !m.lacre_estado)) {
        toast({ variant: 'destructive', title: 'Verificación incompleta', description: 'Verifique el lacre de todos los equipos.' }); return;
    }
    if (!devolucionFoto) {
      toast({ variant: 'destructive', title: 'Falta F02', description: 'Debe capturar el respaldo del formulario firmado.' }); return;
    }

    setIsSubmitting(true);
    const updateData = {
      fecha_devolucion: movimientoData.fecha_devolucion,
      hora_devolucion: movimientoData.hora_devolucion,
      maquinas: movimientoData.maquinas,
      foto_devolucion: devolucionFoto
    };

    updateDoc(doc(firestore, 'movimientos-maquinas', currentMovimiento.id), updateData)
      .then(() => {
        setIsDevolucionGuardada(true);
        const hasTampering = movimientoData.maquinas.some(m => m.lacre_estado === 'violentado');
        if (hasTampering) {
            toast({ title: 'Recepción Informada', description: 'Irregularidad detectada. Proceda a la denuncia.' });
        } else {
            toast({ title: '¡Devolución Completada!', description: 'Ciclo cerrado exitosamente.' });
            setTimeout(() => setSelectedSolicitudId(null), 1500);
        }
        setIsSubmitting(false);
      })
      .catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: currentMovimiento.id, operation: 'update' }));
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
    const totalPages = movimientoData.maquinas.length;
    const isOnlySalida = !currentMovimiento;

    const drawPage = (maq: MaquinaMovimiento, index: number) => {
        if (index > 0) doc.addPage();

        // HEADER COMPACTO
        doc.addImage(logoBase64, 'PNG', margin, 8, 15, 15);
        doc.addImage(logoDGREBase64, 'PNG', pageWidth - margin - 35, 8, 35, 15);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text("FORMULARIO SALIDA / DEVOLUCIÓN DE MAQUINAS DE VOTACIÓN PARA DIVULGACIÓN", pageWidth / 2, 28, { align: "center" });

        // SECCION A: SALIDA
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
        const cardH = 12;
        for (let i = 0; i < 3; i++) {
            const cx = margin + (i * (cardW + 5));
            const resp = responsibles[i];
            doc.setDrawColor(220);
            doc.setLineWidth(0.1);
            doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'D');
            if (resp) {
                doc.setFontSize(7); doc.setFont('helvetica', 'bold');
                doc.text(resp.nombre.toUpperCase(), cx + (cardW / 2), y + 4.5, { align: 'center' });
                doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
                doc.text(`C.I. ${resp.cedula}`, cx + 4, y + 9);
                doc.text(resp.vinculo.toUpperCase(), cx + cardW - 12, y + 9, { align: 'center' });
            }
        }

        y += cardH + 6;
        doc.setFontSize(8); doc.setFont('helvetica', 'bold');
        doc.text(`HORA SALIDA:`, margin, y);
        doc.roundedRect(margin + 22, y - 4, 20, 6, 3, 3);
        doc.setFont('helvetica', 'normal');
        doc.text(`${movimientoData.hora_salida} HS`, margin + 32, y - 0.5, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.text(`FECHA SALIDA: ${formatDateToDDMMYYYY(movimientoData.fecha_salida)}`, pageWidth - margin, y, { align: 'right' });

        y += 8;
        doc.text("IDENTIFICACIÓN DEL EQUIPO", margin, y);
        y += 2;
        doc.setDrawColor(200);
        doc.roundedRect(margin, y, boxWidth, 18, 4, 4);
        
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

        // KITS SALIDA COMPACTO
        y += 10;
        const kitLabels = ["CREDENCIAL", "AURICULAR", "ACRILICO", "BOLETAS"];
        const kitVals = [maq.credencial, maq.auricular, maq.acrilico, maq.boletas];
        kitLabels.forEach((lbl, i) => {
            const kx = margin + 10 + (i * 45);
            doc.setDrawColor(0); doc.rect(kx, y, 4, 4);
            if (kitVals[i]) doc.text("X", kx + 1, y + 3.5);
            doc.setFontSize(7); doc.text(lbl, kx + 6, y + 3);
        });

        if (!isOnlySalida) {
            // SECCION B: DEVOLUCION COMPACTO
            y += 15;
            doc.setDrawColor(0); doc.setLineWidth(0.3);
            doc.circle(margin + 8, y, 4);
            doc.setFontSize(10); doc.text("B", margin + 8, y + 1, { align: 'center' });
            doc.setFontSize(9); doc.text("DEVOLUCIÓN DE MÁQUINA DE VOTACIÓN PARA DIVULGACIÓN", pageWidth / 2, y + 1, { align: 'center' });

            y += 8;
            doc.setFontSize(8); doc.setFont('helvetica', 'bold');
            doc.text(`HORA REGRESO:`, margin, y);
            doc.roundedRect(margin + 25, y - 4, 20, 6, 3, 3);
            doc.setFont('helvetica', 'normal');
            doc.text(`${movimientoData.hora_devolucion || '__:__'} HS`, margin + 35, y - 0.5, { align: 'center' });
            doc.setFont('helvetica', 'bold');
            doc.text(`FECHA REGRESO: ${movimientoData.fecha_devolucion ? formatDateToDDMMYYYY(movimientoData.fecha_devolucion) : '__/__/____'}`, pageWidth - margin, y, { align: 'right' });

            // LACRE STATUS BOX COMPACTO
            y += 6;
            doc.setDrawColor(0); doc.setLineWidth(0.2);
            doc.roundedRect(margin, y, 90, 15, 4, 4);
            doc.setFontSize(8); doc.setFont('helvetica', 'bold');
            doc.text("ESTADO DE LOS LACRES A LA DEVOLUCIÓN", margin + 10, y + 5);
            
            const isCorrecto = maq.lacre_estado === 'correcto';
            doc.circle(margin + 15, y + 10, 2);
            if (isCorrecto) { doc.setFillColor(0); doc.circle(margin + 15, y + 10, 1.2, 'F'); }
            doc.setFontSize(7); doc.text("CORRECTO", margin + 20, y + 11);

            const isViolentado = maq.lacre_estado === 'violentado';
            doc.circle(margin + 50, y + 10, 2);
            if (isViolentado) { doc.setFillColor(0); doc.circle(margin + 50, y + 10, 1.2, 'F'); }
            doc.text("VIOLENTADO", margin + 55, y + 11);

            // KITS RETORNO COMPACTO
            y += 20;
            doc.setDrawColor(200); doc.roundedRect(margin, y, boxWidth, 10, 3, 3);
            const kitRetLabels = ["RET. CREDENCIAL", "RET. AURICULAR", "RET. ACRILICO", "RET. 5 BOLETAS"];
            const kitRetVals = [maq.retorno_credencial, maq.retorno_auricular, maq.retorno_acrilico, maq.retorno_boletas];
            kitRetLabels.forEach((lbl, i) => {
                const kx = margin + 10 + (i * 45);
                doc.setDrawColor(0); doc.rect(kx, y + 3, 4, 4);
                if (kitRetVals[i]) doc.text("X", kx + 1, y + 6.5);
                doc.setFontSize(7); doc.text(lbl, kx + 6, y + 6);
            });
            y += 10;
        }

        // SIGNATURES AREA - DINÁMICA SEGÚN REQUERIMIENTO
        y += 15;
        const sigH = 15;
        const sigW_Jefe = (boxWidth - 10) / 2;
        const sigW_Divul = (boxWidth - 10) / 3;

        if (isOnlySalida) {
            // FIRMAS DE SALIDA (A)
            doc.setFontSize(8); doc.setFont('helvetica', 'bold');
            doc.text("FIRMAS DE DESPACHO (SECCIÓN A - SALIDA)", margin + boxWidth/2, y - 2, { align: 'center' });
            
            // Jefatura (Entrega)
            doc.rect(margin, y, sigW_Jefe, sigH);
            doc.setFontSize(6);
            doc.text("ENTREGA (JEFATURA): ___________________", margin + 4, y + 6);
            doc.text("ACLARACIÓN: __________________________", margin + 4, y + 11);

            // Divulgadores (Reciben conforme)
            y += sigH + 10;
            doc.setFontSize(8); doc.text("RESPONSABLES DE DIVULGACIÓN (RECIBEN CONFORME)", margin + boxWidth/2, y - 2, { align: 'center' });
            for (let i = 0; i < 3; i++) {
                const sx = margin + (i * (sigW_Divul + 5));
                doc.rect(sx, y, sigW_Divul, sigH);
                doc.setFontSize(5);
                doc.text("FIRMA: ___________________", sx + 3, y + 6);
                doc.text("ACLARACIÓN: ______________", sx + 3, y + 11);
            }
        } else {
            // FIRMAS DE PROCESO COMPLETO (A + B)
            doc.setFontSize(8); doc.setFont('helvetica', 'bold');
            doc.text("MATRIZ DE FIRMAS INSTITUCIONALES (JEFATURAS)", margin + boxWidth/2, y - 2, { align: 'center' });
            
            // JEFE A (Entrega)
            doc.rect(margin, y, sigW_Jefe, sigH);
            doc.setFontSize(6);
            doc.text("JEFE ENTREGA (A): _____________________", margin + 4, y + 6);
            doc.text("ACLARACIÓN: __________________________", margin + 4, y + 11);

            // JEFE B (Recibe)
            doc.rect(margin + sigW_Jefe + 10, y, sigW_Jefe, sigH);
            doc.text("JEFE RECIBE (B): _______________________", margin + sigW_Jefe + 14, y + 6);
            doc.text("ACLARACIÓN: __________________________", margin + sigW_Jefe + 14, y + 11);

            // Divulgadores (Entregan al regresar)
            y += sigH + 10;
            doc.setFontSize(8); doc.text("RESPONSABLES DE DIVULGACIÓN (ENTREGAN EQUIPOS)", margin + boxWidth/2, y - 2, { align: 'center' });
            for (let i = 0; i < 3; i++) {
                const sx = margin + (i * (sigW_Divul + 5));
                doc.rect(sx, y, sigW_Divul, sigH);
                doc.setFontSize(5);
                doc.text("FIRMA: ___________________", sx + 3, y + 6);
                doc.text("ACLARACIÓN: ______________", sx + 3, y + 11);
            }
        }

        // FOOTER COMPACTO
        y = 275; doc.setFontSize(7); doc.setFont('helvetica', 'bold');
        doc.text("OBS: ANEXAR A ESTE FORMULARIO: ANEXO I LUGAR FIJO DE DIVULGACIÓN | ANEXO V PROFORMA DE SOLICITUD", pageWidth / 2, y, { align: 'center' });

        doc.setFontSize(7); doc.setFont('helvetica', 'italic');
        doc.text(`Hoja ${index + 1} de ${totalPages} | Documento Oficial CIDEE`, pageWidth - margin, 285, { align: 'right' });
    };

    movimientoData.maquinas.forEach((maq, i) => drawPage(maq, i));
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
            <Select onValueChange={setSelectedSolicitudId} value={selectedSolicitudId || undefined}>
              <SelectTrigger className="h-12 border-2 font-bold"><SelectValue placeholder="Seleccione una capacitación..." /></SelectTrigger>
              <SelectContent>
                {agendaItems.length === 0 ? (
                  <div className="p-10 text-center space-y-2 opacity-40">
                    <CheckCircle2 className="h-8 w-8 mx-auto text-green-600" />
                    <p className="text-[9px] font-black uppercase tracking-widest">No hay actividades activas en agenda</p>
                  </div>
                ) : agendaItems.map(item => (
                    <SelectItem key={item.id} value={item.id} className="font-bold text-xs uppercase">{formatDateToDDMMYYYY(item.fecha)} | {item.lugar_local}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase text-muted-foreground">Serie de Máquina</Label>
                                        <Select value={maq.codigo || undefined} onValueChange={(v) => updateMaquina(idx, 'codigo', v)}>
                                            <SelectTrigger className="h-12 border-2 rounded-xl font-black uppercase"><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                                            <SelectContent>
                                                {maquinasInventario?.map(m => <SelectItem key={m.id} value={m.codigo} className="font-black text-xs uppercase">{m.codigo}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
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
                            <Label className="font-black uppercase text-xs flex items-center gap-2"><FileText className="h-4 w-4" /> Respaldo F01 (Firma Jefatura) *</Label>
                            {salidaFoto ? (
                                <div className="relative aspect-video rounded-xl overflow-hidden border-4 border-white shadow-xl group">
                                    <Image src={salidaFoto} alt="F01" fill className="object-cover" />
                                    <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" onClick={() => setSalidaFoto(null)}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    <Button variant="outline" className="h-24 flex-col border-dashed rounded-xl gap-2 hover:bg-white transition-all" onClick={() => startCamera('salida')}><Camera className="h-6 w-6 opacity-40" /> <span className="text-[8px] font-black uppercase">CÁMARA</span></Button>
                                    <label className="h-24 flex flex-col items-center justify-center border-2 border-dashed rounded-xl gap-2 cursor-pointer hover:bg-white transition-all">
                                        <FileUp className="h-6 w-6 opacity-40" /> <span className="text-[8px] font-black uppercase">SUBIR</span>
                                        <Input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'salida')} />
                                    </label>
                                </div>
                            )}
                        </div>
                    </div>
                )}
              </CardContent>
              {!currentMovimiento && (
                <CardFooter className="p-0 border-t">
                    <Button onClick={handleSaveSalida} disabled={isSubmitting || !salidaFoto} className="w-full h-20 text-xl font-black uppercase bg-black hover:bg-black/90 rounded-none tracking-widest">
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
                    <Label className="font-black uppercase text-xs flex items-center gap-2"><FileText className="h-4 w-4" /> Respaldo F02 (Recibido conforme) *</Label>
                    {devolucionFoto ? (
                        <div className="relative aspect-video rounded-xl overflow-hidden border-4 border-white shadow-xl group">
                            <Image src={devolucionFoto} alt="F02" fill className="object-cover" />
                            <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" onClick={() => setDevolucionFoto(null)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <Button variant="outline" className="h-24 flex-col border-dashed rounded-xl gap-2 hover:bg-white transition-all" onClick={() => startCamera('devolucion')}><Camera className="h-6 w-6 opacity-40" /> <span className="text-[8px] font-black uppercase">CÁMARA</span></Button>
                            <label className="h-24 flex flex-col items-center justify-center border-2 border-dashed rounded-xl gap-2 cursor-pointer hover:bg-white transition-all">
                                <FileUp className="h-6 w-6 opacity-40" /> <span className="text-[8px] font-black uppercase">SUBIR</span>
                                <Input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'devolucion')} />
                            </label>
                        </div>
                    )}
                </div>
              </CardContent>
              <CardFooter className="p-0 border-t">
                <Button onClick={handleSaveDevolucion} disabled={isSubmitting || !devolucionFoto || movimientoData.maquinas.some(m => !m.lacre_estado)} className="w-full h-20 text-xl font-black uppercase bg-primary hover:bg-primary/90 rounded-none tracking-widest">
                    {isSubmitting ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : <Undo2 className="mr-3 h-6 w-6" />}
                    INFORMAR RECEPCIÓN DE EQUIPOS
                </Button>
              </CardFooter>
            </Card>

            {isDevolucionGuardada && movimientoData.maquinas.some(m => m.lacre_estado === 'violentado') && (
                <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white animate-in zoom-in duration-500">
                    <CardHeader className="p-8 border-b bg-destructive text-white">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full border-4 border-white flex items-center justify-center font-black text-xl">C</div>
                            <div>
                                <CardTitle className="uppercase font-black text-xl leading-none">ACTA DE DENUNCIA POR VIOLENTACIÓN</CardTitle>
                                <CardDescription className="text-[10px] font-bold uppercase mt-1 text-white/80">REQUERIMIENTO OBLIGATORIO DE SEGURIDAD</CardDescription>
                            </div>
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
                                        <Image src={denunciaRespaldo} alt="Respaldo Denuncia" fill className="object-cover" />
                                        <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" onClick={() => setDenunciaRespaldo(null)}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-4">
                                        <Button variant="outline" className="h-32 flex-col border-dashed rounded-xl gap-2 hover:bg-muted/10 transition-all" onClick={() => startCamera('denuncia_respaldo')}><Camera className="h-8 w-8 opacity-40" /> <span className="text-[8px] font-black uppercase">CÁMARA</span></Button>
                                        <label className="h-32 flex flex-col items-center justify-center border-2 border-dashed rounded-xl gap-2 cursor-pointer hover:bg-muted/10 transition-all">
                                            <FileUp className="h-8 w-8 opacity-40" /> <span className="text-[8px] font-black uppercase">SUBIR</span>
                                            <Input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'denuncia_respaldo')} />
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

        {!selectedSolicitudId && (
          <div className="flex flex-col items-center justify-center py-32 border-4 border-dashed rounded-[3rem] bg-white text-muted-foreground opacity-40">
            <PackageCheck className="h-20 w-20 mb-6" />
            <p className="text-xl font-black uppercase tracking-widest">Seleccione actividad para iniciar control</p>
          </div>
        )}
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

function drawSectionA(doc: jsPDF, margin: number, pageWidth: number, y: number, movementData: any, selectedSolicitud: any, responsibles: any[], maq: any, boxWidth: number) {
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
    const cardH = 12;
    for (let i = 0; i < 3; i++) {
        const cx = margin + (i * (cardW + 5));
        const resp = responsibles[i];
        doc.setDrawColor(220);
        doc.setLineWidth(0.1);
        doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'D');
        if (resp) {
            doc.setFontSize(7); doc.setFont('helvetica', 'bold');
            doc.text(resp.nombre.toUpperCase(), cx + (cardW / 2), y + 4.5, { align: 'center' });
            doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
            doc.text(`C.I. ${resp.cedula}`, cx + 4, y + 9);
            doc.text(resp.vinculo.toUpperCase(), cx + cardW - 12, y + 9, { align: 'center' });
        }
    }

    y += cardH + 6;
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text(`HORA SALIDA:`, margin, y);
    doc.roundedRect(margin + 22, y - 4, 20, 6, 3, 3);
    doc.setFont('helvetica', 'normal');
    doc.text(`${movementData.hora_salida} HS`, margin + 32, y - 0.5, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(`FECHA SALIDA: ${formatDateToDDMMYYYY(movementData.fecha_salida)}`, pageWidth - margin, y, { align: 'right' });

    y += 8;
    doc.text("IDENTIFICACIÓN DEL EQUIPO", margin, y);
    y += 2;
    doc.setDrawColor(200);
    doc.roundedRect(margin, y, boxWidth, 18, 4, 4);
    
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
}

function drawSectionB(doc: jsPDF, margin: number, pageWidth: number, y: number, movementData: any, maq: any, boxWidth: number) {
    doc.setDrawColor(0); doc.setLineWidth(0.3);
    doc.circle(margin + 8, y, 4);
    doc.setFontSize(10); doc.text("B", margin + 8, y + 1, { align: 'center' });
    doc.setFontSize(9); doc.text("DEVOLUCIÓN DE MÁQUINA DE VOTACIÓN PARA DIVULGACIÓN", pageWidth / 2, y + 1, { align: 'center' });

    y += 8;
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text(`HORA REGRESO:`, margin, y);
    doc.roundedRect(margin + 25, y - 4, 20, 6, 3, 3);
    doc.setFont('helvetica', 'normal');
    doc.text(`${movementData.hora_devolucion || '__:__'} HS`, margin + 35, y - 0.5, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(`FECHA REGRESO: ${movementData.fecha_devolucion ? formatDateToDDMMYYYY(movementData.fecha_devolucion) : '__/__/____'}`, pageWidth - margin, y, { align: 'right' });

    y += 6;
    doc.setDrawColor(0); doc.setLineWidth(0.2);
    doc.roundedRect(margin, y, 90, 15, 4, 4);
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text("ESTADO DE LOS LACRES A LA DEVOLUCIÓN", margin + 10, y + 5);
    
    const isCorrecto = maq.lacre_estado === 'correcto';
    doc.circle(margin + 15, y + 10, 2);
    if (isCorrecto) { doc.setFillColor(0); doc.circle(margin + 15, y + 10, 1.2, 'F'); }
    doc.setFontSize(7); doc.text("CORRECTO", margin + 20, y + 11);

    const isViolentado = maq.lacre_estado === 'violentado';
    doc.circle(margin + 50, y + 10, 2);
    if (isViolentado) { doc.setFillColor(0); doc.circle(margin + 50, y + 10, 1.2, 'F'); }
    doc.text("VIOLENTADO", margin + 55, y + 11);

    y += 20;
    doc.setDrawColor(200); doc.roundedRect(margin, y, boxWidth, 10, 3, 3);
    const kitRetLabels = ["RET. CREDENCIAL", "RET. AURICULAR", "RET. ACRILICO", "RET. 5 BOLETAS"];
    const kitRetVals = [maq.retorno_credencial, maq.retorno_auricular, maq.retorno_acrilico, maq.retorno_boletas];
    kitRetLabels.forEach((lbl, i) => {
        const kx = margin + 10 + (i * 45);
        doc.setDrawColor(0); doc.rect(kx, y + 3, 4, 4);
        if (kitRetVals[i]) doc.text("X", kx + 1, y + 6.5);
        doc.setFontSize(7); doc.text(lbl, kx + 6, y + 6);
    });
}
