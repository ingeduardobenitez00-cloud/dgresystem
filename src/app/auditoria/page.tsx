"use client";

import { useMemo, useState } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useUser, useFirebase, useCollection, useMemoFirebase, useCollectionOnce } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Loader2, ScrollText, User, Calendar, Clock, Database, ShieldAlert, Search } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type AuditLog = {
  id: string;
  usuario_id: string;
  usuario_nombre: string;
  usuario_rol: string;
  accion: string;
  modulo: string;
  detalles?: string;
  fecha_servidor: any;
};

export default function AuditoriaPage() {
  const { user: currentUser, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const [search, setSearch] = useState('');

  const isAdmin = useMemo(() => 
    currentUser?.profile?.role === 'admin' || currentUser?.profile?.role === 'director',
    [currentUser]
  );

  const auditQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !isAdmin) return null;
    return query(
        collection(firestore, 'auditoria'), 
        orderBy('fecha_servidor', 'desc'),
        limit(200)
    );
  }, [firestore, isUserLoading, isAdmin]);

  const { data: logs, isLoading } = useCollectionOnce<AuditLog>(auditQuery);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    const term = search.toLowerCase().trim();
    return logs.filter(log => 
        log.usuario_nombre.toLowerCase().includes(term) ||
        log.accion.toLowerCase().includes(term) ||
        log.modulo.toLowerCase().includes(term) ||
        log.detalles?.toLowerCase().includes(term)
    );
  }, [logs, search]);

  if (isUserLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
        <Header title="Acceso Restringido" />
        <main className="flex-1 p-8 flex items-center justify-center">
          <Card className="max-w-md w-full text-center p-8 border-dashed">
            <ShieldAlert className="h-16 w-16 mx-auto text-muted-foreground opacity-20 mb-4" />
            <h2 className="text-xl font-black uppercase text-primary mb-2">Módulo Restringido</h2>
            <p className="text-xs text-muted-foreground font-bold uppercase">Solo los administradores nacionales tienen acceso al registro de auditoría.</p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Auditoría del Sistema" />
      
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-end gap-6">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-primary uppercase leading-none">Bitácora Técnica</h1>
                <p className="text-muted-foreground text-[10px] font-bold uppercase flex items-center gap-2 mt-2 tracking-widest">
                    <ScrollText className="h-3.5 w-3.5" /> Registro histórico de operaciones y seguridad
                </p>
            </div>
            <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                <Input 
                    placeholder="Buscar en el registro..." 
                    className="h-12 pl-10 font-bold border-2 rounded-2xl bg-white shadow-sm"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>
        </div>

        <Card className="shadow-2xl border-none overflow-hidden rounded-[2rem] bg-white">
            <CardHeader className="bg-muted/5 border-b p-8">
                <CardTitle className="uppercase font-black text-sm tracking-widest flex items-center gap-3">
                    <Database className="h-5 w-5 text-primary" /> ACTIVIDAD RECIENTE DEL SISTEMA
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase">Listado cronológico de las últimas 200 acciones realizadas</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                {isLoading ? (
                    <div className="flex justify-center items-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow>
                                    <TableHead className="text-[9px] font-black uppercase tracking-widest px-8">Fecha y Hora</TableHead>
                                    <TableHead className="text-[9px] font-black uppercase tracking-widest">Usuario</TableHead>
                                    <TableHead className="text-[9px] font-black uppercase tracking-widest">Módulo</TableHead>
                                    <TableHead className="text-[9px] font-black uppercase tracking-widest">Acción</TableHead>
                                    <TableHead className="text-[9px] font-black uppercase tracking-widest px-8">Detalle de la Operación</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredLogs.map((log) => (
                                    <TableRow key={log.id} className="hover:bg-muted/20 transition-colors border-b">
                                        <TableCell className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-primary">
                                                    {log.fecha_servidor ? format(log.fecha_servidor.toDate(), "dd/MM/yyyy", { locale: es }) : '---'}
                                                </span>
                                                <span className="text-[9px] font-bold text-muted-foreground">
                                                    {log.fecha_servidor ? format(log.fecha_servidor.toDate(), "HH:mm:ss", { locale: es }) : '---'}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <User className="h-3 w-3 opacity-30" />
                                                <div>
                                                    <p className="font-black text-[10px] uppercase leading-tight">{log.usuario_nombre}</p>
                                                    <p className="text-[8px] font-bold text-muted-foreground uppercase">{log.usuario_rol}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="bg-muted/20 text-[8px] font-black uppercase border-primary/10">
                                                {log.modulo.replace('-', ' ')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span className={cn(
                                                "text-[10px] font-black uppercase",
                                                log.accion === 'CREAR' ? "text-green-600" : 
                                                log.accion === 'BORRAR' ? "text-destructive" : 
                                                log.accion === 'EDITAR' ? "text-amber-600" : "text-primary"
                                            )}>
                                                {log.accion}
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-8 max-w-md">
                                            <p className="text-[10px] font-medium leading-relaxed italic text-muted-foreground">
                                                {log.detalles || 'Sin detalles adicionales'}
                                            </p>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
      </main>
    </div>
  );
}
