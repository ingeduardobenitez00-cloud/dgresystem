"use client";

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/header';
import { Card, CardContent } from '@/components/ui/card';
import { useUser, useFirebase, useCollectionOnce, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { type InformeSoyJoven, type Dato } from '@/lib/data';
import {
  Loader2,
  Landmark,
  Building2,
  Search,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  History,
  School,
  FileCheck2,
  Eye,
  FileDown,
  ImageIcon,
  GraduationCap,
  Plus,
  ExternalLink,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { formatDateToDDMMYYYY, cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ReporteSoyJovenPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CUMPLIDOS' | 'PENDIENTES'>('ALL');
  const [selectedReport, setSelectedReport] = useState<InformeSoyJoven | null>(null);
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const response = await fetch('/logo.png');
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => setLogoBase64(reader.result as string);
        reader.readAsDataURL(blob);
      } catch (e) {
        console.error('Error cargando logo:', e);
      }
    };
    fetchLogo();
  }, []);

  // Cargar geografía completa (Departamentos y Distritos)
  const datosQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'datos') : null),
    [firestore]
  );
  const { data: datosData, isLoading: isLoadingDatos } = useCollectionOnce<Dato>(datosQuery);

  // Cargar todos los informes remitidos de la campaña Soy Joven, Quiero Votar
  const informesQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !user) return null;
    return query(
      collection(firestore, 'divulgadores', 'campana_soy_joven', 'informes'),
      orderBy('fecha_creacion', 'desc')
    );
  }, [firestore, isUserLoading, user]);

  const { data: informes, isLoading: isLoadingInformes } =
    useCollectionOnce<InformeSoyJoven>(informesQuery);

  // Construir jerarquía Departamento -> Distrito -> Informes remitidos
  const hierarchy = useMemo(() => {
    if (!datosData) return [];

    const term = searchTerm.toLowerCase().trim();
    const depts: Record<
      string,
      {
        name: string;
        districts: Record<string, { name: string; reports: InformeSoyJoven[] }>;
      }
    > = {};

    datosData.forEach((d) => {
      if (d.departamento === 'SEDE CENTRAL') return;
      if (!depts[d.departamento]) {
        depts[d.departamento] = { name: d.departamento, districts: {} };
      }
      if (!depts[d.departamento].districts[d.distrito]) {
        depts[d.departamento].districts[d.distrito] = {
          name: d.distrito,
          reports: [],
        };
      }
    });

    informes?.forEach((inf) => {
      if (!inf.departamento || !inf.distrito) return;
      if (!depts[inf.departamento]) {
        depts[inf.departamento] = { name: inf.departamento, districts: {} };
      }
      if (!depts[inf.departamento].districts[inf.distrito]) {
        depts[inf.departamento].districts[inf.distrito] = {
          name: inf.distrito,
          reports: [],
        };
      }
      depts[inf.departamento].districts[inf.distrito].reports.push(inf);
    });

    return Object.values(depts)
      .map((dept) => {
        const allDistList = Object.values(dept.districts);
        const filteredDists = allDistList
          .filter((dist) => {
            const matchesSearch =
              !term ||
              dist.name.toLowerCase().includes(term) ||
              dept.name.toLowerCase().includes(term);
            if (!matchesSearch) return false;
            if (statusFilter === 'CUMPLIDOS') return dist.reports.length > 0;
            if (statusFilter === 'PENDIENTES') return dist.reports.length === 0;
            return true;
          })
          .sort((a, b) => a.name.localeCompare(b.name));

        const totalDeptColegios = allDistList.reduce(
          (acc, d) =>
            acc + d.reports.reduce((s, r) => s + (Number(r.colegios_visitados) || 0), 0),
          0
        );
        const totalDeptEntregados = allDistList.reduce(
          (acc, d) =>
            acc + d.reports.reduce((s, r) => s + (Number(r.formularios_entregados) || 0), 0),
          0
        );
        const totalDeptRetirados = allDistList.reduce(
          (acc, d) =>
            acc + d.reports.reduce((s, r) => s + (Number(r.formularios_retirados) || 0), 0),
          0
        );

        return {
          ...dept,
          totalDistrictsCount: allDistList.length,
          cumplidosCount: allDistList.filter((d) => d.reports.length > 0).length,
          totalDeptColegios,
          totalDeptEntregados,
          totalDeptRetirados,
          districts: filteredDists,
        };
      })
      .filter((dept) => dept.districts.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [datosData, informes, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    const totalDistritos = datosData
      ? datosData.filter((d) => d.departamento !== 'SEDE CENTRAL').length
      : 0;

    const fulfilledSet = new Set<string>();
    let colegios = 0;
    let entregados = 0;
    let retirados = 0;

    (informes || []).forEach((inf) => {
      if (inf.departamento !== 'SEDE CENTRAL') {
        fulfilledSet.add(`${inf.departamento}-${inf.distrito}`);
      }
      colegios += Number(inf.colegios_visitados) || 0;
      entregados += Number(inf.formularios_entregados) || 0;
      retirados += Number(inf.formularios_retirados) || 0;
    });

    const totalCumplidos = fulfilledSet.size;
    const totalPendientes = Math.max(0, totalDistritos - totalCumplidos);

    return {
      totalDistritos,
      totalCumplidos,
      totalPendientes,
      colegios,
      entregados,
      retirados,
    };
  }, [datosData, informes]);

  const generateReportPDF = (item: InformeSoyJoven) => {
    const docPdf = new jsPDF();
    const margin = 18;
    const pageWidth = docPdf.internal.pageSize.getWidth();

    if (logoBase64) {
      docPdf.addImage(logoBase64, 'PNG', margin, 10, 20, 20);
    }

    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(14);
    docPdf.text('JUSTICIA ELECTORAL · REPÚBLICA DEL PARAGUAY', pageWidth / 2, 16, {
      align: 'center',
    });
    docPdf.setFontSize(13);
    docPdf.text('INFORME DE LA CAMPAÑA: "SOY JOVEN, QUIERO VOTAR"', pageWidth / 2, 23, {
      align: 'center',
    });
    docPdf.setFontSize(9);
    docPdf.setFont('helvetica', 'normal');
    docPdf.text(
      'RELEVAMIENTO DE COLEGIOS VISITADOS Y CONTROL DE FORMULARIOS',
      pageWidth / 2,
      29,
      { align: 'center' }
    );

    let y = 42;
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(9);
    docPdf.text(
      `JURISDICCIÓN: ${item.departamento || 'S/D'} — ${item.distrito || 'S/D'}`,
      margin,
      y
    );
    docPdf.text(
      `FECHA DE ACTIVIDAD: ${item.fecha_desde || '__/__/____'} AL ${item.fecha_hasta || '__/__/____'}`,
      margin,
      y + 6
    );
    docPdf.text(`FUNCIONARIO RESPONSABLE: ${(item.username || '').toUpperCase()}`, margin, y + 12);

    y += 20;
    autoTable(docPdf, {
      startY: y,
      head: [['INDICADOR DE LA CAMPAÑA "SOY JOVEN, QUIERO VOTAR"', 'CANTIDAD']],
      body: [
        ['CANTIDAD DE COLEGIOS VISITADOS', String(item.colegios_visitados || 0)],
        [
          'CANTIDAD DE FORMULARIOS ENTREGADOS A LOS COLEGIOS',
          String(item.formularios_entregados || 0),
        ],
        [
          'CANTIDAD DE FORMULARIOS COMPLETOS RETIRADOS DE LOS COLEGIOS',
          String(item.formularios_retirados || 0),
        ],
      ],
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 10, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 135 },
        1: { cellWidth: 35, halign: 'center' },
      },
      margin: { left: margin, right: margin },
    });

    y = (docPdf as any).lastAutoTable.finalY + 10;

    if (item.detalle_colegios) {
      docPdf.setFont('helvetica', 'bold');
      docPdf.setFontSize(9);
      docPdf.text('COLEGIOS / INSTITUCIONES VISITADAS:', margin, y);
      docPdf.setFont('helvetica', 'normal');
      const lines = docPdf.splitTextToSize(
        item.detalle_colegios.toUpperCase(),
        pageWidth - margin * 2
      );
      docPdf.text(lines, margin, y + 5);
      y += 8 + lines.length * 4.5;
    }

    if (item.observaciones) {
      docPdf.setFont('helvetica', 'bold');
      docPdf.setFontSize(9);
      docPdf.text('OBSERVACIONES:', margin, y);
      docPdf.setFont('helvetica', 'normal');
      const obsLines = docPdf.splitTextToSize(
        item.observaciones.toUpperCase(),
        pageWidth - margin * 2
      );
      docPdf.text(obsLines, margin, y + 5);
      y += 8 + obsLines.length * 4.5;
    }

    docPdf.save(
      `Informe-Soy-Joven-${(item.distrito || 'Distrito').replace(/\s+/g, '-')}.pdf`
    );
  };

  if (isUserLoading || isLoadingDatos || isLoadingInformes) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Monitor Campaña Soy Joven, Quiero Votar" />

      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        {/* ENCABEZADO Y BUSCADOR */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 bg-white p-6 rounded-[2rem] shadow-sm border">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <GraduationCap className="h-7 w-7" />
            </div>
            <div>
              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[9px] font-black uppercase px-2.5 py-0.5">
                CONTROL DE CUMPLIMIENTO NACIONAL
              </Badge>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-primary uppercase leading-none mt-1.5">
                Monitor de Informes · &ldquo;Soy Joven, Quiero Votar&rdquo;
              </h1>
              <p className="text-muted-foreground text-[10px] font-bold uppercase flex items-center gap-2 mt-2 tracking-widest">
                <History className="h-3.5 w-3.5" /> Seguimiento por Departamento y Distrito en acordeón con visualización de informes y fotos
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <Link href="/soy-joven-quiero-votar">
              <Button className="h-11 rounded-xl font-black uppercase text-[10px] gap-2 shadow-sm">
                <Plus className="h-4 w-4" /> Cargar Nuevo Informe
              </Button>
            </Link>
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-50" />
              <Input
                placeholder="Buscar departamento o distrito..."
                className="h-11 pl-10 font-bold border-2 rounded-2xl bg-white shadow-sm text-xs uppercase"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* INDICADORES DE CUMPLIMIENTO Y PRODUCCIÓN */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card
            onClick={() => setStatusFilter('ALL')}
            className={cn(
              'bg-white border-2 p-5 rounded-3xl flex items-center gap-4 shadow-sm cursor-pointer transition-all',
              statusFilter === 'ALL' ? 'border-primary ring-2 ring-primary/10' : 'hover:border-primary/40'
            )}
          >
            <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">
                TOTAL DISTRITOS
              </p>
              <p className="text-2xl font-black leading-none mt-1">{stats.totalDistritos}</p>
            </div>
          </Card>

          <Card
            onClick={() => setStatusFilter('CUMPLIDOS')}
            className={cn(
              'bg-white border-2 p-5 rounded-3xl flex items-center gap-4 shadow-sm cursor-pointer transition-all',
              statusFilter === 'CUMPLIDOS'
                ? 'border-green-600 ring-2 ring-green-600/10'
                : 'border-green-100 hover:border-green-400'
            )}
          >
            <div className="h-12 w-12 rounded-2xl bg-green-50 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-green-600 tracking-widest">
                CUMPLIDOS
              </p>
              <p className="text-2xl font-black leading-none text-green-600 mt-1">
                {stats.totalCumplidos}
              </p>
            </div>
          </Card>

          <Card
            onClick={() => setStatusFilter('PENDIENTES')}
            className={cn(
              'bg-white border-2 p-5 rounded-3xl flex items-center gap-4 shadow-sm cursor-pointer transition-all',
              statusFilter === 'PENDIENTES'
                ? 'border-destructive ring-2 ring-destructive/10'
                : 'border-destructive/15 hover:border-destructive/40'
            )}
          >
            <div className="h-12 w-12 rounded-2xl bg-destructive/5 flex items-center justify-center shrink-0">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-destructive tracking-widest">
                PENDIENTES
              </p>
              <p className="text-2xl font-black leading-none text-destructive mt-1">
                {stats.totalPendientes}
              </p>
            </div>
          </Card>

          <Card className="bg-white border-2 p-5 rounded-3xl flex items-center gap-4 shadow-sm">
            <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0">
              <School className="h-6 w-6 text-slate-800" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">
                COLEGIOS VISITADOS
              </p>
              <p className="text-2xl font-black leading-none text-slate-900 mt-1">
                {stats.colegios}
              </p>
            </div>
          </Card>

          <Card className="bg-white border-2 border-blue-100 p-5 rounded-3xl flex items-center gap-4 shadow-sm">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-blue-600 tracking-widest">
                FORM. ENTREGADOS
              </p>
              <p className="text-2xl font-black leading-none text-blue-700 mt-1">
                {stats.entregados}
              </p>
            </div>
          </Card>

          <Card className="bg-white border-2 border-emerald-100 p-5 rounded-3xl flex items-center gap-4 shadow-sm">
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
              <FileCheck2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-emerald-600 tracking-widest">
                FORM. RETIRADOS
              </p>
              <p className="text-2xl font-black leading-none text-emerald-700 mt-1">
                {stats.retirados}
              </p>
            </div>
          </Card>
        </div>

        {/* ACORDEÓN POR DEPARTAMENTO Y DISTRITO */}
        {hierarchy.length === 0 ? (
          <Card className="p-20 text-center border-dashed bg-white rounded-[2.5rem]">
            <div className="flex flex-col items-center justify-center opacity-30">
              <AlertCircle className="h-16 w-16 mb-4" />
              <p className="font-black uppercase tracking-widest text-sm">
                No se encontraron departamentos o distritos con el filtro seleccionado
              </p>
            </div>
          </Card>
        ) : (
          <Accordion type="multiple" className="space-y-5">
            {hierarchy.map((dept) => (
              <AccordionItem
                key={dept.name}
                value={dept.name}
                className="border-none bg-white rounded-[2rem] shadow-sm overflow-hidden"
              >
                <AccordionTrigger className="hover:no-underline px-6 md:px-8 py-6 bg-white group">
                  <div className="flex flex-col md:flex-row md:items-center justify-between w-full pr-4 gap-4 text-left">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Landmark className="h-6 w-6" />
                      </div>
                      <div>
                        <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-[#1A1A1A]">
                          {dept.name}
                        </h2>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                            {dept.totalDistrictsCount} DISTRITOS EN JURISDICCIÓN
                          </p>
                          <Badge
                            variant="secondary"
                            className="bg-green-100 text-green-700 text-[8px] font-black border-none"
                          >
                            {dept.cumplidosCount} CUMPLIDOS
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-destructive border-destructive/25 text-[8px] font-black"
                          >
                            {dept.totalDistrictsCount - dept.cumplidosCount} PENDIENTES
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[9px] font-black uppercase px-3 py-1">
                        🏫 {dept.totalDeptColegios} Colegios
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[9px] font-black uppercase px-3 py-1 border-blue-200 text-blue-700 bg-blue-50/50"
                      >
                        📄 {dept.totalDeptEntregados} Entregados
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[9px] font-black uppercase px-3 py-1 border-emerald-200 text-emerald-700 bg-emerald-50/50"
                      >
                        ✅ {dept.totalDeptRetirados} Retirados
                      </Badge>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="px-6 md:px-8 pb-8 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    {dept.districts.map((dist) => {
                      const isCumplido = dist.reports.length > 0;

                      return (
                        <Accordion
                          key={dist.name}
                          type="single"
                          collapsible
                          className="w-full"
                        >
                          <AccordionItem
                            value={dist.name}
                            className={cn(
                              'border-2 rounded-2xl overflow-hidden transition-all',
                              isCumplido
                                ? 'border-green-200/80 hover:border-green-400'
                                : 'border-muted hover:border-primary/20'
                            )}
                          >
                            <AccordionTrigger className="hover:no-underline px-5 py-4 bg-muted/5 group">
                              <div className="flex items-center justify-between w-full pr-3">
                                <div className="flex items-center gap-3">
                                  <Building2
                                    className={cn(
                                      'h-5 w-5 shrink-0',
                                      isCumplido
                                        ? 'text-green-600'
                                        : 'text-muted-foreground/40'
                                    )}
                                  />
                                  <span className="font-black uppercase text-xs tracking-tight text-foreground/90 text-left">
                                    {dist.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {isCumplido ? (
                                    <Badge className="bg-green-600 hover:bg-green-600 text-white text-[8px] font-black uppercase shadow-sm">
                                      CUMPLIDO ({dist.reports.length})
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="text-destructive border-destructive/20 text-[8px] font-black uppercase"
                                    >
                                      PENDIENTE
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </AccordionTrigger>

                            <AccordionContent className="p-5 bg-white border-t border-dashed">
                              {!isCumplido ? (
                                <div className="py-8 text-center space-y-2">
                                  <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground opacity-20" />
                                  <p className="text-[10px] font-bold text-muted-foreground uppercase">
                                    Este distrito aún no ha remitido su informe de la campaña
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-5">
                                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                                    INFORMES REMITIDOS POR EL DISTRITO ({dist.reports.length})
                                  </p>

                                  {dist.reports.map((inf) => (
                                    <Card
                                      key={inf.id}
                                      className="border-2 shadow-sm rounded-2xl overflow-hidden"
                                    >
                                      <div className="bg-slate-900 text-white p-3.5 flex flex-wrap justify-between items-center gap-2">
                                        <div className="flex items-center gap-2">
                                          <Calendar className="h-3.5 w-3.5 text-emerald-400" />
                                          <span className="text-[10px] font-black uppercase">
                                            {formatDateToDDMMYYYY(inf.fecha_desde)}
                                            {inf.fecha_hasta && inf.fecha_hasta !== inf.fecha_desde
                                              ? ` al ${formatDateToDDMMYYYY(inf.fecha_hasta)}`
                                              : ''}
                                          </span>
                                        </div>
                                        <span className="text-[9px] font-bold uppercase text-slate-300">
                                          👤 {inf.username || 'FUNCIONARIO'}
                                        </span>
                                      </div>

                                      <CardContent className="p-4 space-y-4">
                                        {/* Indicadores numéricos */}
                                        <div className="grid grid-cols-3 gap-2 text-center">
                                          <div className="p-2.5 rounded-xl bg-slate-50 border">
                                            <p className="text-[8px] font-black text-muted-foreground uppercase">
                                              Colegios Visitados
                                            </p>
                                            <p className="text-lg font-black text-slate-900">
                                              {inf.colegios_visitados}
                                            </p>
                                          </div>
                                          <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-200">
                                            <p className="text-[8px] font-black text-blue-700 uppercase">
                                              Form. Entregados
                                            </p>
                                            <p className="text-lg font-black text-blue-800">
                                              {inf.formularios_entregados}
                                            </p>
                                          </div>
                                          <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200">
                                            <p className="text-[8px] font-black text-emerald-700 uppercase">
                                              Form. Retirados
                                            </p>
                                            <p className="text-lg font-black text-emerald-800">
                                              {inf.formularios_retirados}
                                            </p>
                                          </div>
                                        </div>

                                        {inf.detalle_colegios && (
                                          <div className="text-[10px] bg-muted/20 p-2.5 rounded-xl border">
                                            <span className="font-black uppercase text-primary block mb-0.5">
                                              Colegios Visitados:
                                            </span>
                                            <p className="font-semibold uppercase text-slate-700">
                                              {inf.detalle_colegios}
                                            </p>
                                          </div>
                                        )}

                                        {inf.observaciones && (
                                          <div className="text-[10px] bg-muted/20 p-2.5 rounded-xl border">
                                            <span className="font-black uppercase text-muted-foreground block mb-0.5">
                                              Observaciones:
                                            </span>
                                            <p className="font-semibold uppercase text-slate-700">
                                              {inf.observaciones}
                                            </p>
                                          </div>
                                        )}

                                        {/* Miniaturas directas de Formulario de Salida y Fotos de Actividad */}
                                        <div className="space-y-3 pt-2 border-t border-dashed">
                                          {inf.foto_solicitud_salida && (
                                            <div className="space-y-1.5">
                                              <p className="text-[9px] font-black uppercase text-primary flex items-center gap-1.5">
                                                <FileText className="h-3 w-3" /> Formulario Físico de Solicitud de Salida:
                                              </p>
                                              <div
                                                onClick={() => setZoomedImageUrl(inf.foto_solicitud_salida)}
                                                className="relative h-36 w-full rounded-xl overflow-hidden border-2 border-primary/20 bg-black cursor-pointer group"
                                              >
                                                <Image
                                                  src={inf.foto_solicitud_salida}
                                                  alt="Solicitud de Salida"
                                                  fill
                                                  className="object-contain group-hover:scale-105 transition-transform"
                                                />
                                                <div className="absolute bottom-2 right-2 bg-black/75 text-white text-[8px] font-black uppercase px-2 py-1 rounded-md">
                                                  🔍 Clic para ampliar
                                                </div>
                                              </div>
                                            </div>
                                          )}

                                          {inf.fotos_actividad && inf.fotos_actividad.length > 0 && (
                                            <div className="space-y-1.5">
                                              <p className="text-[9px] font-black uppercase text-primary flex items-center gap-1.5">
                                                <ImageIcon className="h-3 w-3" /> Fotos de la Actividad Realizada ({inf.fotos_actividad.length}):
                                              </p>
                                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                                {inf.fotos_actividad.map((fotoUrl, fIdx) => (
                                                  <div
                                                    key={fIdx}
                                                    onClick={() => setZoomedImageUrl(fotoUrl)}
                                                    className="relative aspect-square rounded-xl overflow-hidden border bg-slate-100 cursor-pointer group"
                                                  >
                                                    <Image
                                                      src={fotoUrl}
                                                      alt={`Actividad ${fIdx + 1}`}
                                                      fill
                                                      className="object-cover group-hover:scale-110 transition-transform"
                                                    />
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>

                                        {/* Botones de Acción */}
                                        <div className="flex flex-wrap gap-2 pt-2">
                                          <Button
                                            variant="default"
                                            size="sm"
                                            onClick={() => setSelectedReport(inf)}
                                            className="flex-1 h-9 rounded-xl font-black uppercase text-[9px] gap-1.5"
                                          >
                                            <Eye className="h-3.5 w-3.5" /> Ver Informe Completo
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => generateReportPDF(inf)}
                                            className="h-9 rounded-xl font-black uppercase text-[9px] gap-1.5 border-2"
                                          >
                                            <FileDown className="h-3.5 w-3.5" /> PDF
                                          </Button>
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
      </main>

      {/* MODAL DETALLE COMPLETO DEL INFORME Y TODAS SUS FOTOS */}
      <Dialog open={!!selectedReport} onOpenChange={(o) => !o && setSelectedReport(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-black uppercase text-lg text-primary">
              Informe Remitido — {selectedReport?.departamento} / {selectedReport?.distrito}
            </DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase">
              Fecha: {selectedReport ? formatDateToDDMMYYYY(selectedReport.fecha_desde) : ''} · Responsable: {selectedReport?.username || 'FUNCIONARIO'}
            </DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-6 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border-2 text-center">
                  <p className="text-[10px] font-black uppercase text-muted-foreground">
                    Cantidad de Colegios Visitados
                  </p>
                  <p className="text-3xl font-black text-slate-900 mt-1">
                    {selectedReport.colegios_visitados}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-blue-50/60 border-2 border-blue-200 text-center">
                  <p className="text-[10px] font-black uppercase text-blue-700">
                    Formularios Entregados a Colegios
                  </p>
                  <p className="text-3xl font-black text-blue-800 mt-1">
                    {selectedReport.formularios_entregados}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50/60 border-2 border-emerald-200 text-center">
                  <p className="text-[10px] font-black uppercase text-emerald-700">
                    Formularios Completos Retirados
                  </p>
                  <p className="text-3xl font-black text-emerald-800 mt-1">
                    {selectedReport.formularios_retirados}
                  </p>
                </div>
              </div>

              {selectedReport.detalle_colegios && (
                <div className="p-4 rounded-2xl bg-muted/20 border space-y-1">
                  <p className="text-[10px] font-black uppercase text-primary">
                    Colegios Visitados:
                  </p>
                  <p className="text-xs font-bold uppercase">{selectedReport.detalle_colegios}</p>
                </div>
              )}

              {selectedReport.observaciones && (
                <div className="p-4 rounded-2xl bg-muted/20 border space-y-1">
                  <p className="text-[10px] font-black uppercase text-muted-foreground">
                    Observaciones:
                  </p>
                  <p className="text-xs font-bold uppercase">{selectedReport.observaciones}</p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-black uppercase text-primary">
                  1. Imagen del Formulario Físico de Solicitud de Salida
                </p>
                {selectedReport.foto_solicitud_salida ? (
                  <div
                    onClick={() => setZoomedImageUrl(selectedReport.foto_solicitud_salida)}
                    className="relative w-full h-96 rounded-2xl overflow-hidden border-2 bg-black cursor-pointer"
                  >
                    <Image
                      src={selectedReport.foto_solicitud_salida}
                      alt="Formulario Físico de Solicitud de Salida"
                      fill
                      className="object-contain"
                    />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin imagen adjunta.</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-black uppercase text-primary">
                  2. Fotografías de la Actividad Realizada ({selectedReport.fotos_actividad?.length || 0})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {(selectedReport.fotos_actividad || []).map((url, idx) => (
                    <div
                      key={idx}
                      onClick={() => setZoomedImageUrl(url)}
                      className="relative aspect-[4/3] rounded-2xl overflow-hidden border-2 bg-slate-100 cursor-pointer group"
                    >
                      <Image
                        src={url}
                        alt={`Actividad ${idx + 1}`}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => generateReportPDF(selectedReport)}
                  className="rounded-xl font-black uppercase text-xs gap-2"
                >
                  <FileDown className="h-4 w-4" /> Descargar PDF Oficial
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL DE ZOOM DE IMAGEN EN PANTALLA COMPLETA */}
      <Dialog open={!!zoomedImageUrl} onOpenChange={(o) => !o && setZoomedImageUrl(null)}>
        <DialogContent className="max-w-5xl p-2 bg-black/95 border-none rounded-3xl overflow-hidden">
          <DialogHeader className="p-2">
            <DialogTitle className="text-white text-xs font-black uppercase text-center">
              Vista Ampliada de Evidencia Documental / Fotográfica
            </DialogTitle>
          </DialogHeader>
          {zoomedImageUrl && (
            <div className="relative w-full h-[78vh]">
              <Image
                src={zoomedImageUrl}
                alt="Evidencia Ampliada"
                fill
                className="object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

