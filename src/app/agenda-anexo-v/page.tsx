
"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/header';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useUser, useFirebase, useCollectionOnce, useCollectionPaginated, useMemoFirebase } from '@/firebase';
import { ToastAction } from "@/components/ui/toast";
import { collection, query, where, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, writeBatch, getDocs, getCountFromServer, orderBy, limit } from 'firebase/firestore';
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
  ChevronDown,
  ClipboardCheck,
  Power,
  PowerOff,
  ShieldAlert,
  Printer,
  Ban,
  ImageIcon,
  Navigation,
  User,
  Phone,
  Maximize2,
  Clock,
  Truck,
  PackageCheck
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
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ImageViewerDialog } from '@/components/image-viewer-dialog';

const normalizeGeo = (str: string) => {
  if (!str) return '';
  return str.toUpperCase()
    .replace(/^[\d\s-]*/, '') // Elimina TODO rastro de números, guiones y espacios al inicio
    .trim();
};

const DistrictSection = ({ 
    deptLabel,
    dist,
    firestore, 
    profile, 
    currentTime, 
    agendaSearch,
    setViewingActivity,
    setAssigningSolicitud,
    setQrSolicitud,
    setDeletingSolicitud,
    setSuspendingSolicitud,
    setConcludingSolicitud,
    setDeletingDistrict,
    handleToggleQr,
    viewedQRs,
    markQRAsViewed,
    router,
    registerUpdateItem,
    hasAdminFilter,
    initialOpen = false,
    allDeptItems = [],
    isDeptLoading = false
}: any) => {
    const [isOpen, setIsOpen] = useState(initialOpen || hasAdminFilter === false);
    const [solicitudesState, setSolicitudesState] = useState<SolicitudCapacitacion[]>([]);

    useEffect(() => {
        const target = normalizeGeo(dist.label);
        setSolicitudesState((allDeptItems || []).filter((sol: any) => normalizeGeo(sol.distrito) === target));
    }, [allDeptItems, dist.label]);

    const updateItem = useCallback((id: string, updates: any) => {
        setSolicitudesState(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    }, []);

    useEffect(() => {
        if (registerUpdateItem) registerUpdateItem(deptLabel + dist.label, updateItem);
        return () => { if (registerUpdateItem) registerUpdateItem(deptLabel + dist.label, null); };
    }, [updateItem, deptLabel, dist.label, registerUpdateItem]);

    // Filtramos los items del departamento que pertenecen a este distrito usando normalizeGeo
    const rawSolicitudes = solicitudesState;

    const isLoading = isDeptLoading;
    const isLoadingMore = false;
    const hasMore = false;
    const loadMore = () => {};
    const error = null;

    const [movimientosMap, setMovimientosMap] = useState<Map<string, MovimientoMaquina>>(new Map());
    const [informesMap, setInformesMap] = useState<Map<string, InformeDivulgador[]>>(new Map());
    const fetchedIdsRef = useRef<string>('');


    useEffect(() => {
        if (!firestore || !rawSolicitudes || rawSolicitudes.length === 0) return;
        
        const relevantIds = rawSolicitudes
            .filter(sol => !sol.cancelada) 
            .map(sol => sol.id);
            
        if (relevantIds.length === 0) return;

        const idsKey = relevantIds.slice().sort().join(',');
        if (idsKey === fetchedIdsRef.current) return;
        fetchedIdsRef.current = idsKey;

        const uniqueIds = Array.from(new Set(relevantIds));
        const chunks = [];
        for (let i = 0; i < uniqueIds.length; i += 30) {
            chunks.push(uniqueIds.slice(i, i + 30));
        }

        Promise.all(chunks.map(chunk => 
            getDocs(query(collection(firestore, 'movimientos-maquinas'), where('solicitud_id', 'in', chunk)))
        )).then(snapshots => {
            const newMap = new Map();
            snapshots.forEach(snap => snap.docs.forEach(doc => {
                const data = doc.data();
                const solId = data.solicitud_id;
                const existing = newMap.get(solId);
                
                // Prioridad: Si no existe, o si el nuevo tiene fecha_devolucion y el viejo no, 
                // o si ambos son iguales en estado pero el nuevo es más reciente
                if (!existing || (!existing.fecha_devolucion && data.fecha_devolucion) || 
                   (data.fecha_devolucion && existing.fecha_devolucion && data.fecha_creacion > existing.fecha_creacion)) {
                    newMap.set(solId, { id: doc.id, ...data });
                }
            }));
            setMovimientosMap(prev => {
                const combined = new Map(prev);
                newMap.forEach((val, key) => combined.set(key, val));
                return combined;
            });
        }).catch(e => console.error(e));

        Promise.all(chunks.map(chunk => 
            getDocs(query(collection(firestore, 'informes-divulgador'), where('solicitud_id', 'in', chunk)))
        )).then(snapshots => {
            const newMap = new Map();
            snapshots.forEach(snap => snap.docs.forEach(doc => {
                const id = doc.data().solicitud_id;
                if (!newMap.has(id)) newMap.set(id, []);
                newMap.get(id).push({ id: doc.id, ...doc.data() });
            }));
            setInformesMap(prev => {
                const combined = new Map(prev);
                newMap.forEach((val, key) => combined.set(key, val));
                return combined;
            });
        }).catch(e => console.error(e));
    }, [firestore, rawSolicitudes]);

    const activeSolicitudes = useMemo(() => {
        if (!rawSolicitudes) return [];
        const searchTerm = agendaSearch.toLowerCase().trim();
        const currentMs = currentTime.getTime();

        return rawSolicitudes.filter((sol: SolicitudCapacitacion) => {
            if (sol.cancelada) return false;

            if (sol.fecha_cumplido) {
                const completionTime = new Date(sol.fecha_cumplido);
                const diffHours = (currentMs - completionTime.getTime()) / (1000 * 60 * 60);
                if (diffHours > 720) return false; // Ampliado a 30 días (720h)
                return true;
            }

            const matchesSearch = !searchTerm || 
                (sol.departamento || '').toLowerCase().includes(searchTerm) || 
                (sol.distrito || '').toLowerCase().includes(searchTerm) ||
                (sol.nombre_completo || '').toLowerCase().includes(searchTerm) ||
                (sol.solicitante_entidad || '').toLowerCase().includes(searchTerm) ||
                (sol.otra_entidad || '').toLowerCase().includes(searchTerm);

            if (!matchesSearch) return false;

            const mov = movimientosMap.get(sol.id);
            const itemInformes = informesMap.get(sol.id) || [];
            const inf = itemInformes.length > 0 ? itemInformes[0] : null;
            
            const isClosed = !!(mov?.fecha_devolucion && inf && sol.fecha_cumplido);
            return !isClosed;
        });
    }, [rawSolicitudes, agendaSearch, currentTime, movimientosMap, informesMap]);

    // Efecto de auto-carga si los items visibles están vacíos por filtros de memoria
    useEffect(() => {
        if (!isLoading && !isLoadingMore && hasMore && activeSolicitudes.length === 0 && (rawSolicitudes?.length || 0) > 0) {
            loadMore();
        }
    }, [isLoading, isLoadingMore, hasMore, activeSolicitudes.length, rawSolicitudes?.length, loadMore]);

    if (activeSolicitudes.length === 0 && !isLoading && !isLoadingMore) {
        const isUserDist = profile?.distrito === dist.label || profile?.role === 'jefe' || profile?.role === 'funcionario';
        if (!isUserDist && !hasAdminFilter) return null;
    }

    return (
        <AccordionItem value={dist.label} className="border-none">
            <AccordionTrigger className="hover:no-underline py-4 bg-[#F8F9FA] rounded-2xl px-6 group border border-dashed">
                <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-[#1A1A1A]" />
                    <h3 className="font-black uppercase text-sm tracking-tight text-primary/80">
                        {dist.label}
                    </h3>
                    <Badge variant="secondary" className="bg-black text-white text-[8px] font-black px-2">
                        {activeSolicitudes.length}{hasMore ? '+' : ''}
                    </Badge>
                </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 px-6 pb-6">
                {(isLoading && activeSolicitudes.length === 0) && (
                    <div className="flex flex-col gap-4 py-8 items-center justify-center text-muted-foreground animate-pulse">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Cargando actividades del distrito...</p>
                    </div>
                )}
                {error && (
                    <div className="mb-4 p-4 bg-red-50 border-2 border-red-200 rounded-2xl">
                        <p className="text-[10px] font-black text-red-700 uppercase leading-tight">Error de Sistema (Posible falta de índice):</p>
                        <p className="text-[9px] font-bold text-red-600 mt-1">{error.message}</p>
                        <p className="text-[8px] italic text-red-500 mt-2 uppercase">Si ve un link en la consola del navegador (F12), por favor haga clic para crear el índice.</p>
                    </div>
                )}
                <div className="pt-6 space-y-4 px-2">
                {activeSolicitudes.length > 0 && hasAdminFilter && (
                    <div className="flex justify-end mb-2 px-2">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-[9px] font-black uppercase text-destructive hover:bg-destructive/10 h-8 gap-2"
                            onClick={() => setDeletingDistrict({ dept: deptLabel, dist: dist.label, items: activeSolicitudes })}
                            title="Vaciar todos los registros de este distrito"
                        >
                            <Trash2 className="h-3 w-3" /> VACIAR DISTRITO
                        </Button>
                    </div>
                )}
                {activeSolicitudes.map((item) => {
                    const mov = movimientosMap.get(item.id); 
                    const itemInformes = informesMap.get(item.id) || []; 
                    const inf = itemInformes[0]; 
                    const assignedList = item.divulgadores || item.asignados || []; 
                    const missingInformesFrom = assignedList.filter(asignado => !itemInformes.some(inf => (inf.divulgador_id === asignado.id || inf.cedula_divulgador === asignado.cedula)));
                    
                    const today = new Date();
                    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
                    const isPast = item.fecha < todayStr;
                    const isToday = item.fecha === todayStr;

                    const pendingSalida = !mov;
                    const pendingRetorno = mov && !mov.fecha_devolucion;
                    const pendingAnexoIII = (assignedList.length > 0 ? missingInformesFrom.length > 0 : !itemInformes.length);
                    
                    const hasAlert = isPast && (pendingSalida || pendingRetorno || pendingAnexoIII);
                    const isFulfilled = !!(mov?.fecha_devolucion && inf);

                    const hasPersonnel = (item.divulgadores || item.asignados || []).length > 0;
                    const hasSalida = !!mov;
                    const hasRetorno = !!mov?.fecha_devolucion;
                    const hasInforme = assignedList.length > 0 ? missingInformesFrom.length === 0 : !!inf;

                    const isQRViewed = !!viewedQRs.includes(item.id);
                    const showStep1 = !hasPersonnel;
                    const showStep2 = !!(hasPersonnel && !item.qr_enabled);
                    const showStep3 = !!(hasPersonnel && !!item.qr_enabled && !hasSalida && !isQRViewed);
                    const showStep4 = !!(hasPersonnel && !hasSalida && (!item.qr_enabled || isQRViewed));
                    const showStep5 = !!(hasSalida && !hasRetorno);
                    const showStep6 = !!(pendingAnexoIII);
                    const showStep7 = !!(!item.fecha_cumplido && isFulfilled);

                    const GuideStep = ({ step, message, active, onClick, position = 'left' }: any) => {
                        if (!active) return null;
                        
                        const positionClasses: Record<string, string> = {
                            left: "right-full top-1/2 -translate-y-1/2 pr-2 flex-row",
                            right: "left-full top-1/2 -translate-y-1/2 pl-2 flex-row-reverse",
                            top: "bottom-full left-1/2 -translate-x-1/2 mb-2 flex-col-reverse",
                            bottom: "top-full left-1/2 -translate-x-1/2 mt-2 flex-col",
                        };

                        const triangleClasses: Record<string, string> = {
                            left: "border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[8px] border-l-blue-600 -ml-0.5",
                            right: "border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[8px] border-r-blue-600 -mr-0.5",
                            top: "border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-blue-600 -mt-0.5",
                            bottom: "border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-blue-600 -mb-0.5",
                        };

                        return (
                            <div className={cn("absolute z-[100] animate-bounce pointer-events-auto flex items-center gap-0 cursor-pointer whitespace-nowrap", positionClasses[position])} onClick={(e) => { e.stopPropagation(); if(onClick) onClick(); }}>
                                <div className="bg-blue-600 text-white text-[8px] font-black px-3 py-2 rounded-xl shadow-2xl border-2 border-white flex items-center gap-2 max-w-[180px] leading-tight">
                                    <div className="h-4 w-4 shrink-0 rounded-full bg-white text-blue-600 flex items-center justify-center text-[10px]">{step}</div>{message.toUpperCase()}
                                </div>
                                <div className={cn("w-0 h-0", triangleClasses[position])} />
                            </div>
                        );
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

                    return (
                        <Card key={item.id} className={cn("border-2 shadow-sm rounded-2xl relative", hasAlert ? "border-destructive/40 bg-destructive/[0.02]" : isFulfilled ? "border-green-500 bg-green-50/50" : "border-muted/20 bg-white")}>
                            <CardContent className="p-8">
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                                    <div className="lg:col-span-4 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">ORIGEN PROGRAMACIÓN</p>
                                            {isFulfilled && (
                                                <Badge className="bg-green-600 text-white font-black uppercase text-[7px] px-2 py-0 h-4">CICLO COMPLETADO</Badge>
                                            )}
                                        </div>
                                        <p className="font-black text-base uppercase leading-tight text-[#1A1A1A]">{item.solicitante_entidad}</p>
                                        <Badge className="bg-black/5 text-black border-black/10 font-black uppercase text-[8px] px-3">{item.tipo_solicitud === 'divulgacion' ? 'ANEXO V - DIVULGACIÓN' : 'ANEXO V - CAPACITACIÓN'}</Badge>
                                    </div>

                                    <div className="lg:col-span-3 space-y-4">
                                        <div className="flex items-center gap-3">
                                            <MapPin className="h-4 w-4 text-muted-foreground" />
                                            <p className="font-black text-[12px] uppercase text-[#1A1A1A]">{item.lugar_local}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Calendar className={cn("h-4 w-4", hasAlert ? "text-destructive" : "text-muted-foreground")} />
                                            <p className={cn("font-black text-[12px] uppercase", hasAlert ? "text-destructive font-black" : "text-[#1A1A1A]")}>
                                                {formatDateToDDMMYYYY(item.fecha)} | {item.hora_desde} A {item.hora_hasta} HS
                                            </p>
                                        </div>
                                    </div>

                                    <div className="lg:col-span-2 space-y-4">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">PERSONAL</p>
                                            {(item.divulgadores || item.asignados || []).length > 0 ? (
                                                <div className="flex items-center gap-2 text-[#16A34A]">
                                                    <Users className="h-4 w-4" />
                                                    <p className="font-black text-[11px] uppercase">{(item.divulgadores || item.asignados || []).length} ASIGNADOS</p>
                                                </div>
                                            ) : (
                                                <p className="text-[10px] font-black text-destructive italic uppercase">SIN ASIGNAR</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-primary pt-2 border-t border-dashed">
                                            <MessageSquareHeart className="h-3.5 w-3.5" />
                                            <SurveyCounter solicitudId={item.id} firestore={firestore} />
                                        </div>
                                    </div>

                                    <div className="lg:col-span-3 flex flex-col items-end gap-3">
                                        {(pendingSalida || pendingRetorno || pendingAnexoIII) && (
                                            <div className="w-full max-w-[220px] mb-2 flex flex-col gap-1">
                                                {pendingSalida && (
                                                    <div className="relative">
                                                        <GuideStep step={4} message="Completa el formulario de SALIDA" active={showStep4} onClick={() => router.push(`/control-movimiento-maquinas?solicitudId=${item.id}`)} position="top" />
                                                        <Link 
                                                            href={`/control-movimiento-maquinas?solicitudId=${item.id}`} 
                                                            className={cn(
                                                                "flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-lg transition-all",
                                                                isPast ? "bg-destructive text-white border-destructive animate-pulse" : "bg-blue-600 text-white border-blue-700"
                                                            )}
                                                        >
                                                            <Truck className="h-3.5 w-3.5" />
                                                            <span className="text-[7.5px] font-black uppercase tracking-tight leading-none">
                                                                {isPast ? "COMPLETA TU FORMULARIO DE SALIDA (ATRASADO)" : "COMPLETA TU FORMULARIO DE SALIDA"}
                                                            </span>
                                                        </Link>
                                                    </div>
                                                )}
                                                {pendingRetorno && (
                                                    <div className="relative">
                                                        <GuideStep step={5} message="Completa la DEVOLUCIÓN DE EQUIPOS" active={showStep5} onClick={() => router.push(`/control-movimiento-maquinas?solicitudId=${item.id}`)} position="top" />
                                                        <Link 
                                                            href={`/control-movimiento-maquinas?solicitudId=${item.id}`} 
                                                            className={cn(
                                                                "flex items-center gap-2 px-3 py-1 rounded-lg border transition-colors",
                                                                isPast ? "bg-destructive/10 text-destructive border-destructive/20 animate-pulse" : "bg-blue-50 text-blue-600 border-blue-200"
                                                            )}
                                                        >
                                                            <ShieldAlert className="h-3 w-3" />
                                                            <span className="text-[8px] font-black uppercase underline decoration-2 underline-offset-2">
                                                                {isPast ? "FALTA RETORNO (F02)" : "PENDIENTE RETORNO (F02)"}
                                                            </span>
                                                        </Link>
                                                    </div>
                                                )}
                                                {pendingAnexoIII && (
                                                    <Link 
                                                        href={`/informe-divulgador?solicitudId=${item.id}`} 
                                                        className={cn(
                                                            "flex items-center gap-2 px-3 py-1 rounded-lg border transition-colors",
                                                            isPast ? "bg-destructive/10 text-destructive border-destructive/20 animate-pulse" : "bg-blue-50 text-blue-600 border-blue-200"
                                                        )}
                                                    >
                                                        <AlertCircle className="h-3 w-3" />
                                                        <span className="text-[8px] font-black uppercase underline decoration-2 underline-offset-2">
                                                            {isPast ? "FALTA INFORME" : "INFORME PENDIENTE"}: {missingInformesFrom.length > 0 ? missingInformesFrom.map(f => f.nombre.split(" ")[0]).join(", ") : "REQUERIDO"}
                                                        </span>
                                                    </Link>
                                                )}
                                            </div>
                                        )}

                                        <div className="flex gap-2 w-full max-w-[220px]">
                                            <div className="flex-1 relative">
                                                <GuideStep step={1} message="Asigna personal para la actividad" active={showStep1} onClick={() => setAssigningSolicitud(item)} position="left" />
                                                <Button variant="outline" size="sm" className="w-full h-11 rounded-xl font-black uppercase text-[11px] border-2" onClick={() => setAssigningSolicitud(item)} title="Gestionar Personal Asignado">
                                                    <UserPlus className="h-4 w-4 mr-2" /> ASIGNAR
                                                </Button>
                                            </div>
                                            <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl border-2" onClick={() => setViewingActivity(item)} title="Ver Ficha de Detalles">
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl border-2 border-orange-200 text-orange-600 hover:bg-orange-50 transition-all" onClick={() => setSuspendingSolicitud(item)} title="Suspender Actividad">
                                                <Ban className="h-4 w-4" />
                                            </Button>
                                            <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl border-2 border-destructive/40 text-destructive hover:bg-destructive hover:text-white transition-all" onClick={() => setDeletingSolicitud(item)} title="Eliminar Registro Definitivamente">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        
                                        <div className="flex gap-2 w-full max-w-[220px]">
                                            <div className="relative">
                                                <GuideStep step={2} message="Habilitar el acceso al QR" active={showStep2} onClick={() => handleToggleQr(item)} position="left" />
                                                <Button 
                                                    variant="outline" 
                                                    size="icon" 
                                                    className={cn("h-11 w-11 rounded-xl border-2 transition-all", item.qr_enabled ? "bg-green-600 border-green-600 text-white" : "border-muted-foreground/30 text-muted-foreground")} 
                                                    onClick={() => handleToggleQr(item)}
                                                    title={item.qr_enabled ? "Deshabilitar Encuesta Pública" : "Habilitar Encuesta Pública vía QR"}
                                                >
                                                    {item.qr_enabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                            {!item.fecha_cumplido && isFulfilled ? (
                                                <div className="flex-1 relative">
                                                    <GuideStep step={7} message="CONCLUIR ACTIVIDAD" active={showStep7} onClick={() => setConcludingSolicitud(item)} position="top" />
                                                    <Button 
                                                        className="w-full h-11 rounded-xl font-black uppercase text-[10px] bg-green-600 hover:bg-green-700 text-white shadow-lg animate-pulse"
                                                        onClick={() => setConcludingSolicitud(item)}
                                                    >
                                                        CONCLUIR
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex-1" />
                                            )}
                                        </div>
                                        
                                        <div className="flex gap-2 w-full max-w-[220px]">
                                            <div className="flex-1 relative">
                                                <GuideStep step={3} message="Descarga el QR para la actividad" active={showStep3} onClick={() => { setQrSolicitud(item); markQRAsViewed(item.id); }} position="left" />
                                                <Button variant="outline" size="sm" className="w-full h-11 rounded-xl font-black uppercase text-[10px] border-2" onClick={() => { setQrSolicitud(item); markQRAsViewed(item.id); }} disabled={!item.qr_enabled} title="Ver y Descargar Código QR">
                                                    <QrCode className="h-4 w-4 mr-2" /> QR
                                                </Button>
                                            </div>
                                            <div className="flex-1 relative">
                                                <GuideStep step={6} message="Completa el Informe del Divulgador" active={showStep6} onClick={() => { if (!inf) router.push(`/informe-divulgador?solicitudId=${item.id}`); }} position="top" />
                                                <Button 
                                                    className={cn("h-11 w-full rounded-xl font-black uppercase text-[11px] shadow-lg", inf ? "bg-[#16A34A] hover:bg-[#15803D]" : "bg-black hover:bg-black/90")}
                                                    onClick={() => {
                                                        if (!inf) {
                                                            router.push(`/informe-divulgador?solicitudId=${item.id}`);
                                                        }
                                                    }}
                                                    title={inf ? "Informe enviado" : "Cargar Informe de Marcación"}
                                                >
                                                    {inf ? 'CUMPLIDO' : 'INFORME'}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}

                {hasMore && (
                    <div className="pt-4 flex justify-center">
                        <Button 
                            onClick={loadMore} 
                            disabled={isLoadingMore}
                            variant="ghost"
                            className="text-[10px] font-black uppercase text-primary/60 hover:text-primary h-8"
                        >
                            {isLoadingMore ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <ChevronDown className="h-3 w-3 mr-2" />}
                            MOSTRAR MÁS DE {dist.label.toUpperCase()}
                        </Button>
                    </div>
                )}
                </div>
            </AccordionContent>
        </AccordionItem>
    );
};

const DepartmentSection = ({ 
    dept, 
    firestore, 
    profile, 
    currentTime, 
    agendaSearch,
    datosData,
    setViewingActivity,
    setAssigningSolicitud,
    setQrSolicitud,
    setDeletingSolicitud,
    setSuspendingSolicitud,
    setConcludingSolicitud,
    setDeletingDistrict,
    handleToggleQr,
    viewedQRs,
    markQRAsViewed,
    router,
    registerUpdateItem,
    hasAdminFilter,
    initialOpen = false
}: any) => {
    // Forzamos el estado abierto si el usuario solo tiene acceso a un departamento/distrito (Jefe)
    const [isOpen, setIsOpen] = useState(initialOpen || hasAdminFilter === false);
    
    // Obtenemos los distritos del departamento desde la colección 'datos'
    const deptQuery = useMemoFirebase(() => {
        if (!firestore || !isOpen) return null;

        const norm = normalizeGeo(dept.label);
        const variations = Array.from(new Set([
            dept.label,                            // 03 - CORDILLERA
            norm,                                  // CORDILLERA
            norm.charAt(0) + norm.slice(1).toLowerCase(), // Cordillera
            dept.label.replace(/\s*-\s*/, '-'),    // 03-CORDILLERA
            dept.label.replace(/^0+/, ''),         // 3 - CORDILLERA
            dept.label.replace(/^0+/, '').replace(/\s*-\s*/, '-') // 3-COREDILLERA
        ])).filter(Boolean);

        return query(
            collection(firestore, 'solicitudes-capacitacion'),
            where('tipo_solicitud', 'in', ['divulgacion', 'capacitacion']),
            where('departamento', 'in', variations)
        );
    }, [firestore, isOpen, dept.label]);

    const { data: allDeptItems, isLoading: isDeptLoading, error: deptError } = useCollectionOnce<SolicitudCapacitacion>(deptQuery);

    const districtsData = useMemo(() => {
        if (!datosData) return [];
        
        // Si el usuario tiene filtro de distrito, solo mostramos ese distrito SI pertenece a este departamento
        const role = (profile?.role || '').toLowerCase();
        if (!hasAdminFilter && (role === 'jefe' || role === 'funcionario' || profile?.permissions?.includes('district_filter'))) {
                const targetDist = normalizeGeo(profile.distrito);
                const userDistEntry = datosData.find((d: Dato) => normalizeGeo(d.distrito) === targetDist);
                if (userDistEntry?.departamento === dept.label) {
                    const distName = userDistEntry.distrito;
                    const code = distName.match(/^\d+/)?.[0] || '00';
                    return [{ label: distName, code }];
                }
                // Fallback: si no hay match en datos pero el perfil tiene distrito, lo usamos (con códigos)
                return [{ label: profile.distrito, code: profile.distrito.match(/^\d+/)?.[0] || '00' }];
            return []; // Obligamos a que si es jefe pero no hay match o no hay distrito, no vea nada
        }


        const dists = new Set();
        datosData.forEach((d: any) => {
            if (d.departamento === dept.label) {
                dists.add(d.distrito);
            }
        });

        return Array.from(dists).map(d => ({
            label: d as string,
            code: (d as string).match(/^\d+/)?.[0] || '00'
        })).sort((a, b) => a.code.localeCompare(b.code));
    }, [datosData, dept.label, profile, hasAdminFilter]);

    const distFound = useMemo(() => {
        const map: Record<string, number> = {};
        (allDeptItems || []).forEach((s: any) => {
            const d = normalizeGeo(s.distrito || 'S/D');
            map[d] = (map[d] || 0) + 1;
        });
        return Object.entries(map).map(([k, v]) => `${k}:${v}`).join(', ');
    }, [allDeptItems]);

    return (
        <AccordionItem value={dept.label} className="border-none bg-white rounded-[2rem] shadow-sm overflow-hidden">
            <AccordionTrigger 
                className="hover:no-underline px-8 py-6 bg-white group"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-6 text-left">
                    <div className="h-14 w-14 rounded-full bg-black text-white flex items-center justify-center font-black text-lg shadow-xl">
                        {dept.code}
                    </div>
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight text-[#1A1A1A]">{dept.label}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                {isOpen ? `${districtsData.length} DISTRITOS CONFIGURADOS` : 'CLIC PARA EXPLORAR DEPARTAMENTO'}
                            </p>
                            {deptError && (
                                <Badge variant="destructive" className="text-[6px] py-0 px-1 font-black uppercase">
                                    ERR: {deptError.message.substring(0, 15)}...
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
            </AccordionTrigger>
            
            <AccordionContent className="px-8 pb-8 pt-2" forceMount={districtsData.length === 1 ? true : undefined}>
                <Accordion type="multiple" className="space-y-4" defaultValue={districtsData.length === 1 ? [districtsData[0].label] : undefined}>
                    {(isOpen || districtsData.length === 1) && districtsData.map((dist: { label: string, code: string }) => (
                        <DistrictSection
                            key={dist.label}
                            deptLabel={dept.label}
                            dist={dist}
                            firestore={firestore}
                            profile={profile}
                            currentTime={currentTime}
                            agendaSearch={agendaSearch}
                            setViewingActivity={setViewingActivity}
                            setAssigningSolicitud={setAssigningSolicitud}
                            setQrSolicitud={setQrSolicitud}
                            setDeletingSolicitud={setDeletingSolicitud}
                            setSuspendingSolicitud={setSuspendingSolicitud}
                            setConcludingSolicitud={setConcludingSolicitud}
                            setDeletingDistrict={setDeletingDistrict}
                            handleToggleQr={handleToggleQr}
                            viewedQRs={viewedQRs}
                            markQRAsViewed={markQRAsViewed}
                            router={router}
                            registerUpdateItem={registerUpdateItem}
                            hasAdminFilter={hasAdminFilter}
                            initialOpen={districtsData.length === 1}
                            allDeptItems={allDeptItems}
                            isDeptLoading={isDeptLoading}
                        />
                    ))}
                </Accordion>
            </AccordionContent>
        </AccordionItem>
    );
};

export default function AgendaAnexoVPage() {
  const router = useRouter();
  const { user, isUserLoading, isProfileLoading, userError } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const [assigningSolicitud, setAssigningSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [viewingActivity, setViewingActivity] = useState<SolicitudCapacitacion | null>(null);
  const [qrSolicitud, setQrSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [deletingSolicitud, setDeletingSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [suspendingSolicitud, setSuspendingSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [concludingSolicitud, setConcludingSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [deletingDistrict, setDeletingDistrict] = useState<{ dept: string, dist: string, items: SolicitudCapacitacion[] } | null>(null);
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [divulSearch, setDivulSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [viewedQRs, setViewedQRs] = useState<string[]>([]);
  const [agendaSearch, setAgendaSearch] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('viewed_qrs_agenda');
    if (saved) {
      try {
        setViewedQRs(JSON.parse(saved));
      } catch (e) {
        console.error("Error parsing viewed QRs", e);
      }
    }
  }, []);

  const markQRAsViewed = (id: string) => {
    if (!viewedQRs.includes(id)) {
      const updated = [...viewedQRs, id];
      setViewedQRs(updated);
      localStorage.setItem('viewed_qrs_agenda', JSON.stringify(updated));
    }
  };
  const [fullViewerImage, setFullViewerImage] = useState<string | null>(null);

  const qrContainerRef = useRef<HTMLDivElement>(null);

  const profile = user?.profile;

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

  const hasAdminFilter = useMemo(() => {
    const role = (profile?.role || '').toLowerCase();
    return ['admin', 'director', 'coordinador'].includes(role) || profile?.permissions?.includes('admin_filter');
  }, [profile]);
  
  const hasDeptFilter = useMemo(() => 
    !hasAdminFilter && profile?.permissions?.includes('department_filter'),
    [profile, hasAdminFilter]
  );

  const hasDistFilter = useMemo(() => {
    const role = (profile?.role || '').toLowerCase();
    return !hasAdminFilter && !hasDeptFilter && (profile?.permissions?.includes('district_filter') || role === 'jefe' || role === 'funcionario');
  }, [profile, hasAdminFilter, hasDeptFilter]);

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData, isLoading: isLoadingDatos, error: datosError } = useCollectionOnce<Dato>(datosQuery);

  const updateItemRegistry = useRef<Map<string, (id: string, updates: any) => void>>(new Map());
  const registerUpdateItem = (dept: string, fn: any) => {
    if (fn) updateItemRegistry.current.set(dept, fn);
    else updateItemRegistry.current.delete(dept);
  };

  const updateItem = (id: string, updates: any) => {
    updateItemRegistry.current.forEach(fn => fn(id, updates));
  };

  const isRestricted = useMemo(() => {
    if (!profile) return false;
    const role = (profile.role || '').toLowerCase();
    return !hasAdminFilter && (role === 'jefe' || role === 'funcionario' || profile.permissions?.includes('district_filter') || profile.permissions?.includes('department_filter'));
  }, [profile, hasAdminFilter]);

  const uniqueDepartments = useMemo(() => {
    if (!datosData || !profile) return [];
    
    // Si el usuario tiene restricciones, solo mostramos su departamento
    if (isRestricted) {
        if (profile.departamento) {
            const deptName = profile.departamento;
            const code = deptName.match(/^\d+/)?.[0] || '00';
            return [{ label: deptName, code }];
        }
        return []; // Si es restringido y no tiene depto, falla de seguridad -> lista vacía
    }

    // Caso Admin: mostramos todos los departamentos únicos de la colección 'datos'
    const depts = new Map();
    datosData.forEach(d => {
      if (!depts.has(d.departamento)) {
        const code = d.departamento.match(/^\d+/)?.[0] || '00';
        depts.set(d.departamento, { label: d.departamento, code });
      }
    });

    return Array.from(depts.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [datosData, hasAdminFilter, profile]);

  const divulgadoresQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !profile) return null;
    const colRef = collection(firestore, 'divulgadores');
    if (hasAdminFilter) return colRef;
    if (hasDeptFilter && profile.departamento) return query(colRef, where('departamento', '==', profile.departamento));
    if (hasDistFilter && profile.departamento && profile.distrito) {
      return query(colRef, where('departamento', '==', profile.departamento), where('distrito', '==', profile.distrito));
    }
    return null;
  }, [firestore, isUserLoading, profile, hasAdminFilter, hasDeptFilter, hasDistFilter]);

  const { data: rawDivulgadores } = useCollectionOnce<Divulgador>(divulgadoresQuery);

  const filteredDivul = useMemo(() => {
    if (!rawDivulgadores || !assigningSolicitud) return [];
    const term = divulSearch.toLowerCase().trim();
    const assignedIds = new Set((assigningSolicitud.divulgadores || []).map(d => d.id));

    return rawDivulgadores.filter(d => 
      d.distrito === assigningSolicitud.distrito &&
      !assignedIds.has(d.id) &&
      (d.nombre.toLowerCase().includes(term) || d.cedula.includes(term))
    );
  }, [rawDivulgadores, divulSearch, assigningSolicitud]);

  const groupedData = useMemo(() => [], []);

  const handleAssignDivulgador = (divulgador: Divulgador) => {
    if (!assigningSolicitud || !firestore) return;
    setIsUpdating(true);
    const docRef = doc(firestore, 'solicitudes-capacitacion', assigningSolicitud.id);
    
    const newDivulgador = {
      id: divulgador.id,
      nombre: divulgador.nombre,
      cedula: divulgador.cedula,
      vinculo: divulgador.vinculo
    };

    updateDoc(docRef, { divulgadores: arrayUnion(newDivulgador) })
      .then(() => {
        toast({ title: "Personal Asignado" });
        const updatedDivs = [...(assigningSolicitud.divulgadores || []), newDivulgador];
        setAssigningSolicitud(prev => prev ? { ...prev, divulgadores: updatedDivs } : null);
        
        // Actualización optimista
        updateItem(assigningSolicitud.id, { divulgadores: updatedDivs });
        
        setIsUpdating(false);
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update' }));
        setIsUpdating(false);
      });
  };

  const handleRemoveDivulgador = (divulgadorId: string) => {
    if (!assigningSolicitud || !firestore) return;
    const docRef = doc(firestore, 'solicitudes-capacitacion', assigningSolicitud.id);
    const divulgadorToRemove = (assigningSolicitud.divulgadores || []).find((d: any) => d.id === divulgadorId);

    if (!divulgadorToRemove) return;

    updateDoc(docRef, { divulgadores: arrayRemove(divulgadorToRemove) })
      .then(() => {
          toast({ title: "Personal Removido" });
          const updatedDivs = (assigningSolicitud.divulgadores || []).filter(d => d.id !== divulgadorId);
          setAssigningSolicitud(prev => prev ? { ...prev, divulgadores: updatedDivs } : null);
          
          // Actualización optimista
          updateItem(assigningSolicitud.id, { divulgadores: updatedDivs });
      })
      .catch(error => { 
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update' }));
      });
  };

  const handleToggleQr = (solicitud: SolicitudCapacitacion) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'solicitudes-capacitacion', solicitud.id);
    const newState = !solicitud.qr_enabled;
    const now = new Date();
    let qr_expires_at = null;

    if (newState) {
      const todayStr = now.toISOString().split('T')[0];
      if (solicitud.fecha < todayStr) {
        // Retroactivo: 20 minutos
        qr_expires_at = new Date(now.getTime() + 20 * 60000).toISOString();
      } else {
        // Normal: Fin del día de la actividad
        const [y, m, d] = solicitud.fecha.split('-').map(Number);
        const endOfDay = new Date(y, m - 1, d, 23, 59, 59);
        qr_expires_at = endOfDay.toISOString();
      }
    }
    
    // Actualización optimista
    updateItem(solicitud.id, { qr_enabled: newState, qr_expires_at: qr_expires_at as any });

        updateDoc(docRef, { 
          qr_enabled: newState,
          qr_expires_at: qr_expires_at
        })
          .then(() => {
            toast({ 
              title: newState ? "Encuesta Habilitada" : "Encuesta Deshabilitada",
              description: newState 
                ? `Acceso abierto hasta: ${new Date(qr_expires_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ${solicitud.fecha < now.toISOString().split('T')[0] ? '(20 min)' : '(Fin del día)'}` 
                : "El acceso público vía QR ha sido cerrado."
            });
          })
      .catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update' }));
      });
  };

  const handleConfirmSuspend = () => {
    if (!suspendingSolicitud || !firestore || !suspensionReason) return;
    setIsUpdating(true);
    const docRef = doc(firestore, 'solicitudes-capacitacion', suspendingSolicitud.id);
    
    updateDoc(docRef, {
        cancelada: true,
        motivo_cancelacion: suspensionReason.toUpperCase(),
        fecha_cancelacion: new Date().toISOString(),
        usuario_cancelacion: profile?.username || user?.email || 'SISTEMA'
    })
    .then(() => {
        toast({ title: "Solicitud Suspendida", description: "Se ha registrado el motivo en el historial." });
        // Optimistic UI
        updateItem(suspendingSolicitud.id, { cancelada: true });
        setSuspendingSolicitud(null);
        const updater = updateItemRegistry.current.get(suspendingSolicitud.departamento);
        if (updater) updater(suspendingSolicitud.id, { cancelada: true });
        
        setSuspendingSolicitud(null);
        setSuspensionReason('');
        setIsUpdating(false);
    })
    .catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update' }));
        setIsUpdating(false);
    });
  };

  const handleConfirmDelete = () => {
    if (!deletingSolicitud || !firestore) return;
    setIsUpdating(true);
    const docRef = doc(firestore, 'solicitudes-capacitacion', deletingSolicitud.id);
    deleteDoc(docRef)
        .then(() => {
            toast({ title: "Solicitud Eliminada" });
            
            const updater = updateItemRegistry.current.get(deletingSolicitud.departamento);
            if (updater) {
                // Para eliminar, le pasamos una marca o lo manejamos localmente
                // En este caso useCollectionPaginated de los hijos no tiene "removeItem" fácil
                // pero si refrescan o si el filtro los saca bastaría.
                // Como es DELETE, forzamos un refetch en el hijo si es necesario, 
                // o le pasamos null para que el hijo sepa que debe desaparecer.
                updater(deletingSolicitud.id, { _deleted: true });
            }
            
            setDeletingSolicitud(null);
            setIsUpdating(false);
        })
        .catch(async (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' }));
            setIsUpdating(false);
        });
  };

  const handleConfirmDeleteDistrict = () => {
    if (!deletingDistrict || !firestore) return;
    setIsUpdating(true);
    const batch = writeBatch(firestore);
    
    deletingDistrict.items.forEach(item => {
        const docRef = doc(firestore, 'solicitudes-capacitacion', item.id);
        batch.delete(docRef);
    });

    batch.commit()
        .then(() => {
            toast({ title: "Distrito Limpiado" });
            setDeletingDistrict(null);
            setIsUpdating(false);
        })
        .catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'solicitudes-capacitacion (batch-district)', operation: 'delete' }));
        setIsUpdating(false);
    });
  };

  const handleManualComplete = (solicitudId: string) => {
    if (!firestore) return;
    setIsUpdating(true);
    const docRef = doc(firestore, 'solicitudes-capacitacion', solicitudId);
    updateDoc(docRef, {
        fecha_cumplido: new Date().toISOString()
    })
    .then(() => {
        const time = new Date().toISOString();
        toast({ 
            variant: "warning",
            title: "CICLO CONCLUIDO", 
            description: "Este agenda se archivará en Archivo / Historial en 3 minutos.",
            duration: 3000,
            action: (
              <ToastAction altText="Volver a la agenda" onClick={() => setConcludingSolicitud(null)}>
                VOLVER A LA AGENDA
              </ToastAction>
            ),
        });
        
        const updater = updateItemRegistry.current.get(concludingSolicitud!.departamento);
        if (updater) updater(solicitudId, { fecha_cumplido: time });
        
        setConcludingSolicitud(null);
        setIsUpdating(false);
    })
    .catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update' }));
        setIsUpdating(false);
    });
  };

  const surveyUrl = useMemo(() => {
    if (typeof window === 'undefined' || !qrSolicitud) return '';
    return `${window.location.origin}/encuesta-satisfaccion?solicitudId=${qrSolicitud.id}`;
  }, [qrSolicitud]);

  const qrImageUrl = useMemo(() => {
    if (!surveyUrl) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(surveyUrl)}`;
  }, [surveyUrl]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Enlace copiado" });
  };

  const handleDownloadPng = async () => {
    if (!qrSolicitud || !qrContainerRef.current) return;
    try {
      const canvas = await html2canvas(qrContainerRef.current, {
        backgroundColor: '#ffffff',
        scale: 3,
        useCORS: true,
        logging: false
      });
      const link = document.createElement('a');
      const entity = qrSolicitud.solicitante_entidad || qrSolicitud.otra_entidad || 'Capacitacion';
      link.download = `QR-${entity.replace(/\s+/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast({ title: "Imagen Generada", description: "Se ha descargado el PNG." });
    } catch (e) {
      toast({ variant: 'destructive', title: "Error al generar imagen" });
    }
  };

  const handlePrintQr = async () => {
    if (!qrSolicitud || !logoBase64) return;
    
    try {
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        
        doc.addImage(logoBase64, 'PNG', pageWidth/2 - 15, 15, 30, 30);
        
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text("JUSTICIA ELECTORAL", pageWidth/2, 55, { align: 'center' });
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text("ENCUESTA DE SATISFACCIÓN CIUDADANA", pageWidth/2, 62, { align: 'center' });

        const response = await fetch(qrImageUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        const qrBase64: string = await new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });

        const qrSize = 100;
        doc.addImage(qrBase64, 'PNG', (pageWidth - qrSize)/2, 75, qrSize, qrSize);

        const entity = qrSolicitud.solicitante_entidad || qrSolicitud.otra_entidad || 'Capacitación';
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(entity.toUpperCase(), pageWidth/2, 190, { align: 'center' });
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`${formatDateToDDMMYYYY(qrSolicitud.fecha)} HS.`, pageWidth/2, 200, { align: 'center' });

        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text("Escanée el código para participar de la encuesta oficial.", pageWidth/2, 215, { align: 'center' });

        doc.save(`QR-${entity.replace(/\s+/g, '-')}.pdf`);
        toast({ title: "PDF Generado", description: "El QR está listo para imprimir." });
    } catch (e) {
        toast({ variant: 'destructive', title: "Error al generar PDF" });
    }
  };

  if (isUserLoading || isProfileLoading || (isLoadingDatos && !datosData)) {
    return (
        <div className="flex h-screen flex-col items-center justify-center p-10 bg-[#F8F9FA]">
            <Loader2 className="animate-spin h-12 w-12 text-primary opacity-20" />
            <p className="mt-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Inicializando Agenda...</p>
            {(userError || datosError) && (
                <div className="mt-8 max-w-md p-8 bg-white border-2 border-red-100 rounded-[3rem] text-center shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-red-600" />
                    <ShieldAlert className="h-12 w-12 text-red-600 mx-auto mb-4" />
                    <h3 className="font-black text-red-900 uppercase text-sm mb-2">Interrupción de Seguridad</h3>
                    <p className="text-[10px] font-bold text-red-700 leading-tight uppercase mb-6">
                        {userError?.message || datosError?.message || 'Error de conexión con la base de datos'}
                    </p>
                    <Button 
                        variant="outline" 
                        onClick={() => window.location.reload()}
                        className="rounded-2xl font-black text-[10px] uppercase tracking-widest px-8 border-2 hover:bg-red-600 hover:text-white transition-all"
                    >
                        Forzar Recarga de Sistema
                    </Button>
                </div>
            )}
        </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Agenda de Capacitaciones" />
      
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
                <h1 className="text-3xl font-black uppercase text-primary">Agenda de Capacitaciones</h1>
                <p className="text-muted-foreground text-xs font-bold uppercase mt-1 flex items-center gap-2">
                    <Activity className="h-4 w-4" /> Seguimiento nacional de actividades registradas.
                </p>
            </div>
             <div className="bg-white px-4 py-2 rounded-full border border-dashed flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-[9px] font-black uppercase text-muted-foreground">VISTA OPERATIVA</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[8px] font-black uppercase">
                    DEBUG: DEP:{profile?.departamento} | DIST:{profile?.distrito}
                  </Badge>
                </div>
            </div>
        </div>

        <div className="relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                className="h-11 pl-11 pr-4 rounded-xl border-2 border-white shadow-lg text-sm font-bold placeholder:text-muted-foreground/40 bg-white"
                placeholder="BUSCAR DEPARTAMENTO, DISTRITO O SOLICITANTE..."
                value={agendaSearch}
                onChange={(e) => setAgendaSearch(e.target.value.toUpperCase())}
            />
        </div>



        {uniqueDepartments.length === 0 ? (
          <Card className="p-20 text-center border-dashed bg-white rounded-3xl">
            <p className="font-black text-muted-foreground uppercase tracking-widest opacity-30">No hay actividades agendadas en su jurisdicción</p>
          </Card>
        ) : (
          <Accordion type="multiple" className="space-y-6" defaultValue={uniqueDepartments.length === 1 ? [uniqueDepartments[0].label] : undefined}>
            {uniqueDepartments.map((dept) => (
                <DepartmentSection 
                    key={dept.label}
                    dept={dept}
                    firestore={firestore}
                    profile={profile}
                    isUserLoading={isUserLoading}
                    currentTime={currentTime}
                    agendaSearch={agendaSearch}
                    datosData={datosData}
                    setViewingActivity={setViewingActivity}
                    setAssigningSolicitud={setAssigningSolicitud}
                    setQrSolicitud={setQrSolicitud}
                    setDeletingSolicitud={setDeletingSolicitud}
                    setSuspendingSolicitud={setSuspendingSolicitud}
                    setConcludingSolicitud={setConcludingSolicitud}
                    setDeletingDistrict={setDeletingDistrict}
                    handleToggleQr={handleToggleQr}
                    viewedQRs={viewedQRs}
                    markQRAsViewed={markQRAsViewed}
                    router={router}
                    registerUpdateItem={registerUpdateItem}
                    hasAdminFilter={hasAdminFilter}
                    initialOpen={uniqueDepartments.length === 1}
                />
            ))}
          </Accordion>
        )}
      </main>

      <Dialog open={!!viewingActivity} onOpenChange={(o) => !o && setViewingActivity(null)}>
        <DialogContent className="max-w-4xl h-[90vh] p-0 border-none shadow-2xl overflow-hidden rounded-[2.5rem] flex flex-col">
          {viewingActivity && (
            <div className="flex flex-col h-full bg-white">
                <div className="bg-black text-white p-8 shrink-0">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
                                    <FileText className="h-6 w-6" />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-black uppercase leading-none tracking-tight">FICHA DE SOLITUD ANEXO V</DialogTitle>
                                    <DialogDescription className="text-white/60 font-bold uppercase text-[10px] mt-2 tracking-widest">
                                        ID DE CONTROL: {viewingActivity.id}
                                    </DialogDescription>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setViewingActivity(null)} className="text-white/40 hover:text-white" title="Cerrar Ventana"><X className="h-6 w-6" /></Button>
                        </div>
                    </DialogHeader>
                </div>

                <div className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-black/20">
                    <div className="space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1 p-4 bg-muted/20 rounded-2xl border">
                                <p className="text-[8px] font-black text-muted-foreground uppercase flex items-center gap-1"><Building2 className="h-2.5 w-2.5" /> Solicitante</p>
                                <p className="text-xs font-black uppercase">{viewingActivity.solicitante_entidad || viewingActivity.otra_entidad}</p>
                            </div>
                            <div className="space-y-1 p-4 bg-muted/20 rounded-2xl border">
                                <p className="text-[8px] font-black text-muted-foreground uppercase flex items-center gap-1"><Calendar className="h-2.5 w-2.5" /> Fecha Programada</p>
                                <p className="text-xs font-black uppercase">{formatDateToDDMMYYYY(viewingActivity.fecha)}</p>
                            </div>
                            <div className="space-y-1 p-4 bg-muted/20 rounded-2xl border">
                                <p className="text-[8px] font-black text-muted-foreground uppercase flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> Horario Pactado</p>
                                <p className="text-xs font-black uppercase">{viewingActivity.hora_desde} A {viewingActivity.hora_hasta} HS</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1 p-4 bg-muted/20 rounded-2xl border">
                                <p className="text-[8px] font-black text-muted-foreground uppercase flex items-center gap-1"><MapPin className="h-2.5 w-2.5" /> Local y Dirección</p>
                                <p className="text-xs font-black uppercase">{viewingActivity.lugar_local} - {viewingActivity.direccion_calle || 'S/D'} {viewingActivity.barrio_compania ? ` (${viewingActivity.barrio_compania})` : ''}</p>
                            </div>
                            <div className="space-y-1 p-4 bg-muted/20 rounded-2xl border">
                                <p className="text-[8px] font-black text-muted-foreground uppercase flex items-center gap-1"><Navigation className="h-2.5 w-2.5" /> Coordenadas GPS</p>
                                <p className="text-xs font-black uppercase">{viewingActivity.gps || 'S/D'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1 p-4 bg-muted/20 rounded-2xl border">
                                <p className="text-[8px] font-black text-muted-foreground uppercase flex items-center gap-1"><User className="h-2.5 w-2.5" /> Responsable Partido</p>
                                <p className="text-xs font-black uppercase">{viewingActivity.nombre_completo}</p>
                            </div>
                            <div className="space-y-1 p-4 bg-muted/20 rounded-2xl border">
                                <p className="text-[8px] font-black text-muted-foreground uppercase">Cédula Solicitante</p>
                                <p className="text-xs font-black uppercase">{viewingActivity.cedula || 'S/D'}</p>
                            </div>
                            <div className="space-y-1 p-4 bg-muted/20 rounded-2xl border">
                                <p className="text-[8px] font-black text-muted-foreground uppercase flex items-center gap-1"><Phone className="h-2.5 w-2.5" /> Teléfono</p>
                                <p className="text-xs font-black uppercase">{viewingActivity.telefono || 'S/D'}</p>
                            </div>
                        </div>

                        <Separator className="border-dashed" />

                        {/* SECCIÓN DE PERSONAL ASIGNADO */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Users className="h-5 w-5 text-primary" />
                                <h3 className="font-black uppercase text-xs tracking-widest">Personal Operativo (Divulgadores)</h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {(viewingActivity.divulgadores || viewingActivity.asignados || []).map(p => (
                                    <div key={p.id} className="p-4 border-2 rounded-2xl flex items-center gap-3 bg-white shadow-sm">
                                        <div className="h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center">
                                            <User className="h-4 w-4 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase leading-none">{p.nombre}</p>
                                            <p className="text-[8px] font-bold text-muted-foreground uppercase mt-1">C.I. {p.cedula} | {p.vinculo}</p>
                                        </div>
                                    </div>
                                ))}
                                {(viewingActivity.divulgadores || viewingActivity.asignados || []).length === 0 && (
                                    <p className="text-xs font-bold text-destructive uppercase italic">Sin personal asignado para esta actividad.</p>
                                )}
                            </div>
                        </div>

                        {/* SECCIÓN DE RESPALDO DOCUMENTAL */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <ImageIcon className="h-5 w-5 text-primary" />
                                <h3 className="font-black uppercase text-xs tracking-widest">Respaldo Documental (Firma)</h3>
                            </div>
                            {viewingActivity.foto_firma ? (
                                <div 
                                    className="relative aspect-video w-full rounded-3xl overflow-hidden border-4 border-white shadow-xl bg-muted group cursor-pointer"
                                    onClick={() => viewingActivity.foto_firma && !viewingActivity.foto_firma.startsWith('data:application/pdf') && setFullViewerImage(viewingActivity.foto_firma)}
                                >
                                    {viewingActivity.foto_firma.startsWith('data:application/pdf') ? (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-white">
                                            <FileText className="h-16 w-16 text-primary opacity-20" />
                                            <p className="text-[10px] font-black uppercase mt-2">Documento PDF Guardado</p>
                                        </div>
                                    ) : (
                                        <Image src={viewingActivity.foto_firma} alt="Firma Solicitante" fill className="object-cover" />
                                    )}
                                    {!viewingActivity.foto_firma.startsWith('data:application/pdf') && (
                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <div className="bg-white/20 backdrop-blur-md p-4 rounded-full">
                                                <Maximize2 className="h-8 w-8 text-white" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="p-10 border-2 border-dashed rounded-3xl text-center opacity-30">
                                    <ImageIcon className="h-10 w-10 mx-auto mb-2" />
                                    <p className="text-[10px] font-black uppercase">Sin respaldo visual registrado</p>
                                </div>
                            )}
                        </div>

                        <Separator className="border-dashed" />

                        <div className="space-y-6">
                            <div className="flex items-center gap-3">
                                <Activity className="h-5 w-5 text-primary" />
                                <h3 className="font-black uppercase text-xs tracking-widest">Trazabilidad Logística</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-10">
                                {(() => {
                                    // Búsqueda segura de datos adicionales para la ficha
                                    return (
                                        <>
                                            <div className="p-5 rounded-2xl border-2 flex flex-col items-center text-center gap-2 bg-muted/10 border-transparent opacity-40">
                                                <div className="h-8 w-8 rounded-full flex items-center justify-center bg-muted text-muted-foreground">
                                                    <CheckCircle2 className="h-4 w-4" />
                                                </div>
                                                <p className="text-[9px] font-black uppercase">TRAZABILIDAD EN DISTRITO</p>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!assigningSolicitud} onOpenChange={(o) => !o && setAssigningSolicitud(null)}>
        <DialogContent className="max-w-2xl rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-black text-white p-6">
            <DialogTitle className="font-black uppercase text-sm flex items-center gap-2">
                <Users className="h-4 w-4" /> GESTIONAR DIVULGADORES - {assigningSolicitud?.solicitante_entidad?.toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-x-6">
            <div className="p-6 space-y-4 bg-white">
                <h3 className="font-bold uppercase text-xs text-muted-foreground">Personal Asignado</h3>
                <ScrollArea className="h-[350px] pr-2">
                    {(assigningSolicitud?.divulgadores || []).map(d => (
                        <div key={d.id} className="p-4 border-2 rounded-2xl flex justify-between items-center mb-2">
                            <div>
                                <p className="font-black text-xs uppercase">{d.nombre}</p>
                                <span className="text-[8px] font-bold text-muted-foreground uppercase">{d.vinculo}</span>
                            </div>
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleRemoveDivulgador(d.id)} title="Quitar Personal"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                    ))}
                </ScrollArea>
            </div>
            <div className="p-6 space-y-4 bg-white border-l">
                <h3 className="font-bold uppercase text-xs text-muted-foreground">Añadir Disponible</h3>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar..." value={divulSearch} onChange={e => setDivulSearch(e.target.value)} className="h-10 pl-10 font-bold border-2 rounded-xl" />
                </div>
                <ScrollArea className="h-[280px] pr-2">
                    {filteredDivul.map(d => (
                        <div key={d.id} className="p-4 border-2 rounded-2xl cursor-pointer hover:bg-black hover:text-white transition-all group mb-2" onClick={() => handleAssignDivulgador(d)} title="Asignar a esta actividad">
                            <p className="font-black text-xs uppercase">{d.nombre}</p>
                            <span className="text-[8px] font-bold opacity-60 uppercase">{d.vinculo}</span>
                        </div>
                    ))}
                </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!qrSolicitud} onOpenChange={(o) => !o && setQrSolicitud(null)}>
        <DialogContent className="max-w-md max-h-[95vh] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 flex flex-col items-center bg-white space-y-4">
                <div ref={qrContainerRef} className="flex flex-col items-center bg-white p-6 rounded-[2rem] w-full border border-muted/10">
                    {/* Logos Row */}
                    <div className="flex items-center justify-center gap-4 mb-6 w-full">
                        <img src="/logo.png" alt="Logo 1" width={32} height={32} className="object-contain" />
                        <img src="/logo1.png" alt="Logo 2" width={32} height={32} className="object-contain" />
                        <img src="/logo3.png" alt="Logo 3" width={32} height={32} className="object-contain" />
                    </div>

                    <div className="p-3 bg-white border-4 border-muted/20 rounded-[2.5rem] shadow-inner mb-6">
                        {qrSolicitud && (
                            <img 
                                src={qrImageUrl} 
                                alt="QR" 
                                width={180} 
                                height={180} 
                                className="rounded-[1.5rem]" 
                                crossOrigin="anonymous" 
                            />
                        )}
                    </div>
                    
                    <div className="text-center space-y-3 w-full">
                        <div className="space-y-1">
                            <p className="text-[7px] font-black text-muted-foreground uppercase tracking-widest">LOCAL Y DIRECCIÓN</p>
                            <p className="text-[10px] font-black uppercase text-primary leading-tight px-4">
                                {qrSolicitud?.lugar_local}
                                {qrSolicitud?.direccion_calle ? ` - ${qrSolicitud.direccion_calle}` : ''}
                            </p>
                        </div>

                        <div className="flex justify-center gap-6 pt-1">
                            <div className="space-y-0.5 text-center">
                                <p className="text-[7px] font-black text-muted-foreground uppercase tracking-widest">FECHA</p>
                                <p className="text-[10px] font-black text-primary">{formatDateToDDMMYYYY(qrSolicitud?.fecha)}</p>
                            </div>
                            <div className="space-y-0.5 text-center">
                                <p className="text-[7px] font-black text-muted-foreground uppercase tracking-widest">HORARIO</p>
                                <p className="text-[10px] font-black text-primary">{qrSolicitud?.hora_desde} A {qrSolicitud?.hora_hasta} HS</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="w-full grid grid-cols-1 gap-2">
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" className="h-12 rounded-xl font-black uppercase text-[8px] border-2 flex flex-col gap-1 items-center justify-center p-1" onClick={copyToClipboard} title="Copiar enlace de encuesta">
                            <Copy className={cn("h-3.5 w-3.5", copied ? "text-green-600" : "text-muted-foreground")} />
                            <span>COPIAR ENLACE</span>
                        </Button>
                        <Button variant="outline" className="h-12 rounded-xl font-black uppercase text-[8px] border-2 flex flex-col gap-1 items-center justify-center p-1" onClick={handlePrintQr} title="Descargar PDF para imprimir">
                            <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>IMPRIMIR QR</span>
                        </Button>
                    </div>
                    <Button variant="outline" className="h-12 rounded-xl font-black uppercase text-[8px] border-2 flex flex-col gap-1 items-center justify-center p-1" onClick={handleDownloadPng} title="Generar imagen PNG para WhatsApp">
                        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>GENERAR IMAGEN EN PNG</span>
                    </Button>
                </div>
                
                <Button className="w-full h-12 rounded-xl font-black uppercase text-[10px] bg-black text-white shadow-lg" onClick={() => setQrSolicitud(null)}>CERRAR VENTANA</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!suspendingSolicitud} onOpenChange={(o) => !o && setSuspendingSolicitud(null)}>
        <DialogContent className="max-w-md rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
            <DialogHeader className="bg-orange-600 text-white p-6">
                <DialogTitle className="font-black uppercase text-sm flex items-center gap-2">
                    <Ban className="h-4 w-4" /> SUSPENDER SOLICITUD
                </DialogTitle>
            </DialogHeader>
            <div className="p-8 space-y-6 bg-white">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Motivo de la Suspensión *</Label>
                    <Textarea 
                        placeholder="Especifique el motivo de la suspensión..." 
                        className="min-h-[100px] border-2 font-bold uppercase rounded-xl"
                        value={suspensionReason}
                        onChange={e => setSuspensionReason(e.target.value)}
                    />
                </div>
                <div className="flex gap-3 pt-2">
                    <Button variant="outline" className="flex-1 h-12 rounded-xl font-black uppercase text-[10px] border-2" onClick={() => setSuspendingSolicitud(null)}>CANCELAR</Button>
                    <Button className="flex-[2] h-12 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black uppercase text-[10px]" onClick={handleConfirmSuspend} disabled={!suspensionReason || isUpdating}>
                        {isUpdating ? <Loader2 className="animate-spin h-4 w-4" /> : "CONFIRMAR SUSPENSIÓN"}
                    </Button>
                </div>
            </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingSolicitud} onOpenChange={(o) => !o && setDeletingSolicitud(null)}>
        <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase">¿ELIMINAR DEFINITIVAMENTE?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-medium uppercase leading-relaxed text-muted-foreground pt-2">
                Esta acción es irreversible. Se borrará la solicitud seleccionada del sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-6">
            <AlertDialogCancel className="rounded-xl font-black uppercase text-[10px] border-2">CANCELAR</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90 text-white rounded-xl font-black uppercase text-[10px] px-8">
                SÍ, ELIMINAR REGISTRO
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingDistrict} onOpenChange={(o) => !o && setDeletingDistrict(null)}>
        <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase text-destructive">¿VACIAR DISTRITO COMPLETO?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-bold uppercase leading-relaxed text-muted-foreground pt-2">
                Usted va a eliminar todas las solicitudes del distrito de <span className="text-primary font-black">{deletingDistrict?.dist}</span>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-6">
            <AlertDialogCancel className="rounded-xl font-black uppercase text-[10px] border-2">CANCELAR</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteDistrict} className="bg-destructive hover:bg-destructive/90 text-white rounded-xl font-black uppercase text-[10px] px-8">
                SÍ, VACIAR DISTRITO
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImageViewerDialog 
        isOpen={!!fullViewerImage}
        onOpenChange={(o) => !o && setFullViewerImage(null)}
        image={fullViewerImage}
      />

      {/* Diálogo de Conclusión de Ciclo y Encuestas */}
      <Dialog open={!!concludingSolicitud} onOpenChange={(o) => !o && setConcludingSolicitud(null)}>
        <DialogContent className="max-w-md rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
            <DialogHeader className="bg-black text-white p-6">
                <DialogTitle className="font-black uppercase text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" /> CONCLUIR ACTIVIDAD
                </DialogTitle>
            </DialogHeader>
            <div className="p-8 space-y-6 bg-white">
                <div className="text-center space-y-2">
                    <h3 className="font-black uppercase text-base text-primary">¿SE REALIZARON ENCUESTAS?</h3>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase leading-tight px-4">
                        Indique si se recolectaron encuestas de satisfacción ciudadana durante esta actividad.
                    </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <Button 
                        variant="outline" 
                        className="h-20 rounded-2xl border-2 font-black uppercase text-xs flex flex-col gap-2 hover:bg-primary hover:text-white transition-all"
                        onClick={() => {
                            if (concludingSolicitud) {
                                router.push(`/encuesta-satisfaccion?solicitudId=${concludingSolicitud.id}`);
                            }
                        }}
                    >
                        <QrCode className="h-6 w-6" />
                        SÍ, CARGAR
                    </Button>
                    <Button 
                        className="h-20 rounded-2xl font-black uppercase text-xs flex flex-col gap-2 bg-black hover:bg-black/90 text-white"
                        onClick={() => concludingSolicitud && handleManualComplete(concludingSolicitud.id)}
                        disabled={isUpdating}
                    >
                        {isUpdating ? <Loader2 className="animate-spin h-6 w-6" /> : (
                            <>
                                <X className="h-6 w-6" />
                                NO HUBO
                            </>
                        )}
                    </Button>
                </div>

                <div className="pt-4 border-t border-dashed">
                    <p className="text-[8px] font-bold text-muted-foreground uppercase text-center italic">
                        Al seleccionar "NO", la actividad se registrará como culminada y se ocultará de la agenda.
                    </p>
                </div>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
