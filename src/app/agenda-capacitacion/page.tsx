
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
    
    // Administrative roles (Admin, Director, Jefe) can see everything
    if (user.profile.role === 'admin' || user.profile.role === 'director' || user.profile.role === 'jefe') {
      return query(colRef, orderBy('fecha', 'asc'));
    }
    
    // Funcionarios must filter their query to match Firestore rules
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

  const filteredSolicitudes = useMemo(() => {
    if (!solicitudes) return [];
    return solicitudes;
  }, [solicitudes]);

  const groupedData = useMemo(() => {
    const groups: Record<string, Record<string, SolicitudCapacitacion[]>> = {};
    
    filteredSolicitudes.forEach(s => {
      if (!groups[s.departamento]) groups[s.departamento] = {};
      if (!groups[s.departamento][s.distrito]) groups[s.departamento][s.distrito] = [];
      groups[s.departamento][s.distrito].push(s);
    });

    return groups;
  }, [filteredSolicitudes]);

  if (isUserLoading || isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col">
      <Header title="Agenda de Capacitaciones" />
      <main className="flex-1 p-4 md:p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Capacitaciones Agendadas</h1>
          <p className="text-muted-foreground">Visualización jerárquica de solicitudes por departamento y distrito.</p>
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
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {dept[0]}
                    </div>
                    <span className="text-lg font-bold">{dept}</span>
                    <Badge variant="secondary" className="ml-2">
                      {Object.values(distritos).flat().length} solicitudes
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <Accordion type="multiple" className="w-full space-y-2 mt-2">
                    {Object.entries(distritos).map(([dist, items]) => (
                      <AccordionItem key={dist} value={dist} className="border-none">
                        <AccordionTrigger className="py-2 hover:no-underline text-md font-semibold text-primary">
                          {dist} ({items.length})
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                            {items.map((item) => (
                              <Card key={item.id} className="overflow-hidden border-primary/20">
                                <CardHeader className="bg-primary/5 pb-2">
                                  <div className="flex justify-between items-start">
                                    <CardTitle className="text-md">{item.nombre_completo || item.solicitante_entidad}</CardTitle>
                                    <Badge>{item.hora_desde}</Badge>
                                  </div>
                                  <CardDescription className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" /> {new Date(item.fecha).toLocaleDateString('es-PY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                  </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-4 space-y-2 text-sm">
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">Entidad:</span> {item.solicitante_entidad}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">Lugar:</span> {item.lugar_local}
                                  </div>
                                  {item.gps && (
                                    <div className="flex items-center gap-2">
                                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                      <a href={`https://www.google.com/maps/search/?api=1&query=${item.gps}`} target="_blank" className="text-primary hover:underline">Ver Mapa</a>
                                    </div>
                                  )}
                                  
                                  <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t">
                                    {item.foto_firma && (
                                      <Dialog>
                                        <DialogTrigger asChild>
                                          <Button variant="outline" size="sm" className="w-full">
                                            <FileImage className="mr-2 h-4 w-4" />
                                            Ver Firma
                                          </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-2xl">
                                          <DialogHeader>
                                            <DialogTitle>Documento de Firma - {item.nombre_completo}</DialogTitle>
                                          </DialogHeader>
                                          <div className="relative aspect-[3/4] w-full mt-4">
                                            <Image src={item.foto_firma} alt="Firma" fill className="object-contain" />
                                          </div>
                                        </DialogContent>
                                      </Dialog>
                                    )}
                                    <Link href={`/encuesta-satisfaccion?solicitudId=${item.id}`} className="w-full">
                                      <Button variant="default" size="sm" className="w-full">
                                        <ClipboardCheck className="mr-2 h-4 w-4" />
                                        Nueva Encuesta
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
