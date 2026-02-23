
"use client";

import { useState, useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription as CardDescriptionUI } from '@/components/ui/card';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where, doc, updateDoc } from 'firebase/firestore';
import { type SolicitudCapacitacion, type Dato } from '@/lib/data';
import { Loader2, Calendar, MapPin, ClipboardCheck, LayoutList, Building2, UserPlus, CheckCircle2, QrCode, X, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { formatDateToDDMMYYYY } from '@/lib/utils';
import { Label } from '@/components/ui/label';

export default function AgendaCapacitacionPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [qrSolicitud, setQrSolicitud] = useState<SolicitudCapacitacion | null>(null);

  // Master list of departments and districts
  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollection<Dato>(datosQuery);

  // User list for assignment
  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !user?.profile) return null;
    const canFilterAll = user.profile.role === 'admin' || user.profile.permissions?.includes('admin_filter');
    if (canFilterAll) return collection(firestore, 'users');
    return query(collection(firestore, 'users'), where('distrito', '==', user.profile.distrito || ''));
  }, [firestore, user]);
  
  const { data: staffUsers } = useCollection(usersQuery);

  const solicitudesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.profile) return null;
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    const canViewAll = user.profile.role === 'admin' || user.profile.permissions?.includes('admin_filter');
    if (canViewAll) return query(colRef, orderBy('fecha', 'asc'));
    return query(colRef, where('departamento', '==', user.profile.departamento), where('distrito', '==', user.profile.distrito), orderBy('fecha', 'asc'));
  }, [firestore, user]);

  const { data: solicitudes, isLoading: isLoadingSolicitudes } = useCollection<SolicitudCapacitacion>(solicitudesQuery);

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

  const handleAssignDivulgador = async (userId: string) => {
    if (!firestore || !selectedSolicitud) return;
    const selectedUser = staffUsers?.find(u => u.id === userId);
    if (!selectedUser) return;
    setIsAssigning(true);
    try {
      await updateDoc(doc(firestore, 'solicitudes-capacitacion', selectedSolicitud.id), {
        divulgador_id: selectedUser.id,
        divulgador_nombre: selectedUser.username,
        divulgador_cedula: selectedUser.cedula || '',
        divulgador_vinculo: selectedUser.vinculo || ''
      });
      toast({ title: "¡Divulgador Asignado!", description: `${selectedUser.username} ha sido asignado.` });
      setSelectedSolicitud(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo realizar la asignación." });
    } finally {
      setIsAssigning(false);
    }
  };

  const getEncuestaUrl = (id: string) => {
      if (typeof window === 'undefined') return '';
      const baseUrl = window.location.origin;
      return `${baseUrl}/encuesta-satisfaccion?solicitudId=${id}`;
  }

  const canAssign = user?.profile?.role === 'admin' || user?.profile?.permissions?.includes('assign_staff');

  if (isUserLoading || isLoadingSolicitudes || isLoadingDatos) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
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
              Gestión nacional de actividades y asignaciones del CIDEE.
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
            <Accordion type="multiple" className="w-full space-y-4" defaultValue={structuredAgenda.map(d => d.name)}>
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
                          {/* District Header visually similar to user image */}
                          <div className="flex items-center gap-2 px-6 py-4 bg-muted/10">
                            <Building2 className="h-5 w-5 text-primary" />
                            <h3 className="text-md font-black uppercase text-foreground">{dept.code} - {dist}</h3>
                          </div>
                          
                          <div className="p-4 sm:px-6 space-y-4">
                            {items.map((item) => (
                              <Card key={item.id} className="group relative border shadow-none hover:border-primary transition-all overflow-hidden">
                                <div className="p-4 sm:p-6">
                                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                                    {/* Column 1: Solicitante */}
                                    <div className="lg:col-span-3 space-y-1">
                                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">SOLICITANTE</p>
                                      <p className="font-black text-sm uppercase leading-none text-primary">{item.nombre_completo}</p>
                                      <div className="pt-2">
                                        <Badge variant="secondary" className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border-none">
                                          {item.tipo_solicitud === 'divulgacion' ? 'DIVULGACION' : 'CAPACITACION'}
                                        </Badge>
                                      </div>
                                    </div>

                                    {/* Column 2: Ubicacion y Fecha */}
                                    <div className="lg:col-span-3 space-y-3">
                                      <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                          <MapPin className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <p className="text-xs font-black uppercase leading-tight">{item.lugar_local}</p>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                          <Calendar className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-tight">
                                          {formatDateToDDMMYYYY(item.fecha)} <span className="text-muted-foreground mx-1">|</span> {item.hora_desde} HS
                                        </p>
                                      </div>
                                    </div>

                                    {/* Column 3: Divulgador Info & Asignar */}
                                    <div className="lg:col-span-3 space-y-2">
                                      <div className="p-4 rounded-xl bg-muted/20 border-2 border-dashed border-muted transition-colors group-hover:bg-primary/5 group-hover:border-primary/20">
                                          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">DIVULGADOR ASIGNADO</p>
                                          <p className="text-sm font-black uppercase text-primary truncate">
                                            {item.divulgador_nombre || 'POR ASIGNAR'}
                                          </p>
                                      </div>
                                      {canAssign && (
                                          <Button variant="outline" size="sm" className="h-9 w-full text-[9px] font-black uppercase border-2 border-primary/20 hover:border-primary hover:bg-primary/5 transition-all" onClick={() => setSelectedSolicitud(item)}>
                                              <UserPlus className="mr-2 h-3.5 w-3.5" /> ASIGNAR PERSONAL
                                          </Button>
                                      )}
                                    </div>

                                    {/* Column 4: Botones de Acción */}
                                    <div className="lg:col-span-3 flex flex-wrap lg:flex-nowrap justify-end gap-2 items-center">
                                      <Button variant="outline" size="sm" className="h-10 text-[10px] font-black uppercase border-2 flex-1 lg:flex-none" onClick={() => setQrSolicitud(item)}>
                                          <QrCode className="mr-2 h-3.5 w-3.5" /> QR ENCUESTA
                                      </Button>
                                      
                                      <Link href={`/informe-divulgador?solicitudId=${item.id}`} className="flex-1 lg:flex-none">
                                        <Button variant="default" size="sm" className="h-10 w-full text-[10px] font-black uppercase shadow-lg px-8">
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
                  <Button variant="ghost" className="w-full text-[10px] font-black uppercase" onClick={() => setQrSolicitud(null)}>CERRAR</Button>
              </div>
          </DialogContent>
      </Dialog>

      {/* Assignment Dialog */}
      <Dialog open={!!selectedSolicitud} onOpenChange={(o) => !o && setSelectedSolicitud(null)}>
          <DialogContent className="max-w-md p-8">
              <DialogHeader>
                <DialogTitle className="uppercase font-black text-xl mb-2">Asignar Personal</DialogTitle>
                <DialogDescription className="text-xs font-bold uppercase">
                  Seleccione el funcionario que realizará la divulgación en {selectedSolicitud?.lugar_local}.
                </DialogDescription>
              </DialogHeader>
              <div className="py-6 space-y-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary">FUNCIONARIO DISPONIBLE</Label>
                    <Select onValueChange={handleAssignDivulgador} disabled={isAssigning}>
                        <SelectTrigger className="h-12 border-2 font-bold text-sm">
                          <SelectValue placeholder="Buscar por nombre..." />
                        </SelectTrigger>
                        <SelectContent>
                            {staffUsers?.map(u => (
                              <SelectItem key={u.id} value={u.id} className="font-bold uppercase text-[10px]">
                                {u.username} <span className="text-muted-foreground font-normal ml-2">({u.role})</span>
                              </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                  </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" className="uppercase font-black text-[10px]" onClick={() => setSelectedSolicitud(null)}>CANCELAR</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
