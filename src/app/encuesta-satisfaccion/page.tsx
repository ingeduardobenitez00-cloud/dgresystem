
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
  
  // Capturamos el ID de la solicitud desde la URL (vía QR)
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

  // Referencia al documento de la agenda (sea por URL o por selección interna)
  const solicitudRef = useMemoFirebase(() => 
    firestore && effectiveSolicitudId ? doc(firestore, 'solicitudes-capacitacion', effectiveSolicitudId) : null,
    [firestore, effectiveSolicitudId]
  );
  
  const { data: linkedSolicitud, isLoading: isLoadingLinked } = useDoc<SolicitudCapacitacion>(solicitudRef);

  // Consultar actividades para usuarios logueados (para vincular manual)
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

  const { data: agendaItems, isLoading: isLoadingAgenda } = useCollection<SolicitudCapacitacion>(agendaQuery);

  // Sincronización de datos vinculados
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
    } else if (!effectiveSolicitudId) {
        // Solo limpiar si NO hay ID efectivo, permitiendo carga manual limpia
        setFormData(prev => ({
            ...prev,
            lugar_practica: user?.profile?.role === 'funcionario' ? (prev.lugar_practica || '') : prev.lugar_practica,
            departamento: user?.profile?.departamento || prev.departamento,
            distrito: user?.profile?.distrito || prev.distrito,
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

  const handleSubmit = async () => {
    if (!firestore) return;
    if (!formData.lugar_practica || !formData.fecha || !formData.edad) {
        toast({ variant: "destructive", title: "Faltan datos", description: "Por favor complete los campos obligatorios (Lugar, Fecha, Edad)." });
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

    try {
      await addDoc(collection(firestore, 'encuestas-satisfaccion'), encuestaData);
      toast({ title: "¡Gracias!", description: "Feedback registrado exitosamente." });
      // Reset parcial para permitir seguir cargando documentos físicos si es funcionario
      setFormData(p => ({ 
        ...p, 
        edad: '', 
        genero: 'hombre',
        pueblo_originario: false,
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
    const generoLabel = formData.genero === 'hombre' ? 'HOMBRE' : 'MUJER';
    doc.text(`GÉNERO: ${generoLabel}`, margin, y); y += 8;
    doc.text(`¿PERTENECE A PUEBLO ORIGINARIO?: ${formData.pueblo_originario ? 'SÍ' : 'NO'}`, margin, y); y += 15;
    
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

  if (!isMounted) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      {user ? <Header title="Encuesta de Satisfacción" /> : (
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-50">
            <div className="flex items-center gap-4">
                <Image src="/logo.png" alt="Logo" width={40} height={40} className="object-contain" />
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-primary leading-none">Justicia Electoral</span>
                    <span className="text-sm font-bold uppercase tracking-tight">Portal Ciudadano</span>
                </div>
            </div>
            {solicitudIdFromUrl && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1.5 px-3 py-1 font-black text-[9px] uppercase">
                    {isLoadingLinked ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                    {isLoadingLinked ? 'Sincronizando...' : 'Sesión Vinculada'}
                </Badge>
            )}
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
                        <div className="space-y-4">
                            <Label className="text-[9px] font-black uppercase text-muted-foreground">Vincular a Actividad de Agenda (Opcional)</Label>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <Select 
                                        onValueChange={setInternalSolicitudId} 
                                        value={internalSolicitudId || undefined}
                                    >
                                        <SelectTrigger className="h-11 font-bold">
                                            <SelectValue placeholder="Seleccione actividad para auto-completar..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {agendaItems?.map(item => (
                                                <SelectItem key={item.id} value={item.id}>
                                                    {formatDateToDDMMYYYY(item.fecha)} | {item.lugar_local}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {internalSolicitudId && (
                                    <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setInternalSolicitudId(null)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                            {!internalSolicitudId && !solicitudIdFromUrl && (
                                <p className="text-[9px] font-bold text-amber-600 uppercase italic">
                                    * Carga manual habilitada para documentos físicos sin conexión previa.
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}

        {(solicitudIdFromUrl || internalSolicitudId) && linkedSolicitud && (
            <div className="mx-auto max-w-3xl mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="bg-primary text-white p-5 rounded-2xl shadow-xl flex items-center gap-5 border-4 border-white">
                    <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                        <Globe className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black uppercase opacity-70 tracking-widest mb-1">Actividad Detectada:</p>
                        <p className="text-xl font-black uppercase leading-tight truncate">{linkedSolicitud.lugar_local}</p>
                        <div className="flex items-center gap-3 mt-1.5 opacity-80">
                            <span className="text-[10px] font-bold uppercase">{linkedSolicitud.distrito} - {linkedSolicitud.departamento}</span>
                        </div>
                    </div>
                </div>
            </div>
        )}

        <Card className="mx-auto max-w-3xl shadow-2xl border-t-8 border-t-primary rounded-3xl overflow-hidden">
          <CardHeader className="bg-muted/30 border-b p-8">
            <CardTitle className="flex items-center gap-3 uppercase font-black text-primary text-2xl">
              <MessageSquareHeart className="h-8 w-8" />
              Encuesta de Satisfacción
            </CardTitle>
            <CardDescription className="text-xs font-bold uppercase mt-2">
                Su opinión es fundamental para fortalecer la democracia paraguaya.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-10 p-8">
            
            <div className="grid grid-cols-1 gap-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" /> LUGAR DE LA PRÁCTICA
                </Label>
                <div className="relative group">
                  <Input 
                    name="lugar_practica" 
                    value={formData.lugar_practica} 
                    onChange={handleInputChange} 
                    readOnly={!!effectiveSolicitudId}
                    placeholder={effectiveSolicitudId ? "Cargando lugar..." : "Nombre del local o institución"}
                    className={cn(
                        "h-14 font-black text-lg border-2 transition-all uppercase", 
                        effectiveSolicitudId ? "bg-muted/50 border-primary/20 text-primary cursor-not-allowed" : "border-muted group-hover:border-primary/40"
                    )} 
                  />
                  {formData.lugar_practica && <CheckCircle2 className="absolute right-4 top-4 h-6 w-6 text-green-500" />}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" /> FECHA
                  </Label>
                  <Input 
                    name="fecha" 
                    type="date" 
                    value={formData.fecha} 
                    onChange={handleInputChange} 
                    readOnly={!!effectiveSolicitudId} 
                    className={cn(
                        "h-12 font-bold border-2",
                        effectiveSolicitudId ? "bg-muted/50 border-primary/10 cursor-not-allowed" : ""
                    )}
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" /> HORA
                  </Label>
                  <Input 
                    name="hora" 
                    type="time" 
                    value={formData.hora} 
                    onChange={handleInputChange} 
                    readOnly={!!effectiveSolicitudId} 
                    className={cn(
                        "h-12 font-bold border-2",
                        effectiveSolicitudId ? "bg-muted/50 border-primary/10 cursor-not-allowed" : ""
                    )}
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-primary tracking-widest">TU EDAD (AÑOS)</Label>
                  <Input name="edad" type="number" value={formData.edad} onChange={handleInputChange} placeholder="00" className="h-12 font-black text-lg border-2 border-primary/20" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase text-primary tracking-widest">IDENTIDAD DE GÉNERO</Label>
                  <RadioGroup value={formData.genero} onValueChange={(v) => handleValueChange('genero', v as any)} className="grid grid-cols-2 gap-4">
                    {[
                      { id: 'hombre', label: 'HOMBRE' },
                      { id: 'mujer', label: 'MUJER' }
                    ].map(item => (
                      <div key={item.id} className="flex items-center space-x-3 p-4 bg-muted/20 rounded-xl border-2 border-dashed border-muted hover:border-primary/40 transition-colors">
                          <RadioGroupItem value={item.id} id={`g-${item.id}`} className="h-5 w-5" />
                          <Label htmlFor={`g-${item.id}`} className="font-bold text-[10px] cursor-pointer uppercase">{item.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase text-primary tracking-widest">PERTENENCIA</Label>
                  <div className="flex items-center space-x-3 p-4 bg-muted/20 rounded-xl border-2 border-dashed border-muted hover:border-primary/40 transition-colors h-[60px]">
                      <Checkbox 
                        id="pueblo-originario" 
                        checked={formData.pueblo_originario} 
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, pueblo_originario: !!checked }))}
                        className="h-6 w-6"
                      />
                      <Label htmlFor="pueblo-originario" className="font-bold text-[10px] cursor-pointer uppercase">¿PERTENECE A PUEBLO ORIGINARIO?</Label>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="h-1 bg-muted/30" />

            <div className="space-y-10">
              <div className="space-y-5">
                <Label className="font-black text-base uppercase tracking-tight text-primary block leading-tight">
                    1. ¿Le parece útil practicar con la máquina de votación antes de las elecciones?
                </Label>
                <RadioGroup value={formData.utilidad_maquina} onValueChange={(v) => handleValueChange('utilidad_maquina', v as any)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {['muy_util', 'util', 'poco_util', 'nada_util'].map(val => (
                    <div key={val} className="flex items-center space-x-3 border-2 p-5 rounded-2xl hover:bg-primary/5 transition-all cursor-pointer data-[state=checked]:border-primary data-[state=checked]:bg-primary/5">
                        <RadioGroupItem value={val} id={`u-${val}`} className="h-5 w-5" />
                        <Label htmlFor={`u-${val}`} className="flex-1 font-black text-xs cursor-pointer uppercase">{val.replace('_', ' ')}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-5">
                <Label className="font-black text-base uppercase tracking-tight text-primary block leading-tight">
                    2. ¿Le resultó fácil utilizar la máquina de votación electrónica?
                </Label>
                <RadioGroup value={formData.facilidad_maquina} onValueChange={(v) => handleValueChange('facilidad_maquina', v as any)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {['muy_facil', 'facil', 'poco_facil', 'nada_facil'].map(val => (
                    <div key={val} className="flex items-center space-x-3 border-2 p-5 rounded-2xl hover:bg-primary/5 transition-all cursor-pointer data-[state=checked]:border-primary data-[state=checked]:bg-primary/5">
                        <RadioGroupItem value={val} id={`f-${val}`} className="h-5 w-5" />
                        <Label htmlFor={`f-${val}`} className="flex-1 font-black text-xs cursor-pointer uppercase">{val.replace('_', ' ')}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-5">
                <Label className="font-black text-base uppercase tracking-tight text-primary block leading-tight">
                    3. Después de la práctica, ¿qué tan seguro/a se siente para utilizar la máquina?
                </Label>
                <RadioGroup value={formData.seguridad_maquina} onValueChange={(v) => handleValueChange('seguridad_maquina', v as any)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {['muy_seguro', 'seguro', 'poco_seguro', 'nada_seguro'].map(val => (
                    <div key={val} className="flex items-center space-x-3 border-2 p-5 rounded-2xl hover:bg-primary/5 transition-all cursor-pointer data-[state=checked]:border-primary data-[state=checked]:bg-primary/5">
                        <RadioGroupItem value={val} id={`s-${val}`} className="h-5 w-5" />
                        <Label htmlFor={`s-${val}`} className="flex-1 font-black text-xs cursor-pointer uppercase">{val.replace('_', ' ')}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>

            <div className="mt-12 border-4 border-primary/10 p-8 rounded-3xl bg-muted/10 relative">
                <div className="absolute -top-4 left-8 bg-primary text-white px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
                    Uso Interno Institucional
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Distrito Registrado:</span>
                        <span className="font-black text-lg uppercase text-primary border-b-2 border-primary/20 pb-1">{formData.distrito || '---'}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Departamento:</span>
                        <span className="font-black text-lg uppercase text-primary border-b-2 border-primary/20 pb-1">{formData.departamento || '---'}</span>
                    </div>
                </div>
                <p className="mt-6 text-[9px] font-bold text-muted-foreground uppercase text-center italic">
                    Este documento debe ser remitido a la oficina del CIDEE central al finalizar la jornada.
                </p>
            </div>

          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-4 bg-muted/30 border-t p-8">
            {user && (
                <Button onClick={generatePDF} variant="outline" className="w-full sm:w-auto font-black h-16 px-8 border-primary text-primary hover:bg-white shadow-sm">
                    <FileDown className="mr-2 h-5 w-5" /> PDF OFICIAL
                </Button>
            )}
            <div className="flex-1" />
            <Button onClick={handleSubmit} disabled={isSubmitting || !formData.edad} className="w-full sm:w-auto px-16 h-16 font-black text-xl uppercase shadow-2xl hover:scale-[1.02] transition-transform">
              {isSubmitting ? <><Loader2 className="animate-spin mr-3 h-7 w-7" /> ENVIANDO...</> : <><CheckCircle2 className="mr-3 h-7 w-7" /> ENVIAR ENCUESTA</>}
            </Button>
          </CardFooter>
        </Card>
        
        <div className="mt-12 text-center pb-8">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Justicia Electoral - República del Paraguay</p>
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
