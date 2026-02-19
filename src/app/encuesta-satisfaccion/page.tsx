"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageSquareHeart, CheckCircle2, FileDown, CalendarDays } from 'lucide-react';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';
import jsPDF from 'jspdf';
import { type SolicitudCapacitacion } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { formatDateToDDMMYYYY } from '@/lib/utils';

function EncuestaContent() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const solicitudId = searchParams.get('solicitudId');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    lugar_practica: '',
    fecha: '',
    hora: '',
    edad: '',
    genero: 'hombre',
    utilidad_maquina: 'muy_util',
    facilidad_maquina: 'muy_facil',
    seguridad_maquina: 'muy_seguro',
  });

  // Set initial dates on client only to avoid hydration mismatch
  useEffect(() => {
    if (!solicitudId) {
      const now = new Date();
      setFormData(prev => ({
        ...prev,
        fecha: now.toISOString().split('T')[0],
        hora: now.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false })
      }));
    }
  }, [solicitudId]);

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
    if (!firestore || !user?.profile?.distrito) return null;
    return query(
      collection(firestore, 'solicitudes-capacitacion'),
      where('departamento', '==', user.profile.departamento),
      where('distrito', '==', user.profile.distrito)
    );
  }, [firestore, user]);

  const { data: agendaItems, isLoading: isLoadingAgenda } = useCollection<SolicitudCapacitacion>(agendaQuery);

  useEffect(() => {
    if (solicitudId && agendaItems) {
      const item = agendaItems.find(a => a.id === solicitudId);
      if (item) {
        setFormData(prev => ({
          ...prev,
          lugar_practica: item.lugar_local,
          fecha: item.fecha,
          hora: item.hora_desde,
        }));
      }
    }
  }, [solicitudId, agendaItems]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleValueChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAgendaSelect = (id: string) => {
    const item = agendaItems?.find(a => a.id === id);
    if (item) {
      setFormData(prev => ({
        ...prev,
        lugar_practica: item.lugar_local,
        fecha: item.fecha,
        hora: item.hora_desde,
      }));
      toast({ title: "Datos cargados", description: "Se ha importado la información de la agenda." });
    }
  };

  const handleSubmit = async () => {
    if (!firestore || !user) return;
    
    if (!formData.lugar_practica || !formData.fecha || !formData.hora || !formData.edad) {
        toast({ variant: "destructive", title: "Faltan datos", description: "Por favor complete todos los campos requeridos." });
        return;
    }

    setIsSubmitting(true);
    const encuestaData = {
      ...formData,
      departamento: user.profile?.departamento || '',
      distrito: user.profile?.distrito || '',
      usuario_id: user.uid,
      fecha_creacion: new Date().toISOString(),
      server_timestamp: serverTimestamp(),
    };

    try {
      await addDoc(collection(firestore, 'encuestas-satisfaccion'), encuestaData);
      toast({ title: "¡Encuesta Guardada!", description: "La encuesta ha sido registrada." });
      setFormData(p => ({ ...p, lugar_practica: '', edad: '' }));
    } catch (error) {
      const contextualError = new FirestorePermissionError({
        path: 'encuestas-satisfaccion',
        operation: 'create',
        requestResourceData: encuestaData
      });
      errorEmitter.emit('permission-error', contextualError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const margin = 20;
    if (logoBase64) doc.addImage(logoBase64, 'PNG', margin, 5, 18, 18);

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text("ENCUESTA DE SATISFACCIÓN", 105, 20, { align: "center" });
    doc.setFontSize(10);
    doc.text("Uso de la Máquina de Votación", 105, 26, { align: "center" });

    let y = 45;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`LUGAR: ${formData.lugar_practica.toUpperCase()}`, margin, y);
    y += 10;
    doc.text(`FECHA: ${formatDateToDDMMYYYY(formData.fecha)}    HORA: ${formData.hora}`, margin, y);
    y += 10;
    doc.text(`EDAD: ${formData.edad} AÑOS`, margin, y);
    y += 10;
    
    const generoLabel = formData.genero === 'hombre' ? 'HOMBRE' : formData.genero === 'mujer' ? 'MUJER' : 'PUEBLO ORIGINARIO';
    doc.text(`GÉNERO: ${generoLabel}`, margin, y);
    y += 15;

    doc.setFont('helvetica', 'bold');
    doc.text("¿Le parece útil practicar con la máquina de votación?", margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    const utilidadMap = { muy_util: 'Muy útil', util: 'Útil', poco_util: 'Poco útil', nada_util: 'Nada útil' };
    doc.text(`[X] ${utilidadMap[formData.utilidad_maquina as keyof typeof utilidadMap]}`, margin + 5, y);
    y += 15;

    doc.setFont('helvetica', 'bold');
    doc.text("¿Le resultó fácil usar la máquina de votación?", margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    const facilidadMap = { muy_facil: 'Muy fácil', facil: 'Fácil', poco_facil: 'Poco fácil', nada_facil: 'Nada fácil' };
    doc.text(`[X] ${facilidadMap[formData.facilidad_maquina as keyof typeof facilidadMap]}`, margin + 5, y);
    y += 15;

    doc.setFont('helvetica', 'bold');
    doc.text("¿Qué tan seguro/a se siente?", margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    const seguridadMap = { muy_seguro: 'Muy seguro/a', seguro: 'Seguro/a', poco_seguro: 'Poco seguro/a', nada_seguro: 'Nada seguro/a' };
    doc.text(`[X] ${seguridadMap[formData.seguridad_maquina as keyof typeof seguridadMap]}`, margin + 5, y);
    
    y = 240;
    doc.setLineWidth(0.5);
    doc.line(margin, y, 190, y);
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.text("PARA USO INTERNO DE LA JUSTICIA ELECTORAL", 105, y, { align: "center" });
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.text(`Distrito: ${user?.profile?.distrito || ''}`, margin, y);
    doc.text(`Departamento: ${user?.profile?.departamento || ''}`, 110, y);

    doc.save(`Encuesta-${formData.lugar_practica || 'Satisfaccion'}.pdf`);
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <Header title="Encuesta de Satisfacción" />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-3xl mb-6">
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
                  <Suspense fallback={<Loader2 className="animate-spin h-4 w-4" />}>
                    <Select onValueChange={handleAgendaSelect} defaultValue={solicitudId || undefined}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder={isLoadingAgenda ? "Cargando agenda..." : "Seleccionar de la agenda..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {agendaItems && agendaItems.length > 0 ? (
                          agendaItems.map(item => (
                            <SelectItem key={item.id} value={item.id}>
                              {formatDateToDDMMYYYY(item.fecha)} - {item.lugar_local} ({item.hora_desde} hs)
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>No hay actividades agendadas</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </Suspense>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mx-auto max-w-3xl shadow-xl border-t-4 border-t-primary">
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center gap-2">
              <MessageSquareHeart className="h-6 w-6 text-primary" />
              Encuesta de Satisfacción
            </CardTitle>
            <CardDescription>Registro de experiencia del ciudadano.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 pt-6">
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <Label htmlFor="lugar_practica">LUGAR DONDE REALIZÓ LA PRÁCTICA</Label>
                <div className="relative">
                  <Input id="lugar_practica" name="lugar_practica" value={formData.lugar_practica} onChange={handleInputChange} placeholder="Nombre del local" className={solicitudId ? "bg-muted font-semibold" : ""} />
                  {formData.lugar_practica && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fecha">FECHA</Label>
                  <Input id="fecha" name="fecha" type="date" value={formData.fecha} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hora">HORA</Label>
                  <Input id="hora" name="hora" type="time" value={formData.hora} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edad">EDAD (AÑOS)</Label>
                  <Input id="edad" name="edad" type="number" value={formData.edad} onChange={handleInputChange} placeholder="00" />
                </div>
              </div>

              <div className="space-y-3">
                <Label>GÉNERO</Label>
                <RadioGroup value={formData.genero} onValueChange={(v) => handleValueChange('genero', v)} className="flex flex-wrap gap-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="hombre" id="g-h" />
                    <Label htmlFor="g-h">HOMBRE</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="mujer" id="g-m" />
                    <Label htmlFor="g-m">MUJER</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pueblo_originario" id="g-p" />
                    <Label htmlFor="g-p">PUEBLO ORIGINARIO</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <Separator />

            <div className="space-y-6">
              <div className="space-y-4">
                <Label className="font-bold">¿Le parece útil practicar con la máquina de votación?</Label>
                <RadioGroup value={formData.utilidad_maquina} onValueChange={(v) => handleValueChange('utilidad_maquina', v)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="muy_util" id="u-1" />
                    <Label htmlFor="u-1" className="flex-1 cursor-pointer">Muy útil</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="util" id="u-2" />
                    <Label htmlFor="u-2" className="flex-1 cursor-pointer">Útil</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="poco_util" id="u-3" />
                    <Label htmlFor="u-3" className="flex-1 cursor-pointer">Poco útil</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="nada_util" id="u-4" />
                    <Label htmlFor="u-4" className="flex-1 cursor-pointer">Nada útil</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-4">
                <Label className="font-bold">¿Le resultó fácil usar la máquina de votación?</Label>
                <RadioGroup value={formData.facilidad_maquina} onValueChange={(v) => handleValueChange('facilidad_maquina', v)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="muy_facil" id="f-1" />
                    <Label htmlFor="f-1" className="flex-1 cursor-pointer">Muy fácil</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="fasil" id="f-2" />
                    <Label htmlFor="f-2" className="flex-1 cursor-pointer">Fácil</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="poco_facil" id="f-3" />
                    <Label htmlFor="f-3" className="flex-1 cursor-pointer">Poco fácil</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="nada_facil" id="f-4" />
                    <Label htmlFor="f-4" className="flex-1 cursor-pointer">Nada fácil</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-4 bg-muted/10 border-t p-6">
            <Button onClick={generatePDF} variant="outline" className="w-full sm:w-auto font-bold h-12">
              <FileDown className="mr-2 h-5 w-5" /> DESCARGAR PDF
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 h-12 font-bold text-lg">
              {isSubmitting ? <><Loader2 className="animate-spin mr-2 h-5 w-5" /> GUARDANDO...</> : <><CheckCircle2 className="mr-2 h-5 w-5" /> REGISTRAR ENCUESTA</>}
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}

export default function EncuestaSatisfaccionPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>}>
      <EncuestaContent />
    </Suspense>
  );
}
