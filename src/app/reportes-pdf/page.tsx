"use client";

import { useState, useMemo, useEffect } from "react";
import Header from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUser, useFirebase, useDocOnce } from "@/firebase";
import { collection, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Loader2, PieChart as PieIcon, RefreshCw, Printer, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, BarChart3, Users, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { cn, formatDateToDDMMYYYY, normalizeGeo } from "@/lib/utils";
import html2canvas from "html2canvas";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const COLORS = ['#0F172A', '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function ReportesPDFPage() {
    const { user } = useUser();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isSyncing, setIsSyncing] = useState(false);

    // Leer resumen pre-calculado (Bajo Costo: 1 sola lectura)
    const statsDocRef = useMemo(() => firestore ? doc(firestore, 'stats-summary', 'capacitaciones') : null, [firestore]);
    const { data: summary, isLoading: isLoadingSummary } = useDocOnce<any>(statsDocRef);

    const isAdmin = user?.isAdmin || user?.isOwner;

    const handleSync = async () => {
        if (!firestore || !isAdmin) return;
        setIsSyncing(true);
        try {
            toast({ title: "Iniciando sincronización...", description: "Esto puede tardar unos segundos dependiendo del volumen de datos." });

            const [informesSnap, encuestasSnap, datosSnap, reportsSnap, usersSnap, solicitudesSnap] = await Promise.all([
                getDocs(collection(firestore, 'informes-divulgador')),
                getDocs(collection(firestore, 'encuestas-satisfaccion')),
                getDocs(collection(firestore, 'datos')),
                getDocs(collection(firestore, 'reports')),
                getDocs(collection(firestore, 'users')),
                getDocs(collection(firestore, 'solicitudes-capacitacion'))
            ]);

            const informes = informesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const encuestas = encuestasSnap.docs.map(d => d.data());
            const allDatos = datosSnap.docs.map(d => d.data());
            const reportsData = reportsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const usersList = usersSnap.docs.map(d => d.data());
            const solicitudesList = solicitudesSnap.docs.map(d => d.data());

            // 1. Filtrar solo Distritos Reales (Código de 2 dígitos al inicio y no institucional)
            const realDistritos = allDatos.filter((d: any) => {
                const depto = (d.departamento || '').toUpperCase();
                const deptoCod = depto.split(' - ')[0] || '';
                const hasValidCode = /^\d{2}$/.test(deptoCod);
                const isInstitutional = depto.includes('CIDEE') || depto.includes('DGRE');
                return hasValidCode && !isInstitutional;
            });

            // 2. Inicializar Mapa Completo de Departamentos y Distritos
            const deptoMap: any = {};
            realDistritos.forEach((d: any) => {
                const deptoKey = d.departamento;
                const distKey = d.distrito;
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
                        encuestas: 0,
                        tieneUsuario: false,
                        tieneInforme: false
                    };
                }
            });

            // 3. Mapear Usuarios
            let globalDistritosConUsuario = 0;
            usersList.forEach((u: any) => {
                const depto = u.profile?.departamento || u.departamento;
                const dist = u.profile?.oficina || u.oficina || u.profile?.distrito || u.distrito;
                if (depto && dist && deptoMap[depto] && deptoMap[depto].distritos[dist]) {
                    if (!deptoMap[depto].distritos[dist].tieneUsuario) {
                        deptoMap[depto].distritos[dist].tieneUsuario = true;
                        globalDistritosConUsuario++;
                    }
                }
            });

            // 4. Procesar Informes (Ejecución Real con Normalización)
            let globalCapacitados = 0;
            informes.forEach((inf: any) => {
                const deptoKey = inf.departamento;
                const distName = inf.oficina || inf.distrito;
                if (!deptoKey || !distName || !deptoMap[deptoKey]) return;

                const normDist = normalizeGeo(distName);
                // Buscar el distrito que coincida normalizado
                const realDistKey = Object.keys(deptoMap[deptoKey].distritos).find(k => normalizeGeo(k) === normDist);
                
                if (realDistKey) {
                    const nroCapt = Number(inf.total_personas || 0);
                    deptoMap[deptoKey].capacitados += nroCapt;
                    deptoMap[deptoKey].distritos[realDistKey].capacitados += nroCapt;
                    globalCapacitados += nroCapt;
                }
            });

            // 5. Procesar Solicitudes (Entidades Políticas y No Políticas)
            const solicitudStats = {
                partidos: 0,
                movimientos: 0,
                entidades: 0
            };

            solicitudesList.forEach((s: any) => {
                if (s.otra_entidad) {
                    solicitudStats.entidades++;
                } else if (s.solicitante_entidad) {
                    if (s.movimiento_politico) {
                        solicitudStats.movimientos++;
                    } else {
                        solicitudStats.partidos++;
                    }
                }
            });

            // 5. Procesar Encuestas y Percepción (Normalización Robusta)
            const percCounts: any = { 'EXCELENTE': 0, 'MUY BUENO': 0, 'BUENO': 0, 'REGULAR': 0, 'INSATISFACTORIO': 0 };
            const utilidadCounts: any = { muy_util: 0, util: 0, poco_util: 0, nada_util: 0 };
            const facilidadCounts: any = { muy_facil: 0, facil: 0, poco_facil: 0, nada_facil: 0 };
            const seguridadCounts: any = { muy_seguro: 0, seguro: 0, poco_seguro: 0, nada_seguro: 0 };
            const generoCounts: any = { hombre: 0, mujer: 0 };
            const edadCounts: any = { '18-25': 0, '26-40': 0, '41-60': 0, '60+': 0 };
            let pueblosCount = 0;

            const normalizePercepcion = (val: string) => {
                const normalized = (val || '').trim().toUpperCase().replace(/\s+/g, '_');
                if (normalized.includes('MUY') && normalized.includes('BUENO')) return 'MUY BUENO';
                if (normalized.includes('EXCELENTE')) return 'EXCELENTE';
                if (normalized.includes('INSATISFACTORIO') || normalized.includes('MALA')) return 'INSATISFACTORIO';
                return normalized;
            };

            encuestas.forEach((e: any) => {
                const deptoKey = e.departamento;
                const distKey = e.distrito;

                if (deptoKey && distKey && deptoMap[deptoKey]) {
                    const normDist = normalizeGeo(distKey);
                    const realDistKey = Object.keys(deptoMap[deptoKey].distritos).find(k => normalizeGeo(k) === normDist);
                    
                    deptoMap[deptoKey].encuestas += 1;
                    if (realDistKey) {
                        deptoMap[deptoKey].distritos[realDistKey].encuestas += 1;
                    }
                }

                // Mapeo dinámico para que el gráfico de percepción funcione con utilidad_maquina
                if (e.utilidad_maquina) {
                    const mapping: Record<string, string> = {
                        'muy_util': 'EXCELENTE',
                        'util': 'MUY BUENO',
                        'poco_util': 'BUENO',
                        'nada_util': 'REGULAR'
                    };
                    const key = mapping[e.utilidad_maquina];
                    if (key && percCounts[key] !== undefined) percCounts[key]++;
                } else if (e.percepcion_maquina) {
                    const key = normalizePercepcion(e.percepcion_maquina);
                    if (percCounts[key] !== undefined) percCounts[key]++;
                }

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

            const percepcionData = Object.entries(percCounts).map(([name, value]) => ({ name, value }));

            // 6. Agregación de Ubicaciones (Módulo Resumen)
            const departments: Record<string, Set<string>> = {};
            realDistritos.forEach((d: any) => {
                if (!departments[d.departamento]) departments[d.departamento] = new Set();
                departments[d.departamento].add(d.distrito);
            });

            const structuredUbicaciones = Object.keys(departments).sort().map((deptName, idx) => {
                const districts = Array.from(departments[deptName]).sort();
                const districtsWithReports = districts.map(distName => {
                    const report = reportsData.find((r: any) => r.departamento === deptName && r.distrito === distName) || null;
                    return { name: distName, report };
                });
                return { id: `dept-${idx}`, name: deptName, districts: districtsWithReports };
            });

            const locationSummaryData: any = {
                totalReports: { count: reportsData.length },
                habitacionSegura: { count: 0 },
                comisaria: { count: 0 },
                parroquia: { count: 0 },
                localVotacion: { count: 0 },
                juzgado: { count: 0 },
                propiedadIntendencia: { count: 0 },
                otros: { count: 0 }
            };

            reportsData.forEach((r: any) => {
                const lugar = (r['lugar-resguardo'] || '').toLowerCase().trim();
                if (lugar.includes('habitacion') || lugar.includes('segura') || lugar.includes('registro')) locationSummaryData.habitacionSegura.count++;
                else if (lugar.includes('comisaria')) locationSummaryData.comisaria.count++;
                else if (lugar.includes('parroquia')) locationSummaryData.parroquia.count++;
                else if (lugar.includes('local de votacion') || lugar.includes('local votacion')) locationSummaryData.localVotacion.count++;
                else if (lugar.includes('juzgado')) locationSummaryData.juzgado.count++;
                else if (lugar.includes('intendencia')) locationSummaryData.propiedadIntendencia.count++;
                else locationSummaryData.otros.count++;
            });

            const formatEncuestaData = (obj: any, labels: any) => Object.entries(obj).map(([key, value]) => ({ name: labels[key] || key, value }));

            // 4. Guardar Resúmenes
            await Promise.all([
                setDoc(doc(firestore, 'stats-summary', 'capacitaciones'), {
                    lastUpdate: new Date().toISOString(),
                    totalCapacitados: globalCapacitados,
                    totalEncuestas: encuestas.length,
                    totalDistritos: realDistritos.length,
                    distritosConUsuario: globalDistritosConUsuario,
                    solicitudStats,
                    deptoData: Object.values(deptoMap).sort((a: any, b: any) => a.codigo.localeCompare(b.codigo)),
                    percepcionData,
                    utilidadData: formatEncuestaData(utilidadCounts, { muy_util: 'Muy Útil', util: 'Útil', poco_util: 'Poco Útil', nada_util: 'Nada Útil' }),
                    facilidadData: formatEncuestaData(facilidadCounts, { muy_facil: 'Muy Fácil', facil: 'Fácil', poco_facil: 'Poco Fácil', nada_facil: 'Nada Fácil' }),
                    seguridadData: formatEncuestaData(seguridadCounts, { muy_seguro: 'Muy Seguro', seguro: 'Seguro', poco_seguro: 'Poco Seguro', nada_seguro: 'Nada Seguro' }),
                    generoData: formatEncuestaData(generoCounts, { hombre: 'Hombre', mujer: 'Mujer' }),
                    edadesData: Object.entries(edadCounts).map(([key, value]) => ({ name: key, value })),
                    pueblosCount,
                    updatedBy: user?.profile?.username || user?.email
                }),
                setDoc(doc(firestore, 'stats-summary', 'ubicaciones'), {
                    lastUpdate: new Date().toISOString(),
                    structuredData: structuredUbicaciones,
                    summaryData: locationSummaryData
                })
            ]);

            toast({ title: "Sincronización exitosa", description: "Todos los módulos han sido actualizados." });
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
                ['Distritos con Usuario Asignado', summary.distritosConUsuario?.toLocaleString() || '0'],
                ['Solicitudes Partidos/Movimientos', ((summary.solicitudStats?.partidos || 0) + (summary.solicitudStats?.movimientos || 0)).toLocaleString()],
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

        const chartElements = ['top-distritos-chart', 'satisfaccion-pie-chart', 'demografia-chart'];
        let chartY = 30;

        for (const id of chartElements) {
            const element = document.getElementById(id);
            if (element) {
                // Título del gráfico en el PDF
                const titles: Record<string, string> = {
                    'top-distritos-chart': 'ALCANCE POR DEPARTAMENTO',
                    'satisfaccion-pie-chart': 'PERCEPCIÓN DE UTILIDAD',
                    'demografia-chart': 'RANGOS DE EDAD DE PARTICIPANTES'
                };
                
                if (chartY > 20) {
                    doc.setFontSize(9);
                    doc.setFont("helvetica", "bold");
                    doc.text(titles[id] || '', margin, chartY);
                }

                const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
                const imgData = canvas.toDataURL('image/png');
                const imgWidth = 180;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                
                if (chartY + imgHeight > 280) { doc.addPage(); chartY = 20; }
                doc.addImage(imgData, 'PNG', 15, chartY + 5, imgWidth, imgHeight);
                chartY += imgHeight + 25;
            }
        }

        // Agregar Tabla de Edades explícita
        if (summary.edadesData) {
            doc.addPage();
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text("4. DESGLOSE DEMOGRÁFICO", margin, 20);
            
            autoTable(doc, {
                startY: 30,
                head: [['Rango de Edad', 'Cantidad de Participantes', 'Porcentaje']],
                body: summary.edadesData.map((e: any) => [
                    e.name, 
                    e.value.toLocaleString(), 
                    `${((e.value / summary.totalEncuestas) * 100).toFixed(1)}%`
                ]),
                theme: 'grid',
                headStyles: { fillColor: [26, 26, 26], fontSize: 9 },
                bodyStyles: { fontSize: 8 }
            });
            currentY = (doc as any).lastAutoTable.finalY + 15;
        } else {
            currentY = chartY;
        }

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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
                                <CardContent className="p-8">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Total Capacitados</p>
                                    <h2 className="text-4xl font-black text-primary">{summary.totalCapacitados.toLocaleString()}</h2>
                                    <div className="h-1 w-12 bg-primary mt-4 rounded-full" />
                                </CardContent>
                            </Card>
                            <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
                                <CardContent className="p-8">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Registros con Usuario</p>
                                    <h2 className="text-4xl font-black text-blue-600">{summary.distritosConUsuario?.toLocaleString() || 0}</h2>
                                    <p className="text-[9px] font-bold text-muted-foreground mt-1 uppercase">De {summary.totalDistritos || 282} distritos totales</p>
                                </CardContent>
                            </Card>
                            <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
                                <CardContent className="p-8">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Entidades Solicitantes</p>
                                    <h2 className="text-4xl font-black text-green-600">{(summary.solicitudStats?.partidos || 0) + (summary.solicitudStats?.movimientos || 0) + (summary.solicitudStats?.entidades || 0)}</h2>
                                    <p className="text-[9px] font-bold text-muted-foreground mt-1 uppercase">Partidos, Mov. y Otros</p>
                                </CardContent>
                            </Card>
                            <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
                                <CardContent className="p-8">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Encuestas</p>
                                    <h2 className="text-4xl font-black text-neutral-800">{summary.totalEncuestas?.toLocaleString() || 0}</h2>
                                    <div className="h-1 w-12 bg-neutral-300 mt-4 rounded-full" />
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
                                                <Bar dataKey="capacitados" name="Capacitados" fill="#2563EB" radius={[6, 6, 0, 0]} />
                                                <Bar dataKey="encuestas" name="Encuestas" fill="#10B981" radius={[6, 6, 0, 0]} />
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
                                                <Bar dataKey="value" name="Votos" fill="#2563EB" radius={[6, 6, 0, 0]} />
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
                                                <Bar dataKey="value" name="Participantes" fill="#8B5CF6" radius={[0, 6, 6, 0]} />
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
                                                                <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-500 text-center">Estado</th>
                                                                <th className="px-6 py-4 text-[9px] font-black uppercase text-primary text-center">Capacitados</th>
                                                                <th className="px-6 py-4 text-[9px] font-black uppercase text-muted-foreground text-center">Encuestas</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {Object.values(depto.distritos).sort((a: any, b: any) => a.nombre.localeCompare(b.nombre)).map((dist: any) => (
                                                                <tr key={dist.nombre} className="border-b last:border-0 border-neutral-100 hover:bg-white transition-colors">
                                                                    <td className="px-8 py-3.5 text-[11px] font-black uppercase text-slate-700">{dist.nombre}</td>
                                                                    <td className="px-6 py-3.5">
                                                                        <div className="flex items-center justify-center gap-3">
                                                                            <div title={dist.tieneUsuario ? "Usuario Asignado" : "Sin Usuario"}>
                                                                                <Users className={cn("h-4 w-4", dist.tieneUsuario ? "text-blue-600" : "text-neutral-200")} />
                                                                            </div>
                                                                        </div>
                                                                    </td>
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
