
'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Building, 
  Search, 
  Camera, 
  Trash2, 
  FileUp, 
  Landmark, 
  Navigation, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  Calendar as CalendarIcon, 
  Printer, 
  Check,
  FileText,
  X
} from 'lucide-react';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, where, getDocs, limit } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn, formatDateToDDMMYYYY } from '@/lib/utils';
import { type PartidoPolitico } from '@/lib/data';
import Image from 'next/image';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  const mapInitializing = useRef(false);
  
  const fechaInputRef = useRef<HTMLInputElement>(null);
  const horaDesdeRef = useRef<HTMLInputElement>(null);
  const horaHastaRef = useRef<HTMLInputElement>(null);

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

  const profile = user?.profile;

  useEffect(() => {
    if (typeof window === 'undefined' || mapInitializing.current) return;
    
    let map: any;
    let observer: ResizeObserver;

    const initMap = async () => {
      if (!mapContainerRef.current || mapInstanceRef.current) return;
      mapInitializing.current = true;
      
      try {
        const L = (await import('leaflet')).default;
        const { OpenStreetMapProvider, GeoSearchControl } = await import('leaflet-geosearch');

        if (L.Icon.Default) {
          delete (L.Icon.Default.prototype as any)._getIconUrl;
          L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          });
        }

        // Centro en la Justicia Electoral - Asunción
        const initialPos: [number, number] = [-25.29916, -57.58916];
        map = L.map(mapContainerRef.current, { 
          center: initialPos, 
          zoom: 15, 
          doubleClickZoom: false 
        });
        mapInstanceRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        const provider = new OpenStreetMapProvider();
        const searchControl = new (GeoSearchControl as any)({ 
            provider, 
            style: 'bar', 
            showMarker: true,
            autoClose: true,
            keepResult: true,
            placeholder: 'Buscar dirección...',
        });
        map.addControl(searchControl);

        map.on('geosearch/showlocation', (result: any) => {
          const { x, y } = result.location;
          const coords = `${y.toFixed(6)}, ${x.toFixed(6)}`;
          setFormData(prev => ({ ...prev, gps: coords }));
          if (markerRef.current) map.removeLayer(markerRef.current);
          markerRef.current = L.marker([y, x]).addTo(map);
        });

        map.on('dblclick', (e: any) => {
          const { lat, lng } = e.latlng;
          const coords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          setFormData(prev => ({ ...prev, gps: coords }));
          if (markerRef.current) map.removeLayer(markerRef.current);
          markerRef.current = L.marker([lat, lng]).addTo(map);
        });

        // ResizeObserver para corregir el renderizado de azulejos
        observer = new ResizeObserver(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        });
        observer.observe(mapContainerRef.current);

        setTimeout(() => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.invalidateSize();
                window.dispatchEvent(new Event('resize'));
            }
        }, 500);

      } catch (err) { 
        console.error("Error al inicializar mapa:", err); 
        mapInitializing.current = false;
      }
    };

    initMap();

    return () => { 
      if (observer) observer.disconnect();
      if (mapInstanceRef.current) { 
        mapInstanceRef.current.remove(); 
        mapInstanceRef.current = null; 
      } 
      mapInitializing.current = false;
    };
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
      } else { 
        setPadronFound(false);
        toast({ variant: "destructive", title: "No encontrado", description: "La cédula no figura en el padrón." });
      }
    } catch (error) { setPadronFound(false); } finally { setIsSearchingCedula(false); }
  }, [firestore, toast]);

  const handleCedulaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, cedula: e.target.value, nombre_completo: '' }));
    setPadronFound(false);
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhotoDataUri(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const openPicker = (ref: React.RefObject<HTMLInputElement>) => {
    if (ref.current) {
      try {
        if ('showPicker' in ref.current) {
          ref.current.showPicker();
        } else {
          ref.current.focus();
        }
      } catch (error) {
        ref.current.focus();
      }
    }
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
      departamento: profile?.departamento || '', 
      distrito: profile?.distrito || '', 
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

  const generatePDF = () => {
    if (!logoBase64) return;
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.addImage(logoBase64, 'PNG', margin, 5, 22, 22);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text("Justicia Electoral", pageWidth / 2, 15, { align: "center" });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text("Custodio de la Voluntad Popular", pageWidth / 2, 22, { align: "center" });

    const barW = 5;
    const barH = 20;
    const barX = pageWidth - margin - (barW * 3);
    doc.setFillColor(200, 0, 0); doc.rect(barX, 5, barW, barH, 'F');
    doc.setFillColor(255, 255, 255); doc.rect(barX + barW, 5, barW, barH, 'F');
    doc.setFillColor(0, 0, 200); doc.rect(barX + (barW * 2), 5, barW, barH, 'F');

    const tanColor = [218, 212, 187];
    doc.setFillColor(tanColor[0], tanColor[1], tanColor[2]);
    doc.rect(margin, 30, pageWidth - (margin * 2), 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text("ANEXO V – PROFORMA DE SOLICITUD", pageWidth / 2, 35.5, { align: "center" });

    const today = new Date(formData.fecha || new Date());
    const day = today.getDate();
    const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const month = months[today.getMonth()];
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const dateText = `_______________________, ${day} de ${month} de 2026`;
    doc.text(dateText, pageWidth - margin, 48, { align: "right" });
    doc.text(profile?.distrito || 'Asunción', pageWidth - margin - 60, 47.5, { align: "center" });

    doc.text("Señor/a", margin, 60);
    doc.setFont('helvetica', 'bold');
    const entity = (formData.solicitante_entidad || formData.otra_entidad || "").toUpperCase();
    doc.text(entity, margin, 68);
    doc.line(margin, 69, margin + 100, 69);
    doc.setFont('helvetica', 'bold');
    doc.text("Presente:", margin, 76);

    doc.setFont('helvetica', 'normal');
    const introText = "Tengo el agrado de dirigirme a usted/es, en virtud a las próximas Elecciones Internas simultáneas de las Organizaciones Políticas del 07 de junio del 2026, a los efectos de solicitar:";
    const splitIntro = doc.splitTextToSize(introText, pageWidth - (margin * 2) - 5);
    doc.text(splitIntro, margin + 5, 84);

    let y = 98;
    const drawCheck = (label: string, checked: boolean, currentY: number) => {
        doc.rect(margin + 15, currentY - 4, 5, 5);
        if (checked) {
            doc.setFont('helvetica', 'bold');
            doc.text("X", margin + 16, currentY - 0.5);
            doc.setFont('helvetica', 'normal');
        }
        doc.text(label, margin + 25, currentY);
    };

    drawCheck("Divulgación sobre el uso de la Máquina de Votación Electrónica.", formData.tipo_solicitud === 'divulgacion', y);
    y += 8;
    drawCheck("Capacitación sobre las funciones de los miembros de mesa receptora de votos.", formData.tipo_solicitud === 'capacitacion', y);

    y += 10;
    autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 }, 1: { cellWidth: 'auto' } },
        body: [
            ['FECHA', `:  ${day}  /  ${today.getMonth() + 1}  / 2026`],
            ['HORARIO', `DESDE:  ${formData.hora_desde}  horas\nHASTA:  ${formData.hora_hasta}  horas`],
            ['LUGAR Y/O LOCAL', `:  ${formData.lugar_local.toUpperCase()}`],
            ['DIRECCIÓN', `CALLE:  ${formData.direccion_calle.toUpperCase()}`],
            ['BARRIO - COMPAÑÍA', `:  ${formData.barrio_compania.toUpperCase()}`],
            ['DISTRITO', `:  ${(profile?.distrito || '').toUpperCase()}`],
        ],
    });

    y = (doc as any).lastAutoTable.finalY + 5;
    doc.setFont('helvetica', 'bold');
    doc.text("DATOS DEL SOLICITANTE – APODERADO", margin, y + 4);
    
    doc.rect(margin + 75, y, 5, 5);
    if(formData.rol_solicitante === 'apoderado') doc.text("X", margin + 76, y + 4);
    
    doc.text("OTRO", margin + 85, y + 4);
    
    doc.rect(margin + 100, y, 5, 5);
    if(formData.rol_solicitante === 'otro') doc.text("X", margin + 101, y + 4);

    y += 7;
    autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 }, 1: { cellWidth: 'auto' } },
        body: [
            ['NOMBRE COMPLETO', `:  ${formData.nombre_completo.toUpperCase()}`],
            ['C.I.C. N.º', `:  ${formData.cedula}`],
            ['NÚMERO DE CONTACTO\n(CELULAR – LÍNEA BAJA)', `:  ${formData.telefono}`],
        ],
    });

    y = (doc as any).lastAutoTable.finalY + 2;
    doc.setFillColor(tanColor[0], tanColor[1], tanColor[2]);
    doc.rect(margin, y, pageWidth - (margin * 2), 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text("OBSERVACIÓN", pageWidth / 2, y + 4.5, { align: "center" });
    
    y += 10;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text("La recepción de solicitudes se realiza hasta 48 horas de antelación a la fecha del evento.", pageWidth / 2, y, { align: "center" });
    doc.text("En caso de cancelación de la actividad debe informarse con 24 horas de anticipación.", pageWidth / 2, y + 5, { align: "center" });

    y += 15;
    doc.setFont('helvetica', 'normal');
    doc.text("Se hace propicia la ocasión para saludarle muy cordialmente.", margin, y);

    y += 20;
    doc.text("Firma del Solicitante: ___________________________________________", margin + 30, y);

    y += 10;
    const boxH = 50;
    doc.rect(margin, y, pageWidth - (margin * 2), boxH);
    doc.setFont('helvetica', 'bold');
    doc.text("ESPACIO PARA USO INTERNO DE LA JUSTICIA ELECTORAL", pageWidth / 2, y + 6, { align: "center" });
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Divulgador designado: _______________________________________`, margin + 5, y + 15);
    doc.text(`C.I.C. N.º: __________________`, margin + 120, y + 15);
    doc.text(`Código de la Máquina de Votación asignada: _____________________________________________`, margin + 5, y + 25);
    
    doc.text(`______________________________________________`, pageWidth / 2, y + 38, { align: "center" });
    doc.text(`Firma y sello del Jefe del Registro Electoral:`, pageWidth / 2, y + 43, { align: "center" });

    doc.text(`Total de personas capacitadas:`, margin + 10, y + 48);
    doc.rect(margin + 65, y + 44, 100, 5);

    doc.save(`Solicitud-${formData.lugar_local.replace(/\s+/g, '-') || 'AnexoV'}.pdf`);
  };

  const partidosQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'partidos-politicos'), orderBy('nombre')) : null, [firestore]);
  const { data: partidosData } = useCollection<PartidoPolitico>(partidosQuery);

  const selectedParty = useMemo(() => partidosData?.find(p => p.nombre === formData.solicitante_entidad), [partidosData, formData.solicitante_entidad]);

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Nueva Solicitud" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Nueva Solicitud</h1>
                <p className="text-muted-foreground text-xs font-bold uppercase flex items-center gap-2 mt-1">
                    <FileText className="h-3.5 w-3.5" /> Proforma oficial de solicitud de capacitación (Anexo V).
                </p>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" className="font-black uppercase text-[10px] border-2 h-10" onClick={generatePDF}>
                    <Printer className="mr-2 h-3.5 w-3.5" /> GENERAR PDF OFICIAL
                </Button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 shadow-2xl border-none overflow-hidden rounded-xl bg-white">
            <CardHeader className="bg-black py-4 px-6">
              <CardTitle className="text-sm font-black uppercase text-white flex items-center gap-2">
                <Building className="h-4 w-4" /> DATOS DE LA ACTIVIDAD
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-10">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1"><Landmark className="h-3 w-3"/> Departamento Asignado</Label>
                    <Input value={profile?.departamento || '00 - ASUNCION'} readOnly className="font-black bg-[#F8F9FA] uppercase border-2 h-11" />
                </div>
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1"><Navigation className="h-3 w-3"/> Distrito / Oficina</Label>
                    <Input value={profile?.distrito || 'SIN ASIGNAR'} readOnly className="font-black bg-[#F8F9FA] uppercase border-2 h-11" />
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Grupo Político Solicitante</Label>
                    <div className="flex gap-2">
                        <Popover open={isPartyPopoverOpen} onOpenChange={isPartyPopoverOpen ? setIsPartyPopoverOpen : undefined}>
                            <PopoverTrigger asChild>
                                <Button 
                                    variant="outline" 
                                    className="flex-1 justify-between h-12 font-bold text-lg border-2 overflow-hidden"
                                    onClick={() => setIsPartyPopoverOpen(!isPartyPopoverOpen)}
                                >
                                    <span className="truncate">
                                        {selectedParty ? `${selectedParty.nombre} (${selectedParty.siglas})` : "Seleccionar de la lista..."}
                                    </span>
                                    <Search className="ml-2 h-5 w-5 opacity-30 shrink-0" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-2xl">
                                <Command>
                                    <CommandInput placeholder="Buscar partido..." />
                                    <CommandList>
                                        <CommandEmpty>No encontrado.</CommandEmpty>
                                        <CommandGroup>
                                            {partidosData?.map(p => (
                                                <CommandItem key={p.id} value={p.nombre} onSelect={() => { 
                                                    setFormData(prev => ({...prev, solicitante_entidad: p.nombre, otra_entidad: ''})); 
                                                    setIsPartyPopoverOpen(false); 
                                                }} className="flex flex-col items-start gap-1 p-3 cursor-pointer">
                                                    <span className="font-black text-xs uppercase text-left">{p.nombre}</span>
                                                    <span className="text-[10px] font-black text-primary uppercase">{p.siglas}</span>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        {formData.solicitante_entidad && (
                            <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-12 w-12 border-2 border-destructive text-destructive hover:bg-destructive hover:text-white transition-all shadow-sm"
                                onClick={() => setFormData(prev => ({...prev, solicitante_entidad: ''}))}
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        )}
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Otra Entidad (Universidades, Cooperativas, etc.)</Label>
                    <Input placeholder="Especifique si no pertenece a un partido..." value={formData.otra_entidad} onChange={(e) => setFormData(prev => ({ ...prev, otra_entidad: e.target.value, solicitante_entidad: '' }))} className="h-11 font-bold border-2" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="p-8 border-2 border-dashed rounded-[2rem] bg-[#F8F9FA] space-y-6">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-tight">TIPO DE SOLICITUD (SELECCIÓN EXCLUSIVA)</Label>
                    <div className="space-y-4">
                        <div 
                          className={cn(
                            "flex items-center space-x-4 p-5 rounded-2xl border-2 transition-all cursor-pointer",
                            formData.tipo_solicitud === 'divulgacion' ? "bg-white border-black ring-1 ring-black" : "bg-[#F8F9FA] border-muted"
                          )} 
                          onClick={() => setFormData(p => ({...p, tipo_solicitud: 'divulgacion'}))}
                        >
                            <div className={cn(
                              "h-6 w-6 rounded-md border-2 flex items-center justify-center transition-colors",
                              formData.tipo_solicitud === 'divulgacion' ? "bg-black border-black text-white" : "border-muted-foreground/30"
                            )}>
                              {formData.tipo_solicitud === 'divulgacion' && <Check className="h-4 w-4 stroke-[4]" />}
                            </div>
                            <Label className="font-black uppercase text-sm cursor-pointer tracking-tight">DIVULGACIÓN (MÁQUINA)</Label>
                        </div>
                        <div 
                          className={cn(
                            "flex items-center space-x-4 p-5 rounded-2xl border-2 transition-all cursor-pointer",
                            formData.tipo_solicitud === 'capacitacion' ? "bg-white border-black ring-1 ring-black" : "bg-[#F8F9FA] border-muted"
                          )} 
                          onClick={() => setFormData(p => ({...p, tipo_solicitud: 'capacitacion'}))}
                        >
                            <div className={cn(
                              "h-6 w-6 rounded-md border-2 flex items-center justify-center transition-colors",
                              formData.tipo_solicitud === 'capacitacion' ? "bg-black border-black text-white" : "border-muted-foreground/30"
                            )}>
                              {formData.tipo_solicitud === 'capacitacion' && <Check className="h-4 w-4 stroke-[4]" />}
                            </div>
                            <Label className="font-black uppercase text-sm cursor-pointer tracking-tight">CAPACITACIÓN (MESA)</Label>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col justify-center space-y-8">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-tight">FECHA PROPUESTA</Label>
                        <div className="relative">
                            <CalendarIcon 
                              className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground cursor-pointer z-10" 
                              onClick={() => openPicker(fechaInputRef)}
                            />
                            <Input 
                              ref={fechaInputRef}
                              type="date" 
                              value={formData.fecha} 
                              onChange={e => setFormData(p => ({...p, fecha: e.target.value}))} 
                              className="h-14 font-black text-lg border-2 rounded-xl pr-12 cursor-pointer" 
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-tight">DESDE</Label>
                            <div className="relative">
                                <Clock 
                                  className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground cursor-pointer z-10" 
                                  onClick={() => openPicker(horaDesdeRef)}
                                />
                                <Input 
                                  ref={horaDesdeRef}
                                  type="time" 
                                  step="60"
                                  value={formData.hora_desde} 
                                  onChange={e => setFormData(p => ({...p, hora_desde: e.target.value}))} 
                                  className="h-14 font-black text-lg border-2 rounded-xl pr-12 cursor-pointer" 
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-tight">HASTA</Label>
                            <div className="relative">
                                <Clock 
                                  className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground cursor-pointer z-10" 
                                  onClick={() => openPicker(horaHastaRef)}
                                />
                                <Input 
                                  ref={horaHastaRef}
                                  type="time" 
                                  step="60"
                                  value={formData.hora_hasta} 
                                  onChange={e => setFormData(p => ({...p, hora_hasta: e.target.value}))} 
                                  className="h-14 font-black text-lg border-2 rounded-xl pr-12 cursor-pointer" 
                                />
                            </div>
                        </div>
                    </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Lugar y/o Local</Label>
                    <Input placeholder="Nombre del local" value={formData.lugar_local} onChange={e => setFormData(p => ({...p, lugar_local: e.target.value}))} className="h-11 font-bold border-2" />
                </div>
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Dirección (Calle)</Label>
                    <Input placeholder="Nombre de la calle" value={formData.direccion_calle} onChange={e => setFormData(p => ({...p, direccion_calle: e.target.value}))} className="h-11 font-bold border-2" />
                </div>
                <div className="md:col-span-2 space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Barrio - Compañía</Label>
                    <Input placeholder="Nombre del barrio" value={formData.barrio_compania} onChange={e => setFormData(p => ({...p, barrio_compania: e.target.value}))} className="h-11 font-bold border-2" />
                </div>
              </div>

              <div className="space-y-8 pt-4">
                <div className="flex items-center gap-4">
                    <h3 className="font-black uppercase text-xs shrink-0">Datos del Solicitante Responsable</h3>
                    <Separator className="flex-1" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-2">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground">Nombre Completo</Label>
                        <Input placeholder="Nombre y Apellido" value={formData.nombre_completo} readOnly={padronFound} className={cn("h-11 font-bold uppercase border-2", padronFound && "bg-green-50")} />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground">C.I.C. N°</Label>
                        <div className="flex gap-2">
                            <Input placeholder="Ej: 5630148" value={formData.cedula} onChange={handleCedulaChange} className="h-11 font-black border-2" />
                            <Button variant="secondary" size="icon" className="h-11 w-11 shrink-0" onClick={() => searchCedulaInPadron(formData.cedula)} disabled={isSearchingCedula}>
                                {isSearchingCedula ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                    <div className="md:col-span-3 space-y-2">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground">Número de Contacto</Label>
                        <Input placeholder="Celular o Línea Baja" value={formData.telefono} onChange={e => setFormData(p => ({...p, telefono: e.target.value}))} className="h-11 font-bold border-2" />
                    </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="p-0 border-t bg-black overflow-hidden">
              <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full h-16 bg-black hover:bg-black/90 text-white text-xl font-black uppercase rounded-none tracking-widest">
                {isSubmitting ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : <CheckCircle2 className="mr-3 h-6 w-6" />}
                GUARDAR Y AGENDAR ACTIVIDAD
              </Button>
            </CardFooter>
          </Card>

          <div className="space-y-8">
            <Card className="shadow-2xl border-none overflow-hidden rounded-[2.5rem] bg-white">
              <CardHeader className="bg-white border-b py-6 px-8">
                <CardTitle className="text-lg font-black uppercase text-primary flex items-center gap-3">
                    <MapPin className="h-5 w-5" /> GEORREFERENCIACIÓN DEL EVENTO
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="bg-muted/10 p-4 rounded-xl border-2 border-dashed text-center">
                    <p className="text-[10px] font-black uppercase text-muted-foreground leading-tight tracking-wider">DOBLE CLIC EN EL MAPA PARA CAPTURAR COORDENADAS EXACTAS</p>
                </div>
                <div className="relative aspect-square w-full rounded-2xl overflow-hidden border-4 border-white shadow-2xl bg-[#F0F0F0]">
                    <div ref={mapContainerRef} className="h-full w-full z-0" />
                </div>
                <div className="flex items-center gap-5 bg-white p-6 rounded-[1.5rem] border-2 shadow-inner">
                    <div className="h-12 w-12 bg-muted/20 rounded-full flex items-center justify-center shadow-sm">
                        <Navigation className={cn("h-6 w-6 transition-colors", formData.gps ? "text-primary" : "text-muted-foreground/30")} />
                    </div>
                    <div className="flex-1">
                        <p className="text-[9px] font-black uppercase text-muted-foreground leading-none mb-1.5 tracking-[0.15em]">COORDENADAS GPS</p>
                        <p className={cn("text-sm font-black uppercase tracking-tight", !formData.gps ? "text-muted-foreground/40 italic" : "text-primary")}>
                            {formData.gps || 'PENDIENTE DE CAPTURA'}
                        </p>
                    </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-2xl border-none overflow-hidden rounded-xl bg-white">
              <CardHeader className="bg-white border-b py-6 px-8">
                <CardTitle className="text-lg font-black uppercase text-primary flex items-center gap-3">
                    <Camera className="h-5 w-5" /> RESPALDO DOCUMENTAL
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-4">
                {photoDataUri ? (
                    <div className="relative aspect-video w-full rounded-2xl overflow-hidden border-4 border-white shadow-xl group">
                        <Image src={photoDataUri} alt="Respaldo" fill className="object-cover" />
                        <Button variant="destructive" size="icon" className="absolute top-4 right-4 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setPhotoDataUri(null)}>
                            <Trash2 className="h-5 w-5" />
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <label className="flex flex-col items-center justify-center gap-3 h-32 border-2 border-dashed rounded-[1.5rem] cursor-pointer hover:bg-muted/10 transition-all bg-muted/5 group">
                            <Camera className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest text-center">CÁMARA EN VIVO</span>
                            <Input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
                        </label>
                        <label className="flex flex-col items-center justify-center gap-3 h-32 border-2 border-dashed rounded-[1.5rem] cursor-pointer hover:bg-muted/10 transition-all bg-muted/5 group">
                            <FileUp className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest text-center">GALERÍA / ARCHIVO</span>
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
