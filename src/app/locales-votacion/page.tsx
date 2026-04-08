
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirebase, useCollection, useMemoFirebase, useUser, useCollectionOnce } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { type LocalVotacion, type Dato } from '@/lib/data';
import Header from '@/components/header';
import { Loader2, Vote, Search, MapPin, ImageIcon, LayoutGrid, Building2, CheckCircle2, AlertCircle, ImageOff } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { cn } from '@/lib/utils';

const fotoKeys: (keyof LocalVotacion)[] = [
  'foto_frente', 'foto2', 'foto3', 'foto4', 'foto5',
  'foto6', 'foto7', 'foto8', 'foto9', 'foto10'
];

const getImageUrl = (src: any) => {
    if (!src || typeof src !== 'string') return '';
    if (src.startsWith('data:image') || src.startsWith('http')) return src;
    const cleaned = src.replace(/\\/g, '/').replace(/^\/+/, '');
    return !cleaned ? '' : `/${cleaned}`;
};

export default function LocalesVotacionPage() {
  const { firestore } = useFirebase();
  const { user } = useUser();

  const datosQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'datos') : null), [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollectionOnce<Dato>(datosQuery);
  
  const [departments, setDepartments] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [zonas, setZonas] = useState<string[]>([]);
  const [localesNames, setLocalesNames] = useState<string[]>([]);

  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedLocalFilter, setSelectedLocalFilter] = useState<string | null>(null);
  const [shouldFetch, setShouldFetch] = useState(false);

  // States for dynamic gallery loading
  const [galleryData, setGalleryData] = useState<Record<string, Map<string, LocalVotacion[]>>>({});
  const [loadingDepts, setLoadingDepts] = useState<Set<string>>(new Set());

  const searchLocalesQuery = useMemoFirebase(() => {
    if (!firestore || !user || !shouldFetch) return null;
    const conditions = [];
    if (selectedDepartment) conditions.push(where('departamento', '==', selectedDepartment));
    if (selectedDistrict) conditions.push(where('distrito', '==', selectedDistrict));
    if (selectedZone) conditions.push(where('zona', '==', selectedZone));
    if (selectedLocalFilter) conditions.push(where('local', '==', selectedLocalFilter));
    if (conditions.length > 0) return query(collection(firestore, 'locales-votacion'), ...conditions);
    return null;
  }, [firestore, user, shouldFetch, selectedDepartment, selectedDistrict, selectedZone, selectedLocalFilter]);

  const { data: searchResults, isLoading: isSearching } = useCollection<LocalVotacion>(searchLocalesQuery);
  
  const [selectedLocal, setSelectedLocal] = useState<LocalVotacion | null>(null);
  const [isFichaOpen, setIsFichaOpen] = useState(false);

  useEffect(() => {
    if (datosData) {
      const uniqueDepts = [...new Set(datosData.map(d => d.departamento))].sort();
      setDepartments(uniqueDepts);
    }
  }, [datosData]);

  useEffect(() => {
    if (selectedDepartment && datosData) {
      const uniqueDistricts = [...new Set(datosData.filter(d => d.departamento === selectedDepartment).map(d => d.distrito))].sort();
      setDistricts(uniqueDistricts);
    } else {
      setDistricts([]);
    }
    setZonas([]);
    setLocalesNames([]);
  }, [selectedDepartment, datosData]);

  const handleFetchDeptGallery = async (deptName: string) => {
    if (!firestore || !user || galleryData[deptName] || loadingDepts.has(deptName)) return;

    setLoadingDepts(prev => new Set(prev).add(deptName));
    try {
      const q = query(collection(firestore, 'locales-votacion'), where('departamento', '==', deptName));
      const snap = await getDocs(q);
      const districtsMap = new Map<string, LocalVotacion[]>();
      
      snap.docs.forEach(doc => {
        const data = { id: doc.id, ...doc.data() } as LocalVotacion;
        const dist = data.distrito || 'SIN DISTRITO';
        if (!districtsMap.has(dist)) districtsMap.set(dist, []);
        districtsMap.get(dist)!.push(data);
      });

      setGalleryData(prev => ({ ...prev, [deptName]: districtsMap }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDepts(prev => {
        const next = new Set(prev);
        next.delete(deptName);
        return next;
      });
    }
  };

  const handleSearch = () => {
    if (selectedDepartment) setShouldFetch(true);
  };

  const handleViewFicha = (local: LocalVotacion) => {
    setSelectedLocal(local);
    setIsFichaOpen(true);
  };

  const hasAnyPhoto = (local: LocalVotacion) => fotoKeys.some(key => !!local[key]);

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/10">
      <Header title="Locales de Votación" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        
        <div className="mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-black tracking-tight uppercase text-primary">Gestión de Locales</h1>
              <p className="text-muted-foreground text-sm flex items-center gap-2 mt-1">
                <Vote className="h-4 w-4" />
                Consulta y buscador de centros de votación.
              </p>
            </div>
          </div>

          <Tabs defaultValue="search" className="w-full">
            <TabsList className="grid w-full grid-cols-2 lg:w-[400px] mb-8 bg-white border shadow-sm">
              <TabsTrigger value="search" className="gap-2 font-black uppercase text-[10px]">
                <Search className="h-3.5 w-3.5" /> Buscador
              </TabsTrigger>
              <TabsTrigger value="gallery" className="gap-2 font-black uppercase text-[10px]">
                <LayoutGrid className="h-3.5 w-3.5" /> Galería
              </TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="space-y-8 animate-in fade-in duration-500">
              <Card className="bg-white border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Filtros de Búsqueda</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-muted-foreground">Departamento</label>
                      <Select onValueChange={(v) => { setSelectedDepartment(v); setSelectedDistrict(null); setShouldFetch(false); }} value={selectedDepartment || ''}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                        <SelectContent>
                          {departments.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-muted-foreground">Distrito</label>
                      <Select onValueChange={(v) => { setSelectedDistrict(v === 'all' ? null : v); setShouldFetch(false); }} value={selectedDistrict || 'all'} disabled={!selectedDepartment}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Todos" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los distritos</SelectItem>
                          {districts.map(dist => <SelectItem key={dist} value={dist}>{dist}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-muted-foreground">Zona</label>
                      <Select onValueChange={(v) => { setSelectedZone(v === 'all' ? null : v); setShouldFetch(false); }} value={selectedZone || 'all'} disabled={!selectedDistrict}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Todas" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas las zonas</SelectItem>
                          {zonas.map(zona => <SelectItem key={zona} value={zona}>{zona}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-muted-foreground">Local</label>
                      <Select onValueChange={(v) => { setSelectedLocalFilter(v === 'all' ? null : v); setShouldFetch(false); }} value={selectedLocalFilter || 'all'} disabled={!selectedDistrict}>
                          <SelectTrigger className="h-10"><SelectValue placeholder="Todos" /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="all">Todos los locales</SelectItem>
                              {localesNames.map(local => <SelectItem key={local} value={local}>{local}</SelectItem>)}
                          </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleSearch} disabled={!selectedDepartment || isSearching} className="w-full h-10 font-black uppercase shadow-lg">
                      {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                      Filtrar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {isSearching ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-xs font-black uppercase text-muted-foreground tracking-widest">Buscando locales...</p>
                </div>
              ) : shouldFetch && searchResults ? (
                <Card className="overflow-hidden border-none shadow-xl">
                    <div className="bg-primary px-6 py-4 flex justify-between items-center">
                      <CardTitle className="text-white text-sm uppercase font-black tracking-widest flex items-center gap-2">
                        <Building2 className="h-4 w-4" /> Resultados ({searchResults.length})
                      </CardTitle>
                    </div>
                    <CardContent className="p-0">
                      <div className="overflow-auto max-h-[600px]">
                        <Table>
                          <TableHeader className="bg-muted/50 sticky top-0 z-10">
                            <TableRow>
                              <TableHead className="text-[10px] font-black uppercase">Ubicación</TableHead>
                              <TableHead className="text-[10px] font-black uppercase">Local</TableHead>
                              <TableHead className="text-right text-[10px] font-black uppercase">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {searchResults.map((local) => (
                                <TableRow key={local.id} className="group hover:bg-primary/5 transition-colors">
                                  <TableCell className="text-[10px] font-bold uppercase leading-tight">
                                    {local.departamento}<br/>
                                    <span className="text-muted-foreground">{local.distrito}</span>
                                  </TableCell>
                                  <TableCell className="font-black text-xs uppercase">{local.local}</TableCell>
                                  <TableCell className="text-right">
                                    <Button size="sm" variant="outline" className="h-8 text-[10px] font-black uppercase" onClick={() => handleViewFicha(local)}>
                                      Ficha
                                    </Button>
                                  </TableCell>
                                </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                </Card>
              ) : null}
            </TabsContent>

            <TabsContent value="gallery" className="space-y-6">
                <Accordion type="single" collapsible className="space-y-4" onValueChange={handleFetchDeptGallery}>
                  {departments.map(deptName => (
                      <AccordionItem key={deptName} value={deptName} className="border bg-white rounded-lg overflow-hidden shadow-sm px-0">
                        <AccordionTrigger className="hover:no-underline px-6 py-4 bg-muted/5 group">
                          <div className="flex items-center gap-4 text-left">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black border border-primary/20">
                                {deptName.substring(0, 2).toUpperCase()}
                            </div>
                            <h2 className="text-lg font-black uppercase tracking-tight">{deptName}</h2>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-0 border-t">
                          {loadingDepts.has(deptName) ? (
                              <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
                          ) : galleryData[deptName] ? (
                              <Accordion type="multiple" className="w-full">
                                {Array.from(galleryData[deptName].entries()).map(([dist, items]) => (
                                    <AccordionItem key={dist} value={dist} className="border-none px-6 py-2">
                                      <AccordionTrigger className="hover:no-underline py-2 border-b border-dashed">
                                        <span className="text-sm font-black uppercase text-foreground/80">{dist} ({items.length})</span>
                                      </AccordionTrigger>
                                      <AccordionContent className="pt-6">
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                          {items.map(local => {
                                            const mainImage = getImageUrl(local.foto_frente || local.foto2 || '');
                                            return (
                                              <Card key={local.id} className="group/card overflow-hidden border-none shadow-md cursor-pointer" onClick={() => handleViewFicha(local)}>
                                                <div className="relative aspect-[4/3] bg-muted flex items-center justify-center">
                                                  {mainImage ? (
                                                    <Image src={mainImage} alt={local.local} fill className="object-cover" sizes="200px" />
                                                  ) : <ImageOff className="h-6 w-6 text-muted-foreground" />}
                                                </div>
                                                <div className="p-2 bg-white border-t">
                                                  <p className="text-[9px] font-black uppercase truncate text-primary">{local.local}</p>
                                                </div>
                                              </Card>
                                            );
                                          })}
                                        </div>
                                      </AccordionContent>
                                    </AccordionItem>
                                ))}
                              </Accordion>
                          ) : <div className="p-10 text-center text-xs font-bold text-muted-foreground uppercase">Haga clic para cargar locales</div>}
                        </AccordionContent>
                      </AccordionItem>
                  ))}
                </Accordion>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      
      <Dialog open={isFichaOpen} onOpenChange={setIsFichaOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          {selectedLocal && (
            <>
              <div className="bg-primary p-6 text-white shrink-0">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black uppercase leading-none mb-1">{selectedLocal.local}</DialogTitle>
                    <DialogDescription className="text-white/70 font-bold uppercase text-[10px]">
                        {selectedLocal.departamento} | {selectedLocal.distrito}
                    </DialogDescription>
                </DialogHeader>
              </div>
              <ScrollArea className="flex-1 p-6">
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-muted/30 p-4 rounded-xl border">
                            <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Código Local</p>
                            <p className="text-sm font-black">{selectedLocal.codigo_local || 'S/N'}</p>
                        </div>
                        <div className="bg-muted/30 p-4 rounded-xl border md:col-span-3">
                            <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Dirección</p>
                            <p className="text-sm font-bold uppercase">{selectedLocal.direccion || 'No disponible'}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {fotoKeys.filter(k => !!selectedLocal[k]).map(key => (
                            <div key={key} className="relative aspect-video rounded-lg overflow-hidden border bg-muted">
                                <Image src={getImageUrl(selectedLocal[key])} alt={String(key)} fill className="object-cover" sizes="300px" />
                            </div>
                        ))}
                    </div>
                  </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
