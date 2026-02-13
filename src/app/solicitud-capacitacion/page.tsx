
"use client";

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, FileText, Camera, CheckCircle2, RefreshCw, MousePointer2, FileImage } from 'lucide-react';
import { useUser, useFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { type SolicitudCapacitacion } from '@/lib/data';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';

export default function SolicitudCapacitacionPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    solicitante: '',
    cedula: '',
    nombre_apellido: '',
    fecha: '',
    hora: '',
    lugar: '',
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
      await new Promise(resolve => setTimeout(resolve, 100));

      if (typeof window !== 'undefined' && mapRef.current && !leafletMap.current) {
        try {
          const L = (await import('leaflet')).default;
          
          if (!isMounted || !mapRef.current) return;

          // Punto de inicio: TSJE, Asunción, Paraguay
          const defaultPos: [number, number] = [-25.3006, -57.6359];
          
          const map = L.map(mapRef.current, {
            center: defaultPos,
            zoom: 15,
            doubleClickZoom: false,
            attributionControl: false
          });
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap'
          }).addTo(map);

          const customIcon = L.icon({
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          });

          map.on('dblclick', (e: any) => {
            const { lat, lng } = e.latlng;
            const latStr = lat.toFixed(6);
            const lngStr = lng.toFixed(6);
            
            setCoords({ lat: latStr, lng: lngStr });
            setFormData(prev => ({ ...prev, gps: `${latStr}, ${lngStr}` }));

            if (markerRef.current) {
              markerRef.current.setLatLng(e.latlng);
            } else {
              markerRef.current = L.marker(e.latlng, { icon: customIcon }).addTo(map);
            }
          });

          setTimeout(() => {
            map.invalidateSize();
          }, 500);

          leafletMap.current = map;
        } catch (error) {
          console.error("Error initializing Leaflet map:", error);
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const generatePdf = async () => {
    if (!formData.solicitante || !formData.cedula || !formData.nombre_apellido || !formData.fecha || !formData.hora || !formData.lugar) {
      toast({ variant: "destructive", title: "Faltan datos", description: "Por favor completa todos los campos del formulario antes de generar el PDF." });
      return;
    }

    if (!formData.gps) {
      toast({ variant: "destructive", title: "Ubicación requerida", description: "Debes marcar la ubicación en el mapa (doble clic) antes de generar el PDF." });
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF();
      const margin = 20;
      let y = 30;

      // Header
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text("SOLICITUD DE CAPACITACIÓN", 105, y, { align: "center" });
      y += 20;

      // Personal Data
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Solicitante (PARTIDO/MOVIMIENTO): ${formData.solicitante}`, margin, y); y += 10;
      doc.text(`N° de Cédula: ${formData.cedula}`, margin, y); y += 10;
      doc.text(`Nombre y Apellido: ${formData.nombre_apellido}`, margin, y); y += 15;
      
      doc.setFont('helvetica', 'bold');
      doc.text("DATOS DE ASIGNACIÓN:", margin, y); y += 8;
      doc.setFont('helvetica', 'normal');
      doc.text(`Departamento: ${user?.profile?.departamento || 'No asignado'}`, margin, y); y += 8;
      doc.text(`Distrito: ${user?.profile?.distrito || 'No asignado'}`, margin, y); y += 15;
      
      doc.setFont('helvetica', 'bold');
      doc.text("DETALLES DE LA CAPACITACIÓN:", margin, y); y += 8;
      doc.setFont('helvetica', 'normal');
      doc.text(`Fecha Solicitada: ${formData.fecha}`, margin, y); y += 8;
      doc.text(`Hora: ${formData.hora}`, margin, y); y += 8;
      doc.text(`Lugar: ${formData.lugar}`, margin, y); y += 8;
      doc.text(`Coordenadas GPS: ${formData.gps}`, margin, y); y += 15;

      // Capture Map
      if (mapRef.current) {
        const canvas = await html2canvas(mapRef.current, { 
          useCORS: true,
          logging: false,
          scale: 2
        });
        const mapImgData = canvas.toDataURL('image/png');
        doc.setFont('helvetica', 'bold');
        doc.text("CAPTURA DE UBICACIÓN:", margin, y); y += 5;
        doc.addImage(mapImgData, 'PNG', margin, y, 170, 80);
        y += 90;
      }

      // Signature area
      if (y > 240) {
        doc.addPage();
        y = 30;
      }
      
      doc.text("__________________________", 105, y + 40, { align: "center" });
      doc.text("Firma del Solicitante", 105, y + 50, { align: "center" });

      doc.save(`Solicitud-Capacitacion-${formData.cedula}.pdf`);
      setPdfGenerated(true);
      toast({ title: "PDF Generado con éxito", description: "Imprime el documento, solicita la firma y luego captura la foto." });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo generar el PDF con la captura del mapa." });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoDataUri(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!firestore || !user || !user.profile) return;
    if (!photoDataUri) {
      toast({ variant: "destructive", title: "Foto requerida", description: "Es obligatorio adjuntar la foto de la solicitud firmada." });
      return;
    }

    setIsSubmitting(true);
    try {
      const solicitudData = {
        ...formData,
        foto_firma: photoDataUri,
        departamento: user.profile.departamento,
        distrito: user.profile.distrito,
        usuario_id: user.uid,
        fecha_creacion: new Date().toISOString(),
        server_timestamp: serverTimestamp(),
      };

      await addDoc(collection(firestore, 'solicitudes-capacitacion'), solicitudData);
      
      toast({ title: "¡Capacitación Agendada!", description: "La solicitud se ha guardado correctamente en la base de datos." });
      
      setFormData({
        solicitante: '',
        cedula: '',
        nombre_apellido: '',
        fecha: '',
        hora: '',
        lugar: '',
        gps: '',
      });
      setCoords({ lat: '', lng: '' });
      setPhotoDataUri(null);
      setPdfGenerated(false);
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    } catch (error) {
      console.error("Error saving request:", error);
      toast({ variant: "destructive", title: "Error al guardar", description: "No se pudo procesar la solicitud. Inténtalo de nuevo." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <Header title="Nueva Solicitud de Capacitación" />
      <main className="flex-1 p-4 md:p-8">
        <Card className="mx-auto max-w-3xl shadow-xl border-t-4 border-t-primary">
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Formulario de Solicitud
            </CardTitle>
            <CardDescription>Completa todos los campos. Los datos se guardarán automáticamente en la base de datos al finalizar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 pt-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="departamento-view" className="text-primary font-bold">Departamento Asignado</Label>
                <Input id="departamento-view" value={user?.profile?.departamento || 'Sin asignar'} disabled className="bg-muted font-bold border-primary/20" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="distrito-view" className="text-primary font-bold">Distrito Asignado</Label>
                <Input id="distrito-view" value={user?.profile?.distrito || 'Sin asignar'} disabled className="bg-muted font-bold border-primary/20" />
              </div>
            </div>

            <Separator />

            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="solicitante">Solicitante (PARTIDO/MOVIMIENTO POLÍTICO)</Label>
                  <Input id="solicitante" name="solicitante" value={formData.solicitante} onChange={handleInputChange} placeholder="Ej: ANR, PLRA, etc." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cedula">N° de Cédula</Label>
                  <Input id="cedula" name="cedula" value={formData.cedula} onChange={handleInputChange} placeholder="Documento del responsable" />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="nombre_apellido">Nombre y Apellido del Responsable</Label>
                <Input id="nombre_apellido" name="nombre_apellido" value={formData.nombre_apellido} onChange={handleInputChange} placeholder="Nombre completo" />
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fecha">Fecha de Capacitación</Label>
                  <Input id="fecha" name="fecha" type="date" value={formData.fecha} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hora">Hora</Label>
                  <Input id="hora" name="hora" type="time" value={formData.hora} onChange={handleInputChange} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lugar">Lugar de Realización</Label>
                <Input id="lugar" name="lugar" value={formData.lugar} onChange={handleInputChange} placeholder="Dirección, Escuela o Local" />
              </div>
            </div>

            <div className="space-y-4 border rounded-xl p-5 bg-background shadow-inner">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary font-bold">
                  <MapPin className="h-5 w-5" />
                  <span className="uppercase text-xs tracking-widest">Georeferenciación (Doble Clic en Mapa)</span>
                </div>
                <Badge variant="secondary" className="gap-1 px-3 py-1">
                  <MousePointer2 className="h-3 w-3" />
                  <span className="text-[10px] font-bold uppercase">Fijar Ubicación</span>
                </Badge>
              </div>
              
              <div className="relative aspect-video w-full rounded-xl overflow-hidden border-2 border-primary/10 shadow-sm" style={{ minHeight: '320px' }}>
                <div ref={mapRef} className="absolute inset-0 z-0 h-full w-full" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Latitud</Label>
                  <Input readOnly value={coords.lat} placeholder="0.000000" className="bg-muted/50 border-dashed text-center font-mono text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Longitud</Label>
                  <Input readOnly value={coords.lng} placeholder="0.000000" className="bg-muted/50 border-dashed text-center font-mono text-xs" />
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col items-center gap-6 py-4">
              <Button 
                onClick={generatePdf} 
                className="w-full sm:w-auto px-8 h-12 text-md font-bold transition-all hover:scale-105" 
                variant="outline"
                disabled={isGeneratingPdf}
              >
                {isGeneratingPdf ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> CAPTURANDO MAPA Y GENERANDO PDF...</>
                ) : (
                  <><FileText className="mr-2 h-5 w-5" /> GENERAR SOLICITUD EN PDF CON MAPA</>
                )}
              </Button>
              
              {pdfGenerated && (
                <div className="w-full space-y-6 animate-in fade-in slide-in-from-top-4 duration-700">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-center gap-2 text-green-700 text-sm font-medium">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>PDF generado con la ubicación. Favor imprimir, firmar y capturar la imagen debajo.</span>
                  </div>

                  <div className="rounded-2xl border-4 border-dashed border-primary/20 p-8 bg-primary/5 relative flex flex-col items-center text-center">
                    <div className="mb-4 bg-primary/10 p-3 rounded-full">
                      <Camera className="h-10 w-10 text-primary" />
                    </div>
                    <Label className="block mb-2 text-xl font-black text-primary uppercase tracking-tight">
                      Capturar Imagen de la Solicitud Física Firmada
                    </Label>
                    <p className="text-sm text-muted-foreground mb-8 max-w-sm">
                      Usa la cámara de tu dispositivo para capturar una foto clara de la solicitud con la firma del responsable.
                    </p>

                    {photoDataUri ? (
                      <div className="relative group w-full max-w-[280px] overflow-hidden rounded-2xl border-4 border-white shadow-2xl transition-transform hover:scale-[1.02]">
                        <Image src={photoDataUri} alt="Vista previa de la firma" width={280} height={370} className="object-cover aspect-[3/4]" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                           <Button variant="destructive" size="sm" className="rounded-full gap-2" onClick={() => setPhotoDataUri(null)}>
                             <RefreshCw className="h-4 w-4" /> REPETIR CAPTURA
                           </Button>
                        </div>
                      </div>
                    ) : (
                      <label htmlFor="photo-upload" className="cursor-pointer group relative">
                        <div className="inline-flex h-16 items-center justify-center rounded-full bg-primary px-10 py-4 text-md font-black text-white shadow-[0_10px_20px_-5px_rgba(var(--primary),0.4)] transition-all group-hover:scale-105 group-hover:shadow-[0_15px_30px_-5px_rgba(var(--primary),0.5)] active:scale-95">
                          <Camera className="mr-3 h-6 w-6" />
                          INICIAR CÁMARA / SUBIR FOTO
                        </div>
                        <Input id="photo-upload" type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="bg-muted/30 border-t p-6">
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting || !photoDataUri} 
              className="w-full h-16 text-xl font-black uppercase tracking-wider shadow-xl disabled:bg-muted-foreground/30" 
              size="lg"
            >
              {isSubmitting ? (
                <><Loader2 className="animate-spin mr-3 h-7 w-7" /> PROCESANDO...</>
              ) : (
                <><CheckCircle2 className="mr-3 h-7 w-7" /> FINALIZAR Y GUARDAR EN BASE DE DATOS</>
              )}
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
