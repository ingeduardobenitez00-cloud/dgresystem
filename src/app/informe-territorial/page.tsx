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
  MapPin,
  TrendingUp,
  FileCheck2,
  Table as TableIcon,
  UserCheck,
  UserX,
  AlertCircle,
  ChevronRight
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
import { cn } from '@/lib/utils';

export default function InformeTerritorialPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  
  const [selectedDeptoFilter, setSelectedDeptoFilter] = useState<string>('all');
  const [isGenerating, setIsGenerating] = useState(false);

  // 1. Cargar Datos Geográficos
  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData, isLoading: loadingDatos } = useCollection<Dato>(datosQuery);

  const departments = useMemo(() => {
    if (!datosData) return [];
    return [...new Set(datosData.map(d => d.departamento))].sort();
  }, [datosData]);

  // 2. Cargar Informes (Capacitados)
  const informesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'informes-divulgador'));
  }, [firestore]);
  const { data: informesData, isLoading: loadingInformes } = useCollection<InformeDivulgador>(informesQuery);

  // 3. Cargar Encuestas (Satisfacción)
  const encuestasQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'encuestas-satisfaccion'));
  }, [firestore]);
  const { data: encuestasData, isLoading: loadingEncuestas } = useCollection<EncuestaSatisfaccion>(encuestasQuery);

  // 4. Cargar Usuarios
  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'));
  }, [firestore]);
  const { data: usersData, isLoading: loadingUsers } = useCollection<any>(usersQuery);

  // 5. Cargar Presencia (para Usuarios Fantasmas)
  const presenceQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'presencia'));
  }, [firestore]);
  const { data: presenceData, isLoading: loadingPresence } = useCollection<any>(presenceQuery);

  // PROCESAMIENTO DE DATOS AGRUPADO POR DEPARTAMENTO
  const stats = useMemo(() => {
    if (!datosData || !informesData || !encuestasData || !usersData || !presenceData) return null;

    const deptoMap: Record<string, any> = {};
    const filteredDepts = selectedDeptoFilter === 'all' 
        ? departments 
        : departments.filter(d => d === selectedDeptoFilter);

    let totalDistritosContados = 0;
    let distritosConUsuario = 0;

    filteredDepts.forEach(depto => {
        // Filtramos para asegurar que solo incluimos lo que tengan el patrón "00 - 01 - 02"
        // y descartamos oficinas como CIDEE, SEDE CENTRAL, etc.
        const districtsList = [...new Set(datosData
            .filter(d => d.departamento === depto)
            .map(d => d.distrito))]
            .filter(dist => /^\d{2}\s*-\s*\d{2}/.test(dist)) // Filtro por patrón numérico
            .sort();
        
        const matrix = districtsList.map(dist => {
            const infDist = informesData.filter(i => i.departamento === depto && i.distrito === dist);
            const encDist = encuestasData.filter(e => e.departamento === depto && e.distrito === dist);
            const usersDist = usersData.filter((u: any) => u.departamento === depto && u.distrito === dist);
            const presDist = presenceData.filter((p: any) => p.departamento === depto && p.distrito === dist);
            
            // Usuarios Activos vs Inactivos
            const activeUsersCount = usersDist.filter((u: any) => u.active !== false).length;
            const inactiveUsersCount = usersDist.filter((u: any) => u.active === false).length;

            // Usuarios Fantasmas (En presencia pero no en users)
            const userEmails = new Set(usersData.map((u: any) => u.email?.toLowerCase()));
            const ghostUsersCount = presDist.filter((p: any) => p.email && !userEmails.has(p.email.toLowerCase())).length;

            const totalTrained = infDist.reduce((acc, curr) => acc + (curr.total_personas || 0), 0);
            const totalSurveys = encDist.length;
            
            const totalUsers = usersDist.length + ghostUsersCount;
            const pendingUsers = inactiveUsersCount + ghostUsersCount;
            const pendingPercentage = totalUsers > 0 ? (pendingUsers / totalUsers) * 100 : 0;

            totalDistritosContados++;
            if (activeUsersCount > 0) distritosConUsuario++;

            return {
                distrito: dist,
                trained: totalTrained,
                surveys: totalSurveys,
                totalUsers,
                activeUsers: activeUsersCount,
                pendingUsers,
                pendingPercentage
            };
        }); // Eliminado el filter para ver TODOS los distritos

        if (matrix.length > 0) {
            const deptoTotals = matrix.reduce((acc, curr) => ({
                trained: acc.trained + curr.trained,
                surveys: acc.surveys + curr.surveys,
                users: acc.users + curr.totalUsers,
                pending: acc.pending + curr.pendingUsers
            }), { trained: 0, surveys: 0, users: 0, pending: 0 });

            deptoMap[depto] = {
                name: depto,
                districts: matrix,
                totals: deptoTotals
            };
        }
    });

    const overallTotals = Object.values(deptoMap).reduce((acc: any, curr: any) => ({
        trained: acc.trained + curr.totals.trained,
        surveys: acc.surveys + curr.totals.surveys,
        users: acc.users + curr.totals.users,
        pending: acc.pending + curr.totals.pending
    }), { trained: 0, surveys: 0, users: 0, pending: 0 });

    const chartData = Object.values(deptoMap)
        .map((d: any) => ({ name: d.name, value: d.totals.trained }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

    return {
        deptoList: Object.values(deptoMap),
        totals: overallTotals,
        chartData,
        coverage: {
            totalDistritos: totalDistritosContados,
            conUsuario: distritosConUsuario,
            pendientes: totalDistritosContados - distritosConUsuario,
            percentage: totalDistritosContados > 0 ? (distritosConUsuario / totalDistritosContados) * 100 : 0
        },
        pendingPercentageTotal: overallTotals.users > 0 ? (overallTotals.pending / overallTotals.users) * 100 : 0
    };
  }, [datosData, informesData, encuestasData, usersData, presenceData, departments, selectedDeptoFilter]);

  const generatePDF = async () => {
    if (!stats) return;
    setIsGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;

      // FONDO DE CABECERA INSTITUCIONAL (BLANCO)
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, 50, 'F');
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.5);
      doc.line(15, 45, pageWidth - 15, 45); // Línea divisora sutil
      
      // LOGOS INSTITUCIONALES (IZQUIERDA Y DERECHA)
      try {
        doc.addImage('/logo.png', 'PNG', 15, 8, 28, 28);
        doc.addImage('/logo1.png', 'PNG', pageWidth - 43, 8, 28, 28);
      } catch (e) {
        console.warn("No se pudieron cargar los logos en el PDF", e);
      }

      doc.setTextColor(15, 23, 42); // Texto Oscuro para fondo blanco
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text("DGRE - CIDEE - TSJE | SISTEMA DEL DIVULGACION", pageWidth / 2, 18, { align: 'center' });
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text("INFORME TERRITORIAL INTEGRAL 2026", pageWidth / 2, 26, { align: 'center' });
      
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139); // Slate-500
      doc.text(`Jurisdicción: ${selectedDeptoFilter === 'all' ? 'NACIONAL' : selectedDeptoFilter} | Fecha: ${new Date().toLocaleString()}`, pageWidth / 2, 33, { align: 'center' });

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text("1. RESUMEN DE COBERTURA", 15, 65);

      autoTable(doc, {
        startY: 70,
        head: [['Métrica de Cobertura Territorial', 'Resultado']],
        body: [
          ['Total Distritos Relevados', stats.coverage.totalDistritos.toString()],
          ['Distritos con Personal Activo', stats.coverage.conUsuario.toString()],
          ['Distritos sin usuarios (Pendientes)', stats.coverage.pendientes.toString()],
          ['Porcentaje de Cobertura Real', `${stats.coverage.percentage.toFixed(1)}%`],
          ['Total Personas Capacitadas (Alcance)', stats.totals.trained.toLocaleString()]
        ],
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] }
      });

      let currentY = (doc as any).lastAutoTable.finalY + 15;

      stats.deptoList.forEach((depto: any) => {
          if (currentY > 240) { doc.addPage(); currentY = 20; }
          
          doc.setTextColor(79, 70, 229);
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text(`DEPTO: ${depto.name}`, 15, currentY);
          
          const rows = depto.districts.map((m: any) => [
            m.distrito,
            m.trained.toString(),
            m.surveys.toString(),
            m.totalUsers.toString(),
            m.pendingUsers.toString(),
            m.totalUsers === 0 ? "SIN USUARIO" : (m.trained === 0 ? "PED. CAPACIT." : (m.pendingUsers === 0 ? "AL DÍA" : `${m.pendingPercentage.toFixed(1)}% PEN.`))
          ]);

          autoTable(doc, {
            startY: currentY + 5,
            head: [['Distrito', 'Capac.', 'Enc.', 'Users', 'Pend.', 'Estatus']],
            body: rows,
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42] },
            styles: { fontSize: 7, valign: 'middle' },
            margin: { left: 15 },
            didParseCell: function(data) {
                if (data.section === 'body' && data.column.index === 5) {
                    const status = data.cell.raw;
                    if (status === "SIN USUARIO") {
                        data.cell.styles.textColor = [220, 38, 38]; // Rojo
                        data.cell.styles.fontStyle = 'bold';
                    } else if (status === "PED. CAPACIT.") {
                        data.cell.styles.textColor = [217, 119, 6]; // Ámbar
                        data.cell.styles.fontStyle = 'bold';
                    } else if (status === "AL DÍA") {
                        data.cell.styles.textColor = [5, 150, 105]; // Esmeralda
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            }
          });
          
          currentY = (doc as any).lastAutoTable.finalY + 15;
      });


      // SECCIÓN DE FIRMAS AL FINAL DEL REPORTE
      if (currentY > 230) { doc.addPage(); currentY = 30; } else { currentY += 20; }
      
      doc.setDrawColor(0, 0, 0); // Líneas en Negro sólido
      doc.setTextColor(0, 0, 0); // Texto en Negro sólido
      doc.setLineWidth(0.5);
      
      // Firma 1 (Izquierda)
      doc.line(15, currentY, 95, currentY);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text("FIRMA", 55, currentY + 5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.text("Lic. Benjamín Díaz Valinotti", 55, currentY + 10, { align: 'center' });
      doc.setFontSize(7);
      doc.text("Director General del Registro Electoral", 55, currentY + 14, { align: 'center' });

      // Firma 2 (Derecha)
      doc.line(pageWidth - 95, currentY, pageWidth - 15, currentY);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text("FIRMA", pageWidth - 55, currentY + 5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.text("Ing. Eduardo Benítez", pageWidth - 55, currentY + 10, { align: 'center' });
      doc.setFontSize(7);
      doc.text("Dpto. de Informática - DGRE", pageWidth - 55, currentY + 14, { align: 'center' });

      const totalPages = doc.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${totalPages} - © 2026 Dpto. Informática DGRE - TSJE | ING. EDUARDO BENITEZ Reservados todos los derechos.`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
      }

      doc.save(`Informe_Territorial_${selectedDeptoFilter.replace(' ', '_')}_${new Date().getTime()}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  if (isUserLoading || loadingDatos || loadingInformes || loadingEncuestas || loadingUsers || loadingPresence) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8F9FA]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-xs font-black uppercase tracking-widest animate-pulse">Calculando Cobertura Real...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Informe Territorial Integral" />
      
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        {/* FILTROS ESTRATÉGICOS */}
        <section className="flex flex-col md:flex-row gap-6 items-end bg-white p-8 rounded-[2.5rem] shadow-2xl border-t-8 border-indigo-600">
          <div className="flex-1 space-y-2 w-full">
            <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <MapPin className="h-3 w-3" /> Filtrar por Departamento
            </Label>
            <Select value={selectedDeptoFilter} onValueChange={setSelectedDeptoFilter}>
              <SelectTrigger className="h-14 border-2 font-black rounded-2xl bg-indigo-50/30 text-indigo-900 border-indigo-100">
                <SelectValue placeholder="Seleccionar Departamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="font-bold">TODOS LOS DEPARTAMENTOS</SelectItem>
                {departments.map(d => (
                  <SelectItem key={d} value={d} className="font-medium">{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button 
              onClick={generatePDF}
              disabled={isGenerating || !stats}
              className="w-full md:w-auto h-14 px-10 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl shadow-xl gap-3 border-b-4 border-slate-700 transition-all active:translate-y-1 active:border-b-0"
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            EXPEDIR INFORME INTEGRAL (PDF)
          </Button>
        </section>

        {/* INDICADORES DE COBERTURA REAL */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="rounded-[2rem] border-none shadow-lg bg-indigo-600 text-white overflow-hidden relative group hover:scale-[1.02] transition-transform">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest opacity-70">Distritos con Usuario</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-4xl font-black">{stats?.coverage.conUsuario} / {stats?.coverage.totalDistritos}</div>
                <div className="text-[10px] font-bold uppercase mt-1 bg-white/20 inline-block px-2 py-0.5 rounded-full">
                    {stats?.coverage.percentage.toFixed(1)}% Cobertura Real
                </div>
                <MapPin className="absolute -bottom-2 -right-2 h-16 w-16 opacity-10 group-hover:rotate-12 transition-transform" />
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-none shadow-lg bg-red-600 text-white overflow-hidden relative group hover:scale-[1.02] transition-transform">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest opacity-70">Distritos sin Usuarios</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-4xl font-black">{stats?.coverage.pendientes}</div>
                <div className="text-[10px] font-bold uppercase mt-1 bg-white/20 inline-block px-2 py-0.5 rounded-full">
                    Pendiente de asignación
                </div>
                <AlertCircle className="absolute -bottom-2 -right-2 h-16 w-16 opacity-10 group-hover:rotate-12 transition-transform" />
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-none shadow-lg bg-white overflow-hidden relative group hover:scale-[1.02] transition-transform ring-1 ring-slate-100">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Capacitados</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-4xl font-black text-slate-900">{stats?.totals.trained.toLocaleString()}</div>
                <Users className="absolute -bottom-2 -right-2 h-16 w-16 text-slate-100 group-hover:rotate-12 transition-transform" />
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-none shadow-lg bg-amber-500 text-white overflow-hidden relative group hover:scale-[1.02] transition-transform">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest opacity-70">Personal Pendiente</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-4xl font-black">{stats?.totals.pending.toLocaleString()}</div>
                <div className="text-[10px] font-bold uppercase mt-1 bg-white/20 inline-block px-2 py-0.5 rounded-full">
                    No activos en sistema
                </div>
                <UserX className="absolute -bottom-2 -right-2 h-16 w-16 opacity-10 group-hover:rotate-12 transition-transform" />
            </CardContent>
          </Card>
        </div>

        {/* MATRIZ TERRITORIAL CON ACORDEONES */}
        <Card className="rounded-[2.5rem] border-none shadow-2xl bg-white overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-8">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                            <TableIcon className="h-6 w-6 text-indigo-400" /> Matriz Territorial Detallada
                        </CardTitle>
                        <CardDescription className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Status de Usuarios por Distrito (Incluyendo Faltantes)</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                <Accordion type="multiple" className="space-y-4">
                    {stats?.deptoList.map((depto: any) => (
                        <AccordionItem 
                            key={depto.name} 
                            value={depto.name} 
                            className="border-none bg-slate-50/50 rounded-3xl overflow-hidden px-4"
                        >
                            <AccordionTrigger className="hover:no-underline py-6">
                                <div className="flex flex-1 items-center justify-between pr-4">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-indigo-200">
                                            {depto.name.substring(0, 2)}
                                        </div>
                                        <div className="flex flex-col text-left">
                                            <span className="text-sm font-black uppercase tracking-tight text-slate-800">{depto.name}</span>
                                            <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest">
                                                {depto.districts.length} DISTRITOS RELEVADOS
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="hidden md:flex items-center gap-8">
                                        <div className="flex flex-col items-center">
                                            <span className="text-xs font-black text-slate-700">
                                                {depto.districts.filter((d: any) => d.activeUsers > 0).length} / {depto.districts.length}
                                            </span>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Distritos Cubiertos</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <span className="text-xs font-black text-slate-700">{depto.totals.users}</span>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Usuarios Totales</span>
                                        </div>
                                        <Badge 
                                            className={cn(
                                                "font-black text-[9px] border-2",
                                                depto.totals.pending === 0 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                                            )}
                                        >
                                            {depto.totals.pending === 0 ? "GESTIÓN AL DÍA" : `${depto.totals.pending} PENDIENTES`}
                                        </Badge>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-6">
                                <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-inner">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-50 border-b">
                                            <tr>
                                                <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-500 tracking-wider">Distrito</th>
                                                <th className="px-6 py-4 text-[9px] font-black uppercase text-indigo-600 tracking-wider">Capacitados</th>
                                                <th className="px-6 py-4 text-[9px] font-black uppercase text-emerald-600 tracking-wider">Encuestas</th>
                                                <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-900 tracking-wider text-center">Usuarios</th>
                                                <th className="px-6 py-4 text-[9px] font-black uppercase text-amber-600 tracking-wider text-center">Pendientes</th>
                                                <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-500 tracking-wider text-right">Estatus Cobertura</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {depto.districts.map((m: any) => (
                                                <tr key={m.distrito} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <span className="text-[10px] font-bold uppercase text-slate-700">{m.distrito}</span>
                                                    </td>
                                                    <td className="px-6 py-4 font-black text-indigo-600 text-xs">
                                                        {m.trained.toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4 font-black text-emerald-600 text-xs">
                                                        {m.surveys.toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4 font-black text-slate-800 text-xs text-center">
                                                        {m.totalUsers}
                                                    </td>
                                                    <td className="px-6 py-4 font-black text-amber-600 text-xs text-center">
                                                        {m.pendingUsers}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {m.totalUsers === 0 ? (
                                                            <span className="text-[9px] font-black text-red-600 flex items-center justify-end gap-1 uppercase tracking-tighter">
                                                                <AlertCircle className="h-3 w-3" /> CRÍTICO - SIN USUARIO (PENDIENTE)
                                                            </span>
                                                        ) : (m.trained === 0 ? (
                                                            <span className="text-[9px] font-black text-amber-600 flex items-center justify-end gap-1 bg-amber-50 px-2 py-1 rounded-full uppercase">
                                                                <Loader2 className="h-3 w-3" /> PENDIENTE CAPACITACIÓN
                                                            </span>
                                                        ) : (m.pendingUsers === 0 ? (
                                                            <span className="text-[9px] font-black text-emerald-600 flex items-center justify-end gap-1">
                                                                <UserCheck className="h-3 w-3" /> AL DÍA
                                                            </span>
                                                        ) : (
                                                            <Badge className="bg-amber-100 text-amber-700 border-none font-black text-[8px]">
                                                                {m.pendingPercentage.toFixed(1)}% PEN.
                                                            </Badge>
                                                        )))}
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

        {/* COMPARATIVA DE PRODUCTIVIDAD */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden p-8">
                <CardHeader className="p-0 mb-8">
                    <CardTitle className="text-lg font-black uppercase tracking-tighter flex items-center gap-3 text-slate-800">
                        Top 8 Departamentos (Capacitados)
                    </CardTitle>
                </CardHeader>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ReBarChart data={stats?.chartData || []} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={120} axisLine={false} tickLine={false} style={{ fontSize: '7px', fontWeight: 'bold' }} />
                            <Tooltip cursor={{fill: 'transparent'}} />
                            <Bar dataKey="value" fill="#6366F1" radius={[0, 10, 10, 0]} barSize={20}>
                                {(stats?.chartData || []).map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                )) as any}
                            </Bar>
                        </ReBarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden p-8">
                <CardHeader className="p-0 mb-8">
                    <CardTitle className="text-lg font-black uppercase tracking-tighter text-slate-800">
                        Cobertura Nacional de Distritos
                    </CardTitle>
                </CardHeader>
                <div className="h-[300px] flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                            <Pie
                                data={[
                                    { name: 'CON USUARIO', value: stats?.coverage.conUsuario },
                                    { name: 'SIN USUARIO (PEND.)', value: stats?.coverage.pendientes }
                                ]}
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={10}
                                dataKey="value"
                            >
                                <Cell fill="#6366F1" />
                                <Cell fill="#EF4444" />
                            </Pie>
                            <Tooltip />
                        </RePieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <div className="h-3 w-3 rounded-full bg-indigo-500" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase leading-none">Cubiertos</span>
                                <span className="text-[12px] font-bold text-slate-800">{stats?.coverage.conUsuario}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="h-3 w-3 rounded-full bg-red-500" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase leading-none">Pendientes</span>
                                <span className="text-[12px] font-bold text-slate-800">{stats?.coverage.pendientes}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>

      </main>

      <footer className="w-full py-10 px-4 text-center border-t bg-slate-900 mt-12 overflow-hidden relative">
        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.5em] opacity-80 relative z-10">
          DGRE INTEL v2.0 | DIRECCIÓN GENERAL DEL REGISTRO ELECTORAL | TSJE PARAGUAY
        </p>
        <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-emerald-500 to-amber-500 top-0" />
      </footer>
    </div>
  );
}


