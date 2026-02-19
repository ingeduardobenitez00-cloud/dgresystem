"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, FileText, Camera, CheckCircle2, RefreshCw, MousePointer2, Upload, Trash2, Search, X } from 'lucide-react';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import jsPDF from 'jspdf';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn, formatDateToDDMMYYYY } from '@/lib/utils';
import { type PartidoPolitico } from '@/lib/data';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function SolicitudCapacitacionPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    solicitante_entidad: '', // Grupo Político
    tipo_solicitud: 'divulgacion' as 'divulgacion' | 'capacitacion',
    fecha: '',
    hora_desde: '08:00',
    hora_hasta: '12:00',
    lugar_local: '',
    direccion_calle: '',
    barrio_compania: '',
    rol_solicitante: 'apoderado' as 'apoderado' | 'otro',
    nombre_completo: '',
    cedula: '',
    telefono: '',
    gps: '',
  });

  const [photoDataUri, setPhotoDataUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [isPartyPopoverOpen, setIsPartyPopoverOpen] = useState(false);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Fetch Partidos Políticos
  const partidosQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'partidos-politicos'), orderBy('nombre')) : null, [firestore]);
  const { data: partidosData } = useCollection<PartidoPolitico>(partidosQuery);

  // Set initial dates client-side only
  useEffect(() => {
    const now = new Date();
    setFormData(prev => ({
      ...prev,
      fecha: now.toISOString().split('T')[0]
    }));
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

  useEffect(() => {
    let isMounted = true;
    const initMap = async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      if (typeof window !== 'undefined' && mapRef.current && !leafletMap.current) {
        try {
          const L = (await import('leaflet')).default;
          if (!isMounted || !mapRef.current) return;
          
          delete (L.Icon.Default.prototype as any)._getIconUrl;
          L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          });

          const defaultPos: [number, number] = [-25.3006, -57.6359];
          const map = L.map(mapRef.current, { center: defaultPos, zoom: 15, doubleClickZoom: false, attributionControl: false });
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
          
          map.on('dblclick', (e: any) => {
            const { lat, lng } = e.latlng;
            const latStr = lat.toFixed(6);
            const lngStr = lng.toFixed(6);
            setFormData(prev => ({ ...prev, gps: `${latStr}, ${lngStr}` }));
            if (markerRef.current) markerRef.current.setLatLng(e.latlng);
            else markerRef.current = L.marker(e.latlng).addTo(map);
          });
          leafletMap.current = map;
        } catch (error) { console.error("Error mapa:", error); }
      }
    };
    initMap();
    return () => { isMounted = false; if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; } };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTypeChange = (val: 'divulgacion' | 'capacitacion') => {
    setFormData(prev => ({ ...prev, tipo_solicitud: val }));
  };

  const generatePdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF();
      const margin = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // --- Encabezado ---
      if (logoBase64) doc.addImage(logoBase64, 'PNG', margin, 10, 20, 20);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(18);
      doc.text("Justicia Electoral", pageWidth / 2, 18, { align: "center" });
      doc.setFontSize(12);
      doc.text("Custodio de la Voluntad Popular", pageWidth / 2, 24, { align: "center" });

      // --- Barra de Titulo ---
      doc.setFillColor(235, 235, 225);
      doc.rect(margin, 32, pageWidth - (margin * 2), 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text("ANEXO V – PROFORMA DE SOLICITUD", pageWidth / 2, 37.5, { align: "center" });

      // --- Fecha y Lugar ---
      const today = new Date();
      const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const fechaTxt = `${user?.profile?.distrito || '____________________'}, ${today.getDate()} de ${meses[today.getMonth()]} de 2026`;
      doc.text(fechaTxt, pageWidth - margin, 50, { align: "right" });

      // --- Destinatario ---
      doc.text("Señor/a", margin, 65);
      doc.line(margin, 72, 120, 72);
      doc.line(margin, 80, 120, 80);
      doc.setFont('helvetica', 'bold');
      doc.text("Presente:", margin, 88);

      // --- Cuerpo ---
      doc.setFont('helvetica', 'normal');
      const bodyTxt = "Tengo el agrado de dirigirme a usted/es, en virtud a las próximas Elecciones Internas simultáneas de las Organizaciones Políticas del 07 de junio del 2026, a los efectos de solicitar:";
      const splitBody = doc.splitTextToSize(bodyTxt, pageWidth - (margin * 2) - 10);
      doc.text(splitBody, margin + 10, 98);

      // --- Checkboxes ---
      const checkY = 112;
      doc.rect(margin + 15, checkY, 5, 5);
      if (formData.tipo_solicitud === 'divulgacion') doc.text("X", margin + 16.5, checkY + 4);
      doc.text("Divulgación sobre el uso de la Máquina de Votación Electrónica.", margin + 25, checkY + 4);

      doc.rect(margin + 15, checkY + 8, 5, 5);
      if (formData.tipo_solicitud === 'capacitacion') doc.text("X", margin + 16.5, checkY + 12);
      doc.text("Capacitación sobre las funciones de los miembros de mesa receptora de votos.", margin + 25, checkY + 12);

      // --- Tabla de Datos ---
      let tableY = 135;
      const rowH = 8;
      const col1W = 40;
      const totalW = pageWidth - (margin * 2);

      const drawRow = (label: string, value: string) => {
        doc.rect(margin, tableY, col1W, rowH);
        doc.rect(margin + col1W, tableY, totalW - col1W, rowH);
        doc.setFont('helvetica', 'bold');
        doc.text(label, margin + 2, tableY + 5.5);
        doc.setFont('helvetica', 'normal');
        doc.text(String(value || '').toUpperCase(), margin + col1W + 2, tableY + 5.5);
        tableY += rowH;
      };

      // Fecha Row
      doc.rect(margin, tableY, col1W, rowH);
      doc.rect(margin + col1W, tableY, totalW - col1W, rowH);
      doc.setFont('helvetica', 'bold');
      doc.text("FECHA", margin + 2, tableY + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`: ${formatDateToDDMMYYYY(formData.fecha)}`, margin + col1W + 2, tableY + 5.5);
      tableY += rowH;

      // Horario Row
      doc.rect(margin, tableY, col1W, rowH * 2);
      doc.rect(margin + col1W, tableY, totalW - col1W, rowH * 2);
      doc.setFont('helvetica', 'bold');
      doc.text("HORARIO", margin + 2, tableY + 10);
      doc.setFont('helvetica', 'normal');
      doc.text(`DESDE: ${formData.hora_desde} horas`, margin + col1W + 2, tableY + 6);
      doc.text(`HASTA: ${formData.hora_hasta} horas`, margin + col1W + 2, tableY + 14);
      tableY += rowH * 2;

      drawRow("LUGAR Y/O LOCAL", `: ${formData.lugar_local}`);
      drawRow("DIRECCIÓN", `CALLE: ${formData.direccion_calle}`);
      drawRow("BARRIO - COMPAÑÍA", `: ${formData.barrio_compania}`);
      drawRow("DISTRITO", `: ${user?.profile?.distrito || ''}`);

      // --- Solicitante Section ---
      tableY += 5;
      doc.setFont('helvetica', 'bold');
      doc.text("DATOS DEL SOLICITANTE – APODERADO", margin, tableY);
      doc.rect(margin + 75, tableY - 4, 4, 4);
      if (formData.rol_solicitante === 'apoderado') doc.text("X", margin + 75.5, tableY - 0.5);
      doc.text("OTRO", margin + 85, tableY);
      doc.rect(margin + 98, tableY - 4, 4, 4);
      if (formData.rol_solicitante === 'otro') doc.text("X", margin + 98.5, tableY - 0.5);
      tableY += 4;

      drawRow("ORGANIZACIÓN", `: ${formData.solicitante_entidad}`);
      drawRow("NOMBRE COMPLETO", `: ${formData.nombre_completo}`);
      drawRow("C.I.C. N.º", `: ${formData.cedula}`);
      drawRow("NÚMERO DE CONTACTO", `: ${formData.telefono}`);

      // --- Observacion ---
      doc.setFillColor(235, 235, 225);
      doc.rect(margin, tableY, totalW, 6, 'F');
      doc.setFontSize(9);
      doc.text("OBSERVACIÓN", pageWidth / 2, tableY + 4.5, { align: "center" });
      tableY += 6;
      doc.rect(margin, tableY, totalW, 12);
      doc.setFont('helvetica', 'italic');
      doc.text("La recepción de solicitudes se realiza hasta 48 horas de antelación a la fecha del evento.", margin + 5, tableY + 5);
      doc.text("En caso de cancelación de la actividad debe informarse con 24 horas de anticipación.", margin + 5, tableY + 10);
      tableY += 18;

      doc.setFont('helvetica', 'normal');
      doc.text("Se hace propicia la ocasión para saludarle muy cordialmente.", margin, tableY);
      
      tableY += 20;
      doc.text("Firma del Solicitante: __________________________________________", margin + 20, tableY);

      // --- Espacio Uso Interno ---
      tableY += 10;
      doc.rect(margin, tableY, totalW, 45);
      doc.setFont('helvetica', 'bold');
      doc.text("ESPACIO PARA USO INTERNO DE LA JUSTICIA ELECTORAL", pageWidth / 2, tableY + 6, { align: "center" });
      
      doc.setFont('helvetica', 'normal');
      doc.text("Divulgador designado: ___________________________________ C.I.C. N.º: __________________", margin + 5, tableY + 15);
      doc.text("Código de la Máquina de Votación asignada: ___________________________________________", margin + 5, tableY + 23);
      
      doc.text("__________________________________________", pageWidth / 2, tableY + 35, { align: "center" });
      doc.text("Firma y sello del Jefe del Registro Electoral", pageWidth / 2, tableY + 40, { align: "center" });
      
      doc.text("Total de personas capacitadas:", margin + 5, tableY + 40);
      doc.rect(pageWidth - margin - 60, tableY + 35, 55, 8);

      // Save
      doc.save(`AnexoV-${formData.solicitante_entidad || 'Solicitud'}.pdf`);
    } catch (error) { 
      console.error(error);
      toast({ variant: "destructive", title: "Error al generar PDF" }); 
    } finally { 
      setIsGeneratingPdf(false); 
    }
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhotoDataUri(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!firestore || !user) return;
    if (!formData.solicitante_entidad || !formData.lugar_local || !formData.nombre_completo) {
      toast({ variant: "destructive", title: "Faltan datos", description: "Complete los campos requeridos." });
      return;
    }

    setIsSubmitting(true);
    const docData = {
      ...formData,
      departamento: user.profile?.departamento || '',
      distrito: user.profile?.distrito || '',
      foto_firma: photoDataUri || '',
      usuario_id: user.uid,
      fecha_creacion: new Date().toISOString(),
      server_timestamp: serverTimestamp(),
    };

    try {
      await addDoc(collection(firestore, 'solicitudes-capacitacion'), docData);
      toast({ title: "¡Solicitud Registrada!", description: "La actividad ha sido agendada correctamente." });
      setFormData(p => ({ ...p, solicitante_entidad: '', lugar_local: '', nombre_completo: '', cedula: '', telefono: '', direccion_calle: '', barrio_compania: '' }));
      setPhotoDataUri(null);
    } catch (error) {
      const contextualError = new FirestorePermissionError({
        path: 'solicitudes-capacitacion',
        operation: 'create',
        requestResourceData: docData
      });
      errorEmitter.emit('permission-error', contextualError);
    } finally { setIsSubmitting(false); }
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <Header title="Registro de Solicitud - Anexo V" />
      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
        
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase text-primary tracking-tight">Nueva Solicitud</h1>
            <p className="text-muted-foreground font-medium">Proforma oficial de solicitud de capacitación (Anexo V).</p>
          </div>
          <Button onClick={generatePdf} variant="outline" size="lg" className="border-primary text-primary font-black uppercase" disabled={isGeneratingPdf}>
            {isGeneratingPdf ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <FileText className="mr-2 h-4 w-4" />}
            Vista Previa PDF
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Formulario Principal */}
          <Card className="lg:col-span-2 shadow-xl border-t-4 border-t-primary">
            <CardHeader className="bg-primary/5">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <FileText className="h-4 w-4" /> Datos de la Actividad
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Grupo Político Solicitante</Label>
                  <div className="flex gap-2">
                    <Popover open={isPartyPopoverOpen} onOpenChange={setIsPartyPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={isPartyPopoverOpen}
                          className="flex-1 justify-between text-left font-bold border-2 h-10 overflow-hidden"
                        >
                          {formData.solicitante_entidad || "Seleccionar partido..."}
                          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar partido o movimiento..." />
                          <CommandList>
                            <CommandEmpty>
                              <div className="p-4 text-center">
                                <p className="text-xs text-muted-foreground mb-2">No se encontró el partido.</p>
                                <Button size="sm" onClick={() => setIsPartyPopoverOpen(false)} className="text-[10px] font-bold uppercase">Ingresar manualmente</Button>
                              </div>
                            </CommandEmpty>
                            <CommandGroup heading="Lista Oficial">
                              {partidosData?.map((partido) => (
                                <CommandItem
                                  key={partido.id}
                                  value={partido.nombre}
                                  onSelect={(currentValue) => {
                                    setFormData(p => ({ ...p, solicitante_entidad: currentValue }));
                                    setIsPartyPopoverOpen(false);
                                  }}
                                  className="text-xs uppercase font-bold"
                                >
                                  {partido.nombre} {partido.siglas && `(${partido.siglas})`}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {formData.solicitante_entidad && (
                      <Button variant="ghost" size="icon" onClick={() => setFormData(p => ({ ...p, solicitante_entidad: '' }))}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {!partidosData?.length && (
                    <Input 
                      name="solicitante_entidad" 
                      value={formData.solicitante_entidad} 
                      onChange={handleInputChange} 
                      placeholder="Ej: Asociación Nacional Republicana, PLRA, etc." 
                      className="font-bold border-2"
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3 p-4 rounded-lg bg-muted/30 border border-dashed">
                    <Label className="text-[10px] font-black uppercase text-primary">Tipo de Solicitud</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="t-div" checked={formData.tipo_solicitud === 'divulgacion'} onCheckedChange={() => handleTypeChange('divulgacion')} />
                        <label htmlFor="t-div" className="text-xs font-bold leading-none cursor-pointer">Divulgación (Máquina de Votación)</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="t-cap" checked={formData.tipo_solicitud === 'capacitacion'} onCheckedChange={() => handleTypeChange('capacitacion')} />
                        <label htmlFor="t-cap" className="text-xs font-bold leading-none cursor-pointer">Capacitación (Miembros de Mesa)</label>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Fecha Propuesta</Label>
                      <Input name="fecha" type="date" value={formData.fecha} onChange={handleInputChange} className="font-bold" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Horario Desde</Label>
                        <Input name="hora_desde" type="time" value={formData.hora_desde} onChange={handleInputChange} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Horario Hasta</Label>
                        <Input name="hora_hasta" type="time" value={formData.hora_hasta} onChange={handleInputChange} />
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Lugar y/o Local</Label>
                    <Input name="lugar_local" value={formData.lugar_local} onChange={handleInputChange} placeholder="Nombre del local o punto de encuentro" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Dirección (Calle)</Label>
                    <Input name="direccion_calle" value={formData.direccion_calle} onChange={handleInputChange} placeholder="Nombre de la calle" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Barrio - Compañía</Label>
                    <Input name="barrio_compania" value={formData.barrio_compania} onChange={handleInputChange} placeholder="Nombre del barrio" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Distrito (Asignado)</Label>
                    <Input value={user?.profile?.distrito || ''} readOnly className="bg-muted font-bold" />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label className="text-xs font-black uppercase tracking-widest text-primary">Datos del Solicitante</Label>
                  <RadioGroup value={formData.rol_solicitante} onValueChange={(v: any) => setFormData(p => ({ ...p, rol_solicitante: v }))} className="flex gap-4 mb-4">
                    <div className="flex items-center space-x-2 bg-muted/50 px-3 py-2 rounded-md border">
                      <RadioGroupItem value="apoderado" id="r-apo" />
                      <Label htmlFor="r-apo" className="text-xs font-bold cursor-pointer">APODERADO</Label>
                    </div>
                    <div className="flex items-center space-x-2 bg-muted/50 px-3 py-2 rounded-md border">
                      <RadioGroupItem value="otro" id="r-otro" />
                      <Label htmlFor="r-otro" className="text-xs font-bold cursor-pointer">OTRO</Label>
                    </div>
                  </RadioGroup>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Nombre Completo</Label>
                      <Input name="nombre_completo" value={formData.nombre_completo} onChange={handleInputChange} placeholder="Nombre y Apellido" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">C.I.C. N.º</Label>
                      <Input name="cedula" value={formData.cedula} onChange={handleInputChange} placeholder="Ej: 1.234.567" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Número de Contacto</Label>
                      <Input name="telefono" value={formData.telefono} onChange={handleInputChange} placeholder="Celular o Línea Baja" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/5 border-t p-6">
              <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full h-12 font-black uppercase text-lg shadow-lg">
                {isSubmitting ? <><Loader2 className="animate-spin mr-2" /> GUARDANDO...</> : "GUARDAR Y AGENDAR ACTIVIDAD"}
              </Button>
            </CardFooter>
          </Card>

          {/* Panel Lateral: Mapa y Multimedia */}
          <div className="space-y-6">
            <Card className="shadow-md">
              <CardHeader className="py-4">
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" /> Georreferenciación
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="relative aspect-square w-full">
                  <div ref={mapRef} className="h-full w-full" />
                  {!formData.gps && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-6 text-center z-[1000] pointer-events-none">
                      <div className="bg-white p-4 rounded-xl shadow-2xl">
                        <MousePointer2 className="h-8 w-8 text-primary mx-auto mb-2 animate-bounce" />
                        <p className="text-[10px] font-black uppercase text-primary">Doble clic en el mapa para marcar ubicación</p>
                      </div>
                    </div>
                  )}
                </div>
                {formData.gps && (
                  <div className="p-3 bg-primary/10 border-t flex items-center justify-between">
                    <p className="text-[9px] font-black text-primary uppercase">Coordenadas: {formData.gps}</p>
                    <Badge variant="outline" className="bg-white text-[8px] font-black">CAPTURADO</Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-md border-dashed border-2 bg-muted/20">
              <CardHeader className="py-4">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-center">Captura de Documento / Firma</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {photoDataUri ? (
                  <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden border-2 border-primary/20 shadow-inner bg-white">
                    <Image src={photoDataUri} alt="Documento" fill className="object-contain" />
                    <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-lg" onClick={() => setPhotoDataUri(null)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    <label className="cursor-pointer bg-primary hover:bg-primary/90 text-white p-4 rounded-xl text-center shadow-md transition-all flex flex-col items-center gap-2">
                      <Camera className="h-6 w-6" />
                      <span className="text-[10px] font-black uppercase">Cámara (Documento Firmado)</span>
                      <Input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
                    </label>
                    <label className="cursor-pointer bg-white border-2 border-primary/20 hover:border-primary text-primary p-4 rounded-xl text-center transition-all flex flex-col items-center gap-2">
                      <Upload className="h-6 w-6" />
                      <span className="text-[10px] font-black uppercase">Subir desde Galería</span>
                      <Input type="file" accept="image/*" className="hidden" onChange={handlePhotoCapture} />
                    </label>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </main>
    </div>
  );
}
