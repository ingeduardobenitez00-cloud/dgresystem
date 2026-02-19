"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarSeparator,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import { 
  Settings, 
  ImageIcon, 
  Users, 
  FileText, 
  BarChart3, 
  LayoutDashboard, 
  FileArchive, 
  UploadCloud,
  ClipboardCheck,
  CalendarDays,
  Vote,
  FileUp,
  ChevronDown,
  MessageSquareHeart,
  UserCheck,
  PieChart,
  TableProperties,
  ArrowLeftRight,
  Flag
} from "lucide-react";
import { useUser } from "@/firebase";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export default function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();

  const menuGroups = [
    {
      label: "Principal",
      items: [
        { href: "/", label: "Inicio", icon: LayoutDashboard },
      ]
    },
    {
      label: "DGRE",
      items: [
        { href: "/control-movimiento-maquinas", label: "Movimiento de Máquinas", icon: ArrowLeftRight },
      ]
    },
    {
      label: "Registros Electorales",
      items: [
        { href: "/ficha", label: "Vista de Ficha", icon: FileText },
        { href: "/fotos", label: "Imágenes", icon: ImageIcon },
        { href: "/cargar-ficha", label: "Cargar Ficha", icon: UploadCloud },
      ]
    },
    {
      label: "CIDEE - CAPACITACIONES",
      items: [
        { href: "/solicitud-capacitacion", label: "Nueva Solicitud", icon: ClipboardCheck },
        { href: "/agenda-capacitacion", label: "Agenda", icon: CalendarDays },
        { href: "/encuesta-satisfaccion", label: "Encuesta Satisfacción", icon: MessageSquareHeart },
        { href: "/informe-divulgador", label: "Informe del Divulgador", icon: UserCheck },
        { href: "/informe-semanal-puntos-fijos", label: "Informe Semanal (Anexo IV)", icon: TableProperties },
        { href: "/estadisticas-capacitacion", label: "Estadísticas", icon: PieChart },
      ]
    },
    {
      label: "Análisis y Reportes",
      items: [
        { href: "/resumen", label: "Resumen Ubicaciones", icon: BarChart3 },
        { href: "/informe-general", label: "Informe General PDF", icon: FileArchive },
      ]
    },
    {
      label: "Locales de Votación",
      items: [
        { href: "/locales-votacion", label: "Buscador de Locales", icon: Vote },
        { href: "/cargar-fotos-locales", label: "Cargar Fotos Lote", icon: UploadCloud },
      ]
    },
    {
      label: "Gestión de Datos",
      items: [
        { href: "/importar-reportes", label: "Importar Reportes", icon: FileUp },
        { href: "/importar-locales", label: "Importar Locales", icon: FileUp },
        { href: "/importar-partidos", label: "Importar Partidos", icon: Flag },
      ]
    },
    {
      label: "Sistema",
      items: [
        { href: "/users", label: "Usuarios", icon: Users },
        { href: "/settings", label: "Configuración", icon: Settings },
      ]
    },
  ];

  const isAccessible = (href: string) => {
    if (user?.profile?.role === 'admin') return true;
    if (href === '/') return true;
    const moduleName = href.substring(1);
    return user?.profile?.modules?.includes(moduleName);
  };

  return (
    <div className="flex h-full flex-col bg-sidebar border-r">
      <SidebarHeader className="py-6 px-4">
        <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm border border-muted/20">
              <Image src="/logo.png" alt="Logo" width={30} height={30} className="object-contain" priority />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-foreground uppercase leading-none tracking-tight">
                  JUSTICIA
              </span>
              <span className="text-[11px] font-black text-primary uppercase leading-none tracking-tight mt-0.5">
                  ELECTORAL
              </span>
            </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="scrollbar-sidebar overflow-y-auto px-2">
        {menuGroups.map((group) => {
          const accessibleItems = group.items.filter(item => isAccessible(item.href));
          if (accessibleItems.length === 0) return null;

          return (
            <Collapsible key={group.label} className="group/collapsible mb-2" defaultOpen={group.label === "Principal"}>
              <SidebarGroup className="py-0">
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="flex w-full items-center justify-between hover:bg-sidebar-accent/50 px-3 py-2 rounded-lg transition-all duration-200 group/trigger">
                    <span className="text-[10px] font-black uppercase tracking-wider text-sidebar-foreground/60 group-hover/trigger:text-sidebar-foreground transition-colors">
                      {group.label}
                    </span>
                    <ChevronDown className="h-3 w-3 opacity-30 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent className="space-y-1 mt-1">
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {accessibleItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                          <SidebarMenuItem key={item.href}>
                            <SidebarMenuButton
                              asChild
                              isActive={isActive}
                              tooltip={item.label}
                              className={cn(
                                "min-h-10 h-auto px-3 rounded-lg transition-all duration-200 border border-transparent",
                                isActive 
                                  ? "bg-primary text-primary-foreground shadow-sm font-bold border-primary/10" 
                                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/80"
                              )}
                            >
                              <Link href={item.href} className="flex items-center gap-3 w-full py-2">
                                <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary-foreground" : "text-sidebar-foreground/60")} />
                                <span className="text-xs leading-none whitespace-nowrap">{item.label}</span>
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

      <SidebarFooter className="mt-auto border-t border-sidebar-border/50 p-4 bg-muted/5">
        <div className="flex flex-col gap-1 opacity-40">
            <span className="text-[9px] font-black tracking-tighter uppercase">Sistema de Gestión Integral</span>
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-mono uppercase font-bold text-primary">CIDEE - DGRE</span>
              <span className="text-[8px] font-mono font-bold">v1.0.0</span>
            </div>
        </div>
      </SidebarFooter>
    </div>
  );
}