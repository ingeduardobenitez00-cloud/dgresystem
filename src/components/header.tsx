"use client";

import Image from 'next/image';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useFirebase, useUser } from "@/firebase";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { LogOut, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { recordAuditLog } from '@/lib/audit';

export default function Header({ title }: { title?: string }) {
  const { auth, firestore } = useFirebase();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = async () => {
    if (!auth || !firestore || !user) return;
    try {
      // Registrar cierre de sesión en auditoría
      recordAuditLog(firestore, {
        usuario_id: user.uid,
        usuario_nombre: user.profile?.username || user.email || 'Usuario',
        usuario_rol: user.profile?.role || 'funcionario',
        accion: 'LOGOUT',
        modulo: 'seguridad',
        detalles: `Cierre de sesión manual finalizado.`
      });

      await auth.signOut();
      router.replace('/login');
    } catch (error) {
      toast({ variant: 'destructive', title: "Error al cerrar sesión" });
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-4">
          {/* BOTÓN PLEGABLE - ESTILO CIRCULAR SEGÚN REFERENCIA */}
          <SidebarTrigger className="h-11 w-11 rounded-full border border-gray-200 bg-white hover:bg-muted text-foreground transition-all shadow-sm flex items-center justify-center [&_svg]:size-5" />
          
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
              <span className="text-[10px] font-black text-foreground uppercase leading-none tracking-tighter">
                  JUSTICIA
              </span>
              <span className="text-[10px] font-black text-primary uppercase leading-none tracking-tighter mt-0.5">
                  ELECTORAL
              </span>
            </div>
          </div>
          {title && (
            <div className="hidden lg:flex items-center ml-4 pl-4 border-l h-6">
              <h1 className="text-sm font-bold truncate text-muted-foreground uppercase tracking-tight">{title}</h1>
            </div>
          )}
        </div>

        {user && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border shadow-sm">
              <Avatar className="h-7 w-7 border-2 border-background">
                <AvatarImage src={user.photoURL ?? undefined} />
                <AvatarFallback className="bg-primary text-white text-[10px]">
                  <User className="h-3 w-3"/>
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col text-left hidden sm:flex pr-1">
                <span className="text-[10px] font-black leading-none uppercase">{user.profile?.username || 'Usuario'}</span>
                <span className="text-[8px] text-muted-foreground uppercase font-bold mt-0.5">{user.profile?.role}</span>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleLogout} 
              title="Cerrar Sesión" 
              className="h-9 w-9 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors border border-transparent hover:border-destructive/20"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
