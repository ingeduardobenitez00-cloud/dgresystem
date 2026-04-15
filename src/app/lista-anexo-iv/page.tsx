
"use client";

import { useState, useMemo, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useFirebase, useCollectionOnce, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, doc, getDocs, orderBy } from 'firebase/firestore';
import { type AnexoIV } from '@/lib/data';
import { 
    Loader2, 
    Eye, 
    FileText, 
    Calendar, 
    Building2, 
    Landmark, 
    Search, 
    ImageIcon,
    Users,
    TableProperties,
    CheckCircle2,
    X,
    Maximize2,
    ChevronRight,
    MapPin,
    AlertTriangle,
    Plus
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateToDDMMYYYY, normalizeGeo } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Image from 'next/image';
import { ImageViewerDialog } from '@/components/image-viewer-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// --- SUB-COMPONENTES PARA JERARQUÍA ---

interface DistrictAnexoIVSectionProps {
    districtName: string;
    items: AnexoIV[];
    onView: (anexo: AnexoIV) => void;
}

function DistrictAnexoIVSection({ districtName, items, onView }: DistrictAnexoIVSectionProps) {
    const [visibleCount, setVisibleCount] = useState(10);
    const visibleItems = items.slice(0, visibleCount);

    return (
        <div className="space-y-4 mb-8 last:mb-0">
            <div className="flex items-center gap-3 px-2">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <h3 className="text-xs font-black uppercase tracking-widest text-[#1A1A1A]">
                    {districtName} 
                    <span className="ml-2 text-[10px] text-muted-foreground opacity-60">({items.length} INFORMES)</span>
                </h3>
            </div>
            
            <div className="grid grid-cols-1 gap-3 pl-4 border-l-2 border-primary/10 ml-3">
                {visibleItems.map((anexo) => {
                    const totalD = new Set(anexo.filas?.map(f => f.cedula || (f as any).divulgador_cedula)).size;
                    const totalP = anexo.filas?.reduce((acc, f) => acc + (f.cantidad_personas || 0), 0) || 0;

                    return (
                        <Card key={anexo.id} className="border-none shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden bg-white group">
                            <div className="flex flex-col md:flex-row items-center p-4 gap-4">
                                <div className="h-10 w-10 rounded-xl bg-primary/5 text-primary flex items-center justify-center shrink-0">
                                    <TableProperties className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex wrap gap-4 text-[9px] font-bold text-muted-foreground uppercase tracking-tight">
                                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDateToDDMMYYYY(anexo.semana_desde)} AL {formatDateToDDMMYYYY(anexo.semana_hasta)}</span>
                                        <span className="flex items-center gap-1 text-primary"><Users className="h-3 w-3" /> {totalD} FUNCIONARIOS</span>
                                        <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3 w-3" /> {totalP} CAPACITADOS</span>
                                    </div>
                                </div>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-10 px-4 rounded-xl border-2 font-black uppercase text-[10px] gap-2 hover:bg-primary hover:text-white transition-all shadow-sm"
                                    onClick={() => onView(anexo)}
                                >
                                    <Eye className="h-4 w-4" /> VER DETALLE
                                </Button>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {items.length > visibleCount && (
                <div className="pl-8 pt-2">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setVisibleCount(prev => prev + 10)}
                        className="font-black uppercase text-[9px] tracking-widest text-primary/60 hover:text-primary hover:bg-primary/5 rounded-full px-6"
                    >
                        <Plus className="h-3 w-3 mr-2" /> VER MÁS INFORMES EN {districtName}
                    </Button>
                </div>
            )}
        </div>
    );
}

interface DepartmentAnexoIVSectionProps {
    deptName: string;
    firestore: any;
    isAdmin: boolean;
    isOwner: boolean;
    onView: (anexo: AnexoIV) => void;
    datosData: any[];
    profile: any;
}

function DepartmentAnexoIVSection({ 
    deptName, 
    firestore, 
    onView, 
    datosData, 
    profile 
}: DepartmentAnexoIVSectionProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Consulta por departamento SOLO cuando se expande (SMART LOADING)
    const anexosQuery = useMemoFirebase(() => {
        if (!firestore || !isExpanded) return null;
        return query(
            collection(firestore, 'informes-semanales-anexo-iv'),
            where('departamento', '==', deptName)
        );
    }, [firestore, deptName, isExpanded]);

    const { data: rawAnexos, isLoading } = useCollectionOnce<AnexoIV>(anexosQuery);

    const anexos = useMemo(() => {
        if (!rawAnexos) return null;
        return [...rawAnexos].sort((a, b) => {
            const dateA = new Date(a.semana_desde).getTime();
            const dateB = new Date(b.semana_desde).getTime();
            return dateB - dateA;
        });
    }, [rawAnexos]);

    const groupedByDistrict = useMemo(() => {
        if (!anexos) return [];
        
        const dists = Array.from(new Set(anexos.map(a => a.distrito)));
        return dists
            .sort((a, b) => a.localeCompare(b))
            .map(dName => ({
                name: dName,
                items: anexos.filter(a => a.distrito === dName)
            }));
    }, [anexos]);

    return (
        <AccordionItem value={deptName} className="border-none mb-4">
            <AccordionTrigger 
                onClick={() => setIsExpanded(true)}
                className="hover:no-underline p-0"
            >
                <Card className="w-full border-none shadow-sm bg-white rounded-3xl overflow-hidden group-data-[state=open]:shadow-xl transition-all duration-500">
                    <div className="flex items-center p-6 gap-6">
                        <div className="h-16 w-16 rounded-2xl bg-[#1A1A1A] flex items-center justify-center shrink-0 shadow-lg group-data-[state=open]:bg-primary transition-colors">
                            <Landmark className="h-8 w-8 text-white" />
                        </div>
                        <div className="flex-1 text-left">
                            <h2 className="text-2xl font-black uppercase text-[#1A1A1A] tracking-tight">{deptName}</h2>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1 flex items-center gap-2">
                                <MapPin className="h-3 w-3 text-primary opacity-50" />
                                {groupedByDistrict.length > 0 ? `${groupedByDistrict.length} DISTRITOS CON INFORMES` : 'CLIC PARA CARGAR INFORMES'}
                            </p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-muted/30 flex items-center justify-center group-data-[state=open]:rotate-180 transition-transform">
                            <ChevronRight className="h-5 w-5" />
                        </div>
                    </div>
                </Card>
            </AccordionTrigger>
            <AccordionContent className="p-4 md:p-8 bg-muted/10 rounded-b-[2.5rem] mt-[-1rem] pt-12 space-y-6">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center p-20 gap-4">
                        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#1A1A1A]/40">Cargando informes de {deptName}...</p>
                    </div>
                ) : groupedByDistrict.length === 0 ? (
                    <Card className="p-20 text-center border-dashed bg-white/50 rounded-[2.5rem] border-2">
                        <div className="flex flex-col items-center justify-center opacity-20">
                            <FileText className="h-16 w-16 mb-4" />
                            <p className="font-black uppercase tracking-widest text-xs italic">No hay informes registrados en {deptName}</p>
                        </div>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {groupedByDistrict.map(dist => (
                            <DistrictAnexoIVSection 
                                key={dist.name}
                                districtName={dist.name}
                                items={dist.items}
                                onView={onView}
                            />
                        ))}
                    </div>
                )}
            </AccordionContent>
        </AccordionItem>
    );
}

