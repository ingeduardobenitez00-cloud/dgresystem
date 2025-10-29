"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { BookMarked, LayoutGrid, Settings } from "lucide-react";

export default function AppSidebar() {
  const pathname = usePathname();

  const menuItems = [
    {
      href: "/",
      label: "Departamentos",
      icon: LayoutGrid,
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
              <Link href={item.href} legacyBehavior passHref>
                <SidebarMenuButton
                  isActive={pathname === item.href}
                  icon={<item.icon />}
                  tooltip={item.label}
                >
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        {/* You can add footer content here */}
      </SidebarFooter>
    </>
  );
}
