"use client";

import { useState, useMemo, useEffect } from "react";
import Header from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUser, useFirebase, useDocOnce } from "@/firebase";
import { collection, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Loader2, RefreshCw, BarChart3, Users, ClipboardCheck, Building2, Flag, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn, normalizeGeo } from "@/lib/utils";

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

            // 1. Departamentos base
            const deptoList = [...new Set(allDatos.map((d: any) => d.departamento))].sort();
            const deptoMap: any = {};
            deptoList.forEach(name => {
                const cod = name.split(' - ')[0] || "99";
                deptoMap[name] = { name, cod, count: 0 };
            });

            // 2. Agregación de Datos Jerárquica
            const parties: Record<string, number> = {};
            const partyMovements: Record<string, Record<string, number>> = {};
            const types = { divulgacion: 0, capacitacion: 0 };
            const deptos: Record<string, number> = {};
            let total = 0;

            solicitudes.forEach((s: any) => {
                if (s.cancelada) return;

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

            // 4. Guardar Resumen Jerárquico
            await setDoc(doc(firestore, 'stats-summary', 'solicitudes'), {
                lastUpdate: new Date().toISOString(),
                totalSolicitudes: total,
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
                                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Presencia Territorial</p>
                                            <h2 className="text-4xl font-black text-green-600">{deptoData?.filter((d: any) => d.count > 0).length || 0}</h2>
                                        </div>
                                        <MapPin className="h-10 w-10 text-green-600 opacity-20 group-hover:opacity-40 transition-opacity" />
                                    </div>
                                    <p className="text-[9px] font-bold text-muted-foreground mt-1 uppercase">Departamentos con pedidos realizados</p>
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
                                <CardContent className="p-10 bg-white">
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
                                <CardContent className="p-10 bg-white">
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
                                <CardContent className="p-10 pb-16 bg-white">
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

                        <Card className="border-none shadow-xl bg-white rounded-[2rem] overflow-hidden">
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
