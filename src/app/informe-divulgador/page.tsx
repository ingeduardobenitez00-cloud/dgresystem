
"use client";

import { useState, useEffect, Suspense, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserCheck, FileDown, Camera, Trash2, CheckCircle2, Globe, X } from 'lucide-react';
import { useUser, useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, doc } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';
import jsPDF from 'jspdf';
import { type SolicitudCapacitacion } from '@/lib/data';
import { cn, formatDateToDDMMYYYY } from '@/lib/utils';
import Image from 'next/image';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

function InformeContent() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const agendaId = searchParams.get('solicitudId');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [markedCells, setMarcaciones] = useState<number[]>([]);
  const [eventPhotos, setEventPhotos] = useState<string[]>([]);
  
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
    distrito: '',
  });

  useEffect(() => {
    if (!isUserLoading && user?.profile && !agendaId) {
      setFormData(prev => ({
        ...prev,
        nombre_divulgador: user.profile?.username || '',
        cedula_divulgador: user.profile?.cedula || '',
        vinculo: user.profile?.vinculo || '',
        oficina: user.profile?.distrito || '',
        departamento: user.profile?.departamento || '',
        distrito: user.profile?.distrito || '',
      }));
    }
  }, [user, isUserLoading, agendaId]);

  const solicitudRef = useMemoFirebase(() => firestore && agendaId ? doc(firestore, 'solicitudes-capacitacion', agendaId) : null, [firestore, agendaId]);
  const { data: agendaDoc } = useDoc<SolicitudCapacitacion>(solicitudRef);

  useEffect(() => {
    if (agendaDoc) {
      setFormData(prev => ({
        ...prev,
        lugar_divulgacion: agendaDoc.lugar_local,
        fecha: agendaDoc.fecha,
        hora_desde: agendaDoc.hora_desde,
        hora_hasta: agendaDoc.hora_hasta,
        oficina: agendaDoc.distrito || '',
        departamento: agendaDoc.departamento || '',
        distrito: agendaDoc.distrito || '',
      }));
    }
  }, [agendaDoc]);

  const toggleCell = (num: number) => {
    setMarcaciones(prev => prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]);
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setEventPhotos(prev => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    if (!firestore || !user) return;
    if (!formData.lugar_divulgacion || !formData.fecha) {
        toast({ variant: "destructive", title: "Faltan datos" }); return;
    }

    setIsSubmitting(true);
    const docData = {
      ...formData,
      total_personas: markedCells.length,
      marcaciones: markedCells,
      fotos: eventPhotos,
      usuario_id: user.uid,
      fecha_creacion: new Date().toISOString(),
      server_timestamp: serverTimestamp(),
    };

    addDoc(collection(firestore, 'informes-divulgador'), docData)
      .then(() => {
        toast({ title: "¡Informe Guardado!" });
        setMarcaciones([]); setEventPhotos([]); setIsSubmitting(false);
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
    <div className="flex min-h-screen flex-col bg-muted/20">
      <Header title="Anexo III" />
      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
        <Card className="shadow-xl border-t-4 border-t-primary">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="uppercase font-black text-primary">Anexo III - Control Individual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8 pt-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input name="lugar_divulgacion" value={formData.lugar_divulgacion} onChange={e => setFormData(p => ({...p, lugar_divulgacion: e.target.value}))} placeholder="Lugar" className="font-bold h-11 border-2" />
                <Input type="date" name="fecha" value={formData.fecha} onChange={e => setFormData(p => ({...p, fecha: e.target.value}))} className="font-bold h-11 border-2" />
            </div>
            <Separator />
            <div className="grid grid-cols-10 gap-1 border p-2 rounded-xl">
                {Array.from({ length: 104 }, (_, i) => i + 1).map(num => (
                    <div key={num} onClick={() => toggleCell(num)} className={cn("aspect-square border flex items-center justify-center cursor-pointer", markedCells.includes(num) ? "bg-primary text-white" : "hover:bg-muted")}>
                        <span className="text-[10px] font-black">{markedCells.includes(num) ? "X" : num}</span>
                    </div>
                ))}
            </div>
          </CardContent>
          <CardFooter className="p-6 border-t bg-muted/30">
            <Button onClick={handleSubmit} disabled={isSubmitting || markedCells.length === 0} className="w-full h-14 text-xl font-black uppercase shadow-2xl">
              {isSubmitting ? <Loader2 className="animate-spin mr-3" /> : "GUARDAR INFORME"}
            </Button>
          </CardFooter>
        </Card>
      </main>
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
