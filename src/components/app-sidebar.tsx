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
  ChevronDown
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
      label: "Capacitación",
      items: [
        { href: "/solicitud-capacitacion", label: "Nueva Solicitud", icon: ClipboardCheck },
        { href: "/agenda-capacitacion", label: "Agenda", icon: CalendarDays },
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
    <>
      <SidebarHeader>
        <div className="flex h-12 items-center gap-2 px-2">
            <div className="shrink-0">
              <Image src="/logo.png" alt="Logo" width={24} height={24} className="rounded-sm"/>
            </div>
            <span className="text-[10px] font-black text-sidebar-foreground uppercase leading-tight tracking-tight">
                JUSTICIA ELECTORAL
            </span>
        </div>
        <SidebarSeparator />
      </SidebarHeader>
      <SidebarContent>
        {menuGroups.map((group) => {
          const accessibleItems = group.items.filter(item => isAccessible(item.href));
          if (accessibleItems.length === 0) return null;

          return (
            <Collapsible key={group.label} className="group/collapsible" defaultOpen={true}>
              <SidebarGroup>
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="flex w-full items-center justify-between hover:bg-sidebar-accent hover:text-sidebar-accent-foreground px-2 py-1 rounded-md transition-colors">
                    <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">{group.label}</span>
                    <ChevronDown className="ml-auto h-3 w-3 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {accessibleItems.map((item) => (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton
                            asChild
                            isActive={pathname === item.href}
                            tooltip={item.label}
                            className="h-8"
                          >
                            <Link href={item.href}>
                              <item.icon className="h-4 w-4" />
                              <span className="text-xs font-medium">{item.label}</span>
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
      <SidebarFooter>
        <div className="px-4 py-2 text-[9px] text-muted-foreground font-mono opacity-50">
            v1.0.0
        </div>
      </SidebarFooter>
    </>
  );
}
