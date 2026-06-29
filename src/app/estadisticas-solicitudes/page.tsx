"use client";

import { useState, useMemo, useEffect } from "react";
import Header from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUser, useFirebase, useDocOnce } from "@/firebase";
import { collection, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Loader2, RefreshCw, BarChart3, Users, ClipboardCheck, Building2, Flag, MapPin, AlertTriangle, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { cn, normalizeGeo } from "@/lib/utils";
import html2canvas from "html2canvas";

const COLORS = ['#0F172A', '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function EstadisticasSolicitudesPage() {
    const { user } = useUser();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isSyncing, setIsSyncing] = useState(false);

    // Leer resumen de solicitudes
    const statsDocRef = useMemo(() => firestore ? doc(firestore, 'stats-summary', 'solicitudes') : null, [firestore]);
    const { data: summary, isLoading: isLoadingSummary } = useDocOnce<any>(statsDocRef);

    const isAdmin = ['admin', 'director', 'coordinador'].includes(user?.profile?.role || '') || user?.isOwner;

    const handleSync = async () => {
        if (!firestore || !isAdmin) return;
        setIsSyncing(true);
        try {
            toast({ title: "Sincronizando...", description: "Consolidando partidos y movimientos políiticos..." });

            const [solicitudesSnap, datosSnap] = await Promise.all([
                getDocs(collection(firestore, 'solicitudes-capacitacion')),
                getDocs(collection(firestore, 'datos'))
            ]);

            const solicitudes = solicitudesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const allDatos = datosSnap.docs.map(d => d.data());

            // 1. Departamentos y Distritos base
            const deptoList = [...new Set(allDatos.map((d: any) => d.departamento))].sort();
            const masterDistritos = new Set<string>();
            
            allDatos.forEach((d: any) => {
                if (d.departamento && d.distrito) {
                    const depto = d.departamento.toUpperCase().trim();
                    const dist = d.distrito.toUpperCase().trim();
                    masterDistritos.add(`${depto}||${dist}`);
                }
            });

            // 2. Agregación de Datos Jerárquica
            const distritosConUso = new Set<string>();
            const parties: Record<string, number> = {};
            const partyMovements: Record<string, Record<string, number>> = {};
            const types = { divulgacion: 0, capacitacion: 0 };
            const deptos: Record<string, number> = {};
            let total = 0;

            solicitudes.forEach((s: any) => {
                if (s.cancelada) return;

                // Registro de uso global (sin importar si es político o no)
                if (s.departamento && s.distrito) {
                    const depto = s.departamento.toUpperCase().trim();
                    const dist = s.distrito.toUpperCase().trim();
                    distritosConUso.add(`${depto}||${dist}`);
                }

                // FILTRO GLOBAL ESTRICTO: SOLO AGRUPACIONES Y MOVIMIENTOS POLÍTICOS
                const entity = (s.solicitante_entidad || '').toUpperCase();
                const isOffice = entity.includes('OFICINA') || entity.includes('CENTRO CÍVICO') || entity.includes('CENTRO CIVICO') || entity.includes('REGISTRO ELECTORAL');
                const isPolitical = !!s.solicitante_entidad && (!s.otra_entidad || s.otra_entidad === '') && !isOffice;
                
                if (!isPolitical) return;

                total++;

                // Por Departamento
                if (s.departamento) {
                    deptos[s.departamento] = (deptos[s.departamento] || 0) + 1;
                }

                // Por Partido y Movimiento (LÓGICA ROBUSTA DE PARSEO)
                let partyBase = (s.solicitante_entidad || '').toUpperCase().trim();
                let movementName = (s.movimiento_politico || 'NO SE ESPECIFICO MOVIMIENTO').toUpperCase().trim();

                // Regex para detectar ' - ', ' -', '- ' o '-' como separadores de Partido - Movimiento
                const partyParts = partyBase.split(/\s*-\s*/);
                if (partyParts.length > 1) {
                    partyBase = partyParts[0].trim();
                    const movementFromEntity = partyParts.slice(1).join(' - ').trim();
                    // El movimiento de la entidad tiene prioridad si el campo movimiento_politico está vacío o es genérico
                    if (movementName === 'NO SE ESPECIFICO MOVIMIENTO' || movementName === '') {
                        movementName = movementFromEntity;
                    }
                }

                // Normalización de llaves para Firestore (evitar puntos)
                const partyKey = partyBase.replace(/\./g, '_');
                const movKey = movementName.replace(/\./g, '_');

                parties[partyKey] = (parties[partyKey] || 0) + 1;

                if (!partyMovements[partyKey]) partyMovements[partyKey] = {};
                partyMovements[partyKey][movKey] = (partyMovements[partyKey][movKey] || 0) + 1;

                // Por Tipo
                if (s.tipo_solicitud === 'capacitacion') types.capacitacion++;
                else types.divulgacion++;
            });

            // 3. Procesar Estadísticas de Uso Global y por Departamento
            const faltantes: Record<string, string[]> = {};
            const deptoStats: Record<string, { total: number; usados: number; faltantes: number; faltantesNombres: string[]; usadosNombres: string[] }> = {};
            let distritosUsados = 0;

            masterDistritos.forEach(key => {
                const [depto, dist] = key.split("||");
                if (!deptoStats[depto]) {
                    deptoStats[depto] = { total: 0, usados: 0, faltantes: 0, faltantesNombres: [], usadosNombres: [] };
                }
                deptoStats[depto].total++;

                if (distritosConUso.has(key)) {
                    distritosUsados++;
                    deptoStats[depto].usados++;
                    deptoStats[depto].usadosNombres.push(dist);
                } else {
                    if (!faltantes[depto]) faltantes[depto] = [];
                    faltantes[depto].push(dist);
                    deptoStats[depto].faltantes++;
                    deptoStats[depto].faltantesNombres.push(dist);
                }
            });

            const usageStats = {
                totalDistritos: masterDistritos.size,
                usados: distritosUsados,
                faltantes,
                deptoStats
            };

            // 4. Guardar Resumen Jerárquico
            await setDoc(doc(firestore, 'stats-summary', 'solicitudes'), {
                lastUpdate: new Date().toISOString(),
                totalSolicitudes: total,
                usageStats,
                deptos,
                parties,
                partyMovements,
                types,
                updatedBy: user?.profile?.username || user?.email
            });

            toast({ title: "Sincronización exitosa", description: "El panel de solicitudes ha sido actualizado con el desglose jerárquico." });
        } catch (error: any) {
            console.error("Sync Error:", error);
            toast({ variant: "destructive", title: "Error en sincronización", description: error.message });
        } finally {
            setIsSyncing(false);
        }
    };

    // Preparar deptoData para el gráfico
    const deptoData = useMemo(() => {
        if (!summary?.deptos) return [];
        return Object.entries(summary.deptos)
            .map(([name, count]) => ({ name, count: count as number }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [summary?.deptos]);

    // Preparar partyData para el gráfico
    const partyData = useMemo(() => {
        if (!summary?.parties) return [];
        return Object.entries(summary.parties)
            .map(([name, value]) => ({ name, value: value as number }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [summary?.parties]);

    // Preparar typeData para el gráfico
    const typeData = useMemo(() => {
        return [
            { name: 'DIVULGACIÓN', value: summary?.types?.divulgacion || 0 },
            { name: 'CAPACITACIÓN', value: summary?.types?.capacitacion || 0 }
        ];
    }, [summary?.types]);

    const generatePDF = async () => {
        if (!summary || !summary.usageStats) return;

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
        doc.text("REPORTE DE PRODUCTIVIDAD TERRITORIAL", pageWidth / 2, 25, { align: "center" });
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`Fecha de Corte: ${new Date(summary.lastUpdate).toLocaleDateString('es-PY')}`, pageWidth / 2, 30, { align: "center" });
        
        doc.setDrawColor(230, 230, 230);
        doc.line(margin, 38, pageWidth - margin, 38);

        let currentY = 50;

        // 1. Resumen Ejecutivo
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("1. RESUMEN GLOBAL", margin, currentY);
        currentY += 8;

        const totalUsados = summary.usageStats.usados;
        const totalDistritos = summary.usageStats.totalDistritos;
        const percentGlobal = Math.round((totalUsados / totalDistritos) * 100);

        autoTable(doc, {
            startY: currentY,
            head: [['Indicador Clave', 'Valor Total']],
            body: [
                ['Total Distritos a Nivel País', totalDistritos.toString()],
                ['Distritos Productivos (Con Actividad)', `${totalUsados} (${percentGlobal}%)`],
                ['Distritos Sin Actividad (Faltantes)', `${totalDistritos - totalUsados} (${100 - percentGlobal}%)`],
            ],
            theme: 'grid',
            headStyles: { fillColor: [26, 26, 26], fontSize: 9, fontStyle: 'bold' },
            bodyStyles: { fontSize: 8 }
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;

        // 2. Desglose Territorial
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("2. PRODUCTIVIDAD POR DEPARTAMENTO", margin, currentY);
        currentY += 8;

        const deptoEntries = Object.entries(summary.usageStats.deptoStats || {}).sort((a, b) => a[0].localeCompare(b[0]));
        
        const tableBody = deptoEntries.map(([depto, stats]: [string, any]) => {
            const percent = stats.total > 0 ? Math.round((stats.usados / stats.total) * 100) : 0;
            return [
                depto.toUpperCase(),
                stats.total.toString(),
                stats.usados.toString(),
                stats.faltantes.toString(),
                `${percent}%`
            ];
        });

        autoTable(doc, {
            startY: currentY,
            head: [['Departamento', 'Total Distritos', 'Productivos', 'Faltantes', 'Avance (%)']],
            body: tableBody,
            theme: 'striped',
            headStyles: { fillColor: [26, 26, 26], fontSize: 8 },
            bodyStyles: { fontSize: 8, halign: 'center' },
            columnStyles: { 0: { halign: 'left' } }
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;

        // 3. Detalle de Faltantes
        if (currentY > 250) { doc.addPage(); currentY = 20; }
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("3. DETALLE DE DISTRITOS FALTANTES", margin, currentY);
        currentY += 8;

        const faltantesBody: any[] = [];
        deptoEntries.forEach(([depto, stats]: [string, any]) => {
            if (stats.faltantesNombres && stats.faltantesNombres.length > 0) {
                faltantesBody.push([
                    depto.toUpperCase(),
                    stats.faltantesNombres.sort().join(", ")
                ]);
            }
        });

        if (faltantesBody.length > 0) {
            autoTable(doc, {
                startY: currentY,
                head: [['Departamento', 'Distritos Sin Actividad']],
                body: faltantesBody,
                theme: 'grid',
                headStyles: { fillColor: [153, 27, 27], fontSize: 8 },
                bodyStyles: { fontSize: 7 }
            });
            currentY = (doc as any).lastAutoTable.finalY + 15;
        } else {
            doc.setFontSize(8);
            doc.setFont("helvetica", "italic");
            doc.text("¡Todos los distritos a nivel país están productivos (100% COMPLETADO)!", margin, currentY);
            currentY += 15;
        }

        // Gráficos (Nueva Página)
        doc.addPage();
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("4. VISUALIZACIÓN ESTADÍSTICA Y GRÁFICOS", margin, 20);

        // TARJETAS VISUALES (Captura individual para evitar cortes)
        const container = document.getElementById('depto-cards-container');
        if (container) {
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text("PRODUCTIVIDAD TERRITORIAL (VISUAL)", margin, 30);
            
            let cardY = 40;
            let cardX = margin;
            const cardWidth = 85; // 2 columnas de 85mm + 10mm gap = 180mm
            let maxHeightInRow = 0;
            let colIndex = 0;

            const cards = Array.from(container.children) as HTMLElement[];
            for (let i = 0; i < cards.length; i++) {
                const card = cards[i];
                const originalShadow = card.style.boxShadow;
                card.style.boxShadow = 'none'; // Mejora renderizado
                const canvas = await html2canvas(card, { scale: 2, backgroundColor: '#ffffff' });
                card.style.boxShadow = originalShadow;
                
                const imgData = canvas.toDataURL('image/png');
                const imgHeight = (canvas.height * cardWidth) / canvas.width;
                
                if (cardY + imgHeight > 280) {
                    if (colIndex > 0) {
                        cardY += maxHeightInRow + 10;
                        cardX = margin;
                        colIndex = 0;
                        maxHeightInRow = 0;
                    }
                    
                    if (cardY + imgHeight > 280) {
                        doc.addPage();
                        cardY = 20;
                        cardX = margin;
                        colIndex = 0;
                        maxHeightInRow = 0;
                    }
                }
                
                doc.addImage(imgData, 'PNG', cardX, cardY, cardWidth, imgHeight);
                maxHeightInRow = Math.max(maxHeightInRow, imgHeight);
                
                colIndex++;
                if (colIndex > 1) { 
                    colIndex = 0;
                    cardX = margin;
                    cardY += maxHeightInRow + 10;
                    maxHeightInRow = 0;
                } else {
                    cardX += cardWidth + 10;
                }
            }
        }

        // GRÁFICOS RESTANTES (Sin cortes)
        const chartElements = ['alcance-chart', 'partidos-chart', 'tipo-chart'];
        let chartY = 30;
        doc.addPage(); // Nueva página para asegurar espacio

        for (const id of chartElements) {
            const element = document.getElementById(id);
            if (element) {
                const titles: Record<string, string> = {
                    'alcance-chart': 'ALCANCE POR DEPARTAMENTO',
                    'partidos-chart': 'TOP PARTIDOS POLÍTICOS',
                    'tipo-chart': 'DISTRIBUCIÓN POR TIPO'
                };
                
                const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
                const imgData = canvas.toDataURL('image/png');
                const imgWidth = 180;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                
                if (chartY + imgHeight > 280) { 
                    doc.addPage(); 
                    chartY = 20; 
                }
                
                doc.setFontSize(9);
                doc.setFont("helvetica", "bold");
                doc.text(titles[id] || '', margin, chartY);
                
                doc.addImage(imgData, 'PNG', margin, chartY + 5, imgWidth, imgHeight);
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
        doc.setFont("helvetica", "normal");
        doc.text("Lic. Benjamín Díaz Valinotti", 45, footerY + 5, { align: "center" });
        doc.text("Director General", 45, footerY + 9, { align: "center" });

        doc.text("Ing. Eduardo Benítez", pageWidth - 45, footerY + 5, { align: "center" });
        doc.text("Encargado de Informática de la DGRE", pageWidth - 45, footerY + 9, { align: "center" });

        doc.save(`PRODUCTIVIDAD-TERRITORIAL-${new Date().getTime()}.pdf`);
    };

    if (isLoadingSummary) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

    return (
        <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
            <Header title="Estadísticas de Solicitudes" />
            <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <BarChart3 className="h-8 w-8 text-primary" />
                            <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Estadísticas de Solicitudes</h1>
                        </div>
                        <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                             Análisis de participación por Departamento y Agrupación Política
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
                            disabled={!summary?.usageStats}
                            className="bg-primary text-white hover:bg-primary/90 font-black uppercase text-[10px] h-12 px-6 gap-2 shadow-lg"
                        >
                            <Printer className="h-4 w-4" /> Exportar Productividad PDF
                        </Button>
                    </div>
                </div>

                {!summary ? (
                    <Card className="border-dashed border-2 bg-blue-50/50">
                        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                            <BarChart3 className="h-12 w-12 text-blue-500 mb-4" />
                            <h3 className="font-black uppercase text-blue-900">No hay datos procesados</h3>
                            <p className="text-xs text-blue-700 mt-2 max-w-sm font-medium">Presione "Sincronizar Datos" para generar las estadísticas por primera vez.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden group hover:shadow-2xl transition-all">
                                <CardContent className="p-8">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Total Solicitudes</p>
                                            <h2 className="text-4xl font-black text-primary">{summary.totalSolicitudes?.toLocaleString() || 0}</h2>
                                        </div>
                                        <ClipboardCheck className="h-10 w-10 text-primary opacity-20 group-hover:opacity-40 transition-opacity" />
                                    </div>
                                    <div className="h-1 w-12 bg-primary mt-4 rounded-full" />
                                </CardContent>
                            </Card>
                            <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden group hover:shadow-2xl transition-all">
                                <CardContent className="p-8">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Partidos Activos</p>
                                            <h2 className="text-4xl font-black text-blue-600">{partyData?.length || 0}</h2>
                                        </div>
                                        <Flag className="h-10 w-10 text-blue-600 opacity-20 group-hover:opacity-40 transition-opacity" />
                                    </div>
                                    <p className="text-[9px] font-bold text-muted-foreground mt-1 uppercase">Top organizaciones solicitantes</p>
                                </CardContent>
                            </Card>
                            <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden group hover:shadow-2xl transition-all">
                                <CardContent className="p-8">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Uso Global País</p>
                                            <h2 className="text-4xl font-black text-green-600">
                                                {summary.usageStats ? Math.round((summary.usageStats.usados / summary.usageStats.totalDistritos) * 100) : 0}%
                                            </h2>
                                        </div>
                                        <MapPin className="h-10 w-10 text-green-600 opacity-20 group-hover:opacity-40 transition-opacity" />
                                    </div>
                                    <p className="text-[9px] font-bold text-muted-foreground mt-1 uppercase">
                                        {summary.usageStats?.usados || 0} de {summary.usageStats?.totalDistritos || 0} distritos utilizaron el sistema
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden lg:col-span-2">
                                <CardHeader className="p-8 pb-4 border-b border-neutral-50 flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                                            <Building2 className="h-4 w-4 text-primary" /> Alcance por Departamento
                                        </CardTitle>
                                        <CardDescription className="text-[9px] font-bold uppercase tracking-widest">Distribución de Solicitudes Recibidas</CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent id="alcance-chart" className="p-10 bg-white">
                                    <div className="h-[450px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={deptoData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
                                                <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={100} style={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase' }} />
                                                <YAxis style={{ fontSize: '9px', fontWeight: 'bold' }} />
                                                <RechartsTooltip contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }} />
                                                <Bar dataKey="count" name="Solicitudes" fill="#2563EB" radius={[6, 6, 0, 0]}>
                                                    {deptoData.map((entry: any, index: number) => (
                                                        <Cell key={`cell-${index}`} fill={entry.count > 0 ? '#2563EB' : '#E5E7EB'} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
                                <CardHeader className="p-8 pb-4 border-b border-neutral-50">
                                    <CardTitle className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                                        <Flag className="h-4 w-4 text-primary" /> Top Partidos Políticos
                                    </CardTitle>
                                    <CardDescription className="text-[9px] font-bold uppercase tracking-widest">Participación total por agrupación política</CardDescription>
                                </CardHeader>
                                <CardContent id="partidos-chart" className="p-10 bg-white">
                                    <div className="h-[400px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={partyData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E5E5" />
                                                <XAxis type="number" style={{ fontSize: '9px', fontWeight: 'bold' }} />
                                                <YAxis dataKey="name" type="category" width={180} style={{ fontSize: '8px', fontWeight: '900', textTransform: 'uppercase' }} />
                                                <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                                                <Bar dataKey="value" name="Solicitudes" fill="#8B5CF6" radius={[0, 6, 6, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="lg:col-span-2 mt-8">
                                <div className="flex items-center gap-3 mb-6 px-4">
                                    <Users className="h-6 w-6 text-primary" />
                                    <h2 className="text-xl font-black uppercase tracking-tight text-primary">Desglose Detallado por Movimientos</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {(Object.entries(summary?.partyMovements || {}) as [string, Record<string, number>][])
                                        .sort((a, b) => {
                                            const totalA = Object.values(a[1]).reduce((sum, v) => sum + v, 0);
                                            const totalB = Object.values(b[1]).reduce((sum, v) => sum + v, 0);
                                            return totalB - totalA;
                                        })
                                        .map(([party, movements]) => (
                                        <Card key={party} className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden">
                                            <CardHeader className="bg-primary/5 p-6 border-b border-primary/10">
                                                <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex justify-between">
                                                    <span>{party}</span>
                                                    <span className="text-primary/60">{Object.values(movements).reduce((a: number, b: number) => a + b, 0)} TOTAL</span>
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-6">
                                                <div className="space-y-4">
                                                    {Object.entries(movements)
                                                        .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
                                                        .map(([mov, count]: [string, number]) => (
                                                            <div key={mov} className="flex justify-between items-center group">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] font-black uppercase tracking-tighter text-neutral-800">{mov}</span>
                                                                    <div className="h-1 bg-neutral-100 w-full mt-1 rounded-full overflow-hidden">
                                                                        <div 
                                                                            className="h-full bg-primary/40 group-hover:bg-primary transition-all" 
                                                                            style={{ width: `${(count / (Object.values(movements).reduce((a: number, b: number) => a + b, 0) as number)) * 100}%` }} 
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <span className="text-xs font-black text-primary bg-primary/5 px-2 py-1 rounded-lg ml-4">{count}</span>
                                                            </div>
                                                        ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>

                            <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
                                <CardHeader className="p-8 pb-4 border-b border-neutral-50">
                                    <CardTitle className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                                        <ClipboardCheck className="h-4 w-4 text-primary" /> Distribución por Tipo
                                    </CardTitle>
                                    <CardDescription className="text-[9px] font-bold uppercase tracking-widest">Capacitación vs Divulgación</CardDescription>
                                </CardHeader>
                                <CardContent id="tipo-chart" className="p-10 pb-16 bg-white">
                                    <div className="h-[350px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={typeData}
                                                    cx="50%" cy="50%" 
                                                    innerRadius={80}
                                                    outerRadius={120}
                                                    paddingAngle={10}
                                                    dataKey="value"
                                                >
                                                    {typeData.map((entry: any, index: number) => (
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
                        </div>

                        {summary.usageStats?.deptoStats && (
                            <div className="mt-12">
                                <div className="flex items-center gap-3 mb-6 px-4">
                                    <AlertTriangle className="h-6 w-6 text-red-500" />
                                    <h2 className="text-xl font-black uppercase tracking-tight text-red-600">Productividad Territorial por Departamento</h2>
                                </div>
                                <div id="depto-cards-container" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8 p-4 bg-slate-50/50 rounded-3xl">
                                    {Object.entries(summary.usageStats.deptoStats)
                                        .sort((a, b) => a[0].localeCompare(b[0]))
                                        .map(([depto, stats]: [string, any]) => {
                                            const percentUsados = stats.total > 0 ? Math.round((stats.usados / stats.total) * 100) : 0;
                                            const isComplete = stats.faltantes === 0;
                                            
                                            return (
                                                <Card key={depto} className="border-none shadow-lg rounded-[2rem] bg-white overflow-hidden flex flex-col">
                                                    <CardHeader className={cn("p-5 border-b flex-shrink-0", isComplete ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100")}>
                                                        <CardTitle className={cn("text-[11px] font-black uppercase tracking-widest flex flex-col gap-1", isComplete ? "text-emerald-700" : "text-red-700")}>
                                                            <span className="leading-tight">{depto}</span>
                                                            <span className="text-[14px]">{percentUsados}% USO</span>
                                                        </CardTitle>
                                                        <CardDescription className="text-[9px] font-bold mt-1 text-slate-500">
                                                            {stats.usados} de {stats.total} distritos productivos
                                                        </CardDescription>
                                                        <div className="h-1.5 w-full bg-neutral-200 mt-3 rounded-full overflow-hidden flex">
                                                            <div className="h-full bg-emerald-500" style={{ width: `${percentUsados}%` }} />
                                                            <div className="h-full bg-red-400" style={{ width: `${100 - percentUsados}%` }} />
                                                        </div>
                                                    </CardHeader>
                                                    
                                                    <CardContent className="p-5 bg-white flex-1 flex flex-col gap-5">
                                                        {stats.usadosNombres && stats.usadosNombres.length > 0 && (
                                                            <div>
                                                                <p className="text-[11px] font-black uppercase text-emerald-600 mb-2.5">Completados ({stats.usados}):</p>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {stats.usadosNombres.sort().map((dist: string) => (
                                                                        <span key={dist} className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-md border border-emerald-200 shadow-sm">
                                                                            {dist}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        
                                                        {!isComplete && stats.faltantesNombres && stats.faltantesNombres.length > 0 && (
                                                            <div>
                                                                <p className="text-[11px] font-black uppercase text-red-600 mb-2.5">Faltan ({stats.faltantes}):</p>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {stats.faltantesNombres.sort().map((dist: string) => (
                                                                        <span key={dist} className="text-[10px] font-black uppercase text-red-700 bg-red-50 px-2.5 py-1.5 rounded-md border border-red-200 shadow-sm">
                                                                            {dist}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                </div>
                            </div>
                        )}

                        <Card className="border-none shadow-xl bg-white rounded-[2rem] overflow-hidden mt-8">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase">
                                        Última Actualización: {new Date(summary.lastUpdate).toLocaleString()} por {summary.updatedBy}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                        <span className="text-[9px] font-black uppercase text-green-600">Datos Sincronizados</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </main>
        </div>
    );
}
