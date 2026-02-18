
"use client";

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  ArrowLeftRight, 
  CheckCircle2, 
  FileDown, 
  CalendarDays, 
  Truck, 
  Undo2, 
  Camera, 
  Trash2, 
  ShieldAlert,
  Clock,
  MapPin,
  Lock
} from 'lucide-react';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where, doc, updateDoc, setDoc } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';
import jsPDF from 'jspdf';
import { type SolicitudCapacitacion, type MovimientoMaquina } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import Image from 'next/image';

export default function ControlMovimientoMaquinasPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [selectedSolicitudId, setSelectedSolicitudId] = useState<string | null>(null);
  
  // States for forms
  const [salidaFirma, setSalidaFirma] = useState<string | null>(null);
  const [devolucionFirma, setDevolucionFirma] = useState<string | null>(null);
  const [salidaData, setSalidaData] = useState({
    codigo_maquina: '',
    fecha: new Date().toISOString().split('T')[0],
    hora: new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false }),
  });
  const [devolucionData, setDevolucionData] = useState({
    codigo_maquina: '',
    fecha: new Date().toISOString().split('T')[0],
    hora: new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false }),
  });

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

  // Fetch Agenda Items for current district
  const agendaQuery = useMemoFirebase(() => {
    if (!firestore || !user?.profile?.distrito) return null;
    return query(
      collection(firestore, 'solicitudes-capacitacion'),
      where('departamento', '==', user.profile.departamento),
      where('distrito', '==', user.profile.distrito)
    );
  }, [firestore, user]);

  const { data: agendaItems, isLoading: isLoadingAgenda } = useCollection<SolicitudCapacitacion>(agendaQuery);

  // Fetch existing movement for selected activity
  const movimientosQuery = useMemoFirebase(() => {
    if (!firestore || !selectedSolicitudId) return null;
    return query(
      collection(firestore, 'movimientos-maquinas'),
      where('solicitud_id', '==', selectedSolicitudId)
    );
  }, [firestore, selectedSolicitudId]);

  const { data: movimientosData, isLoading: isLoadingMovimientos } = useCollection<MovimientoMaquina>(movimientosQuery);
  const currentMovimiento = movimientosData && movimientosData.length > 0 ? movimientosData[0] : null;

  const selectedSolicitud = useMemo(() => {
    return agendaItems?.find(item => item.id === selectedSolicitudId);
  }, [agendaItems, selectedSolicitudId]);

  // Logic to enable Return form: after event end time
  const isDevolucionEnabled = useMemo(() => {
    if (!selectedSolicitud) return false;
    const eventEnd = new Date(`${selectedSolicitud.fecha}T${selectedSolicitud.hora_hasta}`);
    const now = new Date();
    return now >= eventEnd;
  }, [selectedSolicitud]);

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>, type: 'salida' | 'devolucion') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'salida') setSalidaFirma(reader.result as string);
        else setDevolucionFirma(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveSalida = async () => {
    if (!firestore || !user || !selectedSolicitud) return;
    if (!salidaData.codigo_maquina || !salidaFirma) {
      toast({ variant: 'destructive', title: 'Faltan datos', description: 'Ingrese el código de máquina y la firma.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const registro = {
        nombre: selectedSolicitud.divulgador_nombre || user.profile?.username || '',
        cedula: selectedSolicitud.divulgador_cedula || user.profile?.cedula || '',
        vinculo: selectedSolicitud.divulgador_vinculo || user.profile?.vinculo || '',
        fecha: salidaData.fecha,
        hora: salidaData.hora,
        codigo_maquina: salidaData.codigo_maquina,
        lugar: selectedSolicitud.lugar_local,
        firma: salidaFirma,
      };

      const movimientoData = {
        solicitud_id: selectedSolicitudId!,
        departamento: user.profile?.departamento || '',
        distrito: user.profile?.distrito || '',
        salida: registro,
        fecha_creacion: new Date().toISOString(),
      };

      await addDoc(collection(firestore, 'movimientos-maquinas'), movimientoData);
      toast({ title: '¡Salida Registrada!', description: 'El retiro de la máquina ha sido guardado.' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la salida.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDevolucion = async () => {
    if (!firestore || !user || !selectedSolicitud || !currentMovimiento) return;
    if (!devolucionFirma) {
      toast({ variant: 'destructive', title: 'Falta firma', description: 'Por favor capture la firma de devolución.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const registro = {
        nombre: selectedSolicitud.divulgador_nombre || user.profile?.username || '',
        cedula: selectedSolicitud.divulgador_cedula || user.profile?.cedula || '',
        vinculo: selectedSolicitud.divulgador_vinculo || user.profile?.vinculo || '',
        fecha: devolucionData.fecha,
        hora: devolucionData.hora,
        codigo_maquina: currentMovimiento.salida?.codigo_maquina || '',
        lugar: selectedSolicitud.lugar_local,
        firma: devolucionFirma,
      };

      await updateDoc(doc(firestore, 'movimientos-maquinas', currentMovimiento.id), {
        devolucion: registro
      });
      toast({ title: '¡Devolución Registrada!', description: 'El retorno de la máquina ha sido guardado exitosamente.' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la devolución.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const generatePDF = (type: 'salida' | 'devolucion') => {
    const data = type === 'salida' ? currentMovimiento?.salida : currentMovimiento?.devolucion;
    if (!data || !logoBase64) return;

    const doc = new jsPDF();
    const margin = 20;
    
    doc.addImage(logoBase64, 'PNG', margin, 10, 20, 20);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text("JUSTICIA ELECTORAL", 105, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text(type === 'salida' ? "FORMULARIO 01: SALIDA DE MÁQUINA" : "FORMULARIO 02: DEVOLUCIÓN DE MÁQUINA", 105, 28, { align: "center" });

    let y = 50;
    const addLine = (label: string, value: string) => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${label}:`, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value?.toUpperCase() || '', margin + 60, y);
      doc.line(margin + 60, y + 1, 190, y + 1);
      y += 12;
    };

    addLine("FUNCIONARIO RESPONSABLE", data.nombre);
    addLine("NÚMERO DE CÉDULA", data.cedula);
    addLine("VÍNCULO", data.vinculo);
    addLine("FECHA", data.fecha);
    addLine("HORA DE " + (type === 'salida' ? 'SALIDA' : 'DEVOLUCIÓN'), data.hora);
    addLine("CÓDIGO MÁQUINA", data.codigo_maquina);
    addLine("LUGAR DE DIVULGACIÓN", data.lugar);

    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.text("FIRMA DEL FUNCIONARIO:", margin, y);
    if (data.firma) {
      doc.addImage(data.firma, 'JPEG', margin + 60, y - 5, 60, 30);
    }

    y += 50;
    doc.setFontSize(10);
    doc.text("__________________________", 55, y, { align: "center" });
    doc.text("Firma y Aclaración", 55, y + 5, { align: "center" });
    doc.text("__________________________", 155, y, { align: "center" });
    doc.text("Sello y Firma Jefatura", 155, y + 5, { align: "center" });

    doc.save(`${type.toUpperCase()}-${data.cedula}.pdf`);
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <Header title="Control de Movimiento de Máquinas" />
      <main className="flex-1 p-4 md:p-8">
        
        {/* Activity Selection */}
        <div className="mx-auto max-w-5xl mb-8">
          <Card className="border-primary/20 shadow-md">
            <CardHeader className="bg-primary/5">
              <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-widest text-primary">
                <CalendarDays className="h-4 w-4" />
                VINCULAR CON ACTIVIDAD DE LA AGENDA
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <Select onValueChange={setSelectedSolicitudId} value={selectedSolicitudId || undefined}>
                <SelectTrigger className="h-12 border-2">
                  <SelectValue placeholder={isLoadingAgenda ? "Cargando actividades..." : "Seleccione la capacitación o divulgación programada..."} />
                </SelectTrigger>
                <SelectContent>
                  {agendaItems?.map(item => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.fecha} | {item.lugar_local} ({item.solicitante_entidad})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSolicitud && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border border-dashed">
                  <div className="flex items-center gap-3">
                    <Truck className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Funcionario Asignado</p>
                      <p className="text-sm font-bold uppercase">{selectedSolicitud.divulgador_nombre || 'No asignado en agenda'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Horario del Evento</p>
                      <p className="text-sm font-bold uppercase">{selectedSolicitud.hora_desde} a {selectedSolicitud.hora_hasta} HS</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {selectedSolicitudId && !isLoadingMovimientos && (
          <div className="mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* FORM 01: SALIDA */}
            <Card className={cn(
              "shadow-xl border-t-4 transition-all duration-500",
              currentMovimiento ? "border-t-green-500" : "border-t-primary"
            )}>
              <CardHeader className={cn(currentMovimiento ? "bg-green-50" : "bg-primary/5")}>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="h-6 w-6 text-primary" />
                    <span>FORMULARIO 01: SALIDA</span>
                  </div>
                  {currentMovimiento && <CheckCircle2 className="h-6 w-6 text-green-600" />}
                </CardTitle>
                <CardDescription>Registro de retiro de máquina del Registro Electoral.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-black text-muted-foreground">Fecha Salida</Label>
                      <Input value={currentMovimiento?.salida?.fecha || salidaData.fecha} readOnly className="bg-muted/50 font-bold" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-black text-muted-foreground">Hora Salida</Label>
                      <Input value={currentMovimiento?.salida?.hora || salidaData.hora} readOnly className="bg-muted/50 font-bold" />
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-black text-primary">Código Máquina de Votación</Label>
                    <Input 
                      placeholder="Ingrese el número de serie o código..." 
                      className="font-black text-lg border-2 uppercase"
                      value={currentMovimiento?.salida?.codigo_maquina || salidaData.codigo_maquina}
                      onChange={(e) => setSalidaData(p => ({...p, codigo_maquina: e.target.value}))}
                      disabled={!!currentMovimiento}
                    />
                  </div>

                  <div className="p-4 bg-muted/20 rounded-lg border space-y-3">
                    <Label className="text-xs font-bold uppercase flex items-center gap-2">
                      <Lock className="h-3 w-3" /> Firma del Funcionario que retira
                    </Label>
                    {currentMovimiento?.salida?.firma || salidaFirma ? (
                      <div className="relative aspect-[3/1] bg-white rounded border overflow-hidden">
                        <Image src={currentMovimiento?.salida?.firma || salidaFirma!} alt="Firma" fill className="object-contain" />
                        {!currentMovimiento && (
                          <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full" onClick={() => setSalidaFirma(null)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ) : (
                      <label htmlFor="capture-salida" className="flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-white transition-colors">
                        <Camera className="h-6 w-6 text-muted-foreground mb-1" />
                        <span className="text-[10px] font-bold text-muted-foreground">CAPTURAR FIRMA</span>
                        <Input id="capture-salida" type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoCapture(e, 'salida')} />
                      </label>
                    )}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/10 border-t p-4 flex flex-col gap-3">
                {!currentMovimiento ? (
                  <Button className="w-full h-12 font-bold" onClick={handleSaveSalida} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : "REGISTRAR SALIDA"}
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full h-12 font-bold border-primary text-primary" onClick={() => generatePDF('salida')}>
                    <FileDown className="mr-2 h-5 w-5" /> DESCARGAR FORMULARIO 01
                  </Button>
                )}
              </CardFooter>
            </Card>

            {/* FORM 02: DEVOLUCIÓN */}
            <Card className={cn(
              "shadow-xl border-t-4 transition-all duration-500",
              currentMovimiento?.devolucion ? "border-t-green-500" : "border-t-orange-500",
              (!currentMovimiento || !isDevolucionEnabled) && "opacity-60 grayscale"
            )}>
              <CardHeader className={cn(currentMovimiento?.devolucion ? "bg-green-50" : "bg-orange-50")}>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Undo2 className="h-6 w-6 text-orange-600" />
                    <span>FORMULARIO 02: DEVOLUCIÓN</span>
                  </div>
                  {currentMovimiento?.devolucion && <CheckCircle2 className="h-6 w-6 text-green-600" />}
                </CardTitle>
                <CardDescription>Registro de retorno del equipo al resguardo oficial.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                {!isDevolucionEnabled && !currentMovimiento?.devolucion ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
                    <Lock className="h-12 w-12 text-muted-foreground opacity-30" />
                    <div className="space-y-1">
                      <p className="text-sm font-black uppercase text-muted-foreground">Bloqueado temporalmente</p>
                      <p className="text-[10px] text-muted-foreground">La devolución se habilitará al finalizar el evento ({selectedSolicitud.hora_hasta} HS).</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-black text-muted-foreground">Fecha Devolución</Label>
                        <Input value={currentMovimiento?.devolucion?.fecha || devolucionData.fecha} readOnly className="bg-muted/50 font-bold" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-black text-muted-foreground">Hora Devolución</Label>
                        <Input value={currentMovimiento?.devolucion?.hora || devolucionData.hora} readOnly className="bg-muted/50 font-bold" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-black text-orange-600">Código Máquina (Confirmado)</Label>
                      <Input value={currentMovimiento?.salida?.codigo_maquina || ''} readOnly className="bg-muted font-black text-lg border-orange-200" />
                    </div>

                    <div className="p-4 bg-muted/20 rounded-lg border space-y-3">
                      <Label className="text-xs font-bold uppercase flex items-center gap-2">
                        <Lock className="h-3 w-3" /> Firma del Funcionario que devuelve
                      </Label>
                      {currentMovimiento?.devolucion?.firma || devolucionFirma ? (
                        <div className="relative aspect-[3/1] bg-white rounded border overflow-hidden">
                          <Image src={currentMovimiento?.devolucion?.firma || devolucionFirma!} alt="Firma" fill className="object-contain" />
                          {!currentMovimiento?.devolucion && (
                            <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full" onClick={() => setDevolucionFirma(null)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        <label htmlFor="capture-devolucion" className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-orange-200 rounded-lg cursor-pointer hover:bg-white transition-colors">
                          <Camera className="h-6 w-6 text-orange-400 mb-1" />
                          <span className="text-[10px] font-bold text-orange-400">CAPTURAR FIRMA</span>
                          <Input id="capture-devolucion" type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoCapture(e, 'devolucion')} />
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="bg-muted/10 border-t p-4 flex flex-col gap-3">
                {currentMovimiento && !currentMovimiento.devolucion ? (
                  <Button className="w-full h-12 font-bold bg-orange-600 hover:bg-orange-700" onClick={handleSaveDevolucion} disabled={isSubmitting || !isDevolucionEnabled}>
                    {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : "REGISTRAR DEVOLUCIÓN"}
                  </Button>
                ) : currentMovimiento?.devolucion ? (
                  <Button variant="outline" className="w-full h-12 font-bold border-orange-600 text-orange-600" onClick={() => generatePDF('devolucion')}>
                    <FileDown className="mr-2 h-5 w-5" /> DESCARGAR FORMULARIO 02
                  </Button>
                ) : (
                  <Button disabled className="w-full h-12 font-bold">DEVOLUCIÓN PENDIENTE</Button>
                )}
              </CardFooter>
            </Card>

          </div>
        )}

        {!selectedSolicitudId && (
          <div className="mx-auto max-w-5xl flex flex-col items-center justify-center py-32 border-2 border-dashed rounded-3xl bg-white/50 text-muted-foreground">
            <ArrowLeftRight className="h-16 w-12 mb-4 opacity-20" />
            <div className="text-center">
              <p className="text-xl font-black uppercase tracking-tight">Control de Movimiento</p>
              <p className="text-sm">Seleccione una actividad de la agenda para registrar la salida o devolución de máquinas.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