// --- PÁGINA PRINCIPAL ---

export default function ListaAnexoIVPage() {
    const { user, isUserLoading } = useUser();
    const { firestore } = useFirebase();
    const [searchTerm, setSearchTerm] = useState('');
    const [viewingAnexo, setViewingAnexo] = useState<AnexoIV | null>(null);
    const [fullViewerImage, setFullViewerImage] = useState<string | null>(null);

    const profile = user?.profile;
    const isAdmin = profile?.role === 'admin' || profile?.role === 'director' || !!profile?.permissions?.includes('admin_filter');
    const isOwner = user?.isOwner || false;

    // Solo cargamos la estructura de departamentos/distritos (datos)
    const datosQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'datos'), orderBy('departamento', 'asc'));
    }, [firestore]);

    const { data: datosData, isLoading: isDatosLoading } = useCollectionOnce<any>(datosQuery);

    const filterableDepts = useMemo(() => {
        if (!datosData) return [];
        const depts = new Set<string>();
        datosData.forEach((d: any) => depts.add(d.departamento));
        return Array.from(depts).sort();
    }, [datosData]);

    const filteredDepts = useMemo(() => {
        let depts = filterableDepts;
        const term = searchTerm.toLowerCase().trim();

        // Filtro jurisdiccional
        if (!isAdmin && !isOwner && profile?.departamento) {
            depts = depts.filter(d => normalizeGeo(d) === normalizeGeo(profile.departamento || ''));
        }

        // Filtro de búsqueda
        if (term) {
            depts = depts.filter(d => d.toLowerCase().includes(term));
        }

        return depts;
    }, [filterableDepts, profile, searchTerm, isAdmin, isOwner]);

    if (isUserLoading || isDatosLoading) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-[#F8F9FA] gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="font-black uppercase text-[10px] tracking-[0.3em] text-primary/40">Sincronizando Sistema Jurisdiccional...</p>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
            <Header title="Listado de Anexo IV" />
            
            <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-4">
                    <div className="space-y-2">
                        <h1 className="text-5xl font-black tracking-tighter text-[#1A1A1A] uppercase leading-none italic">
                            ANEXO IV - <span className="text-primary">INFORMES SEMANALES</span>
                        </h1>
                        <p className="text-muted-foreground text-[10px] font-bold uppercase flex items-center gap-2 tracking-[0.2em] opacity-60">
                            <TableProperties className="h-4 w-4" /> Historial de consolidados semanales enviados
                        </p>
                    </div>
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary opacity-40" />
                        <Input 
                            placeholder="BUSCAR DEPARTAMENTO..." 
                            className="h-14 pl-12 font-black border-none rounded-2xl bg-white shadow-xl focus-visible:ring-primary uppercase text-xs tracking-widest transition-all focus-visible:scale-[1.02]"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {filteredDepts.length === 0 ? (
                    <Card className="p-20 text-center border-none shadow-sm bg-white rounded-[2.5rem]">
                        <div className="flex flex-col items-center justify-center opacity-20">
                            <AlertTriangle className="h-20 w-20 mb-4" />
                            <p className="font-black uppercase tracking-widest text-sm italic">No se encontraron departamentos registrados</p>
                        </div>
                    </Card>
                ) : (
                    <Accordion type="multiple" className="space-y-6">
                        {filteredDepts.map((deptName) => (
                            <DepartmentAnexoIVSection 
                                key={deptName}
                                deptName={deptName}
                                firestore={firestore}
                                isAdmin={isAdmin}
                                isOwner={isOwner}
                                onView={setViewingAnexo}
                                datosData={datosData || []}
                                profile={profile}
                            />
                        ))}
                    </Accordion>
                )}

                <div className="text-center pb-10">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40 italic">
                        * Sistema de Consolidación Semanal - Protocolo de Seguridad CIDEE 2026.
                    </p>
                </div>
            </main>

            {/* DIÁLOGO DE DETALLE (MANTENEMOS EL EXISTENTE PERO POLICHADO) */}
            <Dialog open={!!viewingAnexo} onOpenChange={(o) => !o && setViewingAnexo(null)}>
                <DialogContent className="max-w-5xl h-[95vh] flex flex-col p-0 border-none shadow-2xl overflow-hidden rounded-[2.5rem] bg-black">
                    {viewingAnexo && (
                    <div className="flex flex-col h-full bg-[#F8F9FA]">
                        <div className="bg-black text-white p-8 md:p-10 shrink-0 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[100px] -mr-32 -mt-32" />
                            <DialogHeader className="relative z-10">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-6">
                                        <div className="h-16 w-16 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 backdrop-blur-sm">
                                            <TableProperties className="h-8 w-8" />
                                        </div>
                                        <div>
                                            <DialogTitle className="text-3xl font-black uppercase leading-none tracking-tighter italic">CONSOLIDADO SEMANAL</DialogTitle>
                                            <DialogDescription className="text-white/60 font-black uppercase text-[10px] mt-3 tracking-widest flex items-center gap-3">
                                                <Badge variant="outline" className="text-white border-white/20 font-black">ANEXO IV</Badge>
                                                {viewingAnexo.distrito} | {viewingAnexo.departamento}
                                            </DialogDescription>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => setViewingAnexo(null)} className="text-white/40 hover:text-white h-12 w-12 rounded-full hover:bg-white/10 transition-colors"><X className="h-8 w-8" /></Button>
                                </div>
                            </DialogHeader>
                        </div>

                        <ScrollArea className="flex-1 p-6 md:p-10">
                            <div className="space-y-12">
                                {/* INFO CARDS */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <div className="p-6 bg-white rounded-3xl border shadow-sm space-y-1">
                                         <p className="text-[10px] font-black text-muted-foreground uppercase flex items-center gap-2"><Calendar className="h-4 w-4" /> Periodo Cubierto</p>
                                         <p className="text-lg font-black uppercase text-primary tracking-tight">
                                             {formatDateToDDMMYYYY(viewingAnexo.semana_desde)} <span className="text-muted-foreground opacity-30 mx-2">AL</span> {formatDateToDDMMYYYY(viewingAnexo.semana_hasta)}
                                         </p>
                                     </div>
                                     <div className="p-6 bg-white rounded-3xl border shadow-sm space-y-1">
                                         <p className="text-[10px] font-black text-muted-foreground uppercase flex items-center gap-2"><TableProperties className="h-4 w-4" /> ID de Control</p>
                                         <p className="text-lg font-black uppercase text-primary tracking-tight">#{viewingAnexo.id}</p>
                                     </div>
                                </div>

                                <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
                                    <div className="bg-black px-8 py-4 border-b">
                                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Detalle de Producción Semanal</p>
                                    </div>
                                    <Table>
                                        <TableHeader className="bg-muted/30">
                                            <TableRow className="border-none">
                                                <TableHead className="text-[9px] font-black uppercase px-8">Lugar</TableHead>
                                                <TableHead className="text-[9px] font-black uppercase">Fecha</TableHead>
                                                <TableHead className="text-[9px] font-black uppercase">Horario</TableHead>
                                                <TableHead className="text-[9px] font-black uppercase">Funcionario</TableHead>
                                                <TableHead className="text-[9px] font-black uppercase">Vínculo</TableHead>
                                                <TableHead className="text-right text-[9px] font-black uppercase px-8">Cantidad</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {viewingAnexo.filas?.map((f, idx) => (
                                                <TableRow key={idx} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                                                    <TableCell className="px-8 py-5 font-black text-[11px] uppercase text-primary leading-tight">{f.lugar}</TableCell>
                                                    <TableCell className="text-[10px] font-bold uppercase text-muted-foreground">{formatDateToDDMMYYYY(f.fecha)}</TableCell>
                                                    <TableCell className="text-[10px] font-black text-muted-foreground uppercase">{f.hora_desde} A {f.hora_hasta} HS</TableCell>
                                                    <TableCell className="font-black text-[11px] uppercase text-primary leading-none">
                                                        {f.nombre_divulgador || (f as any).divulgador_nombre}
                                                        <br />
                                                        <span className="text-[8px] font-bold text-muted-foreground opacity-60">C.I. {f.cedula || (f as any).divulgador_cedula}</span>
                                                    </TableCell>
                                                    <TableCell><Badge variant="outline" className="text-[8px] font-black uppercase bg-muted/20 border-primary/10 rounded-full">{f.vinculo || (f as any).divulgador_vinculo}</Badge></TableCell>
                                                    <TableCell className="text-right px-8 font-black text-base text-primary">
                                                        {f.cantidad_personas}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </Card>

                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 px-4">
                                        <ImageIcon className="h-6 w-6 text-primary" />
                                        <h3 className="font-black uppercase text-sm tracking-widest italic">Anexo III - Respaldo Documental Firmado</h3>
                                    </div>
                                    {viewingAnexo.foto_respaldo_documental ? (
                                        <div className="relative aspect-[4/3] w-full rounded-[3rem] overflow-hidden border-[12px] border-white shadow-2xl bg-muted group">
                                            {viewingAnexo.foto_respaldo_documental.startsWith('data:application/pdf') ? (
                                                <div className="w-full h-full flex flex-col items-center justify-center bg-white">
                                                    <FileText className="h-24 w-24 text-primary opacity-20 mb-6" />
                                                    <p className="text-lg font-black uppercase text-primary italic">Documento PDF Oficial</p>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase mt-2 mb-8 tracking-widest">Registrado electrónicamente</p>
                                                    <Button variant="outline" className="h-14 px-10 font-black uppercase text-xs border-4 rounded-2xl hover:bg-primary hover:text-white transition-all shadow-xl" asChild>
                                                        <a href={viewingAnexo.foto_respaldo_documental} download={`AnexoIV-${viewingAnexo.distrito}-Semana.pdf`}>DESCARGAR ARCHIVO FIRMADO</a>
                                                    </Button>
                                                </div>
                                            ) : (
                                                <>
                                                    <Image 
                                                        src={viewingAnexo.foto_respaldo_documental} 
                                                        alt="Respaldo" 
                                                        fill 
                                                        className="object-cover cursor-pointer transition-transform duration-700 group-hover:scale-105" 
                                                        onClick={() => setFullViewerImage(viewingAnexo.foto_respaldo_documental!)}
                                                    />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none duration-500 backdrop-blur-[2px]">
                                                        <div className="bg-white text-black p-6 rounded-full shadow-2xl scale-50 group-hover:scale-100 transition-transform duration-500">
                                                            <Maximize2 className="h-10 w-10" />
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-32 text-center border-4 border-dashed rounded-[3rem] opacity-20 border-black/10">
                                            <ImageIcon className="h-20 w-20 mx-auto mb-6" />
                                            <p className="font-black uppercase text-sm tracking-[0.2em] italic">Sin respaldo visual registrado</p>
                                        </div>
                                    )}
                                </div>
                                <div className="h-10" />
                            </div>
                        </ScrollArea>

                        <div className="p-8 bg-white border-t flex justify-end gap-4 shadow-[0_-20px_40px_rgba(0,0,0,0.05)]">
                            <Button onClick={() => setViewingAnexo(null)} className="font-black uppercase text-xs h-14 px-12 shadow-[0_10px_30px_rgba(0,0,0,0.1)] bg-black hover:bg-black/90 text-white rounded-2xl tracking-widest">Cerrar Visualización</Button>
                        </div>
                    </div>
                    )}
                </DialogContent>
            </Dialog>

            <ImageViewerDialog 
                isOpen={!!fullViewerImage}
                onOpenChange={(o) => !o && setFullViewerImage(null)}
                image={fullViewerImage}
            />
        </div>
    );
}

