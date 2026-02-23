
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
import { Loader2, MessageSquareHeart, CheckCircle2, FileDown, Globe } from 'lucide-react';
import { useUser, useFirebase, useMemoFirebase, useDoc } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';
import jsPDF from 'jspdf';
import { type SolicitudCapacitacion } from '@/lib/data';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn, formatDateToDDMMYYYY } from '@/lib/utils';
import Image from 'next/image';

function EncuestaContent() {
  const { user } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const solicitudIdFromUrl = searchParams.get('solicitudId');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  
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

  // Fetch specific solicitud if provided in URL (Automated via QR)
  const solicitudRef = useMemoFirebase(() => 
    firestore && solicitudIdFromUrl ? doc(firestore, 'solicitudes-capacitacion', solicitudIdFromUrl) : null,
    [firestore, solicitudIdFromUrl]
  );
  const { data: publicSolicitud, isLoading: isLoadingPublicSol } = useDoc<SolicitudCapacitacion>(solicitudRef);

  useEffect(() => {
    if (publicSolicitud) {
      setFormData(prev => ({
        ...prev,
        lugar_practica: publicSolicitud.lugar_local,
        fecha: publicSolicitud.fecha,
        hora: publicSolicitud.hora_desde,
        departamento: publicSolicitud.departamento,
        distrito: publicSolicitud.distrito,
      }));
    }
  }, [publicSolicitud]);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleValueChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!firestore) return;
    if (!formData.lugar_practica || !formData.fecha || !formData.hora || !formData.edad) {
        toast({ variant: "destructive", title: "Faltan datos", description: "Por favor complete todos los campos obligatorios." });
        return;
    }

    setIsSubmitting(true);
    const encuestaData = {
      ...formData,
      usuario_id: user?.uid || 'CIUDADANO_EXTERNO',
      fecha_creacion: new Date().toISOString(),
      server_timestamp: serverTimestamp(),
    };

    try {
      await addDoc(collection(firestore, 'encuestas-satisfaccion'), encuestaData);
      toast({ title: "¡Gracias!", description: "Tu feedback ha sido registrado exitosamente." });
      // Reset sensitive/personal fields but keep location context if came from QR
      setFormData(p => ({ 
        ...p, 
        edad: '', 
        genero: 'hombre',
        utilidad_maquina: 'muy_util' as const,
        facilidad_maquina: 'muy_facil' as const,
        seguridad_maquina: 'muy_seguro' as const,
      }));
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
    doc.text(`LUGAR: ${formData.lugar_practica.toUpperCase()}`, margin, y); y += 10;
    doc.text(`FECHA: ${formatDateToDDMMYYYY(formData.fecha)}    HORA: ${formData.hora} HS.`, margin, y); y += 10;
    doc.text(`EDAD: ${formData.edad} AÑOS`, margin, y); y += 10;
    const generoLabel = formData.genero === 'hombre' ? 'HOMBRE' : formData.genero === 'mujer' ? 'MUJER' : 'PUEBLO ORIGINARIO';
    doc.text(`GÉNERO: ${generoLabel}`, margin, y); y += 15;
    doc.setFont('helvetica', 'bold'); doc.text("¿Le parece útil practicar con la máquina de votación?", margin, y); y += 7;
    doc.setFont('helvetica', 'normal');
    const utilidadMap = { muy_util: 'Muy útil', util: 'Útil', poco_util: 'Poco útil', nada_util: 'Nada útil' };
    doc.text(`[X] ${utilidadMap[formData.utilidad_maquina as keyof typeof utilidadMap]}`, margin + 5, y); y += 15;
    doc.setFont('helvetica', 'bold'); doc.text("¿Le resultó fácil usar la máquina de votación?", margin, y); y += 7;
    doc.setFont('helvetica', 'normal');
    const facilidadMap = { muy_facil: 'Muy fácil', facil: 'Fácil', poco_facil: 'Poco fácil', nada_facil: 'Nada fácil' };
    doc.text(`[X] ${facilidadMap[formData.facilidad_maquina as keyof typeof facilidadMap]}`, margin + 5, y); y += 15;
    doc.setFont('helvetica', 'bold'); doc.text("¿Qué tan seguro/a se siente para utilizar la máquina?", margin, y); y += 7;
    doc.setFont('helvetica', 'normal');
    const seguridadMap = { muy_seguro: 'Muy seguro/a', seguro: 'Seguro/a', poco_seguro: 'Poco seguro/a', nada_seguro: 'Nada seguro/a' };
    doc.text(`[X] ${seguridadMap[formData.seguridad_maquina as keyof typeof seguridadMap]}`, margin + 5, y);
    y = 240; doc.setLineWidth(0.2); doc.rect(margin, y, 170, 30);
    y += 6; doc.setFont('helvetica', 'bold'); doc.text("PARA USO INTERNO DE LA JUSTICIA ELECTORAL", margin + 5, y);
    y += 8; doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text(`Distrito: ${formData.distrito || '____________________'}`, margin + 5, y);
    doc.text(`Departamento: ${formData.departamento || '____________________'}`, margin + 85, y);
    doc.save(`Encuesta-${formData.lugar_practica || 'Satisfaccion'}.pdf`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      {user ? <Header title="Encuesta de Satisfacción" /> : (
        <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
            <Image src="/logo.png" alt="Logo" width={40} height={40} className="object-contain" />
            <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase text-primary leading-none">Justicia Electoral</span>
                <span className="text-sm font-bold uppercase tracking-tight">Portal Ciudadano</span>
            </div>
        </header>
      )}
      <main className="flex-1 p-4 md:p-8">
        
        {solicitudIdFromUrl && !isLoadingPublicSol && publicSolicitud && (
            <div className="mx-auto max-w-3xl mb-6 animate-in fade-in slide-in-from-top-4">
                <div className="bg-green-600 text-white p-4 rounded-xl shadow-lg flex items-center gap-4">
                    <Globe className="h-8 w-8 opacity-50 shrink-0" />
                    <div>
                        <p className="text-[10px] font-black uppercase opacity-80">Evaluando Sesión en:</p>
                        <p className="text-lg font-black uppercase leading-tight">{publicSolicitud.lugar_local}</p>
                        <p className="text-[10px] font-bold opacity-80">{publicSolicitud.distrito} - {publicSolicitud.departamento}</p>
                    </div>
                </div>
            </div>
        )}

        <Card className="mx-auto max-w-3xl shadow-xl border-t-4 border-t-primary">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="flex items-center gap-2 uppercase font-black text-primary">
              <MessageSquareHeart className="h-6 w-6" />
              Encuesta de Satisfacción Ciudadana
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase">Tu opinión nos ayuda a mejorar el servicio electoral.</CardDescription>
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
                    readOnly={!!solicitudIdFromUrl}
                    placeholder="Nombre del local o institución" 
                    className={cn("h-11 font-bold border-2", solicitudIdFromUrl && "bg-green-50 border-green-200")} 
                  />
                  {(formData.lugar_practica) && <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-green-500" />}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">FECHA</Label>
                  <Input name="fecha" type="date" value={formData.fecha} onChange={handleInputChange} readOnly={!!solicitudIdFromUrl} className="h-11 font-bold border-2" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">HORA</Label>
                  <Input name="hora" type="time" value={formData.hora} onChange={handleInputChange} readOnly={!!solicitudIdFromUrl} className="h-11 font-bold border-2" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">TU EDAD (AÑOS)</Label>
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
                  {['muy_util', 'util', 'poco_util', 'nada_util'].map(val => (
                    <div key={val} className="flex items-center space-x-2 border-2 p-4 rounded-xl hover:bg-primary/5 transition-colors cursor-pointer data-[state=checked]:border-primary">
                        <RadioGroupItem value={val} id={`u-${val}`} />
                        <Label htmlFor={`u-${val}`} className="flex-1 font-bold cursor-pointer capitalize">{val.replace('_', ' ')}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-4">
                <Label className="font-black text-sm uppercase tracking-tight text-primary block">¿Le resultó fácil usar la máquina de votación?</Label>
                <RadioGroup value={formData.facilidad_maquina} onValueChange={(v) => handleValueChange('facilidad_maquina', v as any)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {['muy_facil', 'facil', 'poco_facil', 'nada_facil'].map(val => (
                    <div key={val} className="flex items-center space-x-2 border-2 p-4 rounded-xl hover:bg-primary/5 transition-colors cursor-pointer">
                        <RadioGroupItem value={val} id={`f-${val}`} />
                        <Label htmlFor={`f-${val}`} className="flex-1 font-bold cursor-pointer capitalize">{val.replace('_', ' ')}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-4">
                <Label className="font-black text-sm uppercase tracking-tight text-primary block">¿Qué tan seguro/a se siente para utilizar la máquina?</Label>
                <RadioGroup value={formData.seguridad_maquina} onValueChange={(v) => handleValueChange('seguridad_maquina', v as any)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {['muy_seguro', 'seguro', 'poco_seguro', 'nada_seguro'].map(val => (
                    <div key={val} className="flex items-center space-x-2 border-2 p-4 rounded-xl hover:bg-primary/5 transition-colors cursor-pointer">
                        <RadioGroupItem value={val} id={`s-${val}`} />
                        <Label htmlFor={`s-${val}`} className="flex-1 font-bold cursor-pointer capitalize">{val.replace('_', ' ')}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>

            <div className="mt-10 border-2 border-primary/20 p-6 rounded-lg bg-white shadow-sm">
                <p className="font-black text-xs uppercase text-primary mb-4 tracking-widest border-b pb-2">DATOS DE UBICACIÓN</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase text-muted-foreground">Distrito:</span>
                        <span className="font-bold">{formData.distrito || '---'}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase text-muted-foreground">Departamento:</span>
                        <span className="font-bold">{formData.departamento || '---'}</span>
                    </div>
                </div>
            </div>

          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-4 bg-muted/30 border-t p-6">
            {user && (
                <Button onClick={generatePDF} variant="outline" className="w-full sm:w-auto font-black h-14 px-8 border-primary text-primary">
                    <FileDown className="mr-2 h-5 w-5" /> PDF INTERNO
                </Button>
            )}
            <div className="flex-1" />
            <Button onClick={handleSubmit} disabled={isSubmitting || !formData.edad} className="w-full sm:w-auto px-12 h-14 font-black text-xl uppercase shadow-2xl">
              {isSubmitting ? <><Loader2 className="animate-spin mr-3 h-6 w-6" /> ENVIANDO...</> : <><CheckCircle2 className="mr-3 h-6 w-6" /> ENVIAR ENCUESTA</>}
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
