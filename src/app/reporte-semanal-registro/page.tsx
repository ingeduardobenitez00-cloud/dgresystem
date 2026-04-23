
"use client";

import { useMemo, useState } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useUser, useFirebase, useCollectionOnce, useMemoFirebase, useDocOnce } from '@/firebase';
import { collection, query, orderBy, where, doc, writeBatch, addDoc } from 'firebase/firestore';
import { type InformeSemanalRegistro, type Dato } from '@/lib/data';
import { 
    Loader2, 
    ClipboardCheck, 
    Landmark, 
    Building2, 
    Search, 
    Calendar, 
    CheckCircle2, 
    AlertCircle, 
    ChevronRight, 
    Users, 
    FileText,
    History,
    Archive
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { formatDateToDDMMYYYY, cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ReporteSemanalRegistroPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isArchiving, setIsArchiving] = useState(false);

  const profile = user?.profile;
  const isAdmin = !!user?.isAdmin;

  // CARGAR CONFIGURACIÓN GLOBAL (FECHAS)
  const configRef = useMemoFirebase(() => firestore ? doc(firestore, 'config', 'reporte_semanal') : null, [firestore]);
  const { data: configData } = useDocOnce<any>(configRef);

  // Cargar geografía completa
  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollectionOnce<Dato>(datosQuery);

  // Cargar todos los informes operativos activos (no archivados)
  const informesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
        collection(firestore, 'informes-semanales-registro'), 
        where('archivado', '!=', true),
        orderBy('archivado'),
        orderBy('fecha_creacion', 'desc')
    );
  }, [firestore]);

  const { data: informes, isLoading: isLoadingInformes } = useCollectionOnce<InformeSemanalRegistro>(informesQuery);

  // Agrupación y Procesamiento de Cumplimiento (EXCLUYENDO SEDE CENTRAL)
  const hierarchy = useMemo(() => {
    if (!datosData) return [];

    const term = searchTerm.toLowerCase().trim();
    const depts: Record<string, { name: string, districts: Record<string, { name: string, reports: InformeSemanalRegistro[] }> }> = {};

    // Inicializar estructura desde datos oficiales
    datosData.forEach(d => {
      // FILTRO: No contar registros de Sede Central para este reporte operativo
      if (d.departamento === 'SEDE CENTRAL') return;

      if (!depts[d.departamento]) depts[d.departamento] = { name: d.departamento, districts: {} };
      if (!depts[d.departamento].districts[d.distrito]) {
        depts[d.departamento].districts[d.distrito] = { name: d.distrito, reports: [] };
      }
    });

    // Asignar informes a sus distritos
    informes?.forEach(inf => {
      if (depts[inf.departamento]?.districts[inf.distrito]) {
        depts[inf.departamento].districts[inf.distrito].reports.push(inf);
      }
    });

    // Convertir a array y filtrar por búsqueda
    return Object.values(depts)
      .map(dept => ({
        ...dept,
        districts: Object.values(dept.districts)
          .filter(dist => 
            dist.name.toLowerCase().includes(term) || 
            dept.name.toLowerCase().includes(term)
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      }))
      .filter(dept => dept.districts.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [datosData, informes, searchTerm]);

  const totalDistritos = useMemo(() => {
    if (!datosData) return 0;
    return datosData.filter(d => d.departamento !== 'SEDE CENTRAL').length;
  }, [datosData]);

  const totalCumplidos = useMemo(() => {
    if (!datosData || !informes) return 0;
    const fulfilled = new Set();
    informes.forEach(inf => {
        if (inf.departamento !== 'SEDE CENTRAL') {
            fulfilled.add(`${inf.departamento}-${inf.distrito}`);
        }
    });
    return fulfilled.size;
  }, [datosData, informes]);

  const handleArchiveWeek = async () => {
    if (!firestore || !configData || !informes || informes.length === 0) return;
    
    setIsArchiving(true);
    const batch = writeBatch(firestore);
    const archiveId = `ARCH-${Date.now()}`;
    
    try {
        // 1. Marcar informes como archivados
        informes.forEach(inf => {
            const docRef = doc(firestore, 'informes-semanales-registro', inf.id);
            batch.update(docRef, { 
                archivado: true, 
                id_archivo: archiveId 
            });
        });

        // 2. Crear registro de archivo
        const archiveRef = doc(collection(firestore, 'archivos-semanales-registro'));
        batch.set(archiveRef, {
            id: archiveId,
            fecha_desde: configData.fecha_desde,
            fecha_hasta: configData.fecha_hasta,
            total_informes: informes.length,
            usuario_id: user?.uid,
            usuario_nombre: profile?.username || user?.email,
            fecha_archivado: new Date().toISOString()
        });

        await batch.commit();
        toast({ title: "Semana Archivada", description: `Se han procesado ${informes.length} informes con éxito.` });
    } catch (e) {
        toast({ variant: 'destructive', title: "Error al archivar", description: "Hubo un problema al procesar el lote." });
    } finally {
        setIsArchiving(false);
    }
  };

  if (isUserLoading || isLoadingDatos || isLoadingInformes) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Monitor de Cumplimiento Operativo" />
      
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-primary uppercase leading-none">Monitor de Informes</h1>
                <p className="text-muted-foreground text-[10px] font-bold uppercase flex items-center gap-2 mt-2 tracking-widest">
                    <History className="h-3.5 w-3.5" /> Seguimiento de cumplimiento semanal por Registro Electoral (Regional)
                </p>
            </div>
            <div className="flex items-center gap-4">
                {isAdmin && configData && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="default" className="bg-black hover:bg-black/90 font-black uppercase text-[10px] gap-2 h-11 px-6 shadow-xl rounded-xl" disabled={informes?.length === 0 || isArchiving}>
                                {isArchiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                                ARCHIVAR SEMANA ACTUAL
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="font-black uppercase tracking-tight">¿CERRAR Y ARCHIVAR SEMANA?</AlertDialogTitle>
                                <AlertDialogDescription className="text-xs font-medium uppercase leading-relaxed text-muted-foreground py-4">
                                    Esta acción marcará los <span className="font-black text-primary">{informes?.length} informes</span> actuales como archivados para el periodo <span className="font-black text-primary">{formatDateToDDMMYYYY(configData.fecha_desde)} al {formatDateToDDMMYYYY(configData.fecha_hasta)}</span>. 
                                    <br/><br/>
                                    Una vez archivados, los informes podrán ser consultados y exportados a Excel desde el módulo de "Archivo de Informes".
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl font-black uppercase text-[10px]">CANCELAR</AlertDialogCancel>
                                <AlertDialogAction onClick={handleArchiveWeek} className="bg-primary hover:bg-primary/90 text-white rounded-xl font-black uppercase text-[10px] px-8">
                                    CONFIRMAR ARCHIVADO
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                    <Input 
                        placeholder="Buscar departamento u oficina..." 
                        className="h-11 pl-10 font-bold border-2 rounded-2xl bg-white shadow-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
        </div>

        {/* INDICADORES DE CUMPLIMIENTO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-white border-2 p-6 rounded-3xl flex items-center gap-6 shadow-sm">
                <div className="h-14 w-14 rounded-full bg-primary/5 flex items-center justify-center">
                    <Building2 className="h-7 w-7 text-primary" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-1">REGISTROS REGIONALES</p>
                    <p className="text-3xl font-black leading-none">{totalDistritos}</p>
                </div>
            </Card>
            <Card className="bg-white border-2 p-6 rounded-3xl flex items-center gap-6 shadow-sm border-green-100">
                <div className="h-14 w-14 rounded-full bg-green-50 flex items-center justify-center">
                    <CheckCircle2 className="h-7 w-7 text-green-600" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase text-green-600 tracking-widest leading-none mb-1">CUMPLIDOS</p>
                    <p className="text-3xl font-black leading-none text-green-600">{totalCumplidos}</p>
                </div>
            </Card>
            <Card className="bg-white border-2 p-6 rounded-3xl flex items-center gap-6 shadow-sm border-destructive/10">
                <div className="h-14 w-14 rounded-full bg-destructive/5 flex items-center justify-center">
                    <AlertCircle className="h-7 w-7 text-destructive" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase text-destructive tracking-widest leading-none mb-1">PENDIENTES</p>
                    <p className="text-3xl font-black leading-none text-destructive">{totalDistritos - totalCumplidos}</p>
                </div>
            </Card>
        </div>

        {hierarchy.length === 0 ? (
            <Card className="p-20 text-center border-dashed bg-white rounded-[2.5rem]">
                <div className="flex flex-col items-center justify-center opacity-20">
                    <AlertCircle className="h-20 w-20 mb-4" />
                    <p className="font-black uppercase tracking-widest text-sm">No se encontraron jurisdicciones regionales</p>
                </div>
            </Card>
        ) : (
            <Accordion type="multiple" className="space-y-6">
                {hierarchy.map((dept) => (
                    <AccordionItem key={dept.name} value={dept.name} className="border-none bg-white rounded-[2rem] shadow-sm overflow-hidden">
                        <AccordionTrigger className="hover:no-underline px-8 py-6 bg-white group">
                            <div className="flex items-center gap-4 text-left">
                                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                    <Landmark className="h-6 w-6" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black uppercase tracking-tight text-[#1A1A1A]">{dept.name}</h2>
                                    <div className="flex items-center gap-3 mt-1">
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                            {dept.districts.length} DISTRITOS EN JURISDICCIÓN
                                        </p>
                                        <Badge variant="secondary" className="bg-green-100 text-green-700 text-[8px] font-black border-none">
                                            {dept.districts.filter(d => d.reports.length > 0).length} CUMPLIDOS
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-8 pb-8 pt-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                                {dept.districts.map((dist) => {
                                    const isCumplido = dist.reports.length > 0;
                                    
                                    return (
                                        <Accordion key={dist.name} type="single" collapsible className="w-full">
                                            <AccordionItem value="item-1" className="border-2 rounded-2xl overflow-hidden transition-all hover:border-primary/20">
                                                <AccordionTrigger className="hover:no-underline px-6 py-4 bg-muted/5 group">
                                                    <div className="flex items-center justify-between w-full pr-4">
                                                        <div className="flex items-center gap-3">
                                                            <Building2 className={cn("h-5 w-5", isCumplido ? "text-primary" : "text-muted-foreground/40")} />
                                                            <span className="font-black uppercase text-xs tracking-tight text-foreground/80">{dist.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {isCumplido ? (
                                                                <Badge className="bg-green-600 text-white text-[8px] font-black uppercase shadow-lg">CUMPLIDO</Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="text-destructive border-destructive/20 text-[8px] font-black uppercase">PENDIENTE</Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="p-6 bg-white border-t border-dashed">
                                                    {!isCumplido ? (
                                                        <div className="py-8 text-center space-y-2">
                                                            <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground opacity-20" />
                                                            <p className="text-[10px] font-bold text-muted-foreground uppercase">Sin registros operativos presentados</p>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-4">
                                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-4">HISTORIAL DE INFORMES PRESENTADOS (SEMANA ACTUAL)</p>
                                                            {dist.reports.map((inf) => (
                                                                <Card key={inf.id} className="border shadow-sm rounded-xl overflow-hidden">
                                                                    <div className="bg-muted/30 p-3 border-b flex justify-between items-center">
                                                                        <div className="flex items-center gap-2">
                                                                            <Calendar className="h-3.5 w-3.5 text-primary" />
                                                                            <span className="text-[10px] font-black">{formatDateToDDMMYYYY(inf.fecha_desde)} al {formatDateToDDMMYYYY(inf.fecha_hasta)}</span>
                                                                        </div>
                                                                        <Badge variant="outline" className="text-[8px] font-black bg-white border-primary/10">ID: {inf.id.substring(0,5)}</Badge>
                                                                    </div>
                                                                    <CardContent className="p-4">
                                                                        <div className="grid grid-cols-2 gap-4">
                                                                            <div className="space-y-1">
                                                                                <p className="text-[8px] font-black text-muted-foreground uppercase">Inscripciones</p>
                                                                                <p className="font-black text-xs text-primary">{inf.inscripciones_1ra_vez} <span className="text-[9px] opacity-40">1RA VEZ</span></p>
                                                                            </div>
                                                                            <div className="space-y-1">
                                                                                <p className="text-[8px] font-black text-muted-foreground uppercase">Traslados</p>
                                                                                <p className="font-black text-xs text-primary">{inf.cambio_local + inf.cambio_distrito} <span className="text-[9px] opacity-40">TOTAL</span></p>
                                                                            </div>
                                                                            <div className="col-span-2 pt-2 border-t border-dashed mt-2">
                                                                                <div className="flex items-center gap-2 text-green-600">
                                                                                    <Users className="h-3 w-3" />
                                                                                    <span className="text-[9px] font-black uppercase">Organizaciones asistidas: {inf.organizaciones_asistidas?.length || 0}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </CardContent>
                                                                </Card>
                                                            ))}
                                                        </div>
                                                    )}
                                                </AccordionContent>
                                            </AccordionItem>
                                        </Accordion>
                                    );
                                })}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        )}

        <div className="text-center pb-10">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40 italic">
                * Los registros de la Sede Central han sido excluidos de este monitor operativo regional.
            </p>
        </div>
      </main>
    </div>
  );
}
