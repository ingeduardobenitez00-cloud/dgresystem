"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  useSidebar
} from "@/components/ui/sidebar";
import { 
  ImageIcon, 
  Users, 
  FileText, 
  BarChart3, 
  UploadCloud,
  ClipboardCheck,
  CalendarDays,
  Vote,
  ChevronDown,
  MessageSquareHeart,
  UserCheck,
  PieChart,
  TableProperties,
  ArrowLeftRight,
  Flag,
  UserCircle,
  BookOpen,
  ShieldAlert,
  LayoutGrid,
  FileArchive,
  History,
  Images,
  Activity,
  ScrollText,
  ClipboardList,
  CalendarCog,
  Archive,
  Settings,
  MapPin,
  Calendar,
  Cpu
} from "lucide-react";
import { useUser, CIDEE_MODULES, JEFE_MODULES } from "@/firebase/auth/use-user";
import { useModuleCategories } from "@/firebase";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const MODULE_REGISTRY: Record<string, { label: string; icon: any }> = {
  // CIDEE - CAPACITACIONES
  'calendario-capacitaciones': { label: "Calendario Mensual", icon: Calendar },
  'anexo-i': { label: "Anexo I - Lugares Fijos", icon: MapPin },
  'puntos-fijos': { label: "Puntos Fijos Divulgación", icon: MapPin },
  'lista-anexo-i': { label: "Listado de Anexo I", icon: ClipboardList },
  'solicitud-capacitacion': { label: "Anexo V - Solicitudes", icon: ClipboardCheck },
  'agenda-anexo-i': { label: "Agenda Anexo I", icon: CalendarDays },
  'agenda-anexo-v': { label: "Agenda Anexo V", icon: CalendarDays },
  'maquinas': { label: "Inventario de Máquinas", icon: Cpu },
  'control-movimiento-maquinas': { label: "Movimiento de Máquinas", icon: ArrowLeftRight },
  'denuncia-lacres': { label: "Denuncia de Lacres", icon: ShieldAlert },
  'informe-movimientos-denuncias': { label: "Trazabilidad Logística", icon: ArrowLeftRight },
  'informe-divulgador': { label: "Anexo III - Informe del Divulgador", icon: UserCheck },
  'galeria-capacitaciones': { label: "Galería Evidencias", icon: Images },
  'informe-semanal-puntos-fijos': { label: "Anexo IV - Informe Semanal", icon: TableProperties },
  'lista-anexo-iv': { label: "Listado de Anexo IV", icon: ClipboardList },
  'archivo-anexo-i': { label: "Historial Anexo I", icon: History },
  'archivo-anexo-v': { label: "Historial Anexo V", icon: History },
  'archivo-capacitaciones': { label: "Historial General", icon: History },
  'divulgadores': { label: "Directorio Divulgadores", icon: UserCircle },
  'encuesta-satisfaccion': { label: "Anexo II - Encuesta de Satisfacción", icon: MessageSquareHeart },

  // REGISTROS ELECTORALES
  'ficha': { label: "Vista de Ficha", icon: FileText },
  'fotos': { label: "Imágenes", icon: ImageIcon },
  'cargar-ficha': { label: "Cargar Ficha", icon: UploadCloud },
  'configuracion-semanal': { label: "Configuración de Fechas", icon: CalendarCog },
  'informe-semanal-registro': { label: "Informe Semanal Registro", icon: ClipboardList },
  'reporte-semanal-registro': { label: "Monitor de Informes", icon: History },
  'archivo-semanal-registro': { label: "Archivo de Informes", icon: Archive },

  // ANÁLISIS Y REPORTES
  'resumen': { label: "Resumen Ubicaciones", icon: BarChart3 },
  'informe-general': { label: "Informe General PDF", icon: FileArchive },
  'reportes-pdf': { label: "Reportes PDF y Estadísticas", icon: PieChart },
  'estadisticas-solicitudes': { label: "Estadísticas Solicitudes", icon: BarChart3 },
  'reporte-miembros-mesa': { label: "Reporte Miembros de Mesa", icon: Users },
  'informe-cidee': { label: "Informe Técnico Word", icon: FileText },
  'compendio-general': { label: "Compendio General", icon: FileText },

  // LOCALES DE VOTACIÓN
  'locales-votacion': { label: "Buscador de Locales", icon: Vote },
  'cargar-fotos-locales': { label: "Cargar Fotos Lote", icon: UploadCloud },

  // GESTIÓN DE DATOS
  'importar-reportes': { label: "Importar Reportes", icon: MapPin },
  'importar-locales': { label: "Importar Locales", icon: MapPin },
  'importar-partidos': { label: "Importar Partidos", icon: Flag },

  // SISTEMA
  'users': { label: "Usuarios", icon: Users },
  'conexiones': { label: "Monitoreo Conexiones", icon: Activity },
  'auditoria': { label: "Auditoría Sistema", icon: ScrollText },
  'settings': { label: "Configuración", icon: Settings },
  'documentacion': { label: "Documentación", icon: BookOpen },
};

