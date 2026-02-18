
'use client';

import { useMemo } from 'react';
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
    description: "Gestión de solicitudes, agendas, encuestas e informes de capacitación nacional.",
    modules: ['solicitud-capacitacion', 'agenda-capacitacion', 'encuesta-satisfaccion', 'informe-divulgador', 'informe-semanal-puntos-fijos', 'estadisticas-capacitacion']
  },
  {
    label: "Registros Electorales",
    description: "Administración edilicia, visualización de fichas técnicas y galerías fotográficas.",
    modules: ['ficha', 'fotos', 'cargar-ficha']
  },
  {
    label: "Análisis y Reportes",
    description: "Consolidados nacionales, resúmenes por ubicación y generación de informes generales en PDF.",
    modules: ['resumen', 'informe-general']
  },
  {
    label: "Locales de Votación",
    description: "Buscador georreferenciado de locales y carga masiva de fotografías de campo.",
    modules: ['locales-votacion', 'cargar-fotos-locales']
  },
  {
    label: "Gestión de Datos",
    description: "Herramientas de importación masiva de reportes y locales desde archivos externos.",
    modules: ['importar-reportes', 'importar-locales']
  },
  {
    label: "Sistema",
    description: "Administración de usuarios, permisos, roles y configuración geográfica del sistema.",
    modules: ['users', 'settings']
  },
];

export default function Home() {
  const { user, isUserLoading } = useUser();

  const groupedModules = useMemo(() => {
    if (!user) return [];

    return MODULE_GROUPS.map(group => {
      const accessibleInGroup = dashboardMenuItems.filter(item => {
        const moduleName = item.href.substring(1);
        const hasAccess = user.profile?.role === 'admin' || user.profile?.modules?.includes(moduleName);
        return group.modules.includes(moduleName) && hasAccess;
      });

      return {
        ...group,
        items: accessibleInGroup
      };
    }).filter(group => group.items.length > 0);
  }, [user]);

  if (isUserLoading) {
    return (
      <div className="flex min-h-screen w-full flex-col">
        <Header title="Cargando Panel..." />
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/5">
      <Header title="Panel de Gestión Integral" />
      <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
        <div className="mb-8 bg-white p-6 rounded-xl border shadow-sm">
            <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl uppercase">
                Bienvenido, <span className="text-primary">{user?.profile?.username || 'Usuario'}</span>
            </h1>
            <p className="mt-2 text-muted-foreground font-medium flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" />
                Sistema de Gestión de la Justicia Electoral. Seleccione una categoría para desplegar los módulos.
            </p>
        </div>

        <div className="space-y-6">
          <Accordion type="multiple" defaultValue={groupedModules.map(g => g.label)} className="space-y-4">
            {groupedModules.map((group) => (
              <AccordionItem 
                key={group.label} 
                value={group.label} 
                className="border bg-white rounded-xl overflow-hidden shadow-sm px-0 transition-all hover:shadow-md"
              >
                <AccordionTrigger className="hover:no-underline px-6 py-4 bg-muted/5 group">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full text-left">
                    <div className="flex items-center gap-3">
                      <span className="h-8 w-1 bg-primary rounded-full group-data-[state=closed]:bg-muted-foreground/30 transition-colors"></span>
                      <h2 className="text-lg font-black uppercase tracking-wider text-primary group-data-[state=closed]:text-muted-foreground">
                        {group.label}
                      </h2>
                    </div>
                    <div className="flex items-center gap-2 pr-4">
                      <span className="text-[9px] font-black bg-primary/10 text-primary px-3 py-1 rounded-full uppercase tracking-widest group-data-[state=closed]:bg-muted group-data-[state=closed]:text-muted-foreground">
                        {group.items.length} Módulos
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-6 pt-2">
                  <p className="text-sm text-muted-foreground mb-6 border-l-2 border-primary/20 pl-4 italic">
                    {group.description}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.items.map((item) => (
                      <Link href={item.href} key={item.href} className="group/item">
                        <Card className="h-full transition-all duration-300 ease-out hover:shadow-lg hover:border-primary/40 hover:-translate-y-1 bg-white overflow-hidden border-muted">
                          <CardHeader className="flex flex-row items-start gap-4 p-5">
                            <div className="p-3 rounded-xl bg-primary/5 text-primary group-hover/item:bg-primary group-hover/item:text-white transition-all duration-300 shadow-sm">
                              <item.icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-sm font-bold uppercase group-hover/item:text-primary transition-colors flex items-center justify-between">
                                {item.label}
                                <ChevronRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover/item:opacity-100 group-hover/item:translate-x-0 transition-all duration-300" />
                              </CardTitle>
                              <CardDescription className="mt-1.5 text-[11px] line-clamp-2 font-medium leading-relaxed">
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
