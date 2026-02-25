
'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText, Search, Building, Camera, Trash2, FileUp, X, Landmark, Navigation, MapPin, CheckCircle2 } from 'lucide-react';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, where, getDocs, limit } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn, formatDateToDDMMYYYY } from '@/lib/utils';
import { type PartidoPolitico, type Dato } from '@/lib/data';
import Image from 'next/image';
import jsPDF from 'jspdf';
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

import 'leaflet/dist/leaflet.css';
import 'leaflet-geosearch/dist/geosearch.css';

export default function SolicitudCapacitacionPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    solicitante_entidad: '',
    otra_entidad: '',
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
  const [isPartyPopoverOpen, setIsPartyPopoverOpen] = useState(false);
  const [isSearchingCedula, setIsSearchingCedula] = useState(false);
  const [padronFound, setPadronFound] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    const now = new Date();
    setFormData(prev => ({ ...prev, fecha: now.toISOString().split('T')[0] }));

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

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData } = useCollection<Dato>(datosQuery);

  const userJurisdiction = useMemo(() => {
    if (!user?.profile || !datosData) return null;
    return datosData.find(d => 
      d.departamento === user.profile?.departamento && 
      d.distrito === user.profile?.distrito
    );
  }, [user, datosData]);

  useEffect(() => {
    let map: any = null;
    const initMap = async () => {
      if (typeof window === 'undefined' || !mapContainerRef.current || mapInstanceRef.current) return;
      try {
        const LeafletModule = await import('leaflet');
        const L = LeafletModule.default || LeafletModule;
        const { OpenStreetMapProvider, GeoSearchControl } = await import('leaflet-geosearch');

        if (L.Icon.Default) {
          delete (L.Icon.Default.prototype as any)._getIconUrl;
          L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          });
        }

        const initialPos: [number, number] = [-25.311549, -57.653496];
        map = L.map(mapContainerRef.current, { center: initialPos, zoom: 13, doubleClickZoom: false });
        mapInstanceRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        const provider = new OpenStreetMapProvider();
        const searchControl = new (GeoSearchControl as any)({ provider, style: 'bar', showMarker: true });
        map.addControl(searchControl);

        map.on('geosearch/showlocation', (result: any) => {
          const { x, y } = result.location;
          setFormData(prev => ({ ...prev, gps: `${y.toFixed(6)}, ${x.toFixed(6)}` }));
          if (markerRef.current) map.removeLayer(markerRef.current);
          markerRef.current = L.marker([y, x]).addTo(map);
        });

        map.on('dblclick', (e: any) => {
          const { lat, lng } = e.latlng;
          setFormData(prev => ({ ...prev, gps: `${lat.toFixed(6)}, ${lng.toFixed(6)}` }));
          if (markerRef.current) map.removeLayer(markerRef.current);
          markerRef.current = L.marker([lat, lng]).addTo(map);
        });
        setTimeout(() => map.invalidateSize(), 500);
      } catch (err) { console.error(err); }
    };
    initMap();
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, []);

  const searchCedulaInPadron = useCallback(async (cedulaInput: string) => {
    const cleanTerm = (cedulaInput || '').trim().replace(/\D/g, ''); 
    if (!firestore || cleanTerm.length < 4) return;
    setIsSearchingCedula(true);
    try {
      const q = query(collection(firestore, 'padron'), where('cedula', '==', cleanTerm), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const found = snap.docs[0].data();
        setFormData(prev => ({ ...prev, nombre_completo: `${found.nombre} ${found.apellido}`.toUpperCase() }));
        setPadronFound(true);
      } else { setPadronFound(false); }
    } catch (error) { setPadronFound(false); } finally { setIsSearchingCedula(false); }
  }, [firestore]);

  const handleCedulaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, cedula: e.target.value, nombre_completo: '' }));
    setPadronFound(false);
  };

  const handleSubmit = () => {
    if (!firestore || !user) return;
    const entidadFinal = formData.solicitante_entidad || formData.otra_entidad;
    if (!entidadFinal || !formData.lugar_local || !formData.nombre_completo) {
      toast({ variant: "destructive", title: "Faltan datos obligatorios" }); return;
    }
    setIsSubmitting(true);
    const docData = { 
      ...formData, 
      departamento: user.profile?.departamento || '', 
      distrito: user.profile?.distrito || '', 
      foto_firma: photoDataUri || '', 
      usuario_id: user.uid, 
      fecha_creacion: new Date().toISOString(), 
      server_timestamp: serverTimestamp() 
    };
    
    addDoc(collection(firestore, 'solicitudes-capacitacion'), docData)
      .then(() => {
        toast({ title: "¡Solicitud Registrada!" });
        setFormData(p => ({ ...p, solicitante_entidad: '', otra_entidad: '', lugar_local: '', nombre_completo: '', cedula: '', gps: '' }));
        setPhotoDataUri(null);
        setIsSubmitting(false);
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'solicitudes-capacitacion', operation: 'create', requestResourceData: docData }));
        setIsSubmitting(false);
      });
  };

  const partidosQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'partidos-politicos'), orderBy('nombre')) : null, [firestore]);
  const { data: partidosData } = useCollection<PartidoPolitico>(partidosQuery);

  const selectedParty = useMemo(() => partidosData?.find(p => p.nombre === formData.solicitante_entidad), [partidosData, formData.solicitante_entidad]);

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary"/></div>;

  return (
    <div className="min-h-screen bg-muted/10">
      <Header title="Nueva Solicitud - Anexo V" />
      <main className="p-4 md:p-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="shadow-lg border-none overflow-hidden">
              <CardHeader className="bg-primary px-6 py-4">
                <CardTitle className="text-sm font-black uppercase text-white">DATOS DE LA ACTIVIDAD</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-8 bg-white">
                <div className="space-y-6">
                  <Label className="text-[10px] font-black uppercase">Grupo Político</Label>
                  <Popover open={isPartyPopoverOpen} onOpenChange={setIsPartyPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between h-12 font-bold text-lg border-2">
                        {selectedParty ? selectedParty.nombre : "Seleccionar de la lista..."}<Search className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command><CommandInput placeholder="Buscar..." /><CommandList><CommandEmpty>No encontrado.</CommandEmpty><CommandGroup>
                        {partidosData?.map(p => (
                          <CommandItem key={p.id} value={p.nombre} onSelect={() => { setFormData(prev => ({...prev, solicitante_entidad: p.nombre, otra_entidad: ''})); setIsPartyPopoverOpen(false); }}>{p.nombre}</CommandItem>
                        ))}
                      </CommandGroup></CommandList></Command>
                    </PopoverContent>
                  </Popover>
                  <Input name="otra_entidad" placeholder="Otra entidad..." value={formData.otra_entidad} onChange={(e) => { setFormData(prev => ({ ...prev, otra_entidad: e.target.value, solicitante_entidad: '' })); }} className="h-11 font-bold border-2" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input name="lugar_local" placeholder="Lugar/Local" value={formData.lugar_local} onChange={(e) => setFormData(p => ({...p, lugar_local: e.target.value}))} className="h-11 font-bold border-2" />
                  <Input name="fecha" type="date" value={formData.fecha} onChange={(e) => setFormData(p => ({...p, fecha: e.target.value}))} className="h-11 font-bold border-2" />
                </div>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex gap-2">
                    <Input name="cedula" placeholder="Cédula" value={formData.cedula} onChange={handleCedulaChange} className="h-11 font-black border-2" />
                    <Button type="button" variant="secondary" className="h-11" onClick={() => searchCedulaInPadron(formData.cedula)} disabled={isSearchingCedula}><Search className="h-4 w-4" /></Button>
                  </div>
                  <Input name="nombre_completo" placeholder="Nombre completo" value={formData.nombre_completo} readOnly={padronFound} className={cn("h-11 font-bold border-2", padronFound && "bg-green-50")} />
                </div>
              </CardContent>
              <CardFooter className="bg-primary p-0">
                  <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full h-16 bg-primary text-white text-xl font-black uppercase rounded-none">
                      {isSubmitting ? <Loader2 className="animate-spin mr-3" /> : "GUARDAR SOLICITUD"}
                  </Button>
              </CardFooter>
            </Card>
          </div>
          <div className="space-y-8">
              <Card className="shadow-lg"><CardHeader className="bg-muted/50 border-b"><CardTitle className="text-xs font-black uppercase">UBICACIÓN GPS</CardTitle></CardHeader>
              <CardContent className="p-6 space-y-4">
                <div ref={mapContainerRef} className="h-[300px] w-full bg-white rounded-xl border-4" />
                <p className="text-[10px] font-black text-primary text-center">{formData.gps || 'PENDIENTE'}</p>
              </CardContent></Card>
          </div>
        </div>
      </main>
    </div>
  );
}
