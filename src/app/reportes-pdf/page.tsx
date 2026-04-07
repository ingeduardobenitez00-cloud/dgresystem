
"use client";

import { useState, useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useFirebase, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { 
  FilePieChart, 
  Download, 
  Filter, 
  Loader2, 
  Users, 
  BarChart, 
  Smile, 
  ChevronRight, 
  MapPin,
  TrendingUp,
  FileCheck2,
  Calendar
} from 'lucide-react';
import { 
  BarChart as ReBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart as RePieChart,
  Pie
} from 'recharts';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { type InformeDivulgador, type EncuestaSatisfaccion, type Dato } from '@/lib/data';
import { formatDateToDDMMYYYY } from '@/lib/utils';

export default function ReportesPDFPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  
  const [selectedDepto, setSelectedDepto] = useState<string>('all');
  const [selectedDistrito, setSelectedDistrito] = useState<string>('all');
  const [isGenerating, setIsGenerating] = useState(false);

  // Cargar datos geográficos para filtros
  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData } = useCollection<Dato>(datosQuery);

  const departments = useMemo(() => {
    if (!datosData) return [];
    return [...new Set(datosData.map(d => d.departamento))].sort();
  }, [datosData]);

  const districts = useMemo(() => {
    if (!datosData || selectedDepto === 'all') return [];
    return [...new Set(datosData.filter(d => d.departamento === selectedDepto).map(d => d.distrito))].sort();
  }, [datosData, selectedDepto]);

  // Cargar Informes (Capacitados)
  const informesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    let q = query(collection(firestore, 'informes-divulgador'), orderBy('fecha', 'desc'));
    if (selectedDepto !== 'all') {
      q = query(collection(firestore, 'informes-divulgador'), where('departamento', '==', selectedDepto), orderBy('fecha', 'desc'));
    }
    return q;
  }, [firestore, selectedDepto]);
  
  const { data: informesData, isLoading: loadingInformes } = useCollection<InformeDivulgador>(informesQuery);

  // Cargar Encuestas (Satisfacción)
  const encuestasQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    let q = query(collection(firestore, 'encuestas-satisfaccion'), orderBy('fecha', 'desc'));
    if (selectedDepto !== 'all') {
      q = query(collection(firestore, 'encuestas-satisfaccion'), where('departamento', '==', selectedDepto), orderBy('fecha', 'desc'));
    }
    return q;
  }, [firestore, selectedDepto]);

  const { data: encuestasData, isLoading: loadingEncuestas } = useCollection<EncuestaSatisfaccion>(encuestasQuery);

  // Procesar Estadísticas
  const stats = useMemo(() => {
    if (!informesData || !encuestasData) return null;

    let filteredInformes = informesData;
    let filteredEncuestas = encuestasData;

    if (selectedDistrito !== 'all') {
      filteredInformes = informesData.filter(i => i.distrito === selectedDistrito);
      filteredEncuestas = encuestasData.filter(e => e.distrito === selectedDistrito);
    }

    // Totales de capacitados
    const totalCapacitados = filteredInformes.reduce((acc, curr) => acc + (curr.total_personas || 0), 0);
    
    // Agrupación por Distrito para el gráfico
    const distritosMap: Record<string, number> = {};
    filteredInformes.forEach(inf => {
      distritosMap[inf.distrito] = (distritosMap[inf.distrito] || 0) + (inf.total_personas || 0);
    });

    const chartData = Object.entries(distritosMap).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10 distritos

    // Estadísticas de Satisfacción
    const satisfactionMap: Record<string, number> = {
      muy_util: 0,
      util: 0,
      poco_util: 0,
      nada_util: 0
    };

    filteredEncuestas.forEach(enc => {
      if (enc.utilidad_maquina) {
        satisfactionMap[enc.utilidad_maquina]++;
      }
    });

    const pieData = Object.entries(satisfactionMap).map(([name, value]) => ({
      name: name.replace('_', ' ').toUpperCase(),
      value
    }));

    // Agrupación por Departamento para la Matriz
    const deptoMap: Record<string, any> = {};
    const activeDeptos = selectedDepto === 'all' ? departments : [selectedDepto];

    activeDeptos.forEach(depto => {
      const deptoInformes = filteredInformes.filter(i => i.departamento === depto);
      const deptoEncuestas = filteredEncuestas.filter(e => e.departamento === depto);
      
      const distritosDeptoMap: Record<string, any> = {};
      
      deptoInformes.forEach(inf => {
        if (!distritosDeptoMap[inf.distrito]) {
          distritosDeptoMap[inf.distrito] = { name: inf.distrito, value: 0, surveys: 0 };
        }
        distritosDeptoMap[inf.distrito].value += (inf.total_personas || 0);
      });

      deptoEncuestas.forEach(enc => {
        if (distritosDeptoMap[enc.distrito]) {
          distritosDeptoMap[enc.distrito].surveys++;
        }
      });

      const districtList = Object.values(distritosDeptoMap).sort((a: any, b: any) => b.value - a.value);
      
      if (districtList.length > 0) {
        deptoMap[depto] = {
          name: depto,
          districts: districtList,
          totalCapacitados: districtList.reduce((acc: number, curr: any) => acc + curr.value, 0),
          totalEncuestas: districtList.reduce((acc: number, curr: any) => acc + curr.surveys, 0)
        };
      }
    });

    return {
      totalCapacitados,
      totalEncuestas: filteredEncuestas.length,
      chartData,
      pieData,
      filteredInformes,
      filteredEncuestas,
      deptoGrouped: Object.values(deptoMap).sort((a: any, b: any) => b.totalCapacitados - a.totalCapacitados)
    };
  }, [informesData, encuestasData, selectedDistrito, selectedDepto, departments]);

  const generatePDF = async () => {
    if (!stats) return;
    setIsGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;

      // Encabezado
      doc.setFillColor(31, 41, 55);
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text("REPORTE INSTITUCIONAL CIDEE 2026", pageWidth / 2, 18, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`JUSTICIA ELECTORAL - DIRECCIÓN GENERAL DEL REGISTRO ELECTORAL`, pageWidth / 2, 28, { align: 'center' });
      doc.text(`Generado el: ${new Date().toLocaleString()}`, pageWidth / 2, 34, { align: 'center' });

      // Resumen Ejecutivo
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text("1. RESUMEN EJECUTIVO", 15, 55);

      autoTable(doc, {
        startY: 60,
        head: [['Métrica', 'Alcance Logrado']],
        body: [
          ['Total Personas Capacitadas', stats.totalCapacitados.toString()],
          ['Total Encuestas Realizadas', stats.totalEncuestas.toString()],
          ['Jurisdicción', selectedDepto === 'all' ? 'Nacional' : `${selectedDepto} - ${selectedDistrito === 'all' ? 'Todos los Distritos' : selectedDistrito}`]
        ],
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] }
      });

      // Detalle por Distrito (Capacitados)
      doc.text("2. DETALLE DE CAPACITADOS POR DISTRITO", 15, (doc as any).lastAutoTable.finalY + 15);

      const districtRows = stats.chartData.map(d => [d.name, d.value.toString()]);
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Distrito', 'Cantidad de Capacitados']],
        body: districtRows,
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] }
      });

      // Estadísticas de Satisfacción
      doc.text("3. INDICADORES DE SATISFACCIÓN (ANEXO II)", 15, (doc as any).lastAutoTable.finalY + 15);
      
      const satisfactionRows = stats.pieData.map(d => [d.name, d.value.toString()]);
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Nivel de Utilidad Percibida', 'Frecuencia']],
        body: satisfactionRows,
        theme: 'striped',
        headStyles: { fillColor: [245, 158, 11] }
      });

      // Footer
      const totalPages = doc.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${totalPages} - Sistema de Gestión CIDEE 2026`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
      }

      doc.save(`Reporte_Estadistico_${selectedDepto === 'all' ? 'NACIONAL' : selectedDepto}_${new Date().getTime()}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

  if (isUserLoading || loadingInformes || loadingEncuestas) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8F9FA]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-xs font-black uppercase tracking-widest animate-pulse">Cargando Inteligencia de Datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Reportes PDF y Estadísticas" />
      
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        {/* FILTROS ESTRATÉGICOS */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end bg-white p-8 rounded-[2rem] shadow-xl border-t-4 border-primary">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <MapPin className="h-3 w-3" /> Departamento
            </Label>
            <Select value={selectedDepto} onValueChange={(v) => { setSelectedDepto(v); setSelectedDistrito('all'); }}>
              <SelectTrigger className="h-12 border-2 font-bold rounded-xl bg-muted/20">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">TODOS LOS DEPARTAMENTOS</SelectItem>
                {departments.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Distrito</Label>
            <Select value={selectedDistrito} onValueChange={setSelectedDistrito} disabled={selectedDepto === 'all'}>
              <SelectTrigger className="h-12 border-2 font-bold rounded-xl bg-muted/20">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">TODOS LOS DISTRITOS</SelectItem>
                {districts.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2 flex gap-4">
            <Button 
                onClick={generatePDF}
                disabled={isGenerating || !stats}
                className="flex-1 h-12 bg-black hover:bg-black/90 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-xl gap-2 border-b-4 border-gray-800"
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              GENERAR REPORTE INSTITUCIONAL (PDF)
            </Button>
          </div>
        </section>

        {/* INDICADORES CLAVE */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="rounded-3xl border-none shadow-lg bg-gradient-to-br from-blue-600 to-blue-800 text-white overflow-hidden relative">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-black uppercase tracking-widest opacity-80">Total Capacitados</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-5xl font-black">{stats?.totalCapacitados}</div>
                <div className="text-[10px] font-bold uppercase mt-2 opacity-60">Personas alcanzadas según informes oficiales</div>
                <Users className="absolute -bottom-4 -right-4 h-24 w-24 opacity-10" />
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-none shadow-lg bg-white overflow-hidden relative">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Encuestas de Satisfacción</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-5xl font-black text-primary">{stats?.totalEncuestas}</div>
                <div className="text-[10px] font-bold uppercase mt-2 text-muted-foreground">Registros recopilados (Anexo II)</div>
                <Smile className="absolute -bottom-4 -right-4 h-24 w-24 text-primary opacity-5" />
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-none shadow-lg bg-white overflow-hidden relative border-l-4 border-green-500">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Productividad Media</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-5xl font-black text-green-600">
                    {stats && stats.totalEncuestas > 0 ? (stats.totalCapacitados / (informesData?.length || 1)).toFixed(1) : 0}
                </div>
                <div className="text-[10px] font-bold uppercase mt-2 text-muted-foreground">Promedio de personas por sesión</div>
                <TrendingUp className="absolute -bottom-4 -right-4 h-24 w-24 text-green-600 opacity-5" />
            </CardContent>
          </Card>
        </div>

        {/* VISUALIZACIÓN DE DATOS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* GRÁFICO DE BARRAS */}
            <Card className="rounded-[2.5rem] border-none shadow-2xl bg-white overflow-hidden">
                <CardHeader className="p-8 pb-0">
                    <CardTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
                        <BarChart className="h-6 w-6 text-primary" /> Alcance por Distrito (Top 10)
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-1">Comparativa de productividad institucional</CardDescription>
                </CardHeader>
                <CardContent className="p-8 h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ReBarChart data={stats?.chartData || []} layout="vertical" margin={{ left: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} style={{ fontSize: '9px', fontWeight: 'bold' }} />
                            <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            <Bar dataKey="value" fill="#3B82F6" radius={[0, 10, 10, 0]} barSize={25}>
                                {(stats?.chartData || []).map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </ReBarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* GRÁFICO CIRCULAR */}
            <Card className="rounded-[2.5rem] border-none shadow-2xl bg-white overflow-hidden">
                <CardHeader className="p-8 pb-0">
                    <CardTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
                        <FilePieChart className="h-6 w-6 text-orange-500" /> Percepción de Utilidad
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-1">Métricas de satisfacción ciudadana con la máquina</CardDescription>
                </CardHeader>
                <CardContent className="p-8 flex items-center justify-center h-[400px]">
                    <div className="w-full h-full flex flex-col md:flex-row items-center gap-8">
                        <div className="flex-1 h-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <RePieChart>
                                    <Pie
                                        data={stats?.pieData || []}
                                        innerRadius={80}
                                        outerRadius={120}
                                        paddingAngle={8}
                                        dataKey="value"
                                    >
                                        {(stats?.pieData || []).map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </RePieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex flex-col gap-4">
                            {stats?.pieData.map((d, i) => (
                                <div key={d.name} className="flex items-center gap-3">
                                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase leading-none">{d.name}</span>
                                        <span className="text-[12px] font-bold text-muted-foreground">{d.value} VOTOS</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* MATRIZ TERRITORIAL CON ACORDEONES */}
        <Card className="rounded-[2.5rem] border-none shadow-2xl bg-white overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-8">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                            <FileCheck2 className="h-6 w-6 text-indigo-400" /> Matriz Jurisdiccional de Datos
                        </CardTitle>
                        <CardDescription className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Reportes agrupados por Departamento y Distrito</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                <Accordion type="multiple" className="space-y-4">
                    {stats?.deptoGrouped.map((depto: any) => (
                        <AccordionItem 
                            key={depto.name} 
                            value={depto.name} 
                            className="border-none bg-slate-50/50 rounded-2xl overflow-hidden px-4"
                        >
                            <AccordionTrigger className="hover:no-underline py-5 pr-4">
                                <div className="flex flex-1 items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-xl bg-black text-white flex items-center justify-center font-black text-xs">
                                            {depto.name.substring(0, 2)}
                                        </div>
                                        <div className="flex flex-col text-left">
                                            <span className="text-sm font-black uppercase tracking-tight text-slate-800">{depto.name}</span>
                                            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                                                {depto.districts.length} DISTRITOS
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="hidden md:flex flex-col items-end">
                                            <span className="text-xs font-black text-slate-700">{depto.totalCapacitados.toLocaleString()}</span>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Capacitados</span>
                                        </div>
                                        <div className="hidden md:flex flex-col items-end">
                                            <span className="text-xs font-black text-slate-700">{depto.totalEncuestas.toLocaleString()}</span>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Encuestas</span>
                                        </div>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-6 pt-2">
                                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-inner">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-50 border-b">
                                            <tr>
                                                <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-500">Distrito</th>
                                                <th className="px-6 py-4 text-[9px] font-black uppercase text-primary text-center">Capacitados</th>
                                                <th className="px-6 py-4 text-[9px] font-black uppercase text-muted-foreground text-center">Encuestas</th>
                                                <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-500 text-right">% Depto</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {depto.districts.map((dist: any) => (
                                                <tr key={dist.name} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <span className="text-[10px] font-bold uppercase text-slate-700">{dist.name}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center font-black text-primary text-xs">
                                                        {dist.value.toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4 text-center font-bold text-muted-foreground text-xs">
                                                        {dist.surveys}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <Badge variant="outline" className="font-black border-2 text-[9px] text-slate-500">
                                                            {((dist.value / depto.totalCapacitados) * 100).toFixed(1)}%
                                                        </Badge>
                                                    </td>
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

      </main>

      <footer className="w-full py-8 px-4 text-center border-t bg-white/50 mt-12">
        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
          © 2026 Dpto. Informática DGRE - TSJE | Sistema de Inteligencia y Reportes Institucionales
        </p>
      </footer>
    </div>
  );
}
