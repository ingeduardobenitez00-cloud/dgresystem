
"use client";

import { useState, useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { type InformeDivulgador } from '@/lib/data';
import { Loader2, Images, MapPin, Calendar, Users, UserCheck, Search, ImageOff, Maximize2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { formatDateToDDMMYYYY, cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export default function GaleriaCapacitacionesPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const informesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'informes-divulgador'), orderBy('fecha', 'desc'));
  }, [firestore]);

  const { data: informes, isLoading } = useCollection<InformeDivulgador>(informesQuery);

  const filteredInformes = useMemo(() => {
    if (!informes) return [];
    const term = searchTerm.toLowerCase().trim();
    return informes.filter(inf => 
        (inf.fotos && inf.fotos.length > 0) && (
            inf.lugar_divulgacion.toLowerCase().includes(term) ||
            inf.nombre_divulgador.toLowerCase().includes(term) ||
            inf.distrito.toLowerCase().includes(term)
        )
    );
  }, [informes, searchTerm]);

  if (isUserLoading || isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Galería de Evidencias" />
      
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-primary uppercase leading-none">Galería de Capacitaciones</h1>
                <p className="text-muted-foreground text-[10px] font-bold uppercase flex items-center gap-2 mt-2 tracking-widest">
                    <Images className="h-3.5 w-3.5" /> Evidencias fotográficas de actividades realizadas a nivel nacional
                </p>
            </div>
            <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                <Input 
                    placeholder="Buscar actividad o responsable..." 
                    className="h-12 pl-10 font-bold border-2 rounded-2xl bg-white shadow-sm"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        {filteredInformes.length === 0 ? (
            <Card className="p-20 text-center border-dashed bg-white rounded-[2.5rem]">
                <div className="flex flex-col items-center justify-center opacity-20">
                    <ImageOff className="h-20 w-20 mb-4" />
                    <p className="font-black uppercase tracking-widest text-sm">No se encontraron evidencias fotográficas</p>
                </div>
            </Card>
        ) : (
            <div className="grid grid-cols-1 gap-12">
                {filteredInformes.map((inf) => (
                    <Card key={inf.id} className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white group">
                        <div className="p-8 md:p-10 border-b bg-muted/5">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                                {/* Columna 1: Encabezado de Datos */}
                                <div className="lg:col-span-5 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center shadow-lg">
                                            <MapPin className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">LUGAR DE CAPACITACIÓN</p>
                                            <h2 className="text-xl font-black uppercase text-[#1A1A1A] leading-tight">{inf.lugar_divulgacion}</h2>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-4">
                                        <Badge variant="secondary" className="bg-white border-2 text-[10px] font-black uppercase py-1.5 px-4 rounded-xl shadow-sm gap-2">
                                            <Calendar className="h-3 w-3" /> {formatDateToDDMMYYYY(inf.fecha)}
                                        </Badge>
                                        <Badge variant="secondary" className="bg-white border-2 text-[10px] font-black uppercase py-1.5 px-4 rounded-xl shadow-sm gap-2">
                                            <UserCheck className="h-3 w-3" /> {inf.nombre_divulgador}
                                        </Badge>
                                    </div>
                                </div>

                                {/* Columna 2: Distrito y Departamento */}
                                <div className="lg:col-span-4 space-y-1">
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">JURISDICCIÓN</p>
                                    <p className="font-black text-sm uppercase text-[#1A1A1A]">{inf.distrito}</p>
                                    <p className="font-bold text-xs uppercase text-muted-foreground">{inf.departamento}</p>
                                </div>

                                {/* Columna 3: Resultado Numérico */}
                                <div className="lg:col-span-3 bg-black text-white p-6 rounded-3xl flex flex-col items-center justify-center shadow-2xl">
                                    <Users className="h-6 w-6 mb-2 opacity-50" />
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-1">PERSONAS CAPACITADAS</p>
                                    <span className="text-4xl font-black leading-none">{inf.total_personas}</span>
                                </div>
                            </div>
                        </div>

                        {/* Cuerpo: Galería de Fotos */}
                        <CardContent className="p-8 md:p-10">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                                {inf.fotos?.map((photo, pIdx) => (
                                    <div 
                                        key={pIdx} 
                                        className="relative aspect-video rounded-2xl overflow-hidden border-4 border-white shadow-lg group/photo cursor-pointer transition-transform hover:scale-[1.03]"
                                        onClick={() => setSelectedPhoto(photo)}
                                    >
                                        <Image 
                                            src={photo} 
                                            alt={`Evidencia ${pIdx}`} 
                                            fill 
                                            className="object-cover" 
                                            sizes="300px"
                                        />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity">
                                            <Maximize2 className="text-white h-8 w-8" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        )}

        <div className="text-center pb-10">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40 italic">
                * Las fotografías son propiedad exclusiva de la Justicia Electoral y sirven como respaldo administrativo.
            </p>
        </div>
      </main>

      <Dialog open={!!selectedPhoto} onOpenChange={(o) => !o && setSelectedPhoto(null)}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden border-none bg-black/90 rounded-[2rem]">
            {selectedPhoto && (
                <div className="relative aspect-video w-full flex items-center justify-center">
                    <Image 
                        src={selectedPhoto} 
                        alt="Vista ampliada" 
                        fill 
                        className="object-contain" 
                        priority
                    />
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute top-6 right-6 h-12 w-12 rounded-full bg-white/10 text-white hover:bg-white/20 border border-white/20"
                        onClick={() => setSelectedPhoto(null)}
                    >
                        <X className="h-6 w-6" />
                    </Button>
                </div>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
