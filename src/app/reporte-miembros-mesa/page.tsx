"use client";

import React, { useState, useMemo, useEffect } from "react";
import Header from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUser, useFirebase, useDocOnce } from "@/firebase";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Loader2, Users, ClipboardCheck, Building2, User, UserPlus, RefreshCw, Printer, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { cn, formatDateToDDMMYYYY } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HistoricalToggle } from "@/components/historical-toggle";

const COLORS = ['#2563EB', '#EC4899']; // Blue for Hombres, Pink for Mujeres

export default function ReporteMiembrosMesaPage() {
    const { user } = useUser();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isSyncing, setIsSyncing] = useState(false);

    const isAdmin = ['admin', 'director', 'coordinador'].includes(user?.profile?.role || '') || user?.isOwner;

    const [isHistorical, setIsHistorical] = useState(false);

    // Leer resumen
    const statsDocRef = useMemo(() => {
        if (!firestore) return null;
        const docName = isHistorical ? 'miembros-mesa_internas_2026' : 'miembros-mesa';
        return doc(firestore, 'stats-summary', docName);
    }, [firestore, isHistorical]);
    
    const { data: stats, isLoading: isLoadingStats } = useDocOnce<any>(statsDocRef);

    const handleSync = async () => {
        if (!firestore || !isAdmin) return;
        setIsSyncing(true);
        try {
            toast({ title: "Sincronizando...", description: "Calculando estadísticas de Miembros de Mesa..." });

            const colName = isHistorical ? 'solicitudes-capacitacion_internas_2026' : 'solicitudes-capacitacion';
            const solicitudesSnap = await getDocs(collection(firestore, colName));
            const allSolicitudes = solicitudesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Obtener todos los informes para cruzar datos
            const informesColName = isHistorical ? 'informes-divulgador_internas_2026' : 'informes-divulgador';
            const informesSnap = await getDocs(collection(firestore, informesColName));
            const allInformes = informesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            const informesBySol = allInformes.reduce((acc: any, inf: any) => {
                if (!acc[inf.solicitud_id]) acc[inf.solicitud_id] = [];
                acc[inf.solicitud_id].push(inf);
                return acc;
            }, {});

            // Obtener todos los departamentos y distritos base
            const datosSnap = await getDocs(collection(firestore, 'datos'));
            const allDatos = datosSnap.docs.map(d => d.data());

            let totalHombres = 0;
            let totalMujeres = 0;
            let totalCapacitados = 0;
            let totalSesiones = 0;

            const deptosMap: Record<string, { 
                hombres: number, 
                mujeres: number, 
                total: number, 
                distritos: Record<string, { 
                    hombres: number, 
                    mujeres: number, 
                    total: number,
                    actividades: Array<{
                        nombre: string,
                        lugar: string,
                        fecha: string,
                        hombres: number,
                        mujeres: number,
                        total: number
                    }>
                }> 
            }> = {};
            
            // Pre-poblar el mapa con todos los departamentos y distritos en 0
            allDatos.forEach((d: any) => {
                const dept = d.departamento;
                const dist = d.distrito;
                if (!dept) return;
                
                if (!deptosMap[dept]) {
                    deptosMap[dept] = { hombres: 0, mujeres: 0, total: 0, distritos: {} };
                }
                if (dist && !deptosMap[dept].distritos[dist]) {
                    deptosMap[dept].distritos[dist] = { hombres: 0, mujeres: 0, total: 0, actividades: [] };
                }
            });

            allSolicitudes.forEach((sol: any) => {
                if (sol.cancelada) return;

                const isMM = sol.es_capacitacion_mm || (sol.tipo_solicitud || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes('capacitacion');
                
                const informes = informesBySol[sol.id] || [];
                
                let h = 0;
                let m = 0;
                let total = 0;

                if (informes.length > 0) {
                    informes.forEach((inf: any) => {
                        const infTotal = inf.total_personas || 0;
                        total += infTotal;
                        
                        const infH = inf.cant_hombres || 0;
                        const infM = inf.cant_mujeres || 0;
                        
                        if (infH > 0 || infM > 0) {
                            h += infH;
                            m += infM;
                        } else {
                            // Si el informe no detalla géneros, sacamos la proporción de la solicitud original
                            const origH = sol.cant_hombres || 0;
                            const origM = sol.cant_mujeres || 0;
                            const origTotal = origH + origM;
                            
                            if (origTotal > 0) {
                                const propH = origH / origTotal;
                                h += Math.round(infTotal * propH);
                                m += infTotal - Math.round(infTotal * propH);
                            } else {
                                // 50/50 fallback
                                h += Math.floor(infTotal / 2);
                                m += Math.ceil(infTotal / 2);
                            }
                        }
                    });
                } else {
                    // Si no tiene informes (aún no se cargó el retorno de la capacitación), 
                    // usamos los datos preliminares/agendados de la solicitud original.
                    h = sol.cant_hombres || 0;
                    m = sol.cant_mujeres || 0;
                    total = h + m;
                }

                if (isMM && total > 0) {
                    totalHombres += h;
                    totalMujeres += m;
                    totalCapacitados += total;
                    totalSesiones++;

                    const dept = sol.departamento || 'SIN ESPECIFICAR';
                    const dist = sol.distrito || 'SIN ESPECIFICAR';
                    
                    if (!deptosMap[dept]) {
                        deptosMap[dept] = { hombres: 0, mujeres: 0, total: 0, distritos: {} };
                    }
                    if (!deptosMap[dept].distritos[dist]) {
                        deptosMap[dept].distritos[dist] = { hombres: 0, mujeres: 0, total: 0, actividades: [] };
                    }

                    deptosMap[dept].hombres += h;
                    deptosMap[dept].mujeres += m;
                    deptosMap[dept].total += total;

                    deptosMap[dept].distritos[dist].hombres += h;
                    deptosMap[dept].distritos[dist].mujeres += m;
                    deptosMap[dept].distritos[dist].total += total;

                    // Determine activity name
                    let actNombre = sol.solicitante_entidad || '';
                    if (actNombre === 'Otra' && sol.otra_entidad) actNombre = sol.otra_entidad;
                    if (!actNombre) actNombre = 'ACTIVIDAD SIN NOMBRE';

                    // Determine location
                    const actLugar = sol.lugar_local || sol.direccion_calle || 'Sin lugar';

                    deptosMap[dept].distritos[dist].actividades.push({
                        nombre: actNombre,
                        lugar: actLugar,
                        fecha: sol.fecha || '',
                        hombres: h,
                        mujeres: m,
                        total: total
                    });
                }
            });

            const deptoData = Object.entries(deptosMap)
                .map(([name, data]) => ({ 
                    name, 
                    codigo: name.split(' - ')[0] || '99',
                    ...data 
                }))
                .sort((a, b) => a.codigo.localeCompare(b.codigo));

            const genderData = [
                { name: 'HOMBRES', value: totalHombres },
                { name: 'MUJERES', value: totalMujeres }
            ];

            const summary = {
                totalHombres,
                totalMujeres,
                totalCapacitados,
                totalSesiones,
                deptoData,
                genderData,
                lastUpdate: new Date().toISOString(),
                updatedBy: user?.profile?.username || user?.email
            };

            const docName = isHistorical ? 'miembros-mesa_internas_2026' : 'miembros-mesa';
            await setDoc(doc(firestore, 'stats-summary', docName), summary);
            toast({ title: "Sincronización exitosa", description: "El reporte estadístico ha sido actualizado." });
            
            // Refrescar página para ver cambios
            window.location.reload();
        } catch (error: any) {
            console.error("Sync Error:", error);
            toast({ variant: "destructive", title: "Error en sincronización", description: error.message });
        } finally {
            setIsSyncing(false);
        }
    };

    const generatePDF = async () => {
        if (!stats) return;

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
        doc.text("REPORTE ESTADÍSTICO - MIEMBROS DE MESA", pageWidth / 2, 25, { align: "center" });
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`Fecha de Corte: ${formatDateToDDMMYYYY(stats.lastUpdate)}`, pageWidth / 2, 30, { align: "center" });
        
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
                ['Total Capacitados', stats.totalCapacitados.toLocaleString()],
                ['Total Hombres', stats.totalHombres.toLocaleString()],
                ['Total Mujeres', stats.totalMujeres.toLocaleString()],
                ['Sesiones Finalizadas', stats.totalSesiones.toLocaleString()],
                ['Última Sincronización', formatDateToDDMMYYYY(stats.lastUpdate)]
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

        const tableBody: any[] = [];
        stats.deptoData.forEach((d: any) => {
            // Fila principal del departamento
            tableBody.push([
                { content: d.name, styles: { fontStyle: 'bold', fillColor: [240, 240, 245] } },
                { content: d.hombres.toLocaleString(), styles: { fontStyle: 'bold', fillColor: [240, 240, 245] } },
                { content: d.mujeres.toLocaleString(), styles: { fontStyle: 'bold', fillColor: [240, 240, 245] } },
                { content: d.total.toLocaleString(), styles: { fontStyle: 'bold', fillColor: [240, 240, 245] } }
            ]);
            
            // Filas de los distritos (indentadas)
            const distritosOrdenados = Object.entries(d.distritos || {}).sort(([a], [b]) => a.localeCompare(b));
            distritosOrdenados.forEach(([distName, distData]: [string, any]) => {
                tableBody.push([
                    `    • ${distName}`,
                    distData.hombres.toLocaleString(),
                    distData.mujeres.toLocaleString(),
                    distData.total.toLocaleString()
                ]);
            });
        });

        autoTable(doc, {
            startY: currentY,
            head: [['Departamento', 'Hombres', 'Mujeres', 'Total Capacitados']],
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

        const chartElements = ['gender-pie-chart', 'depto-bar-chart'];
        let chartY = 30;

        for (const id of chartElements) {
            const element = document.getElementById(id);
            if (element) {
                // Título del gráfico en el PDF
                const titles: Record<string, string> = {
                    'gender-pie-chart': 'PROPORCIÓN POR SEXO',
                    'depto-bar-chart': 'ALCANCE POR DEPARTAMENTO'
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

        // Firmas
        currentY = chartY;
        if (currentY > 230) { doc.addPage(); currentY = 30; }
        
        const footerY = doc.internal.pageSize.getHeight() - 40;
        doc.setDrawColor(200);
        doc.line(margin, footerY, 80, footerY);
        doc.line(pageWidth - margin, footerY, pageWidth - 80, footerY);

        doc.setFontSize(8);
        doc.text("Lic. Benjamín Díaz Valinotti", 45, footerY + 5, { align: "center" });
        doc.text("Director General", 45, footerY + 9, { align: "center" });

        doc.text("Ing. Eduardo Benítez", pageWidth - 45, footerY + 5, { align: "center" });
        doc.text("Encargado de Informática DGRE", pageWidth - 45, footerY + 9, { align: "center" });

        doc.save(`REPORTE-MM-${new Date().getTime()}.pdf`);
    };

if (isLoadingStats) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

    return (
        <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
            <Header title="Reporte: Miembros de Mesa" />
            <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Users className="h-8 w-8 text-primary" />
                            <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Estadísticas de Miembros de Mesa</h1>
                        </div>
                        <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                            Reporte consolidado de capacitaciones a Miembros de Mesa Receptora de Votos discriminado por sexo.
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <HistoricalToggle 
                            isHistorical={isHistorical} 
                            setIsHistorical={setIsHistorical} 
                            isAdmin={!!isAdmin} 
                        />
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
                            disabled={!stats || stats.totalCapacitados === 0}
                            className="bg-primary text-white hover:bg-primary/90 font-black uppercase text-[10px] h-12 px-6 gap-2 shadow-lg"
                        >
                            <Printer className="h-4 w-4" /> Exportar PDF
                        </Button>
                    </div>
                </div>

                {!stats || stats.totalCapacitados === 0 ? (
                    <Card className="border-dashed border-2 bg-blue-50/50">
                        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                            <Users className="h-12 w-12 text-blue-500 mb-4" />
                            <h3 className="font-black uppercase text-blue-900">No hay datos procesados</h3>
                            <p className="text-xs text-blue-700 mt-2 max-w-sm font-medium">Presiona "Sincronizar Datos" para calcular las estadísticas.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden group hover:shadow-2xl transition-all">
                                <CardContent className="p-8">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Total Capacitados</p>
                                            <h2 className="text-4xl font-black text-primary">{stats.totalCapacitados.toLocaleString()}</h2>
                                        </div>
                                        <Users className="h-10 w-10 text-primary opacity-20 group-hover:opacity-40 transition-opacity" />
                                    </div>
                                    <div className="h-1 w-12 bg-primary mt-4 rounded-full" />
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden group hover:shadow-2xl transition-all">
                                <CardContent className="p-8">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-1">Total Hombres</p>
                                            <h2 className="text-4xl font-black text-blue-600">{stats.totalHombres.toLocaleString()}</h2>
                                        </div>
                                        <User className="h-10 w-10 text-blue-600 opacity-20 group-hover:opacity-40 transition-opacity" />
                                    </div>
                                    <p className="text-[9px] font-bold text-muted-foreground mt-2 uppercase">
                                        {((stats.totalHombres / stats.totalCapacitados) * 100).toFixed(1)}% del total
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden group hover:shadow-2xl transition-all">
                                <CardContent className="p-8">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-pink-600 tracking-widest mb-1">Total Mujeres</p>
                                            <h2 className="text-4xl font-black text-pink-600">{stats.totalMujeres.toLocaleString()}</h2>
                                        </div>
                                        <UserPlus className="h-10 w-10 text-pink-600 opacity-20 group-hover:opacity-40 transition-opacity" />
                                    </div>
                                    <p className="text-[9px] font-bold text-muted-foreground mt-2 uppercase">
                                        {((stats.totalMujeres / stats.totalCapacitados) * 100).toFixed(1)}% del total
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden group hover:shadow-2xl transition-all">
                                <CardContent className="p-8">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-green-600 tracking-widest mb-1">Sesiones Finalizadas</p>
                                            <h2 className="text-4xl font-black text-green-600">{stats.totalSesiones.toLocaleString()}</h2>
                                        </div>
                                        <ClipboardCheck className="h-10 w-10 text-green-600 opacity-20 group-hover:opacity-40 transition-opacity" />
                                    </div>
                                    <p className="text-[9px] font-bold text-muted-foreground mt-2 uppercase">
                                        Actividades procesadas
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            
                            <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden lg:col-span-1">
                                <CardHeader className="p-8 pb-4 border-b border-neutral-50">
                                    <CardTitle className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                                        <Users className="h-4 w-4 text-primary" /> Proporción por Sexo
                                    </CardTitle>
                                    <CardDescription className="text-[9px] font-bold uppercase tracking-widest">Distribución general Hombres vs Mujeres</CardDescription>
                                </CardHeader>
                                <CardContent id="gender-pie-chart" className="p-8 bg-white flex justify-center items-center">
                                    <div className="h-[300px] w-full max-w-sm">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={stats.genderData}
                                                    cx="50%" cy="50%" 
                                                    innerRadius={70}
                                                    outerRadius={100}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {stats.genderData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <RechartsTooltip 
                                                    contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }} 
                                                    itemStyle={{ color: '#000' }}
                                                />
                                                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', paddingTop: '20px' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden lg:col-span-2">
                                <CardHeader className="p-8 pb-4 border-b border-neutral-50">
                                    <CardTitle className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-primary" /> Alcance por Departamento
                                    </CardTitle>
                                    <CardDescription className="text-[9px] font-bold uppercase tracking-widest">Cantidad de Miembros de Mesa capacitados por zona</CardDescription>
                                </CardHeader>
                                <CardContent id="depto-bar-chart" className="p-10 bg-white">
                                    <div className="h-[300px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={stats.deptoData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
                                                <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={80} style={{ fontSize: '8px', fontWeight: '900', textTransform: 'uppercase' }} />
                                                <YAxis style={{ fontSize: '9px', fontWeight: 'bold' }} />
                                                <RechartsTooltip 
                                                    contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }} 
                                                />
                                                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', paddingBottom: '10px' }} />
                                                <Bar dataKey="hombres" name="HOMBRES" stackId="a" fill="#2563EB" />
                                                <Bar dataKey="mujeres" name="MUJERES" stackId="a" fill="#EC4899" radius={[6, 6, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                        </div>

                        <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden mt-8">
                            <CardHeader className="p-8 border-b">
                                <CardTitle className="text-sm font-black uppercase tracking-tighter">Desglose Territorial Detallado</CardTitle>
                                <CardDescription className="text-[10px] font-bold uppercase">Datos tabulados por departamento y distrito</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Accordion type="single" collapsible className="w-full">
                                    {stats.deptoData.map((depto: any) => (
                                        <AccordionItem key={depto.name} value={depto.name} className="border-b last:border-0 border-neutral-100">
                                            <AccordionTrigger className="px-8 py-6 hover:bg-neutral-50/50 hover:no-underline group">
                                                <div className="flex items-center gap-6 w-full text-left">
                                                    <div className="h-10 w-10 rounded-xl bg-neutral-100 flex items-center justify-center font-black text-xs text-neutral-400 group-data-[state=open]:bg-primary group-data-[state=open]:text-white transition-colors">
                                                        {depto.codigo}
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className="font-black text-[13px] uppercase tracking-tight">{depto.name}</h4>
                                                        <p className="text-[9px] font-bold text-muted-foreground uppercase">{Object.keys(depto.distritos || {}).length} Distritos Reportando</p>
                                                    </div>
                                                    <div className="flex gap-12 pr-6">
                                                        <div className="text-center">
                                                            <p className="text-[11px] font-black text-blue-600">{depto.hombres.toLocaleString()}</p>
                                                            <p className="text-[7px] font-bold uppercase text-muted-foreground">Hombres</p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-[11px] font-black text-pink-600">{depto.mujeres.toLocaleString()}</p>
                                                            <p className="text-[7px] font-bold uppercase text-muted-foreground">Mujeres</p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-[11px] font-black text-primary">{depto.total.toLocaleString()}</p>
                                                            <p className="text-[7px] font-bold uppercase text-muted-foreground">Total</p>
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
                                                                <th className="px-6 py-4 text-[9px] font-black uppercase text-blue-600 text-right">Hombres</th>
                                                                <th className="px-6 py-4 text-[9px] font-black uppercase text-pink-600 text-right">Mujeres</th>
                                                                <th className="px-6 py-4 text-[9px] font-black uppercase text-primary text-right">Total Capacitados</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {Object.entries(depto.distritos || {}).sort(([a], [b]) => a.localeCompare(b)).map(([distName, distData]: [string, any]) => (
                                                                <DistrictRow key={distName} distName={distName} distData={distData} />
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

                        <Card className="border-none shadow-xl bg-white rounded-[2rem] overflow-hidden mt-8">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase">
                                        Última Actualización: {new Date(stats.lastUpdate).toLocaleString()} por {stats.updatedBy}
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

function DistrictRow({ distName, distData }: { distName: string, distData: any }) {
    const [expanded, setExpanded] = useState(false);
    const hasActivities = distData.actividades && distData.actividades.length > 0;

    return (
        <React.Fragment>
            <tr 
                onClick={() => { if (hasActivities) setExpanded(!expanded) }}
                className={cn(
                    "border-b border-neutral-100 transition-colors",
                    hasActivities ? "cursor-pointer hover:bg-neutral-50" : ""
                )}
            >
                <td className="px-8 py-3.5 text-[11px] font-black uppercase text-slate-700">
                    <div className="flex items-center gap-2">
                        {hasActivities ? (
                            expanded ? <ChevronDown className="h-3 w-3 text-slate-400" /> : <ChevronRight className="h-3 w-3 text-slate-400" />
                        ) : (
                            <div className="w-3" />
                        )}
                        {distName}
                    </div>
                </td>
                <td className="px-6 py-3.5 text-[11px] font-black text-right text-blue-600">{distData.hombres.toLocaleString()}</td>
                <td className="px-6 py-3.5 text-[11px] font-black text-right text-pink-600">{distData.mujeres.toLocaleString()}</td>
                <td className="px-6 py-3.5 text-[11px] font-black text-right text-primary">{distData.total.toLocaleString()}</td>
            </tr>
            {expanded && hasActivities && distData.actividades.map((act: any, idx: number) => (
                <tr key={`${distName}-act-${idx}`} className="bg-neutral-50/50 border-b border-neutral-100 last:border-0 hover:bg-white transition-colors">
                    <td className="px-8 py-2.5 pl-14 text-[10px] font-semibold text-slate-600">
                        <div className="flex flex-col">
                            <span className="font-bold text-slate-700 uppercase truncate max-w-[300px]">{act.nombre}</span>
                            <span className="text-[9px] opacity-70 truncate max-w-[300px]">{act.lugar} {act.fecha ? `| ${act.fecha}` : ''}</span>
                        </div>
                    </td>
                    <td className="px-6 py-2.5 text-[10px] font-semibold text-right text-blue-500/80">{act.hombres.toLocaleString()}</td>
                    <td className="px-6 py-2.5 text-[10px] font-semibold text-right text-pink-500/80">{act.mujeres.toLocaleString()}</td>
                    <td className="px-6 py-2.5 text-[10px] font-bold text-right text-primary/80">{act.total.toLocaleString()}</td>
                </tr>
            ))}
        </React.Fragment>
    );
}
