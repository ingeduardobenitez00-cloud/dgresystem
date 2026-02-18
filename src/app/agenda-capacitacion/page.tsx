
"use client";

import { useState, useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where, doc, updateDoc } from 'firebase/firestore';
import { type SolicitudCapacitacion, type Dato } from '@/lib/data';
import { Loader2, Calendar, MapPin, FileImage, ClipboardCheck, LayoutList, Building2, Users, UserPlus, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export default function AgendaCapacitacionPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  // Master list of departments and districts
  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollection<Dato>(datosQuery);

  // User list for assignment
  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !user?.profile) return null;
    return query(
      collection(firestore, 'users'),
      where('distrito', '==', user.profile.distrito || '')
    );
  }, [firestore, user]);
  const { data: staffUsers } = useCollection(usersQuery);

  const solicitudesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.profile) return null;
    
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    const isAdministrative = user.profile.role === 'admin' || user.profile.role === 'director' || user.profile.role === 'jefe';

    if (isAdministrative) {
      return query(colRef, orderBy('fecha', 'asc'));
    }
    
    // Divulgadores and Funcionarios only see their district
    return query(
      colRef,
      where('departamento', '==', user.profile.departamento),
      where('distrito', '==', user.profile.distrito),
      orderBy('fecha', 'asc')
    );
  }, [firestore, user]);

  const { data: solicitudes, isLoading: isLoadingSolicitudes } = useCollection<SolicitudCapacitacion>(solicitudesQuery);

  const structuredAgenda = useMemo(() => {
    if (!datosData || !solicitudes) return [];

    const deptsMap: Map<string, { code: string, name: string, districts: Map<string, SolicitudCapacitacion[]> }> = new Map();

    datosData.forEach(d => {
      if (!deptsMap.has(d.departamento)) {
        deptsMap.set(d.departamento, {
          code: d.departamento_codigo || '00',
          name: d.departamento,
          districts: new Map()
        });
      }
    });

    solicitudes.forEach(s => {
      const dept = deptsMap.get(s.departamento);
      if (dept) {
        if (!dept.districts.has(s.distrito)) {
          dept.districts.set(s.distrito, []);
        }
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
        // Since we don't have CI in UserProfile yet, we use a placeholder or leave it empty for manual fill
        divulgador_cedula: '' 
      });
      toast({ title: "¡Divulgador Asignado!", description: `${selectedUser.username} ha sido asignado a esta actividad.` });
      setSelectedSolicitud(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo realizar la asignación." });
    } finally {
      setIsAssigning(false);
    }
  };

  const stats = useMemo(() => {
    if (!solicitudes) return { total: 0, depts: 0 };
    return {
      total: solicitudes.length,
      depts: structuredAgenda.length
    };
  }, [solicitudes, structuredAgenda]);

  const canAssign = user?.profile?.role === 'admin' || user?.profile?.role === 'director' || user?.profile?.role === 'jefe';

  if (isUserLoading || isLoadingSolicitudes || isLoadingDatos) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-primary"/>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/10">
      <Header title="Agenda Consolidada - CIDEE" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white p-6 rounded-lg border shadow-sm">
          <div>
            <h1 className="text-3xl font-black tracking-tight uppercase text-primary">Agenda de Capacitaciones</h1>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              <LayoutList className="h-4 w-4" />
              Gestión nacional de actividades y asignaciones.
            </p>
          </div>
          <div className="flex gap-4">
            <div className="text-center px-4 py-2 bg-primary/5 rounded-md border border-primary/10">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Departamentos</p>
              <p className="text-2xl font-black text-primary">{stats.depts}</p>
            </div>
            <div className="text-center px-4 py-2 bg-primary/5 rounded-md border border-primary/10">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Total Solicitudes</p>
              <p className="text-2xl font-black text-primary">{stats.total}</p>
            </div>
          </div>
        </div>

        {structuredAgenda.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No hay actividades agendadas para mostrar.</p>
          </Card>
        ) : (
          <div className="space-y-6">
            <Accordion type="multiple" className="w-full space-y-4">
              {structuredAgenda.map((dept) => (
                <AccordionItem key={dept.name} value={dept.name} className="border bg-white rounded-lg overflow-hidden shadow-sm">
                  <AccordionTrigger className="hover:no-underline px-6 py-5 bg-muted/10">
                    <div className="flex items-center gap-4 text-left">
                      <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black border border-primary/20">
                        {dept.code}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold uppercase tracking-tight">{dept.name}</h2>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">
                          {Array.from(dept.districts.values()).flat().length} ACTIVIDADES
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-0">
                    <div className="divide-y border-t bg-muted/5">
                      {Array.from(dept.districts.entries()).map(([dist, items]) => (
                        <div key={dist} className="p-6">
                          <div className="flex items-center gap-2 mb-4">
                            <Building2 className="h-5 w-5 text-primary" />
                            <h3 className="text-lg font-black uppercase text-foreground/80">{dist}</h3>
                          </div>
                          
                          <div className="grid grid-cols-1 gap-4">
                            {items.map((item) => (
                              <div key={item.id} className="group relative border rounded-md p-4 hover:border-primary transition-all bg-white">
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                                  
                                  <div className="lg:col-span-3">
                                    <p className="text-[10px] font-bold text-primary uppercase">Solicitante</p>
                                    <p className="font-black text-sm uppercase leading-tight">{item.solicitante_entidad}</p>
                                    <Badge variant="outline" className="mt-1 text-[9px] uppercase font-bold">
                                      {item.tipo_solicitud === 'divulgacion' ? 'Divulgación' : 'Capacitación'}
                                    </Badge>
                                  </div>

                                  <div className="lg:col-span-3 flex flex-col gap-1">
                                    <div className="flex items-start gap-2">
                                      <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                                      <p className="text-xs font-bold uppercase">{item.lugar_local}</p>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                                      <p className="text-[10px] font-bold uppercase">
                                        {new Date(item.fecha + 'T12:00:00').toLocaleDateString('es-PY', { weekday: 'short', day: '2-digit', month: 'short' })}
                                        <span className="mx-1 text-primary">|</span>
                                        {item.hora_desde} a {item.hora_hasta} HS
                                      </p>
                                    </div>
                                  </div>

                                  <div className="lg:col-span-3">
                                    <div className="p-2 rounded bg-muted/30 border border-dashed">
                                        <p className="text-[10px] font-black text-muted-foreground uppercase leading-none mb-1">Divulgador Asignado</p>
                                        {item.divulgador_nombre ? (
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                                                <p className="text-xs font-black uppercase text-primary">{item.divulgador_nombre}</p>
                                            </div>
                                        ) : (
                                            <p className="text-[10px] italic text-muted-foreground">Sin asignar</p>
                                        )}
                                    </div>
                                  </div>

                                  <div className="lg:col-span-3 flex justify-end gap-2">
                                    {canAssign && (
                                        <Dialog open={selectedSolicitud?.id === item.id} onOpenChange={(o) => !o && setSelectedSolicitud(null)}>
                                            <DialogTrigger asChild>
                                                <Button variant="outline" size="sm" className="h-8 text-[10px] font-black uppercase" onClick={() => setSelectedSolicitud(item)}>
                                                    <UserPlus className="mr-1 h-3 w-3" />
                                                    Asignar
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle className="uppercase font-black">Asignar Personal</DialogTitle>
                                                    <DialogDescription>Seleccione el funcionario que realizará la actividad en {item.lugar_local}.</DialogDescription>
                                                </DialogHeader>
                                                <div className="py-4">
                                                    <Select onValueChange={handleAssignDivulgador} disabled={isAssigning}>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Seleccionar divulgador..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {staffUsers?.map(u => (
                                                                <SelectItem key={u.id} value={u.id}>{u.username} ({u.role})</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    )}
                                    
                                    <Link href={`/informe-divulgador?solicitudId=${item.id}`}>
                                      <Button variant="default" size="sm" className="h-8 text-[10px] font-black uppercase">
                                        <ClipboardCheck className="mr-1 h-3 w-3" />
                                        Informe
                                      </Button>
                                    </Link>
                                  </div>
                                </div>
                              </div>
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
    </div>
  );
}
