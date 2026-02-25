
"use client";

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldAlert, FileWarning, Camera, Trash2, CheckCircle2, Globe, FileText, Printer } from 'lucide-react';
import { useUser, useFirebase, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, query, orderBy, where } from 'firebase/firestore';
import { Textarea } from '@/components/ui/textarea';
import jsPDF from 'jspdf';
import { type SolicitudCapacitacion } from '@/lib/data';
import { cn, formatDateToDDMMYYYY } from '@/lib/utils';
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

function DenunciaContent() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const agendaId = searchParams.get('solicitudId');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [denunciaFoto, setDenunciaFoto] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [selectedAgendaId, setSelectedAgendaId] = useState<string | null>(agendaId);
  
  const [formData, setFormData] = useState({
    nro_acta: '',
    detalles: '',
    fecha_denuncia: '',
    hora_denuncia: '',
  });

  useEffect(() => {
    const now = new Date();
    setFormData(prev => ({
      ...prev,
      fecha_denuncia: now.toISOString().split('T')[0],
      hora_denuncia: now.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false })
    }));

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

  const agendaQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !user?.profile) return null;
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    const profile = user.profile;
    
    const hasAdminFilter = ['admin', 'director'].includes(profile.role || '') || profile.permissions?.includes('admin_filter');
    const hasDeptFilter = !hasAdminFilter && profile.permissions?.includes('department_filter');
    const hasDistFilter = !hasAdminFilter && !hasDeptFilter && (profile.permissions?.includes('district_filter') || profile.role === 'jefe' || profile.role === 'funcionario');

    if (hasAdminFilter) return colRef;
    if (hasDeptFilter && profile.departamento) return query(colRef, where('departamento', '==', profile.departamento));
    if (hasDistFilter && profile.departamento && profile.distrito) {
        return query(colRef, where('departamento', '==', profile.departamento), where('distrito', '==', profile.distrito));
    }
    return null;
  }, [firestore, user, isUserLoading]);

  const { data: rawAgendaItems } = useCollection<SolicitudCapacitacion>(agendaQuery);

  const agendaItems = useMemo(() => {
    if (!rawAgendaItems) return null;
    return [...rawAgendaItems].sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [rawAgendaItems]);

  const selectedSolicitud = useMemo(() => {
    return agendaItems?.find(item => item.id === selectedAgendaId);
  }, [agendaItems, selectedAgendaId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setDenunciaFoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    if (!firestore || !user || !selectedSolicitud) return;
    if (!formData.nro_acta || !formData.detalles) {
        toast({ variant: "destructive", title: "Faltan datos" });
        return;
    }

    setIsSubmitting(true);
    const docData = {
      ...formData,
      solicitud_id: selectedAgendaId,
      departamento: selectedSolicitud.departamento,
      distrito: selectedSolicitud.distrito,
      lugar: selectedSolicitud.lugar_local,
      foto_evidencia: denunciaFoto || '',
      usuario_id: user.uid,
      username: user.profile?.username || '',
      fecha_creacion: new Date().toISOString(),
      server_timestamp: serverTimestamp(),
    };

    addDoc(collection(firestore, 'denuncias-lacres'), docData)
      .then(() => {
        toast({ title: "¡Denuncia Registrada!" });
        setFormData(p => ({ ...p, nro_acta: '', detalles: '' }));
        setDenunciaFoto(null);
        setIsSubmitting(false);
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ 
          path: 'denuncias-lacres', 
          operation: 'create', 
          requestResourceData: docData 
        }));
        setIsSubmitting(false);
      });
  };

  const generatePDF = () => {
    if (!logoBase64 || !selectedSolicitud) return;
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.addImage(logoBase64, 'PNG', margin, 10, 20, 20);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text("FORMULARIO DE DENUNCIA DE ADULTERACIÓN", 105, 20, { align: "center" });
    doc.text("DE LOS LACRES DE SEGURIDAD", 105, 26, { align: "center" });

    let y = 45;
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text("DATOS DE LA ACTIVIDAD:", margin, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.text(`LOCAL: ${selectedSolicitud.lugar_local.toUpperCase()}`, margin + 5, y); y += 6;
    doc.text(`UBICACIÓN: ${selectedSolicitud.distrito} - ${selectedSolicitud.departamento}`, margin + 5, y); y += 10;

    doc.setFont('helvetica', 'bold');
    doc.text(`NRO. ACTA: ${formData.nro_acta}`, margin, y); y += 10;
    
    doc.text("DETALLES DE LA IRREGULARIDAD:", margin, y); y += 6;
    doc.setFont('helvetica', 'normal');
    const splitText = doc.splitTextToSize(formData.detalles, 170);
    doc.text(splitText, margin + 5, y);
    y += (splitText.length * 6) + 10;

    if (denunciaFoto) {
        doc.setFont('helvetica', 'bold');
        doc.text("EVIDENCIA FOTOGRÁFICA:", margin, y);
        y += 6;
        doc.addImage(denunciaFoto, 'JPEG', margin, y, 170, 100);
        y += 110;
    }

    const finalY = doc.internal.pageSize.getHeight() - 40;
    doc.line(margin, finalY, margin + 60, finalY);
    doc.text("Firma del Responsable", margin, finalY + 5);
    doc.line(pageWidth - margin - 60, finalY, pageWidth - margin, finalY);
    doc.text("Sello de la Oficina", pageWidth - margin - 60, finalY + 5);

    doc.save(`Denuncia-Lacre-${formData.nro_acta || 'Reporte'}.pdf`);
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <Header title="Denuncia de Lacres" />
      <main className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Denuncia de Adulteración</h1>
                <p className="text-muted-foreground font-medium flex items-center gap-2 mt-1">
                    <FileWarning className="h-4 w-4" /> Reporte oficial de lacres violentados.
                </p>
            </div>
            <Button variant="outline" className="font-bold border-primary text-primary" onClick={generatePDF} disabled={!selectedSolicitud}>
                <Printer className="mr-2 h-4 w-4" /> PROFORMA PDF
            </Button>
        </div>

        <Card className="shadow-xl border-t-8 border-t-destructive overflow-hidden">
          <CardHeader className="bg-destructive/5 border-b">
            <CardTitle className="flex items-center gap-2 uppercase font-black text-destructive">
                <ShieldAlert className="h-6 w-6" /> 
                Acta de Irregularidad
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase">Complete los detalles de la adulteración detectada.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 pt-8">
            <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Vincular a Actividad de Agenda</Label>
                <Select onValueChange={setSelectedAgendaId} value={selectedAgendaId || undefined}>
                    <SelectTrigger className="h-12 border-2">
                        <SelectValue placeholder="Seleccione la actividad..." />
                    </SelectTrigger>
                    <SelectContent>
                        {agendaItems?.map(item => (
                            <SelectItem key={item.id} value={item.id}>
                                {formatDateToDDMMYYYY(item.fecha)} | {item.lugar_local}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {selectedSolicitud && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary">Nº de Acta de Irregularidad</Label>
                        <Input 
                            name="nro_acta"
                            value={formData.nro_acta} 
                            onChange={handleInputChange}
                            placeholder="EJ: ACTA CIDEE 001/2026"
                            className="font-black uppercase border-2 h-12"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Fecha Reporte</Label>
                            <Input value={formatDateToDDMMYYYY(formData.fecha_denuncia)} readOnly className="bg-muted/30 font-bold h-12" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Hora Reporte</Label>
                            <Input value={formData.hora_denuncia} readOnly className="bg-muted/30 font-bold h-12" />
                        </div>
                    </div>
                    <div className="md:col-span-2 space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary">Detalles de la Adulteración</Label>
                        <Textarea 
                            name="detalles"
                            value={formData.detalles} 
                            onChange={handleInputChange}
                            className="min-h-[150px] font-medium border-2"
                        />
                    </div>
                    <div className="md:col-span-2 space-y-4">
                        <Label className="text-[10px] font-black uppercase text-primary">Evidencia Fotográfica del Daño</Label>
                        {denunciaFoto ? (
                            <div className="relative aspect-video w-full max-w-lg rounded-2xl overflow-hidden border-4 border-white shadow-2xl group">
                                <Image src={denunciaFoto} alt="Denuncia" fill className="object-cover" />
                                <Button variant="destructive" size="icon" className="absolute top-4 right-4 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setDenunciaFoto(null)}>
                                    <Trash2 className="h-5 w-5" />
                                </Button>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center h-48 border-4 border-dashed rounded-3xl border-destructive/20 cursor-pointer hover:bg-destructive/5 transition-all bg-white">
                                <Camera className="h-12 w-12 text-destructive opacity-30 mb-2" />
                                <span className="font-black uppercase text-xs text-destructive opacity-60">Capturar Evidencia Visual</span>
                                <Input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
                            </label>
                        )}
                    </div>
                </div>
            )}
          </CardContent>
          <CardFooter className="bg-muted/30 border-t p-6">
            <Button onClick={handleSubmit} disabled={isSubmitting || !selectedAgendaId} className="w-full h-16 text-xl font-black uppercase shadow-2xl bg-destructive hover:bg-destructive/90">
              {isSubmitting ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : <ShieldAlert className="mr-3 h-6 w-6" />}
              REGISTRAR DENUNCIA OFICIAL
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}

export default function DenunciaLacresPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>}>
      <DenunciaContent />
    </Suspense>
  );
}
