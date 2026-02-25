
"use client";

import { useState, useMemo, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription as CardDescriptionUI } from '@/components/ui/card';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where, doc, updateDoc } from 'firebase/firestore';
import { type SolicitudCapacitacion, type Dato, type Divulgador } from '@/lib/data';
import { Loader2, Calendar, MapPin, LayoutList, Building2, QrCode, Printer, UserPlus, CheckCircle2, UserCheck, Search, ShieldAlert, Globe, Navigation, Landmark } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { formatDateToDDMMYYYY } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function AgendaCapacitacionPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [qrSolicitud, setQrSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [assigningSolicitud, setAssigningSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [divulSearch, setDivulSearch] = useState('');

  const profile = user?.profile;

  const hasAdminFilter = useMemo(() => 
    ['admin', 'director'].includes(profile?.role || '') || profile?.permissions?.includes('admin_filter'),
    [profile]
  );
  
  const hasDeptFilter = useMemo(() => 
    !hasAdminFilter && profile?.permissions?.includes('department_filter'),
    [profile, hasAdminFilter]
  );

  const hasDistFilter = useMemo(() => 
    !hasAdminFilter && !hasDeptFilter && (profile?.permissions?.includes('district_filter') || profile?.role === 'jefe' || profile?.role === 'funcionario'),
    [profile, hasAdminFilter, hasDeptFilter]
  );

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollection<Dato>(datosQuery);

  const solicitudesQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !user?.uid || !profile) return null;
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    if (hasAdminFilter) return colRef;
    if (hasDeptFilter && profile.departamento) return query(colRef, where('departamento', '==', profile.departamento));
    if (hasDistFilter && profile.departamento && profile.distrito) {
        return query(colRef, where('departamento', '==', profile.departamento), where('distrito', '==', profile.distrito));
    }
    return null;
  }, [firestore, user, isUserLoading, profile, hasAdminFilter, hasDeptFilter, hasDistFilter]);

  const { data: rawSolicitudes, isLoading: isLoadingSolicitudes } = useCollection<SolicitudCapacitacion>(solicitudesQuery);

  const solicitudes = useMemo(() => {
    if (!rawSolicitudes) return null;
    return [...rawSolicitudes].sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [rawSolicitudes]);

  const divulgadoresQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !profile) return null;
    const colRef = collection(firestore, 'divulgadores');
    if (hasAdminFilter) return colRef;
    if (hasDeptFilter && profile.departamento) return query(colRef, where('departamento', '==', profile.departamento));
    if (hasDistFilter && profile.departamento && profile.distrito) {
      return query(colRef, where('departamento', '==', profile.departamento), where('distrito', '==', profile.distrito));
    }
    return null;
  }, [firestore, user, isUserLoading, profile, hasAdminFilter, hasDeptFilter, hasDistFilter]);

  const { data: rawDivulgadores, isLoading: isLoadingDivul } = useCollection<Divulgador>(divuladoresQuery);

  const divulgadores = useMemo(() => {
    if (!rawDivulgadores) return null;
    return [...rawDivulgadores].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [rawDivulgadores]);

  const filteredDivul = useMemo(() => {
    if (!divulgadores) return [];
    const term = divulSearch.toLowerCase().trim();
    return divulgadores.filter(d => d.nombre.toLowerCase().includes(term) || d.cedula.includes(term));
  }, [divulgadores, divulSearch]);

  const handleAssignDivulgador = (divulgador: Divulgador) => {
    if (!assigningSolicitud || !firestore) return;
    setIsUpdating(true);
    const updateData = {
      divulgador_id: divulgador.id,
      divulgador_nombre: divulgador.nombre,
      divulgador_cedula: divulgador.cedula,
      divulgador_vinculo: divulgador.vinculo
    };
    const docRef = doc(firestore, 'solicitudes-capacitacion', assigningSolicitud.id);
    
    updateDoc(docRef, updateData)
      .then(() => {
        toast({ title: "Personal Asignado" });
        setAssigningSolicitud(null);
        setIsUpdating(false);
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: updateData }));
        setIsUpdating(false);
      });
  };

  const getEncuestaUrl = (id: string) => {
      if (typeof window === 'undefined') return '';
      return `${window.location.origin}/encuesta-satisfaccion?solicitudId=${id}`;
  };

  if (isUserLoading || isLoadingSolicitudes || isLoadingDatos) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/5">
      <Header title="Agenda de Capacitaciones" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        <div className="mb-8">
            <h1 className="text-3xl font-black uppercase text-primary">Agenda de Actividades</h1>
            <div className="flex gap-2 mt-2">
                {hasAdminFilter && <Badge className="bg-blue-600">NACIONAL</Badge>}
                {hasDeptFilter && <Badge className="bg-amber-600">{profile?.departamento}</Badge>}
                {hasDistFilter && <Badge className="bg-green-600">{profile?.distrito}</Badge>}
            </div>
        </div>

        {solicitudes?.length === 0 ? (
          <Card className="p-12 text-center border-dashed"><p className="font-bold text-muted-foreground uppercase">No hay actividades registradas.</p></Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {solicitudes?.map(item => (
              <Card key={item.id} className="p-4 border-l-8 border-l-primary">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-black text-sm uppercase text-primary">{item.lugar_local}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{formatDateToDDMMYYYY(item.fecha)} | {item.hora_desde} HS</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setAssigningSolicitud(item)} className="text-[10px] font-black">{item.divulgador_nombre ? 'REASIGNAR' : 'ASIGNAR'}</Button>
                    <Link href={`/informe-divulgador?solicitudId=${item.id}`}><Button size="sm" className="text-[10px] font-black">INFORME</Button></Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={!!assigningSolicitud} onOpenChange={(o) => !o && setAssigningSolicitud(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-black uppercase">ASIGNAR PERSONAL</DialogTitle></DialogHeader>
          <div className="p-4 space-y-4">
            <Input placeholder="Buscar..." value={divulSearch} onChange={e => setDivulSearch(e.target.value)} />
            <ScrollArea className="h-[200px] border rounded-lg p-2">
              {filteredDivul.map(d => (
                <div key={d.id} className="p-2 border-b cursor-pointer hover:bg-muted" onClick={() => handleAssignDivulgador(d)}>
                  <p className="font-bold text-xs uppercase">{d.nombre}</p>
                  <p className="text-[9px] text-muted-foreground">{d.cedula} • {d.vinculo}</p>
                </div>
              ))}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
