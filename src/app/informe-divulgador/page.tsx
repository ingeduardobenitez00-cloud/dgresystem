
"use client";

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/header';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileDown, CheckCircle2, Printer, X, CalendarDays, DatabaseZap, Search, Camera, Trash2, ImageIcon, FileText } from 'lucide-react';
import { useUser, useFirebase, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, query, where } from 'firebase/firestore';
import jsPDF from 'jspdf';
import { type SolicitudCapacitacion, type InformeDivulgador } from '@/lib/data';
import { cn, formatDateToDDMMYYYY } from '@/lib/utils';
import Image from 'next/image';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function InformeContent() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const agendaIdFromUrl = searchParams.get('solicitudId');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [markedCells, setMarcaciones] = useState<number[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [respaldoPhoto, setRespaldoPhoto] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [selectedAgendaId, setSelectedAgendaId] = useState<string | null>(agendaIdFromUrl);
  
  const [formData, setFormData] = useState({
    lugar_divulgacion: '',
    fecha: '',
    hora_desde: '',
    hora_hasta: '',
    nombre_divulgador: '',
    cedula_divulgador: '',
    vinculo: '',
    oficina: '',
    distrito: '',
    departamento: '',
  });

  useEffect(() => {
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

  const informesRealizadosQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !user?.profile) return null;
    return collection(firestore, 'informes-divulgador');
  }, [firestore, user, isUserLoading]);

  const { data: rawInformesRealizados } = useCollection<InformeDivulgador>(informesRealizadosQuery);

  const agendaItems = useMemo(() => {
    if (!rawAgendaItems) return [];
    const usedSolicitudIds = new Set(rawInformesRealizados?.map(inf => inf.solicitud_id) || []);
    return rawAgendaItems
      .filter(item => !usedSolicitudIds.has(item.id) || item.id === selectedAgendaId)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [rawAgendaItems, rawInformesRealizados, selectedAgendaId]);

  const solicitudRef = useMemoFirebase(() => 
    firestore && selectedAgendaId ? doc(firestore, 'solicitudes-capacitacion', selectedAgendaId) : null, 
    [firestore, selectedAgendaId]
  );
  const { data: agendaDoc } = useDoc<SolicitudCapacitacion>(solicitudRef);

  useEffect(() => {
    if (agendaDoc) {
      setFormData({
        lugar_divulgacion: agendaDoc.lugar_local || '',
        fecha: agendaDoc.fecha || '',
        hora_desde: (agendaDoc.hora_desde || '').substring(0, 5),
        hora_hasta: (agendaDoc.hora_hasta || '').substring(0, 5),
        nombre_divulgador: agendaDoc.divulgador_nombre || user?.profile?.username || '',
        cedula_divulgador: agendaDoc.divulgador_cedula || user?.profile?.cedula || '',
        vinculo: agendaDoc.divulgador_vinculo || user?.profile?.vinculo || '',
        oficina: agendaDoc.distrito || '',
        distrito: agendaDoc.distrito || '',
        departamento: agendaDoc.departamento || '',
      });
    } else if (!selectedAgendaId && user?.profile) {
        setFormData(prev => ({
            ...prev,
            lugar_divulgacion: '',
            fecha: '',
            hora_desde: '',
            hora_hasta: '',
            nombre_divulgador: user.profile?.username || '',
            cedula_divulgador: user.profile?.cedula || '',
            vinculo: user.profile?.vinculo || '',
            oficina: user.profile?.distrito || '',
            distrito: user.profile?.distrito || '',
            departamento: user.profile?.departamento || '',
        }));
    }
  }, [agendaDoc, selectedAgendaId, user]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      if (photos.length >= 5) {
        toast({ variant: "destructive", title: "Límite alcanzado", description: "Máximo 5 fotos de respaldo." });
        return;
      }
      const remainingSlots = 5 - photos.length;
      Array.from(files).slice(0, remainingSlots).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhotos(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleRespaldoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setRespaldoPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const toggleCell = (num: number) => {
    setMarcaciones(prev => prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]);
  };

  const generatePDF = () => {
    if (!logoBase64) return;
    const doc = new jsPDF();
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.addImage(logoBase64, 'PNG', margin, 10, 20, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text("ANEXO III", 40, 18);
    doc.text("INFORME DEL DIVULGADOR", 40, 24);

    let y = 35;
    const drawBox = (height: number) => {
        doc.setDrawColor(0);
        doc.rect(margin, y, pageWidth - (margin * 2), height);
    };

    drawBox(18);
    doc.setFontSize(10);
    doc.text(`LUGAR DE DIVULGACIÓN: ${formData.lugar_divulgacion.toUpperCase()}`, margin + 3, y + 7);
    const dateParts = (formData.fecha || '').split('-');
    const day = dateParts[2] || '';
    const month = dateParts[1] || '';
    doc.text(`FECHA:   ${day}   /   ${month}   / 2026`, margin + 3, y + 14);
    doc.text(`HORARIO DE:   ${formData.hora_desde}   A   ${formData.hora_hasta}   HS.`, margin + 100, y + 14);
    
    y += 22;
    drawBox(12);
    doc.text(`NOMBRE COMPLETO DIVULGADOR: ${formData.nombre_divulgador.toUpperCase()}`, margin + 3, y + 5);
    doc.text(`C.I.C. N.º: ${formData.cedula_divulgador}`, margin + 3, y + 10);
    doc.text(`VÍNCULO: ${formData.vinculo.toUpperCase()}`, margin + 100, y + 10);

    y += 16;
    drawBox(12);
    doc.text(`OFICINA: ${formData.oficina.toUpperCase()}`, margin + 3, y + 5);
    doc.text(`DEPARTAMENTO: ${formData.departamento.toUpperCase()}`, margin + 3, y + 10);

    y += 18;
    doc.rect(margin + 10, y, 170, 8);
    doc.setFontSize(11);
    doc.text("MARCA CON UNA \"X\" POR CADA CIUDADANO QUE PRACTICÓ", pageWidth / 2, y + 5.5, { align: 'center' });
    
    y += 8;
    const cellW = 170 / 13;
    const cellH = 8;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 13; col++) {
            const num = (row * 13) + col + 1;
            const x = margin + 10 + (col * cellW);
            const curY = y + (row * cellH);
            doc.rect(x, curY, cellW, cellH);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.text(num.toString(), x + 2, curY + 5.5);
            if (markedCells.includes(num)) {
                doc.setFont('helvetica', 'bold');
                doc.text("X", x + (cellW/2) + 1, curY + 5.5, { align: 'center' });
            }
        }
    }

    y += 75;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`TOTAL DE PERSONAS: ________${markedCells.length}________ ciudadanos.`, pageWidth / 2, y, { align: 'center' });

    y += 25;
    doc.text("Firma y aclaración Divulgador", margin + 10, y);
    doc.text("Firma, aclaración y sello Jefes", pageWidth - margin - 60, y);

    y = doc.internal.pageSize.getHeight() - 20;
    doc.setFontSize(8);
    doc.text("-", margin, y);
    doc.text("Control individual del divulgador con cantidad de ciudadanos que practicaron con la MV para", margin + 5, y);
    doc.text("informe semanal de divulgación de la oficina.", margin + 5, y + 4);

    doc.save(`AnexoIII-${formData.oficina.replace(/\s+/g, '-') || 'Informe'}.pdf`);
  };

  const handleSubmit = () => {
    if (!firestore || !user) return;
    if (!formData.lugar_divulgacion || !formData.fecha || !respaldoPhoto) {
        toast({ 
          variant: "destructive", 
          title: "Faltan datos obligatorios", 
          description: !respaldoPhoto ? "Debe adjuntar la foto del respaldo documental (formulario físico)." : "Complete los campos requeridos." 
        }); 
        return;
    }

    setIsSubmitting(true);
    const docData = {
      ...formData,
      solicitud_id: selectedAgendaId || '',
      total_personas: markedCells.length,
      marcaciones: markedCells,
      fotos: photos,
      foto_respaldo_documental: respaldoPhoto,
      usuario_id: user.uid,
      fecha_creacion: new Date().toISOString(),
      server_timestamp: serverTimestamp(),
    };

    addDoc(collection(firestore, 'informes-divulgador'), docData)
      .then(() => {
        toast({ title: "¡Informe Guardado!", description: "Se ha registrado el informe con sus evidencias." });
        setMarcaciones([]); 
        setPhotos([]);
        setRespaldoPhoto(null);
        setSelectedAgendaId(null);
        setIsSubmitting(false);
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ 
          path: 'informes-divulgador', 
          operation: 'create', 
          requestResourceData: docData 
        }));
        setIsSubmitting(false);
      });
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Carga de Anexo III" />
      <main className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full space-y-6">
        
        <Card className="border-primary/20 shadow-md">
            <CardHeader className="py-4 bg-primary/5">
                <CardTitle className="text-[10px] font-black flex items-center gap-2 uppercase tracking-widest text-primary">
                    <DatabaseZap className="h-4 w-4" /> VINCULAR CON ACTIVIDAD PENDIENTE
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="flex gap-2">
                    <Select onValueChange={setSelectedAgendaId} value={selectedAgendaId || undefined}>
                        <SelectTrigger className="h-11 font-bold">
                            <SelectValue placeholder="Seleccione actividad de la agenda..." />
                        </SelectTrigger>
                        <SelectContent>
                            {agendaItems.length === 0 ? (
                                <div className="p-4 text-center text-xs font-bold text-muted-foreground uppercase">No hay actividades pendientes</div>
                            ) : (
                                agendaItems.map(item => (
                                    <SelectItem key={item.id} value={item.id}>
                                        {formatDateToDDMMYYYY(item.fecha)} | {item.lugar_local}
                                    </SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                    {selectedAgendaId && (
                        <Button variant="ghost" size="icon" onClick={() => setSelectedAgendaId(null)}>
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>

        <div className="flex justify-between items-center px-2">
            <div className="flex items-center gap-4">
                <Image src="/logo.png" alt="Logo" width={50} height={50} className="object-contain" />
                <div>
                    <h1 className="text-xl font-black uppercase leading-tight text-primary">ANEXO III</h1>
                    <h2 className="text-lg font-black uppercase leading-tight">INFORME DEL DIVULGADOR</h2>
                </div>
            </div>
            <Button variant="outline" className="font-black uppercase text-[10px] border-2 gap-2 h-10 shadow-sm" onClick={generatePDF}>
                <Printer className="h-4 w-4" /> PDF OFICIAL
            </Button>
        </div>

        <Card className="shadow-2xl border-none overflow-hidden rounded-xl bg-white">
          <CardContent className="p-8 space-y-8">
            
            <div className="border-2 border-black p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <Label className="font-black uppercase text-xs shrink-0">LUGAR DE DIVULGACIÓN:</Label>
                    <Input 
                        value={formData.lugar_divulgacion} 
                        onChange={e => setFormData(p => ({...p, lugar_divulgacion: e.target.value}))} 
                        readOnly={!!selectedAgendaId}
                        className={cn("border-0 border-b-2 border-black rounded-none h-8 font-bold uppercase focus-visible:ring-0 bg-transparent px-0", !!selectedAgendaId && "opacity-70")} 
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="flex items-center gap-3">
                        <Label className="font-black uppercase text-xs shrink-0">FECHA:</Label>
                        <Input 
                            type="date"
                            value={formData.fecha} 
                            onChange={e => setFormData(p => ({...p, fecha: e.target.value}))} 
                            readOnly={!!selectedAgendaId}
                            className={cn("border-0 border-b-2 border-black rounded-none h-8 font-bold focus-visible:ring-0 bg-transparent px-0", !!selectedAgendaId && "opacity-70")} 
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <Label className="font-black uppercase text-xs shrink-0">HORARIO DE:</Label>
                        <Input 
                            type="time"
                            value={formData.hora_desde} 
                            onChange={e => setFormData(p => ({...p, hora_desde: e.target.value}))} 
                            readOnly={!!selectedAgendaId}
                            className={cn("border-0 border-b-2 border-black rounded-none h-8 w-20 font-bold focus-visible:ring-0 bg-transparent px-0 text-center", !!selectedAgendaId && "opacity-70")} 
                        />
                        <Label className="font-black uppercase text-xs">A</Label>
                        <Input 
                            type="time"
                            value={formData.hora_hasta} 
                            onChange={e => setFormData(p => ({...p, hora_hasta: e.target.value}))} 
                            readOnly={!!selectedAgendaId}
                            className={cn("border-0 border-b-2 border-black rounded-none h-8 w-20 font-bold focus-visible:ring-0 bg-transparent px-0 text-center", !!selectedAgendaId && "opacity-70")} 
                        />
                        <Label className="font-black uppercase text-xs">HS.</Label>
                    </div>
                </div>
            </div>

            <div className="border-2 border-black p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <Label className="font-black uppercase text-xs shrink-0">NOMBRE COMPLETO DIVULGADOR:</Label>
                    <Input 
                        value={formData.nombre_divulgador} 
                        onChange={e => setFormData(p => ({...p, nombre_divulgador: e.target.value}))} 
                        readOnly={!!selectedAgendaId}
                        className={cn("border-0 border-b-2 border-black rounded-none h-8 font-bold uppercase focus-visible:ring-0 bg-transparent px-0", !!selectedAgendaId && "opacity-70")} 
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="flex items-center gap-3">
                        <Label className="font-black uppercase text-xs shrink-0">C.I.C. N.º:</Label>
                        <Input 
                            value={formData.cedula_divulgador} 
                            onChange={e => setFormData(p => ({...p, cedula_divulgador: e.target.value}))} 
                            readOnly={!!selectedAgendaId}
                            className={cn("border-0 border-b-2 border-black rounded-none h-8 font-bold focus-visible:ring-0 bg-transparent px-0", !!selectedAgendaId && "opacity-70")} 
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <Label className="font-black uppercase text-xs shrink-0">VÍNCULO:</Label>
                        <Input 
                            value={formData.vinculo} 
                            onChange={e => setFormData(p => ({...p, vinculo: e.target.value}))} 
                            readOnly={!!selectedAgendaId}
                            className={cn("border-0 border-b-2 border-black rounded-none h-8 font-bold uppercase focus-visible:ring-0 bg-transparent px-0", !!selectedAgendaId && "opacity-70")} 
                        />
                    </div>
                </div>
            </div>

            <div className="border-2 border-black rounded-sm overflow-hidden">
                <div className="bg-[#F8F9FA] border-b-2 border-black p-2 text-center">
                    <p className="font-black uppercase text-sm tracking-tight">TABLERO DE MARCACIONES (MÁX. 104)</p>
                </div>
                <div className="grid grid-cols-13 border-collapse">
                    {Array.from({ length: 104 }, (_, i) => i + 1).map(num => (
                        <div 
                            key={num} 
                            onClick={() => toggleCell(num)} 
                            className={cn(
                                "aspect-square border border-black flex flex-col items-center justify-center cursor-pointer transition-colors relative group",
                                markedCells.includes(num) ? "bg-black text-white" : "hover:bg-muted bg-white"
                            )}
                        >
                            <span className={cn("text-[8px] font-bold absolute top-0.5 left-1", markedCells.includes(num) ? "text-white/40" : "text-black/30")}>
                                {num}
                            </span>
                            {markedCells.includes(num) && (
                                <span className="text-xl font-black leading-none">X</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* RESPALDO DOCUMENTAL - OBLIGATORIO */}
            <div className="space-y-4 pt-4 border-t-2 border-dashed border-black/10">
                <div className="flex items-center gap-3 px-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <Label className="font-black uppercase text-xs">Respaldo Documental (Foto Formulario Físico) *</Label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {respaldoPhoto ? (
                        <div className="relative aspect-video rounded-xl overflow-hidden border-4 border-black shadow-xl group">
                            <Image src={respaldoPhoto} alt="Respaldo Documental" fill className="object-cover" />
                            <Button 
                                variant="destructive" 
                                size="icon" 
                                className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-2xl"
                                onClick={() => setRespaldoPhoto(null)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <label className="flex flex-col items-center justify-center aspect-video border-4 border-dashed border-primary/20 rounded-2xl cursor-pointer hover:bg-primary/[0.02] transition-all group bg-white shadow-inner">
                            <Camera className="h-12 w-12 text-primary opacity-20 group-hover:opacity-100 transition-all mb-2" />
                            <span className="text-[10px] font-black uppercase text-primary/40 group-hover:text-primary transition-colors text-center px-4">ADJUNTAR FOTO FORMULARIO</span>
                            <Input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleRespaldoUpload} />
                        </label>
                    )}
                    <div className="flex items-center p-6 bg-muted/20 rounded-2xl border-2 border-dashed border-black/5">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground italic leading-relaxed">
                            <span className="text-destructive font-black">IMPORTANTE:</span> Este campo es obligatorio para validar el reporte. Capture una imagen clara del formulario físico firmado y sellado.
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-3 px-2">
                    <Camera className="h-5 w-5 text-primary" />
                    <Label className="font-black uppercase text-xs">Fotografías de Respaldo del Evento (Máx. 5)</Label>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    {photos.map((photo, idx) => (
                        <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border-2 border-black/10 group">
                            <Image src={photo} alt={`Evidencia ${idx}`} fill className="object-cover" />
                            <Button 
                                variant="destructive" 
                                size="icon" 
                                className="absolute top-2 right-2 h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                onClick={() => removePhoto(idx)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                    {photos.length < 5 && (
                        <label className="flex flex-col items-center justify-center aspect-video border-2 border-dashed border-black/20 rounded-xl cursor-pointer hover:bg-muted/50 transition-all">
                            <ImageIcon className="h-8 w-8 text-black/20 mb-1" />
                            <span className="text-[10px] font-black uppercase text-black/40">Adjuntar Foto</span>
                            <Input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                        </label>
                    )}
                </div>
            </div>

            <div className="flex justify-center py-4">
                <p className="font-black uppercase text-sm flex items-center gap-4">
                    TOTAL DE PERSONAS: 
                    <span className="inline-block border-b-2 border-black w-32 text-center text-xl text-primary">{markedCells.length}</span> 
                    ciudadanos.
                </p>
            </div>

          </CardContent>
          <CardFooter className="p-0 border-t bg-black overflow-hidden">
            <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting || markedCells.length === 0} 
                className="w-full h-16 bg-black hover:bg-black/90 text-white text-xl font-black uppercase rounded-none tracking-widest"
            >
              {isSubmitting ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : <CheckCircle2 className="mr-3 h-6 w-6" />}
              GUARDAR REPORTE OFICIAL
            </Button>
          </CardFooter>
        </Card>
      </main>

      <style jsx global>{`
        .grid-cols-13 {
            display: grid;
            grid-template-columns: repeat(13, minmax(0, 1fr));
        }
      `}</style>
    </div>
  );
}

export default function InformeDivulgadorPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>}>
      <InformeContent />
    </Suspense>
  );
}
