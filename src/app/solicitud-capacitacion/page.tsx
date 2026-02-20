
'use client';

import 'leaflet/dist/leaflet.css';
import 'leaflet-geosearch/dist/geosearch.css';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText, Search, Building, Camera, Trash2, FileUp, X, MapPin } from 'lucide-react';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, where, getDocs, limit } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { type PartidoPolitico } from '@/lib/data';
import Image from 'next/image';
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

function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<F>): Promise<ReturnType<F>> =>
    new Promise(resolve => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => resolve(func(...args)), waitFor);
    });
}

export default function SolicitudCapacitacionPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    solicitante_entidad: '',
    tipo_solicitud: ['divulgacion'] as string[],
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
    gps: '-25.311549, -57.653496',
  });

  const [photoDataUri, setPhotoDataUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPartyPopoverOpen, setIsPartyPopoverOpen] = useState(false);
  const [isSearchingCedula, setIsSearchingCedula] = useState(false);
  const [padronFound, setPadronFound] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const defaultCoords = { lat: -25.311549, lng: -57.653496 };

  useEffect(() => {
    const now = new Date();
    setFormData(prev => ({ ...prev, fecha: now.toISOString().split('T')[0] }));
  }, []);

  // MAP INITIALIZATION
  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current || leafletMap.current) {
      return;
    }

    const initMap = async () => {
      try {
        const L = (await import('leaflet')).default;
        const { OpenStreetMapProvider, GeoSearchControl } = await import('leaflet-geosearch');

        // Fix Leaflet Icons
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        const instance = L.map(mapRef.current!, {
          center: [defaultCoords.lat, defaultCoords.lng],
          zoom: 15,
          zoomControl: true,
          doubleClickZoom: false,
          attributionControl: true
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(instance);

        const provider = new OpenStreetMapProvider();
        const searchControl = new (GeoSearchControl as any)({
          provider,
          style: 'bar',
          showMarker: false,
          autoClose: true,
          keepResult: true,
          searchLabel: 'Ingresar dirección...'
        });
        instance.addControl(searchControl);

        const setPosition = (lat: number, lng: number) => {
          const coords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          setFormData(prev => ({ ...prev, gps: coords }));
          
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
          } else {
            markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(instance);
            markerRef.current.on('dragend', (ev: any) => {
              const pos = ev.target.getLatLng();
              setPosition(pos.lat, pos.lng);
            });
          }
          instance.panTo([lat, lng]);
        };

        // Initialize marker at default
        markerRef.current = L.marker([defaultCoords.lat, defaultCoords.lng], { draggable: true }).addTo(instance);
        markerRef.current.on('dragend', (ev: any) => {
          const pos = ev.target.getLatLng();
          setPosition(pos.lat, pos.lng);
        });

        instance.on('geosearch/showlocation', (result: any) => {
          setPosition(result.location.y, result.location.x);
        });

        instance.on('dblclick', (e: any) => {
          setPosition(e.latlng.lat, e.latlng.lng);
          toast({ title: "Ubicación fijada", description: "Coordenadas capturadas con éxito." });
        });

        leafletMap.current = instance;

        // Force invalidateSize to fix gray tiles issue
        setTimeout(() => {
          instance.invalidateSize();
        }, 500);

      } catch (err) {
        console.error("Error loading map:", err);
      }
    };

    initMap();

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
        markerRef.current = null;
      }
    };
  }, [toast]);

  const searchCedulaInPadron = useCallback(async (cedula: string) => {
    if (!firestore || !cedula || cedula.length < 4) return;
    setIsSearchingCedula(true);
    try {
      const cleanedCedula = cedula.replace(/[.,-]/g, '');
      const q = query(collection(firestore, 'padron'), where('cedula', '==', cleanedCedula), limit(1));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0].data();
        const fullName = `${userDoc.nombre || ''} ${userDoc.apellido || ''}`.trim();
        setFormData(prev => ({ ...prev, nombre_completo: fullName, cedula: cedula }));
        setPadronFound(true);
        toast({ title: "Ciudadano Encontrado", description: `Datos de ${fullName} cargados.` });
      } else { 
        setPadronFound(false); 
      }
    } catch (error) { 
      console.error("Error searching cedula:", error); 
      setPadronFound(false); 
    } finally { 
      setIsSearchingCedula(false); 
    }
  }, [firestore, toast]);

  const debouncedSearch = useMemo(() => debounce(searchCedulaInPadron, 500), [searchCedulaInPadron]);
  
  const handleCedulaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData(prev => ({ ...prev, cedula: value, nombre_completo: '' }));
    setPadronFound(false);
    debouncedSearch(value);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (value: string) => {
    setFormData(prev => {
      const newTipo = prev.tipo_solicitud.includes(value)
        ? prev.tipo_solicitud.filter(item => item !== value)
        : [...prev.tipo_solicitud, value];
      return { ...prev, tipo_solicitud: newTipo };
    });
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhotoDataUri(reader.result as string);
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const partidosQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'partidos-politicos'), orderBy('nombre')) : null, [firestore]);
  const { data: partidosData } = useCollection<PartidoPolitico>(partidosQuery);

  const handleSubmit = async () => {
    if (!firestore || !user) return;
    if (!formData.solicitante_entidad || !formData.lugar_local || !formData.nombre_completo || formData.tipo_solicitud.length === 0) {
      toast({ variant: "destructive", title: "Faltan datos obligatorios", description: "Por favor complete los campos requeridos." });
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
      server_timestamp: serverTimestamp() 
    };
    try {
      await addDoc(collection(firestore, 'solicitudes-capacitacion'), docData);
      toast({ title: "¡Solicitud Registrada!", description: "La actividad ha sido agendada con éxito." });
      setFormData({
        solicitante_entidad: '',
        tipo_solicitud: ['divulgacion'],
        fecha: new Date().toISOString().split('T')[0],
        hora_desde: '08:00',
        hora_hasta: '12:00',
        lugar_local: '',
        direccion_calle: '',
        barrio_compania: '',
        rol_solicitante: 'apoderado',
        nombre_completo: '',
        cedula: '',
        telefono: '',
        gps: '-25.311549, -57.653496',
      });
      setPhotoDataUri(null);
    } catch (error) { 
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'solicitudes-capacitacion', operation: 'create', requestResourceData: docData }));
    } finally { 
      setIsSubmitting(false); 
    }
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary"/></div>;

  return (
    <div className="min-h-screen bg-muted/10">
      <Header title="Nueva Solicitud - Anexo V" />
      <main className="p-4 md:p-8 max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4 bg-white p-6 rounded-xl border shadow-sm">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Nueva Solicitud</h1>
            <p className="text-muted-foreground font-medium flex items-center gap-2 mt-1">
              <FileText className="h-4 w-4" />
              Proforma oficial de solicitud de capacitación (Anexo V).
            </p>
          </div>
          <Button variant="outline" className="font-bold border-primary text-primary hover:bg-primary/5">
            <FileText className="mr-2 h-4 w-4" /> VISTA PREVIA PDF
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8"> 
            <Card className="shadow-lg border-none overflow-hidden">
              <CardHeader className="bg-primary px-6 py-4">
                <CardTitle className="flex items-center text-sm font-black uppercase text-white tracking-widest">
                  <Building className="mr-2 h-4 w-4"/> DATOS DE LA ACTIVIDAD
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-8 bg-white">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">GRUPO POLÍTICO SOLICITANTE</Label>
                   <Popover open={isPartyPopoverOpen} onOpenChange={setIsPartyPopoverOpen}>
                      <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between mt-1 h-12 font-bold text-lg border-2">
                          {partidosData?.find(p => p.nombre === formData.solicitante_entidad)?.nombre || "Seleccionar partido o movimiento..."}
                          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                          <CommandInput placeholder="Buscar partido..." />
                          <CommandList>
                            <CommandEmpty>No encontrado.</CommandEmpty>
                            <CommandGroup>
                              {partidosData?.map((p) => (
                                <CommandItem 
                                  key={p.id} 
                                  value={p.nombre} 
                                  onSelect={(val) => { 
                                    setFormData(prev => ({...prev, solicitante_entidad: val})); 
                                    setIsPartyPopoverOpen(false); 
                                  }}
                                  className="font-bold uppercase text-xs"
                                >
                                  {p.nombre}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                  </Popover>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                  <div className="border-2 border-dashed rounded-xl p-5 bg-muted/20">
                      <Label className="text-[10px] font-black uppercase text-primary tracking-widest">TIPO DE SOLICITUD</Label>
                      <div className="mt-4 space-y-3">
                          <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border">
                            <Checkbox id="c1" checked={formData.tipo_solicitud.includes('divulgacion')} onCheckedChange={() => handleCheckboxChange('divulgacion')} />
                            <label htmlFor="c1" className="text-xs font-bold uppercase cursor-pointer flex-1">Divulgación (Máquina de Votación)</label>
                          </div>
                          <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border">
                            <Checkbox id="c2" checked={formData.tipo_solicitud.includes('capacitacion')} onCheckedChange={() => handleCheckboxChange('capacitacion')} />
                            <label htmlFor="c2" className="text-xs font-bold uppercase cursor-pointer flex-1">Capacitación (Miembros de Mesa)</label>
                          </div>
                      </div>
                  </div>
                  <div className="space-y-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">FECHA PROPUESTA</Label>
                        <Input type="date" name="fecha" value={formData.fecha} onChange={handleInputChange} className="h-11 font-bold border-2" />
                      </div>
                      <div className="grid grid-cols-2 gap-4"> 
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">HORARIO DESDE</Label>
                            <Input type="time" name="hora_desde" value={formData.hora_desde} onChange={handleInputChange} className="h-11 font-bold border-2" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">HORARIO HASTA</Label>
                            <Input type="time" name="hora_hasta" value={formData.hora_hasta} onChange={handleInputChange} className="h-11 font-bold border-2" />
                          </div>
                      </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">LUGAR Y/O LOCAL</Label>
                    <Input name="lugar_local" placeholder="Nombre del local o punto de encuentro" value={formData.lugar_local} onChange={handleInputChange} className="h-11 font-bold border-2" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">DIRECCIÓN (CALLE)</Label>
                    <Input name="direccion_calle" placeholder="Nombre de la calle" value={formData.direccion_calle} onChange={handleInputChange} className="h-11 font-bold border-2" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">BARRIO - COMPAÑÍA</Label>
                    <Input name="barrio_compania" placeholder="Nombre del barrio" value={formData.barrio_compania} onChange={handleInputChange} className="h-11 font-bold border-2" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">DISTRITO (AUTODETECTADO)</Label>
                    <Input value={user?.profile?.distrito || ''} readOnly className="h-11 bg-muted/50 font-black uppercase border-2 text-primary" />
                  </div>
                </div>

                <Separator />

                <div className="space-y-6">
                  <Label className="text-sm font-black uppercase text-primary tracking-widest block">DATOS DEL SOLICITANTE RESPONSABLE</Label>
                  <RadioGroup value={formData.rol_solicitante} onValueChange={(v: any) => setFormData(p => ({ ...p, rol_solicitante: v }))} className="flex gap-8">
                      <div className="flex items-center space-x-2"><RadioGroupItem value="apoderado" id="r-apo" /><Label htmlFor="r-apo" className="font-bold cursor-pointer">APODERADO</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="otro" id="r-otro" /><Label htmlFor="r-otro" className="font-bold cursor-pointer">OTRO (PARTICULAR)</Label></div>
                  </RadioGroup>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">NOMBRE COMPLETO</Label>
                        <div className="relative">
                          <Input name="nombre_completo" placeholder="Nombre y Apellido" value={formData.nombre_completo} onChange={handleInputChange} readOnly={padronFound} className={cn("h-11 font-bold border-2", padronFound && "bg-green-50 border-green-200 text-green-900")} />
                          {padronFound && <Button variant="ghost" size="icon" className="absolute right-1 top-1 h-9 w-9" onClick={() => { setFormData(p => ({...p, nombre_completo: '', cedula: ''})); setPadronFound(false); }}><X className="h-4 w-4"/></Button>}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">C.I.C. N.º</Label>
                        <div className="relative">
                          <Input name="cedula" placeholder="Ej: 1.234.567" value={formData.cedula} onChange={handleCedulaChange} disabled={isSearchingCedula} className="h-11 font-black border-2" />
                          {isSearchingCedula && <Loader2 className="absolute right-2 top-3 h-5 w-5 animate-spin text-primary" />}
                        </div>
                      </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">NÚMERO DE CONTACTO</Label>
                    <Input name="telefono" placeholder="Celular o Línea Baja" value={formData.telefono} onChange={handleInputChange} className="h-11 font-bold border-2" />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-primary p-0">
                  <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full h-16 bg-primary text-white hover:bg-primary/90 text-xl font-black uppercase rounded-none shadow-2xl">
                      {isSubmitting ? <><Loader2 className="animate-spin mr-3 h-6 w-6" /> GUARDANDO...</> : "GUARDAR Y AGENDAR ACTIVIDAD"}
                  </Button>
              </CardFooter>
            </Card>
          </div>

          <div className="space-y-8">
              <Card className="shadow-xl border border-muted rounded-xl overflow-hidden h-fit">
                  <CardHeader className="bg-white border-b py-6 text-center">
                    <CardTitle className="text-xl font-black uppercase tracking-tight text-black">
                      GEORREFERENCIACIÓN
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 relative h-[450px] bg-muted/10">
                      <div ref={mapRef} className="h-full w-full z-10"></div>
                  </CardContent>
                  <CardFooter className="flex flex-col items-center py-6 px-6 bg-white border-t gap-3">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">COORDENADAS CAPTURADAS</p>
                      <div className="w-full p-4 bg-muted/10 border rounded-xl">
                        <p className="text-center font-black text-lg text-primary tracking-tight">
                          {formData.gps}
                        </p>
                      </div>
                  </CardFooter>
              </Card>

              <Card className="shadow-lg border-none overflow-hidden">
                  <CardHeader className="bg-muted/50 border-b">
                    <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                      <Camera className="h-4 w-4" /> RESPALDO DOCUMENTAL
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 bg-white">
                  {photoDataUri ? (
                      <div className="relative group">
                        <div className="relative aspect-[4/3] rounded-xl overflow-hidden border-4 border-muted">
                          <Image src={photoDataUri} alt="Firma" fill className="object-cover" />
                        </div>
                        <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-lg opacity-0 group-hover/image-card:opacity-100 transition-opacity" onClick={() => setPhotoDataUri(null)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                  ) : (
                      <div className="grid grid-cols-1 gap-4">
                          <Button asChild variant="secondary" className="w-full bg-muted text-primary hover:bg-muted/80 h-20 rounded-xl border-2 border-dashed border-primary/20">
                            <label className="cursor-pointer flex flex-col items-center justify-center">
                              <Camera className="h-6 w-6 mb-1" />
                              <span className="text-[10px] font-black uppercase">CÁMARA EN VIVO</span>
                              <Input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
                            </label>
                          </Button>
                          <Button asChild variant="outline" className="w-full h-20 rounded-xl border-2 border-dashed">
                            <label className="cursor-pointer flex flex-col items-center justify-center text-muted-foreground">
                              <FileUp className="h-6 w-6 mb-1" />
                              <span className="text-[10px] font-black uppercase">GALERÍA / ARCHIVO</span>
                              <Input type="file" accept="image/*" className="hidden" onChange={handlePhotoCapture} />
                            </label>
                          </Button>
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
