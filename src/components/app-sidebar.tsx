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
  TableProperties
} from "lucide-react";
import { useUser } from "@/firebase";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
    <div className="flex h-full flex-col bg-sidebar">
      <SidebarHeader className="py-4">
        <div className="flex items-center gap-3 px-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 shadow-sm">
              <Image src="/logo.png" alt="Logo" width={28} height={28} className="object-contain"/>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-sidebar-foreground uppercase leading-tight tracking-tighter">
                  JUSTICIA
              </span>
              <span className="text-[10px] font-black text-primary uppercase leading-tight tracking-tighter">
                  ELECTORAL
              </span>
            </div>
        </div>
      </SidebarHeader>
      <SidebarSeparator className="opacity-50" />
      <SidebarContent className="scrollbar-sidebar overflow-y-auto">
        {menuGroups.map((group) => {
          const accessibleItems = group.items.filter(item => isAccessible(item.href));
          if (accessibleItems.length === 0) return null;

          return (
            <Collapsible key={group.label} className="group/collapsible" defaultOpen={false}>
              <SidebarGroup className="py-0.5">
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="flex w-full items-center justify-between hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground px-3 py-1.5 rounded-md transition-all duration-200">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-sidebar-foreground/60">{group.label}</span>
                    <ChevronDown className="h-3 w-3 opacity-50 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent className="space-y-0.5 px-1">
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {accessibleItems.map((item) => (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton
                            asChild
                            isActive={pathname === item.href}
                            tooltip={item.label}
                            className="min-h-9 h-auto px-3 transition-colors data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                          >
                            <Link href={item.href} className="flex items-center gap-3 w-full py-1">
                              <item.icon className="h-4 w-4 shrink-0" />
                              <span className="text-xs font-medium leading-snug break-words whitespace-normal">{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="mt-auto border-t border-sidebar-border/50 p-4">
        <div className="flex items-center justify-between opacity-40">
            <span className="text-[10px] font-mono tracking-tighter uppercase font-bold">Sistema de Gestión</span>
            <span className="text-[10px] font-mono">v1.0.0</span>
        </div>
      </SidebarFooter>
    </div>
  );
}
