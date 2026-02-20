'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText, Search, Building, Camera, Trash2, FileUp, X } from 'lucide-react';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, where, getDocs, limit } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
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
    gps: '',
  });

  const [photoDataUri, setPhotoDataUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPartyPopoverOpen, setIsPartyPopoverOpen] = useState(false);
  const [isSearchingCedula, setIsSearchingCedula] = useState(false);
  const [padronFound, setPadronFound] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

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

  const handlePreviewPDF = () => {
    if (!logoBase64) {
      toast({ variant: 'destructive', title: 'Error', description: 'El logo institucional aún no ha cargado.' });
      return;
    }

    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.addImage(logoBase64, 'PNG', margin, 10, 20, 20);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text("JUSTICIA ELECTORAL", 105, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text("ANEXO V: SOLICITUD DE CAPACITACIÓN / DIVULGACIÓN", 105, 28, { align: "center" });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-PY')}`, pageWidth - margin, 35, { align: 'right' });

    let y = 50;
    const addRow = (label: string, value: string) => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${label}:`, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value || '').toUpperCase(), margin + 65, y);
      doc.line(margin + 65, y + 1, 190, y + 1);
      y += 12;
    };

    addRow("GRUPO POLÍTICO", formData.solicitante_entidad);
    addRow("TIPO DE ACTIVIDAD", formData.tipo_solicitud.join(' y ').toUpperCase());
    addRow("FECHA PROPUESTA", formatDateToDDMMYYYY(formData.fecha));
    addRow("HORARIO", `${formData.hora_desde} a ${formData.hora_hasta} HS`);
    addRow("LUGAR / LOCAL", formData.lugar_local);
    addRow("DIRECCIÓN", formData.direccion_calle);
    addRow("BARRIO", formData.barrio_compania);
    addRow("DISTRITO", user?.profile?.distrito || '');
    addRow("DEPARTAMENTO", user?.profile?.departamento || '');

    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.text("DATOS DEL RESPONSABLE SOLICITANTE", margin, y);
    y += 10;

    addRow("NOMBRE COMPLETO", formData.nombre_completo);
    addRow("CÉDULA DE IDENTIDAD", formData.cedula);
    addRow("TELÉFONO", formData.telefono);
    addRow("ROL", formData.rol_solicitante.toUpperCase());

    if (photoDataUri) {
      y += 10;
      doc.setFont('helvetica', 'bold');
      doc.text("DOCUMENTO ADJUNTO / FIRMA:", margin, y);
      doc.addImage(photoDataUri, 'JPEG', margin + 65, y - 5, 60, 45);
      y += 50;
    } else {
      y += 30;
    }

    doc.setFontSize(9);
    doc.text("__________________________", 55, y, { align: "center" });
    doc.text("Firma del Solicitante", 55, y + 5, { align: "center" });
    doc.text("__________________________", 155, y, { align: "center" });
    doc.text("Sello y Firma Justicia Electoral", 155, y + 5, { align: "center" });

    doc.save(`AnexoV-${formData.solicitante_entidad || 'Solicitud'}.pdf`);
  };

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
        gps: '',
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
          <Button 
            onClick={handlePreviewPDF} 
            variant="outline" 
            className="font-bold border-primary text-primary hover:bg-primary/5"
          >
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
