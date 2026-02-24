
"use client";

import { useState, useMemo, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription as CardDescriptionUI } from '@/components/ui/card';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where, doc, updateDoc } from 'firebase/firestore';
import { type SolicitudCapacitacion, type Dato, type Divulgador } from '@/lib/data';
import { Loader2, Calendar, MapPin, LayoutList, Building2, QrCode, Printer, UserPlus, CheckCircle2, UserCheck, Search, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { formatDateToDDMMYYYY } from '@/lib/utils';
import jsPDF from 'jspdf';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AgendaCapacitacionPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [qrSolicitud, setQrSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [assigningSolicitud, setAssigningSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [divulSearch, setDivulSearch] = useState('');

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

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollection<Dato>(datosQuery);

  const solicitudesQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !user?.uid || !user?.profile) return null;
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    const profile = user.profile;
    
    const canViewAll = ['admin', 'director'].includes(profile.role || '') || profile.permissions?.includes('admin_filter');
    
    if (canViewAll) return query(colRef, orderBy('fecha', 'asc'));
    
    if (profile.departamento && profile.distrito) {
        return query(colRef, where('departamento', '==', profile.departamento), where('distrito', '==', profile.distrito), orderBy('fecha', 'asc'));
    }
    
    return null;
  }, [firestore, user, isUserLoading]);

  const { data: solicitudes, isLoading: isLoadingSolicitudes } = useCollection<SolicitudCapacitacion>(solicitudesQuery);

  const divulgadoresQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !user?.profile) return null;
    const colRef = collection(firestore, 'divulgadores');
    const profile = user.profile;

    const canViewAll = ['admin', 'director'].includes(profile.role || '') || profile.permissions?.includes('admin_filter');
    if (canViewAll) return query(colRef, orderBy('nombre'));

    if (profile.departamento && profile.distrito) {
      return query(
        colRef, 
        where('departamento', '==', profile.departamento), 
        where('distrito', '==', profile.distrito),
        orderBy('nombre')
      );
    }
    return null;
  }, [firestore, user, isUserLoading]);

  const { data: divulgadores, isLoading: isLoadingDivul } = useCollection<Divulgador>(divulgadoresQuery);

  const filteredDivul = useMemo(() => {
    if (!divulgadores) return [];
    const term = divulSearch.toLowerCase().trim();
    return divulgadores.filter(d => 
      d.nombre.toLowerCase().includes(term) || d.cedula.includes(term)
    );
  }, [divulgadores, divulSearch]);

  const structuredAgenda = useMemo(() => {
    if (!datosData || !solicitudes) return [];
    const deptsMap: Map<string, { code: string, name: string, districts: Map<string, SolicitudCapacitacion[]> }> = new Map();
    
    datosData.forEach(d => {
      if (!deptsMap.has(d.departamento)) {
        deptsMap.set(d.departamento, { code: d.departamento_codigo || '00', name: d.departamento, districts: new Map() });
      }
    });

    solicitudes.forEach(s => {
      const dept = deptsMap.get(s.departamento);
      if (dept) {
        if (!dept.districts.has(s.distrito)) dept.districts.set(s.distrito, []);
        dept.districts.get(s.distrito)!.push(s);
      }
    });

    return Array.from(deptsMap.values())
      .filter(d => d.districts.size > 0)
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [datosData, solicitudes]);

  const handleAssignDivulgador = async (divulgador: Divulgador) => {
    if (!assigningSolicitud || !firestore) return;
    setIsUpdating(true);
    try {
      const docRef = doc(firestore, 'solicitudes-capacitacion', assigningSolicitud.id);
      await updateDoc(docRef, {
        divulgador_id: divulgador.id,
        divulgador_nombre: divulgador.nombre,
        divulgador_cedula: divulgador.cedula,
        divulgador_vinculo: divulgador.vinculo
      });
      toast({ title: "Personal Asignado", description: `${divulgador.nombre} ha sido asignado a la actividad.` });
      setAssigningSolicitud(null);
    } catch (error) {
      toast({ variant: 'destructive', title: "Error al asignar" });
    } finally {
      setIsUpdating(false);
    }
  };

  const getEncuestaUrl = (id: string) => {
      if (typeof window === 'undefined') return '';
      const baseUrl = window.location.origin;
      return `${baseUrl}/encuesta-satisfaccion?solicitudId=${id}`;
  }

  const handlePrintQrPdf = async () => {
    if (!qrSolicitud || !logoBase64) return;
    setIsGeneratingPdf(true);

    try {
      const url = getEncuestaUrl(qrSolicitud.id);
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}`;
      
      const response = await fetch(qrApiUrl);
      const blob = await response.blob();
      const qrBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;

      doc.addImage(logoBase64, 'PNG', margin, 15, 25, 25);
      doc.setFontSize(18); doc.setFont('helvetica', 'bold');
      doc.text("JUSTICIA ELECTORAL", 50, 25);
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text("Dirección General del Registro Electoral", 50, 31);
      doc.text("Centro de Información, Documentación y Educación Electoral (CIDEE)", 50, 36);
      doc.line(margin, 45, pageWidth - margin, 45);

      doc.setFontSize(22); doc.setFont('helvetica', 'bold');
      doc.text("ENCUESTA DE SATISFACCIÓN", pageWidth / 2, 70, { align: 'center' });
      doc.setFontSize(14); doc.setFont('helvetica', 'normal');
      doc.text("Uso de la Máquina de Votación Electrónica", pageWidth / 2, 80, { align: 'center' });

      doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text(`LOCAL: ${qrSolicitud.lugar_local.toUpperCase()}`, pageWidth / 2, 100, { align: 'center' });
      doc.setFontSize(12);
      doc.text(`${qrSolicitud.distrito} - ${qrSolicitud.departamento}`, pageWidth / 2, 108, { align: 'center' });

      const qrSize = 100;
      doc.addImage(qrBase64, 'PNG', (pageWidth - qrSize) / 2, 120, qrSize, qrSize);

      doc.setFontSize(12); doc.setFont('helvetica', 'bold');
      doc.text("ESCANEE EL CÓDIGO QR PARA COMPLETAR LA ENCUESTA", pageWidth / 2, 235, { align: 'center' });
      
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text("Link de acceso directo:", pageWidth / 2, 245, { align: 'center' });
      doc.text(url, pageWidth / 2, 250, { align: 'center', maxWidth: 150 });

      doc.save(`QR-Encuesta-${qrSolicitud.lugar_local.replace(/\s+/g, '-')}.pdf`);
      toast({ title: "PDF Generado" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (isUserLoading || isLoadingSolicitudes || isLoadingDatos) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
  }

  // Lógica de visibilidad corregida: permitir acceso si tiene admin_filter o jurisdicción completa
  const canViewAll = ['admin', 'director'].includes(user?.profile?.role || '') || user?.profile?.permissions?.includes('admin_filter');
  const hasNoJurisdiction = user && !user.profile?.departamento && !canViewAll;

  if (hasNoJurisdiction) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header title="Agenda de Capacitaciones" />
        <main className="flex-1 p-8 flex items-center justify-center">
          <Card className="max-w-md w-full text-center p-8 border-dashed">
            <ShieldAlert className="h-16 w-16 mx-auto text-muted-foreground opacity-20 mb-4" />
            <h2 className="text-xl font-black uppercase text-primary mb-2">Perfil Incompleto</h2>
            <p className="text-sm text-muted-foreground font-medium">
              No tienes una jurisdicción (Departamento/Distrito) asignada. Por favor, solicita a un administrador que complete tu perfil para visualizar la agenda.
            </p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/5">
      <Header title="Agenda de Capacitaciones" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight uppercase text-primary">Agenda Consolidada</h1>
            <p className="text-muted-foreground flex items-center gap-2 mt-1 text-sm">
              <LayoutList className="h-4 w-4" />
              Gestión nacional de actividades del CIDEE.
            </p>
          </div>
        </div>

        {structuredAgenda.length === 0 ? (
          <Card className="p-12 text-center border-dashed bg-white">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-bold text-muted-foreground uppercase">No hay actividades registradas.</p>
          </Card>
        ) : (
          <div className="space-y-6">
            <Accordion type="multiple" className="w-full space-y-4">
              {structuredAgenda.map((dept) => (
                <AccordionItem key={dept.name} value={dept.name} className="border bg-white rounded-xl overflow-hidden shadow-sm">
                  <AccordionTrigger className="hover:no-underline px-6 py-4 bg-primary/5 group">
                    <div className="flex items-center gap-4 text-left">
                      <div className="h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center font-black text-sm">
                        {dept.code}
                      </div>
                      <div>
                        <h2 className="text-xl font-black uppercase tracking-tight group-hover:text-primary transition-colors">{dept.name}</h2>
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{Array.from(dept.districts.values()).flat().length} ACTIVIDADES PROGRAMADAS</span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-0 border-t">
                    <div className="divide-y divide-muted/50 bg-white">
                      {Array.from(dept.districts.entries()).map(([dist, items]) => (
                        <div key={dist} className="p-0">
                          <div className="flex items-center gap-2 px-6 py-4 bg-muted/10">
                            <Building2 className="h-5 w-5 text-primary" />
                            <h3 className="text-md font-black uppercase text-foreground">{dept.code} - {dist}</h3>
                          </div>
                          
                          <div className="p-4 sm:px-6 space-y-4">
                            {items.map((item) => (
                              <Card key={item.id} className="group relative border shadow-none hover:border-primary transition-all overflow-hidden">
                                <div className="p-4 sm:p-6">
                                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                                    <div className="lg:col-span-3 space-y-1">
                                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">SOLICITANTE</p>
                                      <p className="font-black text-sm uppercase leading-none text-primary">{item.nombre_completo}</p>
                                      <div className="pt-2">
                                        <Badge variant="secondary" className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border-none">
                                          {item.tipo_solicitud === 'divulgacion' ? 'DIVULGACION' : 'CAPACITACION'}
                                        </Badge>
                                      </div>
                                    </div>

                                    <div className="lg:col-span-3 space-y-3">
                                      <div className="flex items-center gap-3">
                                        <MapPin className="h-4 w-4 text-muted-foreground" />
                                        <p className="text-xs font-black uppercase leading-tight">{item.lugar_local}</p>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        <p className="text-[10px] font-black uppercase tracking-tight">
                                          {formatDateToDDMMYYYY(item.fecha)} <span className="text-muted-foreground mx-1">|</span> {item.hora_desde} HS
                                        </p>
                                      </div>
                                    </div>

                                    <div className="lg:col-span-3">
                                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-1">DIVULGADOR ASIGNADO</p>
                                      {item.divulgador_nombre ? (
                                        <div className="flex items-center gap-2 text-green-700">
                                          <UserCheck className="h-4 w-4" />
                                          <p className="text-xs font-black uppercase leading-tight">{item.divulgador_nombre}</p>
                                        </div>
                                      ) : (
                                        <p className="text-[10px] font-bold text-destructive uppercase italic">Sin asignar</p>
                                      )}
                                    </div>

                                    <div className="lg:col-span-3 flex flex-wrap lg:flex-nowrap justify-end gap-2 items-center">
                                      {(user?.profile?.role === 'admin' || user?.profile?.role === 'jefe' || user?.profile?.permissions?.includes('assign_staff')) && (
                                        <Button 
                                          variant="outline" 
                                          size="sm" 
                                          className="h-9 text-[9px] font-black uppercase border-2 border-primary/20 text-primary hover:bg-primary hover:text-white transition-all flex-1 lg:flex-none"
                                          onClick={() => setAssigningSolicitud(item)}
                                        >
                                          <UserPlus className="mr-1.5 h-3 w-3" /> {item.divulgador_id ? 'REASIGNAR' : 'ASIGNAR'}
                                        </Button>
                                      )}

                                      <Button variant="outline" size="sm" className="h-9 text-[9px] font-black uppercase border-2 flex-1 lg:flex-none" onClick={() => setQrSolicitud(item)}>
                                          <QrCode className="mr-1.5 h-3 w-3" /> QR ENCUESTA
                                      </Button>
                                      
                                      <Link href={`/informe-divulgador?solicitudId=${item.id}`} className="flex-1 lg:flex-none">
                                        <Button variant="default" size="sm" className="h-9 w-full text-[9px] font-black uppercase shadow-lg px-6">
                                          INFORME
                                        </Button>
                                      </Link>
                                    </div>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}
      </main>

      {/* Assignment Dialog */}
      <Dialog open={!!assigningSolicitud} onOpenChange={(o) => !o && setAssigningSolicitud(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl">
          <DialogHeader className="p-6 bg-primary text-white">
            <DialogTitle className="uppercase font-black text-xl flex items-center gap-2">
              <UserPlus className="h-6 w-6" /> ASIGNAR PERSONAL
            </DialogTitle>
            <DialogDescription className="text-white/70 font-bold uppercase text-[10px]">
              {assigningSolicitud?.lugar_local} | {assigningSolicitud?.distrito}
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por nombre o cédula..." 
                className="pl-10 h-12 font-bold"
                value={divulSearch}
                onChange={(e) => setDivulSearch(e.target.value)}
              />
            </div>

            <ScrollArea className="h-[300px] border rounded-xl bg-muted/10 p-2">
              {isLoadingDivul ? (
                <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-primary" /></div>
              ) : filteredDivul.length > 0 ? (
                <div className="space-y-2">
                  {filteredDivul.map(divul => (
                    <div 
                      key={divul.id} 
                      className="p-4 bg-white rounded-lg border-2 hover:border-primary cursor-pointer transition-all flex items-center justify-between group"
                      onClick={() => handleAssignDivulgador(divul)}
                    >
                      <div>
                        <p className="font-black text-xs uppercase text-primary">{divul.nombre}</p>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase">C.I. {divul.cedula} • {divul.vinculo}</p>
                      </div>
                      <UserCheck className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-2">
                  <UserPlus className="h-8 w-8 opacity-20" />
                  <p className="text-[10px] font-black uppercase">No se encontró personal disponible.</p>
                </div>
              )}
            </ScrollArea>
          </div>
          <DialogFooter className="p-6 bg-muted/30 border-t">
            <Button variant="ghost" className="w-full font-black uppercase text-[10px]" onClick={() => setAssigningSolicitud(null)}>CANCELAR</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Dialog */}
      <Dialog open={!!qrSolicitud} onOpenChange={(o) => !o && setQrSolicitud(null)}>
          <DialogContent className="max-w-xs text-center p-8 rounded-3xl">
              <DialogHeader>
                  <DialogTitle className="uppercase font-black text-xl">QR ENCUESTA</DialogTitle>
                  <DialogDescription className="text-[10px] font-bold uppercase text-primary">
                    {qrSolicitud?.lugar_local}
                  </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center justify-center space-y-6 pt-4">
                  <div className="p-4 bg-white border-4 border-primary rounded-[2.5rem] shadow-2xl">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getEncuestaUrl(qrSolicitud?.id || ''))}`} 
                        alt="QR Encuesta" 
                        className="w-48 h-48"
                      />
                  </div>
                  <div className="space-y-2 w-full">
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">LINK DE ACCESO:</p>
                      <code className="text-[8px] bg-muted p-3 rounded-xl block break-all font-mono border-2 border-dashed">
                          {getEncuestaUrl(qrSolicitud?.id || '')}
                      </code>
                  </div>
                  <div className="grid grid-cols-1 gap-2 w-full">
                    <Button onClick={handlePrintQrPdf} disabled={isGeneratingPdf} className="w-full h-12 font-black uppercase text-[10px] shadow-lg">
                        {isGeneratingPdf ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Printer className="mr-2 h-4 w-4" />}
                        IMPRIMIR QR
                    </Button>
                    <Button variant="ghost" className="w-full text-[10px] font-black uppercase" onClick={() => setQrSolicitud(null)}>CERRAR</Button>
                  </div>
              </div>
          </DialogContent>
      </Dialog>
    </div>
  );
}
