
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
  Clock,
  Lock,
  FileText,
  Printer,
  ShieldAlert,
  AlertTriangle,
  FileWarning,
  ExternalLink
} from 'lucide-react';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, query, where, doc, updateDoc, orderBy } from 'firebase/firestore';
import jsPDF from 'jspdf';
import { type SolicitudCapacitacion, type MovimientoMaquina } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatDateToDDMMYYYY } from '@/lib/utils';
import Image from 'next/image';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';

export default function ControlMovimientoMaquinasPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [selectedSolicitudId, setSelectedSolicitudId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  
  const [salidaData, setSalidaData] = useState({
    codigo_maquina: '',
    fecha: '',
    hora: '',
    lacre_estado: 'correcto' as 'correcto' | 'violentado',
  });

  const [devolucionData, setDevolucionData] = useState({
    fecha: '',
    hora: '',
    lacre_estado: 'correcto' as 'correcto' | 'violentado',
  });

  useEffect(() => {
    const now = new Date();
    setSalidaData(p => ({
      ...p,
      fecha: now.toISOString().split('T')[0],
      hora: now.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false })
    }));
    setDevolucionData(p => ({
      ...p,
      fecha: now.toISOString().split('T')[0],
      hora: now.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false })
    }));

    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

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
    if (!firestore || isUserLoading || !user?.profile) return null;
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    const profile = user.profile;
    
    // Jerarquía de filtros
    const hasAdminFilter = ['admin', 'director'].includes(profile.role || '') || profile.permissions?.includes('admin_filter');
    const hasDeptFilter = !hasAdminFilter && profile.permissions?.includes('department_filter');
    const hasDistFilter = !hasAdminFilter && !hasDeptFilter && (profile.permissions?.includes('district_filter') || profile.role === 'jefe' || profile.role === 'funcionario');

    if (hasAdminFilter) return colRef;
    
    if (hasDeptFilter && profile.departamento) {
        return query(colRef, where('departamento', '==', profile.departamento));
    }

    if (hasDistFilter && profile.departamento && profile.distrito) {
        return query(colRef, where('departamento', '==', profile.departamento), where('distrito', '==', profile.distrito));
    }
    
    return null;
  }, [firestore, user, isUserLoading]);

  const { data: rawAgendaItems, isLoading: isLoadingAgenda } = useCollection<SolicitudCapacitacion>(agendaQuery);

  // Ordenamiento en memoria para evitar errores de índices compuestos en Firestore
  const agendaItems = useMemo(() => {
    if (!rawAgendaItems) return null;
    return [...rawAgendaItems].sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [rawAgendaItems]);

  const movimientosQuery = useMemoFirebase(() => {
    if (!firestore || !user || !selectedSolicitudId) return null;
    return query(collection(firestore, 'movimientos-maquinas'), where('solicitud_id', '==', selectedSolicitudId));
  }, [firestore, user, selectedSolicitudId]);

  const { data: movimientosData, isLoading: isLoadingMovimientos } = useCollection<MovimientoMaquina>(movimientosQuery);
  const currentMovimiento = movimientosData && movimientosData.length > 0 ? movimientosData[0] : null;

  const selectedSolicitud = useMemo(() => {
    return agendaItems?.find(item => item.id === selectedSolicitudId);
  }, [agendaItems, selectedSolicitudId]);

  const isDevolucionEnabled = useMemo(() => {
    if (!selectedSolicitud || !currentMovimiento) return false;
    return true; 
  }, [selectedSolicitud, currentMovimiento]);

  const handleSaveSalida = async () => {
    if (!firestore || !user || !selectedSolicitud) return;
    if (!salidaData.codigo_maquina) {
      toast({ variant: 'destructive', title: 'Código faltante', description: 'Ingrese el número de serie de la máquina.' });
      return;
    }

    setIsSubmitting(true);
    const registro = {
      nombre: selectedSolicitud.divulgador_nombre || user.profile?.username || '',
      cedula: selectedSolicitud.divulgador_cedula || user.profile?.cedula || '',
      vinculo: selectedSolicitud.divulgador_vinculo || user.profile?.vinculo || '',
      fecha: salidaData.fecha,
      hora: salidaData.hora,
      codigo_maquina: salidaData.codigo_maquina,
      lugar: selectedSolicitud.lugar_local,
      firma: '',
      lacre_estado: 'correcto'
    };

    const docData = {
      solicitud_id: selectedSolicitudId!,
      departamento: selectedSolicitud.departamento || user.profile?.departamento || '',
      distrito: selectedSolicitud.distrito || user.profile?.distrito || '',
      salida: registro,
      fecha_creacion: new Date().toISOString(),
    };

    try {
      await addDoc(collection(firestore, 'movimientos-maquinas'), docData);
      toast({ title: '¡Salida Registrada!', description: 'Se ha habilitado la sección de devolución.' });
    } catch (error) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'movimientos-maquinas', operation: 'create', requestResourceData: docData }));
    } finally { setIsSubmitting(false); }
  };

  const handleSaveDevolucion = async () => {
    if (!firestore || !user || !selectedSolicitud || !currentMovimiento) return;
    setIsSubmitting(true);
    const registro = {
      nombre: selectedSolicitud.divulgador_nombre || user.profile?.username || '',
      cedula: selectedSolicitud.divulgador_cedula || user.profile?.cedula || '',
      vinculo: selectedSolicitud.divulgador_vinculo || user.profile?.vinculo || '',
      fecha: devolucionData.fecha,
      hora: devolucionData.hora,
      codigo_maquina: currentMovimiento.salida?.codigo_maquina || '',
      lugar: selectedSolicitud.lugar_local,
      firma: '',
      lacre_estado: devolucionData.lacre_estado,
    };

    try {
      await updateDoc(doc(firestore, 'movimientos-maquinas', currentMovimiento.id), { devolucion: registro });
      toast({ title: '¡Devolución Registrada!' });
    } catch (error) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `movimientos-maquinas/${currentMovimiento.id}`, operation: 'update', requestResourceData: { devolucion: registro } }));
    } finally { setIsSubmitting(false); }
  };

  const generatePDF = (type: 'salida' | 'devolucion', isProforma: boolean = false) => {
    if (!selectedSolicitud || !logoBase64) return;
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.addImage(logoBase64, 'PNG', margin, 10, 20, 20);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    const title = type === 'salida' ? "FORMULARIO 01 – SALIDA DE MÁQUINA DE VOTACIÓN" : "FORMULARIO 02 – DEVOLUCIÓN DE MÁQUINA DE VOTACIÓN";
    doc.text(title, 105, 20, { align: "center" });

    let y = 45;
    const data = type === 'salida' ? (currentMovimiento?.salida || salidaData) : (currentMovimiento?.devolucion || devolucionData);
    
    doc.setFontSize(11);
    doc.text("NOMBRE Y APELLIDO DEL FUNCIONARIO RESPONSABLE DE LA DIVULGACIÓN", margin, y);
    y += 4; doc.roundedRect(margin, y, 170, 8, 2, 2);
    doc.setFont('helvetica', 'normal'); doc.text(String(selectedSolicitud.divulgador_nombre || '').toUpperCase(), margin + 5, y + 6);
    
    y += 15; doc.setFont('helvetica', 'bold'); doc.text("Nº C.I:", margin, y);
    doc.roundedRect(margin + 15, y - 6, 50, 8, 2, 2);
    doc.setFont('helvetica', 'normal'); doc.text(selectedSolicitud.divulgador_cedula || '', margin + 20, y - 1);

    y += 12; doc.setFont('helvetica', 'bold'); doc.text("VÍNCULO:", margin, y);
    const vinculo = (selectedSolicitud.divulgador_vinculo || '').toUpperCase();
    doc.rect(margin + 25, y - 5, 5, 5); doc.text("PERMANENTE", margin + 32, y); if(vinculo === 'PERMANENTE') doc.text("X", margin + 26, y-1);
    doc.rect(margin + 75, y - 5, 5, 5); doc.text("CONTRATADO", margin + 82, y); if(vinculo === 'CONTRATADO') doc.text("X", margin + 76, y-1);
    doc.rect(margin + 125, y - 5, 5, 5); doc.text("COMISIONADO", margin + 132, y); if(vinculo === 'COMISIONADO') doc.text("X", margin + 126, y-1);

    y += 15; doc.setFont('helvetica', 'bold'); doc.text(type === 'salida' ? "HORA DE SALIDA:" : "HORA DE DEVOLUCIÓN:", margin, y);
    doc.roundedRect(margin + 45, y - 6, 30, 8, 2, 2); doc.setFont('helvetica', 'normal'); doc.text(`${data.hora} HS`, margin + 48, y - 1);
    doc.setFont('helvetica', 'bold'); doc.text("FECHA:", margin + 90, y); doc.text(`${formatDateToDDMMYYYY(data.fecha)}`, margin + 110, y);

    y += 15; doc.setFont('helvetica', 'bold'); doc.text("NÚMERO DE SERIE DE LA MÁQUINA DE VOTACIÓN", margin, y);
    y += 4; doc.roundedRect(margin, y, 80, 8, 2, 2); doc.setFont('helvetica', 'normal'); doc.text(String(currentMovimiento?.salida?.codigo_maquina || salidaData.codigo_maquina).toUpperCase(), margin + 5, y + 6);

    if (type === 'devolucion') {
        const boxX = margin + 100;
        doc.roundedRect(boxX, y - 10, 70, 25, 2, 2); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
        doc.text("ESTADO DE LOS LACRES A LA DEVOLUCIÓN", boxX + 5, y - 4, { maxWidth: 60 });
        doc.circle(boxX + 10, y + 8, 3); doc.text("CORRECTO", boxX + 15, y + 9); if(data.lacre_estado === 'correcto') doc.text("X", boxX + 9, y+9);
        doc.circle(boxX + 40, y + 8, 3); doc.text("VIOLENTADO", boxX + 45, y + 9); if(data.lacre_estado === 'violentado') doc.text("X", boxX + 39, y+9);
    }

    y += 20; doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.text("LUGAR DE LA DIVULGACIÓN", margin, y);
    y += 4; doc.roundedRect(margin, y, 170, 8, 2, 2); doc.setFont('helvetica', 'normal'); doc.text(selectedSolicitud.lugar_local.toUpperCase(), margin + 5, y + 6);

    y += 40; doc.line(margin, y, margin + 60, y); doc.text("FIRMA JEFE", margin, y + 5);
    doc.line(pageWidth - margin - 60, y, pageWidth - margin, y); doc.text("FIRMA JEFE", pageWidth - margin - 60, y + 5);
    y += 20; doc.line(105 - 30, y, 105 + 30, y); doc.text("FIRMA DEL DIVULGADOR", 105, y + 5, { align: 'center' });

    doc.save(`Proforma-${type.toUpperCase()}-${selectedSolicitud.lugar_local.replace(/\s+/g, '-')}.pdf`);
  };

  if (isUserLoading || isLoadingAgenda) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <Header title="Control de Movimiento de Máquinas" />
      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
        
        <Card className="mb-8 border-primary/20 shadow-lg">
          <CardHeader className="bg-primary/5">
            <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-widest text-primary">
              <CalendarDays className="h-4 w-4" /> VINCULAR ACTIVIDAD
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Select onValueChange={setSelectedSolicitudId} value={selectedSolicitudId || undefined}>
              <SelectTrigger className="h-12 border-2"><SelectValue placeholder="Seleccione actividad agendada..." /></SelectTrigger>
              <SelectContent>
                {agendaItems?.map(item => (
                  <SelectItem key={item.id} value={item.id}>{formatDateToDDMMYYYY(item.fecha)} | {item.lugar_local}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedSolicitudId && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* SECCIÓN A: SALIDA */}
            <Card className={cn("border-t-8 shadow-xl", currentMovimiento ? "border-t-green-500" : "border-t-primary")}>
              <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/10">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center font-black">A</span>
                    <CardTitle className="uppercase font-black text-xl">Salida de Máquina</CardTitle>
                  </div>
                  <CardDescription className="font-bold text-[10px] uppercase ml-11">Formulario 01 - Registro de Retiro</CardDescription>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="font-black uppercase text-[10px]" onClick={() => generatePDF('salida', true)}>
                        <Printer className="mr-1.5 h-3.5 w-3.5" /> Proforma 01
                    </Button>
                    {currentMovimiento && <CheckCircle2 className="h-8 w-8 text-green-600" />}
                </div>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Funcionario Responsable</Label>
                        <Input value={selectedSolicitud?.divulgador_nombre || ''} readOnly className="font-bold uppercase bg-muted/30" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Nº C.I.</Label>
                            <Input value={selectedSolicitud?.divulgador_cedula || ''} readOnly className="font-black bg-muted/30" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Vínculo</Label>
                            <Input value={selectedSolicitud?.divulgador_vinculo || ''} readOnly className="font-bold uppercase bg-muted/30" />
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary">Nº Serie Máquina de Votación</Label>
                        <Input 
                            value={currentMovimiento?.salida?.codigo_maquina || salidaData.codigo_maquina} 
                            onChange={(e) => setSalidaData(p => ({...p, codigo_maquina: e.target.value}))}
                            disabled={!!currentMovimiento}
                            placeholder="Ingrese código..."
                            className="font-black text-lg border-2 uppercase"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Fecha Salida</Label>
                        <Input value={formatDateToDDMMYYYY(currentMovimiento?.salida?.fecha || salidaData.fecha)} readOnly className="bg-muted/30 font-bold" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Hora Salida</Label>
                        <Input value={currentMovimiento?.salida?.hora || salidaData.hora} readOnly className="bg-muted/30 font-bold" />
                    </div>
                </div>
                <div className="p-4 bg-muted/20 border-2 rounded-xl border-dashed">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Lugar de Divulgación</Label>
                    <p className="font-black uppercase text-sm mt-1">{selectedSolicitud?.lugar_local}</p>
                </div>
              </CardContent>
              {!currentMovimiento && (
                <CardFooter className="bg-muted/30 p-6 border-t">
                    <Button onClick={handleSaveSalida} disabled={isSubmitting || !salidaData.codigo_maquina} className="w-full h-14 text-lg font-black uppercase shadow-xl">
                        {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Truck className="mr-2" />}
                        REGISTRAR SALIDA (F01)
                    </Button>
                </CardFooter>
              )}
            </Card>

            {/* SECCIÓN B: DEVOLUCIÓN */}
            <Card className={cn("border-t-8 shadow-xl transition-all", !isDevolucionEnabled && "opacity-50 grayscale", currentMovimiento?.devolucion ? "border-t-green-500" : "border-t-orange-500")}>
              <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/10">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="h-8 w-8 rounded-full bg-orange-600 text-white flex items-center justify-center font-black">B</span>
                    <CardTitle className="uppercase font-black text-xl">Devolución de Máquina</CardTitle>
                  </div>
                  <CardDescription className="font-bold text-[10px] uppercase ml-11">Formulario 02 - Registro de Retorno</CardDescription>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="font-black uppercase text-[10px] border-orange-200 text-orange-700" onClick={() => generatePDF('devolucion', true)}>
                        <Printer className="mr-1.5 h-3.5 w-3.5" /> Proforma 02
                    </Button>
                    {currentMovimiento?.devolucion && <CheckCircle2 className="h-8 w-8 text-green-600" />}
                </div>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                {!isDevolucionEnabled ? (
                    <div className="flex flex-col items-center py-10 gap-4 text-center">
                        <Lock className="h-12 w-12 text-muted-foreground opacity-30" />
                        <p className="font-black uppercase text-muted-foreground text-sm">Se habilitará tras registrar la salida.</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Fecha Retorno</Label>
                                <Input value={formatDateToDDMMYYYY(currentMovimiento?.devolucion?.fecha || devolucionData.fecha)} readOnly className="bg-muted/30 font-bold" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Hora Retorno</Label>
                                <Input value={currentMovimiento?.devolucion?.hora || devolucionData.hora} readOnly className="bg-muted/30 font-bold" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-orange-600">Estado de los Lacres</Label>
                                <RadioGroup 
                                    value={currentMovimiento?.devolucion?.lacre_estado || devolucionData.lacre_estado} 
                                    onValueChange={(v: any) => setDevolucionData(p => ({...p, lacre_estado: v}))}
                                    disabled={!!currentMovimiento?.devolucion}
                                    className="flex gap-4 mt-2"
                                >
                                    <div className="flex items-center space-x-2 p-2 px-4 border-2 rounded-lg bg-white">
                                        <RadioGroupItem value="correcto" id="l-correcto" />
                                        <Label htmlFor="l-correcto" className="font-black text-[10px] cursor-pointer">CORRECTO</Label>
                                    </div>
                                    <div className="flex items-center space-x-2 p-2 px-4 border-2 rounded-lg bg-white border-destructive/20">
                                        <RadioGroupItem value="violentado" id="l-violentado" />
                                        <Label htmlFor="l-violentado" className="font-black text-[10px] cursor-pointer text-destructive">VIOLENTADO</Label>
                                    </div>
                                </RadioGroup>
                            </div>
                        </div>

                        {(devolucionData.lacre_estado === 'violentado' || currentMovimiento?.devolucion?.lacre_estado === 'violentado') && (
                            <Card className="border-4 border-destructive/20 bg-destructive/5 animate-in slide-in-from-bottom-4">
                                <CardHeader className="bg-destructive/10 border-b border-destructive/20">
                                    <CardTitle className="text-destructive font-black uppercase text-sm flex items-center gap-2">
                                        <FileWarning className="h-5 w-5" /> LACRES VIOLENTADOS DETECTADOS
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6 text-center space-y-4">
                                    <p className="text-xs font-bold uppercase text-destructive">Se ha detectado una irregularidad en los lacres de seguridad. Es obligatorio completar el formulario de denuncia.</p>
                                    <Link href={`/denuncia-lacres?solicitudId=${selectedSolicitudId}`}>
                                        <Button className="bg-destructive hover:bg-destructive/90 text-white font-black uppercase text-xs h-12 px-8 shadow-lg">
                                            <ShieldAlert className="mr-2 h-4 w-4" /> IR AL MÓDULO DE DENUNCIA
                                        </Button>
                                    </Link>
                                </CardContent>
                            </Card>
                        )}
                    </>
                )}
              </CardContent>
              {isDevolucionEnabled && !currentMovimiento?.devolucion && (
                <CardFooter className="bg-muted/30 p-6 border-t">
                    <Button onClick={handleSaveDevolucion} disabled={isSubmitting} className="w-full h-14 text-lg font-black uppercase shadow-xl bg-orange-600 hover:bg-orange-700">
                        {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Undo2 className="mr-2" />}
                        REGISTRAR DEVOLUCIÓN (F02)
                    </Button>
                </CardFooter>
              )}
            </Card>
          </div>
        )}

        {!selectedSolicitudId && (
          <div className="flex flex-col items-center justify-center py-32 border-4 border-dashed rounded-[3rem] bg-white/50 text-muted-foreground">
            <ArrowLeftRight className="h-20 w-20 mb-6 opacity-10" />
            <p className="text-xl font-black uppercase tracking-widest opacity-40">Seleccione una actividad para comenzar</p>
          </div>
        )}
      </main>
    </div>
  );
}
