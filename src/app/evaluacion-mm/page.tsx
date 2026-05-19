
"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useFirebase } from '@/firebase';
import { collection, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, CheckCircle2, ShieldCheck, ClipboardCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

function EvaluacionContent() {
  const searchParams = useSearchParams();
  const solicitudId = searchParams.get('solicitudId');
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [errores, setErrores] = useState<any[]>([]);
  const [solicitud, setSolicitud] = useState<any>(null);

  const [form, setForm] = useState({
    nombre_asistente: '',
    cedula_asistente: '',
    organizacion_politica: '',
    respuestas: {
      p1: '',
      p2: '',
      p3: '',
      p4: '',
      p5: '',
    },
    fecha: ''
  });

  useEffect(() => {
    async function load() {
      if (!firestore || !solicitudId) {
        setIsLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(firestore, 'solicitudes-capacitacion', solicitudId));
        if (snap.exists()) {
          const data = snap.data();
          setSolicitud(data);
          setForm(prev => ({ 
            ...prev, 
            organizacion_politica: data.solicitante_entidad || data.otra_entidad || '',
            fecha: data.fecha || new Date().toISOString().split('T')[0]
          }));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [firestore, solicitudId]);

  const handleSubmit = async () => {
    if (!firestore || !solicitudId) return;
    
    // Validar que todas las preguntas tengan respuesta
    const vals = Object.values(form.respuestas);
    if (vals.some(v => !v) || !form.nombre_asistente || !form.cedula_asistente) {
      toast({ 
        variant: 'destructive', 
        title: 'Formulario incompleto', 
        description: 'Por favor complete todos sus datos y responda todas las preguntas.' 
      });
      return;
    }

    setIsSubmitting(true);
    
    // CALCULAR PUNTAJE
    const correctas = { p1: 'D', p2: 'D', p3: 'C', p4: 'A', p5: 'D' };
    const enunciados = {
        p1: "Contingencia caso de no impresión del boletín",
        p2: "Acción del Presidente de Mesa en contingencia",
        p3: "Sustitución del Pendrive",
        p4: "¿Se puede votar con cédula vencida?",
        p5: "¿Cuál es voto nulo?"
    };
    
    let finalScore = 0;
    const listaErrores: any[] = [];

    Object.keys(correctas).forEach(key => {
      const userResp = (form.respuestas as any)[key];
      const correctResp = (correctas as any)[key];
      if (userResp === correctResp) {
        finalScore++;
      } else {
        listaErrores.push({
            pregunta: (enunciados as any)[key],
            marcada: userResp,
            correcta: correctResp
        });
      }
    });
    setScore(finalScore);
    setErrores(listaErrores);

    try {
      await addDoc(collection(firestore, 'evaluaciones-mm'), {
        ...form,
        puntaje: finalScore,
        solicitud_id: solicitudId,
        fecha: new Date().toISOString().split('T')[0],
        fecha_creacion: new Date().toISOString(),
        server_timestamp: serverTimestamp(),
      });
      setIsFinished(true);
      window.scrollTo(0, 0);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error al enviar', description: 'Intente de nuevo.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return (
    <div className="flex h-screen items-center justify-center bg-[#F8F9FA]">
      <div className="text-center space-y-4">
        <Loader2 className="animate-spin h-10 w-10 text-primary mx-auto" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cargando Evaluación...</p>
      </div>
    </div>
  );

  if (isFinished) return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-2xl border-t-8 border-t-green-500 rounded-[2.5rem] overflow-hidden">
        <CardContent className="p-10 text-center space-y-6">
          <div className="h-24 w-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 relative">
            <CheckCircle2 className="h-14 w-14 text-green-600" />
            <div className="absolute -bottom-2 -right-2 h-10 w-10 bg-primary text-white rounded-full flex items-center justify-center font-black text-lg border-4 border-white">
              {score}
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black uppercase tracking-tight text-primary">¡Evaluación Enviada!</h2>
            <p className="text-[10px] font-black uppercase text-green-600 tracking-widest">Calificación Final: {score} de 5</p>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {score === 5 
              ? "¡Excelente trabajo! Has demostrado un conocimiento perfecto de las funciones de MMRV."
              : "Has completado la evaluación. Revisa a continuación los puntos que debes reforzar:"}
          </p>

          {errores.length > 0 && (
            <div className="text-left space-y-3 bg-red-50 p-6 rounded-2xl border border-red-100">
                <p className="text-[10px] font-black uppercase text-red-600 mb-2 flex items-center gap-2">
                    <ShieldCheck className="h-3 w-3" /> REVISIÓN DE ERRORES:
                </p>
                {errores.map((err, i) => (
                    <div key={i} className="space-y-1 pb-2 border-b border-red-200/50 last:border-0 last:pb-0">
                        <p className="text-[9px] font-black uppercase text-gray-700">{err.pregunta}</p>
                        <div className="flex gap-4">
                            <p className="text-[8px] font-bold text-red-500 uppercase">Marcaste: {err.marcada}</p>
                            <p className="text-[8px] font-black text-green-600 uppercase">Correcta: {err.correcta}</p>
                        </div>
                    </div>
                ))}
            </div>
          )}

          <Button className="w-full h-12 rounded-xl font-black uppercase tracking-widest bg-green-600" onClick={() => window.close()}>
            FINALIZAR REVISIÓN
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* CABECERA OFICIAL */}
        <div className="flex flex-col items-center text-center space-y-2 mb-8">
          <img src="/logo.png" className="h-16 mb-2" alt="Justicia Electoral" />
          <h1 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Justicia Electoral</h1>
          <p className="text-[9px] font-bold uppercase text-muted-foreground leading-none">Dirección del Centro de Información, Documentación y Educación Electoral - CIDEE</p>
          <div className="h-1 w-20 bg-primary/20 rounded-full mt-4" />
        </div>

        <Card className="shadow-xl border-none rounded-[2rem] overflow-hidden">
          <CardHeader className="bg-primary text-white p-8">
            <CardTitle className="text-center space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Evaluación de Capacitación</p>
              <p className="text-xl font-black uppercase leading-tight">Funciones de Miembros de Mesa (MMRV)</p>
              <p className="text-[9px] font-bold uppercase opacity-80">Programa: Fortalecimiento Institucional</p>
            </CardTitle>
          </CardHeader>
          
          <CardContent className="p-8 space-y-8">
            
            {/* DATOS PERSONALES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase">Nombre y Apellido Completo</Label>
                <Input 
                  value={form.nombre_asistente} 
                  onChange={e => setForm({...form, nombre_asistente: e.target.value.toUpperCase()})}
                  placeholder="Escriba su nombre..."
                  className="h-10 border-2 font-bold uppercase text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase">Cédula de Identidad N°</Label>
                <Input 
                  value={form.cedula_asistente} 
                  onChange={e => setForm({...form, cedula_asistente: e.target.value})}
                  placeholder="Ej: 1234567"
                  className="h-10 border-2 font-bold text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase">Organización Política</Label>
                <Input 
                  value={form.organizacion_politica} 
                  readOnly
                  className="h-10 border-2 font-bold bg-muted/20 uppercase text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase">Fecha</Label>
                <Input 
                  value={form.fecha} 
                  readOnly
                  className="h-10 border-2 font-bold bg-muted/20 uppercase text-xs"
                />
              </div>
            </div>

            <Separator className="border-dashed" />

            <div className="space-y-10">
              <p className="text-[10px] font-black uppercase text-primary border-l-4 border-primary pl-3 bg-primary/5 py-2 rounded-r-lg">Selecciona una opción para cada pregunta:</p>

              {/* PREGUNTA 1 */}
              <div className="space-y-4">
                <p className="text-xs font-black uppercase leading-relaxed">1. Contingencia caso de no impresión del boletín de voto:</p>
                <RadioGroup value={form.respuestas.p1} onValueChange={v => setForm({...form, respuestas: {...form.respuestas, p1: v}})} className="space-y-3">
                  <OptionItem value="A" label="Si el boletín de voto no activa el módulo de votación y es expulsado por la MV, el elector deberá devolverlo y solicitar uno nuevo." />
                  <OptionItem value="B" label="Si el elector desea cambiar su boletín al percatarse de no elegir a su candidato de preferencia, puede cambiarlo las veces que lo desee." />
                  <OptionItem value="C" label="Si el boletín de voto impreso por la MV dice 'BOLETÍN DE VOTO INVÁLIDO', el elector deberá devolverlo y solicitar uno nuevo." />
                  <OptionItem value="D" label="A y C son correctas." />
                </RadioGroup>
              </div>

              {/* PREGUNTA 2 */}
              <div className="space-y-4">
                <p className="text-xs font-black uppercase leading-relaxed">2. El presidente de mesa en los casos de contingencia de no impresión del boletín de voto deberá:</p>
                <RadioGroup value={form.respuestas.p2} onValueChange={v => setForm({...form, respuestas: {...form.respuestas, p2: v}})} className="space-y-3">
                  <OptionItem value="A" label="Comunicar al delegado designado por el TEOP y al Soporte Técnico de la Justicia Electoral, quien, de ser necesario, procederá a reemplazar la MV por una de contingencia de acuerdo al protocolo aprobado por el TSJE." />
                  <OptionItem value="B" label="Si no activa el módulo de votación y es expulsado por la MV, el presidente de mesa escribirá &quot;BOLETÍN DAÑADO PREVIO AL VOTO&quot; lo pondrá en el sobre de boletines de voto no utilizados y asentará el hecho en el acta de incidentes." />
                  <OptionItem value="C" label="Si el boletín de voto impreso por la MV dice &quot;BOLETÍN DE VOTO INVÁLIDO&quot;, el presidente de mesa lo pondrá en el sobre de boletines de voto no utilizados y asentará el hecho en el acta de incidentes." />
                  <OptionItem value="D" label="B y C son correctas." />
                </RadioGroup>
              </div>

              {/* PREGUNTA 3 */}
              <div className="space-y-4">
                <p className="text-xs font-black uppercase leading-relaxed">3. Si la mesa receptora de votos necesita sustituir el pendrive:</p>
                <RadioGroup value={form.respuestas.p3} onValueChange={v => setForm({...form, respuestas: {...form.respuestas, p3: v}})} className="space-y-3">
                  <OptionItem value="A" label="Se hace la sustitución de la máquina y carga de sistema." />
                  <OptionItem value="B" label="Se utiliza el pendrive del soporte técnico." />
                  <OptionItem value="C" label="Se labra un acta y se entrega el pendrive de contingencia." />
                  <OptionItem value="D" label="Se vota para la sustitución del pendrive bajo acta y se llama al soporte técnico." />
                </RadioGroup>
              </div>

              {/* PREGUNTA 4 */}
              <div className="space-y-4">
                <p className="text-xs font-black uppercase leading-relaxed">4. ¿Se puede votar con Cédula de Identidad Civil vencida?</p>
                <RadioGroup value={form.respuestas.p4} onValueChange={v => setForm({...form, respuestas: {...form.respuestas, p4: v}})} className="space-y-3">
                  <OptionItem value="A" label="SÍ" />
                  <OptionItem value="B" label="NO" />
                  <OptionItem value="C" label="Los miembros de mesa deben decidir por mayoría simple." />
                </RadioGroup>
              </div>

              {/* PREGUNTA 5 */}
              <div className="space-y-4">
                <p className="text-xs font-black uppercase leading-relaxed">5. ¿Cuál es voto nulo?</p>
                <RadioGroup value={form.respuestas.p5} onValueChange={v => setForm({...form, respuestas: {...form.respuestas, p5: v}})} className="space-y-3">
                  <OptionItem value="A" label="El boletín de voto que no tenga la firma de los miembros de mesa;" />
                  <OptionItem value="B" label="El elector, sin utilizar la MV, introduzca en la urna plástica el boletín sin el contenido del voto;" />
                  <OptionItem value="C" label="El boletín de voto sea ilegible." />
                  <OptionItem value="D" label="Todas son correctas." />
                </RadioGroup>
              </div>

            </div>
          </CardContent>
          
          <CardFooter className="p-8 bg-muted/10 border-t">
            <Button 
              className="w-full h-16 rounded-2xl font-black uppercase tracking-[0.2em] text-base shadow-xl"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="animate-spin h-6 w-6" /> : <ClipboardCheck className="h-6 w-6 mr-3" />}
              Enviar Evaluación
            </Button>
          </CardFooter>
        </Card>

        <p className="text-center text-[8px] font-medium text-muted-foreground uppercase tracking-widest pb-10">
          MECIP 2015 — SISTEMA DE GESTIÓN ELECTORAL DGRE
        </p>
      </div>
    </div>
  );
}

function OptionItem({ value, label }: { value: string, label: string }) {
  return (
    <label className={cn(
      "flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all hover:bg-muted/30",
      "active:scale-[0.98]"
    )}>
      <RadioGroupItem value={value} className="mt-0.5" />
      <div className="flex gap-2">
        <span className="font-black text-xs text-primary">{value}.</span>
        <span className="text-[11px] font-medium leading-tight text-muted-foreground">{label}</span>
      </div>
    </label>
  );
}

function Separator({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-muted", className)} />;
}

export default function EvaluacionMMPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>}>
      <EvaluacionContent />
    </Suspense>
  );
}
