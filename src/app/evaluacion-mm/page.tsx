"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFirebase } from '@/firebase';
import { collection, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, Check, ClipboardCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Image from 'next/image';

function EvaluacionContent() {
  const searchParams = useSearchParams();
  const solicitudId = searchParams.get('solicitudId');
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [solicitud, setSolicitud] = useState<any>(null);

  const [form, setForm] = useState({
    lugar: '',
    fecha: '',
    respuestas: {
      p1: '',
      p2: '',
      p3: '',
    },
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
          
          let dateStr = data.fecha || new Date().toISOString().split('T')[0];
          // Format date if needed, but since it's an input type date/text, we keep it as YYYY-MM-DD for now.
          if (solicitudId) {
              const [y, m, d] = dateStr.split('-');
              if (y && m && d) dateStr = `${d}/${m}/${y}`;
          }

          setForm(prev => ({ 
            ...prev, 
            lugar: data.lugar_local || '',
            fecha: dateStr
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
    
    const vals = Object.values(form.respuestas);
    if (vals.some(v => !v) || !form.lugar || !form.fecha) {
      toast({ 
        variant: 'destructive', 
        title: 'Encuesta incompleta', 
        description: 'Por favor complete el lugar, la fecha y marque una opción para todas las preguntas.' 
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await addDoc(collection(firestore, 'evaluaciones-mm'), {
        ...form,
        solicitud_id: solicitudId,
        fecha_creacion: new Date().toISOString(),
        server_timestamp: serverTimestamp(),
      });
      setIsFinished(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error al enviar', description: 'Ocurrió un error. Intente de nuevo.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return (
    <div className="flex h-screen items-center justify-center bg-[#F8F9FA]">
      <div className="text-center space-y-4">
        <Loader2 className="animate-spin h-10 w-10 text-primary mx-auto" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cargando Encuesta...</p>
      </div>
    </div>
  );

  if (isFinished) return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-2xl border-t-8 border-t-green-500 rounded-[2.5rem] overflow-hidden">
        <CardContent className="p-10 text-center space-y-6">
          <div className="h-24 w-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-12 w-12 text-green-600 stroke-[3]" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black uppercase tracking-tight text-primary">¡Encuesta Enviada!</h2>
            <p className="text-xs font-black uppercase text-green-600 tracking-widest">Gracias por su participación</p>
          </div>
          <p className="text-sm font-medium text-muted-foreground px-4">
            Sus respuestas nos ayudan a mejorar continuamente nuestras jornadas de capacitación.
          </p>

          <Button className="w-full h-14 rounded-xl font-black uppercase tracking-widest bg-green-600 text-white mt-4 shadow-lg hover:bg-green-700 transition-colors" onClick={() => window.close()}>
            FINALIZAR
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        
        <Card className="shadow-2xl border-none rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="bg-white border-b p-8 md:p-12">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
              <Image src="/logo.png" alt="Justicia Electoral" width={90} height={90} className="object-contain shrink-0" />
              <div className="space-y-2 pt-2">
                <h1 className="text-xl md:text-2xl font-black uppercase text-[#1A1A1A] leading-tight">
                  Encuesta de Satisfacción de Capacitación – Justicia Electoral
                </h1>
                <h2 className="text-sm md:text-base font-bold uppercase text-muted-foreground tracking-tight">
                  Miembros de Mesa Receptora de Votos
                </h2>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-8 md:p-12 space-y-12">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-gray-50 p-6 md:p-8 rounded-2xl border border-dashed border-gray-300">
              <div className="space-y-3">
                <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest">Fecha:</Label>
                <Input 
                  value={form.fecha} 
                  onChange={e => setForm({...form, fecha: e.target.value})}
                  type={solicitudId ? "text" : "date"}
                  readOnly={!!solicitudId}
                  placeholder="_______________________"
                  className={cn("h-12 border-b-2 border-t-0 border-x-0 border-black rounded-none shadow-none focus-visible:ring-0 font-black uppercase text-sm md:text-base px-0 bg-transparent", solicitudId && "text-primary")}
                />
              </div>
              <div className="space-y-3">
                <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest">Lugar:</Label>
                <Input 
                  value={form.lugar} 
                  onChange={e => setForm({...form, lugar: e.target.value.toUpperCase()})}
                  readOnly={!!solicitudId}
                  placeholder="_______________________"
                  className={cn("h-12 border-b-2 border-t-0 border-x-0 border-black rounded-none shadow-none focus-visible:ring-0 font-black uppercase text-sm md:text-base px-0 bg-transparent", solicitudId && "text-primary")}
                />
              </div>
            </div>

            <div className="space-y-6">
              <p className="text-sm md:text-base font-medium text-muted-foreground">Marque la opción que considere adecuada.</p>
              
              <div className="space-y-8">
                <QuestionItem 
                  number={1}
                  question="¿Cómo califica la claridad de la explicación brindada durante la capacitación?"
                  value={form.respuestas.p1}
                  onChange={(v) => setForm({...form, respuestas: {...form.respuestas, p1: v}})}
                />
                
                <QuestionItem 
                  number={2}
                  question="¿Considera que los temas desarrollados fueron útiles para el desempeño de sus funciones como Miembro de Mesa Receptora de Votos?"
                  value={form.respuestas.p2}
                  onChange={(v) => setForm({...form, respuestas: {...form.respuestas, p2: v}})}
                />
                
                <QuestionItem 
                  number={3}
                  question="¿Cómo evalúa la organización y atención recibida durante la capacitación?"
                  value={form.respuestas.p3}
                  onChange={(v) => setForm({...form, respuestas: {...form.respuestas, p3: v}})}
                />
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col sm:flex-row gap-6 bg-muted/30 border-t p-8 md:p-12">
            <Button 
              className="w-full h-16 rounded-[1.5rem] font-black uppercase tracking-widest text-base md:text-lg shadow-xl bg-black hover:bg-black/90 text-white transition-all"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="animate-spin h-6 w-6 mr-3" /> : <ClipboardCheck className="h-6 w-6 mr-3" />}
              Enviar Encuesta
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

function QuestionItem({ number, question, value, onChange }: { number: number, question: string, value: string, onChange: (val: string) => void }) {
  const options = ['Excelente', 'Muy Bueno', 'Bueno', 'Aceptable'];
  
  return (
    <div className="bg-white p-6 md:p-8 rounded-[2rem] border-2 shadow-sm space-y-6 hover:border-primary/40 transition-colors">
      <div className="flex gap-4">
        <span className="font-black text-2xl md:text-3xl text-primary leading-none">{number}.</span>
        <p className="text-base md:text-lg font-bold text-[#1A1A1A] leading-tight mt-1">{question}</p>
      </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mt-6 pl-0 md:pl-10">
        {options.map((opt) => (
          <label key={opt} className={cn(
            "flex flex-col items-center justify-center p-3 md:p-4 rounded-xl border-2 cursor-pointer transition-all hover:bg-muted/30 gap-3 group",
            value === opt ? "border-primary bg-primary/5 shadow-md" : "border-muted",
            "active:scale-[0.98]"
          )}>
            <div className={cn(
              "h-6 w-6 rounded-md border-2 flex items-center justify-center transition-all", 
              value === opt ? "bg-primary border-primary text-white scale-110" : "bg-white border-muted-foreground/30 group-hover:border-primary/50"
            )}>
              {value === opt && <Check className="h-4 w-4 stroke-[3]" />}
            </div>
            <span className={cn(
                "text-[10px] md:text-xs font-black uppercase text-center tracking-wider",
                value === opt ? "text-primary" : "text-muted-foreground group-hover:text-[#1A1A1A]"
            )}>{opt}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function EvaluacionMMPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>}>
      <EvaluacionContent />
    </Suspense>
  );
}
