"use client";

import { useState, useEffect, Suspense, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldAlert, FileWarning, Camera, Trash2, CheckCircle2, Globe, FileText, Printer, X, ImageIcon, FileUp } from 'lucide-react';
import { useUser, useFirebase, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, query, orderBy, where } from 'firebase/firestore';
import { Textarea } from '@/components/ui/textarea';
import jsPDF from 'jspdf';
import { type SolicitudCapacitacion, type MovimientoMaquina } from '@/lib/data';
import { cn, formatDateToDDMMYYYY } from '@/lib/utils';
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';

function DenunciaContent() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const agendaId = searchParams.get('solicitudId');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [denunciaFoto, setDenunciaFoto] = useState<string | null>(null);
  const [respaldoFoto, setRespaldoPhoto] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [selectedAgendaId, setSelectedAgendaId] = useState<string | null>(agendaId);
  
  // Camera States
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

  const agendaQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !user?.profile) return null;
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    const profile = user.profile;
    
    const hasAdminFilter = ['admin', 'director'].includes(profile.role || '') || profile.permissions?.includes('admin_filter');
    const hasDeptFilter = !hasAdminFilter && profile.permissions?.includes('department_filter');
    const hasDistFilter = !hasAdminFilter && !hasDeptFilter && (profile.permissions?.includes('district_filter') || profile.role === 'jefe' || profile.role === 'funcionario');

    if (hasAdminFilter) return colRef;
    if (hasDeptFilter && profile.departamento) return query(colRef, where('departamento', '==', profile.departamento));
    if (hasDistFilter && profile.departamento && profile.distrito) {
        return query(colRef, where('departamento', '==', profile.departamento), where('distrito', '==', profile.distrito));
    }
    return null;
  }, [firestore, user, isUserLoading]);

  const { data: rawAgendaItems } = useCollection<SolicitudCapacitacion>(agendaQuery);

  const agendaItems = useMemo(() => {
    if (!rawAgendaItems) return [];
    return [...rawAgendaItems].sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [rawAgendaItems]);

  const selectedSolicitud = useMemo(() => {
    return agendaItems?.find(item => item.id === selectedAgendaId);
  }, [agendaItems, selectedAgendaId]);

  const movQuery = useMemoFirebase(() => {
    if (!firestore || !selectedAgendaId) return null;
    return query(collection(firestore, 'movimientos-maquinas'), where('solicitud_id', '==', selectedAgendaId));
  }, [firestore, selectedAgendaId]);
  const { data: movs } = useCollection<MovimientoMaquina>(movQuery);
  const currentMov = movs && movs.length > 0 ? movs[0] : null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
        const dataUri = canvas.toDataURL('image/jpeg', 0.8);
        if (activeCameraTarget === 'evidencia') setDenunciaFoto(dataUri);
        else setRespaldoPhoto(dataUri);
        stopCamera();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'evidencia' | 'respaldo') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (target === 'evidencia') setDenunciaFoto(reader.result as string);
        else setRespaldoPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    if (!firestore || !user || !selectedSolicitud) return;
    if (!formData.detalles) {
        toast({ variant: "destructive", title: "Faltan datos" });
        return;
    }
    if (!denunciaFoto || !respaldoFoto) {
        toast({ 
            variant: "destructive", 
            title: "Faltan imágenes obligatorias", 
            description: "Debe adjuntar tanto la evidencia del daño como el respaldo documental físico." 
        });
        return;
    }

    setIsSubmitting(true);
    const docData = {
      ...formData,
      solicitud_id: selectedAgendaId,
      departamento: selectedSolicitud.departamento,
      distrito: selectedSolicitud.distrito,
      lugar: selectedSolicitud.lugar_local,
      foto_evidencia: denunciaFoto,
      foto_respaldo_documental: respaldoFoto,
      usuario_id: user.uid,
      username: user.profile?.username || '',
      divulgador_nombre: selectedSolicitud.divulgador_nombre || '',
      divulgador_cedula: selectedSolicitud.divulgador_cedula || '',
      fecha_creacion: new Date().toISOString(),
      server_timestamp: serverTimestamp(),
    };

    addDoc(collection(firestore, 'denuncias-lacres'), docData)
      .then(() => {
        toast({ title: "¡Denuncia Registrada!" });
        setFormData(p => ({ ...p, detalles: '' }));
        setDenunciaFoto(null);
        setRespaldoPhoto(null);
        setIsSubmitting(false);
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ 
          path: 'denuncias-lacres', 
          operation: 'create', 
          requestResourceData: docData 
        }));
        setIsSubmitting(false);
      });
  };

  const generatePDF = () => {
    if (!logoBase64 || !selectedSolicitud) return;
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();

    // Logos Superiores
    doc.addImage(logoBase64, 'PNG', margin, 5, 20, 20);
    
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text("FORMULARIO DE DENUNCIA DE ADULTERACIÓN DE LOS LACRES DE SEGURIDAD", pageWidth / 2, 35, { align: "center" });

    // Cuadro Principal
    const boxY = 40;
    const boxH = 230;
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin - 5, boxY, pageWidth - (margin * 2) + 10, boxH, 5, 5);

    let y = boxY + 10;
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text("ADULTERACIÓN DE LOS LACRES DE SEGURIDAD", pageWidth / 2, y, { align: 'center' });

    y += 15;
    doc.setFontSize(10);
    doc.text("Señores:", margin, y);
    y += 6; doc.text("Lic. Benjamín Díaz, Director", margin, y);
    y += 5; doc.text("Director Gral. del Registro Electoral", margin, y);
    y += 6; doc.text("Ing. Adalberto Morinigo, Vicedirector", margin, y);
    y += 5; doc.text("Vicedirector del Registro Electoral", margin, y);
    y += 6; doc.text("Abg. Francisco Olmedo, Director", margin, y);
    y += 5; doc.text("Dirección de Recursos Electorales", margin, y);
    y += 6; doc.text("Abg. Victorina Fretes, Directora", margin, y);
    y += 5; doc.text("Dirección de Logística", margin, y);

    y += 10;
    doc.setFont('helvetica', 'bold'); doc.text("Presente", margin, y);
    doc.line(margin, y + 1, margin + 15, y + 1);

    y += 15;
    doc.setFont('helvetica', 'normal');
    const introText = `Los Jefes / Encargados del Registro Electoral de ${selectedSolicitud.distrito.toUpperCase()}, del departamento de ${selectedSolicitud.departamento.toUpperCase()}, se dirigen a Uds, y a donde corresponda, a fin de informar la manipulación de la máquina de votación (adulteración de los 3 (tres) lacres), con los datos que a continuación se detalla:`;
    const splitIntro = doc.splitTextToSize(introText, pageWidth - (margin * 2));
    doc.text(splitIntro, margin, y);

    y += 20;
    doc.setFont('helvetica', 'bold');
    const todayParts = formData.fecha_denuncia.split('-');
    doc.text(`FECHA ${todayParts[2]} / ${todayParts[1]} / 2026`, pageWidth - margin - 10, y, { align: 'right' });

    y += 10;
    doc.setFontSize(9);
    doc.text("NOMBRE Y APELLIDO DEL JEFE/ENCARGADO RESPONSABLE", margin, y);
    y += 4;
    doc.roundedRect(margin, y, pageWidth - (margin * 2), 10, 5, 5);
    doc.setFont('helvetica', 'normal');
    doc.text((selectedSolicitud.divulgador_nombre || '').toUpperCase(), margin + 5, y + 6.5);

    y += 18;
    doc.setFont('helvetica', 'bold');
    doc.text("Nº C.I:", margin, y);
    doc.roundedRect(margin + 12, y - 6, 50, 10, 5, 5);
    doc.setFont('helvetica', 'normal');
    doc.text(selectedSolicitud.divulgador_cedula || '', margin + 18, y + 0.5);

    y += 15;
    doc.setFont('helvetica', 'bold');
    doc.text("VÍNCULO:", margin, y);
    const v = (selectedSolicitud.divulgador_vinculo || '').toUpperCase();
    doc.rect(margin + 20, y - 4, 5, 5); doc.text("PERMANENTE", margin + 28, y); if(v === 'PERMANENTE') doc.text("X", margin + 21, y - 0.5);
    doc.rect(margin + 65, y - 4, 5, 5); doc.text("CONTRATADO", margin + 73, y); if(v === 'CONTRATADO' || v === 'COMISIONADO') doc.text("X", margin + 66, y - 0.5);

    y += 15;
    doc.setFont('helvetica', 'bold');
    doc.text("NÚMERO DE SERIE DE LA MÁQUINA DE VOTACIÓN", margin, y);
    doc.roundedRect(margin + 85, y - 6, 75, 10, 5, 5);
    doc.setFont('helvetica', 'normal');
    const nroSerie = currentMov?.salida?.codigo_maquina || 'S/N';
    doc.text(nroSerie.toUpperCase(), margin + 90, y + 0.5);

    y += 15;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text("MOTIVO DEL DESLACRE (FORMULARIO DE DENUNCIA DE ADULTERANCIÓN DEL LACRE DE SEGURIDAD)", margin, y);
    y += 4;
    doc.roundedRect(margin, y, pageWidth - (margin * 2), 15, 5, 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const splitDetalles = doc.splitTextToSize(formData.detalles.toUpperCase(), pageWidth - (margin * 2) - 10);
    doc.text(splitDetalles, margin + 5, y + 6);

    y += 40;
    doc.line(margin + 10, y, margin + 70, y);
    doc.text("FIRMA JEFE", margin + 25, y + 5);
    doc.text("ACLARACIÓN:", margin + 25, y + 10);

    doc.line(pageWidth - margin - 70, y, pageWidth - margin - 10, y);
    doc.text("FIRMA JEFE", pageWidth - margin - 55, y + 5);
    doc.text("ACLARACIÓN:", pageWidth - margin - 55, y + 10);

    doc.save(`Denuncia-Lacre-${Date.now()}.pdf`);
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <Header title="Denuncia de Lacres" />
      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Denuncia de Adulteración</h1>
                <p className="text-muted-foreground font-medium flex items-center gap-2 mt-1">
                    <FileWarning className="h-4 w-4" /> Reporte oficial de lacres violentados.
                </p>
            </div>
            <Button variant="outline" className="font-bold border-primary text-primary" onClick={generatePDF} disabled={!selectedSolicitud}>
                <Printer className="mr-2 h-4 w-4" /> PROFORMA PDF
            </Button>
        </div>

        <Card className="shadow-xl border-t-8 border-t-destructive overflow-hidden">
          <CardHeader className="bg-destructive/5 border-b">
            <CardTitle className="flex items-center gap-2 uppercase font-black text-destructive">
                <ShieldAlert className="h-6 w-6" /> 
                Acta de Irregularidad
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase">Complete los detalles de la adulteración detectada.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 pt-8">
            <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Vincular a Actividad de Agenda</Label>
                <div className="flex gap-2">
                    <Select onValueChange={setSelectedAgendaId} value={selectedAgendaId || undefined}>
                        <SelectTrigger className="h-12 border-2">
                            <SelectValue placeholder="Seleccione la actividad..." />
                        </SelectTrigger>
                        <SelectContent>
                            {agendaItems?.map(item => (
                                <SelectItem key={item.id} value={item.id}>
                                    {formatDateToDDMMYYYY(item.fecha)} | {item.lugar_local}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {selectedAgendaId && (
                        <Button variant="ghost" size="icon" onClick={() => setSelectedAgendaId(null)}>
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {selectedSolicitud && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Fecha Reporte</Label>
                                <Input value={formatDateToDDMMYYYY(formData.fecha_denuncia)} readOnly className="bg-muted/30 font-bold h-12" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Hora Reporte</Label>
                                <Input value={formData.hora_denuncia} readOnly className="bg-muted/30 font-bold h-12" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary">Detalles de la Adulteración (MOTIVO DEL DESLACRE)</Label>
                        <Textarea 
                            name="detalles"
                            value={formData.detalles} 
                            onChange={handleInputChange}
                            placeholder="Describa aquí la irregularidad detectada. Este texto aparecerá en la proforma PDF..."
                            className="min-h-[150px] font-medium border-2 uppercase"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* EVIDENCIA DEL DAÑO */}
                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase text-primary flex items-center gap-2">
                                <FileWarning className="h-4 w-4" /> Evidencia Fotográfica / PDF del Daño *
                            </Label>
                            {denunciaFoto ? (
                                <div className="relative aspect-video w-full rounded-2xl overflow-hidden border-4 border-white shadow-xl group">
                                    {denunciaFoto.startsWith('data:application/pdf') ? (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-muted/30">
                                            <FileText className="h-16 w-16 text-primary opacity-40 mb-2" />
                                            <p className="text-[10px] font-black uppercase text-primary/60">Documento PDF Cargado</p>
                                        </div>
                                    ) : (
                                        <Image src={denunciaFoto} alt="Evidencia" fill className="object-cover" />
                                    )}
                                    <Button variant="destructive" size="icon" className="absolute top-4 right-4 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setDenunciaFoto(null)}>
                                        <Trash2 className="h-5 w-5" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div 
                                        className="flex flex-col items-center justify-center h-40 border-4 border-dashed rounded-3xl border-destructive/20 cursor-pointer hover:bg-destructive/5 transition-all bg-white"
                                        onClick={() => startCamera('evidencia')}
                                    >
                                        <Camera className="h-10 w-10 text-destructive opacity-30 mb-2" />
                                        <span className="font-black uppercase text-[10px] text-destructive opacity-60">Capturar Daño</span>
                                    </div>
                                    <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted transition-all text-muted-foreground">
                                        <ImageIcon className="h-4 w-4" />
                                        <span className="text-[10px] font-black uppercase">Subir de Galería / PDF</span>
                                        <Input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => handleFileUpload(e, 'evidencia')} />
                                    </label>
                                </div>
                            )}
                        </div>

                        {/* RESPALDO DOCUMENTAL */}
                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase text-primary flex items-center gap-2">
                                <FileText className="h-4 w-4" /> Respaldo Documental Formulario Físico *
                            </Label>
                            {respaldoFoto ? (
                                <div className="relative aspect-video w-full rounded-2xl overflow-hidden border-4 border-white shadow-xl group">
                                    {respaldoFoto.startsWith('data:application/pdf') ? (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-muted/30">
                                            <FileText className="h-16 w-16 text-primary opacity-40 mb-2" />
                                            <p className="text-[10px] font-black uppercase text-primary/60">Documento PDF Cargado</p>
                                        </div>
                                    ) : (
                                        <Image src={respaldoFoto} alt="Respaldo" fill className="object-cover" />
                                    )}
                                    <Button variant="destructive" size="icon" className="absolute top-4 right-4 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setRespaldoPhoto(null)}>
                                        <Trash2 className="h-5 w-5" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div 
                                        className="flex flex-col items-center justify-center h-40 border-4 border-dashed rounded-3xl border-primary/20 cursor-pointer hover:bg-primary/5 transition-all bg-white"
                                        onClick={() => startCamera('respaldo')}
                                    >
                                        <Camera className="h-10 w-10 text-primary opacity-30 mb-2" />
                                        <span className="font-black uppercase text-[10px] text-primary opacity-60">Capturar Formulario</span>
                                    </div>
                                    <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted transition-all text-muted-foreground">
                                        <ImageIcon className="h-4 w-4" />
                                        <span className="text-[10px] font-black uppercase">Subir de Galería / PDF</span>
                                        <Input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => handleFileUpload(e, 'respaldo')} />
                                    </label>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
          </CardContent>
          <CardFooter className="bg-muted/30 border-t p-6">
            <Button onClick={handleSubmit} disabled={isSubmitting || !selectedAgendaId} className="w-full h-16 text-xl font-black uppercase shadow-2xl bg-destructive hover:bg-destructive/90">
              {isSubmitting ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : <ShieldAlert className="mr-3 h-6 w-6" />}
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
