
'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ChevronRight, LayoutGrid } from 'lucide-react';
import Header from '@/components/header';
import { useUser } from '@/firebase';
import { dashboardMenuItems } from '@/lib/menu-config';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion';

const MODULE_GROUPS = [
  {
    label: "CIDEE - CAPACITACIONES",
    description: "Gestión de solicitudes, agendas, movimientos de equipos, denuncias de lacres e informes de capacitación nacional.",
    modules: ['anexo-i', 'solicitud-capacitacion', 'divulgadores', 'agenda-capacitacion', 'control-movimiento-maquinas', 'denuncia-lacres', 'informe-movimientos-denuncias', 'encuesta-satisfaccion', 'informe-divulgador', 'galeria-capacitaciones', 'informe-semanal-puntos-fijos', 'estadisticas-capacitacion', 'archivo-capacitaciones']
  },
  {
    label: "Registros Electorales",
    description: "Administración edilicia, visualización de fichas técnicas, galerías fotográficas e informes operativos semanales.",
    modules: ['ficha', 'fotos', 'cargar-ficha', 'configuracion-semanal', 'informe-semanal-registro', 'reporte-semanal-registro', 'archivo-semanal-registro']
  },
  {
    label: "Análisis y Reportes",
    description: "Consolidados nacionales y resúmenes técnicos por ubicación geográfica.",
    modules: ['resumen', 'informe-general']
  },
  {
    label: "Locales de Votación",
    description: "Buscador georreferenciado de locales y carga masiva de fotografías de campo.",
    modules: ['locales-votacion', 'cargar-fotos-locales']
  },
  {
    label: "Gestión de Datos",
    description: "Herramientas de importación masiva de reportes, locales y partidos políticos.",
    modules: ['importar-reportes', 'importar-locales', 'importar-partidos']
  },
  {
    label: "Sistema",
    description: "Administración de usuarios, monitoreo de conexiones en tiempo real, auditoría técnica y configuración.",
    modules: ['users', 'settings', 'documentacion', 'auditoria', 'conexiones']
  },
];

export default function Home() {
  const { user, isUserLoading } = useUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const groupedModules = useMemo(() => {
    if (!user || !mounted) return [];

    return MODULE_GROUPS.map(group => {
      const accessibleInGroup = dashboardMenuItems.filter(item => {
        const moduleName = item.href.substring(1);
        if (user.profile?.role === 'admin') return group.modules.includes(moduleName);
        const hasAccess = user.profile?.modules?.includes(moduleName);
        return group.modules.includes(moduleName) && hasAccess;
      });

      return {
        ...group,
        items: accessibleInGroup
      };
    }).filter(group => group.items.length > 0);
  }, [user, mounted]);

  if (isUserLoading || !mounted) {
    return (
      <div className="flex min-h-screen w-full flex-col">
        <Header title="" />
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/5">
      <Header title="" />
      <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="mb-6 bg-white p-5 rounded-xl border shadow-sm">
            <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl uppercase">
                Bienvenido, <span className="text-primary">{user?.profile?.username || 'Usuario'}</span>
            </h1>
            <p className="mt-1 text-xs text-muted-foreground font-medium flex items-center gap-2">
                <LayoutGrid className="h-3.5 w-3.5" />
                Seleccione una categoría para desplegar los módulos autorizados
            </p>
        </div>

        <div className="space-y-4">
          <Accordion type="multiple" className="space-y-3">
            {groupedModules.map((group) => (
              <AccordionItem 
                key={group.label} 
                value={group.label} 
                className="border bg-white rounded-lg overflow-hidden shadow-sm px-0 transition-all hover:shadow-md"
              >
                <AccordionTrigger className="hover:no-underline px-5 py-3 bg-muted/5 group">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full text-left">
                    <div className="flex items-center gap-3">
                      <span className="h-6 w-1 bg-primary rounded-full group-data-[state=closed]:bg-muted-foreground/30 transition-colors"></span>
                      <h2 className="text-sm font-black uppercase tracking-wide text-primary group-data-[state=closed]:text-muted-foreground">
                        {group.label}
                      </h2>
                    </div>
                    <div className="flex items-center gap-2 pr-4">
                      <span className="text-[8px] font-black bg-primary/10 text-primary px-2.5 py-0.5 rounded-full uppercase tracking-widest group-data-[state=closed]:bg-muted group-data-[state=closed]:text-muted-foreground">
                        {group.items.length} Módulos
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-5 pt-2">
                  <p className="text-xs text-muted-foreground mb-5 border-l-2 border-primary/20 pl-4 italic">
                    {group.description}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.items.map((item) => (
                      <Link href={item.href} key={item.href} className="group/item">
                        <Card className="h-full transition-all duration-300 ease-out hover:shadow-lg hover:border-primary/40 hover:-translate-y-1 bg-white overflow-hidden border-muted">
                          <CardHeader className="flex flex-row items-start gap-4 p-4">
                            <div className="p-2.5 rounded-lg bg-primary/5 text-primary group-hover/item:bg-primary group-hover/item:text-white transition-all duration-300 shadow-sm">
                              <item.icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-xs font-bold uppercase group-hover/item:text-primary transition-colors flex items-center justify-between">
                                {item.label}
                                <ChevronRight className="h-3.5 w-3.5 opacity-0 -translate-x-2 group-hover/item:opacity-100 group-hover/item:translate-x-0 transition-all duration-300" />
                              </CardTitle>
                              <CardDescription className="mt-1 text-[10px] line-clamp-2 font-medium leading-relaxed">
                                {item.description}
                              </CardDescription>
                            </div>
                          </CardHeader>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </main>
    </div>
  );
}
