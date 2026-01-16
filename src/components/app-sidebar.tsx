"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Settings, ImageIcon, Users, FileText, LogOut, BarChart3, LayoutDashboard, User, FileArchive } from "lucide-react";
import { useFirebase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

export default function AppSidebar() {
  const pathname = usePathname();
  const { auth, user } = useFirebase();
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
      label: "Imágenes",
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
      href: "/informe-general",
      label: "Informe General",
      icon: FileArchive,
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
        <div className="flex h-10 items-center gap-3">
            <Image src="/logo.png" alt="Logo" width={32} height={32} className="rounded-sm"/>
            <span className="text-lg font-semibold text-sidebar-foreground truncate group-data-[collapsible=icon]:hidden">
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
                tooltip={item.label}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span className="flex-1 truncate group-data-[collapsible=icon]:hidden">
                    {item.label}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        {user && (
            <div className="px-2 py-2 group-data-[collapsible=icon]:hidden">
                <div className="flex items-center gap-3 p-2 rounded-md">
                   <Avatar className="h-8 w-8">
                       <AvatarImage src={user.photoURL ?? undefined} />
                       <AvatarFallback>
                           <User className="h-4 w-4"/>
                       </AvatarFallback>
                   </Avatar>
                   <div className="flex flex-col truncate">
                       <span className="text-sm font-semibold text-sidebar-foreground truncate">{user.displayName || 'Usuario'}</span>
                       <span className="text-xs text-sidebar-foreground/70 truncate">{user.email}</span>
                   </div>
                </div>
            </div>
        )}
        <SidebarSeparator />
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout} tooltip="Cerrar Sesión">
                    <LogOut />
                    <span className="flex-1 truncate group-data-[collapsible=icon]:hidden">Cerrar Sesión</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
