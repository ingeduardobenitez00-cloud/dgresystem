
"use client";

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserCheck, CheckCircle2, FileDown, CalendarDays, MousePointerSquareDashed, Camera, Trash2, Image as ImageIcon, Plus, Building2 } from 'lucide-react';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';
import jsPDF from 'jspdf';
import { type SolicitudCapacitacion } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function InformeDivulgadorPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const agendaId = searchParams.get('solicitudId');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [markedCells, setMarcaciones] = useState<number[]>([]);
  const [eventPhotos, setEventPhotos] = useState<string[]>([]);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    lugar_divulgacion: '',
    fecha: '',
    hora_desde: '',
    hora_hasta: '',
    nombre_divulgador: '',
    cedula_divulgador: '',
    vinculo: '',
    oficina: '',
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

  useEffect(() => {
    if (!isUserLoading && user?.profile && !agendaId) {
      setFormData(prev => ({
        ...prev,
        nombre_divulgador: user.profile?.username || '',
        cedula_divulgador: user.profile?.cedula || '',
        vinculo: user.profile?.vinculo || '',
        oficina: user.profile?.distrito || '',
        departamento: user.profile?.departamento || '',
      }));
    }
  }, [user, isUserLoading, agendaId]);

  const agendaQuery = useMemoFirebase(() => {
    if (!firestore || !user?.profile?.distrito) return null;
    return query(
      collection(firestore, 'solicitudes-capacitacion'),
      where('departamento', '==', user.profile.departamento),
      where('distrito', '==', user.profile.distrito)
    );
  }, [firestore, user]);

  const { data: agendaItems, isLoading: isLoadingAgenda } = useCollection<SolicitudCapacitacion>(agendaQuery);

  useEffect(() => {
    if (agendaId && agendaItems) {
      const item = agendaItems.find(a => a.id === agendaId);
      if (item) {
        setFormData(prev => ({
          ...prev,
          lugar_divulgacion: item.lugar_local,
          fecha: item.fecha,
          hora_desde: item.hora_desde,
          hora_hasta: item.hora_hasta,
          nombre_divulgador: item.divulgador_nombre || '',
          cedula_divulgador: item.divulgador_cedula || '',
          vinculo: item.divulgador_vinculo || '',
          oficina: item.distrito || '',
          departamento: item.departamento || '',
        }));
      }
    }
  }, [agendaId, agendaItems]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAgendaSelect = (id: string) => {
    const item = agendaItems?.find(a => a.id === id);
    if (item) {
      setFormData(prev => ({
        ...prev,
        lugar_divulgacion: item.lugar_local,
        fecha: item.fecha,
        hora_desde: item.hora_desde,
        hora_hasta: item.hora_hasta,
        nombre_divulgador: item.divulgador_nombre || '',
        cedula_divulgador: item.divulgador_cedula || '',
        vinculo: item.divulgador_vinculo || '',
        oficina: item.distrito || '',
        departamento: item.departamento || '',
      }));
      toast({ title: "Datos cargados" });
    }
  };

  const toggleCell = (num: number) => {
    setMarcaciones(prev => prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]);
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (eventPhotos.length >= 3) {
        toast({ variant: "destructive", title: "Límite alcanzado" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setEventPhotos(prev => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleSubmit = async () => {
    if (!firestore || !user) return;
    if (!formData.lugar_divulgacion || !formData.fecha) {
        toast({ variant: "destructive", title: "Faltan datos" });
        return;
    }

    setIsSubmitting(true);
    const docData = {
      ...formData,
      departamento: formData.departamento || user.profile?.departamento || '',
      distrito: formData.oficina || user.profile?.distrito || '',
      total_personas: markedCells.length,
      marcaciones: markedCells,
      fotos: eventPhotos,
      usuario_id: user.uid,
      fecha_creacion: new Date().toISOString(),
      server_timestamp: serverTimestamp(),
    };

    try {
      await addDoc(collection(firestore, 'informes-divulgador'), docData);
      toast({ title: "¡Informe Guardado!" });
      setMarcaciones([]);
      setEventPhotos([]);
    } catch (error) {
      const contextualError = new FirestorePermissionError({
        path: 'informes-divulgador',
        operation: 'create',
        requestResourceData: docData
      });
      errorEmitter.emit('permission-error', contextualError);
    } finally { setIsSubmitting(false); }
  };

  const generatePDF = async () => {
    const doc = new jsPDF();
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // --- Header ---
    if (logoBase64) doc.addImage(logoBase64, 'PNG', margin, 10, 20, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text("ANEXO III", 40, 18);
    doc.text("INFORME DEL DIVULGADOR", 40, 25);

    let y = 40;
    
    // Helper for sections
    const drawSection = (lines: { label: string, value: string, xOffset: number, width: number }[], height: number) => {
      doc.rect(margin, y, pageWidth - (margin * 2), height);
      lines.forEach(line => {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`${line.label}:`, margin + 2 + line.xOffset, y + (height / 2) + 1.5);
        doc.setFont('helvetica', 'normal');
        doc.text(String(line.value || '').toUpperCase(), margin + 2 + line.xOffset + line.width, y + (height / 2) + 1.5);
      });
      y += height;
    };

    // Block 1: Event
    drawSection([
      { label: "LUGAR DE DIVULGACIÓN", value: formData.lugar_divulgacion, xOffset: 0, width: 45 }
    ], 10);
    
    const [year, month, day] = formData.fecha.split('-');
    drawSection([
      { label: "FECHA", value: `${day}/${month}/${year || '2026'}`, xOffset: 0, width: 15 },
      { label: "HORARIO DE", value: formData.hora_desde, xOffset: 70, width: 25 },
      { label: "A", value: formData.hora_hasta, xOffset: 120, width: 5 },
      { label: "HS.", value: "", xOffset: 145, width: 0 }
    ], 10);

    // Block 2: Divulgador
    drawSection([
      { label: "NOMBRE COMPLETO DIVULGADOR", value: formData.nombre_divulgador, xOffset: 0, width: 55 }
    ], 10);
    drawSection([
      { label: "C.I.C. N.º", value: formData.cedula_divulgador, xOffset: 0, width: 18 },
      { label: "VÍNCULO", value: formData.vinculo, xOffset: 70, width: 18 }
    ], 10);

    // Block 3: Location
    drawSection([
      { label: "OFICINA", value: formData.oficina, xOffset: 0, width: 18 }
    ], 10);
    drawSection([
      { label: "DEPARTAMENTO", value: formData.departamento, xOffset: 0, width: 30 }
    ], 10);

    y += 10;

    // --- Table Section ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text("MARCA CON UNA \"X\" POR CADA CIUDADANO QUE PRACTICÓ", pageWidth / 2, y, { align: 'center' });
    y += 5;

    const cellWidth = (pageWidth - (margin * 2)) / 13;
    const cellHeight = 10;
    const tableStartY = y;

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 13; col++) {
        const num = (row * 13) + col + 1;
        const x = margin + (col * cellWidth);
        const cellY = tableStartY + (row * cellHeight);
        
        doc.rect(x, cellY, cellWidth, cellHeight);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(num.toString(), x + 1.5, cellY + 3);
        
        if (markedCells.includes(num)) {
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text("X", x + (cellWidth / 2), cellY + (cellHeight / 2) + 2, { align: 'center' });
        }
      }
    }

    y = tableStartY + (8 * cellHeight) + 15;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`TOTAL DE PERSONAS: ${markedCells.length} ciudadanos.`, pageWidth / 2, y, { align: 'center' });

    // --- Signatures ---
    y += 35;
    doc.setFontSize(10);
    doc.text("__________________________________", margin + 40, y, { align: "center" });
    doc.text("Firma y aclaración Divulgador", margin + 40, y + 5, { align: "center" });
    
    doc.text("__________________________________", pageWidth - margin - 40, y, { align: "center" });
    doc.text("Firma, aclaración y sello Jefes", pageWidth - margin - 40, y + 5, { align: "center" });

    // --- Footer Note ---
    y += 25;
    doc.setFontSize(8);
    doc.text("-", margin, y);
    doc.text("Control individual del divulgador con cantidad de ciudadanos que practicaron con la MV para", margin + 5, y);
    doc.text("informe semanal de divulgación de la oficina.", margin + 5, y + 4);

    // --- Photos Page ---
    if (eventPhotos.length > 0) {
      doc.addPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text("ANEXO FOTOGRÁFICO DEL EVENTO", pageWidth / 2, 20, { align: 'center' });
      
      let photoY = 40;
      for (const photo of eventPhotos) {
        if (photoY + 70 > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          photoY = 20;
        }
        doc.addImage(photo, 'JPEG', margin, photoY, pageWidth - (margin * 2), 70);
        photoY += 80;
      }
    }

    doc.save(`AnexoIII-${formData.cedula_divulgador || 'Informe'}.pdf`);
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <Header title="Anexo III" />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-4xl mb-6">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2"><CalendarDays className="h-4 w-4" /> VINCULAR AGENDA</CardTitle>
            </CardHeader>
            <CardContent>
              <Select onValueChange={handleAgendaSelect} defaultValue={agendaId || undefined}>
                <SelectTrigger><SelectValue placeholder="Seleccionar actividad..." /></SelectTrigger>
                <SelectContent>
                  {agendaItems?.map(item => (
                    <SelectItem key={item.id} value={item.id}>{item.fecha} - {item.lugar_local}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        <Card className="mx-auto max-w-4xl shadow-xl border-t-4 border-t-primary">
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center gap-2"><UserCheck className="h-6 w-6 text-primary" /> Informe Anexo III</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/30 p-6 rounded-xl border-2 border-dashed">
              <div className="space-y-2">
                <Label className="font-black text-primary text-[10px] uppercase">Nombre Completo Divulgador</Label>
                <Input value={formData.nombre_divulgador} readOnly className="bg-white font-bold" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-black text-primary text-[10px] uppercase">C.I.C. N.º</Label>
                  <Input value={formData.cedula_divulgador} readOnly className="bg-white font-bold" />
                </div>
                <div className="space-y-2">
                  <Label className="font-black text-primary text-[10px] uppercase">Vínculo</Label>
                  <Input value={formData.vinculo} readOnly className="bg-white font-bold" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-black text-primary text-[10px] uppercase">Oficina</Label>
                <Input value={formData.oficina} readOnly className="bg-white font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="font-black text-primary text-[10px] uppercase">Departamento</Label>
                <Input value={formData.departamento} readOnly className="bg-white font-bold" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Lugar de Divulgación</Label>
                <Input name="lugar_divulgacion" value={formData.lugar_divulgacion} onChange={handleInputChange} placeholder="Lugar" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Input name="fecha" type="date" value={formData.fecha} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label>Total Personas</Label>
                  <div className="text-2xl font-black text-primary bg-primary/10 rounded-md p-2 text-center h-10 flex items-center justify-center">
                    {markedCells.length}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
                <Label className="font-bold">MARCA CON UNA "X" POR CADA CIUDADANO QUE PRACTICÓ</Label>
                <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-13 border rounded-lg overflow-hidden bg-background">
                    {Array.from({ length: 104 }, (_, i) => i + 1).map(num => (
                        <div key={num} onClick={() => toggleCell(num)} className={cn("aspect-square border flex flex-col items-center justify-center cursor-pointer hover:bg-primary/5", markedCells.includes(num) ? "bg-primary/10" : "")}>
                            <span className="text-[10px] text-muted-foreground">{num}</span>
                            <span className="text-xl font-black text-primary">{markedCells.includes(num) ? "X" : ""}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-6">
              <Label className="font-bold flex items-center gap-2"><ImageIcon className="h-5 w-5" /> FOTOS DE EVENTO (MÁX. 3)</Label>
              <div className="flex gap-2">
                <label className="cursor-pointer bg-primary/10 text-primary px-4 py-2 rounded text-sm font-bold flex items-center gap-2">
                  <Camera className="h-4 w-4" /> Cámara
                  <Input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
                </label>
                <label className="cursor-pointer border border-primary/20 px-4 py-2 rounded text-sm font-bold flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Galería
                  <Input type="file" accept="image/*" className="hidden" onChange={handlePhotoCapture} />
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {eventPhotos.map((photo, index) => (
                  <div key={index} className="relative aspect-video border rounded-lg overflow-hidden shadow-sm">
                    <Image src={photo} alt="Evento" fill className="object-cover" />
                    <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-7 w-7 rounded-full shadow-md" onClick={() => setEventPhotos(p => p.filter((_, i) => i !== index))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-4 border-t p-6 bg-muted/5">
            <Button onClick={generatePDF} variant="outline" className="w-full sm:w-auto font-bold h-12">
              <FileDown className="mr-2 h-5 w-5" /> GENERAR PDF ANEXO III
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 font-bold h-12 text-lg">
              {isSubmitting ? <><Loader2 className="animate-spin mr-2" /> GUARDANDO...</> : "GUARDAR INFORME"}
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
