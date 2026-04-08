"use client";

import { useState, useMemo, useEffect } from "react";
import Header from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUser, useFirebase, useDoc } from "@/firebase";
import { collection, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Loader2, PieChart as PieIcon, RefreshCw, Printer, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { cn, formatDateToDDMMYYYY } from "@/lib/utils";
import html2canvas from "html2canvas";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const COLORS = ['#1A1A1A', '#2E2E2E', '#404040', '#525252', '#737373', '#A3A3A3'];

export default function ReportesPDFPage() {
    const { user } = useUser();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isSyncing, setIsSyncing] = useState(false);

    // Leer resumen pre-calculado (Bajo Costo: 1 sola lectura)
    const statsDocRef = useMemo(() => firestore ? doc(firestore, 'stats-summary', 'capacitaciones') : null, [firestore]);
    const { data: summary, isLoading: isLoadingSummary } = useDoc<any>(statsDocRef);

    const isAdmin = user?.profile?.role === 'admin' || user?.isOwner;

    const handleSync = async () => {
        if (!firestore || !isAdmin) return;
        setIsSyncing(true);
        try {
            toast({ title: "Iniciando sincronización...", description: "Esto puede tardar unos segundos dependiendo del volumen de datos." });

            const [informesSnap, encuestasSnap] = await Promise.all([
                getDocs(collection(firestore, 'informes-divulgador')),
                getDocs(collection(firestore, 'encuestas-satisfaccion'))
            ]);

            const informes = informesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const encuestas = encuestasSnap.docs.map(d => d.data());

            // Agregación por Departamento y Distrito
            const deptoMap: any = {};
            let globalCapacitados = 0;

            informes.forEach((inf: any) => {
                const deptoKey = inf.departamento || "SIN DEPARTAMENTO";
                const distKey = inf.oficina || inf.distrito || "SIN DISTRITO";
                // Intentar obtener el código del departamento del nombre (formato "01 - CONCEPCION")
                const deptoCod = deptoKey.split(' - ')[0] || "99";

                if (!deptoMap[deptoKey]) {
                    deptoMap[deptoKey] = {
                        nombre: deptoKey,
                        codigo: deptoCod,
                        capacitados: 0,
                        encuestas: 0,
                        distritos: {}
                    };
                }

                if (!deptoMap[deptoKey].distritos[distKey]) {
                    deptoMap[deptoKey].distritos[distKey] = {
                        nombre: distKey,
                        capacitados: 0,
                        encuestas: 0
                    };
                }

                const nroCapt = Number(inf.total_personas || 0);
                deptoMap[deptoKey].capacitados += nroCapt;
                deptoMap[deptoKey].distritos[distKey].capacitados += nroCapt;
                globalCapacitados += nroCapt;
            });

            encuestas.forEach((enc: any) => {
                const deptoKey = enc.departamento || "SIN DEPARTAMENTO";
                const distKey = enc.distrito || "SIN DISTRITO";

                if (deptoMap[deptoKey]) {
                    deptoMap[deptoKey].encuestas += 1;
                    if (deptoMap[deptoKey].distritos[distKey]) {
                        deptoMap[deptoKey].distritos[distKey].encuestas += 1;
                    }
                }
            });

            // Preparar chart de percepción
            const percepcionData = Object.entries(percCounts).map(([name, value]) => ({ name, value }));

            // 3. Métricas adicionales de Usabilidad y Perfil
            const utilidadCounts: any = { muy_util: 0, util: 0, poco_util: 0, nada_util: 0 };
            const facilidadCounts: any = { muy_facil: 0, facil: 0, poco_facil: 0, nada_facil: 0 };
            const seguridadCounts: any = { muy_seguro: 0, seguro: 0, poco_seguro: 0, nada_seguro: 0 };
            const generoCounts: any = { hombre: 0, mujer: 0 };
            const edadCounts: any = { '18-25': 0, '26-40': 0, '41-60': 0, '60+': 0 };
            let pueblosCount = 0;

            encuestas.forEach((e: any) => {
                if (e.utilidad_maquina && utilidadCounts[e.utilidad_maquina] !== undefined) utilidadCounts[e.utilidad_maquina]++;
                if (e.facilidad_maquina && facilidadCounts[e.facilidad_maquina] !== undefined) facilidadCounts[e.facilidad_maquina]++;
                if (e.seguridad_maquina && seguridadCounts[e.seguridad_maquina] !== undefined) seguridadCounts[e.seguridad_maquina]++;
                if (e.genero && generoCounts[e.genero] !== undefined) generoCounts[e.genero]++;
                if (e.pueblo_originario) pueblosCount++;
                const edad = parseInt(e.edad);
                if (!isNaN(edad)) {
                    if (edad <= 25) edadCounts['18-25']++;
                    else if (edad <= 40) edadCounts['26-40']++;
                    else if (edad <= 60) edadCounts['41-60']++;
                    else edadCounts['60+']++;
                }
            });

            const formatData = (obj: any, labels: any) => Object.entries(obj).map(([key, value]) => ({ name: labels[key] || key, value }));

            // Guardar en Firestore
            await setDoc(doc(firestore, 'stats-summary', 'capacitaciones'), {
                lastUpdate: new Date().toISOString(),
                totalCapacitados: globalCapacitados,
                totalEncuestas: encuestas.length,
                pueblosCount,
                deptoData: deptoMap,
                percepcionData,
                utilidadData: formatData(utilidadCounts, { muy_util: 'Muy Útil', util: 'Útil', poco_util: 'Poco Útil', nada_util: 'Nada Útil' }),
                facilidadData: formatData(facilidadCounts, { muy_facil: 'Muy Fácil', facil: 'Fácil', poco_facil: 'Poco Fácil', nada_facil: 'Nada Fácil' }),
                seguridadData: formatData(seguridadCounts, { muy_seguro: 'Muy Seguro', seguro: 'Seguro', poco_seguro: 'Poco Seguro', nada_seguro: 'Nada Seguro' }),
                generoData: formatData(generoCounts, { hombre: 'Hombre', mujer: 'Mujer' }),
                edadesData: Object.entries(edadCounts).map(([key, value]) => ({ name: key, value })),
                updatedBy: user?.profile?.username || user?.email
            });

            toast({ title: "Sincronización exitosa", description: "El resumen estadístico ha sido actualizado." });
        } catch (error: any) {
            console.error("Sync Error:", error);
            toast({ variant: "destructive", title: "Error en sincronización", description: error.message });
        } finally {
            setIsSyncing(false);
        }
    };

    const deptoGrouped = useMemo(() => {
        if (!summary?.deptoData) return [];
        return Object.values(summary.deptoData).sort((a: any, b: any) => a.codigo.localeCompare(b.codigo));
    }, [summary]);

    const chartData = useMemo(() => {
        return deptoGrouped.map((d: any) => ({
            name: d.nombre,
            capacitados: d.capacitados,
            encuestas: d.encuestas
        }));
    }, [deptoGrouped]);

    const generatePDF = async () => {
        if (!summary) return;

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;

        // Header institucional
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, 40, 'F');
        try {
            doc.addImage('/logo.png', 'PNG', margin, 10, 15, 15);
            doc.addImage('/logo1.png', 'PNG', pageWidth - margin - 35, 10, 35, 15);
        } catch (e) {}

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("REPORTE ESTADÍSTICO DE CAPACITACIONES", pageWidth / 2, 25, { align: "center" });
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`Fecha de Corte: ${formatDateToDDMMYYYY(summary.lastUpdate)}`, pageWidth / 2, 30, { align: "center" });
        
        doc.setDrawColor(230, 230, 230);
        doc.line(margin, 38, pageWidth - margin, 38);

        let currentY = 50;

        // 1. Resumen Ejecutivo
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("1. RESUMEN EJECUTIVO GLOBAL", margin, currentY);
        currentY += 8;

        autoTable(doc, {
            startY: currentY,
            head: [['Indicador Clave', 'Valor Total']],
            body: [
                ['Total de Personal Capacitado', summary.totalCapacitados.toLocaleString()],
                ['Total de Encuestas de Percepción', summary.totalEncuestas.toLocaleString()],
                ['Última Sincronización', formatDateToDDMMYYYY(summary.lastUpdate)]
            ],
            theme: 'grid',
            headStyles: { fillColor: [26, 26, 26], fontSize: 9, fontStyle: 'bold' },
            bodyStyles: { fontSize: 8 }
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;

        // 2. Desglose Territorial
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("2. DESGLOSE TERRITORIAL POR DEPARTAMENTO", margin, currentY);
        currentY += 8;

        const tableBody = deptoGrouped.map((d: any) => [
            d.nombre.toUpperCase(),
            d.capacitados.toLocaleString(),
            d.encuestas.toLocaleString()
        ]);

        autoTable(doc, {
            startY: currentY,
            head: [['Departamento', 'Capacitados', 'Encuestas']],
            body: tableBody,
            theme: 'striped',
            headStyles: { fillColor: [26, 26, 26], fontSize: 8 },
            bodyStyles: { fontSize: 8 },
        });

        // Gráficos (Nueva Página)
        doc.addPage();
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("3. VISUALIZACIÓN ESTADÍSTICA", margin, 20);

        const chartElements = ['top-distritos-chart', 'satisfaccion-pie-chart'];
        let chartY = 30;

        for (const id of chartElements) {
            const element = document.getElementById(id);
            if (element) {
                const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
                const imgData = canvas.toDataURL('image/png');
                const imgWidth = 180;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                
                if (chartY + imgHeight > 280) { doc.addPage(); chartY = 20; }
                doc.addImage(imgData, 'PNG', 15, chartY + 5, imgWidth, imgHeight);
                chartY += imgHeight + 25;
            }
        }

        currentY = chartY;

        // Firmas
        if (currentY > 230) { doc.addPage(); currentY = 30; }
        
        const footerY = doc.internal.pageSize.getHeight() - 40;
        doc.setDrawColor(200);
        doc.line(margin, footerY, 80, footerY);
        doc.line(pageWidth - margin, footerY, pageWidth - 80, footerY);

        doc.setFontSize(8);
        doc.text("Lic. Benjamín Díaz Valinotti", 45, footerY + 5, { align: "center" });
        doc.text("Director General", 45, footerY + 9, { align: "center" });

        doc.text("Ing. Eduardo Benítez", pageWidth - 45, footerY + 5, { align: "center" });
        doc.text("Dirección de Informática", pageWidth - 45, footerY + 9, { align: "center" });

        doc.save(`REPORTE-ESTADISTICO-${new Date().getTime()}.pdf`);
    };

    if (isLoadingSummary) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

    return (
        <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
            <Header title="Reportes PDF y Estadísticas" />
            <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <PieIcon className="h-8 w-8 text-primary" />
                            <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Reportes e Inteligencia</h1>
                        </div>
                        <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                             Análisis Jurisdiccional de Capacitaciones y Alcance Territorial
                        </p>
                    </div>
                    <div className="flex gap-4">
                        {isAdmin && (
                            <Button 
                                onClick={handleSync} 
                                disabled={isSyncing}
                                className="bg-white text-black border-2 border-black hover:bg-neutral-100 font-black uppercase text-[10px] h-12 px-6 gap-2 shadow-lg"
                            >
                                {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                {isSyncing ? "PROCESANDO..." : "Sincronizar Datos"}
                            </Button>
                        )}
                        <Button 
                            onClick={generatePDF} 
                            disabled={!summary}
                            className="bg-primary text-white hover:bg-primary/90 font-black uppercase text-[10px] h-12 px-6 gap-2 shadow-lg"
                        >
                            <Printer className="h-4 w-4" /> Exportar Reporte PDF
                        </Button>
                    </div>
                </div>

                {!summary ? (
                    <Card className="border-dashed border-2 bg-amber-50/50">
                        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                            <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
                            <h3 className="font-black uppercase text-amber-900">No hay resumen de datos</h3>
                            <p className="text-xs text-amber-700 mt-2 max-w-sm font-medium">Un administrador debe presionar el botón "Sincronizar Datos" para generar la primera versión del reporte de bajo costo.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
                                <CardContent className="p-8">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Total Capacitados</p>
                                    <h2 className="text-4xl font-black text-primary">{summary.totalCapacitados.toLocaleString()}</h2>
                                    <div className="h-1 w-12 bg-primary mt-4 rounded-full" />
                                </CardContent>
                            </Card>
                            <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
                                <CardContent className="p-8">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Pueblos Originarios</p>
                                    <h2 className="text-4xl font-black text-neutral-800">{summary.pueblosCount?.toLocaleString() || 0}</h2>
                                    <div className="h-1 w-12 bg-neutral-300 mt-4 rounded-full" />
                                </CardContent>
                            </Card>
                            <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden border-l-4 border-green-500">
                                <CardContent className="p-8">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Estado de Datos</p>
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                                        <h2 className="text-lg font-black text-green-700 uppercase">Sincronizado</h2>
                                    </div>
                                    <p className="text-[9px] font-bold text-muted-foreground mt-2 uppercase">Actualizado el: {formatDateToDDMMYYYY(summary.lastUpdate)}</p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
                                <CardHeader className="p-8 pb-4 border-b border-neutral-50 flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                                            <BarChart3 className="h-4 w-4 text-primary" /> Alcance por Departamento
                                        </CardTitle>
                                        <CardDescription className="text-[9px] font-bold uppercase tracking-widest">Capacitados vs Encuestas</CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent id="top-distritos-chart" className="p-10 bg-white">
                                    <div className="h-[400px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
                                                <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={80} style={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase' }} />
                                                <YAxis style={{ fontSize: '9px', fontWeight: 'bold' }} />
                                                <RechartsTooltip contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }} />
                                                <Bar dataKey="capacitados" name="Capacitados" fill="#1A1A1A" radius={[6, 6, 0, 0]} />
                                                <Bar dataKey="encuestas" name="Encuestas" fill="#A3A3A3" radius={[6, 6, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
                                <CardHeader className="p-8 pb-4 border-b border-neutral-50">
                                    <CardTitle className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                                        <PieIcon className="h-4 w-4 text-primary" /> Percepción de Utilidad
                                    </CardTitle>
                                    <CardDescription className="text-[9px] font-bold uppercase tracking-widest">Resumen de Sentimiento Ciudadano</CardDescription>
                                </CardHeader>
                                <CardContent id="satisfaccion-pie-chart" className="p-10 pb-16 bg-white">
                                    <div className="h-[400px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={summary.percepcionData}
                                                    cx="50%" cy="50%" 
                                                    innerRadius={80}
                                                    outerRadius={120}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {summary.percepcionData.map((entry: any, index: number) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <RechartsTooltip />
                                                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', paddingTop: '20px' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Nuevos Gráficos de Usabilidad */}
                            <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
                                <CardHeader className="p-8 pb-4 border-b border-neutral-50">
                                    <CardTitle className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                                        <BarChart3 className="h-4 w-4 text-primary" /> Facilidad y Usabilidad
                                    </CardTitle>
                                    <CardDescription className="text-[9px] font-bold uppercase tracking-widest">Experiencia con la Máquina de Votación</CardDescription>
                                </CardHeader>
                                <CardContent id="usabilidad-chart" className="p-10 bg-white">
                                    <div className="h-[400px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={summary.facilidadData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="name" style={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase' }} />
                                                <YAxis style={{ fontSize: '9px', fontWeight: 'bold' }} />
                                                <RechartsTooltip />
                                                <Bar dataKey="value" name="Votos" fill="#1A1A1A" radius={[6, 6, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
                                <CardHeader className="p-8 pb-4 border-b border-neutral-50">
                                    <CardTitle className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                                        <Users className="h-4 w-4 text-primary" /> Perfil Demográfico
                                    </CardTitle>
                                    <CardDescription className="text-[9px] font-bold uppercase tracking-widest">Distribución por Rangos de Edad</CardDescription>
                                </CardHeader>
                                <CardContent id="demografia-chart" className="p-10 bg-white">
                                    <div className="h-[400px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={summary.edadesData} layout="vertical">
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                                <XAxis type="number" style={{ fontSize: '9px', fontWeight: 'bold' }} />
                                                <YAxis dataKey="name" type="category" style={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase' }} />
                                                <RechartsTooltip />
                                                <Bar dataKey="value" name="Participantes" fill="#1A1A1A" radius={[0, 6, 6, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
                            <CardHeader className="p-8 border-b">
                                <CardTitle className="text-sm font-black uppercase tracking-tighter">Matriz Jurisdiccional de Datos</CardTitle>
                                <CardDescription className="text-[10px] font-bold uppercase">Desglose Detallado por Departamento y Distrito</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Accordion type="single" collapsible className="w-full">
                                    {deptoGrouped.map((depto: any) => (
                                        <AccordionItem key={depto.nombre} value={depto.nombre} className="border-b last:border-0 border-neutral-100">
                                            <AccordionTrigger className="px-8 py-6 hover:bg-neutral-50/50 hover:no-underline group">
                                                <div className="flex items-center gap-6 w-full text-left">
                                                    <div className="h-10 w-10 rounded-xl bg-neutral-100 flex items-center justify-center font-black text-xs text-neutral-400 group-data-[state=open]:bg-primary group-data-[state=open]:text-white transition-colors">
                                                        {depto.codigo}
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className="font-black text-[13px] uppercase tracking-tight">{depto.nombre}</h4>
                                                        <p className="text-[9px] font-bold text-muted-foreground uppercase">{Object.keys(depto.distritos).length} Distritos Reportando</p>
                                                    </div>
                                                    <div className="flex gap-12 pr-6">
                                                        <div className="text-center">
                                                            <p className="text-[11px] font-black text-primary">{depto.capacitados.toLocaleString()}</p>
                                                            <p className="text-[7px] font-bold uppercase text-muted-foreground">Capacitados</p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-[11px] font-black text-neutral-800">{depto.encuestas.toLocaleString()}</p>
                                                            <p className="text-[7px] font-bold uppercase text-muted-foreground">Encuestas</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="bg-neutral-50/30 p-0">
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead className="bg-neutral-100/50">
                                                            <tr>
                                                                <th className="px-8 py-4 text-[9px] font-black uppercase text-slate-500">Distrito</th>
                                                                <th className="px-6 py-4 text-[9px] font-black uppercase text-primary text-center">Capacitados</th>
                                                                <th className="px-6 py-4 text-[9px] font-black uppercase text-muted-foreground text-center">Encuestas</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {Object.values(depto.distritos).sort((a: any, b: any) => a.nombre.localeCompare(b.nombre)).map((dist: any) => (
                                                                <tr key={dist.nombre} className="border-b last:border-0 border-neutral-100 hover:bg-white transition-colors">
                                                                    <td className="px-8 py-3.5 text-[11px] font-black uppercase text-slate-700">{dist.nombre}</td>
                                                                    <td className="px-6 py-3.5 text-[11px] font-black text-center text-primary">{dist.capacitados.toLocaleString()}</td>
                                                                    <td className="px-6 py-3.5 text-[11px] font-black text-center text-slate-500">{dist.encuestas.toLocaleString()}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </CardContent>
                        </Card>
                    </>
                )}
            </main>
        </div>
    );
}
