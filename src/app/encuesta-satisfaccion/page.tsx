
"use client";

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, Lock, DatabaseZap } from 'lucide-react';
import { useUser, useFirebase, useMemoFirebase, useDocOnce, useCollectionOnce, useCollectionPaginated } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { type SolicitudCapacitacion } from '@/lib/data';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn, formatDateToDDMMYYYY } from '@/lib/utils';
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function EncuestaContent() {
  const { user } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  
  const [isMounted, setIsMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [internalSolicitudId, setInternalSolicitudId] = useState<string | null>(null);
  
  const solicitudIdFromUrl = searchParams.get('solicitudId');
  const effectiveSolicitudId = solicitudIdFromUrl || internalSolicitudId;

  const [formData, setFormData] = useState({
    lugar_practica: '',
    fecha: '',
    hora: '',
    edad: '',
    genero: '' as string,
    pueblo_originario: false,
    utilidad_maquina: '' as string,
    facilidad_maquina: '' as string,
    seguridad_maquina: '' as string,
    departamento: '',
    distrito: '',
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const agendaQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'solicitudes-capacitacion'), orderBy('fecha', 'desc'), limit(100));
  }, [firestore, user]);
  const { data: agendaItems } = useCollectionOnce<SolicitudCapacitacion>(agendaQuery);

  const filteredAgendaItems = useMemo(() => {
    if (!agendaItems) return [];
    return [...agendaItems].sort((a: SolicitudCapacitacion, b: SolicitudCapacitacion) => (b.fecha || '').localeCompare(a.fecha || ''));
  }, [agendaItems]);

  const solicitudRef = useMemoFirebase(() => 
    firestore && effectiveSolicitudId ? doc(firestore, 'solicitudes-capacitacion', effectiveSolicitudId) : null,
    [firestore, effectiveSolicitudId]
  );
  
  const { data: linkedSolicitud, isLoading: isLoadingLinked } = useDocOnce<SolicitudCapacitacion>(solicitudRef);

  // VALIDACIÓN: Se bloquea el acceso público si la solicitud no tiene habilitado el QR o si expiró
  const isPublicDisabled = useMemo(() => {
    if (user) return false; // El personal siempre puede cargar
    if (!solicitudIdFromUrl) return false; // Carga manual permitida
    if (isLoadingLinked) return false;
    if (!linkedSolicitud) return false; 
    
    // Si no tiene qr_enabled o ya expiró
    if (!linkedSolicitud.qr_enabled) return true;
    
    if (linkedSolicitud.qr_expires_at) {
        const now = new Date();
        const expiration = new Date(linkedSolicitud.qr_expires_at);
        if (now > expiration) return true;
    }
    
    return false;
  }, [linkedSolicitud, user, solicitudIdFromUrl, isLoadingLinked]);

  useEffect(() => {
    if (linkedSolicitud) {
      setFormData(prev => ({
        ...prev,
        lugar_practica: (linkedSolicitud.lugar_local || '').toUpperCase(),
        fecha: linkedSolicitud.fecha || '',
        hora: linkedSolicitud.hora_desde || '',
        departamento: linkedSolicitud.departamento || '',
        distrito: linkedSolicitud.distrito || '',
      }));
    } else if (!effectiveSolicitudId) {
        setFormData(prev => ({
            ...prev,
            lugar_practica: '',
            fecha: '',
            hora: '',
            departamento: '',
            distrito: '',
        }));
    }
  }, [linkedSolicitud, effectiveSolicitudId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleValueChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    if (!firestore) return;
    
    if (
      !formData.lugar_practica || 
      !formData.fecha || 
      !formData.edad || 
      !formData.genero || 
      !formData.utilidad_maquina || 
      !formData.facilidad_maquina || 
      !formData.seguridad_maquina
    ) {
        toast({ 
          variant: "destructive", 
          title: "Faltan datos obligatorios", 
          description: "Por favor, responda todas las preguntas de la encuesta antes de enviar." 
        });
        return;
    }

    setIsSubmitting(true);
    const encuestaData = {
      ...formData,
      solicitud_id: effectiveSolicitudId || 'CARGA_MANUAL',
      usuario_id: user?.uid || 'CIUDADANO_EXTERNO',
      departamento: formData.departamento || linkedSolicitud?.departamento || '',
      distrito: formData.distrito || linkedSolicitud?.distrito || '',
      fecha_creacion: new Date().toISOString(),
      server_timestamp: serverTimestamp(),
    };

    addDoc(collection(firestore, 'encuestas-satisfaccion'), encuestaData)
      .then(() => {
        toast({ 
          title: "¡Gracias por su participación!", 
          description: "Su opinión ha sido registrada con éxito." 
        });
        
        setFormData(p => ({ 
          ...p, 
          edad: '', 
          genero: '', 
          pueblo_originario: false,
          utilidad_maquina: '',
          facilidad_maquina: '',
          seguridad_maquina: ''
        }));
        
        setIsSubmitting(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
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

  if (!isMounted) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      {!user ? (
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-50">
            <div className="flex items-center gap-4">
                <Image src="/logo.png" alt="Logo" width={40} height={40} className="object-contain" />
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-primary leading-none">Justicia Electoral</span>
                    <span className="text-sm font-bold uppercase tracking-tight">Portal Ciudadano</span>
                </div>
            </div>
        </header>
      ) : (
        <Header title="Anexo II - Encuesta de Satisfacción" />
      )}
      
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          
          {isPublicDisabled && (
            <Card className="p-16 text-center border-dashed rounded-[2.5rem] bg-white space-y-6 animate-in zoom-in duration-500">
                <Lock className="h-20 w-20 mx-auto text-muted-foreground opacity-30" />
                <div className="space-y-2">
                    <h2 className="text-2xl font-black uppercase text-primary">Encuesta no habilitada</h2>
                    <p className="text-sm text-muted-foreground font-bold uppercase tracking-tight leading-relaxed max-w-sm mx-auto">
                        El acceso público a este formulario ha sido desactivado temporalmente por el personal responsable.
                    </p>
                </div>
            </Card>
          )}

          {!isPublicDisabled && (
            <>
              {user && !solicitudIdFromUrl && (
                <Card className="border-primary/20 shadow-md">
                    <CardHeader className="py-4 bg-primary/5">
                        <CardTitle className="text-[10px] font-black flex items-center gap-2 uppercase tracking-widest text-primary">
                            <DatabaseZap className="h-4 w-4" /> VINCULAR ACTIVIDAD
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <Select onValueChange={setInternalSolicitudId} value={internalSolicitudId || undefined}>
                            <SelectTrigger className="h-11 font-bold">
                                <SelectValue placeholder="Seleccione la actividad agendada..." />
                            </SelectTrigger>
                            <SelectContent>
                                {filteredAgendaItems.length === 0 ? (
                                    <div className="p-4 text-center text-xs font-bold text-muted-foreground uppercase">No hay actividades agendadas</div>
                                ) : (
                                    filteredAgendaItems.map(item => (
                                        <SelectItem key={item.id} value={item.id}>
                                            {formatDateToDDMMYYYY(item.fecha)} | {item.lugar_local}
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>
              )}

              <Card className="shadow-2xl border-none rounded-[2.5rem] overflow-hidden bg-white">
                <CardHeader className="bg-white border-b p-8 md:p-12">
                <div className="flex items-start gap-6">
                    <Image src="/logo.png" alt="Logo TSJE" width={70} height={70} className="object-contain shrink-0" />
                    <div className="space-y-1">
                        <h1 className="text-2xl md:text-3xl font-black uppercase text-[#1A1A1A] leading-tight">ANEXO II - ENCUESTA DE SATISFACCIÓN</h1>
                        <h2 className="text-lg font-black uppercase text-muted-foreground tracking-tight">PRÁCTICA CON LA MÁQUINA DE VOTACIÓN</h2>
                    </div>
                </div>
                </CardHeader>

                <CardContent className="p-8 md:p-12 space-y-16">
                
                <div className={cn("p-10 border-[3px] border-black rounded-[2.5rem] space-y-12 bg-white relative", isLoadingLinked && "opacity-50")}>
                    {isLoadingLinked && (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        </div>
                    )}
                    
                    <div className="space-y-2">
                        <Label className="text-[11px] font-black uppercase text-[#1A1A1A] tracking-[0.1em]">LUGAR DONDE REALIZÓ LA PRÁCTICA:</Label>
                        <Input 
                            name="lugar_practica" 
                            value={formData.lugar_practica} 
                            onChange={handleInputChange} 
                            readOnly={!!effectiveSolicitudId}
                            placeholder="__________________________________________________________"
                            className="h-14 font-black text-xl border-x-0 border-t-0 border-b-[3px] rounded-none border-black focus-visible:ring-0 px-0 uppercase bg-transparent" 
                        />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="space-y-2">
                            <Label className="text-[11px] font-black uppercase text-[#1A1A1A] tracking-[0.1em]">FECHA:</Label>
                            <Input 
                                name="fecha" 
                                type={effectiveSolicitudId ? "text" : "date"}
                                value={effectiveSolicitudId ? formatDateToDDMMYYYY(formData.fecha) : formData.fecha} 
                                onChange={handleInputChange} 
                                readOnly={!!effectiveSolicitudId}
                                className="h-14 font-black text-xl border-x-0 border-t-0 border-b-[3px] rounded-none border-black focus-visible:ring-0 px-0 bg-transparent" 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[11px] font-black uppercase text-[#1A1A1A] tracking-[0.1em]">HORA:</Label>
                            <Input 
                                name="hora" 
                                type={effectiveSolicitudId ? "text" : "time"}
                                value={formData.hora} 
                                onChange={handleInputChange} 
                                readOnly={!!effectiveSolicitudId}
                                className="h-14 font-black text-xl border-x-0 border-t-0 border-b-[3px] rounded-none border-black focus-visible:ring-0 px-0 bg-transparent" 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 items-start">
                        <div className="space-y-2">
                            <Label className="text-[11px] font-black uppercase text-[#1A1A1A] tracking-[0.1em]">EDAD (AÑOS):</Label>
                            <Input name="edad" type="number" value={formData.edad} onChange={handleInputChange} className="h-14 font-black text-xl border-x-0 border-t-0 border-b-[3px] rounded-none border-black focus-visible:ring-0 px-0 bg-transparent" />
                        </div>
                        <div className="md:col-span-2 space-y-8 pt-1">
                            <div className="flex flex-wrap gap-8 items-center">
                                <Label className="text-[11px] font-black uppercase text-[#1A1A1A] tracking-[0.1em] shrink-0">GÉNERO:</Label>
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center space-x-3 cursor-pointer" onClick={() => handleValueChange('genero', 'hombre')}>
                                        <div className={cn("h-7 w-7 border-[3px] border-black rounded-lg flex items-center justify-center transition-colors", formData.genero === 'hombre' ? "bg-black text-white" : "bg-white")}>
                                            {formData.genero === 'hombre' && <Check className="h-5 w-5 stroke-[4]" />}
                                        </div>
                                        <span className="font-black text-xs uppercase">HOMBRE</span>
                                    </div>
                                    <div className="flex items-center space-x-3 cursor-pointer" onClick={() => handleValueChange('genero', 'mujer')}>
                                        <div className={cn("h-7 w-7 border-[3px] border-black rounded-lg flex items-center justify-center transition-colors", formData.genero === 'mujer' ? "bg-black text-white" : "bg-white")}>
                                            {formData.genero === 'mujer' && <Check className="h-5 w-5 stroke-[4]" />}
                                        </div>
                                        <span className="font-black text-xs uppercase">MUJER</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setFormData(p => ({...p, pueblo_originario: !p.pueblo_originario}))}>
                                <div className={cn("h-7 w-7 border-[3px] border-black rounded-lg flex items-center justify-center transition-colors", formData.pueblo_originario ? "bg-black text-white" : "bg-white")}>
                                    {formData.pueblo_originario && <Check className="h-5 w-5 stroke-[4]" />}
                                </div>
                                <span className="font-black text-[11px] uppercase tracking-[0.1em] text-[#1A1A1A]">PUEBLO ORIGINARIO</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-16">
                    <div className="space-y-8">
                    <Label className="font-black text-lg md:text-xl uppercase text-[#1A1A1A] leading-tight">1. ¿Le parece útil practicar con la máquina de votación?</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {['muy_util', 'util', 'poco_util', 'nada_util'].map(val => (
                        <div key={val} className="flex items-center space-x-4 cursor-pointer group" onClick={() => handleValueChange('utilidad_maquina', val as any)}>
                            <div className={cn("h-7 w-7 border-[3px] border-black rounded-lg flex items-center justify-center transition-all group-hover:scale-110", formData.utilidad_maquina === val ? "bg-black text-white" : "bg-white")}>
                                {formData.utilidad_maquina === val && <Check className="h-5 w-5 stroke-[4]" />}
                            </div>
                            <Label className="font-black text-xs uppercase cursor-pointer group-hover:text-primary transition-colors">{val.replace('_', ' ')}</Label>
                        </div>
                        ))}
                    </div>
                    </div>

                    <div className="space-y-8">
                    <Label className="font-black text-lg md:text-xl uppercase text-[#1A1A1A] leading-tight">2. ¿Le resultó fácil usar la máquina de votación?</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {['muy_facil', 'facil', 'poco_facil', 'nada_facil'].map(val => (
                        <div key={val} className="flex items-center space-x-4 cursor-pointer group" onClick={() => handleValueChange('facilidad_maquina', val as any)}>
                            <div className={cn("h-7 w-7 border-[3px] border-black rounded-lg flex items-center justify-center transition-all group-hover:scale-110", formData.facilidad_maquina === val ? "bg-black text-white" : "bg-white")}>
                                {formData.facilidad_maquina === val && <Check className="h-5 w-5 stroke-[4]" />}
                            </div>
                            <Label className="font-black text-xs uppercase cursor-pointer group-hover:text-primary transition-colors">{val.replace('_', ' ')}</Label>
                        </div>
                        ))}
                    </div>
                    </div>

                    <div className="space-y-8">
                    <Label className="font-black text-lg md:text-xl uppercase text-[#1A1A1A] leading-tight">3. Después de la práctica, ¿qué tan seguro/a se siente para utilizar la máquina de votación?</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {['muy_seguro', 'seguro', 'poco_seguro', 'nada_seguro'].map(val => (
                        <div key={val} className="flex items-center space-x-4 cursor-pointer group" onClick={() => handleValueChange('seguridad_maquina', val as any)}>
                            <div className={cn("h-7 w-7 border-[3px] border-black rounded-lg flex items-center justify-center transition-all group-hover:scale-110", formData.seguridad_maquina === val ? "bg-black text-white" : "bg-white")}>
                                {formData.seguridad_maquina === val && <Check className="h-5 w-5 stroke-[4]" />}
                            </div>
                            <Label className="font-black text-xs uppercase cursor-pointer group-hover:text-primary transition-colors">{val.replace('_', ' ')}/A</Label>
                        </div>
                        ))}
                    </div>
                    </div>
                </div>
                </CardContent>

                <CardFooter className="flex flex-col sm:flex-row gap-6 bg-muted/30 border-t p-10 md:p-12">
                <Button onClick={handleSubmit} disabled={isSubmitting || !formData.edad} className="w-full h-20 font-black text-2xl uppercase shadow-2xl bg-black hover:bg-black/90 text-white rounded-[1.5rem] tracking-wider">
                    {isSubmitting ? <Loader2 className="animate-spin mr-4 h-8 w-8" /> : "ENVIAR MI OPINIÓN"}
                </Button>
                </CardFooter>
              </Card>
            </>
          )}
        </div>
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
