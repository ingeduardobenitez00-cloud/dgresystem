
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
import { type PartidoPolitico } from '@/lib/data';
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

  // Mapa Refs y Estado
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

  // Inicialización del Mapa Robusta
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    let map: any = null;
    let resizeObserver: ResizeObserver | null = null;

    const initMap = async () => {
      // Dynamic imports for Leaflet and Leaflet-GeoSearch
      const L = (await import('leaflet')).default;
      const { OpenStreetMapProvider, GeoSearchControl } = await import('leaflet-geosearch');
      
      // Ensure CSS is injected
      if (!document.getElementById('leaflet-geosearch-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-geosearch-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet-geosearch@3.11.0/dist/geosearch.css';
        document.head.appendChild(link);
      }

      if (!mapContainerRef.current || mapInstanceRef.current) return;

      // Fix para iconos de Leaflet (asegura visualización correcta del marcador)
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const initialPos: [number, number] = [-25.311549, -57.653496];
      map = L.map(mapContainerRef.current, { 
        doubleClickZoom: false,
        zoomControl: true,
        scrollWheelZoom: true
      }).setView(initialPos, 13);
      
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      // Buscador de Direcciones
      const provider = new OpenStreetMapProvider();
      const searchControl = new (GeoSearchControl as any)({
        provider,
        style: 'bar',
        showMarker: true,
        retainZoomLevel: false,
        animateZoom: true,
        autoClose: true,
        searchLabel: 'Buscar dirección...',
        keepResult: true
      });
      map.addControl(searchControl);

      // Captura desde el buscador
      map.on('geosearch/showlocation', (result: any) => {
        const { x, y } = result.location;
        const coords = `${y.toFixed(6)}, ${x.toFixed(6)}`;
        setFormData(prev => ({ ...prev, gps: coords }));
        if (markerRef.current) map.removeLayer(markerRef.current);
        markerRef.current = L.marker([y, x]).addTo(map);
      });

      // Captura por doble clic
      map.on('dblclick', (e: any) => {
        const { lat, lng } = e.latlng;
        const coords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        setFormData(prev => ({ ...prev, gps: coords }));
        if (markerRef.current) map.removeLayer(markerRef.current);
        markerRef.current = L.marker([lat, lng]).addTo(map);
        toast({ title: "Ubicación fijada", description: `Coordenadas: ${coords}` });
      });

      // Solución definitiva al mapa gris (invalidateSize)
      // Usamos ResizeObserver para detectar cuando el contenedor es visible y tiene tamaño
      resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      });
      resizeObserver.observe(mapContainerRef.current);

      // Múltiples intentos de redimensionado para asegurar renderizado correcto
      const forceRefresh = () => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
      };
      
      requestAnimationFrame(forceRefresh);
      setTimeout(forceRefresh, 500);
      setTimeout(forceRefresh, 1500);
    };

    initMap();

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
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

  const handleTypeSelection = (value: 'divulgacion' | 'capacitacion') => {
    setFormData(prev => ({ ...prev, tipo_solicitud: value }));
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

  const partidosQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'partidos-politicos'), orderBy('nombre'));
  }, [firestore, user]);
  
  const { data: partidosData } = useCollection<PartidoPolitico>(partidosQuery);

  const handlePreviewPDF = () => {
    if (!logoBase64) {
      toast({ variant: 'destructive', title: 'Error', description: 'El logo institucional aún no ha cargado.' });
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;

    // Header
    doc.addImage(logoBase64, 'PNG', margin, 10, 20, 20);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'normal');
    doc.text("Justicia Electoral", 105, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text("Custodio de la Voluntad Popular", 105, 26, { align: "center" });

    // Tricolor bar
    const barX = pageWidth - margin - 15;
    const barY_red = 10;
    const barW = 4;
    doc.setFillColor(255, 0, 0); doc.rect(barX, barY_red, barW, 15, 'F');
    doc.setFillColor(255, 255, 255); doc.rect(barX + 4, barY_red, barW, 15, 'F');
    doc.setFillColor(0, 0, 255); doc.rect(barX + 8, barY_red, barW, 15, 'F');
    doc.setDrawColor(200, 200, 200); doc.rect(barX, barY_red, 12, 15, 'S');

    // Section Title
    doc.setFillColor(235, 235, 220);
    doc.rect(margin, 35, pageWidth - (margin * 2), 8, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text("ANEXO V – PROFORMA DE SOLICITUD", 105, 40.5, { align: "center" });

    // Date
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const today = new Date();
    doc.text(`_________________, : ${today.getDate()} de ${today.toLocaleString('es-PY', { month: 'long' })} de ${today.getFullYear()}`, pageWidth - margin, 50, { align: 'right' });

    // Body
    doc.setFont('helvetica', 'bold'); doc.text("Señor/a", margin, 60); doc.line(margin, 66, 100, 66);
    doc.text("Presente:", margin, 75);
    doc.setFont('helvetica', 'normal');
    const bodyText = "Tengo el agrado de dirigirme a usted/es, en virtud a las próximas Elecciones Internas simultáneas de las Organizaciones Políticas del 07 de junio del 2026, a los efectos de solicitar:";
    doc.text(doc.splitTextToSize(bodyText, pageWidth - (margin * 2) - 10), margin + 10, 82);

    // Checkboxes
    let checkY = 95;
    doc.rect(margin + 10, checkY, 5, 5); if (formData.tipo_solicitud === 'divulgacion') doc.text("X", margin + 11.5, checkY + 4);
    doc.text("Divulgación sobre el uso de la Máquina de Votación Electrónica.", margin + 20, checkY + 4);
    checkY += 8;
    doc.rect(margin + 10, checkY, 5, 5); if (formData.tipo_solicitud === 'capacitacion') doc.text("X", margin + 11.5, checkY + 4);
    doc.text("Capacitación sobre las funciones de los miembros de mesa receptora de votos.", margin + 20, checkY + 4);

    // Table
    let tableY = 115;
    const drawCell = (x: number, y: number, w: number, h: number, label: string, value: string) => {
      doc.rect(x, y, w, h); doc.setFont('helvetica', 'bold'); doc.text(label, x + 2, y + 5);
      doc.setFont('helvetica', 'normal'); doc.text(`: ${String(value || '').toUpperCase()}`, x + 40, y + 5);
    };
    drawCell(margin, tableY, pageWidth - (margin * 2), 8, "FECHA", formatDateToDDMMYYYY(formData.fecha)); tableY += 8;
    doc.rect(margin, tableY, pageWidth - (margin * 2), 8);
    doc.setFont('helvetica', 'bold'); doc.text("HORARIO", margin + 2, tableY + 5);
    doc.text("DESDE:", margin + 40, tableY + 5); doc.setFont('helvetica', 'normal'); doc.text(`${formData.hora_desde} hs`, margin + 55, tableY + 5);
    doc.setFont('helvetica', 'bold'); doc.text("HASTA:", margin + 85, tableY + 5); doc.setFont('helvetica', 'normal'); doc.text(`${formData.hora_hasta} hs`, margin + 100, tableY + 5);
    tableY += 8;
    drawCell(margin, tableY, pageWidth - (margin * 2), 8, "LUGAR Y/O LOCAL", formData.lugar_local); tableY += 8;
    drawCell(margin, tableY, pageWidth - (margin * 2), 8, "DIRECCIÓN", `CALLE: ${formData.direccion_calle}`); tableY += 8;
    drawCell(margin, tableY, pageWidth - (margin * 2), 8, "BARRIO - COMPAÑÍA", formData.barrio_compania); tableY += 8;
    drawCell(margin, tableY, pageWidth - (margin * 2), 8, "DISTRITO", user?.profile?.distrito || ''); tableY += 8;
    if (formData.gps) { drawCell(margin, tableY, pageWidth - (margin * 2), 8, "COORDENADAS GPS", formData.gps); tableY += 8; }

    // Applicant
    tableY += 4; doc.setFont('helvetica', 'bold'); doc.text("DATOS DEL SOLICITANTE – APODERADO", margin, tableY);
    doc.rect(margin + 75, tableY - 4, 5, 5); if (formData.rol_solicitante === 'apoderado') doc.text("X", margin + 76.5, tableY);
    doc.text("OTRO", margin + 85, tableY); doc.rect(margin + 98, tableY - 4, 5, 5); if (formData.rol_solicitante === 'otro') doc.text("X", margin + 99.5, tableY);
    tableY += 4; drawCell(margin, tableY, pageWidth - (margin * 2), 8, "NOMBRE COMPLETO", formData.nombre_completo);
    tableY += 8; drawCell(margin, tableY, pageWidth - (margin * 2), 8, "C.I.C. N.º", formData.cedula);
    tableY += 8; doc.rect(margin, tableY, pageWidth - (margin * 2), 10);
    doc.setFontSize(8); doc.text("NUMERO DE CONTACTO", margin + 2, tableY + 4); doc.text("(CELULAR – LÍNEA BAJA)", margin + 2, tableY + 8);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text(`: ${formData.telefono}`, margin + 40, tableY + 6);

    // Observation
    tableY += 10; doc.setFillColor(235, 235, 220); doc.rect(margin, tableY, pageWidth - (margin * 2), 6, 'F');
    doc.setFont('helvetica', 'bold'); doc.text("OBSERVACIÓN", 105, tableY + 4.5, { align: "center" });
    tableY += 6; doc.rect(margin, tableY, pageWidth - (margin * 2), 12); doc.setFont('helvetica', 'italic'); doc.setFontSize(9);
    doc.text("La recepción de solicitudes se realiza hasta 48 horas de antelación a la fecha del evento.", 105, tableY + 5, { align: "center" });
    doc.text("En caso de cancelación de la actividad debe informarse con 24 horas de anticipación.", 105, tableY + 10, { align: "center" });

    // Signature
    tableY += 30; doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text("Firma del Solicitante: ________________________________________________", margin + 20, tableY);
    if (photoDataUri) doc.addImage(photoDataUri, 'JPEG', margin + 60, tableY - 15, 40, 30);

    // Internal Box
    tableY += 10; doc.rect(margin, tableY, pageWidth - (margin * 2), 50); doc.setFont('helvetica', 'bold');
    doc.text("ESPACIO PARA USO INTERNO DE LA JUSTICIA ELECTORAL", 105, tableY + 6, { align: "center" });
    doc.setFont('helvetica', 'normal');
    doc.text("Divulgador designado: _______________________________________ C.I.C. N.º: __________________", margin + 5, tableY + 15);
    doc.text("Código de la Máquina de Votación asignada: __________________________________________________", margin + 5, tableY + 25);
    doc.text("__________________________________________", 105, tableY + 38, { align: "center" });
    doc.text("Firma y sello del Jefe del Registro Electoral:", 105, tableY + 43, { align: "center" });

    doc.save(`AnexoV-${formData.solicitante_entidad || 'Solicitud'}.pdf`);
  };

  const handleSubmit = async () => {
    if (!firestore || !user) return;
    if (!formData.solicitante_entidad || !formData.lugar_local || !formData.nombre_completo || !formData.tipo_solicitud) {
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
    try {
      await addDoc(collection(firestore, 'solicitudes-capacitacion'), docData);
      toast({ title: "¡Solicitud Registrada!" });
      setFormData({ solicitante_entidad: '', tipo_solicitud: 'divulgacion', fecha: new Date().toISOString().split('T')[0], hora_desde: '08:00', hora_hasta: '12:00', lugar_local: '', direccion_calle: '', barrio_compania: '', rol_solicitante: 'apoderado', nombre_completo: '', cedula: '', telefono: '', gps: '' });
      setPhotoDataUri(null);
    } catch (error) { errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'solicitudes-capacitacion', operation: 'create', requestResourceData: docData })); }
    finally { setIsSubmitting(false); }
  };

  const selectedParty = useMemo(() => 
    partidosData?.find(p => p.nombre === formData.solicitante_entidad), 
    [partidosData, formData.solicitante_entidad]
  );

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary"/></div>;

  return (
    <div className="min-h-screen bg-muted/10">
      <Header title="Nueva Solicitud - Anexo V" />
      <main className="p-4 md:p-8 max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4 bg-white p-6 rounded-xl border shadow-sm">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Nueva Solicitud</h1>
            <p className="text-muted-foreground font-medium flex items-center gap-2 mt-1">
              <FileText className="h-4 w-4" /> Proforma oficial de solicitud de capacitación (Anexo V).
            </p>
          </div>
          <Button onClick={handlePreviewPDF} variant="outline" className="font-bold border-primary text-primary hover:bg-primary/5">
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
                
                {/* Jurisdicción Asignada */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl border border-dashed mb-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-primary flex items-center gap-1.5">
                      <Landmark className="h-3 w-3" /> Departamento Asignado
                    </Label>
                    <p className="font-black text-sm uppercase px-3 py-2 bg-white rounded-lg border border-primary/10 shadow-sm truncate">
                      {user?.profile?.departamento || 'Sin asignar'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-primary flex items-center gap-1.5">
                      <Navigation className="h-3 w-3" /> Distrito / Oficina
                    </Label>
                    <p className="font-black text-sm uppercase px-3 py-2 bg-white rounded-lg border border-primary/10 shadow-sm truncate">
                      {user?.profile?.distrito || 'Sin asignar'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">GRUPO POLÍTICO SOLICITANTE</Label>
                   <Popover open={isPartyPopoverOpen} onOpenChange={setIsPartyPopoverOpen}>
                      <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between mt-1 h-12 font-bold text-lg border-2">
                          <span className="truncate flex items-center gap-2">
                            {selectedParty ? (
                              <>
                                {selectedParty.nombre}
                                {selectedParty.siglas && (
                                  <Badge variant="secondary" className="bg-primary/5 text-primary border-none font-black text-[10px]">
                                    {selectedParty.siglas}
                                  </Badge>
                                )}
                              </>
                            ) : "Seleccionar partido o movimiento..."}
                          </span>
                          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                          <CommandInput placeholder="Buscar partido o siglas..." />
                          <CommandList className="max-h-[400px]">
                            <CommandEmpty>No encontrado.</CommandEmpty>
                            <CommandGroup>
                              {partidosData?.map((p) => (
                                <CommandItem 
                                  key={p.id} 
                                  value={`${p.nombre} ${p.siglas}`} 
                                  onSelect={() => { 
                                    setFormData(prev => ({...prev, solicitante_entidad: p.nombre})); 
                                    setIsPartyPopoverOpen(false); 
                                  }} 
                                  className="flex items-center justify-between font-bold uppercase text-[10px] py-3 cursor-pointer"
                                >
                                  <div className="flex flex-col gap-0.5">
                                    <span className="leading-tight">{p.nombre}</span>
                                    {p.siglas && (
                                      <span className="text-[9px] text-primary/60 font-black tracking-widest">
                                        {p.siglas}
                                      </span>
                                    )}
                                  </div>
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
                      <Label className="text-[10px] font-black uppercase text-primary tracking-widest">TIPO DE SOLICITUD (SELECCIÓN EXCLUSIVA)</Label>
                      <div className="mt-4 space-y-3">
                          <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border">
                            <Checkbox id="c1" checked={formData.tipo_solicitud === 'divulgacion'} onCheckedChange={() => handleTypeSelection('divulgacion')} />
                            <label htmlFor="c1" className="text-xs font-bold uppercase cursor-pointer flex-1">Divulgación (Máquina)</label>
                          </div>
                          <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border">
                            <Checkbox id="c2" checked={formData.tipo_solicitud === 'capacitacion'} onCheckedChange={() => handleTypeSelection('capacitacion')} />
                            <label htmlFor="c2" className="text-xs font-bold uppercase cursor-pointer flex-1">Capacitación (Mesa)</label>
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
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">DESDE</Label>
                            <Input type="time" name="hora_desde" value={formData.hora_desde} onChange={handleInputChange} className="h-11 font-bold border-2" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">HASTA</Label>
                            <Input type="time" name="hora_hasta" value={formData.hora_hasta} onChange={handleInputChange} className="h-11 font-bold border-2" />
                          </div>
                      </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">LUGAR Y/O LOCAL</Label>
                    <Input name="lugar_local" placeholder="Nombre del local" value={formData.lugar_local} onChange={handleInputChange} className="h-11 font-bold border-2" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">DIRECCIÓN (CALLE)</Label>
                    <Input name="direccion_calle" placeholder="Nombre de la calle" value={formData.direccion_calle} onChange={handleInputChange} className="h-11 font-bold border-2" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">BARRIO - COMPAÑÍA</Label>
                    <Input name="barrio_compania" placeholder="Nombre del barrio" value={formData.barrio_compania} onChange={handleInputChange} className="h-11 font-bold border-2" />
                  </div>
                </div>

                <Separator />

                {/* Datos del Solicitante Responsable */}
                <div className="space-y-6">
                  <Label className="text-sm font-black uppercase tracking-tight text-primary block">DATOS DEL SOLICITANTE RESPONSABLE</Label>
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

                <Separator />

                {/* Georreferenciación Reparada */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> GEORREFERENCIACIÓN DEL EVENTO
                    </Label>
                    {formData.gps && (
                      <Badge className="bg-green-100 text-green-700 border-none shadow-sm font-black text-[9px] uppercase px-3 py-1">
                        UBICACIÓN FIJADA
                      </Badge>
                    )}
                  </div>
                  <div className="rounded-xl overflow-hidden border-4 border-muted shadow-inner bg-muted/20 relative group">
                    <div ref={mapContainerRef} className="h-[400px] w-full" style={{ minHeight: '400px', backgroundColor: '#f3f4f6' }} />
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
                      <div className="bg-black/80 text-white text-[9px] font-black uppercase px-4 py-2 rounded-full backdrop-blur-md shadow-2xl border border-white/20 whitespace-nowrap">
                        Doble clic en el mapa para capturar coordenadas exactas
                      </div>
                    </div>
                  </div>
                  <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Navigation className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase text-muted-foreground leading-none mb-1">COORDENADAS GPS</p>
                        <p className="font-black text-sm text-primary tracking-tight">
                          {formData.gps || 'PENDIENTE DE CAPTURA'}
                        </p>
                      </div>
                    </div>
                    {formData.gps && (
                      <Badge className="bg-primary text-white border-none shadow-sm font-black text-[9px] uppercase px-3 py-1">
                        CAPTURADO
                      </Badge>
                    )}
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
              {/* Documental Section */}
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
