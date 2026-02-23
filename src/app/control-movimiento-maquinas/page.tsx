
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
  Search,
  FileText,
  Printer,
  ShieldCheck,
  ShieldAlert
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

export default function ControlMovimientoMaquinasPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [selectedSolicitudId, setSelectedSolicitudId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  
  // States for forms
  const [salidaFotoDoc, setSalidaFotoDoc] = useState<string | null>(null);
  const [devolucionFotoDoc, setDevolucionFotoDoc] = useState<string | null>(null);
  const [salidaData, setSalidaData] = useState({
    codigo_maquina: '',
    fecha: '',
    hora: '',
    lacre_estado: 'correcto' as 'correcto' | 'violentado',
  });
  const [devolucionData, setDevolucionData] = useState({
    codigo_maquina: '',
    fecha: '',
    hora: '',
    lacre_estado: 'correcto' as 'correcto' | 'violentado',
  });

  // Handle Hydration: Set initial dates on client mount
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

    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute
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
    if (!firestore || !user?.profile) return null;
    
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    const canFilterAll = user.profile.role === 'admin' || user.profile.permissions?.includes('admin_filter');

    if (canFilterAll) {
      return query(colRef, orderBy('fecha', 'desc'));
    }

    if (!user.profile.departamento || !user.profile.distrito) {
        return null;
    }

    return query(
      colRef,
      where('departamento', '==', user.profile.departamento),
      where('distrito', '==', user.profile.distrito),
      orderBy('fecha', 'desc')
    );
  }, [firestore, user]);

  const { data: agendaItems, isLoading: isLoadingAgenda } = useCollection<SolicitudCapacitacion>(agendaQuery);

  const movimientosQuery = useMemoFirebase(() => {
    if (!firestore || !user || !selectedSolicitudId) return null;
    return query(
      collection(firestore, 'movimientos-maquinas'),
      where('solicitud_id', '==', selectedSolicitudId)
    );
  }, [firestore, user, selectedSolicitudId]);

  const { data: movimientosData, isLoading: isLoadingMovimientos } = useCollection<MovimientoMaquina>(movimientosQuery);
  const currentMovimiento = movimientosData && movimientosData.length > 0 ? movimientosData[0] : null;

  const selectedSolicitud = useMemo(() => {
    return agendaItems?.find(item => item.id === selectedSolicitudId);
  }, [agendaItems, selectedSolicitudId]);

  const isDevolucionEnabled = useMemo(() => {
    if (!selectedSolicitud) return false;
    try {
      const [year, month, day] = selectedSolicitud.fecha.split('-').map(Number);
      const [hour, minute] = selectedSolicitud.hora_hasta.split(':').map(Number);
      const eventEnd = new Date(year, month - 1, day, hour, minute);
      return currentTime >= eventEnd;
    } catch (e) {
      return false;
    }
  }, [selectedSolicitud, currentTime]);

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>, type: 'salida' | 'devolucion') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'salida') setSalidaFotoDoc(reader.result as string);
        else setDevolucionFotoDoc(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveSalida = async () => {
    if (!firestore || !user || !selectedSolicitud) return;
    if (!salidaData.codigo_maquina || !salidaFotoDoc) {
      toast({ variant: 'destructive', title: 'Faltan datos', description: 'Ingrese el código de máquina y capture la foto del documento firmado.' });
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
      firma: salidaFotoDoc,
      lacre_estado: salidaData.lacre_estado
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
      toast({ title: '¡Salida Registrada!', description: 'El retiro de la máquina ha sido guardado.' });
    } catch (error) {
      const contextualError = new FirestorePermissionError({
        path: 'movimientos-maquinas',
        operation: 'create',
        requestResourceData: docData
      });
      errorEmitter.emit('permission-error', contextualError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDevolucion = async () => {
    if (!firestore || !user || !selectedSolicitud || !currentMovimiento) return;
    if (!devolucionFotoDoc) {
      toast({ variant: 'destructive', title: 'Falta documento', description: 'Por favor capture la foto del formulario de devolución firmado.' });
      return;
    }

    setIsSubmitting(true);
    const registro = {
      nombre: selectedSolicitud.divulgador_nombre || user.profile?.username || '',
      cedula: selectedSolicitud.divulgador_cedula || user.profile?.cedula || '',
      vinculo: selectedSolicitud.divulgador_vinculo || user.profile?.vinculo || '',
      fecha: devolucionData.fecha,
      hora: devolucionData.hora,
      codigo_maquina: currentMovimiento.salida?.codigo_maquina || '',
      lugar: selectedSolicitud.lugar_local,
      firma: devolucionFotoDoc,
      lacre_estado: devolucionData.lacre_estado
    };

    try {
      await updateDoc(doc(firestore, 'movimientos-maquinas', currentMovimiento.id), {
        devolucion: registro
      });
      toast({ title: '¡Devolución Registrada!', description: 'El retorno de la máquina ha sido guardado exitosamente.' });
    } catch (error) {
      const contextualError = new FirestorePermissionError({
        path: `movimientos-maquinas/${currentMovimiento.id}`,
        operation: 'update',
        requestResourceData: { devolucion: registro }
      });
      errorEmitter.emit('permission-error', contextualError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const generatePDF = (type: 'salida' | 'devolucion', isProforma: boolean = false) => {
    if (!selectedSolicitud || !logoBase64) return;

    let dataToUse: any = null;
    
    if (isProforma) {
      dataToUse = {
        nombre: selectedSolicitud.divulgador_nombre || user?.profile?.username || '',
        cedula: selectedSolicitud.divulgador_cedula || user?.profile?.cedula || '',
        vinculo: selectedSolicitud.divulgador_vinculo || user?.profile?.vinculo || '',
        fecha: type === 'salida' ? salidaData.fecha : devolucionData.fecha,
        hora: type === 'salida' ? salidaData.hora : devolucionData.hora,
        codigo_maquina: type === 'salida' ? salidaData.codigo_maquina : (currentMovimiento?.salida?.codigo_maquina || ''),
        lugar: selectedSolicitud.lugar_local,
        firma: null,
        lacre_estado: type === 'salida' ? salidaData.lacre_estado : devolucionData.lacre_estado
      };
    } else {
      dataToUse = type === 'salida' ? currentMovimiento?.salida : currentMovimiento?.devolucion;
    }

    if (!dataToUse) return;

    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.addImage(logoBase64, 'PNG', margin, 10, 20, 20);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const title = type === 'salida' ? "FORMULARIO 01 – SALIDA DE MÁQUINA DE VOTACIÓN" : "FORMULARIO 02 – DEVOLUCIÓN DE MÁQUINA DE VOTACIÓN";
    doc.text(title, 105, 20, { align: "center" });

    // Fecha (top right)
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const fechaText = isProforma ? "FECHA ___/___/___" : `FECHA ${formatDateToDDMMYYYY(dataToUse.fecha)}`;
    doc.text(fechaText, pageWidth - margin - 40, 30);

    let y = 45;

    // Nº C.I.
    doc.setFont('helvetica', 'bold');
    doc.text("Nº C.I:", margin, y);
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin + 15, y - 6, 60, 8, 3, 3);
    doc.setFont('helvetica', 'normal');
    doc.text(String(dataToUse.cedula || ''), margin + 20, y - 1);

    y += 12;

    // Vínculo
    doc.setFont('helvetica', 'bold');
    doc.text("VÍNCULO:", margin, y);
    
    const drawCheckbox = (x: number, label: string, isChecked: boolean) => {
      doc.rect(x, y - 5, 5, 5);
      if (isChecked) doc.text("X", x + 1, y - 1);
      doc.setFont('helvetica', 'normal');
      doc.text(label, x + 7, y);
    };

    const currentVinculo = String(dataToUse.vinculo || '').toUpperCase();
    drawCheckbox(margin + 25, "PERMANENTE", currentVinculo === 'PERMANENTE');
    drawCheckbox(margin + 75, "CONTRATADO", currentVinculo === 'CONTRATADO');
    drawCheckbox(margin + 125, "COMISIONADO", currentVinculo === 'COMISIONADO');

    y += 15;

    // Nombre Completo
    doc.setFont('helvetica', 'bold');
    doc.text("NOMBRE COMPLETO DEL FUNCIONARIO RESPONSABLE", margin, y);
    y += 4;
    doc.roundedRect(margin, y, 170, 8, 3, 3);
    doc.setFont('helvetica', 'normal');
    doc.text(String(dataToUse.nombre || '').toUpperCase(), margin + 5, y + 6);

    y += 20;

    // Hora y Lacre (Row)
    const hourLabel = type === 'salida' ? "HORA DE SALIDA:" : "HORA DE DEVOLUCIÓN:";
    doc.setFont('helvetica', 'bold');
    doc.text(hourLabel, margin, y);
    doc.roundedRect(margin + 45, y - 6, 35, 8, 3, 3);
    doc.setFont('helvetica', 'normal');
    const hourVal = isProforma ? "___:___ HS" : `${dataToUse.hora} HS`;
    doc.text(hourVal, margin + 50, y - 1);

    // Box Lacre (Right)
    const boxX = margin + 100;
    doc.roundedRect(boxX, y - 10, 70, 25, 3, 3);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const lacreTitle = type === 'salida' ? "ESTADO DE LOS LACRES A LA ENTREGA" : "ESTADO DE LOS LACRES A LA DEVOLUCIÓN";
    doc.text(lacreTitle, boxX + 5, y - 4, { maxWidth: 60 });
    
    const drawCircleOption = (cx: number, cy: number, label: string, isChecked: boolean) => {
      doc.circle(cx, cy, 3);
      if (isChecked) doc.text("X", cx - 1, cy + 1);
      doc.text(label, cx + 5, cy + 1);
    };

    const lacreStatus = dataToUse.lacre_estado || 'correcto';
    drawCircleOption(boxX + 10, y + 8, "CORRECTO", !isProforma && lacreStatus === 'correcto');
    drawCircleOption(boxX + 45, y + 8, "VIOLENTADO", !isProforma && lacreStatus === 'violentado');

    y += 25;

    // Número de Código Máquina
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text("NÚMERO DE CÓDIGO DE LA MÁQUINA DE VOTACIÓN", margin, y);
    y += 4;
    doc.roundedRect(margin, y, 90, 8, 3, 3);
    doc.setFont('helvetica', 'normal');
    doc.text(String(dataToUse.codigo_maquina || '').toUpperCase(), margin + 5, y + 6);

    y += 15;

    // Lugar de Divulgación
    doc.setFont('helvetica', 'bold');
    const lugarLabel = "LUGAR DE LA DIVULGACIÓN (ANEXO I LUGAR FIJO DE DIVULGACIÓN O ANEXO V PROFORMA DE SOLICITUD)";
    doc.text(doc.splitTextToSize(lugarLabel, 170), margin, y);
    y += 10;
    doc.roundedRect(margin, y, 170, 8, 3, 3);
    doc.setFont('helvetica', 'normal');
    doc.text(String(dataToUse.lugar || '').toUpperCase(), margin + 5, y + 6);

    y += 35;

    // Signatures Area
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    // Left Chief
    doc.line(margin, y, margin + 70, y);
    doc.text("FIRMA JEFE", margin, y + 5);
    doc.text("ACLARACIÓN:", margin, y + 10);

    // Right Chief
    doc.line(pageWidth - margin - 70, y, pageWidth - margin, y);
    doc.text("FIRMA JEFE", pageWidth - margin - 70, y + 5);
    doc.text("ACLARACIÓN:", pageWidth - margin - 70, y + 10);

    // Center Staff
    y += 20;
    const centerLineX = (pageWidth - 80) / 2;
    doc.line(centerLineX, y, centerLineX + 80, y);
    const staffLabel = type === 'salida' ? "FIRMA DEL FUNCIONARIO QUE RETIRA" : "FIRMA DEL FUNCIONARIO QUE DEVUELVE";
    doc.text(staffLabel, centerLineX, y + 5);
    doc.text("ACLARACIÓN:", centerLineX, y + 10);

    if (!isProforma && dataToUse.firma) {
      doc.addPage();
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text("RESPALDO DEL DOCUMENTO FIRMADO", 105, 20, { align: 'center' });
      doc.addImage(dataToUse.firma, 'JPEG', margin, 30, 170, 230);
    }

    const name = isProforma ? 'Proforma' : 'Comprobante';
    doc.save(`${name}-${type.toUpperCase()}-${dataToUse.cedula}.pdf`);
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <Header title="Control de Movimiento de Máquinas" />
      <main className="flex-1 p-4 md:p-8">
        
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
                  <SelectValue placeholder={isLoadingAgenda ? "Cargando actividades..." : "Seleccione la actividad programada..."} />
                </SelectTrigger>
                <SelectContent>
                  {agendaItems && agendaItems.length > 0 ? (
                    agendaItems.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {formatDateToDDMMYYYY(item.fecha)} | {item.lugar_local} ({item.solicitante_entidad})
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-data" disabled>No se encontraron actividades disponibles</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {selectedSolicitud && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border border-dashed">
                  <div className="flex items-center gap-3">
                    <Truck className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Funcionario Asignado</p>
                      <p className="text-sm font-bold uppercase">{selectedSolicitud.divulgador_nombre || 'No asignado'}</p>
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
                <CardDescription>Registro de retiro de máquina.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-4">
                  {!currentMovimiento && (
                    <Button variant="outline" className="w-full h-10 font-black uppercase text-[10px] border-2 border-dashed" onClick={() => generatePDF('salida', true)}>
                      <Printer className="mr-2 h-3.5 w-3.5" /> GENERAR PROFORMA 01
                    </Button>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-black text-muted-foreground">Fecha Salida</Label>
                      <Input value={formatDateToDDMMYYYY(currentMovimiento?.salida?.fecha || salidaData.fecha)} readOnly className="bg-muted/50 font-bold" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-black text-muted-foreground">Hora Salida</Label>
                      <Input value={currentMovimiento?.salida?.hora || salidaData.hora} readOnly className="bg-muted/50 font-bold" />
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-black text-primary">Código Máquina de Votación</Label>
                    <Input 
                      placeholder="Ingrese el número de serie..." 
                      className="font-black text-lg border-2 uppercase"
                      value={currentMovimiento?.salida?.codigo_maquina || salidaData.codigo_maquina}
                      onChange={(e) => setSalidaData(p => ({...p, codigo_maquina: e.target.value}))}
                      disabled={!!currentMovimiento}
                    />
                  </div>

                  {/* Lacre Section Salida */}
                  <div className="p-4 bg-muted/30 border-2 rounded-xl space-y-3">
                    <Label className="text-[10px] font-black uppercase text-primary">ESTADO DE LOS LACRES A LA ENTREGA</Label>
                    <RadioGroup 
                      value={currentMovimiento?.salida?.lacre_estado || salidaData.lacre_estado} 
                      onValueChange={(val: any) => setSalidaData(p => ({...p, lacre_estado: val}))}
                      disabled={!!currentMovimiento}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="correcto" id="s-correcto" />
                        <Label htmlFor="s-correcto" className="text-xs font-bold uppercase cursor-pointer">Correcto</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="violentado" id="s-violentado" />
                        <Label htmlFor="s-violentado" className="text-xs font-bold uppercase cursor-pointer text-destructive">Violentado</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="p-4 bg-muted/20 rounded-lg border space-y-3">
                    <Label className="text-xs font-bold uppercase flex items-center gap-2">
                      <FileText className="h-3 w-3" /> Documento Físico Firmado
                    </Label>
                    {currentMovimiento?.salida?.firma || salidaFotoDoc ? (
                      <div className="relative aspect-[3/1] bg-white rounded border overflow-hidden">
                        <Image src={currentMovimiento?.salida?.firma || salidaFotoDoc!} alt="Respaldo Documento" fill className="object-contain" />
                        {!currentMovimiento && (
                          <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full" onClick={() => setSalidaFotoDoc(null)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ) : (
                      <label htmlFor="capture-salida" className="flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-white transition-colors">
                        <Camera className="h-6 w-6 text-muted-foreground mb-1" />
                        <span className="text-[10px] font-bold text-muted-foreground">CAPTURAR DOCUMENTO</span>
                        <Input id="capture-salida" type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoCapture(e, 'salida')} />
                      </label>
                    )}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/10 border-t p-4 flex flex-col gap-3">
                {!currentMovimiento ? (
                  <Button className="w-full h-12 font-bold" onClick={handleSaveSalida} disabled={isSubmitting || !salidaFotoDoc}>
                    {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : "REGISTRAR SALIDA"}
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full h-12 font-bold border-primary text-primary" onClick={() => generatePDF('salida')}>
                    <FileDown className="mr-2 h-5 w-5" /> COMPROBANTE 01
                  </Button>
                )}
              </CardFooter>
            </Card>

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
                <CardDescription>Registro de retorno del equipo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                {!isDevolucionEnabled && !currentMovimiento?.devolucion ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
                    <Lock className="h-12 w-12 text-muted-foreground opacity-30" />
                    <div className="space-y-1">
                      <p className="text-sm font-black uppercase text-muted-foreground">Bloqueado temporalmente</p>
                      <p className="text-[10px] text-muted-foreground">Se habilitará al finalizar el evento ({selectedSolicitud?.hora_hasta} HS).</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {currentMovimiento && !currentMovimiento.devolucion && (
                      <Button variant="outline" className="w-full h-10 font-black uppercase text-[10px] border-2 border-dashed border-orange-200 text-orange-600" onClick={() => generatePDF('devolucion', true)}>
                        <Printer className="mr-2 h-3.5 w-3.5" /> GENERAR PROFORMA 02
                      </Button>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-black text-muted-foreground">Fecha Devolución</Label>
                        <Input value={formatDateToDDMMYYYY(currentMovimiento?.devolucion?.fecha || devolucionData.fecha)} readOnly className="bg-muted/50 font-bold" />
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

                    {/* Lacre Section Devolucion */}
                    <div className="p-4 bg-muted/30 border-2 rounded-xl space-y-3">
                      <Label className="text-[10px] font-black uppercase text-orange-600">ESTADO DE LOS LACRES A LA DEVOLUCIÓN</Label>
                      <RadioGroup 
                        value={currentMovimiento?.devolucion?.lacre_estado || devolucionData.lacre_estado} 
                        onValueChange={(val: any) => setDevolucionData(p => ({...p, lacre_estado: val}))}
                        disabled={!!currentMovimiento?.devolucion}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="correcto" id="d-correcto" />
                          <Label htmlFor="d-correcto" className="text-xs font-bold uppercase cursor-pointer">Correcto</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="violentado" id="d-violentado" />
                          <Label htmlFor="d-violentado" className="text-xs font-bold uppercase cursor-pointer text-destructive">Violentado</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="p-4 bg-muted/20 rounded-lg border space-y-3">
                      <Label className="text-xs font-bold uppercase flex items-center gap-2">
                        <FileText className="h-3 w-3" /> Documento Físico Firmado
                      </Label>
                      {currentMovimiento?.devolucion?.firma || devolucionFotoDoc ? (
                        <div className="relative aspect-[3/1] bg-white rounded border overflow-hidden">
                          <Image src={currentMovimiento?.devolucion?.firma || devolucionFotoDoc!} alt="Respaldo Documento" fill className="object-contain" />
                          {!currentMovimiento?.devolucion && (
                            <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full" onClick={() => setDevolucionFotoDoc(null)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        <label htmlFor="capture-devolucion" className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-orange-200 rounded-lg cursor-pointer hover:bg-white transition-colors">
                          <Camera className="h-6 w-6 text-orange-400 mb-1" />
                          <span className="text-[10px] font-bold text-orange-400">CAPTURAR DOCUMENTO</span>
                          <Input id="capture-devolucion" type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoCapture(e, 'devolucion')} />
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="bg-muted/10 border-t p-4 flex flex-col gap-3">
                {currentMovimiento && !currentMovimiento.devolucion ? (
                  <Button className="w-full h-12 font-bold bg-orange-600 hover:bg-orange-700" onClick={handleSaveDevolucion} disabled={isSubmitting || !isDevolucionEnabled || !devolucionFotoDoc}>
                    {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : "REGISTRAR DEVOLUCIÓN"}
                  </Button>
                ) : currentMovimiento?.devolucion ? (
                  <Button variant="outline" className="w-full h-12 font-bold border-orange-600 text-orange-600" onClick={() => generatePDF('devolucion')}>
                    <FileDown className="mr-2 h-5 w-5" /> COMPROBANTE 02
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
              <p className="text-sm">Seleccione una actividad de la agenda para comenzar.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
