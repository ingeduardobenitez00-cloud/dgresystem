
"use client";

import { useState } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageSquareHeart, CheckCircle2, FileDown } from 'lucide-react';
import { useUser, useFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';
import jsPDF from 'jspdf';

export default function EncuestaSatisfaccionPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleValueChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!firestore || !user) return;
    
    if (!formData.lugar_practica || !formData.fecha || !formData.hora || !formData.edad) {
        toast({ variant: "destructive", title: "Faltan datos", description: "Por favor complete todos los campos requeridos." });
        return;
    }

    setIsSubmitting(true);
    try {
      const encuestaData = {
        ...formData,
        departamento: user.profile?.departamento || '',
        distrito: user.profile?.distrito || '',
        usuario_id: user.uid,
        fecha_creacion: new Date().toISOString(),
        server_timestamp: serverTimestamp(),
      };
      await addDoc(collection(firestore, 'encuestas-satisfaccion'), encuestaData);
      
      toast({ title: "¡Encuesta Guardada!", description: "La encuesta de satisfacción ha sido registrada." });
      
      // Reset form
      setFormData({
        lugar_practica: '',
        fecha: '',
        hora: '',
        edad: '',
        genero: 'hombre',
        utilidad_maquina: 'muy_util',
        facilidad_maquina: 'muy_facil',
        seguridad_maquina: 'muy_seguro',
      });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la encuesta." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const margin = 20;
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text("ENCUESTA DE SATISFACCIÓN", 105, 20, { align: "center" });
    doc.setFontSize(10);
    doc.text("Uso de la Máquina de Votación", 105, 26, { align: "center" });

    let y = 40;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    
    doc.text(`LUGAR DONDE REALIZÓ LA PRÁCTICA: ${formData.lugar_practica.toUpperCase()}`, margin, y);
    y += 10;
    doc.text(`FECHA: ${formData.fecha}    HORA: ${formData.hora}`, margin, y);
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
    doc.text("Después de la práctica, ¿qué tan seguro/a se siente para utilizar la máquina de votación?", margin, y);
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
    doc.text(`Distrito: ${user?.profile?.distrito || '_________________'}`, margin, y);
    doc.text(`Departamento: ${user?.profile?.departamento || '_________________'}`, 110, y);
    y += 10;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text("Enviar a la Dirección del CIDEE hasta el martes posterior a la semana de divulgación.", 105, y, { align: "center" });

    doc.save(`Encuesta-${formData.lugar_practica || 'Satisfaccion'}.pdf`);
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <Header title="Encuesta de Satisfacción" />
      <main className="flex-1 p-4 md:p-8">
        <Card className="mx-auto max-w-3xl shadow-xl border-t-4 border-t-primary">
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center gap-2">
              <MessageSquareHeart className="h-6 w-6 text-primary" />
              Encuesta de Satisfacción - CIDEE
            </CardTitle>
            <CardDescription>Registro de experiencia del ciudadano con la máquina de votación.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 pt-6">
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <Label htmlFor="lugar_practica">LUGAR DONDE REALIZÓ LA PRÁCTICA</Label>
                <Input id="lugar_practica" name="lugar_practica" value={formData.lugar_practica} onChange={handleInputChange} placeholder="Nombre del local o ubicación" />
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
                    <RadioGroupItem value="facil" id="f-2" />
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

              <div className="space-y-4">
                <Label className="font-bold">Después de la práctica, ¿qué tan seguro/a se siente para utilizar la máquina de votación?</Label>
                <RadioGroup value={formData.seguridad_maquina} onValueChange={(v) => handleValueChange('seguridad_maquina', v)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="muy_seguro" id="s-1" />
                    <Label htmlFor="s-1" className="flex-1 cursor-pointer">Muy seguro/a</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="seguro" id="s-2" />
                    <Label htmlFor="s-2" className="flex-1 cursor-pointer">Seguro/a</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="poco_seguro" id="s-3" />
                    <Label htmlFor="s-3" className="flex-1 cursor-pointer">Poco seguro/a</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="nada_seguro" id="s-4" />
                    <Label htmlFor="s-4" className="flex-1 cursor-pointer">Nada seguro/a</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <Separator />

            <div className="bg-muted/30 p-4 rounded-lg border border-dashed border-primary/20">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Uso Interno de la Justicia Electoral</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <p><span className="font-semibold">Departamento:</span> {user?.profile?.departamento || 'No asignado'}</p>
                    <p><span className="font-semibold">Distrito:</span> {user?.profile?.distrito || 'No asignado'}</p>
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
