
"use client";

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageSquareHeart, CheckCircle2, FileDown, Globe, MapPin, Calendar, Clock, DatabaseZap, Search, X } from 'lucide-react';
import { useUser, useFirebase, useMemoFirebase, useDoc, useCollection } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, query, where } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';
import jsPDF from 'jspdf';
import { type SolicitudCapacitacion } from '@/lib/data';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn, formatDateToDDMMYYYY } from '@/lib/utils';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function EncuestaContent() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  
  const [isMounted, setIsMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [internalSolicitudId, setInternalSolicitudId] = useState<string | null>(null);
  
  const solicitudIdFromUrl = searchParams.get('solicitudId');
  const effectiveSolicitudId = solicitudIdFromUrl || internalSolicitudId;

  const [formData, setFormData] = useState({
    lugar_practica: '',
    fecha: '',
    hora: '',
    edad: '',
    genero: 'hombre' as 'hombre' | 'mujer',
    pueblo_originario: false,
    utilidad_maquina: 'muy_util' as const,
    facilidad_maquina: 'muy_facil' as const,
    seguridad_maquina: 'muy_seguro' as const,
    departamento: '',
    distrito: '',
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const solicitudRef = useMemoFirebase(() => 
    firestore && effectiveSolicitudId ? doc(firestore, 'solicitudes-capacitacion', effectiveSolicitudId) : null,
    [firestore, effectiveSolicitudId]
  );
  
  const { data: linkedSolicitud } = useDoc<SolicitudCapacitacion>(solicitudRef);

  const agendaQuery = useMemoFirebase(() => {
    if (!firestore || !user?.profile) return null;
    const profile = user.profile;
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    
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

  const { data: agendaItems } = useCollection<SolicitudCapacitacion>(agendaQuery);

  useEffect(() => {
    if (linkedSolicitud) {
      setFormData(prev => ({
        ...prev,
        lugar_practica: linkedSolicitud.lugar_local || '',
        fecha: linkedSolicitud.fecha || '',
        hora: linkedSolicitud.hora_desde || '',
        departamento: linkedSolicitud.departamento || '',
        distrito: linkedSolicitud.distrito || '',
      }));
    } else if (!effectiveSolicitudId && user?.profile) {
        setFormData(prev => ({
            ...prev,
            departamento: user.profile?.departamento || prev.departamento,
            distrito: user.profile?.distrito || prev.distrito,
        }));
    }
  }, [linkedSolicitud, effectiveSolicitudId, user]);

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

  const handleSubmit = () => {
    if (!firestore) return;
    if (!formData.lugar_practica || !formData.fecha || !formData.edad) {
        toast({ variant: "destructive", title: "Faltan datos" });
        return;
    }

    setIsSubmitting(true);
    const encuestaData = {
      ...formData,
      solicitud_id: effectiveSolicitudId || 'CARGA_MANUAL_OFICINA',
      usuario_id: user?.uid || 'CIUDADANO_EXTERNO',
      fecha_creacion: new Date().toISOString(),
      server_timestamp: serverTimestamp(),
    };

    addDoc(collection(firestore, 'encuestas-satisfaccion'), encuestaData)
      .then(() => {
        toast({ title: "¡Gracias!", description: "Feedback registrado." });
        setFormData(p => ({ 
          ...p, 
          edad: '', 
          utilidad_maquina: 'muy_util',
          facilidad_maquina: 'muy_facil',
          seguridad_maquina: 'muy_seguro',
        }));
        setIsSubmitting(false);
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'encuestas-satisfaccion',
          operation: 'create',
          requestResourceData: encuestaData
        }));
        setIsSubmitting(false);
      });
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const margin = 20;
    if (logoBase64) doc.addImage(logoBase64, 'PNG', margin, 5, 18, 18);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text("ENCUESTA DE SATISFACCIÓN", 105, 20, { align: "center" });
    let y = 45;
    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.text(`LUGAR: ${formData.lugar_practica.toUpperCase()}`, margin, y); y += 10;
    doc.text(`FECHA: ${formatDateToDDMMYYYY(formData.fecha)}    HORA: ${formData.hora} HS.`, margin, y); y += 10;
    doc.text(`EDAD: ${formData.edad} AÑOS`, margin, y); y += 10;
    doc.save(`Encuesta-${formData.lugar_practica || 'Satisfaccion'}.pdf`);
  };

  if (!isMounted) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      {user ? <Header title="Oficina" /> : (
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-50">
            <div className="flex items-center gap-4">
                <Image src="/logo.png" alt="Logo" width={40} height={40} className="object-contain" />
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-primary leading-none">Justicia Electoral</span>
                    <span className="text-sm font-bold uppercase tracking-tight">Portal Ciudadano</span>
                </div>
            </div>
        </header>
      )}
      <main className="flex-1 p-4 md:p-8">
        
        {user && (
            <div className="mx-auto max-w-3xl mb-6 space-y-4">
                <Card className="border-primary/20 shadow-md">
                    <CardHeader className="py-4 bg-primary/5">
                        <CardTitle className="text-[10px] font-black flex items-center gap-2 uppercase tracking-widest text-primary">
                            <DatabaseZap className="h-4 w-4" /> CARGA INSTITUCIONAL (OFICINA)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="flex gap-2">
                            <Select onValueChange={setInternalSolicitudId} value={internalSolicitudId || undefined}>
                                <SelectTrigger className="h-11 font-bold">
                                    <SelectValue placeholder="Vincular actividad de agenda..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {agendaItems?.map(item => (
                                        <SelectItem key={item.id} value={item.id}>{formatDateToDDMMYYYY(item.fecha)} | {item.lugar_local}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {internalSolicitudId && <Button variant="ghost" size="icon" onClick={() => setInternalSolicitudId(null)}><X className="h-4 w-4" /></Button>}
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}

        <Card className="mx-auto max-w-3xl shadow-2xl border-t-8 border-t-primary rounded-3xl overflow-hidden">
          <CardHeader className="bg-muted/30 border-b p-8">
            <CardTitle className="flex items-center gap-3 uppercase font-black text-primary text-2xl">
              <MessageSquareHeart className="h-8 w-8" />
              Encuesta de Satisfacción
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-10 p-8">
            <div className="grid grid-cols-1 gap-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-primary tracking-widest">LUGAR DE LA PRÁCTICA</Label>
                <Input 
                    name="lugar_practica" 
                    value={formData.lugar_practica} 
                    onChange={handleInputChange} 
                    readOnly={!!effectiveSolicitudId}
                    className="h-14 font-black text-lg border-2 uppercase" 
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">FECHA</Label>
                  <Input name="fecha" type="date" value={formData.fecha} onChange={handleInputChange} readOnly={!!effectiveSolicitudId} className="h-12 font-bold border-2" />
                </div>
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">HORA</Label>
                  <Input name="hora" type="time" value={formData.hora} onChange={handleInputChange} readOnly={!!effectiveSolicitudId} className="h-12 font-bold border-2" />
                </div>
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-primary">TU EDAD (AÑOS)</Label>
                  <Input name="edad" type="number" value={formData.edad} onChange={handleInputChange} className="h-12 font-black text-lg border-2" />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-10">
              <div className="space-y-5">
                <Label className="font-black text-base uppercase text-primary">1. ¿Le parece útil practicar con la máquina?</Label>
                <RadioGroup value={formData.utilidad_maquina} onValueChange={(v) => handleValueChange('utilidad_maquina', v as any)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {['muy_util', 'util', 'poco_util', 'nada_util'].map(val => (
                    <div key={val} className="flex items-center space-x-3 border-2 p-5 rounded-2xl">
                        <RadioGroupItem value={val} id={`u-${val}`} />
                        <Label htmlFor={`u-${val}`} className="font-black text-xs uppercase">{val.replace('_', ' ')}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-4 bg-muted/30 border-t p-8">
            {user && <Button onClick={generatePDF} variant="outline" className="h-16 px-8 border-primary text-primary">PDF OFICIAL</Button>}
            <div className="flex-1" />
            <Button onClick={handleSubmit} disabled={isSubmitting || !formData.edad} className="px-16 h-16 font-black text-xl uppercase shadow-2xl">
              {isSubmitting ? <Loader2 className="animate-spin mr-3 h-7 w-7" /> : "ENVIAR ENCUESTA"}
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
