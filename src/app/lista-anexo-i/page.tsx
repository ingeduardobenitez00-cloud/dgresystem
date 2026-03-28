
"use client";

import { useState, useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { type AnexoI, type Dato, type SolicitudCapacitacion } from '@/lib/data';
import { 
    Loader2, 
    Eye, 
    FileText, 
    MapPin, 
    Calendar, 
    Building2, 
    Landmark, 
    Search, 
    ClipboardList,
    Download,
    ImageIcon,
    Clock,
    CheckCircle2,
    Activity,
    X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateToDDMMYYYY, cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import Image from 'next/image';

export default function ListaAnexoIPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingAnexo, setViewingAnexo] = useState<AnexoI | null>(null);

  const profile = user?.profile;

  const anexosQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !profile) return null;
    const colRef = collection(firestore, 'anexo-i');
    const hasAdminFilter = ['admin', 'director'].includes(profile.role || '') || profile.permissions?.includes('admin_filter');
    const hasDeptFilter = !hasAdminFilter && profile.permissions?.includes('department_filter');
    const hasDistFilter = !hasAdminFilter && !hasDeptFilter && (profile.permissions?.includes('district_filter') || profile.role === 'jefe' || profile.role === 'funcionario');

    if (hasAdminFilter) return query(colRef, orderBy('fecha_creacion', 'desc'));
    if (hasDeptFilter && profile.departamento) return query(colRef, where('departamento', '==', profile.departamento), orderBy('fecha_creacion', 'desc'));
    if (hasDistFilter && profile.departamento && profile.distrito) {
        return query(colRef, where('departamento', '==', profile.departamento), where('distrito', '==', profile.distrito), orderBy('fecha_creacion', 'desc'));
    }
    return null;
  }, [firestore, isUserLoading, profile]);

  const { data: anexos, isLoading } = useCollection<AnexoI>(anexosQuery);

  const solicitudesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'solicitudes-capacitacion');
  }, [firestore]);
  const { data: allSolicitudes } = useCollection<SolicitudCapacitacion>(solicitudesQuery);

  const filteredAnexos = useMemo(() => {
    if (!anexos) return [];
    const term = searchTerm.toLowerCase().trim();
    return anexos.filter(a => 
        a.departamento.toLowerCase().includes(term) || 
        a.distrito.toLowerCase().includes(term)
    );
  }, [anexos, searchTerm]);

  const getBatchStats = (anexoId: string) => {
    if (!allSolicitudes) return { total: 0, completed: 0, percent: 0 };
    const batchItems = allSolicitudes.filter(s => s.anexo_id === anexoId);
    if (batchItems.length === 0) return { total: 0, completed: 0, percent: 0 };
    
    // Se considera completado si ya no está en agenda activa (tiene informe y devolución)
    const completed = batchItems.filter(s => {
        return false; 
    }).length;

    return { total: batchItems.length, completed, percent: Math.round((completed / batchItems.length) * 100) };
  };

  if (isUserLoading || isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Listado de Anexo I" />
      
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-primary uppercase leading-none">Anexo I - Lugares Fijos</h1>
                <p className="text-muted-foreground text-[10px] font-bold uppercase flex items-center gap-2 mt-2 tracking-widest">
                    <ClipboardList className="h-3.5 w-3.5" /> Control por lotes de planificaciones enviadas
                </p>
            </div>
            <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                <Input 
                    placeholder="Buscar oficina o departamento..." 
                    className="h-12 pl-10 font-bold border-2 rounded-2xl bg-white shadow-sm"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        {filteredAnexos.length === 0 ? (
            <Card className="p-20 text-center border-dashed bg-white rounded-[2.5rem]">
                <div className="flex flex-col items-center justify-center opacity-20">
                    <FileText className="h-20 w-20 mb-4" />
                    <p className="font-black uppercase tracking-widest text-sm">No hay formularios registrados</p>
                </div>
            </Card>
        ) : (
            <div className="grid grid-cols-1 gap-4">
                {filteredAnexos.map((anexo) => {
                    const stats = getBatchStats(anexo.id);
                    return (
                        <Card key={anexo.id} className="border-none shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden bg-white group">
                            <div className="flex flex-col md:flex-row items-center p-6 gap-6">
                                <div className="h-12 w-12 rounded-xl bg-primary/5 text-primary flex items-center justify-center shrink-0">
                                    <Building2 className="h-6 w-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-1">
                                        <h2 className="text-lg font-black uppercase text-[#1A1A1A] truncate">{anexo.distrito}</h2>
                                        <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/10">{anexo.tipo_oficina}</Badge>
                                        <Badge className="bg-black text-white text-[7px] font-black uppercase">ID Lote: {anexo.id.substring(0,8)}</Badge>
                                    </div>
                                    <div className="flex flex-wrap gap-4 text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                                        <span className="flex items-center gap-1"><Landmark className="h-3 w-3" /> {anexo.departamento}</span>
                                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Creado: {formatDateToDDMMYYYY(anexo.fecha_creacion.split('T')[0])}</span>
                                        <span className="flex items-center gap-1 text-primary"><FileText className="h-3 w-3" /> {anexo.filas?.length || 0} Lugares Planificados</span>
                                    </div>
                                    {stats.total > 0 && (
                                        <div className="mt-3 flex items-center gap-4 max-w-sm">
                                            <div className="flex-1">
                                                <Progress value={stats.percent} className="h-1.5" />
                                            </div>
                                            <span className="text-[8px] font-black uppercase text-muted-foreground">{stats.percent}% EJECUTADO</span>
                                        </div>
                                    )}
                                </div>
                                <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-12 w-12 rounded-xl border-2 hover:bg-primary hover:text-white transition-all"
                                    onClick={() => setViewingAnexo(anexo)}
                                >
                                    <Eye className="h-5 w-5" />
                                </Button>
                            </div>
                        </Card>
                    );
                })}
            </div>
        )}
      </main>

      <Dialog open={!!viewingAnexo} onOpenChange={(o) => !o && setViewingAnexo(null)}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 border-none shadow-2xl overflow-hidden rounded-[2rem]">
          {viewingAnexo && (
            <div className="flex flex-col h-full bg-[#F8F9FA]">
                <div className="bg-black text-white p-8 shrink-0">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
                                    <ClipboardList className="h-6 w-6" />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-black uppercase leading-none">CONTROL DE LOTE - ANEXO I</DialogTitle>
                                    <DialogDescription className="text-white/60 font-bold uppercase text-[10px] mt-2">
                                        {viewingAnexo.distrito} | {viewingAnexo.departamento} | Lote: {viewingAnexo.id}
                                    </DialogDescription>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setViewingAnexo(null)} className="text-white/40 hover:text-white"><X className="h-6 w-6" /></Button>
                        </div>
                    </DialogHeader>
                </div>

                <ScrollArea className="flex-1 p-8">
                    <div className="space-y-10">
                        <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
                            <div className="bg-muted/30 px-6 py-3 border-b flex justify-between items-center">
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                    <Activity className="h-3.5 w-3.5" /> Lugares Planificados en este Lote
                                </p>
                                <Badge variant="secondary" className="bg-black text-white text-[8px] font-black">{viewingAnexo.filas?.length} FILAS</Badge>
                            </div>
                            <Table>
                                <TableHeader className="bg-white">
                                    <TableRow>
                                        <TableHead className="text-[9px] font-black uppercase px-6">Lugar</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase">Dirección</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase text-center">Periodo</TableHead>
                                        <TableHead className="text-right text-[9px] font-black uppercase px-6">Horario</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {viewingAnexo.filas?.map((f, idx) => (
                                        <TableRow key={idx} className="border-b last:border-0">
                                            <TableCell className="px-6 py-4 font-black text-[11px] uppercase text-primary">{f.lugar}</TableCell>
                                            <TableCell className="text-[10px] font-bold uppercase text-muted-foreground">{f.direccion}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="secondary" className="bg-muted/50 text-[9px] font-bold">
                                                    {formatDateToDDMMYYYY(f.fecha_desde)} al {formatDateToDDMMYYYY(f.fecha_hasta)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right px-6 font-black text-[10px] text-primary">
                                                {f.hora_desde} a {f.hora_hasta} HS
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>

                        <div className="space-y-4">
                            <div className="flex items-center gap-3 px-2">
                                <ImageIcon className="h-5 w-5 text-primary" />
                                <h3 className="font-black uppercase text-xs">Respaldo Documental Firmado del Lote</h3>
                            </div>
                            {viewingAnexo.foto_respaldo ? (
                                <div className="relative aspect-video w-full rounded-[2.5rem] overflow-hidden border-8 border-white shadow-2xl bg-muted">
                                    {viewingAnexo.foto_respaldo.startsWith('data:application/pdf') || viewingAnexo.foto_respaldo.includes('.pdf') ? (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-white">
                                            <FileText className="h-20 w-20 text-primary opacity-40 mb-4" />
                                            <p className="text-sm font-black uppercase text-primary">Documento PDF Guardado</p>
                                            <Button variant="outline" className="mt-6 font-black uppercase text-[10px] border-2 h-12 px-8" asChild>
                                                <a href={viewingAnexo.foto_respaldo} target="_blank">VER DOCUMENTO PDF</a>
                                            </Button>
                                        </div>
                                    ) : (
                                        <Image src={viewingAnexo.foto_respaldo} alt="Respaldo" fill className="object-cover" />
                                    )}
                                </div>
                            ) : (
                                <div className="p-20 text-center border-4 border-dashed rounded-[2.5rem] opacity-20 bg-white">
                                    <ImageIcon className="h-16 w-16 mx-auto mb-4" />
                                    <p className="font-black uppercase text-sm">Sin respaldo visual registrado</p>
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>

                <div className="p-8 bg-white border-t flex justify-end">
                    <Button onClick={() => setViewingAnexo(null)} className="font-black uppercase text-xs h-12 px-10 shadow-xl bg-black hover:bg-black/90">Cerrar Control</Button>
                </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
