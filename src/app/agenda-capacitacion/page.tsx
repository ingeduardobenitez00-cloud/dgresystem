
"use client";

import { useState, useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { type SolicitudCapacitacion } from '@/lib/data';
import { Loader2, Calendar, MapPin, User, FileImage, ExternalLink, ClipboardCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function AgendaCapacitacionPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();

  const solicitudesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.profile) return null;
    
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    
    // Roles administrativos (Admin, Director, Jefe) pueden ver todo
    const isAdministrative = user.profile.role === 'admin' || user.profile.role === 'director' || user.profile.role === 'jefe';

    if (isAdministrative) {
      return query(colRef, orderBy('fecha', 'asc'));
    }
    
    // Los funcionarios deben filtrar su consulta para cumplir con las reglas de seguridad de Firestore
    if (user.profile.role === 'funcionario' && user.profile.departamento && user.profile.distrito) {
      return query(
        colRef,
        where('departamento', '==', user.profile.departamento),
        where('distrito', '==', user.profile.distrito),
        orderBy('fecha', 'asc')
      );
    }
    
    return null;
  }, [firestore, user]);

  const { data: solicitudes, isLoading } = useCollection<SolicitudCapacitacion>(solicitudesQuery);

  const groupedData = useMemo(() => {
    if (!solicitudes) return {};
    const groups: Record<string, Record<string, SolicitudCapacitacion[]>> = {};
    
    solicitudes.forEach(s => {
      const dept = s.departamento || 'Sin Departamento';
      const dist = s.distrito || 'Sin Distrito';
      if (!groups[dept]) groups[dept] = {};
      if (!groups[dept][dist]) groups[dept][dist] = [];
      groups[dept][dist].push(s);
    });

    return groups;
  }, [solicitudes]);

  if (isUserLoading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-primary"/>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header title="Agenda de Capacitaciones" />
      <main className="flex-1 p-4 md:p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Capacitaciones Agendadas</h1>
          <p className="text-muted-foreground">Visualización jerárquica por departamento y distrito.</p>
        </div>

        {Object.keys(groupedData).length === 0 ? (
          <Card className="p-12 text-center">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No hay capacitaciones agendadas para mostrar.</p>
          </Card>
        ) : (
          <Accordion type="multiple" className="w-full space-y-4">
            {Object.entries(groupedData).map(([dept, distritos]) => (
              <AccordionItem key={dept} value={dept} className="border rounded-lg bg-card px-4">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3 text-left">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                      {dept.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-bold">{dept}</span>
                      <Badge variant="secondary" className="font-mono">
                        {Object.values(distritos).flat().length} SOLICITUDES
                      </Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <Accordion type="multiple" className="w-full space-y-2 mt-2">
                    {Object.entries(distritos).map(([dist, items]) => (
                      <AccordionItem key={dist} value={dist} className="border-none pl-4 md:pl-8">
                        <AccordionTrigger className="py-2 hover:no-underline text-md font-semibold text-primary/80 border-b border-dashed">
                          {dist} ({items.length})
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            {items.map((item) => (
                              <Card key={item.id} className="overflow-hidden border-primary/20 shadow-sm hover:shadow-md transition-shadow">
                                <CardHeader className="bg-primary/5 pb-2">
                                  <div className="flex justify-between items-start gap-2">
                                    <CardTitle className="text-xs font-black uppercase leading-tight">{item.solicitante_entidad}</CardTitle>
                                    <Badge variant="default" className="text-[10px] shrink-0 font-bold">{item.hora_desde} HS</Badge>
                                  </div>
                                  <CardDescription className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground mt-1">
                                    <Calendar className="h-3 w-3" /> 
                                    {new Date(item.fecha + 'T12:00:00').toLocaleDateString('es-PY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()}
                                  </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-4 space-y-3 text-xs">
                                  <div className="flex items-start gap-2">
                                    <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-bold text-foreground leading-tight">{item.lugar_local}</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">{item.direccion_calle}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 border-t pt-2">
                                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="font-semibold text-muted-foreground">Responsable:</span> 
                                    <span className="truncate">{item.nombre_completo}</span>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-2 mt-2 pt-3">
                                    {item.foto_firma ? (
                                      <Dialog>
                                        <DialogTrigger asChild>
                                          <Button variant="outline" size="sm" className="w-full text-[9px] h-8 font-bold">
                                            <FileImage className="mr-1 h-3 w-3" />
                                            VER FIRMA
                                          </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-2xl">
                                          <DialogHeader>
                                            <DialogTitle>Documento de Solicitud - {item.solicitante_entidad}</DialogTitle>
                                          </DialogHeader>
                                          <div className="relative aspect-[3/4] w-full mt-4 bg-muted rounded-lg overflow-hidden border shadow-inner">
                                            <Image src={item.foto_firma} alt="Firma Anexo V" fill className="object-contain" />
                                          </div>
                                        </DialogContent>
                                      </Dialog>
                                    ) : (
                                        <Button variant="outline" size="sm" disabled className="w-full text-[9px] h-8 opacity-50">
                                            SIN ADJUNTO
                                        </Button>
                                    )}
                                    <Link href={`/encuesta-satisfaccion?solicitudId=${item.id}`} className="w-full">
                                      <Button variant="default" size="sm" className="w-full text-[9px] h-8 font-bold">
                                        <ClipboardCheck className="mr-1 h-3 w-3" />
                                        ENCUESTA
                                      </Button>
                                    </Link>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </main>
    </div>
  );
}