export default function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { setOpen } = useSidebar();
  const { categories } = useModuleCategories();

  const menuGroups = useMemo(() => {
    const groups = [
      {
        label: "PRINCIPAL",
        items: [
          { href: "/", label: "Inicio", icon: LayoutGrid },
        ]
      }
    ];

    categories.forEach(cat => {
      const items: any[] = [];
      (cat.modules || []).forEach(moduleId => {
        const registryEntry = MODULE_REGISTRY[moduleId];
        if (registryEntry) {
          items.push({
            href: `/${moduleId}`,
            label: registryEntry.label,
            icon: registryEntry.icon
          });
        }
      });
      groups.push({
        label: cat.label.toUpperCase(),
        items
      });
    });

    groups.push({
      label: "MI CUENTA",
      items: [
        { href: "/perfil", label: "Mi Perfil", icon: UserCircle },
      ]
    });

    return groups;
  }, [categories]);

  const isAccessible = (href: string) => {
    if (!user) return false;
    if (href === '/' || href === '/perfil') return true;
    
    // Acceso Total Incondicional: Propietario o Súper Administrador
    if (user.isOwner || user.profile?.role === 'superadmin') return true;
    
    const moduleName = href.substring(1);

    // Para cualquier otro rol (incluyendo admin y director), se rige estrictamente por su perfil personalizado en Firestore
    return user.profile?.modules?.includes(moduleName) || false;
  };

  const handleLinkClick = () => {
    setOpen(false);
  };

  return (
    <div className="flex h-full flex-col bg-white border-r">
      <SidebarHeader className="py-6 px-6">
        <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground">SISTEMA DE GESTIÓN</span>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="scrollbar-sidebar overflow-y-auto px-6 pb-12">
        {menuGroups.map((group) => {
          const accessibleItems = group.items.filter(item => isAccessible(item.href));
          if (accessibleItems.length === 0) return null;

          const isSystemGroup = group.label === "PRINCIPAL" || group.label === "MI CUENTA";

          if (isSystemGroup) {
            return (
              <div key={group.label} className="mb-6">
                <SidebarMenu>
                  {accessibleItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className={cn(
                            "min-h-10 h-auto px-4 rounded-xl transition-all duration-200 border-transparent",
                            isActive 
                              ? "bg-muted/30 shadow-sm text-[#1A1A1A]" 
                              : "hover:bg-muted/20 text-[#1A1A1A]/60 hover:translate-x-1"
                          )}
                          tooltip={item.label}
                        >
                          <Link href={item.href} onClick={handleLinkClick} className="flex items-center gap-4 w-full py-2">
                            <item.icon className={cn(
                              "h-4 w-4 shrink-0 transition-colors", 
                              isActive ? "text-primary" : "text-[#1A1A1A]/30"
                            )} />
                            <span className={cn(
                              "text-[11px] uppercase leading-none tracking-wide font-black",
                              isActive ? "text-[#1A1A1A]" : "text-[#1A1A1A]/80"
                            )}>
                              {item.label}
                            </span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </div>
            );
          }

          const hasActiveChild = accessibleItems.some(item => pathname === item.href);

          return (
            <Collapsible 
              key={group.label} 
              className="group/collapsible mb-8" 
              defaultOpen={hasActiveChild}
            >
              <SidebarGroup className="py-0">
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="flex w-full items-center justify-between hover:opacity-70 transition-all mb-4 px-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#1A1A1A]/60 group-data-[collapsible=icon]:hidden text-center flex-1 pr-4 whitespace-nowrap">
                      {group.label}
                    </span>
                    <ChevronDown className="h-3 w-3 opacity-30 transition-transform group-data-[state=open]/collapsible:rotate-180 group-data-[collapsible=icon]:hidden" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent className="space-y-1.5">
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {accessibleItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                          <SidebarMenuItem key={item.href}>
                            <SidebarMenuButton
                              asChild
                              isActive={isActive}
                              className={cn(
                                "min-h-10 h-auto px-4 rounded-xl transition-all duration-200 border-transparent",
                                isActive 
                                  ? "bg-muted/30 shadow-sm text-[#1A1A1A]" 
                                  : "hover:bg-muted/20 text-[#1A1A1A]/60 hover:translate-x-1"
                              )}
                              tooltip={item.label}
                            >
                              <Link href={item.href} onClick={handleLinkClick} className="flex items-center gap-4 w-full py-2">
                                <item.icon className={cn(
                                  "h-4 w-4 shrink-0 transition-colors", 
                                  isActive ? "text-primary" : "text-[#1A1A1A]/30"
                                )} />
                                <span className={cn(
                                  "text-[11px] uppercase leading-none group-data-[collapsible=icon]:hidden tracking-wide font-black",
                                  isActive ? "text-[#1A1A1A]" : "text-[#1A1A1A]/80"
                                )}>
                                  {item.label}
                                </span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>
    </div>
  );
}
