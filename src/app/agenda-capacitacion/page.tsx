
"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/header';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useUser, useFirebase, useCollectionOnce, useCollectionPaginated, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, writeBatch, orderBy, limit, getCountFromServer } from 'firebase/firestore';
import { type SolicitudCapacitacion, type Dato, type Divulgador, type MovimientoMaquina, type InformeDivulgador, type EncuestaSatisfaccion } from '@/lib/data';
import { 
  Loader2, 
  MapPin, 
  Calendar, 
  UserPlus, 
  QrCode, 
  Building2, 
  Search, 
  Trash2, 
  Users, 
  MessageSquareHeart, 
  Eye,
  FileText,
  Activity,
  X,
  Copy,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Power,
  PowerOff,
  ShieldAlert,
  Printer,
  Ban,
  ImageIcon,
  Clock,
  ChevronDown
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { formatDateToDDMMYYYY, cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import html2canvas from 'html2canvas';

const normalizeGeo = (str: string) => {
  if (!str) return '';
  return str.toUpperCase()
    .replace(/^\d+[\s-]*\s*/, '')
    .trim();
};

const SurveyCounter = ({ solicitudId, firestore }: any) => {
    const [count, setCount] = useState<number | null>(null);
    useEffect(() => {
        if (!firestore) return;
        getCountFromServer(query(collection(firestore, 'encuestas-satisfaccion'), where('solicitud_id', '==', solicitudId)))
            .then(snap => setCount(snap.data().count))
            .catch(() => setCount(0));
    }, [firestore, solicitudId]);
    return <span className="text-[9px] font-black uppercase text-inherit">ENCUESTAS: {count !== null ? count : '...'}</span>;
};

const DistrictSection = ({ 
    deptName, 
    distName, 
    distCode,
    firestore, 
    profile, 
    currentTime,
    datosData,
    rawDivulgadores,
    router,
    hasAdminFilter,
    agendaSearch
}: any) => {
    const { toast } = useToast();
    const qrContainerRef = useRef<HTMLDivElement>(null);
    const [isOpen, setIsOpen] = useState(false);

    const [assigningSolicitud, setAssigningSolicitud] = useState<SolicitudCapacitacion | null>(null);
    const [viewingActivity, setViewingActivity] = useState<SolicitudCapacitacion | null>(null);
    const [qrSolicitud, setQrSolicitud] = useState<SolicitudCapacitacion | null>(null);
    const [deletingSolicitud, setDeletingSolicitud] = useState<SolicitudCapacitacion | null>(null);
    const [suspendingSolicitud, setSuspendingSolicitud] = useState<SolicitudCapacitacion | null>(null);
    const [suspensionReason, setSuspensionReason] = useState('');
    const [concludingSolicitud, setConcludingSolicitud] = useState<SolicitudCapacitacion | null>(null);
    const [deletingDistrict, setDeletingDistrict] = useState<boolean>(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [divulSearch, setDivulSearch] = useState('');
    const [copied, setCopied] = useState(false);

    const q = useMemoFirebase(() => {
        if (!firestore || !isOpen) return null;
        return query(
            collection(firestore, 'solicitudes-capacitacion'),
            where('departamento', '==', deptName),
            where('distrito', '==', distName),
            orderBy('fecha', 'desc')
        );
    }, [firestore, isOpen, deptName, distName]);

    const { 
        data: rawItems, 
        isLoading, 
        isLoadingMore, 
        hasMore, 
        loadMore, 
        updateItem, 
        mutate 
    } = useCollectionPaginated<SolicitudCapacitacion>(q, 20);

    const movementsQuery = useMemoFirebase(() => {
        if (!firestore || !isOpen) return null;
        return query(collection(firestore, 'movimientos-maquinas'), where('departamento', '==', deptName), where('distrito', '==', distName));
    }, [firestore, deptName, distName, isOpen]);
    const { data: movementsData } = useCollectionOnce<MovimientoMaquina>(movementsQuery);

    const reportsQuery = useMemoFirebase(() => {
        if (!firestore || !isOpen) return null;
        return query(collection(firestore, 'informes-divulgador'), where('departamento', '==', deptName), where('distrito', '==', distName));
    }, [firestore, deptName, distName, isOpen]);
    const { data: reportsData } = useCollectionOnce<InformeDivulgador>(reportsQuery);

    const items = useMemo(() => {
        const term = (agendaSearch || '').toLowerCase().trim();
        return (rawItems || []).filter(sol => {
            if (sol.cancelada) return false;
            if (sol.fecha_cumplido) {
                const diff = (currentTime.getTime() - new Date(sol.fecha_cumplido).getTime()) / (1000 * 60 * 60);
                if (diff > 24) return false;
            } else {
                const mov = movementsData?.find(m => m.solicitud_id === sol.id);
                const inf = reportsData?.find(i => i.solicitud_id === sol.id);
                if (mov?.fecha_devolucion && inf) return false;
            }
            return !term || sol.nombre_completo?.toLowerCase().includes(term) || sol.solicitante_entidad?.toLowerCase().includes(term);
        }).sort((a, b) => a.fecha.localeCompare(b.fecha));
    }, [rawItems, currentTime, movementsData, reportsData, agendaSearch]);

    const handleAssignDivulgador = (divulgador: Divulgador) => {
        if (!assigningSolicitud || !firestore) return;
        setIsUpdating(true);
        const docRef = doc(firestore, 'solicitudes-capacitacion', assigningSolicitud.id);
        const newDiv = { id: divulgador.id, nombre: divulgador.nombre, cedula: divulgador.cedula, vinculo: divulgador.vinculo };
        updateDoc(docRef, { divulgadores: arrayUnion(newDiv) }).then(() => {
            toast({ title: "Asignado" });
            const updated = [...(assigningSolicitud.divulgadores || []), newDiv];
            setAssigningSolicitud(prev => prev ? { ...prev, divulgadores: updated } : null);
            updateItem(assigningSolicitud.id, { divulgadores: updated });
            setIsUpdating(false);
        }).catch(() => setIsUpdating(false));
    };

    const handleRemoveDivulgador = (id: string) => {
        if (!assigningSolicitud || !firestore) return;
        const docRef = doc(firestore, 'solicitudes-capacitacion', assigningSolicitud.id);
        const toRem = assigningSolicitud.divulgadores?.find(d => d.id === id);
        if (toRem) updateDoc(docRef, { divulgadores: arrayRemove(toRem) }).then(() => {
            const updated = assigningSolicitud.divulgadores?.filter(d => d.id !== id) || [];
            setAssigningSolicitud(prev => prev ? { ...prev, divulgadores: updated } : null);
            updateItem(assigningSolicitud.id, { divulgadores: updated });
        });
    };

    const handleToggleQr = (sol: SolicitudCapacitacion) => {
        const docRef = doc(firestore!, 'solicitudes-capacitacion', sol.id);
        const newState = !sol.qr_enabled;
        let expiry = null;
        if (newState) {
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            expiry = sol.fecha < today ? new Date(now.getTime() + 20 * 60000).toISOString() : new Date(new Date(sol.fecha).getTime() + 86399000).toISOString();
        }
        updateDoc(docRef, { qr_enabled: newState, qr_expires_at: expiry }).then(() => {
            updateItem(sol.id, { qr_enabled: newState, qr_expires_at: expiry as any });
            toast({ title: newState ? "Habilitado" : "Deshabilitado" });
        });
    };

    const handleConfirmSuspend = () => {
        if (!suspendingSolicitud || !suspensionReason) return;
        setIsUpdating(true);
        updateDoc(doc(firestore!, 'solicitudes-capacitacion', suspendingSolicitud.id), {
            cancelada: true, motivo_cancelacion: suspensionReason.toUpperCase(), fecha_cancelacion: new Date().toISOString(), usuario_cancelacion: profile?.username || 'SISTEMA'
        }).then(() => {
            updateItem(suspendingSolicitud.id, { cancelada: true });
            setSuspendingSolicitud(null);
            setIsUpdating(false);
        });
    };

    const handleConfirmDelete = () => {
        if (!deletingSolicitud) return;
        deleteDoc(doc(firestore!, 'solicitudes-capacitacion', deletingSolicitud.id)).then(() => {
            mutate(rawItems?.filter(s => s.id !== deletingSolicitud.id) || []);
            setDeletingSolicitud(null);
        });
    };

    const handleConfirmDeleteDistrict = () => {
        setIsUpdating(true);
        const batch = writeBatch(firestore!);
        items.forEach(i => batch.delete(doc(firestore!, 'solicitudes-capacitacion', i.id)));
        batch.commit().then(() => {
            mutate(rawItems?.filter(s => !items.some(it => it.id === s.id)) || []);
            setDeletingDistrict(false);
            setIsUpdating(false);
        });
    };

    const handleManualComplete = (id: string) => {
        updateDoc(doc(firestore!, 'solicitudes-capacitacion', id), { fecha_cumplido: new Date().toISOString() }).then(() => {
            updateItem(id, { fecha_cumplido: new Date().toISOString() });
            setConcludingSolicitud(null);
        });
    };

    const filteredDivul = useMemo(() => {
        if (!rawDivulgadores || !assigningSolicitud) return [];
        const term = divulSearch.toLowerCase().trim();
        const assigned = new Set(assigningSolicitud.divulgadores?.map(d => d.id));
        return rawDivulgadores.filter(d => d.distrito === distName && !assigned.has(d.id) && (d.nombre.toLowerCase().includes(term) || d.cedula.includes(term)));
    }, [rawDivulgadores, divulSearch, assigningSolicitud, distName]);

    const qrImageUrl = useMemo(() => {
        if (!qrSolicitud) return '';
        const url = `${window.location.origin}/encuesta-satisfaccion?solicitudId=${qrSolicitud.id}`;
        return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
    }, [qrSolicitud]);

    if (!isOpen && items.length === 0 && !isLoading) {
        return (
            <AccordionItem value={distName} className="border-none">
                <AccordionTrigger onClick={() => setIsOpen(true)} className="hover:no-underline py-4 bg-[#F8F9FA] rounded-2xl px-6 group border border-dashed">
                    <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                        <h3 className="font-bold uppercase text-sm text-muted-foreground">{distName}</h3>
                    </div>
                </AccordionTrigger>
                <AccordionContent />
            </AccordionItem>
        );
    }

    return (
        <AccordionItem value={distName} className="border-none">
            <AccordionTrigger onClick={() => setIsOpen(true)} className="hover:no-underline py-4 bg-[#F8F9FA] rounded-2xl px-6 group border border-dashed">
                <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-[#1A1A1A]" />
                    <h3 className="font-black uppercase text-sm tracking-tight text-primary/80">{distName}</h3>
                    <Badge variant="secondary" className="bg-black text-white text-[8px] font-black px-2">{items.length}{hasMore && '+'}</Badge>
                </div>
            </AccordionTrigger>
            <AccordionContent className="pt-6 space-y-4 px-2">
                {items.length > 0 && hasAdminFilter && (
                    <div className="flex justify-end mb-2 px-2">
                        <Button variant="ghost" size="sm" className="text-[9px] font-black uppercase text-destructive hover:bg-destructive/10 h-8 gap-2" onClick={() => setDeletingDistrict(true)}><Trash2 className="h-3 w-3" /> VACIAR DISTRITO</Button>
                    </div>
                )}
                {items.map(item => {
                    const today = new Date().toISOString().split('T')[0];
                    const isPast = item.fecha < today;
                    const mov = movementsData?.find(m => m.solicitud_id === item.id);
                    const inf = reportsData?.find(i => i.solicitud_id === item.id);
                    const hasAlert = isPast && (!mov?.fecha_devolucion || !inf);
                    const isFulfilled = mov?.fecha_devolucion && inf;
                    return (
                        <Card key={item.id} className={cn("border-2 shadow-sm rounded-2xl overflow-hidden", hasAlert ? "border-destructive/40 bg-destructive/[0.02]" : isFulfilled ? "border-green-200 bg-green-50/10" : "border-muted/20 bg-white")}>
                            <CardContent className="p-8">
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                                    <div className="lg:col-span-4 space-y-3">
                                        <div className="flex items-center gap-2"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">SOLICITANTE</p>{isFulfilled && <Badge className="bg-green-600 text-white font-black uppercase text-[7px] px-2 py-0 h-4">CICLO COMPLETADO</Badge>}</div>
                                        <p className="font-black text-base uppercase leading-tight text-[#1A1A1A]">{item.nombre_completo}</p>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">{item.solicitante_entidad || item.otra_entidad}</p>
                                        <Badge className="bg-primary/5 text-primary text-[8px] px-3 font-black uppercase">{item.tipo_solicitud}</Badge>
                                    </div>
                                    <div className="lg:col-span-3 space-y-4">
                                        <div className="flex items-center gap-3"><MapPin className="h-4 w-4 text-muted-foreground" /><p className="font-black text-[12px] uppercase">{item.lugar_local}</p></div>
                                        <div className="flex items-center gap-3"><Calendar className={cn("h-4 w-4", hasAlert ? "text-destructive" : "text-muted-foreground")} /><p className={cn("font-black text-[12px] uppercase", hasAlert && "text-destructive font-black")}>{formatDateToDDMMYYYY(item.fecha)} | {item.hora_desde} A {item.hora_hasta} HS</p></div>
                                    </div>
                                    <div className="lg:col-span-2 space-y-4">
                                        <div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">PERSONAL</p>{(item.divulgadores || []).length > 0 ? <div className="flex items-center gap-2 text-[#16A34A]"><Users className="h-4 w-4" /><p className="font-black text-[11px] uppercase">{(item.divulgadores || []).length} ASIGNADOS</p></div> : <p className="text-[10px] font-black text-destructive italic uppercase">SIN ASIGNAR</p>}</div>
                                        <div className="flex items-center gap-2 text-primary pt-2 border-t border-dashed"><MessageSquareHeart className="h-3.5 w-3.5" /><SurveyCounter solicitudId={item.id} firestore={firestore} /></div>
                                    </div>
                                    <div className="lg:col-span-3 flex flex-col items-end gap-3">
                                        <div className="flex gap-2 w-full max-w-[220px]">
                                            <Button variant="outline" size="sm" className="h-11 flex-1 rounded-xl font-black uppercase text-[11px] border-2" onClick={() => setAssigningSolicitud(item)}><UserPlus className="h-4 w-4 mr-2" /> ASIGNAR</Button>
                                            <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl border-2" onClick={() => setViewingActivity(item)}><Eye className="h-4 w-4" /></Button>
                                        </div>
                                        <div className="flex gap-2 w-full max-w-[220px]">
                                            <Button variant="outline" size="icon" className={cn("h-11 w-11 rounded-xl border-2", item.qr_enabled ? "bg-green-600/10 border-green-600 text-green-600" : "border-muted-foreground/30 text-muted-foreground")} onClick={() => handleToggleQr(item)}>{item.qr_enabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}</Button>
                                            <Button variant="outline" size="sm" className="h-11 flex-1 rounded-xl font-black uppercase text-[10px] border-2" onClick={() => setQrSolicitud(item)} disabled={!item.qr_enabled}><QrCode className="h-4 w-4 mr-2" /> QR</Button>
                                            {!item.fecha_cumplido && isFulfilled && <Button className="flex-1 h-11 rounded-xl font-black uppercase text-[10px] bg-green-600 text-white animate-pulse" onClick={() => setConcludingSolicitud(item)}>CONCLUIR</Button>}
                                        </div>
                                        <div className="flex gap-2 w-full max-w-[220px]">
                                            <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl border-2 border-orange-200 text-orange-600 hover:bg-orange-50" onClick={() => setSuspendingSolicitud(item)}><Ban className="h-4 w-4" /></Button>
                                            <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl border-2 border-destructive/40 text-destructive hover:bg-destructive hover:text-white" onClick={() => setDeletingSolicitud(item)}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
                {hasMore && (
                    <div className="mt-4 flex justify-center">
                        <Button onClick={loadMore} disabled={isLoadingMore} variant="outline" className="rounded-2xl font-black text-[9px] uppercase tracking-widest py-6 px-10 border-2">
                            {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Ver más de {distName} <ChevronDown className="h-4 w-4" /></>}
                        </Button>
                    </div>
                )}
            </AccordionContent>

            {/* Diálogos compartidos pero locales al distrito para evitar duplicidad masiva */}
            <Dialog open={!!viewingActivity} onOpenChange={o => !o && setViewingActivity(null)}>
                <DialogContent className="max-w-4xl h-[90vh] p-0 border-none shadow-2xl overflow-hidden rounded-[2.5rem]">
                    {viewingActivity && (
                        <div className="flex flex-col h-full bg-white">
                            <div className="bg-black text-white p-8 shrink-0 flex justify-between items-center"><h2 className="text-2xl font-black uppercase tracking-tight">FICHA TÉCNICA</h2><Button variant="ghost" size="icon" onClick={() => setViewingActivity(null)} className="text-white/40 hover:text-white"><X className="h-6 w-6" /></Button></div>
                            <ScrollArea className="flex-1 p-8">
                                <div className="space-y-6">
                                    <div className="grid grid-cols-3 gap-6">
                                        <div className="p-4 bg-muted/20 rounded-2xl border"><p className="text-[8px] font-black uppercase text-muted-foreground leading-none">Local</p><p className="text-xs font-black uppercase mt-1">{viewingActivity.lugar_local}</p></div>
                                        <div className="p-4 bg-muted/20 rounded-2xl border"><p className="text-[8px] font-black uppercase text-muted-foreground leading-none">Fecha</p><p className="text-xs font-black uppercase mt-1">{formatDateToDDMMYYYY(viewingActivity.fecha)}</p></div>
                                        <div className="p-4 bg-muted/20 rounded-2xl border"><p className="text-[8px] font-black uppercase text-muted-foreground leading-none">Horario</p><p className="text-xs font-black uppercase mt-1">{viewingActivity.hora_desde} A {viewingActivity.hora_hasta} HS</p></div>
                                    </div>
                                    <Separator className="border-dashed" />
                                    <div className="space-y-4">
                                        <h3 className="font-black uppercase text-[10px] tracking-widest text-primary flex items-center gap-2"><Activity className="h-3 w-3" /> Trazabilidad Logística</h3>
                                        <div className="grid grid-cols-3 gap-4">
                                            {(() => {
                                                const mov = movementsData?.find(m => m.solicitud_id === viewingActivity.id);
                                                const inf = reportsData?.find(i => i.solicitud_id === viewingActivity.id);
                                                return (
                                                    <>
                                                        <div className={cn("p-4 rounded-xl border-2 text-center", mov ? "bg-green-50 border-green-200" : "opacity-30")}><p className="text-[9px] font-black uppercase">SALIDA MV</p></div>
                                                        <div className={cn("p-4 rounded-xl border-2 text-center", mov?.fecha_devolucion ? "bg-green-50 border-green-200" : "opacity-30")}><p className="text-[9px] font-black uppercase">RETORNO MV</p></div>
                                                        <div className={cn("p-4 rounded-xl border-2 text-center", inf ? "bg-green-50 border-green-200" : "opacity-30")}><p className="text-[9px] font-black uppercase">INFORME</p></div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={!!assigningSolicitud} onOpenChange={o => !o && setAssigningSolicitud(null)}>
                <DialogContent className="max-w-2xl rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
                    <DialogHeader className="bg-black text-white p-6"><DialogTitle className="font-black uppercase text-sm flex items-center gap-2"><Users className="h-4 w-4" /> GESTIONAR PERSONAL</DialogTitle></DialogHeader>
                    <div className="grid grid-cols-2 gap-x-6">
                        <div className="p-6 space-y-4 bg-white">
                            <h3 className="font-bold uppercase text-[10px] text-muted-foreground">Personal Asignado</h3>
                            <ScrollArea className="h-[350px]">
                                {(assigningSolicitud?.divulgadores || []).map(d => (
                                    <div key={d.id} className="p-4 border-2 rounded-2xl flex justify-between items-center mb-2">
                                        <div><p className="font-black text-[10px] uppercase leading-none">{d.nombre}</p><span className="text-[7px] font-bold text-muted-foreground uppercase">{d.vinculo}</span></div>
                                        <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => handleRemoveDivulgador(d.id)}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                ))}
                            </ScrollArea>
                        </div>
                        <div className="p-6 space-y-4 bg-white border-l">
                            <h3 className="font-bold uppercase text-[10px] text-muted-foreground">Añadir Disponible</h3>
                            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input placeholder="Buscar..." value={divulSearch} onChange={e => setDivulSearch(e.target.value)} className="h-9 pl-9 font-bold border-2 rounded-xl text-[10px]" /></div>
                            <ScrollArea className="h-[280px]">
                                {filteredDivul.map(d => (
                                    <div key={d.id} className="p-4 border-2 rounded-2xl cursor-pointer hover:bg-black hover:text-white transition-all group mb-2" onClick={() => handleAssignDivulgador(d)}><p className="font-black text-[10px] uppercase leading-none">{d.nombre}</p><span className="text-[7px] font-bold opacity-60 uppercase">{d.vinculo}</span></div>
                                ))}
                            </ScrollArea>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={!!qrSolicitud} onOpenChange={o => !o && setQrSolicitud(null)}>
                <DialogContent className="max-w-md rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden">
                    <div className="p-6 flex flex-col items-center bg-white space-y-4">
                        <div ref={qrContainerRef} className="flex flex-col items-center bg-white p-6 rounded-[2rem] w-full border border-muted/10">
                            <div className="flex items-center gap-4 mb-6"><img src="/logo.png" width={32} height={32} alt="L1" /><img src="/logo1.png" width={32} height={32} alt="L2" /><img src="/logo3.png" width={32} height={32} alt="L3" /></div>
                            <div className="p-3 bg-white border-4 border-muted/20 rounded-[2.5rem] shadow-inner mb-6">{qrSolicitud && <img src={qrImageUrl} alt="QR" width={180} height={180} className="rounded-[1.5rem]" crossOrigin="anonymous" />}</div>
                            <div className="text-center space-y-2"><p className="text-[10px] font-black uppercase text-primary leading-tight">{qrSolicitud?.lugar_local}</p><p className="text-[8px] font-bold text-muted-foreground uppercase">{formatDateToDDMMYYYY(qrSolicitud?.fecha)} | {qrSolicitud?.hora_desde} A {qrSolicitud?.hora_hasta} HS</p></div>
                        </div>
                        <div className="w-full grid grid-cols-2 gap-2">
                            <Button variant="outline" className="h-12 rounded-xl font-black uppercase text-[8px] border-2 flex flex-col items-center p-1" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/encuesta-satisfaccion?solicitudId=${qrSolicitud?.id}`); toast({ title: "Copiado" }); }}><Copy className="h-3.5 w-3.5" /><span>COPIAR LINK</span></Button>
                            <Button variant="outline" className="h-12 rounded-xl font-black uppercase text-[8px] border-2 flex flex-col items-center p-1" onClick={async () => {
                                const canvas = await html2canvas(qrContainerRef.current!, { backgroundColor: '#ffffff', scale: 3, useCORS: true });
                                const link = document.createElement('a');
                                link.download = `QR-${qrSolicitud?.id}.png`;
                                link.href = canvas.toDataURL('image/png');
                                link.click();
                            }}><ImageIcon className="h-3.5 w-3.5" /><span>DESCARGAR PNG</span></Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={!!suspendingSolicitud} onOpenChange={o => !o && setSuspendingSolicitud(null)}>
                <DialogContent className="max-w-md rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
                    <DialogHeader className="bg-orange-600 text-white p-6"><DialogTitle className="font-black uppercase text-sm"><Ban className="h-4 w-4" /> SUSPENDER</DialogTitle></DialogHeader>
                    <div className="p-8 space-y-6 bg-white">
                        <Textarea placeholder="Motivo..." className="min-h-[100px] border-2 font-bold uppercase rounded-xl" value={suspensionReason} onChange={e => setSuspensionReason(e.target.value)} />
                        <div className="flex gap-3"><Button variant="outline" className="flex-1 h-12 rounded-xl font-black uppercase text-[10px]" onClick={() => setSuspendingSolicitud(null)}>CANCELAR</Button><Button className="flex-[2] h-12 bg-orange-600 text-white rounded-xl font-black uppercase text-[10px]" onClick={handleConfirmSuspend} disabled={!suspensionReason || isUpdating}>CONFIRMAR</Button></div>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deletingSolicitud} onOpenChange={o => !o && setDeletingSolicitud(null)}>
                <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl">
                    <AlertDialogHeader><AlertDialogTitle className="font-black uppercase">¿ELIMINAR?</AlertDialogTitle></AlertDialogHeader>
                    <AlertDialogFooter className="pt-4"><AlertDialogCancel className="rounded-xl font-black uppercase text-[10px]">CANCELAR</AlertDialogCancel><AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90 text-white rounded-xl font-black uppercase text-[10px] px-8">ELIMINAR</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={deletingDistrict} onOpenChange={o => !o && setDeletingDistrict(false)}>
                <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl">
                    <AlertDialogHeader><AlertDialogTitle className="font-black uppercase text-destructive">¿VACIAR DISTRITO?</AlertDialogTitle></AlertDialogHeader>
                    <AlertDialogFooter className="pt-4"><AlertDialogCancel className="rounded-xl font-black uppercase text-[10px]">CANCELAR</AlertDialogCancel><AlertDialogAction onClick={handleConfirmDeleteDistrict} className="bg-destructive hover:bg-destructive/90 text-white rounded-xl font-black uppercase text-[10px] px-8">VACIAR</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AccordionItem>
    );
};

const DepartmentSection = ({ 
    dept, 
    firestore, 
    profile, 
    currentTime,
    datosData,
    rawDivulgadores,
    router,
    hasAdminFilter,
    hasDistFilter,
    agendaSearch
}: any) => {
    const [isOpen, setIsOpen] = useState(false);

    // Lista de distritos basada en datosData
    const distNames = useMemo(() => {
        if (!datosData) return [];
        return Array.from(new Set(datosData.filter((d: Dato) => d.departamento === dept.label).map((d: Dato) => d.distrito))).sort();
    }, [datosData, dept.label]);

    return (
        <AccordionItem value={dept.label} className="border-none bg-white rounded-[2rem] shadow-sm overflow-hidden" onPointerEnter={() => !isOpen && setIsOpen(true)}>
            <AccordionTrigger className="hover:no-underline px-8 py-6 bg-white group" onClick={() => setIsOpen(!isOpen)}>
                <div className="flex items-center gap-6 text-left">
                <div className="h-14 w-14 rounded-full bg-black text-white flex items-center justify-center font-black text-lg shadow-xl">
                    {dept.code}
                </div>
                <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-[#1A1A1A]">{dept.label}</h2>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                        {distNames.length} DISTRITOS CONFIGURADOS
                    </p>
                </div>
                </div>
            </AccordionTrigger>
            
            <AccordionContent className="px-8 pb-8 pt-2">
                <Accordion type="multiple" className="space-y-4">
                    {distNames.map((distName: any) => (
                        <DistrictSection 
                            key={distName}
                            deptName={dept.label}
                            distName={distName}
                            firestore={firestore}
                            profile={profile}
                            currentTime={currentTime}
                            datosData={datosData}
                            rawDivulgadores={rawDivulgadores}
                            router={router}
                            hasAdminFilter={hasAdminFilter}
                            agendaSearch={agendaSearch}
                        />
                    ))}
                </Accordion>
            </AccordionContent>
        </AccordionItem>
    );
};

export default function AgendaCapacitacionPage() {
    const { user, isUserLoading } = useUser();
    const { firestore } = useFirebase();
    const router = useRouter();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [agendaSearch, setAgendaSearch] = useState('');

    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 30000);
        return () => clearInterval(interval);
    }, []);

    const profile = user?.profile;
    const hasAdminFilter = useMemo(() => ['admin', 'director', 'coordinador'].includes(profile?.role || '') || profile?.permissions?.includes('admin_filter'), [profile]);

    const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
    const { data: datosData } = useCollectionOnce<Dato>(datosQuery);

    const divulgadoresQuery = useMemoFirebase(() => {
        if (!firestore || isUserLoading || !profile) return null;
        const colRef = collection(firestore, 'divulgadores');
        if (hasAdminFilter) return colRef;
        return query(colRef, where('departamento', '==', profile.departamento || ''));
    }, [firestore, isUserLoading, profile, hasAdminFilter]);
    const { data: rawDivulgadores } = useCollectionOnce<Divulgador>(divulgadoresQuery);

    const depts = useMemo(() => {
        if (!datosData || !profile) return [];
        let allDepts = Array.from(new Set(datosData.map((d: Dato) => d.departamento))).map(name => {
            const dato = datosData.find((d: Dato) => d.departamento === name);
            return { label: name, code: dato?.departamento_codigo || '00' };
        }).sort((a, b) => a.code.localeCompare(b.code));

        if (!hasAdminFilter && profile.departamento) {
            return allDepts.filter(d => d.label === profile.departamento);
        }
        return allDepts;
    }, [datosData, profile, hasAdminFilter]);

    if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

    return (
        <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
            <Header title="Agenda de Capacitaciones" />
            <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                    <div>
                        <h1 className="text-3xl font-black uppercase text-primary">Agenda de Capacitaciones</h1>
                        <p className="text-muted-foreground text-[10px] font-bold uppercase mt-1 flex items-center gap-2">
                            <Activity className="h-4 w-4" /> SEGUIMIENTO OPERATIVO POR DISTRITO
                        </p>
                    </div>
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="BUSCAR ACTIVIDAD O ENTIDAD..." 
                            value={agendaSearch} 
                            onChange={(e) => setAgendaSearch(e.target.value)}
                            className="h-12 pl-12 rounded-2xl border-2 font-black uppercase text-[10px]"
                        />
                    </div>
                </div>

                <Accordion type="multiple" className="space-y-6">
                    {depts.map(dept => (
                        <DepartmentSection 
                            key={dept.label}
                            dept={dept}
                            firestore={firestore}
                            profile={profile}
                            currentTime={currentTime}
                            datosData={datosData}
                            rawDivulgadores={rawDivulgadores}
                            router={router}
                            hasAdminFilter={hasAdminFilter}
                            agendaSearch={agendaSearch}
                        />
                    ))}
                </Accordion>
                {depts.length === 0 && (
                    <Card className="p-20 text-center border-dashed bg-white rounded-3xl">
                        <p className="font-black text-muted-foreground uppercase tracking-widest opacity-30">No hay departamentos configurados</p>
                    </Card>
                )}
            </main>
        </div>
    );
}

