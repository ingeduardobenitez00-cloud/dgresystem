
"use client";

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
  Calendar
} from "lucide-react";
import { useUser } from "@/firebase";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export default function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { setOpen } = useSidebar();

  const menuGroups = [
    {
      label: "PRINCIPAL",
      items: [
        { href: "/", label: "Inicio", icon: LayoutGrid },
      ]
    },
    {
      label: "CIDEE - CAPACITACIONES",
      items: [
        { href: "/calendario-capacitaciones", label: "Calendario Mensual", icon: Calendar },
        { href: "/anexo-i", label: "Anexo I - Lugares Fijos", icon: MapPin },
        { href: "/lista-anexo-i", label: "Listado de Anexo I", icon: ClipboardList },
        { href: "/solicitud-capacitacion", label: "Anexo V - Solicitudes", icon: ClipboardCheck },
        { href: "/agenda-anexo-i", label: "Agenda Anexo I", icon: CalendarDays },
        { href: "/agenda-anexo-v", label: "Agenda Anexo V", icon: CalendarDays },
        { href: "/control-movimiento-maquinas", label: "Movimiento de Máquinas", icon: ArrowLeftRight },
        { href: "/denuncia-lacres", label: "Denuncia de Lacres", icon: ShieldAlert },
        { href: "/informe-movimientos-denuncias", label: "Trazabilidad Logística", icon: ArrowLeftRight },
        { href: "/informe-divulgador", label: "Anexo III - Informe del Divulgador", icon: UserCheck },
        { href: "/galeria-capacitaciones", label: "Galería Evidencias", icon: Images },
        { href: "/informe-semanal-puntos-fijos", label: "Anexo IV - Informe Semanal", icon: TableProperties },
        { href: "/lista-anexo-iv", label: "Listado de Anexo IV", icon: ClipboardList },
        { href: "/archivo-capacitaciones", label: "Archivo / Historial", icon: History },
        { href: "/divulgadores", label: "Directorio Divulgadores", icon: UserCircle },
        { href: "/estadisticas-capacitacion", label: "Estadísticas", icon: PieChart },
        { href: "/encuesta-satisfaccion", label: "Anexo II - Encuesta de Satisfacción", icon: MessageSquareHeart },
      ]
    },
    {
      label: "REGISTROS ELECTORALES",
      items: [
        { href: "/ficha", label: "Vista de Ficha", icon: FileText },
        { href: "/fotos", label: "Imágenes", icon: ImageIcon },
        { href: "/cargar-ficha", label: "Cargar Ficha", icon: UploadCloud },
        { href: "/configuracion-semanal", label: "Configuración de Fechas", icon: CalendarCog },
        { href: "/informe-semanal-registro", label: "Informe Semanal Registro", icon: ClipboardList },
        { href: "/reporte-semanal-registro", label: "Monitor de Informes", icon: History },
        { href: "/archivo-semanal-registro", label: "Archivo de Informes", icon: Archive },
      ]
    },
    {
      label: "ANÁLISIS Y REPORTES",
      items: [
        { href: "/resumen", label: "Resumen Ubicaciones", icon: BarChart3 },
        { href: "/informe-general", label: "Informe General PDF", icon: FileArchive },
      ]
    },
    {
      label: "LOCALES DE VOTACIÓN",
      items: [
        { href: "/locales-votacion", label: "Buscador de Locales", icon: Vote },
        { href: "/cargar-fotos-locales", label: "Cargar Fotos Lote", icon: UploadCloud },
      ]
    },
    {
      label: "GESTIÓN DE DATOS",
      items: [
        { href: "/importar-reportes", label: "Importar Reportes", icon: MapPin },
        { href: "/importar-locales", label: "Importar Locales", icon: MapPin },
        { href: "/importar-partidos", label: "Importar Partidos", icon: Flag },
      ]
    },
    {
      label: "SISTEMA",
      items: [
        { href: "/users", label: "Usuarios", icon: Users },
        { href: "/conexiones", label: "Monitoreo Conexiones", icon: Activity },
        { href: "/auditoria", label: "Auditoría Sistema", icon: ScrollText },
        { href: "/settings", label: "Configuración", icon: Settings },
        { href: "/documentacion", label: "Documentación", icon: BookOpen },
      ]
    },
  ];

  const isAccessible = (href: string) => {
    if (!user) return false;
    if (href === '/') return true;
    // Bypass Maestro por Correo Propietario o Admin Role
    if (user.email === 'edubtz11@gmail.com' || user.profile?.role === 'admin') return true;
    const moduleName = href.substring(1);
    return user.profile?.modules?.includes(moduleName);
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
                    <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-[#1A1A1A]/60 group-data-[collapsible=icon]:hidden text-center flex-1 pr-4 whitespace-nowrap">
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
                                  "text-[11px] uppercase leading-none group-data-[collapsible=icon]:hidden tracking-wide",
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
