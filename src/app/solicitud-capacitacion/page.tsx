
"use client";

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, FileText, Camera, CheckCircle2, RefreshCw, MousePointer2 } from 'lucide-react';
import { useUser, useFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import jsPDF from 'jspdf';
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
  
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      // Pequeño retraso para asegurar que el DOM esté completamente listo y el CSS aplicado
      await new Promise(resolve => setTimeout(resolve, 100));

      if (typeof window !== 'undefined' && mapRef.current && !leafletMap.current) {
        try {
          const L = (await import('leaflet')).default;
          
          if (!isMounted || !mapRef.current) return;

          // Ubicación predeterminada fija: Asunción, Paraguay (TSJE)
          const defaultPos: [number, number] = [-25.3006, -57.6359];
          
          const map = L.map(mapRef.current, {
            center: defaultPos,
            zoom: 15,
            doubleClickZoom: false
          });
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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

          // Forzar el redibujado para corregir problemas de visualización inicial
          setTimeout(() => {
            map.invalidateSize();
          }, 200);

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

  const generatePdf = () => {
    if (!formData.solicitante || !formData.cedula || !formData.nombre_apellido) {
      toast({ variant: "destructive", title: "Faltan datos", description: "Por favor completa los datos básicos." });
      return;
    }

    const doc = new jsPDF();
    const margin = 20;
    let y = 30;

    doc.setFontSize(18);
    doc.text("SOLICITUD DE CAPACITACIÓN", 105, y, { align: "center" });
    y += 20;

    doc.setFontSize(12);
    doc.text(`Solicitante: ${formData.solicitante}`, margin, y); y += 10;
    doc.text(`N° de Cédula: ${formData.cedula}`, margin, y); y += 10;
    doc.text(`Nombre y Apellido: ${formData.nombre_apellido}`, margin, y); y += 15;
    
    doc.text(`Fecha Solicitada: ${formData.fecha}`, margin, y); y += 10;
    doc.text(`Hora: ${formData.hora}`, margin, y); y += 10;
    doc.text(`Lugar: ${formData.lugar}`, margin, y); y += 10;
    doc.text(`Coordenadas GPS: ${formData.gps}`, margin, y); y += 20;

    doc.text("__________________________", 105, y + 40, { align: "center" });
    doc.text("Firma del Solicitante", 105, y + 50, { align: "center" });

    doc.save(`Solicitud-${formData.cedula}.pdf`);
    setPdfGenerated(true);
    toast({ title: "PDF Generado", description: "Ahora puedes imprimirlo, firmarlo y quitar una foto." });
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
      toast({ variant: "destructive", title: "Foto requerida", description: "Debes adjuntar la foto de la solicitud firmada." });
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
      
      toast({ title: "Solicitud Guardada", description: "La capacitación ha sido agendada con éxito." });
      
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
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la solicitud." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8"/></div>;

  return (
    <div className="flex min-h-screen flex-col">
      <Header title="Nueva Solicitud de Capacitación" />
      <main className="flex-1 p-4 md:p-8">
        <Card className="mx-auto max-w-3xl">
          <CardHeader>
            <CardTitle>Formulario de Solicitud</CardTitle>
            <CardDescription>Completa los datos. Usa el mapa para fijar la ubicación (Doble Clic).</CardDescription>
            {user?.profile?.departamento && user?.profile?.distrito && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary px-3 py-1">
                  <span className="font-bold mr-1">DPTO:</span> {user.profile.departamento}
                </Badge>
                <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary px-3 py-1">
                  <span className="font-bold mr-1">DIST:</span> {user.profile.distrito}
                </Badge>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="solicitante">Solicitante (Entidad/Referente)</Label>
                <Input id="solicitante" name="solicitante" value={formData.solicitante} onChange={handleInputChange} placeholder="Ej: Municipalidad de..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cedula">N° de Cédula</Label>
                <Input id="cedula" name="cedula" value={formData.cedula} onChange={handleInputChange} placeholder="Documento de identidad" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nombre_apellido">Nombre y Apellido del Solicitante</Label>
              <Input id="nombre_apellido" name="nombre_apellido" value={formData.nombre_apellido} onChange={handleInputChange} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <Input id="lugar" name="lugar" value={formData.lugar} onChange={handleInputChange} placeholder="Dirección o local" />
            </div>

            <div className="space-y-4 border rounded-xl p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary font-bold">
                  <MapPin className="h-5 w-5" />
                  <span className="uppercase text-sm tracking-wide">Ubicación en Mapa (Asunción)</span>
                </div>
                <Badge variant="outline" className="gap-1 px-3 py-1 bg-background">
                  <MousePointer2 className="h-3 w-3" />
                  <span className="text-[10px] font-bold uppercase">Doble clic para fijar</span>
                </Badge>
              </div>
              
              <div className="relative aspect-video w-full rounded-xl overflow-hidden border-2 shadow-sm bg-background" style={{ minHeight: '300px' }}>
                <div ref={mapRef} className="absolute inset-0 z-0 h-full w-full" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Latitud</Label>
                  <Input 
                    readOnly 
                    value={coords.lat} 
                    placeholder="Esperando ubicación..." 
                    className="bg-background border-dashed text-center text-sm font-mono" 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Longitud</Label>
                  <Input 
                    readOnly 
                    value={coords.lng} 
                    placeholder="Esperando ubicación..." 
                    className="bg-background border-dashed text-center text-sm font-mono" 
                  />
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            <div className="space-y-6 text-center">
              <Button onClick={generatePdf} className="w-full sm:w-auto shadow-md" variant="secondary">
                <FileText className="mr-2 h-4 w-4" />
                Generar Solicitud en PDF
              </Button>
              
              {pdfGenerated && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <p className="text-sm text-green-600 font-medium flex items-center justify-center mb-6">
                    <CheckCircle2 className="mr-1 h-4 w-4" /> PDF generado. Favor imprimir y firmar.
                  </p>

                  <div className="rounded-xl border-2 border-dashed p-8 bg-muted/20 relative">
                    <Label className="block mb-6 text-lg font-bold">Foto de la Solicitud Firmada</Label>
                    {photoDataUri ? (
                      <div className="relative mx-auto aspect-[3/4] max-w-[240px] overflow-hidden rounded-xl border-4 border-background shadow-xl">
                        <Image src={photoDataUri} alt="Firma" fill className="object-cover" />
                        <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-9 w-9 rounded-full shadow-lg" onClick={() => setPhotoDataUri(null)}>
                          <RefreshCw className="h-5 w-5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-6">
                        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-primary shadow-inner">
                          <Camera className="h-12 w-12" />
                        </div>
                        <label htmlFor="photo-upload" className="cursor-pointer group">
                          <div className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 py-2 text-sm font-bold text-primary-foreground shadow-lg transition-all group-hover:scale-105 group-hover:bg-primary/90">
                            QUITAR FOTO / SUBIR IMAGEN
                          </div>
                          <Input id="photo-upload" type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="pt-6">
            <Button onClick={handleSubmit} disabled={isSubmitting || !photoDataUri} className="w-full shadow-lg h-14 text-lg font-bold" size="lg">
              {isSubmitting ? <Loader2 className="animate-spin mr-2 h-6 w-6" /> : <CheckCircle2 className="mr-2 h-6 w-6" />}
              FINALIZAR Y AGENDAR SOLICITUD
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
