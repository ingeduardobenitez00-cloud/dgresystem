
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { BookMarked, Settings, ImageIcon, Users, FileText, LogOut, BarChart3, LayoutDashboard } from "lucide-react";
import { useFirebase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";

export default function AppSidebar() {
  const pathname = usePathname();
  const { auth } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await auth.signOut();
      toast({ title: "Sesión cerrada" });
      router.push('/login');
    } catch (error) {
      toast({ variant: 'destructive', title: "Error al cerrar sesión" });
    }
  };

  const menuItems = [
    {
      href: "/",
      label: "Principal",
      icon: LayoutDashboard,
    },
    {
      href: "/fotos",
      label: "Fotos",
      icon: ImageIcon,
    },
    {
      href: "/ficha",
      label: "Vista de Ficha",
      icon: FileText,
    },
    {
      href: "/resumen",
      label: "Resumen",
      icon: BarChart3,
    },
    {
      href: "/users",
      label: "Usuarios",
      icon: Users,
    },
    {
      href: "/settings",
      label: "Configuración",
      icon: Settings,
    },
  ];

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2">
            <BookMarked className="h-7 w-7 text-primary" />
            <span className="text-lg font-semibold text-foreground">
                Informe Edilicio
            </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                icon={<item.icon />}
                tooltip={item.label}
              >
                <Link href={item.href}>
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout} icon={<LogOut />} tooltip="Cerrar Sesión">
                    <span>Cerrar Sesión</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
