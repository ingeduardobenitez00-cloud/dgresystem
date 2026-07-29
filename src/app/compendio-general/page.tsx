"use client";

import { useState, useMemo, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFirebase, useCollectionOnce } from '@/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { ref, getBlob, getDownloadURL } from 'firebase/storage';
import { type Dato } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  FileArchive, 
  Download, 
  Search, 
  FileText,
  Image as ImageIconLucide,
  ChevronRight, 
  ClipboardCheck, 
  Users, 
  X
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn, formatDateToDDMMYYYY } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

import { HistoricalToggle } from "@/components/historical-toggle";
import { useUser } from "@/firebase";

export default function CompendioGeneralPage() {
    const { firestore, storage } = useFirebase();
    const { toast } = useToast();
    const { user } = useUser();

    const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
    const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
    const [includePhotos, setIncludePhotos] = useState(true);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState(0);
    const [version] = useState("v1.6.0");
    const [activities, setActivities] = useState<any[]>([]);
    
    const [logo1, setLogo1] = useState<string | null>(null);
    const [logo2, setLogo2] = useState<string | null>(null);
    const [selectedActivity, setSelectedActivity] = useState<any | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isHistorical, setIsHistorical] = useState(false);

    const { data: datosData } = useCollectionOnce<Dato>(firestore ? collection(firestore, 'datos') : null);

    const departments = useMemo(() => {
        if (!datosData) return [];
        return [...new Set(datosData.map(d => d.departamento))].sort();
    }, [datosData]);

    const districts = useMemo(() => {
        if (!datosData || !selectedDepartment) return [];
        return datosData
            .filter(d => d.departamento === selectedDepartment)
            .map(d => d.distrito)
            .sort();
    }, [datosData, selectedDepartment]);

    useEffect(() => {
        const fetchLogos = async () => {
            try {
                // Cambiamos a rutas locales para evitar CORS y asegurar disponibilidad
                const [r1, r2] = await Promise.all([
                    fetch('/logo1.png'),
                    fetch('/logo.png')
                ]);
                const [b1, b2] = await Promise.all([r1.blob(), r2.blob()]);
                const reader1 = new FileReader();
                reader1.onloadend = () => setLogo1(reader1.result as string);
                reader1.readAsDataURL(b1);
                const reader2 = new FileReader();
                reader2.onloadend = () => setLogo2(reader2.result as string);
                reader2.readAsDataURL(b2);
            } catch (e) { 
                console.error("Logo load error", e); 
                // Fallback: intentar cargar como imágenes directas si el fetch falla
                setLogo1('/logo1.png');
                setLogo2('/logo.png');
            }
        };
        fetchLogos();
    }, []);

    const SafeThumbnail = ({ url, className }: { url: string, className?: string }) => {
        const { storage } = useFirebase();
        const [src, setSrc] = useState<string | null>(null);
        const [isPdf, setIsPdf] = useState(false);
        const [loading, setLoading] = useState(true);

        useEffect(() => {
            if (!url) { setLoading(false); return; }
            const uL = url.toLowerCase();
            const isP = uL.includes('.pdf') || uL.includes('type=pdf') || uL.includes('/o/pdf%');
            if (isP) { setIsPdf(true); setLoading(false); return; }

            const load = async () => {
                try {
                    if (url.includes('firebasestorage.googleapis.com') && storage) {
                        const sRef = ref(storage, url);
                        setSrc(await getDownloadURL(sRef));
                    } else setSrc(url);
                } catch (e) { setSrc(url); } finally { setLoading(false); }
            };
            load();
        }, [url, storage]);

        if (loading) return <div className={cn("bg-neutral-100 animate-pulse", className)} />;
        if (isPdf) return <div className={cn("bg-red-50 flex items-center justify-center text-red-500", className)}><FileText className="h-6 w-6" /></div>;
        return <div className={cn("bg-neutral-50 overflow-hidden", className)}>{src && <img src={src} className="h-full w-full object-cover" onError={() => setIsPdf(true)} />}</div>;
    };

    const fetchActivities = async () => {
        if (!firestore || !selectedDepartment || !selectedDistrict) return;
        setIsLoadingData(true);
        try {
            const suffix = isHistorical ? '_internas_2026' : '';
            const q = query(collection(firestore, `solicitudes-capacitacion${suffix}`), where('departamento', '==', selectedDepartment), where('distrito', '==', selectedDistrict));
            const snap = await getDocs(q);
            const enriched = await Promise.all(snap.docs.map(async (d) => {
                const act = { id: d.id, ...d.data() } as any;
                const [mov, inf, enc, anx] = await Promise.all([
                    getDocs(query(collection(firestore, `movimientos-maquinas${suffix}`), where('solicitud_id', '==', d.id))),
                    getDocs(query(collection(firestore, `informes-divulgador${suffix}`), where('solicitud_id', '==', d.id))),
                    getDocs(query(collection(firestore, `encuestas-satisfaccion${suffix}`), where('solicitud_id', '==', d.id))),
                    act.anexo_id ? getDoc(doc(firestore, 'anexo-i', act.anexo_id)) : null
                ]);
                return {
                    ...act,
                    movimiento: !mov.empty ? mov.docs[0].data() : null,
                    informes: inf.docs.map(idx => idx.data()),
                    encuestasCount: enc.size,
                    anexo: anx?.exists() ? anx.data() : null
                };
            }));
            setActivities(enriched.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')));
        } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
        finally { setIsLoadingData(false); }
    };

    // Caché de imágenes para evitar descargas redundantes (logos, firmas, etc.)
    const imageCache = useMemo(() => new Map<string, string>(), []);

    const loadImageAsBase64 = async (url: string): Promise<string | null> => {
        if (!url) return null;
        if (imageCache.has(url)) return imageCache.get(url)!;
        
        try {
            let blob;
            // Prioridad 1: Usar Firebase Storage SDK (más robusto para auth)
            if (url.includes('firebasestorage.googleapis.com') && storage) {
                try {
                    const sRef = ref(storage, url);
                    blob = await getBlob(sRef);
                } catch (storageErr) {
                    console.warn("Storage SDK failed, falling back to fetch", url);
                }
            }
            
            // Prioridad 2: Fetch directo si falla el SDK o no es de Firebase
            if (!blob) {
                const response = await fetch(url, { mode: 'cors' });
                if (!response.ok) throw new Error("Fetch failed");
                blob = await response.blob();
            }

            const base64 = await new Promise<string>((res, rej) => {
                const r = new FileReader(); 
                r.onloadend = () => res(r.result as string); 
                r.onerror = rej;
                r.readAsDataURL(blob);
            });
            imageCache.set(url, base64);
            return base64;
        } catch (e) { 
            console.warn("Turbo: Error crítico al cargar imagen", url);
            return null; 
        }
    };

    const getActivityEvidence = (act: any) => {
        if (!act) return [];
        
        const evidence: {url: string, label: string}[] = [];

        // 1. Documentos Primarios
        if (act.anexo?.foto_respaldo) evidence.push({ url: act.anexo.foto_respaldo, label: 'SOLICITUD FORMAL' });
        if (act.foto_firma) evidence.push({ url: act.foto_firma, label: 'FIRMA DE RESPONSABLE' });

        // 2. Movimientos de Equipo
        if (act.movimiento) {
            const salida = Array.isArray(act.movimiento.foto_salida) ? act.movimiento.foto_salida : [act.movimiento.foto_salida];
            salida.forEach(u => u && evidence.push({ url: u, label: 'ENTREGA DE EQUIPO' }));
            
            const devolucion = Array.isArray(act.movimiento.foto_devolucion) ? act.movimiento.foto_devolucion : [act.movimiento.foto_devolucion];
            devolucion.forEach(u => u && evidence.push({ url: u, label: 'DEVOLUCIÓN DE EQUIPO' }));
        }

        // 3. Informes (Documentación)
        if (act.informes) {
            act.informes.forEach((inf: any) => {
                if (inf.foto_respaldo_documental) evidence.push({ url: inf.foto_respaldo_documental, label: 'INFORME DE DIVULGACIÓN' });
            });
        }

        // 4. Evidencias de Campo (Al final)
        if (act.informes) {
            act.informes.forEach((inf: any) => {
                const fotos = [...(inf.fotos || []), ...(inf.foto_evidencia || [])];
                fotos.forEach(u => u && evidence.push({ url: u, label: 'EVIDENCIA DE ACTIVIDAD' }));
            });
        }

        return evidence.filter(e => e.url && typeof e.url === 'string' && !e.url.toLowerCase().includes('.pdf'));
    };

    const generatePDF = async (targetActivity?: any) => {
        const list = targetActivity ? [targetActivity] : activities;
        if (!list.length) return;
        
        setIsGenerating(true); 
        setGenerationProgress(0);

        // Inicializar PDF con compresión activa
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;

        const drawHeader = (isFicha = false, actData?: any) => {
            if (logo1) try { doc.addImage(logo1, 'PNG', margin, 10, 20, 20, undefined, 'FAST'); } catch(e){}
            if (logo2) try { doc.addImage(logo2, 'PNG', pageWidth - margin - 20, 10, 20, 20, undefined, 'FAST'); } catch(e){}
            
            doc.setFontSize(14); doc.setFont('helvetica', 'bold');
            const title = isFicha ? 'FICHA INDIVIDUAL DE ACTIVIDAD' : 'COMPENDIO GENERAL DE ACTIVIDADES';
            doc.text(title, pageWidth / 2, 18, { align: 'center' });
            
            doc.setFontSize(9); doc.setFont('helvetica', 'normal');
            if (isFicha && actData) {
                doc.text(`${(actData.lugar_local || 'S/D').toUpperCase()}`, pageWidth / 2, 24, { align: 'center' });
                doc.text(`${actData.departamento} - ${actData.distrito}`, pageWidth / 2, 28, { align: 'center' });
            } else {
                doc.text(`${selectedDepartment || 'GENERAL'} - ${selectedDistrict || 'TODOS'}`, pageWidth / 2, 24, { align: 'center' });
                doc.text(`Fecha: ${new Date().toLocaleDateString()}`, pageWidth / 2, 29, { align: 'center' });
            }
            doc.line(margin, 35, pageWidth - margin, 35);
        };

        try {
            // 1. Pre-renderizar Índice (Solo si es compendio)
            if (!targetActivity) {
                drawHeader();
                doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.text('RESUMEN DE ACTIVIDADES', margin, 45);
                const rows = list.map((a, i) => [(i + 1).toString(), formatDateToDDMMYYYY(a.fecha), (a.lugar_local || 'N/A').toUpperCase(), a.solicitante_entidad || 'N/A']);
                autoTable(doc, { 
                    startY: 50, 
                    head: [['#', 'FECHA', 'LUGAR', 'ENTIDAD']], 
                    body: rows, 
                    theme: 'striped', 
                    headStyles: { fillColor: [0, 0, 0] }, 
                    styles: { fontSize: 7 },
                    margin: { left: margin, right: margin }
                });
            }

            // 2. Procesamiento por lotes (Batching) para máxima velocidad
            const batchSize = 3;
            for (let i = 0; i < list.length; i += batchSize) {
                const batch = list.slice(i, i + batchSize);
                
                // Preparar datos de todas las actividades del lote en paralelo
                const batchData = await Promise.all(batch.map(async (act) => {
                    const evidence = getActivityEvidence(act);

                    // Descargar todas las imágenes de esta actividad en paralelo
                    const loadedImages = await Promise.all(evidence.map(async img => ({
                        ...img,
                        data: await loadImageAsBase64(img.url)
                    })));

                    return { act, loadedImages };
                }));

                // 3. Renderizar las páginas del lote
                for (const { act, loadedImages } of batchData) {
                    const currentIndex = list.indexOf(act);
                    setGenerationProgress(Math.round(((currentIndex + 1) / list.length) * 100));

                    if (currentIndex > 0 || !targetActivity) doc.addPage();
                    drawHeader(!!targetActivity, act);
                    
                    doc.setFillColor(240, 240, 240); doc.rect(margin, 40, pageWidth - (margin*2), 8, 'F');
                    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
                    doc.text(`ACTIVIDAD: ${(act.lugar_local || 'S/D').toUpperCase()}`, margin + 3, 45.5);

                    const divulgadoresNombres = act.divulgadores?.map((d: any) => d.nombre).join(', ') || 
                                               act.divulgador_nombre || 
                                               act.coordinador_nombre || 
                                               'N/A';

                    autoTable(doc, {
                        startY: 52, margin: { left: margin }, head: [['DETALLES TÉCNICOS', '']],
                        body: [
                            ['ENTIDAD:', act.solicitante_entidad || 'N/A'], 
                            ['DIVULGADORES:', divulgadoresNombres], 
                            ['FECHA/HORA:', `${formatDateToDDMMYYYY(act.fecha)} | ${act.hora_desde || '--:--'} HS`]
                        ],
                        theme: 'plain', styles: { fontSize: 8 }
                    });

                    // Sección de Máquinas y Resultados (Solo para ficha individual o resaltado)
                    if (targetActivity) {
                        autoTable(doc, {
                            startY: (doc as any).lastAutoTable.finalY + 5,
                            margin: { left: margin },
                            head: [['MÁQUINAS ASIGNADAS', 'RESULTADOS DE ACTIVIDAD']],
                            body: [
                                [
                                    act.movimiento?.maquinas?.map((m: any) => m.codigo).join(', ') || 'N/A',
                                    `TOTAL PERSONAS: ${act.informes?.reduce((a: any, c: any) => a + (c.total_personas || 0), 0) || 0}\nENCUESTAS: ${act.encuestasCount || 0}`
                                ]
                            ],
                            theme: 'grid',
                            headStyles: { fillColor: [0, 0, 0] },
                            styles: { fontSize: 8 },
                            columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 'auto' } }
                        });
                    }

                    if (includePhotos && loadedImages.length > 0) {
                        let y = (doc as any).lastAutoTable.finalY + 10;
                        doc.setFontSize(9); doc.text('EVIDENCIAS FOTOGRÁFICAS', margin, y);
                        y += 5;
                        for (const img of loadedImages) {
                            if (!img.data) continue;
                            
                            // Ajustar tamaño a 140x105 (4:3) para que se vea mucho mejor
                            const imgWidth = 140;
                            const imgHeight = 105;
                            const imgX = (pageWidth - imgWidth) / 2;

                            // Verificar si cabe en la página actual
                            if (y + imgHeight + 15 > pageHeight - 15) { 
                                doc.addPage(); 
                                drawHeader(!!targetActivity, act); 
                                y = 45; 
                            }
                            
                            // Etiqueta descriptiva centrada con el nombre del lugar
                            doc.setFontSize(8); 
                            const fullLabel = `${img.label} - ${(act.lugar_local || 'S/D').toUpperCase()}`;
                            const labelWidth = doc.getTextWidth(fullLabel) + 4;
                            const labelX = (pageWidth - labelWidth) / 2;

                            doc.setFillColor(0,0,0); 
                            doc.rect(labelX, y, labelWidth, 5, 'F');
                            doc.setTextColor(255); 
                            doc.text(fullLabel, labelX + 2, y + 3.8); 
                            doc.setTextColor(0);
                            y += 6;

                            try { 
                                // Imagen centrada
                                doc.addImage(img.data, 'JPEG', imgX, y, imgWidth, imgHeight, undefined, 'FAST'); 
                                y += imgHeight + 10; 
                            } catch(e){ 
                                console.warn("Turbo: Salto de imagen corrupta");
                                y += 5; 
                            }
                        }
                    }
                }
            }

            const fileName = targetActivity 
                ? `Ficha_${(targetActivity.lugar_local || 'act').replace(/\s+/g, '_')}.pdf` 
                : `Reporte_${selectedDistrict || 'General'}.pdf`;
            
            doc.save(fileName);
            toast({ title: "Modo Turbo Completado", description: "El reporte se generó a máxima velocidad." });
        } catch (e: any) { 
            toast({ title: "Error en Generación", description: e.message, variant: "destructive" }); 
        } finally { 
            setIsGenerating(false); 
            setGenerationProgress(0); 
        }
    };

    return (
        <div className="flex min-h-screen flex-col bg-neutral-50">
            <Header title="Reportes DGRE" />
            <main className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-6">
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl"><FileArchive className="h-8 w-8 text-primary" /></div>
                        <div>
                            <h1 className="text-2xl font-black uppercase tracking-tight">Compendio General</h1>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">{version} - BUILD ESTABLE</p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <HistoricalToggle 
                            isHistorical={isHistorical} 
                            setIsHistorical={setIsHistorical} 
                            isAdmin={['admin', 'director'].includes(user?.profile?.role || '')} 
                        />
                        <Button onClick={() => generatePDF()} disabled={isGenerating || activities.length === 0} className="h-12 px-8 rounded-xl font-black uppercase text-[10px] gap-2">
                            {isGenerating ? <Loader2 className="animate-spin h-4 w-4" /> : <Download className="h-4 w-4" />}
                            {isGenerating ? `PROCESANDO ${generationProgress}%` : "DESCARGAR COMPENDIO"}
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="rounded-2xl shadow-sm"><CardHeader className="pb-2 text-[10px] font-black uppercase opacity-50">Departamento</CardHeader>
                        <CardContent><Select value={selectedDepartment || ""} onValueChange={(v) => { setSelectedDepartment(v); setSelectedDistrict(null); setActivities([]); }}>
                            <SelectTrigger className="rounded-xl h-12 font-bold uppercase text-[10px]"><SelectValue placeholder="SELECCIONAR..." /></SelectTrigger>
                            <SelectContent>{departments.map(d => <SelectItem key={d} value={d} className="text-[10px] uppercase font-bold">{d}</SelectItem>)}</SelectContent>
                        </Select></CardContent></Card>
                    <Card className="rounded-2xl shadow-sm"><CardHeader className="pb-2 text-[10px] font-black uppercase opacity-50">Distrito</CardHeader>
                        <CardContent><Select value={selectedDistrict || ""} onValueChange={setSelectedDistrict} disabled={!selectedDepartment}>
                            <SelectTrigger className="rounded-xl h-12 font-bold uppercase text-[10px]"><SelectValue placeholder="SELECCIONAR..." /></SelectTrigger>
                            <SelectContent>{districts.map(d => <SelectItem key={d} value={d} className="text-[10px] uppercase font-bold">{d}</SelectItem>)}</SelectContent>
                        </Select></CardContent></Card>
                    <div className="flex items-end"><Button onClick={fetchActivities} disabled={!selectedDistrict || isLoadingData} className="w-full h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest">
                        {isLoadingData ? <Loader2 className="animate-spin" /> : <Search className="mr-2" />} {isLoadingData ? "BUSCANDO..." : "CONSULTAR"}
                    </Button></div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center space-x-2 p-2">
                        <Switch id="p" checked={includePhotos} onCheckedChange={setIncludePhotos} />
                        <Label htmlFor="p" className="text-[10px] font-black uppercase">Incluir Evidencias Fotográficas</Label>
                    </div>
                    {activities.map((act) => (
                        <Card key={act.id} className="rounded-[2rem] border-none shadow-md hover:shadow-lg transition-all cursor-pointer overflow-hidden" onClick={() => { setSelectedActivity(act); setIsModalOpen(true); }}>
                            <CardContent className="p-6 flex justify-between items-center">
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-muted-foreground uppercase">{formatDateToDDMMYYYY(act.fecha)}</p>
                                    <h3 className="text-sm font-black uppercase text-primary">{act.lugar_local}</h3>
                                    <p className="text-[10px] font-bold opacity-50 uppercase">{act.solicitante_entidad}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right hidden md:block">
                                        <p className="text-[8px] font-black uppercase text-muted-foreground">Personas</p>
                                        <p className="text-sm font-black">{act.informes?.reduce((a:any, c:any) => a + (c.total_personas || 0), 0) || 0}</p>
                                    </div>
                                    <div className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400"><ChevronRight className="h-5 w-5" /></div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </main>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-[2rem] p-0 border-none shadow-2xl">
                    {selectedActivity && (
                        <div className="flex flex-col">
                            <div className="bg-black text-white p-8 flex justify-between items-start">
                                <div className="space-y-2">
                                    <Badge className="bg-primary text-white text-[9px] font-black uppercase">{selectedActivity.tipo_solicitud || 'ACTIVIDAD'}</Badge>
                                    <h2 className="text-3xl font-black uppercase leading-none">{selectedActivity.lugar_local}</h2>
                                    <p className="text-[10px] font-bold opacity-60 uppercase">{selectedActivity.departamento} - {selectedActivity.distrito}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white font-black uppercase text-[10px] h-10 px-4 gap-2 rounded-xl" onClick={() => generatePDF(selectedActivity)} disabled={isGenerating}>
                                        {isGenerating ? <Loader2 className="animate-spin h-4 w-4" /> : <FileText className="h-4 w-4 text-red-500" />} Descargar PDF
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)} className="text-white/50 hover:text-white"><X /></Button>
                                </div>
                            </div>
                            <div className="p-8 space-y-8 bg-neutral-50">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-2">
                                        <p className="text-[8px] font-black uppercase text-blue-600 flex items-center gap-2"><ClipboardCheck className="h-3 w-3" /> Máquinas</p>
                                        <div className="space-y-1">{selectedActivity.movimiento?.maquinas?.map((m:any, i:number) => <p key={i} className="text-[10px] font-bold uppercase border-b border-dashed py-1">Serie: {m.codigo}</p>) || "N/A"}</div>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-2">
                                        <p className="text-[8px] font-black uppercase text-green-600 flex items-center gap-2"><Users className="h-3 w-3" /> Resultados</p>
                                        <div className="flex justify-between text-xs font-bold uppercase"><span className="opacity-50">Total Divulgados:</span><span>{selectedActivity.informes?.reduce((a:any, c:any) => a + (c.total_personas || 0), 0) || 0}</span></div>
                                        <div className="flex justify-between text-xs font-bold uppercase"><span className="opacity-50">Encuestas:</span><span>{selectedActivity.encuestasCount || 0}</span></div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-sm font-black uppercase flex items-center gap-2"><ImageIconLucide className="h-4 w-4" /> Evidencias</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {getActivityEvidence(selectedActivity).map((item, i) => (
                                            <div key={i} className="group relative aspect-[3/4] rounded-xl overflow-hidden border-2 border-white shadow-sm bg-white">
                                                <SafeThumbnail url={item.url} className="h-full w-full" />
                                                <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm p-2 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                                                    <p className="text-[7px] font-black text-white uppercase leading-tight text-center">{item.label}</p>
                                                </div>
                                                <div className="absolute top-2 left-2 bg-black/40 backdrop-blur-md px-2 py-1 rounded-md opacity-100 group-hover:opacity-0 transition-opacity">
                                                    <p className="text-[6px] font-bold text-white uppercase">{item.label.split(' ')[0]}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
