
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
  ShieldAlert,
  LayoutGrid
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
        { href: "/", label: "Inicio", icon: LayoutGrid },
      ]
    },
    {
      label: "Cidee - Capacitaciones",
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
    <div className="flex h-full flex-col bg-white border-r">
      <SidebarHeader className="py-10 px-8">
        <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-xl border-2 border-muted/20">
              <Image src="/logo.png" alt="Logo" width={36} height={36} className="object-contain" priority />
            </div>
            <div className="flex flex-col group-data-[collapsible=icon]:hidden">
              <span className="text-[13px] font-black uppercase leading-none tracking-tight text-[#1A1A1A]">JUSTICIA</span>
              <span className="text-[13px] font-black text-primary uppercase leading-none tracking-tight mt-1">ELECTORAL</span>
            </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="scrollbar-sidebar overflow-y-auto px-4 pb-8">
        {menuGroups.map((group) => {
          const accessibleItems = group.items.filter(item => isAccessible(item.href));
          if (accessibleItems.length === 0) return null;

          // Determinamos si el grupo debe estar abierto inicialmente (si tiene una ruta activa)
          const hasActiveChild = accessibleItems.some(item => pathname === item.href);

          return (
            <Collapsible 
              key={group.label} 
              className="group/collapsible mb-6" 
              defaultOpen={hasActiveChild}
            >
              <SidebarGroup className="py-0">
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="flex w-full items-center justify-between hover:bg-muted/50 px-4 py-3 rounded-xl transition-all mb-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#1A1A1A]/60 group-data-[collapsible=icon]:hidden">
                      {group.label}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-30 transition-transform group-data-[state=open]/collapsible:rotate-180 group-data-[collapsible=icon]:hidden" />
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
                                "min-h-11 h-auto px-4 rounded-2xl transition-all duration-200 border-transparent",
                                isActive 
                                  ? "bg-[#F8F9FA] shadow-sm font-black text-[#1A1A1A]" 
                                  : "hover:bg-muted/30 text-[#1A1A1A]/70 hover:translate-x-1"
                              )}
                              tooltip={item.label}
                            >
                              <Link href={item.href} className="flex items-center gap-4 w-full py-2.5">
                                <item.icon className={cn(
                                  "h-5 w-5 shrink-0 transition-colors", 
                                  isActive ? "text-primary" : "text-[#1A1A1A]/40"
                                )} />
                                <span className={cn(
                                  "text-[11px] font-black uppercase leading-none group-data-[collapsible=icon]:hidden tracking-tight",
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
