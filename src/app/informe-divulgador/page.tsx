
"use client";

import { useState, useEffect, Suspense, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserCheck, FileDown, CalendarDays, Camera, Trash2, Image as ImageIcon, Plus, X, CheckCircle2 } from 'lucide-react';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';
import jsPDF from 'jspdf';
import { type SolicitudCapacitacion } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatDateToDDMMYYYY } from '@/lib/utils';
import Image from 'next/image';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

// --- Helper Functions ---
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<F>): Promise<ReturnType<F>> =>
      new Promise(resolve => {
        if (timeout) {
          clearTimeout(timeout);
        }
        timeout = setTimeout(() => resolve(func(...args)), waitFor);
      });
}

function InformeContent() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const agendaId = searchParams.get('solicitudId');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [markedCells, setMarcaciones] = useState<number[]>([]);
  const [eventPhotos, setEventPhotos] = useState<string[]>([]);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    lugar_divulgacion: '',
    fecha: '',
    hora_desde: '',
    hora_hasta: '',
    nombre_divulgador: '',
    cedula_divulgador: '',
    vinculo: '',
    oficina: '',
    departamento: '',
    distrito: '',
  });

  // State para búsqueda de Cédula del Divulgador
  const [isSearchingCedula, setIsSearchingCedula] = useState(false);
  const [padronFound, setPadronFound] = useState(false);

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
    if (!isUserLoading && user?.profile && !agendaId) {
      setFormData(prev => ({
        ...prev,
        nombre_divulgador: user.profile?.username || '',
        cedula_divulgador: user.profile?.cedula || '',
        vinculo: user.profile?.vinculo || '',
        oficina: user.profile?.distrito || '',
        departamento: user.profile?.departamento || '',
        distrito: user.profile?.distrito || '',
      }));
    }
  }, [user, isUserLoading, agendaId]);

  const agendaQuery = useMemoFirebase(() => {
    if (!firestore || !user?.profile?.distrito) return null;
    
    const canFilterAll = user.profile.role === 'admin' || user.profile.permissions?.includes('admin_filter');
    
    if (canFilterAll) {
        return collection(firestore, 'solicitudes-capacitacion');
    }

    return query(
      collection(firestore, 'solicitudes-capacitacion'),
      where('departamento', '==', user.profile.departamento),
      where('distrito', '==', user.profile.distrito)
    );
  }, [firestore, user]);

  const { data: agendaItems, isLoading: isLoadingAgenda } = useCollection<SolicitudCapacitacion>(agendaQuery);

  useEffect(() => {
    if (agendaId && agendaItems) {
      const item = agendaItems.find(a => a.id === agendaId);
      if (item) {
        setFormData(prev => ({
          ...prev,
          lugar_divulgacion: item.lugar_local,
          fecha: item.fecha,
          hora_desde: item.hora_desde,
          hora_hasta: item.hora_hasta,
          nombre_divulgador: item.divulgador_nombre || '',
          cedula_divulgador: item.divulgador_cedula || '',
          vinculo: item.divulgador_vinculo || '',
          oficina: item.distrito || '',
          departamento: item.departamento || '',
          distrito: item.distrito || '',
        }));
      }
    }
  }, [agendaId, agendaItems]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const searchCedulaInPadron = useCallback(async (cedula: string) => {
    if (!firestore || !cedula || cedula.length < 4) {
      setPadronFound(false);
      return;
    }
    setIsSearchingCedula(true);
    try {
      const padronRef = collection(firestore, 'padron');
      const cleanedCedula = cedula.replace(/[.,-]/g, '');
      const q = query(padronRef, where('cedula', '==', cleanedCedula), limit(1));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0].data();
        const fullName = `${userDoc.nombre || ''} ${userDoc.apellido || ''}`.trim();
        setFormData(prev => ({ ...prev, nombre_divulgador: fullName, cedula_divulgador: cedula }));
        setPadronFound(true);
        toast({ title: "Divulgador Encontrado", description: `Datos de ${fullName} cargados.` });
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

  const handleCedulaDivulgadorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData(prev => ({ ...prev, cedula_divulgador: value, nombre_divulgador: '' }));
    setPadronFound(false);
    debouncedSearch(value);
  };

  const clearDivulgadorData = () => {
      setFormData(p => ({ ...p, nombre_divulgador: '', cedula_divulgador: '' }));
      setPadronFound(false);
  }

  const handleAgendaSelect = (id: string) => {
    const item = agendaItems?.find(a => a.id === id);
    if (item) {
      setFormData(prev => ({
        ...prev,
        lugar_divulgacion: item.lugar_local,
        fecha: item.fecha,
        hora_desde: item.hora_desde,
        hora_hasta: item.hora_hasta,
        nombre_divulgador: item.divulgador_nombre || '',
        cedula_divulgador: item.divulgador_cedula || '',
        vinculo: item.divulgador_vinculo || '',
        oficina: item.distrito || '',
        departamento: item.departamento || '',
        distrito: item.distrito || '',
      }));
      toast({ title: "Actividad Vinculada", description: "Se han cargado los datos de la agenda." });
    }
  };

  const toggleCell = (num: number) => {
    setMarcaciones(prev => prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]);
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEventPhotos(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setEventPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!firestore || !user) return;
    if (!formData.lugar_divulgacion || !formData.fecha) {
        toast({ variant: "destructive", title: "Faltan datos", description: "Lugar y fecha son obligatorios." });
        return;
    }

    setIsSubmitting(true);
    const docData = {
      ...formData,
      departamento: formData.departamento || user.profile?.departamento || '',
      distrito: formData.distrito || user.profile?.distrito || '',
      total_personas: markedCells.length,
      marcaciones: markedCells,
      fotos: eventPhotos,
      usuario_id: user.uid,
      fecha_creacion: new Date().toISOString(),
      server_timestamp: serverTimestamp(),
    };

    try {
      await addDoc(collection(firestore, 'informes-divulgador'), docData);
      toast({ title: "¡Informe Guardado!", description: "El Anexo III se registró con éxito." });
      setMarcaciones([]);
      setEventPhotos([]);
    } catch (error) {
      const contextualError = new FirestorePermissionError({ 
        path: 'informes-divulgador', 
        operation: 'create', 
        requestResourceData: docData 
      });
      errorEmitter.emit('permission-error', contextualError);
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const generatePDF = async () => {
    if (!logoBase64) return;
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.addImage(logoBase64, 'PNG', margin, 10, 20, 20);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text("ANEXO III", pageWidth / 2, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text("INFORME DEL DIVULGADOR - CIDEE", pageWidth / 2, 28, { align: "center" });

    let y = 45;
    const addLine = (label: string, value: string) => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, margin, y);
        doc.setFont('helvetica', 'normal');
        doc.text(String(value || '').toUpperCase(), margin + 60, y);
        doc.line(margin + 60, y + 1, 190, y + 1);
        y += 10;
    };

    addLine("DIVULGADOR", formData.nombre_divulgador);
    addLine("CÉDULA N.º", formData.cedula_divulgador);
    addLine("VÍNCULO", formData.vinculo);
    addLine("OFICINA / DISTRITO", formData.oficina);
    addLine("DEPARTAMENTO", formData.departamento);
    addLine("LUGAR DE DIVULGACIÓN", formData.lugar_divulgacion);
    addLine("FECHA", formatDateToDDMMYYYY(formData.fecha));
    addLine("HORARIO", `${formData.hora_desde} A ${formData.hora_hasta} HS`);
    addLine("TOTAL PERSONAS", String(markedCells.length));

    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.text("MARCACIONES REALIZADAS:", margin, y);
    y += 8;
    
    const cellSize = 12;
    let currentX = margin;
    markedCells.sort((a,b) => a-b).forEach((num, idx) => {
        if (currentX + cellSize > 190) {
            currentX = margin;
            y += cellSize;
        }
        doc.rect(currentX, y, cellSize, cellSize);
        doc.text("X", currentX + 4, y + 8);
        doc.setFontSize(6);
        doc.text(String(num), currentX + 1, y + 3);
        doc.setFontSize(12);
        currentX += cellSize;
    });

    if (eventPhotos.length > 0) {
        doc.addPage();
        doc.text("RESPALDO FOTOGRÁFICO", 105, 20, { align: 'center' });
        let photoY = 30;
        eventPhotos.forEach((img, i) => {
            if (photoY + 60 > 280) {
                doc.addPage();
                photoY = 20;
            }
            doc.addImage(img, 'JPEG', margin, photoY, 80, 60);
            if (i % 2 === 0) {
                // Siguiente foto al lado
            } else {
                photoY += 70;
            }
        });
    }

    doc.save(`AnexoIII-${formData.cedula_divulgador}.pdf`);
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <Header title="Anexo III" />
      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
        
        <div className="mb-6">
          <Card className="bg-primary/5 border-primary/20 shadow-md">
            <CardHeader className="py-4">
              <CardTitle className="text-xs font-black flex items-center gap-2 uppercase tracking-widest text-primary">
                <CalendarDays className="h-4 w-4" />
                VINCULAR CON ACTIVIDAD DE LA AGENDA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select onValueChange={handleAgendaSelect} value={agendaId || undefined}>
                <SelectTrigger className="h-12 border-2 bg-white">
                  <SelectValue placeholder={isLoadingAgenda ? "Cargando actividades..." : "Seleccione una sesión programada..."} />
                </SelectTrigger>
                <SelectContent>
                  {agendaItems && agendaItems.length > 0 ? (
                    agendaItems.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {formatDateToDDMMYYYY(item.fecha)} | {item.lugar_local} ({item.solicitante_entidad})
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>No hay actividades disponibles</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-xl border-t-4 border-t-primary overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="flex items-center gap-2 uppercase font-black text-primary">
                <UserCheck className="h-6 w-6" /> 
                Informe Anexo III - Control Individual
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase">Registro de productividad por sesión de capacitación.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 pt-8">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/20 p-6 rounded-xl border-2 border-dashed">
              <div className="space-y-2">
                <Label className="font-black text-primary text-[10px] uppercase tracking-widest">Nombre Completo Divulgador</Label>
                <div className="relative">
                    <Input 
                        name="nombre_divulgador"
                        value={formData.nombre_divulgador} 
                        onChange={handleInputChange}
                        readOnly={padronFound}
                        className={cn("font-bold h-11 border-2", padronFound && "bg-green-50 border-green-300 text-green-900")}
                    />
                    {padronFound && (
                        <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={clearDivulgadorData}>
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-black text-primary text-[10px] uppercase tracking-widest">C.I.C. N.º</Label>
                  <div className="relative">
                    <Input 
                        name="cedula_divulgador" 
                        value={formData.cedula_divulgador} 
                        onChange={handleCedulaDivulgadorChange} 
                        disabled={isSearchingCedula}
                        className="font-black h-11 border-2"
                    />
                    {isSearchingCedula && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-black text-primary text-[10px] uppercase tracking-widest">Vínculo</Label>
                  <Input name="vinculo" value={formData.vinculo} onChange={handleInputChange} className="font-bold h-11 border-2" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-black text-primary text-[10px] uppercase tracking-widest">Oficina / Distrito</Label>
                <Input name="oficina" value={formData.oficina} onChange={handleInputChange} className="font-bold h-11 border-2" />
              </div>
              <div className="space-y-2">
                <Label className="font-black text-primary text-[10px] uppercase tracking-widest">Departamento</Label>
                <Input name="departamento" value={formData.departamento} onChange={handleInputChange} className="font-bold h-11 border-2" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Lugar de Divulgación</Label>
                    <Input name="lugar_divulgacion" value={formData.lugar_divulgacion} onChange={handleInputChange} className="font-bold h-11 border-2" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Fecha</Label>
                        <Input type="date" name="fecha" value={formData.fecha} onChange={handleInputChange} className="font-bold h-11 border-2" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Cantidad Personas</Label>
                        <Input value={markedCells.length} readOnly className="font-black h-11 border-2 bg-primary/5 text-primary text-xl text-center" />
                    </div>
                </div>
            </div>

            <Separator />

            <div className="space-y-4">
                <Label className="font-black text-sm uppercase tracking-tight text-primary block">
                    TABLERO DE MARCACIONES (MARCA CON UNA "X" POR CADA CIUDADANO)
                </Label>
                <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-13 border rounded-xl overflow-hidden bg-background shadow-inner">
                    {Array.from({ length: 104 }, (_, i) => i + 1).map(num => (
                        <div 
                            key={num} 
                            onClick={() => toggleCell(num)} 
                            className={cn(
                                "aspect-square border flex flex-col items-center justify-center cursor-pointer transition-all duration-75", 
                                markedCells.includes(num) ? "bg-primary text-white scale-95 shadow-inner" : "hover:bg-primary/5 text-muted-foreground"
                            )}
                        >
                            <span className={cn("text-[8px] font-bold leading-none mb-0.5", markedCells.includes(num) ? "text-white/60" : "")}>{num}</span>
                            <span className="text-xl font-black leading-none">{markedCells.includes(num) ? "X" : ""}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-4">
                <Label className="font-black text-sm uppercase tracking-tight text-primary block">REGISTRO FOTOGRÁFICO DEL EVENTO</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {eventPhotos.map((photo, idx) => (
                        <div key={idx} className="relative aspect-video rounded-lg overflow-hidden border-2 group shadow-sm">
                            <Image src={photo} alt={`Foto ${idx + 1}`} fill className="object-cover" />
                            <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removePhoto(idx)}>
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        </div>
                    ))}
                    <label className="aspect-video border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-primary/5 transition-colors border-primary/20 text-primary">
                        <Camera className="h-6 w-6 mb-1" />
                        <span className="text-[10px] font-black uppercase">Añadir Foto</span>
                        <Input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
                    </label>
                </div>
            </div>

          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-4 border-t p-6 bg-muted/30">
            <Button onClick={generatePDF} variant="outline" className="w-full sm:w-auto font-black h-14 px-8 border-primary text-primary hover:bg-primary/5">
              <FileDown className="mr-2 h-5 w-5" /> DESCARGAR ANEXO III
            </Button>
            <div className="flex-1" />
            <Button onClick={handleSubmit} disabled={isSubmitting || markedCells.length === 0} className="w-full sm:w-auto px-12 h-14 font-black text-xl uppercase shadow-2xl">
              {isSubmitting ? <><Loader2 className="animate-spin mr-3 h-6 w-6" /> GUARDANDO...</> : <><CheckCircle2 className="mr-3 h-6 w-6" /> GUARDAR INFORME</>}
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}

export default function InformeDivulgadorPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>}>
      <InformeContent />
    </Suspense>
  );
}
