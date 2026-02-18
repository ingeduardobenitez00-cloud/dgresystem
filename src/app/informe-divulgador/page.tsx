
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

  // Pre-fill from profile if no agenda item is selected yet
  useEffect(() => {
    if (!isUserLoading && user?.profile && !agendaId) {
      setFormData(prev => ({
        ...prev,
        nombre_divulgador: user.profile?.username || '',
        cedula_divulgador: user.profile?.cedula || '',
        vinculo: user.profile?.vinculo || '',
        oficina: user.profile?.distrito || '',
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
      }));
      toast({ title: "Datos cargados", description: "Se ha importado la información de la agenda." });
    }
  };

  const toggleCell = (num: number) => {
    setMarcaciones(prev => 
      prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]
    );
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (eventPhotos.length >= 3) {
        toast({ variant: "destructive", title: "Límite alcanzado", description: "Solo puedes agregar hasta 3 fotos." });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEventPhotos(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setEventPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!firestore || !user) return;
    
    if (!formData.lugar_divulgacion || !formData.fecha || !formData.nombre_divulgador) {
        toast({ variant: "destructive", title: "Faltan datos", description: "Por favor complete los campos requeridos." });
        return;
    }

    setIsSubmitting(true);
    try {
      const informeData = {
        ...formData,
        departamento: user.profile?.departamento || '',
        distrito: user.profile?.distrito || '',
        total_personas: markedCells.length,
        marcaciones: markedCells,
        fotos: eventPhotos,
        usuario_id: user.uid,
        fecha_creacion: new Date().toISOString(),
        server_timestamp: serverTimestamp(),
      };
      await addDoc(collection(firestore, 'informes-divulgador'), informeData);
      
      toast({ title: "¡Informe Guardado!", description: "El informe del divulgador ha sido registrado con éxito." });
      
      setMarcaciones([]);
      setEventPhotos([]);
      // Keep professional data but clear event data
      setFormData(prev => ({
        ...prev,
        lugar_divulgacion: '',
        fecha: '',
        hora_desde: '',
        hora_hasta: '',
      }));
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar el informe." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const generatePDF = async () => {
    const doc = new jsPDF();
    const margin = 15;
    
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', margin, 5, 18, 18);
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("INFORME DEL DIVULGADOR (ANEXO III)", 105, 15, { align: "center" });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text("Control individual del divulgador con cantidad de ciudadanos que practicaron con la MV", 105, 20, { align: "center" });

    let y = 35;
    const drawLine = (label: string, value: string, currentY: number) => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, margin, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text((value || '').toUpperCase(), margin + 50, currentY);
        doc.line(margin + 50, currentY + 1, 195, currentY + 1);
        return currentY + 8;
    };

    y = drawLine("LUGAR DE DIVULGACIÓN", formData.lugar_divulgacion, y);
    doc.setFont('helvetica', 'bold');
    doc.text("FECHA:", margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(formData.fecha, margin + 20, y);
    doc.setFont('helvetica', 'bold');
    doc.text("HORARIO DE:", margin + 60, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`${formData.hora_desde} A ${formData.hora_hasta} HS`, margin + 90, y);
    y += 8;

    y = drawLine("NOMBRE COMPLETO DIVULGADOR", formData.nombre_divulgador, y);
    doc.setFont('helvetica', 'bold');
    doc.text("C.I.C. N.º:", margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(formData.cedula_divulgador, margin + 25, y);
    doc.setFont('helvetica', 'bold');
    doc.text("VÍNCULO:", margin + 80, y);
    doc.setFont('helvetica', 'normal');
    doc.text(formData.vinculo, margin + 105, y);
    y += 8;

    y = drawLine("OFICINA", formData.oficina, y);
    y = drawLine("DEPARTAMENTO", user?.profile?.departamento || '', y);
    y = drawLine("TOTAL DE PERSONAS", `${markedCells.length} CIUDADANOS`, y);

    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y, 180, 8, 'F');
    doc.rect(margin, y, 180, 8);
    doc.text("MARCA CON UNA \"X\" POR CADA CIUDADANO QUE PRACTICÓ", 105, y + 5.5, { align: "center" });
    y += 8;

    const cols = 13;
    const rows = 8;
    const cellW = 180 / cols;
    const cellH = 10;

    for(let r = 0; r < rows; r++) {
        for(let c = 0; c < cols; c++) {
            const num = r * cols + c + 1;
            const xPos = margin + c * cellW;
            const yPos = y + r * cellH;
            doc.rect(xPos, yPos, cellW, cellH);
            doc.setFontSize(8);
            doc.text(num.toString(), xPos + 2, yPos + 4);
            if(markedCells.includes(num)) {
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text("X", xPos + cellW/2 - 2, yPos + cellH/2 + 2);
                doc.setFont('helvetica', 'normal');
            }
        }
    }

    y += rows * cellH + 20;
    doc.setFontSize(9);
    doc.text("__________________________________", 50, y, { align: "center" });
    doc.text("Firma y aclaración Divulgador", 50, y + 5, { align: "center" });

    doc.text("__________________________________", 150, y, { align: "center" });
    doc.text("Firma, aclaración y sello Jefes", 150, y + 5, { align: "center" });

    if (eventPhotos.length > 0) {
      doc.addPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text("FOTOS DEL EVENTO (DIVULGACIÓN / CAPACITACIÓN)", 105, 20, { align: "center" });
      
      let photoY = 30;
      for (const photo of eventPhotos) {
        if (photoY + 80 > 280) {
          doc.addPage();
          photoY = 20;
        }
        try {
          doc.addImage(photo, 'JPEG', margin, photoY, 180, 70);
          photoY += 85;
        } catch (e) {
          console.error("Error adding photo to PDF", e);
        }
      }
    }

    doc.save(`AnexoIII-${formData.cedula_divulgador || 'Informe'}.pdf`);
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <Header title="Informe del Divulgador - Anexo III" />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-4xl mb-6">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                VINCULAR CON ACTIVIDAD DE LA AGENDA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-end">
                <div className="flex-1 space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Seleccionar sesión programada</Label>
                  <Select onValueChange={handleAgendaSelect} defaultValue={agendaId || undefined}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder={isLoadingAgenda ? "Cargando..." : "Seleccionar actividad..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {agendaItems && agendaItems.length > 0 ? (
                        agendaItems.map(item => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.fecha} - {item.lugar_local} {item.divulgador_nombre ? `(${item.divulgador_nombre})` : ''}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>No hay actividades agendadas</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mx-auto max-w-4xl shadow-xl border-t-4 border-t-primary">
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-6 w-6 text-primary" />
              Informe del Divulgador (Anexo III)
            </CardTitle>
            <CardDescription>Control semanal de ciudadanos que practicaron con la Máquina de Votación.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 pt-6">
            
            {/* Professional Data Section (Read Only) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/30 p-6 rounded-xl border-2 border-dashed">
              <div className="space-y-2">
                <Label htmlFor="nombre_divulgador" className="font-black text-primary text-[10px] uppercase tracking-widest">Nombre Completo Divulgador</Label>
                <Input id="nombre_divulgador" name="nombre_divulgador" value={formData.nombre_divulgador} readOnly className="bg-white font-bold border-primary/20" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cedula_divulgador" className="font-black text-primary text-[10px] uppercase tracking-widest">C.I.C. N.º</Label>
                  <Input id="cedula_divulgador" name="cedula_divulgador" value={formData.cedula_divulgador} readOnly className="bg-white font-bold border-primary/20" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vinculo" className="font-black text-primary text-[10px] uppercase tracking-widest">Vínculo</Label>
                  <Input id="vinculo" name="vinculo" value={formData.vinculo} readOnly className="bg-white font-bold border-primary/20" />
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="oficina" className="font-black text-primary text-[10px] uppercase tracking-widest flex items-center gap-2">
                  <Building2 className="h-3 w-3" /> Oficina / Registro Electoral
                </Label>
                <Input id="oficina" name="oficina" value={formData.oficina} readOnly className="bg-white font-bold border-primary/20" />
              </div>
            </div>

            <Separator />

            {/* Event Data Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="lugar_divulgacion">LUGAR DE DIVULGACIÓN</Label>
                <Input id="lugar_divulgacion" name="lugar_divulgacion" value={formData.lugar_divulgacion} onChange={handleInputChange} className={agendaId ? "bg-primary/5 font-semibold" : ""} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fecha">FECHA</Label>
                  <Input id="fecha" name="fecha" type="date" value={formData.fecha} onChange={handleInputChange} className={agendaId ? "bg-primary/5 font-semibold" : ""} />
                </div>
                <div className="space-y-2 text-right">
                    <Label className="text-primary font-bold">TOTAL PERSONAS</Label>
                    <div className="text-3xl font-black text-primary bg-primary/10 rounded-md p-1 border border-primary/20">{markedCells.length}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hora_desde">HORARIO DESDE</Label>
                  <Input id="hora_desde" name="hora_desde" type="time" value={formData.hora_desde} onChange={handleInputChange} className={agendaId ? "bg-primary/5 font-semibold" : ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hora_hasta">HORARIO HASTA</Label>
                  <Input id="hora_hasta" name="hora_hasta" type="time" value={formData.hora_hasta} onChange={handleInputChange} className={agendaId ? "bg-primary/5 font-semibold" : ""} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Tally Sheet Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <Label className="text-lg font-bold flex items-center gap-2">
                        <MousePointerSquareDashed className="h-5 w-5 text-primary" />
                        MARCA CON UNA "X" POR CADA CIUDADANO QUE PRACTICÓ
                    </Label>
                    <Button variant="ghost" size="sm" onClick={() => setMarcaciones([])} className="text-xs text-muted-foreground hover:text-destructive">Limpiar todo</Button>
                </div>
                <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-13 border rounded-lg overflow-hidden bg-background">
                    {Array.from({ length: 104 }, (_, i) => i + 1).map(num => (
                        <div 
                            key={num}
                            onClick={() => toggleCell(num)}
                            className={cn(
                                "aspect-square border flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-primary/5",
                                markedCells.includes(num) ? "bg-primary/10" : ""
                            )}
                        >
                            <span className="text-[10px] text-muted-foreground mb-1">{num}</span>
                            <span className="text-xl font-black text-primary">
                                {markedCells.includes(num) ? "X" : ""}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <Separator />

            {/* Photos Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-bold flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  FOTOS DEL EVENTO (MÁX. 3)
                </Label>
                <div className="flex gap-2">
                  <label htmlFor="camera-capture" className="cursor-pointer">
                    <div className="inline-flex items-center justify-center rounded-md bg-primary/10 px-3 py-2 text-sm font-bold text-primary hover:bg-primary/20 transition-all">
                      <Camera className="mr-2 h-4 w-4" /> CÁMARA
                    </div>
                    <Input id="camera-capture" type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} disabled={eventPhotos.length >= 3} />
                  </label>
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="inline-flex items-center justify-center rounded-md border border-primary/20 px-3 py-2 text-sm font-bold text-primary hover:bg-muted transition-all">
                      <Plus className="mr-2 h-4 w-4" /> GALERÍA
                    </div>
                    <Input id="file-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoCapture} disabled={eventPhotos.length >= 3} />
                  </label>
                </div>
              </div>

              {eventPhotos.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {eventPhotos.map((photo, index) => (
                    <Card key={index} className="relative group overflow-hidden border-2 border-primary/10">
                      <CardContent className="p-0 aspect-video relative">
                        <Image src={photo} alt={`Foto ${index + 1}`} fill className="object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button variant="destructive" size="icon" className="rounded-full" onClick={() => removePhoto(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                      <CardFooter className="p-2 bg-muted/50 justify-center">
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Foto {index + 1}</span>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center bg-muted/5 text-muted-foreground">
                  <ImageIcon className="h-10 w-10 mb-2 opacity-20" />
                  <p className="text-sm font-medium uppercase tracking-tighter">No hay imágenes capturadas</p>
                  <p className="text-[10px] font-bold">Puedes subir hasta 3 fotografías de la actividad</p>
                </div>
              )}
            </div>

            <Separator />

            <div className="bg-muted/30 p-4 rounded-lg border border-dashed border-primary/20">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <p><span className="font-semibold">Departamento:</span> {user?.profile?.departamento || 'No asignado'}</p>
                    <p><span className="font-semibold">Distrito:</span> {user?.profile?.distrito || 'No asignado'}</p>
                </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-4 bg-muted/10 border-t p-6">
            <Button onClick={generatePDF} variant="outline" className="w-full sm:w-auto font-bold h-12">
              <FileDown className="mr-2 h-5 w-5" /> GENERAR ANEXO III (PDF)
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 h-12 font-bold text-lg">
              {isSubmitting ? <><Loader2 className="animate-spin mr-2 h-5 w-5" /> GUARDANDO...</> : <><CheckCircle2 className="mr-2 h-5 w-5" /> GUARDAR INFORME</>}
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
