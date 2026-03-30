
"use client";

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useFirebase, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { LogOut, User, Bell, Check, UserPlus, Info, Clock, CheckCircle2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { recordAuditLog } from '@/lib/audit';
import { collection, query, where, orderBy, limit, updateDoc, doc } from 'firebase/firestore';
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Header({ title }: { title?: string }) {
  const { auth, firestore } = useFirebase();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const isStaff = useMemo(() => {
    const role = user?.profile?.role;
    return role === 'admin' || role === 'director' || role === 'coordinador';
  }, [user]);

  // NOTIFICACIONES EN TIEMPO REAL
  const notiQuery = useMemoFirebase(() => {
    if (!firestore || !isStaff) return null;
    return query(
        collection(firestore, 'notificaciones'), 
        where('leida', '==', false), 
        orderBy('fecha_creacion', 'desc'),
        limit(10)
    );
  }, [firestore, isStaff]);

  const { data: notifications } = useCollection<any>(notiQuery);

  const handleLogout = async () => {
    if (!auth || !firestore || !user) return;
    try {
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

  const handleMarkAsRead = async (notiId: string) => {
    if (!firestore) return;
    try {
        await updateDoc(doc(firestore, 'notificaciones', notiId), { leida: true });
    } catch (e) {
        console.error(e);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="h-auto w-auto p-0 bg-transparent hover:bg-transparent border-none shadow-none flex items-center gap-3 group transition-all">
            <div className="h-10 w-10 relative bg-white rounded-full p-1.5 shadow-md border border-gray-100 flex items-center justify-center group-hover:scale-105 transition-transform">
               <Image 
                src="/logo.png" 
                alt="Logo Justicia Electoral" 
                width={30} 
                height={30}
                className="object-contain" 
                priority 
              />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[10px] font-black text-foreground uppercase leading-none tracking-tighter group-hover:text-primary transition-colors">
                  JUSTICIA
              </span>
              <span className="text-[10px] font-black text-primary uppercase leading-none tracking-tighter mt-0.5">
                  ELECTORAL
              </span>
            </div>
          </SidebarTrigger>
          
          {title && (
            <div className="hidden lg:flex items-center ml-4 pl-4 border-l h-6">
              <h1 className="text-sm font-bold truncate text-muted-foreground uppercase tracking-tight">{title}</h1>
            </div>
          )}
        </div>

        {user && (
          <div className="flex items-center gap-3">
            {/* NOTIFICACIONES PARA STAFF */}
            {isStaff && (
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full hover:bg-muted">
                            <Bell className="h-5 w-5 text-muted-foreground" />
                            {notifications && notifications.length > 0 && (
                                <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-destructive text-white border-2 border-white animate-in zoom-in duration-300">
                                    <span className="text-[10px] font-black">{notifications.length}</span>
                                </Badge>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0 overflow-hidden shadow-2xl border-none rounded-2xl" align="end">
                        <div className="bg-black text-white p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                <Bell className="h-3 w-3" /> Alertas de Seguridad
                            </p>
                        </div>
                        <ScrollArea className="h-80">
                            {notifications && notifications.length > 0 ? (
                                <div className="divide-y">
                                    {notifications.map((noti) => (
                                        <div key={noti.id} className="p-4 hover:bg-muted/30 transition-colors group relative">
                                            <div className="flex items-start gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                                                    {noti.tipo === 'NUEVO_USUARIO' ? <UserPlus className="h-4 w-4 text-primary" /> : <Info className="h-4 w-4 text-primary" />}
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[11px] font-black uppercase leading-tight">{noti.titulo}</p>
                                                    <p className="text-[10px] font-medium text-muted-foreground leading-relaxed uppercase">{noti.mensaje}</p>
                                                    <div className="flex items-center gap-2 mt-2 opacity-40">
                                                        <Clock className="h-2.5 w-2.5" />
                                                        <span className="text-[8px] font-black">
                                                            {noti.fecha_creacion ? format(new Date(noti.fecha_creacion), "dd/MM/yy HH:mm", { locale: es }) : 'RECIENTE'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="absolute top-2 right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => handleMarkAsRead(noti.id)}
                                            >
                                                <Check className="h-3 w-3 text-green-600" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-12 text-center space-y-2 opacity-20">
                                    <CheckCircle2 className="h-10 w-10 mx-auto" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">Sin alertas pendientes</p>
                                </div>
                            )}
                        </ScrollArea>
                        <div className="p-3 bg-muted/20 border-t text-center">
                            <Button variant="link" className="h-auto p-0 text-[9px] font-black uppercase text-muted-foreground" onClick={() => router.push('/users')}>
                                GESTIONAR TODOS LOS USUARIOS
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>
            )}

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
