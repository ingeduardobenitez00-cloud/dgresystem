
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
import { collection, addDoc, serverTimestamp, query, where, orderBy } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';
import jsPDF from 'jspdf';
import { type SolicitudCapacitacion } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn, formatDateToDDMMYYYY } from '@/lib/utils';

function EncuestaContent() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const solicitudIdFromUrl = searchParams.get('solicitudId');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [selectedAgendaId, setSelectedAgendaId] = useState<string | undefined>(solicitudIdFromUrl || undefined);
  
  const [formData, setFormData] = useState({
    lugar_practica: '',
    fecha: '',
    hora: '',
    edad: '',
    genero: 'hombre' as const,
    utilidad_maquina: 'muy_util' as const,
    facilidad_maquina: 'muy_facil' as const,
    seguridad_maquina: 'muy_seguro' as const,
    departamento: '',
    distrito: '',
  });

  // Handle defaults from user profile when first loaded
  useEffect(() => {
    if (!isUserLoading && user?.profile && !formData.departamento) {
      setFormData(prev => ({
        ...prev,
        departamento: user.profile?.departamento || '',
        distrito: user.profile?.distrito || '',
      }));
    }
  }, [user, isUserLoading, formData.departamento]);

  // Set initial dates only on client to avoid hydration mismatch
  useEffect(() => {
    if (!selectedAgendaId) {
      const now = new Date();
      setFormData(prev => ({
        ...prev,
        fecha: now.toISOString().split('T')[0],
        hora: now.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false })
      }));
    }
  }, [selectedAgendaId]);

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
    if (!firestore || !user?.profile) return null;
    
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    const canFilterAll = user.profile.role === 'admin' || user.profile.permissions?.includes('admin_filter');

    if (canFilterAll) {
      return query(colRef, orderBy('fecha', 'desc'));
    }

    if (!user.profile.departamento || !user.profile.distrito) {
        return null;
    }

    return query(
      colRef,
      where('departamento', '==', user.profile.departamento),
      where('distrito', '==', user.profile.distrito),
      orderBy('fecha', 'desc')
    );
  }, [firestore, user]);

  const { data: agendaItems, isLoading: isLoadingAgenda } = useCollection<SolicitudCapacitacion>(agendaQuery);

  // Sync with URL param or item selection
  useEffect(() => {
    const targetId = selectedAgendaId || solicitudIdFromUrl;
    if (targetId && agendaItems) {
      const item = agendaItems.find(a => a.id === targetId);
      if (item) {
        setFormData(prev => ({
          ...prev,
          lugar_practica: item.lugar_local,
          fecha: item.fecha,
          hora: item.hora_desde,
          departamento: item.departamento,
          distrito: item.distrito,
        }));
      }
    }
  }, [selectedAgendaId, solicitudIdFromUrl, agendaItems]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleValueChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAgendaSelect = (id: string) => {
    setSelectedAgendaId(id);
    const item = agendaItems?.find(a => a.id === id);
    if (item) {
      setFormData(prev => ({
        ...prev,
        lugar_practica: item.lugar_local,
        fecha: item.fecha,
        hora: item.hora_desde,
        departamento: item.departamento,
        distrito: item.distrito,
      }));
      toast({ title: "Datos de Agenda Cargados", description: `Ubicación: ${item.lugar_local}` });
    }
  };

  const handleSubmit = async () => {
    if (!firestore || !user) return;
    
    if (!formData.lugar_practica || !formData.fecha || !formData.hora || !formData.edad) {
        toast({ variant: "destructive", title: "Faltan datos", description: "Por favor complete todos los campos obligatorios." });
        return;
    }

    setIsSubmitting(true);
    const encuestaData = {
      ...formData,
      usuario_id: user.uid,
      fecha_creacion: new Date().toISOString(),
      server_timestamp: serverTimestamp(),
    };

    try {
      await addDoc(collection(firestore, 'encuestas-satisfaccion'), encuestaData);
      toast({ title: "¡Encuesta Registrada!", description: "Se ha guardado el feedback del ciudadano." });
      // Reset only non-location fields to allow multiple surveys in same session
      setFormData(p => ({ ...p, edad: '', genero: 'hombre' }));
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
    doc.text(`FECHA: ${formatDateToDDMMYYYY(formData.fecha)}    HORA: ${formData.hora} HS.`, margin, y);
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
    doc.text("Después de la práctica, ¿qué tan seguro/a se siente para utilizar", margin, y);
    y += 5;
    doc.text("la máquina de votación?", margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    const seguridadMap = { muy_seguro: 'Muy seguro/a', seguro: 'Seguro/a', poco_seguro: 'Poco seguro/a', nada_seguro: 'Nada seguro/a' };
    doc.text(`[X] ${seguridadMap[formData.seguridad_maquina as keyof typeof seguridadMap]}`, margin + 5, y);
    
    y = 240;
    doc.setLineWidth(0.2);
    doc.rect(margin, y, 170, 30);
    
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text("PARA USO INTERNO DE LA JUSTICIA ELECTORAL", margin + 5, y);
    
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Distrito: ${formData.distrito || '____________________'}`, margin + 5, y);
    doc.text(`Departamento: ${formData.departamento || '____________________'}`, margin + 85, y);
    
    y += 8;
    doc.setFontSize(9);
    doc.text("Enviar a la Dirección del CIDEE hasta el martes posterior a la semana de divulgación.", margin + 5, y);

    doc.save(`Encuesta-${formData.lugar_practica || 'Satisfaccion'}.pdf`);
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <Header title="Encuesta de Satisfacción" />
      <main className="flex-1 p-4 md:p-8">
        
        <div className="mx-auto max-w-3xl mb-6">
          <Card className="bg-primary/5 border-primary/20 shadow-md">
            <CardHeader className="py-4">
              <CardTitle className="text-xs font-black flex items-center gap-2 uppercase tracking-widest text-primary">
                <CalendarDays className="h-4 w-4" />
                VINCULAR CON ACTIVIDAD DE LA AGENDA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black text-muted-foreground">Seleccionar sesión programada</Label>
                <Select onValueChange={handleAgendaSelect} value={selectedAgendaId || undefined}>
                  <SelectTrigger className="h-12 border-2 bg-white">
                    <SelectValue placeholder={isLoadingAgenda ? "Cargando actividades..." : "Seleccione una actividad de la agenda..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {agendaItems && agendaItems.length > 0 ? (
                      agendaItems.map(item => (
                        <SelectItem key={item.id} value={item.id}>
                          {formatDateToDDMMYYYY(item.fecha)} | {item.lugar_local} ({item.solicitante_entidad})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>No se encontraron actividades agendadas</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mx-auto max-w-3xl shadow-xl border-t-4 border-t-primary">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="flex items-center gap-2 uppercase font-black text-primary">
              <MessageSquareHeart className="h-6 w-6" />
              Encuesta de Satisfacción Ciudadana
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase">Registro de experiencia del ciudadano con la Máquina de Votación.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 pt-8">
            
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-primary tracking-widest">LUGAR DONDE REALIZÓ LA PRÁCTICA</Label>
                <div className="relative">
                  <Input 
                    name="lugar_practica" 
                    value={formData.lugar_practica} 
                    onChange={handleInputChange} 
                    placeholder="Nombre del local o institución" 
                    className={cn("h-11 font-bold border-2", selectedAgendaId && "bg-green-50 border-green-200")} 
                  />
                  {formData.lugar_practica && <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-green-500" />}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">FECHA</Label>
                  <Input name="fecha" type="date" value={formData.fecha} onChange={handleInputChange} className="h-11 font-bold border-2" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">HORA</Label>
                  <Input name="hora" type="time" value={formData.hora} onChange={handleInputChange} className="h-11 font-bold border-2" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">EDAD (AÑOS)</Label>
                  <Input name="edad" type="number" value={formData.edad} onChange={handleInputChange} placeholder="00" className="h-11 font-black border-2" />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-primary tracking-widest">GÉNERO</Label>
                <RadioGroup value={formData.genero} onValueChange={(v) => handleValueChange('genero', v as any)} className="flex flex-wrap gap-6 bg-muted/20 p-4 rounded-lg border-2 border-dashed">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="hombre" id="g-h" />
                    <Label htmlFor="g-h" className="font-bold cursor-pointer">HOMBRE</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="mujer" id="g-m" />
                    <Label htmlFor="g-m" className="font-bold cursor-pointer">MUJER</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pueblo_originario" id="g-p" />
                    <Label htmlFor="g-p" className="font-bold cursor-pointer">PUEBLO ORIGINARIO</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <Separator />

            <div className="space-y-8">
              <div className="space-y-4">
                <Label className="font-black text-sm uppercase tracking-tight text-primary block">¿Le parece útil practicar con la máquina de votación?</Label>
                <RadioGroup value={formData.utilidad_maquina} onValueChange={(v) => handleValueChange('utilidad_maquina', v as any)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2 border-2 p-4 rounded-xl hover:bg-primary/5 transition-colors cursor-pointer data-[state=checked]:border-primary">
                    <RadioGroupItem value="muy_util" id="u-1" />
                    <Label htmlFor="u-1" className="flex-1 font-bold cursor-pointer">Muy útil</Label>
                  </div>
                  <div className="flex items-center space-x-2 border-2 p-4 rounded-xl hover:bg-primary/5 transition-colors cursor-pointer">
                    <RadioGroupItem value="util" id="u-2" />
                    <Label htmlFor="u-2" className="flex-1 font-bold cursor-pointer">Útil</Label>
                  </div>
                  <div className="flex items-center space-x-2 border-2 p-4 rounded-xl hover:bg-primary/5 transition-colors cursor-pointer">
                    <RadioGroupItem value="poco_util" id="u-3" />
                    <Label htmlFor="u-3" className="flex-1 font-bold cursor-pointer">Poco útil</Label>
                  </div>
                  <div className="flex items-center space-x-2 border-2 p-4 rounded-xl hover:bg-primary/5 transition-colors cursor-pointer">
                    <RadioGroupItem value="nada_util" id="u-4" />
                    <Label htmlFor="u-4" className="flex-1 font-bold cursor-pointer">Nada útil</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-4">
                <Label className="font-black text-sm uppercase tracking-tight text-primary block">¿Le resultó fácil usar la máquina de votación?</Label>
                <RadioGroup value={formData.facilidad_maquina} onValueChange={(v) => handleValueChange('facilidad_maquina', v as any)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2 border-2 p-4 rounded-xl hover:bg-primary/5 transition-colors cursor-pointer">
                    <RadioGroupItem value="muy_facil" id="f-1" />
                    <Label htmlFor="f-1" className="flex-1 font-bold cursor-pointer">Muy fácil</Label>
                  </div>
                  <div className="flex items-center space-x-2 border-2 p-4 rounded-xl hover:bg-primary/5 transition-colors cursor-pointer">
                    <RadioGroupItem value="facil" id="f-2" />
                    <Label htmlFor="f-2" className="flex-1 font-bold cursor-pointer">Fácil</Label>
                  </div>
                  <div className="flex items-center space-x-2 border-2 p-4 rounded-xl hover:bg-primary/5 transition-colors cursor-pointer">
                    <RadioGroupItem value="poco_facil" id="f-3" />
                    <Label htmlFor="f-3" className="flex-1 font-bold cursor-pointer">Poco fácil</Label>
                  </div>
                  <div className="flex items-center space-x-2 border-2 p-4 rounded-xl hover:bg-primary/5 transition-colors cursor-pointer">
                    <RadioGroupItem value="nada_facil" id="f-4" />
                    <Label htmlFor="f-4" className="flex-1 font-bold cursor-pointer">Nada fácil</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-4">
                <Label className="font-black text-sm uppercase tracking-tight text-primary block">
                  Después de la práctica, ¿qué tan seguro/a se siente para utilizar la máquina de votación?
                </Label>
                <RadioGroup value={formData.seguridad_maquina} onValueChange={(v) => handleValueChange('seguridad_maquina', v as any)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2 border-2 p-4 rounded-xl hover:bg-primary/5 transition-colors cursor-pointer">
                    <RadioGroupItem value="muy_seguro" id="s-1" />
                    <Label htmlFor="s-1" className="flex-1 font-bold cursor-pointer">Muy seguro/a</Label>
                  </div>
                  <div className="flex items-center space-x-2 border-2 p-4 rounded-xl hover:bg-primary/5 transition-colors cursor-pointer">
                    <RadioGroupItem value="seguro" id="s-2" />
                    <Label htmlFor="s-2" className="flex-1 font-bold cursor-pointer">Seguro/a</Label>
                  </div>
                  <div className="flex items-center space-x-2 border-2 p-4 rounded-xl hover:bg-primary/5 transition-colors cursor-pointer">
                    <RadioGroupItem value="poco_seguro" id="s-3" />
                    <Label htmlFor="s-3" className="flex-1 font-bold cursor-pointer">Poco seguro/a</Label>
                  </div>
                  <div className="flex items-center space-x-2 border-2 p-4 rounded-xl hover:bg-primary/5 transition-colors cursor-pointer">
                    <RadioGroupItem value="nada_seguro" id="s-4" />
                    <Label htmlFor="s-4" className="flex-1 font-bold cursor-pointer">Nada seguro/a</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <div className="mt-10 border-2 border-primary/20 p-6 rounded-lg bg-white shadow-sm">
                <p className="font-black text-xs uppercase text-primary mb-4 tracking-widest border-b pb-2">PARA USO INTERNO DE LA JUSTICIA ELECTORAL</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase text-muted-foreground">Distrito:</span>
                        <span className="font-bold border-b border-dashed border-primary/40 pb-1">{formData.distrito || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase text-muted-foreground">Departamento:</span>
                        <span className="font-bold border-b border-dashed border-primary/40 pb-1">{formData.departamento || 'N/A'}</span>
                    </div>
                </div>
                <p className="text-[10px] font-medium italic text-muted-foreground mt-4">
                    Enviar a la Dirección del CIDEE hasta el martes posterior a la semana de divulgación.
                </p>
            </div>

          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-4 bg-muted/30 border-t p-6">
            <Button onClick={generatePDF} variant="outline" className="w-full sm:w-auto font-black h-14 px-8 border-primary text-primary hover:bg-primary/5">
              <FileDown className="mr-2 h-5 w-5" /> DESCARGAR PDF
            </Button>
            <div className="flex-1" />
            <Button onClick={handleSubmit} disabled={isSubmitting || !formData.edad} className="w-full sm:w-auto px-12 h-14 font-black text-xl uppercase shadow-2xl">
              {isSubmitting ? <><Loader2 className="animate-spin mr-3 h-6 w-6" /> GUARDANDO...</> : <><CheckCircle2 className="mr-3 h-6 w-6" /> REGISTRAR ENCUESTA</>}
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
