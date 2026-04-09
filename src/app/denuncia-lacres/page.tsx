
"use client";

import { useState, useEffect, Suspense, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldAlert, FileWarning, Camera, Trash2, CheckCircle2, FileText, Printer, X, ImageIcon, FileUp, Cpu, Check, Plus, Download } from 'lucide-react';
import { useUser, useFirebase, useMemoFirebase, useCollectionOnce, useStorage } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where, doc, updateDoc } from 'firebase/firestore';
import { Textarea } from '@/components/ui/textarea';
import jsPDF from 'jspdf';
import { type SolicitudCapacitacion, type MovimientoMaquina } from '@/lib/data';
import { cn, formatDateToDDMMYYYY } from '@/lib/utils';
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { recordAuditLog } from '@/lib/audit';

const normalizeGeo = (str: string) => {
  if (!str) return '';
  return str.toUpperCase()
    .replace(/^\d+[\s-]*\s*/, '') // Elimina "10 - ", "10-", "10 " al inicio
    .trim();
};

function DenunciaContent() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { uploadFile, isUploading: isStorageUploading } = useStorage();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const solicitudIdFromUrl = searchParams.get('solicitudId');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [denunciaFotos, setDenunciaFotos] = useState<string[]>([]);
  const [respaldoFoto, setRespaldoPhoto] = useState<string | null>(null);
  
  const [logoTSJE, setLogoTSJE] = useState<string | null>(null);
  const [logoCIDEE, setLogoCIDEE] = useState<string | null>(null);
  const [logoDGRE, setLogoDGRE] = useState<string | null>(null);

  const [selectedAgendaId, setSelectedAgendaId] = useState<string | null>(solicitudIdFromUrl);
  const [reportedMaquinas, setReportedMaquinas] = useState<string[]>([]);
  
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeCameraTarget, setActiveCameraTarget] = useState<'evidencia' | 'respaldo' | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [formData, setFormData] = useState({
    detalles: '',
    fecha_denuncia: '',
    hora_denuncia: '',
  });

  useEffect(() => {
    const now = new Date();
    setFormData(prev => ({
      ...prev,
      fecha_denuncia: now.toISOString().split('T')[0],
      hora_denuncia: now.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false })
    }));

    const fetchLogos = async () => {
      try {
        const [r1, r2, r3] = await Promise.all([
          fetch('/logo.png'),
          fetch('/logo1.png'),
          fetch('/logo3.png')
        ]);
        const [b1, b2, b3] = await Promise.all([r1.blob(), r2.blob(), r3.blob()]);
        
        const read = (b: Blob): Promise<string> => new Promise(res => {
          const reader = new FileReader();
          reader.onloadend = () => res(reader.result as string);
          reader.readAsDataURL(b);
        });

        setLogoTSJE(await read(b1));
        setLogoCIDEE(await read(b2));
        setLogoDGRE(await read(b3));
      } catch (error) {
        console.error("Error fetching logos:", error);
      }
    };
    fetchLogos();
  }, []);

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
          const MAX_WIDTH = 800; // Optimización de espacio
          const scaleSize = Math.min(1, MAX_WIDTH / img.width);
          canvas.width = img.width * scaleSize;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject('No context');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          // Calidad 0.4 para ahorrar espacio
          resolve(canvas.toDataURL('image/jpeg', 0.4));
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const movsQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !user?.profile) return null;
    const colRef = collection(firestore, 'movimientos-maquinas');
    const profile = user.profile;
    const isAdminGlobal = ['admin', 'director'].includes(profile.role || '') || profile.permissions?.includes('admin_filter');

    if (isAdminGlobal) return colRef;

    const deptoOriginal = profile.departamento || '';
    const deptoNormalized = normalizeGeo(deptoOriginal);
    const variants = [deptoOriginal];
    if (deptoNormalized && deptoNormalized !== deptoOriginal) variants.push(deptoNormalized);

    return query(colRef, where('departamento', 'in', variants));
  }, [firestore, user, isUserLoading]);
  
  const { data: allMovimientos } = useCollectionOnce<MovimientoMaquina>(movsQuery);

  const densQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !user?.profile) return null;
    const colRef = collection(firestore, 'denuncias-lacres');
    const profile = user.profile;
    const isAdminGlobal = ['admin', 'director'].includes(profile.role || '') || profile.permissions?.includes('admin_filter');

    if (isAdminGlobal) return colRef;

    const deptoOriginal = profile.departamento || '';
    const deptoNormalized = normalizeGeo(deptoOriginal);
    const variants = [deptoOriginal];
    if (deptoNormalized && deptoNormalized !== deptoOriginal) variants.push(deptoNormalized);

    return query(colRef, where('departamento', 'in', variants));
  }, [firestore, user, isUserLoading]);

  const { data: allDenuncias } = useCollectionOnce<any>(densQuery);

  const agendaQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !user?.profile) return null;
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    const profile = user.profile;
    const isAdminGlobal = ['admin', 'director'].includes(profile.role || '') || profile.permissions?.includes('admin_filter');
    
    if (isAdminGlobal) return colRef;
    if (profile.departamento && profile.distrito) {
        return query(colRef, where('departamento', '==', profile.departamento), where('distrito', '==', profile.distrito));
    }
    return null;
  }, [firestore, user, isUserLoading]);

  const { data: rawAgendaItems } = useCollectionOnce<SolicitudCapacitacion>(agendaQuery);

  const agendaItems = useMemo(() => {
    if (!rawAgendaItems || !allMovimientos || !allDenuncias) return [];
    return [...rawAgendaItems].filter(item => {
        if (item.cancelada) return false;
        const mov = allMovimientos.find((m: MovimientoMaquina) => m.solicitud_id === item.id);
        const den = allDenuncias.find((d: any) => d.solicitud_id === item.id);
        if (!mov || !mov.fecha_devolucion) return false;
        const hasTampering = mov.maquinas.some((m: any) => m.lacre_estado === 'violentado');
        return hasTampering && !den;
    }).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [rawAgendaItems, allMovimientos, allDenuncias]);

  const selectedSolicitud = useMemo(() => {
    return rawAgendaItems?.find((item: SolicitudCapacitacion) => item.id === selectedAgendaId);
  }, [rawAgendaItems, selectedAgendaId]);

  const currentMov = useMemo(() => {
    return allMovimientos?.find((m: MovimientoMaquina) => m.solicitud_id === selectedAgendaId) || null;
  }, [allMovimientos, selectedAgendaId]);

  const tamperedMaquinas = useMemo(() => {
    if (!currentMov) return [];
    return currentMov.maquinas.filter((m: any) => m.lacre_estado === 'violentado');
  }, [currentMov]);

  useEffect(() => {
    if (tamperedMaquinas.length > 0) {
        setReportedMaquinas(tamperedMaquinas.map(m => m.codigo));
    } else {
        setReportedMaquinas([]);
    }
  }, [tamperedMaquinas]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleToggleMaquina = (codigo: string) => {
    setReportedMaquinas(prev => 
        prev.includes(codigo) ? prev.filter(c => c !== codigo) : [...prev, codigo]
    );
  };

  const startCamera = async (target: 'evidencia' | 'respaldo') => {
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
        const dataUri = canvas.toDataURL('image/jpeg', 0.6); // Bajamos de 0.7 a 0.6
        if (activeCameraTarget === 'evidencia') {
            setDenunciaFotos(prev => [...prev, dataUri].slice(0, 5));
        }
        else setRespaldoPhoto(dataUri);
        stopCamera();
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'evidencia' | 'respaldo') => {
    const files = e.target.files;
    if (files) {
      if (target === 'respaldo') {
          const file = files[0];
          try {
            const compressed = await compressImage(file);
            setRespaldoPhoto(compressed);
          } catch (err) {
            toast({ variant: 'destructive', title: "Error al procesar respaldo" });
          }
      } else {
          const remaining = 5 - denunciaFotos.length;
          const selection = Array.from(files).slice(0, remaining);
          for (const file of selection) {
            try {
              const compressed = await compressImage(file);
              setDenunciaFotos(prev => [...prev, compressed].slice(0, 5));
            } catch (err) {
              toast({ variant: 'destructive', title: "Error al procesar evidencia" });
            }
          }
      }
    }
  };

  const handleSubmit = () => {
    if (!firestore || !user || !selectedSolicitud) return;
    if (reportedMaquinas.length === 0) {
        toast({ variant: "destructive", title: "Seleccione máquinas", description: "Debe marcar al menos una máquina violentada para el informe." });
        return;
    }
    if (!formData.detalles) {
        toast({ variant: "destructive", title: "Faltan detalles", description: "Escriba el motivo del deslacre." });
        return;
    }
    if (denunciaFotos.length === 0 || !respaldoFoto) {
        toast({ 
            variant: "destructive", 
            title: "Imágenes obligatorias", 
            description: "Adjunte evidencia del daño y el respaldo documental físico." 
        });
        return;
    }

    setIsSubmitting(true);
    
    // Función asíncrona para manejar la subida y luego el guardado
    const performSubmit = async () => {
      try {
        const idBatch = Date.now();
        
        // 1. Subir fotos de evidencia
        const evidenciaUrls = await Promise.all(
          denunciaFotos.map((foto, idx) => 
            uploadFile(`denuncias/${selectedAgendaId}/evidencia_${idBatch}_${idx}.jpg`, foto)
          )
        );

        // 2. Subir foto de respaldo
        const respaldoUrl = await uploadFile(
          `denuncias/${selectedAgendaId}/respaldo_${idBatch}.jpg`, 
          respaldoFoto
        );

        const docData = {
          ...formData,
          solicitud_id: selectedAgendaId,
          departamento: selectedSolicitud.departamento,
          distrito: selectedSolicitud.distrito,
          lugar: selectedSolicitud.lugar_local,
          maquinas_denunciadas: reportedMaquinas,
          foto_evidencia: evidenciaUrls, // Ahora son URLs, no Base64
          foto_respaldo_documental: respaldoUrl, // Ahora es URL
          usuario_id: user.uid,
          username: user.profile?.username || '',
          divulgadores: selectedSolicitud.divulgadores || selectedSolicitud.asignados || [],
          fecha_creacion: new Date().toISOString(),
          server_timestamp: serverTimestamp(),
        };

        const docRef = await addDoc(collection(firestore, 'denuncias-lacres'), docData);
        
        recordAuditLog(firestore, {
            usuario_id: user.uid,
            usuario_nombre: user.profile?.username || user.email || 'Usuario',
            usuario_rol: user.profile?.role || 'funcionario',
            accion: 'CREAR',
            modulo: 'denuncia-lacres',
            documento_id: docRef.id,
            detalles: `Denuncia oficial de lacres (Storage) para ${selectedSolicitud.lugar_local} (${reportedMaquinas.join(', ')})`
        });

        toast({ title: "¡Denuncia Oficial Registrada!" });
        setFormData(p => ({ ...p, detalles: '' }));
        setDenunciaFotos([]);
        setRespaldoPhoto(null);
        setSelectedAgendaId(null);
      } catch (error: any) {
        console.error("Error submitting denuncia:", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la denuncia." });
      } finally {
        setIsSubmitting(false);
      }
    };

    performSubmit();
  };

  const generatePDF = () => {
    if (!logoTSJE || !logoCIDEE || !logoDGRE || !selectedSolicitud) return;
    const doc = new jsPDF();
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // HEADER LOGOS
    doc.addImage(logoTSJE, 'PNG', margin, 10, 20, 20);
    doc.addImage(logoCIDEE, 'PNG', pageWidth/2 - 12, 10, 24, 20);
    doc.addImage(logoDGRE, 'PNG', pageWidth - margin - 35, 10, 35, 20);

    // TITLE
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text("FORMULARIO DE DENUNCIA DE ADULTERACIÓN DE LOS LACRES DE SEGURIDAD", pageWidth / 2, 40, { align: "center" });

    // MAIN ROUNDED BORDER
    doc.setDrawColor(0); doc.setLineWidth(0.3);
    doc.roundedRect(margin, 45, pageWidth - (margin * 2), pageHeight - 60, 10, 10);

    // SUBTITLE BOX
    doc.setFontSize(11);
    doc.text("ADULTERACIÓN DE LOS LACRES DE SEGURIDAD", pageWidth / 2, 55, { align: 'center' });
    doc.setLineWidth(0.5); doc.line(pageWidth/2 - 50, 57, pageWidth/2 + 50, 57);

    let y = 70;
    doc.setFontSize(9);
    const directors = [
        "Señores:",
        "Lic. Benjamín Díaz, Director",
        "Director Gral. del Registro Electoral",
        "Ing. Adalberto Morinigo, Vicedirector",
        "Vicedirector del Registro Electoral",
        "Abg. Francisco Olmedo, Director",
        "Dirección de Recursos Electorales",
        "Abg. Victorina Fretes, Directora",
        "Dirección de Logística"
    ];

    directors.forEach((line, i) => {
        if(i === 0) doc.setFont('helvetica', 'bold');
        else doc.setFont('helvetica', i % 2 === 0 ? 'normal' : 'bold');
        doc.text(line, margin + 10, y);
        y += 5;
    });

    y += 5; doc.setFont('helvetica', 'bold'); doc.text("Presente", margin + 10, y);
    doc.setLineWidth(0.2); doc.line(margin + 10, y + 1, margin + 25, y + 1);

    y += 12; doc.setFont('helvetica', 'normal');
    const intro = `Los Jefes / Encargados del Registro Electoral de ${selectedSolicitud.distrito.toUpperCase()}, del departamento de ${selectedSolicitud.departamento.toUpperCase()}, se dirigen a Uds, y a donde corresponda, a fin de informar la manipulación de la máquina de votación (adulteración de los 3 (tres) lacres), con los datos que a continuación se detalla:`;
    const introLines = doc.splitTextToSize(intro, pageWidth - (margin * 2) - 20);
    doc.text(introLines, margin + 10, y);

    y += (introLines.length * 5) + 5;
    doc.setFont('helvetica', 'bold');
    doc.text(`FECHA ${formatDateToDDMMYYYY(formData.fecha_denuncia).replace(/-/g, ' / ')}`, pageWidth - margin - 10, y, { align: 'right' });

    y += 10;
    doc.text("NOMBRE Y APELLIDO DEL JEFE/ENCARGADO RESPONSABLE", margin + 10, y);

    y += 5;
    const responsibles = selectedSolicitud.divulgadores || selectedSolicitud.asignados || [];
    const cardW = (pageWidth - (margin * 2) - 30) / 3;
    const cardH = 15;
    for(let i = 0; i < 3; i++) {
        const rx = margin + 10 + (i * (cardW + 5));
        doc.setDrawColor(200); doc.roundedRect(rx, y, cardW, cardH, 3, 3);
        const resp = responsibles[i];
        if(resp) {
            doc.setFontSize(6); doc.setFont('helvetica', 'bold');
            doc.text(resp.nombre.toUpperCase(), rx + 2, y + 6, { maxWidth: cardW - 4 });
            doc.setFont('helvetica', 'normal'); doc.setFontSize(5);
            doc.text(`C.I. ${resp.cedula}`, rx + 2, y + 12);
            doc.text(resp.vinculo.toUpperCase(), rx + cardW - 2, y + 12, { align: 'right' });
        }
    }

    y += cardH + 10;
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    
    // SERIES BLOCKS
    for(let i = 0; i < 3; i++) {
        doc.text("NÚMERO DE SERIE DE LA MÁQUINA DE VOTACIÓN", margin + 10, y + 4);
        doc.setDrawColor(0); doc.roundedRect(pageWidth - margin - 70, y, 60, 7, 3.5, 3.5);
        doc.setFont('helvetica', 'normal');
        doc.text(reportedMaquinas[i] || '', pageWidth - margin - 40, y + 4.5, { align: 'center' });
        y += 10;
    }

    y += 5; doc.setFont('helvetica', 'bold');
    doc.text("MOTIVO DEL DESLACRE (FORMULARIO DE DENUNCIA DE ADULTERACIÓN DEL LACRE DE SEGURIDAD)", margin + 10, y);
    y += 5;
    doc.roundedRect(margin + 10, y, pageWidth - (margin * 2) - 20, 8, 4, 4);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    doc.text(formData.detalles.toUpperCase(), margin + 15, y + 5, { maxWidth: pageWidth - (margin * 2) - 30 });

    y = pageHeight - 35;
    doc.setLineWidth(0.3);
    doc.line(margin + 20, y, margin + 80, y);
    doc.line(pageWidth - margin - 80, y, pageWidth - margin - 20, y);
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text("FIRMA JEFE", margin + 50, y + 5, { align: 'center' });
    doc.text("ACLARACIÓN:", margin + 50, y + 9, { align: 'center' });
    doc.text("FIRMA JEFE", pageWidth - margin - 50, y + 5, { align: 'center' });
    doc.text("ACLARACIÓN:", pageWidth - margin - 50, y + 9, { align: 'center' });

    doc.save(`Denuncia-Lacres-${selectedSolicitud.distrito}.pdf`);
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Denuncia de Lacres" />
      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Denuncia de Adulteración</h1>
                <p className="text-muted-foreground font-medium flex items-center gap-2 mt-1">
                    <FileWarning className="h-4 w-4" /> Reporte oficial de lacres violentados detectados en el retorno.
                </p>
            </div>
            <Button className="font-black uppercase text-[10px] h-12 px-8 bg-black hover:bg-black/90 shadow-2xl gap-3 rounded-xl" onClick={generatePDF} disabled={!selectedSolicitud}>
                <Printer className="h-5 w-5" /> DESCARGAR PROFORMA PDF
            </Button>
        </div>

        <Card className="shadow-xl border-t-8 border-t-destructive overflow-hidden rounded-[2rem] bg-white">
          <CardHeader className="bg-destructive/5 border-b p-8">
            <CardTitle className="flex items-center gap-3 uppercase font-black text-destructive">
                <ShieldAlert className="h-7 w-7" /> 
                Acta de Irregularidad Institucional
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-2">REGISTRO DE MANIPULACIÓN DETECTADA EN CAMPO</CardDescription>
          </CardHeader>
          <CardContent className="space-y-10 p-8">
            
            <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Actividad Pendiente de Informe</Label>
                <Select onValueChange={setSelectedAgendaId} value={selectedAgendaId || undefined}>
                    <SelectTrigger className="h-14 border-2 font-black uppercase">
                        <SelectValue placeholder="Seleccione la actividad con irregularidad..." />
                    </SelectTrigger>
                    <SelectContent>
                        {agendaItems.length === 0 ? (
                            <div className="p-10 text-center space-y-2 opacity-40">
                                <CheckCircle2 className="h-8 w-8 mx-auto text-green-600" />
                                <p className="text-[9px] font-black uppercase">No hay actividades con irregularidades pendientes</p>
                            </div>
                        ) : (
                            agendaItems.map(item => (
                                <SelectItem key={item.id} value={item.id} className="font-bold uppercase text-xs">
                                    {formatDateToDDMMYYYY(item.fecha)} | {item.lugar_local}
                                </SelectItem>
                            ))
                        )}
                    </SelectContent>
                </Select>
            </div>

            {selectedSolicitud && (
                <div className="space-y-10 animate-in fade-in duration-500">
                    
                    <div className="p-8 border-2 border-destructive/20 rounded-[2rem] bg-destructive/[0.02] space-y-6">
                        <Label className="text-[11px] font-black uppercase text-destructive tracking-widest flex items-center gap-3">
                            <Cpu className="h-5 w-5" /> IDENTIFICACIÓN DE EQUIPOS VIOLENTADOS *
                        </Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {tamperedMaquinas.map((maq: any) => (
                                <div 
                                    key={maq.codigo} 
                                    className={cn(
                                        "flex items-center gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all",
                                        reportedMaquinas.includes(maq.codigo) ? "bg-destructive text-white border-destructive shadow-lg" : "bg-white border-muted-foreground/10"
                                    )}
                                    onClick={() => handleToggleMaquina(maq.codigo)}
                                >
                                    <div className={cn("h-6 w-6 rounded-lg border-2 flex items-center justify-center", reportedMaquinas.includes(maq.codigo) ? "bg-white text-destructive border-white" : "border-muted-foreground/20")}>
                                        {reportedMaquinas.includes(maq.codigo) && <Check className="h-4 w-4 stroke-[4]" />}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black uppercase opacity-60">Serie Maquina</span>
                                        <span className="font-black text-sm tracking-tighter">{maq.codigo}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase text-primary tracking-widest">MOTIVO DEL DESLACRE (ACTA TÉCNICA)</Label>
                        <Textarea 
                            name="detalles"
                            value={formData.detalles} 
                            onChange={handleInputChange}
                            placeholder="Describa el estado de los lacres al momento de la recepción..."
                            className="min-h-[120px] font-bold border-2 rounded-2xl uppercase p-6 shadow-inner"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase text-primary flex items-center gap-2"><Camera className="h-4 w-4" /> Evidencias del Daño *</Label>
                            <div className="grid grid-cols-2 gap-3">
                                {denunciaFotos.map((foto, idx) => (
                                    <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border-2 border-white shadow-md group">
                                        <Image src={foto} alt={`Evidencia ${idx + 1}`} fill className="object-cover" />
                                        <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setDenunciaFotos(prev => prev.filter((_, i) => i !== idx))}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                {denunciaFotos.length < 5 && (
                                    <div className="grid grid-cols-2 gap-2 col-span-2">
                                        <div className="h-24 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-muted/50 transition-all bg-white" onClick={() => startCamera('evidencia')}>
                                            <Camera className="h-6 w-6 text-muted-foreground opacity-30" />
                                            <span className="text-[8px] font-black uppercase">FOTO</span>
                                        </div>
                                        <label className="h-24 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-muted/50 transition-all bg-white">
                                            <FileUp className="h-6 w-6 text-muted-foreground opacity-30" />
                                            <span className="text-[8px] font-black uppercase">SUBIR</span>
                                            <Input type="file" multiple accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'evidencia')} />
                                        </label>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase text-primary flex items-center gap-2"><FileText className="h-4 w-4" /> Respaldo Formulario Físico *</Label>
                            {respaldoFoto ? (
                                <div className="relative aspect-video rounded-2xl overflow-hidden border-4 border-white shadow-xl group">
                                    {respaldoFoto.startsWith('data:application/pdf') ? (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-muted/30">
                                            <FileText className="h-12 w-12 text-primary opacity-40 mb-2" />
                                            <p className="text-[10px] font-black uppercase text-primary/60">Documento PDF</p>
                                        </div>
                                    ) : (
                                        <Image src={respaldoFoto} alt="Respaldo" fill className="object-cover" />
                                    )}
                                    <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" onClick={() => setRespaldoPhoto(null)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="h-48 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-muted/50 transition-all bg-white" onClick={() => startCamera('respaldo')}>
                                        <Camera className="h-8 w-8 text-primary opacity-20" />
                                        <span className="text-[9px] font-black uppercase text-muted-foreground text-center">Capturar Acta Firmada</span>
                                    </div>
                                    <label className="h-48 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-muted/50 transition-all bg-white">
                                        <FileUp className="h-8 w-8 text-primary opacity-20" />
                                        <span className="text-[9px] font-black uppercase text-muted-foreground text-center">Subir Acta Firmada</span>
                                        <Input type="file" accept="image/*,.pdf" className="hidden" onChange={e => handleFileUpload(e, 'respaldo')} />
                                    </label>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
          </CardContent>
          <CardFooter className="bg-black p-0 overflow-hidden">
            <Button onClick={handleSubmit} disabled={isSubmitting || isStorageUploading || !selectedAgendaId || reportedMaquinas.length === 0} className="w-full h-20 text-xl font-black uppercase shadow-2xl bg-destructive hover:bg-destructive/90 rounded-none tracking-widest text-white shadow-2xl">
              {isSubmitting || isStorageUploading ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : <ShieldAlert className="mr-3 h-6 w-6" />}
              REGISTRAR DENUNCIA OFICIAL
            </Button>
          </CardFooter>
        </Card>
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

export default function DenunciaLacresPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>}>
      <DenunciaContent />
    </Suspense>
  );
}
