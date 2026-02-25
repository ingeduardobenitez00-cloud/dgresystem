
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
  ChevronDown,
  MessageSquareHeart,
  UserCheck,
  PieChart,
  TableProperties,
  ArrowLeftRight,
  Flag,
  FileUp,
  UserCircle,
  BookOpen,
  ShieldAlert
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
      label: "CIDEE - CAPACITACIONES",
      items: [
        { href: "/solicitud-capacitacion", label: "Nueva Solicitud", icon: ClipboardCheck },
        { href: "/divulgadores", label: "Directorio Divulgadores", icon: UserCircle },
        { href: "/agenda-capacitacion", label: "Agenda", icon: CalendarDays },
        { href: "/control-movimiento-maquinas", label: "Movimiento de Máquinas", icon: ArrowLeftRight },
        { href: "/denuncia-lacres", label: "Denuncia de Lacres", icon: ShieldAlert },
        { href: "/encuesta-satisfaccion", label: "Encuesta Satisfacción", icon: MessageSquareHeart },
        { href: "/informe-divulgador", label: "Informe del Divulgador", icon: UserCheck },
        { href: "/informe-semanal-puntos-fijos", label: "Informe Semanal (Anexo IV)", icon: TableProperties },
        { href: "/estadisticas-capacitacion", label: "Estadísticas", icon: PieChart },
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
        { href: "/documentacion", label: "Documentación", icon: BookOpen },
      ]
    },
  ];

  const isAccessible = (href: string) => {
    if (!user) return false;
    if (href === '/') return true;
    if (user.profile?.role === 'admin') return true;
    const moduleName = href.substring(1);
    return user.profile?.modules?.includes(moduleName);
  };

  return (
    <div className="flex h-full flex-col bg-sidebar border-r">
      <SidebarHeader className="py-8 px-6">
        <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-md border-2 border-muted">
              <Image src="/logo.png" alt="Logo" width={32} height={32} className="object-contain" priority />
            </div>
            <div className="flex flex-col group-data-[collapsible=icon]:hidden">
              <span className="text-[12px] font-black uppercase leading-none tracking-tight">JUSTICIA</span>
              <span className="text-[12px] font-black text-primary uppercase leading-none tracking-tight mt-0.5">ELECTORAL</span>
            </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="scrollbar-sidebar overflow-y-auto px-3">
        {menuGroups.map((group) => {
          const accessibleItems = group.items.filter(item => isAccessible(item.href));
          if (accessibleItems.length === 0) return null;

          return (
            <Collapsible key={group.label} className="group/collapsible mb-4" defaultOpen={true}>
              <SidebarGroup className="py-0">
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="flex w-full items-center justify-between hover:bg-sidebar-accent/50 px-3 py-2 rounded-lg transition-all mb-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.1em] text-primary/60 group-data-[collapsible=icon]:hidden">{group.label}</span>
                    <ChevronDown className="h-3 w-3 opacity-30 transition-transform group-data-[state=open]/collapsible:rotate-180 group-data-[collapsible=icon]:hidden" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent className="space-y-1">
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
                                "min-h-10 h-auto px-3 rounded-xl transition-all duration-200",
                                isActive 
                                  ? "bg-primary text-primary-foreground shadow-lg font-bold" 
                                  : "hover:bg-sidebar-accent text-sidebar-foreground/80 hover:translate-x-1"
                              )}
                              tooltip={item.label}
                            >
                              <Link href={item.href} className="flex items-center gap-3 w-full py-2">
                                <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary-foreground" : "text-sidebar-foreground/60")} />
                                <span className="text-[11px] font-black uppercase leading-none group-data-[collapsible=icon]:hidden tracking-tight">{item.label}</span>
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
