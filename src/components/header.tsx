"use client";

import Image from 'next/image';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useFirebase, useUser } from "@/firebase";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { LogOut, User, Menu } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";

export default function Header({ title }: { title?: string }) {
  const { auth } = useFirebase();
  const { user } = useUser();
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

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="flex h-10 w-10 rounded-full border border-muted-foreground/20 hover:bg-muted transition-all text-muted-foreground">
            <Menu className="h-5 w-5" />
          </SidebarTrigger>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 relative">
               <Image 
                src="/logo.png" 
                alt="Justicia Electoral Logo" 
                fill 
                className="object-contain" 
                priority 
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-foreground uppercase leading-tight tracking-tighter">
                  JUSTICIA
              </span>
              <span className="text-[10px] font-black text-primary uppercase leading-tight tracking-tighter">
                  ELECTORAL
              </span>
            </div>
          </div>
          {title && (
            <div className="hidden lg:flex items-center ml-4 pl-4 border-l h-6">
              <h1 className="text-sm font-bold truncate text-muted-foreground">{title}</h1>
            </div>
          )}
        </div>

        {user && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-muted/50 border">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user.photoURL ?? undefined} />
                <AvatarFallback className="bg-primary text-white text-[10px]">
                  <User className="h-3 w-3"/>
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col text-left hidden md:flex pr-1">
                <span className="text-[10px] font-bold leading-none">{user.profile?.username || 'Usuario'}</span>
                <span className="text-[8px] text-muted-foreground uppercase font-bold mt-0.5">{user.profile?.role}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Cerrar Sesión" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive transition-colors">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
