"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Scale, 
  Calendar, 
  ClipboardCheck, 
  MapPin, 
  Cpu, 
  ArrowLeftRight, 
  BarChart3, 
  ShieldAlert, 
  FileText, 
  Users, 
  CheckCircle2, 
  Clock, 
  GraduationCap, 
  Briefcase,
  ChevronRight,
  Sparkles,
  Archive
} from 'lucide-react';
import { useUser } from '@/firebase/auth/use-user';
import { HistoricalToggle } from '@/components/historical-toggle';
import { useElectionPeriod } from '@/context/election-period-context';
import { LISTAS_CONSEJO_MAGISTRATURA } from '@/lib/data';
import { cn } from '@/lib/utils';

export default function ConsejoMagistraturaPage() {
  const { user } = useUser();
  const { period } = useElectionPeriod();

  const isAdmin = user?.isAdmin || user?.isOwner;

  const quickLinks = [
    {
      title: "Listas y Movimientos Inscriptos",
      desc: "Directorio oficial y carga de listas de abogados y facultades de derecho.",
      href: "/importar-partidos",
      icon: Users,
      color: "text-amber-600 bg-amber-50 border-amber-200"
    },
    {
      title: "Solicitud de Capacitación (Anexo V)",
      desc: "Gestión de solicitudes de divulgación y capacitación para gremios de abogados y facultades.",
      href: "/solicitud-capacitacion",
      icon: ClipboardCheck,
      color: "text-emerald-600 bg-emerald-50 border-emerald-200"
    },
    {
      title: "Puntos Fijos de Divulgación",
      desc: "Ubicaciones estratégicas de máquinas de votación en tribunales, colegios de abogados y facultades.",
      href: "/puntos-fijos",
      icon: MapPin,
      color: "text-blue-600 bg-blue-50 border-blue-200"
    },
    {
      title: "Calendario Mensual",
      desc: "Programación nacional de jornadas de divulgación y adiestramiento de miembros de mesa.",
      href: "/calendario-capacitaciones",
      icon: Calendar,
      color: "text-indigo-600 bg-indigo-50 border-indigo-200"
    },
    {
      title: "Control de Máquinas de Votación",
      desc: "Inventario, entrega y devolución de máquinas de votación asignadas al proceso.",
      href: "/control-movimiento-maquinas",
      icon: Cpu,
      color: "text-amber-600 bg-amber-50 border-amber-200"
    },
    {
      title: "Resumen y Cobertura",
      desc: "Métricas de alcance nacional de divulgación y capacitaciones a nivel país.",
      href: "/resumen",
      icon: BarChart3,
      color: "text-purple-600 bg-purple-50 border-purple-200"
    },
    {
      title: "Denuncia de Lacres",
      desc: "Registro y fiscalización de seguridad de los precintos y lacres de máquinas.",
      href: "/denuncia-lacres",
      icon: ShieldAlert,
      color: "text-rose-600 bg-rose-50 border-rose-200"
    }
  ];

  const categories = [
    {
      name: "Gremio de Abogados",
      role: "Representantes Titulares y Suplentes",
      icon: Briefcase,
      desc: "Elección de dos miembros titulares y suplentes ante el Consejo de la Magistratura por los abogados matriculados.",
      badge: "Abogacía Nacional"
    },
    {
      name: "Docentes de Facultades de Derecho",
      role: "Representantes Universitarios",
      icon: GraduationCap,
      desc: "Elección de representantes de profesores titulares de las Facultades de Derecho de universidades públicas y privadas.",
      badge: "Ámbito Académico"
    }
  ];

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/5">
      <Header title="ELECCIONES DEL CONSEJO DE LA MAGISTRATURA" />

      <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8 animate-in fade-in duration-500">
        
        {/* Banner Superior */}
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 text-white rounded-[2.5rem] p-6 sm:p-8 md:p-10 shadow-2xl relative overflow-hidden border border-emerald-800/40">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-emerald-500 text-slate-950 font-black text-[10px] tracking-widest px-3 py-1 uppercase rounded-full">
                  <Sparkles className="h-3 w-3 mr-1" /> PROCESO ELECTORAL ACTIVO
                </Badge>
                <Badge variant="outline" className="text-white border-white/20 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                  JUSTICIA ELECTORAL - TSJE
                </Badge>
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tight text-white flex items-center gap-3">
                <Scale className="h-9 w-9 text-emerald-400 shrink-0" />
                ELECCIONES DEL CONSEJO DE LA MAGISTRATURA
              </h1>

              <p className="text-xs sm:text-sm text-white/80 font-medium leading-relaxed">
                Sistema oficial de coordinación, divulgación del voto electrónico, capacitación de miembros de mesa receptora de votos y logística de máquinas para los comicios del Consejo de la Magistratura.
              </p>
            </div>

            <div className="w-full lg:w-auto shrink-0 flex flex-col items-start lg:items-end gap-3">
              <HistoricalToggle isAdmin={!!isAdmin} />
            </div>
          </div>
        </div>

        {/* Sectores / Categorías Electorales */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-foreground flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-600" />
                Sectores Convocados a Elecciones
              </h2>
              <p className="text-xs text-muted-foreground font-medium">
                Cuerpos electorales habilitados para la conformación del Consejo de la Magistratura.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {categories.map((cat, i) => (
              <Card key={i} className="border-2 rounded-3xl bg-white shadow-sm hover:shadow-md transition-all overflow-hidden border-muted/80">
                <CardHeader className="p-6 bg-slate-50/50 border-b">
                  <div className="flex items-center justify-between gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-200 shrink-0">
                      <cat.icon className="h-6 w-6" />
                    </div>
                    <Badge variant="secondary" className="font-black text-[9px] uppercase tracking-wider bg-white border">
                      {cat.badge}
                    </Badge>
                  </div>
                  <CardTitle className="text-base font-black uppercase text-foreground mt-3">
                    {cat.name}
                  </CardTitle>
                  <CardDescription className="text-xs font-bold uppercase text-emerald-700">
                    {cat.role}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                    {cat.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* 4 Listas Oficiales Inscriptas */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-foreground flex items-center gap-2">
                <Scale className="h-5 w-5 text-emerald-600" />
                Listas Oficiales Inscriptas
              </h2>
              <p className="text-xs text-muted-foreground font-medium">
                Nómina oficial de las 4 listas habilitadas para pugnar en las Elecciones del Consejo de la Magistratura (Gremio de Abogados).
              </p>
            </div>
            <Badge className="bg-emerald-600 font-black text-[9px] uppercase tracking-widest px-3 py-1 self-start sm:self-auto">
              4 Listas Habilitadas
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {LISTAS_CONSEJO_MAGISTRATURA.map((lista) => (
              <Card key={lista.id} className="border-2 rounded-2xl bg-white shadow-sm hover:shadow-md hover:border-emerald-400 transition-all overflow-hidden flex flex-col justify-between">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="h-9 w-9 rounded-xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center shadow-sm">
                      {lista.siglas.replace('LISTA ', '')}
                    </span>
                    <Badge variant="outline" className="text-[9px] font-black uppercase text-emerald-800 border-emerald-200">
                      {lista.siglas}
                    </Badge>
                  </div>
                  <CardTitle className="text-sm font-black uppercase text-foreground leading-snug">
                    {lista.nombre.replace(/^LISTA [A-Z] - /, '')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0">
                  <div className="pt-3 border-t text-[10px] font-bold text-muted-foreground uppercase flex items-center justify-between">
                    <span>Estamento:</span>
                    <span className="text-emerald-700 font-black">Abogados</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Módulos Operacionales */}
        <div className="space-y-4">
          <div>
            <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-foreground flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-emerald-600" />
              Módulos y Herramientas del Proceso
            </h2>
            <p className="text-xs text-muted-foreground font-medium">
              Accede a las herramientas activas de gestión y seguimiento para las Elecciones del Consejo de la Magistratura.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {quickLinks.map((link, idx) => (
              <Link key={idx} href={link.href} className="group">
                <Card className="h-full border-2 rounded-3xl bg-white shadow-sm hover:shadow-xl hover:border-emerald-300 hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col justify-between">
                  <CardHeader className="p-6 space-y-3">
                    <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center border shadow-sm transition-transform group-hover:scale-110 duration-300", link.color)}>
                      <link.icon className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-sm font-black uppercase text-foreground group-hover:text-emerald-700 transition-colors">
                      {link.title}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground leading-relaxed font-medium">
                      {link.desc}
                    </CardDescription>
                  </CardHeader>
                  <div className="p-6 pt-0 flex items-center justify-between text-xs font-black uppercase text-emerald-600 group-hover:text-emerald-700">
                    <span>Acceder al módulo</span>
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Nota Institucional de Resguardo Histórico */}
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
              <Archive className="h-6 w-6" />
            </div>
            <div className="space-y-1 text-left">
              <h3 className="text-xs sm:text-sm font-black uppercase text-foreground">
                ¿Necesitas consultar Elecciones Anteriores?
              </h3>
              <p className="text-xs text-muted-foreground font-medium">
                Los datos de las Elecciones Generales 2026 y de las Elecciones Internas 2026 se encuentran archivados y accesibles mediante el selector de periodo electoral o en el menú de Configuración.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="shrink-0 h-12 px-6 rounded-2xl font-black text-xs uppercase border-2 hover:bg-muted">
            <Link href="/settings">
              Ver Historial en Configuración
            </Link>
          </Button>
        </div>

      </main>
    </div>
  );
}
