"use client";

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, FileText, Camera, CheckCircle2, RefreshCw, MousePointer2, Upload, FileImage } from 'lucide-react';
import { useUser, useFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export default function SolicitudCapacitacionPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    solicitante_entidad: '',
    tipo_solicitud: 'divulgacion',
    fecha: '',
    hora_desde: '',
    hora_hasta: '',
    lugar_local: '',
    direccion_calle: '',
    barrio_compania: '',
    rol_solicitante: 'apoderado',
    nombre_completo: '',
    cedula: '',
    telefono: '',
    gps: '',
  });

  const [coords, setCoords] = useState<{ lat: string; lng: string }>({ lat: '', lng: '' });
  const [pdfGenerated, setPdfGenerated] = useState(false);
  const [photoDataUri, setPhotoDataUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;
    const initMap = async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
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
          const map = L.map(mapRef.current, { 
            center: defaultPos, 
            zoom: 15, 
            doubleClickZoom: false, 
            attributionControl: false 
          });
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
          
          map.on('dblclick', (e: any) => {
            const { lat, lng } = e.latlng;
            const latStr = lat.toFixed(6);
            const lngStr = lng.toFixed(6);
            setCoords({ lat: latStr, lng: lngStr });
            setFormData(prev => ({ ...prev, gps: `${latStr}, ${lngStr}` }));
            if (markerRef.current) { 
              markerRef.current.setLatLng(e.latlng); 
            } else { 
              markerRef.current = L.marker(e.latlng).addTo(map); 
            }
          });

          const inv = setInterval(() => map.invalidateSize(), 500);
          setTimeout(() => clearInterval(inv), 3000);
          
          leafletMap.current = map;
        } catch (error) { 
          console.error("Error al inicializar el mapa:", error); 
        }
      }
    };
    initMap();
    return () => {
      isMounted = false;
      if (leafletMap.current) { 
        leafletMap.current.remove(); 
        leafletMap.current = null; 
      }
    };
  }, []);

  const handleInputChange = (e: any) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const generatePdf = async () => {
    if (!formData.solicitante_entidad || !formData.fecha || !formData.direccion_calle || !formData.nombre_completo || !formData.cedula || !formData.gps) {
      toast({ variant: "destructive", title: "Faltan datos", description: "Completa el formulario y marca la ubicación en el mapa." });
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF();
      const margin = 15;
      
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text("Justicia Electoral", 105, 12, { align: "center" });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text("Custodio de la Voluntad Popular", 105, 16, { align: "center" });
      
      doc.setFillColor(230, 230, 220);
      doc.rect(margin, 20, 180, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text("ANEXO V – PROFORMA DE SOLICITUD", 105, 24.5, { align: "center" });

      const today = new Date();
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`${user?.profile?.distrito || ''}, ${today.getDate()} de ${today.toLocaleString('es-ES', { month: 'long' })} de ${today.getFullYear()}`, 195, 35, { align: "right" });

      doc.text("Señores", margin, 42);
      doc.setFont('helvetica', 'bold');
      doc.text("JEFES DEL REGISTRO ELECTORAL", margin, 46);
      doc.line(margin, 47.5, 80, 47.5);
      doc.text("Presente:", margin, 54);

      doc.setFont('helvetica', 'normal');
      doc.text(`Tengo el agrado de dirigirme a usted/es, en representación de ${formData.solicitante_entidad.toUpperCase()},`, margin, 62);
      doc.text("en virtud a las próximas Elecciones Internas simultáneas de las Organizaciones Políticas", margin, 66);
      doc.text(`del 07 de junio del 2026, a los efectos de solicitar:`, margin, 70);

      const isDiv = formData.tipo_solicitud === 'divulgacion';
      const isCap = formData.tipo_solicitud === 'capacitacion';
      
      doc.rect(25, 76, 4, 4); if(isDiv) doc.text("X", 26, 79.2);
      doc.text("Divulgación sobre el uso de la Máquina de Votación Electrónica.", 32, 79.2);
      
      doc.rect(25, 83, 4, 4); if(isCap) doc.text("X", 26, 86.2);
      doc.text("Capacitación sobre las funciones de los miembros de mesa receptora de votos.", 32, 86.2);

      let tableY = 92;
      doc.setDrawColor(0);
      doc.setLineWidth(0.2);
      
      const drawRow = (label: string, value: string, y: number, h: number = 7) => {
        doc.line(margin, y, 195, y);
        doc.setFont('helvetica', 'bold');
        doc.text(label, margin + 2, y + 4.5);
        doc.text(":", margin + 45, y + 4.5);
        doc.setFont('helvetica', 'normal');
        doc.text(value, margin + 48, y + 4.5);
        doc.line(margin, y + h, 195, y + h);
        return y + h;
      };

      tableY = drawRow("FECHA", formData.fecha, tableY);
      
      doc.setFont('helvetica', 'bold');
      doc.text("HORARIO", margin + 2, tableY + 4.5);
      doc.text(":", margin + 45, tableY + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`DESDE: ${formData.hora_desde} hs`, margin + 48, tableY + 4.5);
      doc.text(`HASTA: ${formData.hora_hasta} hs`, margin + 100, tableY + 4.5);
      tableY += 7; doc.line(margin, tableY, 195, tableY);

      tableY = drawRow("LUGAR Y/O LOCAL", formData.lugar_local, tableY);
      tableY = drawRow("DIRECCIÓN (CALLE)", formData.direccion_calle, tableY);
      tableY = drawRow("BARRIO - COMPAÑÍA", formData.barrio_compania, tableY);
      tableY = drawRow("DISTRITO", user?.profile?.distrito || '', tableY);

      tableY += 8;
      const isApod = formData.rol_solicitante === 'apoderado';
      const isOtro = formData.rol_solicitante === 'otro';
      
      doc.setFont('helvetica', 'bold');
      doc.text("DATOS DEL SOLICITANTE – APODERADO", margin, tableY);
      doc.rect(margin + 75, tableY - 3.2, 4, 4); if(isApod) doc.text("X", margin + 76, tableY);
      doc.text("OTRO", margin + 85, tableY);
      doc.rect(margin + 98, tableY - 3.2, 4, 4); if(isOtro) doc.text("X", margin + 99, tableY);
      
      tableY += 4;
      tableY = drawRow("NOMBRE COMPLETO", formData.nombre_completo, tableY);
      tableY = drawRow("C.I.C. Nº", formData.cedula, tableY);
      tableY = drawRow("NÚMERO DE CONTACTO", formData.telefono, tableY);

      tableY += 2;
      doc.setFillColor(230, 230, 220);
      doc.rect(margin, tableY, 180, 5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.text("OBSERVACIÓN", 105, tableY + 3.5, { align: "center" });
      tableY += 5;
      doc.rect(margin, tableY, 180, 10);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'italic');
      doc.text("La recepción de solicitudes se realiza hasta 48 horas de antelación a la fecha del evento.", 105, tableY + 4, { align: "center" });
      doc.text("En caso de cancelación de la actividad debe informarse con 24 horas de anticipación.", 105, tableY + 7.5, { align: "center" });

      tableY += 14;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text("Se hace propicia la ocasión para saludarle muy cordialmente.", margin, tableY);
      
      tableY += 15;
      doc.text("Firma del Solicitante: ____________________________________________", 105, tableY, { align: "center" });

      tableY += 6;
      doc.setLineWidth(0.3);
      doc.rect(margin, tableY, 180, 40);
      doc.setFont('helvetica', 'bold');
      doc.text("ESPACIO PARA USO INTERNO DE LA JUSTICIA ELECTORAL", 105, tableY + 6, { align: "center" });
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text("Divulgador designado: _______________________________________", margin + 5, tableY + 15);
      doc.text("C.I.C. Nº: _____________", margin + 130, tableY + 15);
      
      doc.text("Código de la Máquina de Votación asignada: ___________________________________________", margin + 5, tableY + 24);
      
      doc.text("Firma y sello del Jefe del Registro Electoral: ________________________", 105, tableY + 32, { align: "center" });
      
      doc.setFontSize(7.5);
      doc.text("Total de personas capacitadas:", margin + 5, tableY + 37);
      doc.rect(margin + 45, tableY + 34.5, 20, 3.5);

      if (mapRef.current) {
        doc.addPage();
        const canvas = await html2canvas(mapRef.current, { useCORS: true, logging: false, scale: 2 });
        const mapImgData = canvas.toDataURL('image/png');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text("ANEXO: GEORREFERENCIACIÓN DE LA UBICACIÓN SELECCIONADA", 105, 20, { align: "center" });
        doc.addImage(mapImgData, 'PNG', margin, 30, 180, 100);
        doc.setFont('helvetica', 'normal');
        doc.text(`Ubicación GPS: ${formData.gps}`, margin, 140);
      }

      doc.save(`Solicitud-AnexoV-${formData.cedula}.pdf`);
      setPdfGenerated(true);
      toast({ title: "Documento Generado", description: "El Anexo V está listo para imprimir y ser firmado." });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo generar el documento oficial." });
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
    
    setIsSubmitting(true);
    try {
      const solicitudData = {
        ...formData,
        departamento: user.profile?.departamento || '',
        distrito: user.profile?.distrito || '',
        foto_firma: photoDataUri || '',
        usuario_id: user.uid,
        fecha_creacion: new Date().toISOString(),
        server_timestamp: serverTimestamp(),
      };
      await addDoc(collection(firestore, 'solicitudes-capacitacion'), solicitudData);
      toast({ title: "¡Solicitud Guardada!", description: "La capacitación ha sido agendada correctamente en el sistema." });
      
      setFormData({ 
        solicitante_entidad: '', 
        tipo_solicitud: 'divulgacion', 
        fecha: '', 
        hora_desde: '', 
        hora_hasta: '', 
        lugar_local: '', 
        direccion_calle: '', 
        barrio_compania: '', 
        rol_solicitante: 'apoderado', 
        nombre_completo: '', 
        cedula: '', 
        telefono: '', 
        gps: '' 
      });
      setCoords({ lat: '', lng: '' }); 
      setPhotoDataUri(null); 
      setPdfGenerated(false);
      if (markerRef.current) { 
        markerRef.current.remove(); 
        markerRef.current = null; 
      }
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la solicitud en la base de datos." });
    } finally { 
      setIsSubmitting(false); 
    }
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <Header title="Nueva Solicitud de Capacitación" />
      <main className="flex-1 p-4 md:p-8">
        <Card className="mx-auto max-w-4xl shadow-xl border-t-4 border-t-primary">
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Proforma de Solicitud (Anexo V)
            </CardTitle>
            <CardDescription>Complete los datos del solicitante para generar el documento oficial.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 pt-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-primary font-bold">Departamento Asignado</Label>
                <Input value={user?.profile?.departamento || ''} disabled className="bg-muted font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="text-primary font-bold">Distrito Asignado</Label>
                <Input value={user?.profile?.distrito || ''} disabled className="bg-muted font-bold" />
              </div>
            </div>

            <Separator />

            <div className="space-y-6">
              <div className="space-y-4">
                <Label className="text-lg font-bold">1. Datos de la Solicitud</Label>
                <div className="space-y-2">
                  <Label htmlFor="solicitante_entidad">PARTIDO POLITICO / MOVIMIENTO POLITICO (Solicitante)</Label>
                  <Input id="solicitante_entidad" name="solicitante_entidad" value={formData.solicitante_entidad} onChange={handleInputChange} placeholder="Nombre de la entidad solicitante" />
                </div>
                <div className="space-y-3">
                  <Label>Tipo de Servicio Solicitado:</Label>
                  <RadioGroup defaultValue="divulgacion" onValueChange={(v) => setFormData(p => ({...p, tipo_solicitud: v as any}))}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="divulgacion" id="div" />
                      <Label htmlFor="div">Divulgación sobre el uso de la Máquina de Votación</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="capacitacion" id="cap" />
                      <Label htmlFor="cap">Capacitación sobre funciones de Miembros de Mesa</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="fecha">Fecha</Label>
                  <Input id="fecha" name="fecha" type="date" value={formData.fecha} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hora_desde">Horario DESDE (hs)</Label>
                  <Input id="hora_desde" name="hora_desde" type="time" value={formData.hora_desde} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hora_hasta">Horario HASTA (hs)</Label>
                  <Input id="hora_hasta" name="hora_hasta" type="time" value={formData.hora_hasta} onChange={handleInputChange} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="lugar_local">Dirección (Lugar y/o Local)</Label>
                  <Input id="lugar_local" name="lugar_local" value={formData.lugar_local} onChange={handleInputChange} placeholder="Ej: Seccional, Club, Domicilio..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="direccion_calle">Dirección (Calle y Nro)</Label>
                  <Input id="direccion_calle" name="direccion_calle" value={formData.direccion_calle} onChange={handleInputChange} placeholder="Calle principal y numeración" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barrio_compania">BARRIO - COMPAÑÍA</Label>
                  <Input id="barrio_compania" name="barrio_compania" value={formData.barrio_compania} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label>DISTRITO</Label>
                  <Input value={user?.profile?.distrito || ''} disabled className="bg-muted" />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-lg font-bold">2. Datos del Solicitante</Label>
                <div className="flex gap-6 items-center">
                  <Label>El solicitante es:</Label>
                  <RadioGroup defaultValue="apoderado" className="flex gap-4" onValueChange={(v) => setFormData(p => ({...p, rol_solicitante: v as any}))}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="apoderado" id="apod" />
                      <Label htmlFor="apod">APODERADO</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="otro" id="otro" />
                      <Label htmlFor="otro">OTRO</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="nombre_completo">NOMBRE COMPLETO</Label>
                    <Input id="nombre_completo" name="nombre_completo" value={formData.nombre_completo} onChange={handleInputChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cedula">C.I.C. N°</Label>
                    <Input id="cedula" name="cedula" value={formData.cedula} onChange={handleInputChange} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="telefono">NÚMERO DE CONTACTO (CELULAR - LÍNEA BAJA)</Label>
                    <Input id="telefono" name="telefono" value={formData.telefono} onChange={handleInputChange} />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 border rounded-xl p-5 bg-background shadow-inner">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary font-bold">
                  <MapPin className="h-5 w-5" />
                  <span className="uppercase text-xs tracking-widest">Georeferenciación (Doble Clic)</span>
                </div>
                <Badge variant="secondary" className="gap-1 px-3 py-1">
                  <MousePointer2 className="h-3 w-3" />
                  <span className="text-[10px] font-bold uppercase">Fijar Ubicación</span>
                </Badge>
              </div>
              <div className="relative w-full rounded-xl overflow-hidden border-2 border-primary/10 shadow-sm bg-muted" style={{ height: '400px' }}>
                <div ref={mapRef} className="h-full w-full" style={{ zIndex: 0 }} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">Latitud</Label>
                  <Input readOnly value={coords.lat} placeholder="0.000000" className="bg-muted/50 text-center font-mono text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">Longitud</Label>
                  <Input readOnly value={coords.lng} placeholder="0.000000" className="bg-muted/50 text-center font-mono text-xs" />
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-6 py-4">
              <Button onClick={generatePdf} className="w-full sm:w-auto px-8 h-12 text-md font-bold" variant="outline" disabled={isGeneratingPdf}>
                {isGeneratingPdf ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> GENERANDO PDF...</> : <><FileText className="mr-2 h-5 w-5" /> GENERAR ANEXO V (PDF)</>}
              </Button>
              
              <div className="w-full space-y-6">
                <div className="rounded-2xl border-4 border-dashed border-primary/20 p-8 bg-primary/5 flex flex-col items-center text-center">
                  <Upload className="h-10 w-10 text-primary mb-4" />
                  <Label className="block mb-2 text-xl font-black text-primary uppercase">Alzar Solicitud Firmada</Label>
                  <p className="text-xs text-muted-foreground mb-6 uppercase font-bold tracking-tight">Adjunta una foto o captura desde tu dispositivo</p>
                  
                  {photoDataUri ? (
                    <div className="relative group w-full max-w-[280px] overflow-hidden rounded-2xl border-4 border-white shadow-2xl">
                      <Image src={photoDataUri} alt="Firma" width={280} height={370} className="object-cover aspect-[3/4]" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                         <Button variant="destructive" size="sm" className="rounded-full gap-2" onClick={() => setPhotoDataUri(null)}><RefreshCw className="h-4 w-4" /> REPETIR</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap justify-center gap-4">
                        <label htmlFor="photo-select" className="cursor-pointer group relative">
                          <div className="inline-flex h-14 items-center justify-center rounded-full bg-primary px-8 py-4 text-sm font-black text-white shadow-lg transition-all hover:scale-105 active:scale-95">
                            <Upload className="mr-2 h-5 w-5" /> GALERÍA
                          </div>
                          <Input id="photo-select" type="file" accept="image/*" className="hidden" onChange={handlePhotoCapture} />
                        </label>
                        
                        <label htmlFor="photo-capture" className="cursor-pointer group relative">
                          <div className="inline-flex h-14 items-center justify-center rounded-full border-2 border-primary px-8 py-4 text-sm font-black text-primary shadow-lg transition-all hover:scale-105 active:scale-95">
                            <Camera className="mr-2 h-5 w-5" /> CÁMARA
                          </div>
                          <Input id="photo-capture" type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
                        </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-muted/30 border-t p-6">
            <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full h-16 text-xl font-black uppercase shadow-xl" size="lg">
              {isSubmitting ? <><Loader2 className="animate-spin mr-3 h-7 w-7" /> GUARDANDO...</> : <><CheckCircle2 className="mr-3 h-7 w-7" /> FINALIZAR Y AGENDAR</>}
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
