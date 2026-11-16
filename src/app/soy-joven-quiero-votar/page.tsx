"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Calendar as CalendarIcon,
  FileDown,
  Camera,
  ImageIcon,
  ClipboardList,
  X,
  FileUp,
  FileText,
  GraduationCap,
  FileCheck2,
  Send,
  History,
  Plus,
  Search,
  Eye,
  Trash2,
  Edit,
  CheckCircle2,
  School,
  Lock,
} from 'lucide-react';
import { useUser, useFirebase, useCollectionOnce, useMemoFirebase, useStorage } from '@/firebase';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { type Dato, type InformeSoyJoven } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { recordAuditLog } from '@/lib/audit';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Image from 'next/image';
import { compressImage, captureVideoFrame } from '@/lib/image-utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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

export default function SoyJovenQuieroVotarPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { uploadFile, isUploading: isStorageUploading } = useStorage();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'nuevo' | 'historial'>('nuevo');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  // Imagen del formulario físico de Solicitud de Salida
  const [fotoSolicitudSalida, setFotoSolicitudSalida] = useState<string>('');
  // Fotos de la actividad realizada (hasta 12)
  const [fotosActividad, setFotosActividad] = useState<string[]>([]);

  // Modal de cámara unificado ('salida' | 'actividad' | null)
  const [cameraTarget, setCameraTarget] = useState<'salida' | 'actividad' | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Modal de visualización de evidencias en Historial
  const [previewItem, setPreviewItem] = useState<InformeSoyJoven | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState<string>('ALL');

  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: today,
    to: today,
  });

  const [formData, setFormData] = useState({
    departamento: '',
    distrito: '',
    colegios_visitados: 0,
    formularios_entregados: 0,
    formularios_retirados: 0,
    detalle_colegios: '',
    observaciones: '',
  });

  const profile = user?.profile;
  const canChangeDept = !!(
    user?.isAdmin ||
    user?.isSuperAdmin ||
    user?.isOwner ||
    profile?.permissions?.includes('admin_filter')
  );
  const canChangeDist = !!(
    canChangeDept ||
    profile?.role === 'coordinador' ||
    profile?.permissions?.includes('department_filter')
  );
  const canSelectAnyJurisdiction = canChangeDept || canChangeDist;

  useEffect(() => {
    if (!isUserLoading && profile && !editingId) {
      setFormData((prev) => ({
        ...prev,
        departamento: prev.departamento || profile.departamento || '',
        distrito: prev.distrito || profile.distrito || '',
      }));
    }

    const fetchLogo = async () => {
      try {
        const response = await fetch('/logo.png');
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => setLogoBase64(reader.result as string);
        reader.readAsDataURL(blob);
      } catch (error) {
        console.error('Error fetching logo:', error);
      }
    };
    fetchLogo();
  }, [isUserLoading, profile, editingId]);

  // Catálogo geográfico (Departamentos y Distritos)
  const datosQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'datos') : null),
    [firestore]
  );
  const { data: datosData } = useCollectionOnce<Dato>(datosQuery);

  const departments = useMemo<string[]>(() => {
    if (!datosData) return [];
    return [...new Set(datosData.map((d: Dato) => d.departamento))].sort();
  }, [datosData]);

  const districts = useMemo<string[]>(() => {
    if (!datosData || !formData.departamento) return [];
    return [
      ...new Set(
        datosData
          .filter((d: Dato) => d.departamento === formData.departamento)
          .map((d: Dato) => d.distrito)
      ),
    ].sort();
  }, [datosData, formData.departamento]);

  // Consulta de informes registrados (usa subcolección bajo divulgadores habilitada en reglas en vivo)
  const informesQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !user) return null;
    return query(
      collection(firestore, 'divulgadores', 'campana_soy_joven', 'informes'),
      orderBy('fecha_creacion', 'desc'),
      limit(200)
    );
  }, [firestore, isUserLoading, user, activeTab]);

  const {
    data: informesList,
    isLoading: isLoadingInformes,
    setData: setInformesList,
  } = useCollectionOnce<InformeSoyJoven>(informesQuery);

  const filteredInformes = useMemo(() => {
    if (!informesList) return [];
    return informesList.filter((item) => {
      // Si no es admin/staff nacional, mostrar los de su departamento/distrito o creados por el usuario
      if (!canSelectAnyJurisdiction && profile?.distrito) {
        const sameDist =
          item.distrito?.toUpperCase() === profile.distrito?.toUpperCase();
        const sameUser = item.usuario_id === user?.uid;
        if (!sameDist && !sameUser) return false;
      }
      if (filterDept !== 'ALL' && item.departamento !== filterDept) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const match = `${item.departamento || ''} ${item.distrito || ''} ${item.username || ''} ${item.detalle_colegios || ''}`
          .toLowerCase()
          .includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [informesList, canSelectAnyJurisdiction, profile, user, filterDept, searchTerm]);

  const summaryStats = useMemo(() => {
    return filteredInformes.reduce(
      (acc, curr) => {
        acc.colegios += Number(curr.colegios_visitados) || 0;
        acc.entregados += Number(curr.formularios_entregados) || 0;
        acc.retirados += Number(curr.formularios_retirados) || 0;
        acc.informes += 1;
        return acc;
      },
      { colegios: 0, entregados: 0, retirados: 0, informes: 0 }
    );
  }, [filteredInformes]);

  const efectividadActual = useMemo(() => {
    if (!formData.formularios_entregados || formData.formularios_entregados <= 0) return 0;
    return Math.min(
      100,
      Math.round((formData.formularios_retirados / formData.formularios_entregados) * 100)
    );
  }, [formData.formularios_entregados, formData.formularios_retirados]);

  /* ==================== CÁMARA Y ARCHIVOS ==================== */
  const startCamera = async (target: 'salida' | 'actividad') => {
    setCameraTarget(target);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', aspectRatio: { ideal: 0.75 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error de Cámara',
        description: 'No se pudo acceder a la cámara del dispositivo.',
      });
      setCameraTarget(null);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraTarget(null);
  };

  const takePhoto = () => {
    if (!videoRef.current) return;
    const dataUri = captureVideoFrame(videoRef.current);
    if (dataUri) {
      if (cameraTarget === 'salida') {
        setFotoSolicitudSalida(dataUri);
        toast({ title: 'Formulario de Solicitud de Salida capturado' });
      } else if (cameraTarget === 'actividad') {
        setFotosActividad((prev) => [...prev, dataUri].slice(0, 12));
        toast({ title: 'Fotografía de la actividad agregada' });
      }
      stopCamera();
    }
  };

  const handleUploadSolicitudSalida = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setFotoSolicitudSalida(compressed);
      toast({ title: 'Imagen del formulario físico de Solicitud de Salida cargada' });
    } catch {
      toast({ variant: 'destructive', title: 'Error al procesar la imagen del formulario' });
    }
  };

  const handleUploadFotosActividad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const remaining = 12 - fotosActividad.length;
    const selection = Array.from(files).slice(0, remaining);
    for (const file of selection) {
      try {
        const compressed = await compressImage(file);
        setFotosActividad((prev) => [...prev, compressed].slice(0, 12));
      } catch {
        toast({ variant: 'destructive', title: 'Error al procesar imagen de actividad' });
      }
    }
    e.target.value = '';
  };

  const removeActividadPhoto = (index: number) => {
    setFotosActividad((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      departamento: profile?.departamento || '',
      distrito: profile?.distrito || '',
      colegios_visitados: 0,
      formularios_entregados: 0,
      formularios_retirados: 0,
      detalle_colegios: '',
      observaciones: '',
    });
    setFotoSolicitudSalida('');
    setFotosActividad([]);
    setDateRange({ from: new Date(), to: new Date() });
  };

  const handleEditInforme = (item: InformeSoyJoven) => {
    setEditingId(item.id);
    setFormData({
      departamento: item.departamento || '',
      distrito: item.distrito || '',
      colegios_visitados: Number(item.colegios_visitados) || 0,
      formularios_entregados: Number(item.formularios_entregados) || 0,
      formularios_retirados: Number(item.formularios_retirados) || 0,
      detalle_colegios: item.detalle_colegios || '',
      observaciones: item.observaciones || '',
    });
    setFotoSolicitudSalida(item.foto_solicitud_salida || '');
    setFotosActividad(Array.isArray(item.fotos_actividad) ? item.fotos_actividad : []);
    setDateRange({
      from: item.fecha_desde ? new Date(item.fecha_desde + 'T12:00:00') : new Date(),
      to: item.fecha_hasta
        ? new Date(item.fecha_hasta + 'T12:00:00')
        : item.fecha_desde
        ? new Date(item.fecha_desde + 'T12:00:00')
        : new Date(),
    });
    setActiveTab('nuevo');
  };

  const handleDeleteInforme = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'divulgadores', 'campana_soy_joven', 'informes', id));
      setInformesList((prev) => (prev ? prev.filter((x) => x.id !== id) : []));
      toast({
        variant: 'destructive',
        title: 'Informe eliminado',
        description: 'El registro fue eliminado correctamente.',
      });
    } catch {
      toast({ variant: 'destructive', title: 'No se pudo eliminar el informe' });
    }
  };

  /* ==================== GUARDAR EN FIRESTORE ==================== */
  const handleSave = async () => {
    if (!firestore || !user) return;

    if (!dateRange?.from || !formData.departamento || !formData.distrito) {
      toast({
        variant: 'destructive',
        title: 'Faltan datos de jurisdicción o fecha',
        description: 'Seleccione la fecha, el Departamento y el Distrito.',
      });
      return;
    }

    if (!fotoSolicitudSalida) {
      toast({
        variant: 'destructive',
        title: 'Falta el Formulario Físico de Solicitud de Salida',
        description: 'Debe adjuntar o capturar la imagen del formulario físico de solicitud de salida.',
      });
      return;
    }

    if (fotosActividad.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Faltan fotos de la actividad',
        description: 'Adjunte al menos 1 fotografía de la actividad realizada en los colegios.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const idBatch = Date.now();
      const distPath = formData.distrito.replace(/\s+/g, '_') || 'general';

      // 1. Subir imagen del formulario físico de solicitud de salida si es base64 nueva
      let uploadedSalidaUrl = fotoSolicitudSalida;
      if (fotoSolicitudSalida.startsWith('data:')) {
        try {
          uploadedSalidaUrl = await uploadFile(
            `soy-joven/${distPath}/${idBatch}_solicitud_salida.jpg`,
            fotoSolicitudSalida
          );
        } catch {
          uploadedSalidaUrl = fotoSolicitudSalida;
        }
      }

      // 2. Subir fotos de la actividad realizada
      const uploadedActividadUrls = await Promise.all(
        fotosActividad.map(async (foto, idx) => {
          if (!foto.startsWith('data:')) return foto;
          try {
            return await uploadFile(
              `soy-joven/${distPath}/${idBatch}_actividad_${idx}.jpg`,
              foto
            );
          } catch {
            return foto;
          }
        })
      );

      const fechaDesdeStr = format(dateRange.from, 'yyyy-MM-dd');
      const fechaHastaStr = format(dateRange.to || dateRange.from, 'yyyy-MM-dd');

      const payload = {
        departamento: formData.departamento,
        distrito: formData.distrito,
        fecha_desde: fechaDesdeStr,
        fecha_hasta: fechaHastaStr,
        colegios_visitados: Number(formData.colegios_visitados) || 0,
        formularios_entregados: Number(formData.formularios_entregados) || 0,
        formularios_retirados: Number(formData.formularios_retirados) || 0,
        detalle_colegios: formData.detalle_colegios.trim().toUpperCase(),
        observaciones: formData.observaciones.trim().toUpperCase(),
        foto_solicitud_salida: uploadedSalidaUrl,
        fotos_actividad: uploadedActividadUrls,
        usuario_id: user.uid,
        username: profile?.username || user.email || 'FUNCIONARIO',
        fecha_creacion: new Date().toISOString(),
        server_timestamp: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(
          doc(firestore, 'divulgadores', 'campana_soy_joven', 'informes', editingId),
          payload
        );
        recordAuditLog(firestore, {
          usuario_id: user.uid,
          usuario_nombre: profile?.username || user.email || 'Usuario',
          usuario_rol: profile?.role || 'funcionario',
          accion: 'EDITAR',
          modulo: 'soy-joven-quiero-votar',
          documento_id: editingId,
          detalles: `Informe actualizado en ${formData.distrito}: ${formData.colegios_visitados} colegios, ${formData.formularios_entregados} entregados, ${formData.formularios_retirados} retirados.`,
        });
        toast({
          title: '✅ Informe actualizado',
          description: 'Los cambios en el informe de la campaña fueron guardados.',
        });
      } else {
        const ref = await addDoc(
          collection(firestore, 'divulgadores', 'campana_soy_joven', 'informes'),
          payload
        );
        recordAuditLog(firestore, {
          usuario_id: user.uid,
          usuario_nombre: profile?.username || user.email || 'Usuario',
          usuario_rol: profile?.role || 'funcionario',
          accion: 'CREAR',
          modulo: 'soy-joven-quiero-votar',
          documento_id: ref.id,
          detalles: `Informe registrado en ${formData.distrito}: ${formData.colegios_visitados} colegios, ${formData.formularios_entregados} entregados, ${formData.formularios_retirados} retirados.`,
        });
        toast({
          title: '✅ ¡Informe Guardado!',
          description: 'El informe de la Campaña "Soy Joven, Quiero Votar" fue registrado con éxito.',
        });
      }

      resetForm();
      setActiveTab('historial');
    } catch (error) {
      console.error('Error guardando informe Soy Joven:', error);
      toast({
        variant: 'destructive',
        title: 'Error al guardar',
        description: 'No se pudo registrar el informe. Intente nuevamente.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ==================== GENERACIÓN DE PDF OFICIAL ==================== */
  const generatePDF = (customItem?: InformeSoyJoven) => {
    const docPdf = new jsPDF();
    const margin = 18;
    const pageWidth = docPdf.internal.pageSize.getWidth();

    const target = customItem || {
      departamento: formData.departamento,
      distrito: formData.distrito,
      fecha_desde: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '',
      fecha_hasta: dateRange?.to
        ? format(dateRange.to, 'yyyy-MM-dd')
        : dateRange?.from
        ? format(dateRange.from, 'yyyy-MM-dd')
        : '',
      colegios_visitados: formData.colegios_visitados,
      formularios_entregados: formData.formularios_entregados,
      formularios_retirados: formData.formularios_retirados,
      detalle_colegios: formData.detalle_colegios,
      observaciones: formData.observaciones,
      foto_solicitud_salida: fotoSolicitudSalida,
      fotos_actividad: fotosActividad,
      username: profile?.username || user?.email || '',
    };

    if (logoBase64) {
      docPdf.addImage(logoBase64, 'PNG', margin, 10, 20, 20);
    }

    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(14);
    docPdf.text('JUSTICIA ELECTORAL · REPÚBLICA DEL PARAGUAY', pageWidth / 2, 16, {
      align: 'center',
    });
    docPdf.setFontSize(13);
    docPdf.text('INFORME DE LA CAMPAÑA: "SOY JOVEN, QUIERO VOTAR"', pageWidth / 2, 23, {
      align: 'center',
    });
    docPdf.setFontSize(9);
    docPdf.setFont('helvetica', 'normal');
    docPdf.text(
      'RELEVAMIENTO DE COLEGIOS VISITADOS Y CONTROL DE FORMULARIOS',
      pageWidth / 2,
      29,
      { align: 'center' }
    );

    let y = 42;
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(9);
    docPdf.text(
      `JURISDICCIÓN: ${target.departamento || 'S/D'} — ${target.distrito || 'S/D'}`,
      margin,
      y
    );
    docPdf.text(
      `FECHA DE ACTIVIDAD: ${target.fecha_desde || '__/__/____'} AL ${target.fecha_hasta || '__/__/____'}`,
      margin,
      y + 6
    );
    docPdf.text(`FUNCIONARIO RESPONSABLE: ${(target.username || '').toUpperCase()}`, margin, y + 12);

    y += 20;
    const tableBody = [
      ['CANTIDAD DE COLEGIOS VISITADOS', String(target.colegios_visitados || 0)],
      [
        'CANTIDAD DE FORMULARIOS ENTREGADOS A LOS COLEGIOS',
        String(target.formularios_entregados || 0),
      ],
      [
        'CANTIDAD DE FORMULARIOS COMPLETOS RETIRADOS DE LOS COLEGIOS',
        String(target.formularios_retirados || 0),
      ],
    ];

    autoTable(docPdf, {
      startY: y,
      head: [['INDICADOR DE LA CAMPAÑA "SOY JOVEN, QUIERO VOTAR"', 'CANTIDAD']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 10, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 135 },
        1: { cellWidth: 35, halign: 'center' },
      },
      margin: { left: margin, right: margin },
    });

    y = (docPdf as any).lastAutoTable.finalY + 10;

    if (target.detalle_colegios) {
      docPdf.setFont('helvetica', 'bold');
      docPdf.setFontSize(9);
      docPdf.text('COLEGIOS / INSTITUCIONES VISITADAS:', margin, y);
      docPdf.setFont('helvetica', 'normal');
      const lines = docPdf.splitTextToSize(target.detalle_colegios.toUpperCase(), pageWidth - margin * 2);
      docPdf.text(lines, margin, y + 5);
      y += 8 + lines.length * 4.5;
    }

    if (target.observaciones) {
      docPdf.setFont('helvetica', 'bold');
      docPdf.setFontSize(9);
      docPdf.text('OBSERVACIONES:', margin, y);
      docPdf.setFont('helvetica', 'normal');
      const obsLines = docPdf.splitTextToSize(target.observaciones.toUpperCase(), pageWidth - margin * 2);
      docPdf.text(obsLines, margin, y + 5);
      y += 8 + obsLines.length * 4.5;
    }

    y += 28;
    if (y > 250) {
      docPdf.addPage();
      y = 40;
    }

    docPdf.line(margin, y, margin + 65, y);
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(8);
    docPdf.text('FIRMA DEL FUNCIONARIO RESPONSABLE', margin + 32.5, y + 5, {
      align: 'center',
    });

    docPdf.line(pageWidth - margin - 65, y, pageWidth - margin, y);
    docPdf.text('FIRMA Y SELLO DEL JEFE / COORDINADOR', pageWidth - margin - 32.5, y + 5, {
      align: 'center',
    });

    docPdf.save(
      `Informe-Soy-Joven-${(target.distrito || 'Distrito').replace(/\s+/g, '-')}.pdf`
    );
  };

  if (isUserLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Campaña Soy Joven, Quiero Votar" />

      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        {/* Encabezado del Módulo */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2rem] shadow-sm border">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <GraduationCap className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[9px] font-black uppercase px-2.5 py-0.5">
                  CAMPAÑA NACIONAL JUVENIL
                </Badge>
                {editingId && (
                  <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50 text-[9px] font-black uppercase">
                    MODO EDICIÓN ACTIVO
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[#1A1A1A] uppercase mt-1">
                Informe Campaña &ldquo;Soy Joven, Quiero Votar&rdquo;
              </h1>
              <p className="text-muted-foreground text-xs font-bold uppercase mt-0.5">
                Reporte de Colegios Visitados, Formularios Entregados, Formularios Retirados y Respaldo Fotográfico
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <Button
              variant={activeTab === 'nuevo' ? 'default' : 'outline'}
              onClick={() => setActiveTab('nuevo')}
              className="font-black uppercase text-[10px] h-11 rounded-xl gap-2 flex-1 md:flex-initial"
            >
              <Plus className="h-4 w-4" />
              {editingId ? 'Editando Informe' : 'Cargar Informe'}
            </Button>
            <Button
              variant={activeTab === 'historial' ? 'default' : 'outline'}
              onClick={() => setActiveTab('historial')}
              className="font-black uppercase text-[10px] h-11 rounded-xl gap-2 flex-1 md:flex-initial"
            >
              <History className="h-4 w-4" />
              Historial ({informesList?.length || 0})
            </Button>
            <Link href="/reporte-soy-joven">
              <Button
                variant="outline"
                className="font-black uppercase text-[10px] border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 gap-2 h-11 shadow-sm rounded-xl"
              >
                <School className="h-4 w-4" /> Monitor por Depto / Distrito
              </Button>
            </Link>
            {activeTab === 'nuevo' && (
              <Button
                variant="outline"
                className="font-black uppercase text-[10px] border-2 gap-2 h-11 shadow-sm rounded-xl"
                onClick={() => generatePDF()}
              >
                <FileDown className="h-4 w-4" /> PDF para Firma
              </Button>
            )}
          </div>
        </div>

        {/* ==================== PESTAÑA 1: CARGAR / EDITAR INFORME ==================== */}
        {activeTab === 'nuevo' && (
          <Card className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden">
            <CardContent className="p-6 md:p-10 space-y-10">
              {editingId && (
                <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-50 border border-amber-200">
                  <p className="text-xs font-black uppercase text-amber-900">
                    Estás editando un informe existente. Guarda los cambios o cancela para crear uno nuevo.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetForm}
                    className="font-black uppercase text-[10px] border-amber-400 text-amber-900"
                  >
                    Cancelar Edición
                  </Button>
                </div>
              )}

              {/* 1. FECHA Y JURISDICCIÓN */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <h3 className="font-black uppercase text-xs text-primary tracking-widest">
                    1. Fecha y Jurisdicción del Reporte
                  </h3>
                  <div className="h-px bg-muted flex-1" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                      Fecha / Periodo de la Actividad *
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <div className="h-12 w-full flex items-center px-4 font-bold border-2 rounded-xl bg-muted/10 cursor-pointer hover:bg-muted/20 transition-colors">
                          <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                          {dateRange?.from ? (
                            dateRange.to && dateRange.to.getTime() !== dateRange.from.getTime() ? (
                              `${format(dateRange.from, 'dd/MM/yyyy')} al ${format(dateRange.to, 'dd/MM/yyyy')}`
                            ) : (
                              format(dateRange.from, 'dd/MM/yyyy')
                            )
                          ) : (
                            <span className="text-muted-foreground/50">Seleccionar fecha...</span>
                          )}
                        </div>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto p-0 border-none shadow-2xl rounded-2xl overflow-hidden"
                        align="start"
                      >
                        <Calendar
                          mode="range"
                          selected={dateRange}
                          onSelect={setDateRange}
                          locale={es}
                          initialFocus
                          className="bg-white"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
                      Departamento * {!canChangeDept && <Lock className="h-3 w-3 text-primary" />}
                    </Label>
                    {canChangeDept ? (
                      <Select
                        value={formData.departamento}
                        onValueChange={(v) =>
                          setFormData((p) => ({ ...p, departamento: v, distrito: '' }))
                        }
                      >
                        <SelectTrigger className="h-12 border-2 rounded-xl font-bold">
                          <SelectValue placeholder="Selecciona un departamento" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((d: string) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="h-12 flex items-center px-4 font-bold border-2 rounded-xl bg-primary/5 border-primary/20 text-primary">
                        {formData.departamento || profile?.departamento || 'No asignado'}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
                      Distrito * {!canChangeDist && <Lock className="h-3 w-3 text-primary" />}
                    </Label>
                    {canChangeDist ? (
                      <Select
                        value={formData.distrito}
                        onValueChange={(v) => setFormData((p) => ({ ...p, distrito: v }))}
                        disabled={!formData.departamento}
                      >
                        <SelectTrigger className="h-12 border-2 rounded-xl font-bold">
                          <SelectValue placeholder="Selecciona un distrito" />
                        </SelectTrigger>
                        <SelectContent>
                          {districts.map((d: string) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="h-12 flex items-center px-4 font-bold border-2 rounded-xl bg-primary/5 border-primary/20 text-primary">
                        {formData.distrito || profile?.distrito || 'No asignado'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. CANTIDADES NUMÉRICAS DE LA CAMPAÑA */}
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <h3 className="font-black uppercase text-xs text-primary tracking-widest">
                    2. Indicadores Numéricos de la Campaña
                  </h3>
                  <div className="h-px bg-muted flex-1" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Campo 1: Cantidad de Colegios Visitados */}
                  <div className="p-6 rounded-3xl border-2 border-slate-200 bg-slate-50/60 space-y-3 hover:border-primary/40 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <School className="h-5 w-5" />
                      </span>
                      <Badge variant="secondary" className="text-[9px] font-black uppercase">
                        CAMPO NUMÉRICO
                      </Badge>
                    </div>
                    <Label className="text-xs font-black uppercase text-slate-900 block leading-snug">
                      Cantidad de Colegios Visitados *
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={formData.colegios_visitados}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          colegios_visitados: Math.max(0, parseInt(e.target.value, 10) || 0),
                        }))
                      }
                      className="h-14 text-2xl font-black text-center border-2 border-slate-300 bg-white rounded-2xl"
                    />
                  </div>

                  {/* Campo 2: Cantidad de Formularios Entregados a los Colegios */}
                  <div className="p-6 rounded-3xl border-2 border-blue-200 bg-blue-50/40 space-y-3 hover:border-blue-400 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="h-10 w-10 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center">
                        <FileText className="h-5 w-5" />
                      </span>
                      <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-[9px] font-black uppercase">
                        ENTREGADOS
                      </Badge>
                    </div>
                    <Label className="text-xs font-black uppercase text-slate-900 block leading-snug">
                      Cantidad de Formularios Entregados a los Colegios *
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={formData.formularios_entregados}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          formularios_entregados: Math.max(0, parseInt(e.target.value, 10) || 0),
                        }))
                      }
                      className="h-14 text-2xl font-black text-center border-2 border-blue-300 bg-white rounded-2xl text-blue-950"
                    />
                  </div>

                  {/* Campo 3: Cantidad de Formularios Completos Retirados de los Colegios */}
                  <div className="p-6 rounded-3xl border-2 border-emerald-200 bg-emerald-50/40 space-y-3 hover:border-emerald-400 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="h-10 w-10 rounded-xl bg-emerald-600/10 text-emerald-600 flex items-center justify-center">
                        <FileCheck2 className="h-5 w-5" />
                      </span>
                      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[9px] font-black uppercase">
                        RETIRADOS COMPLETOS ({efectividadActual}%)
                      </Badge>
                    </div>
                    <Label className="text-xs font-black uppercase text-slate-900 block leading-snug">
                      Cantidad de Formularios Completos Retirados de los Colegios *
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={formData.formularios_retirados}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          formularios_retirados: Math.max(0, parseInt(e.target.value, 10) || 0),
                        }))
                      }
                      className="h-14 text-2xl font-black text-center border-2 border-emerald-300 bg-white rounded-2xl text-emerald-950"
                    />
                  </div>
                </div>

                {/* Detalle opcional de colegios y observaciones */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                      Nombres de los Colegios Visitados (Opcional)
                    </Label>
                    <Textarea
                      placeholder="Ej: Colegio Nacional de la Capital, Colegio Técnico Nacional..."
                      value={formData.detalle_colegios}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, detalle_colegios: e.target.value }))
                      }
                      className="min-h-[85px] border-2 rounded-2xl font-semibold uppercase text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                      Observaciones Adicionales (Opcional)
                    </Label>
                    <Textarea
                      placeholder="Observaciones sobre la jornada de entrega o retiro de formularios..."
                      value={formData.observaciones}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, observaciones: e.target.value }))
                      }
                      className="min-h-[85px] border-2 rounded-2xl font-semibold uppercase text-xs"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* 3. IMAGEN DEL FORMULARIO FÍSICO DE SOLICITUD DE SALIDA */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-black uppercase text-xs text-primary tracking-widest">
                      3. Imagen del Formulario Físico de Solicitud de Salida *
                    </h3>
                    <Badge variant="outline" className="text-[9px] font-black uppercase border-primary/30 text-primary">
                      RESPALDO DOCUMENTAL
                    </Badge>
                  </div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">
                    Suba o tome una foto legible del formulario físico firmado
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center bg-muted/10 p-6 rounded-3xl border-2 border-dashed">
                  <div className="md:col-span-5 space-y-3">
                    <p className="text-xs font-bold text-slate-700 leading-relaxed">
                      Adjunte la fotografía del <strong>Formulario Físico de Solicitud de Salida</strong> que respalda la visita institucional a los colegios.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <label
                        htmlFor="file-solicitud-salida"
                        className="flex-1 flex items-center justify-center gap-2 h-12 border-2 border-primary bg-primary/5 text-primary rounded-xl cursor-pointer hover:bg-primary/10 transition-all font-black uppercase text-[10px] px-4"
                      >
                        <FileUp className="h-4 w-4" /> Subir Imagen
                        <Input
                          id="file-solicitud-salida"
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleUploadSolicitudSalida}
                        />
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 h-12 border-2 rounded-xl font-black uppercase text-[10px] gap-2 bg-white"
                        onClick={() => startCamera('salida')}
                      >
                        <Camera className="h-4 w-4" /> Tomar Foto
                      </Button>
                    </div>
                  </div>

                  <div className="md:col-span-7 flex justify-center">
                    {fotoSolicitudSalida ? (
                      <div className="relative w-full max-w-md aspect-[4/3] rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-lg bg-black group">
                        <Image
                          src={fotoSolicitudSalida}
                          alt="Formulario Físico de Solicitud de Salida"
                          fill
                          className="object-contain"
                        />
                        <div className="absolute top-3 left-3">
                          <Badge className="bg-emerald-600 text-white text-[9px] font-black uppercase gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Formulario Cargado
                          </Badge>
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-3 right-3 h-8 w-8 rounded-full shadow-md"
                          onClick={() => setFotoSolicitudSalida('')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="w-full max-w-md h-44 rounded-2xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
                        <FileText className="h-10 w-10 mb-2 opacity-30" />
                        <p className="text-[11px] font-black uppercase">
                          Sin imagen de Solicitud de Salida
                        </p>
                        <p className="text-[9px] font-medium mt-0.5">
                          Seleccione un archivo o use la cámara para capturar el documento físico
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* 4. FOTOS DE LA ACTIVIDAD REALIZADA */}
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-black uppercase text-xs text-primary tracking-widest">
                      4. Fotos de la Actividad Realizada ({fotosActividad.length}/12) *
                    </h3>
                    <Badge variant="outline" className="text-[9px] font-black uppercase">
                      EVIDENCIA DE CAMPO
                    </Badge>
                  </div>
                  <p className="text-[10px] font-bold text-primary/70 uppercase">
                    Máximo 12 fotografías por informe
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
                  <label
                    htmlFor="file-fotos-actividad"
                    className="flex-1 flex items-center justify-center gap-2 h-12 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/20 transition-all font-black uppercase text-[10px]"
                  >
                    <ImageIcon className="h-4 w-4" /> Seleccionar Fotos de Galería
                    <Input
                      id="file-fotos-actividad"
                      type="file"
                      multiple
                      className="hidden"
                      accept="image/*"
                      onChange={handleUploadFotosActividad}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 h-12 border-2 rounded-xl font-black uppercase text-[10px] gap-2"
                    onClick={() => startCamera('actividad')}
                  >
                    <Camera className="h-4 w-4" /> Capturar con Cámara
                  </Button>
                </div>

                {fotosActividad.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4 pt-2">
                    {fotosActividad.map((photo, idx) => (
                      <div
                        key={idx}
                        className="relative aspect-square rounded-2xl overflow-hidden border-2 border-white shadow-lg group bg-slate-100"
                      >
                        <Image
                          src={photo}
                          alt={`Foto actividad ${idx + 1}`}
                          fill
                          className="object-cover"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-7 w-7 rounded-full opacity-90 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeActividadPhoto(idx)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 rounded-2xl border-2 border-dashed text-center text-muted-foreground bg-muted/5">
                    <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-[11px] font-black uppercase">
                      Aún no se han cargado fotografías de la actividad realizada
                    </p>
                  </div>
                )}
              </div>
            </CardContent>

            <CardFooter className="p-0 border-t bg-black overflow-hidden">
              <Button
                onClick={handleSave}
                disabled={isSubmitting || isStorageUploading}
                className="w-full h-16 bg-black hover:bg-black/90 text-white text-base md:text-lg font-black uppercase rounded-none tracking-[0.15em]"
              >
                {isSubmitting || isStorageUploading ? (
                  <Loader2 className="animate-spin mr-3 h-6 w-6" />
                ) : (
                  <Send className="mr-3 h-5 w-5" />
                )}
                {editingId
                  ? 'GUARDAR CAMBIOS DEL INFORME'
                  : 'ENVIAR INFORME CAMPAÑA SOY JOVEN, QUIERO VOTAR'}
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* ==================== PESTAÑA 2: HISTORIAL Y CONSOLIDADO ==================== */}
        {activeTab === 'historial' && (
          <div className="space-y-6">
            {/* Tarjetas de Totales Acumulados */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="rounded-3xl border-none shadow-md bg-white">
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                      Colegios Visitados
                    </p>
                    <p className="text-3xl font-black text-slate-900 mt-1">
                      {summaryStats.colegios}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center">
                    <School className="h-6 w-6" />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-none shadow-md bg-white">
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest">
                      Formularios Entregados
                    </p>
                    <p className="text-3xl font-black text-blue-700 mt-1">
                      {summaryStats.entregados}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <FileText className="h-6 w-6" />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-none shadow-md bg-white">
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">
                      Formularios Retirados
                    </p>
                    <p className="text-3xl font-black text-emerald-700 mt-1">
                      {summaryStats.retirados}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <FileCheck2 className="h-6 w-6" />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-none shadow-md bg-white">
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                      Informes Enviados
                    </p>
                    <p className="text-3xl font-black text-primary mt-1">
                      {summaryStats.informes}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <ClipboardList className="h-6 w-6" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Barra de Filtros */}
            <Card className="rounded-3xl border-none shadow-md bg-white">
              <CardContent className="p-5 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por distrito, departamento, colegio o funcionario..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-11 rounded-xl border-2 font-bold text-xs uppercase"
                  />
                </div>
                {canSelectAnyJurisdiction && (
                  <div className="w-full md:w-72">
                    <Select value={filterDept} onValueChange={setFilterDept}>
                      <SelectTrigger className="h-11 rounded-xl border-2 font-bold text-xs">
                        <SelectValue placeholder="Filtrar por Departamento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">TODOS LOS DEPARTAMENTOS</SelectItem>
                        {departments.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Listado de Informes */}
            {isLoadingInformes ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredInformes.length === 0 ? (
              <Card className="rounded-3xl border-none shadow-md bg-white p-12 text-center">
                <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground opacity-30 mb-3" />
                <p className="text-sm font-black uppercase text-slate-800">
                  No hay informes registrados aún
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Utilice el botón &ldquo;Cargar Informe&rdquo; para registrar el primer reporte de la campaña.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredInformes.map((item) => (
                  <Card
                    key={item.id}
                    className="rounded-3xl border shadow-sm hover:shadow-md transition-all bg-white overflow-hidden"
                  >
                    <CardContent className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className="bg-black text-white text-[9px] font-black uppercase">
                            {item.departamento} · {item.distrito}
                          </Badge>
                          <Badge variant="outline" className="text-[9px] font-bold uppercase">
                            📅 {item.fecha_desde} {item.fecha_hasta && item.fecha_hasta !== item.fecha_desde ? `al ${item.fecha_hasta}` : ''}
                          </Badge>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">
                            👤 {item.username || 'FUNCIONARIO'}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-3 pt-2 max-w-xl">
                          <div className="p-3 rounded-2xl bg-slate-50 border text-center">
                            <p className="text-[9px] font-black uppercase text-muted-foreground">
                              Colegios Visitados
                            </p>
                            <p className="text-xl font-black text-slate-900">
                              {item.colegios_visitados}
                            </p>
                          </div>
                          <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-200 text-center">
                            <p className="text-[9px] font-black uppercase text-blue-700">
                              Form. Entregados
                            </p>
                            <p className="text-xl font-black text-blue-800">
                              {item.formularios_entregados}
                            </p>
                          </div>
                          <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200 text-center">
                            <p className="text-[9px] font-black uppercase text-emerald-700">
                              Form. Retirados
                            </p>
                            <p className="text-xl font-black text-emerald-800">
                              {item.formularios_retirados}
                            </p>
                          </div>
                        </div>

                        {item.detalle_colegios && (
                          <p className="text-[11px] font-bold text-slate-700 uppercase pt-1">
                            🏫 Colegios: <span className="font-medium">{item.detalle_colegios}</span>
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviewItem(item)}
                          className="h-10 rounded-xl font-black uppercase text-[10px] gap-1.5 border-2"
                        >
                          <Eye className="h-3.5 w-3.5" /> Ver Formulario y Fotos ({(item.fotos_actividad?.length || 0) + (item.foto_solicitud_salida ? 1 : 0)})
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generatePDF(item)}
                          className="h-10 rounded-xl font-black uppercase text-[10px] gap-1.5 border-2"
                        >
                          <FileDown className="h-3.5 w-3.5" /> PDF
                        </Button>
                        {(user?.isAdmin || user?.isOwner || item.usuario_id === user?.uid) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditInforme(item)}
                            className="h-10 rounded-xl font-black uppercase text-[10px] gap-1.5 border-2"
                          >
                            <Edit className="h-3.5 w-3.5" /> Editar
                          </Button>
                        )}
                        {(user?.isAdmin || user?.isOwner) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="icon"
                                className="h-10 w-10 rounded-xl"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-3xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="font-black uppercase">
                                  ¿Eliminar este informe de campaña?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción eliminará el reporte de {item.distrito} ({item.fecha_desde}) de forma permanente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl font-bold uppercase text-xs">
                                  Cancelar
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteInforme(item.id)}
                                  className="rounded-xl bg-destructive font-black uppercase text-xs"
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL DE CÁMARA */}
      <Dialog open={!!cameraTarget} onOpenChange={(o) => !o && stopCamera()}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none bg-black rounded-[2rem]">
          <DialogHeader className="p-4 bg-black text-white">
            <DialogTitle className="text-xs font-black uppercase tracking-wider text-center">
              {cameraTarget === 'salida'
                ? 'Capturar Formulario Físico de Solicitud de Salida'
                : 'Capturar Fotografía de la Actividad Realizada'}
            </DialogTitle>
          </DialogHeader>
          <div className="relative aspect-[3/4] w-full bg-black flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-8 border-2 border-white/20 rounded-xl pointer-events-none border-dashed" />
          </div>
          <DialogFooter className="p-6 bg-black/90 flex flex-row items-center justify-between gap-4">
            <Button
              variant="outline"
              className="rounded-full h-14 w-14 border-white/20 bg-white/10 text-white"
              onClick={stopCamera}
            >
              <X className="h-6 w-6" />
            </Button>
            <Button
              className="flex-1 h-14 rounded-full bg-white text-black font-black uppercase text-xs shadow-2xl"
              onClick={takePhoto}
            >
              CAPTURAR IMAGEN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL VISOR DE FORMULARIO DE SALIDA Y FOTOS DE ACTIVIDAD */}
      <Dialog open={!!previewItem} onOpenChange={(o) => !o && setPreviewItem(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-black uppercase text-base">
              Respaldo Documental y Fotográfico — {previewItem?.distrito}
            </DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase">
              Colegios Visitados: {previewItem?.colegios_visitados} · Entregados: {previewItem?.formularios_entregados} · Retirados: {previewItem?.formularios_retirados}
            </DialogDescription>
          </DialogHeader>

          {previewItem && (
            <div className="space-y-6 py-2">
              <div className="space-y-2">
                <p className="text-xs font-black uppercase text-primary">
                  1. Formulario Físico de Solicitud de Salida
                </p>
                {previewItem.foto_solicitud_salida ? (
                  <div className="relative w-full h-80 rounded-2xl overflow-hidden border bg-black">
                    <Image
                      src={previewItem.foto_solicitud_salida}
                      alt="Formulario Solicitud de Salida"
                      fill
                      className="object-contain"
                    />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin imagen adjunta.</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-black uppercase text-primary">
                  2. Fotografías de la Actividad Realizada ({previewItem.fotos_actividad?.length || 0})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(previewItem.fotos_actividad || []).map((url, i) => (
                    <div
                      key={i}
                      className="relative aspect-[4/3] rounded-2xl overflow-hidden border bg-slate-100"
                    >
                      <Image
                        src={url}
                        alt={`Actividad ${i + 1}`}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

