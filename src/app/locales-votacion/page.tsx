
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { type LocalVotacion, type Dato } from '@/lib/data';
import Header from '@/components/header';
import { Loader2, Vote, Search, MapPin, ImageIcon, LayoutGrid, Building2, CheckCircle2, AlertCircle } from 'lucide-react';
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

const getImageUrl = (src: string) => {
    if (!src) return '';
    if (src.startsWith('data:image') || src.startsWith('http')) {
        return src;
    }
    return `/${src}`;
};

export default function LocalesVotacionPage() {
  const { firestore } = useFirebase();

  const [activeTab, setActiveTab] = useState("search");

  // Data for filters and gallery
  const datosQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'datos') : null), [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollection<Dato>(datosQuery);
  
  const allLocalesQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'locales-votacion') : null), [firestore]);
  const { data: allLocales, isLoading: isLoadingAllLocales } = useCollection<LocalVotacion>(allLocalesQuery);

  const [departments, setDepartments] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [zonas, setZonas] = useState<string[]>([]);
  const [localesNames, setLocalesNames] = useState<string[]>([]);

  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedLocalFilter, setSelectedLocalFilter] = useState<string | null>(null);
  const [shouldFetch, setShouldFetch] = useState(false);

  // Search results query
  const searchLocalesQuery = useMemoFirebase(() => {
    if (!firestore || !shouldFetch) return null;

    const conditions = [];
    if (selectedDepartment) conditions.push(where('departamento', '==', selectedDepartment));
    if (selectedDistrict) conditions.push(where('distrito', '==', selectedDistrict));
    if (selectedZone) conditions.push(where('zona', '==', selectedZone));
    if (selectedLocalFilter) conditions.push(where('local', '==', selectedLocalFilter));

    if (conditions.length > 0) {
      return query(collection(firestore, 'locales-votacion'), ...conditions);
    }
    return null;
  }, [firestore, shouldFetch, selectedDepartment, selectedDistrict, selectedZone, selectedLocalFilter]);

  const { data: searchResults, isLoading: isSearching } = useCollection<LocalVotacion>(searchLocalesQuery);
  
  const [selectedLocal, setSelectedLocal] = useState<LocalVotacion | null>(null);
  const [isFichaOpen, setIsFichaOpen] = useState(false);

  // Structured Data for Gallery
  const structuredGallery = useMemo(() => {
    if (!datosData || !allLocales) return [];

    const map = new Map<string, { name: string, districts: Map<string, LocalVotacion[]> }>();

    allLocales.forEach(local => {
      if (!map.has(local.departamento)) {
        map.set(local.departamento, { name: local.departamento, districts: new Map() });
      }
      const dept = map.get(local.departamento)!;
      if (!dept.districts.has(local.distrito)) {
        dept.districts.set(local.distrito, []);
      }
      dept.districts.get(local.distrito)!.push(local);
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [datosData, allLocales]);

  // Populate filters
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

  useEffect(() => {
    if (selectedDistrict && allLocales) {
      const uniqueZonas = [...new Set(allLocales
        .filter(l => l.departamento === selectedDepartment && l.distrito === selectedDistrict && l.zona)
        .map(l => l.zona!)
      )].sort();
      setZonas(uniqueZonas);
    } else {
      setZonas([]);
    }
    setLocalesNames([]);
    setSelectedZone(null); 
  }, [selectedDistrict, selectedDepartment, allLocales]);

  useEffect(() => {
    if (selectedDistrict && allLocales) {
        let filteredLocales = allLocales.filter(l => l.departamento === selectedDepartment && l.distrito === selectedDistrict);
        if (selectedZone) filteredLocales = filteredLocales.filter(l => l.zona === selectedZone);
        const uniqueLocales = [...new Set(filteredLocales.map(l => l.local))].sort();
        setLocalesNames(uniqueLocales);
    } else {
        setLocalesNames([]);
    }
    setSelectedLocalFilter(null);
  }, [selectedZone, selectedDistrict, selectedDepartment, allLocales]);
  
  const handleViewFicha = (local: LocalVotacion) => {
    setSelectedLocal(local);
    setIsFichaOpen(true);
  };

  const handleSearch = () => {
    if (selectedDepartment) setShouldFetch(true);
  };

  const hasAnyPhoto = (local: LocalVotacion) => fotoKeys.some(key => !!local[key]);

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/10">
      <Header title="Locales de Votación" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        
        <div className="mb-8 bg-white p-6 rounded-xl border shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-black tracking-tight uppercase text-primary">Gestión de Locales</h1>
              <p className="text-muted-foreground text-sm flex items-center gap-2 mt-1">
                <Vote className="h-4 w-4" />
                Consulta, buscador y galería de centros de votación nacionales.
              </p>
            </div>
            <div className="flex gap-3 bg-muted/20 p-1 rounded-lg border">
              <Button 
                variant={activeTab === 'search' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setActiveTab('search')}
                className="h-8 text-[10px] font-black uppercase"
              >
                <Search className="mr-2 h-3 w-3" /> Buscador
              </Button>
              <Button 
                variant={activeTab === 'gallery' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setActiveTab('gallery')}
                className="h-8 text-[10px] font-black uppercase"
              >
                <LayoutGrid className="mr-2 h-3 w-3" /> Galería por Ubicación
              </Button>
            </div>
          </div>

          <Separator className="mb-6" />

          {activeTab === 'search' ? (
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
                Filtrar Resultados
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-full">
                  <ImageIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-black uppercase">Explorador Visual</p>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">Navega por los registros fotográficos de cada distrito.</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-muted-foreground uppercase">Locales Totales</p>
                <p className="text-xl font-black text-primary leading-none">{allLocales?.length || 0}</p>
              </div>
            </div>
          )}
        </div>

        {activeTab === 'search' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {isSearching ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-xs font-black uppercase text-muted-foreground tracking-widest">Buscando locales...</p>
              </div>
            ) : shouldFetch && searchResults ? (
              searchResults.length === 0 ? (
                <Card className="border-dashed py-20 flex flex-col items-center justify-center text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                  <p className="text-lg font-black uppercase text-muted-foreground">No se encontraron resultados</p>
                  <p className="text-sm text-muted-foreground">Ajusta los filtros para intentar una nueva búsqueda.</p>
                </Card>
              ) : (
                <Card className="overflow-hidden border-none shadow-xl">
                  <div className="bg-primary px-6 py-4 flex justify-between items-center">
                    <CardTitle className="text-white text-sm uppercase font-black tracking-widest flex items-center gap-2">
                      <Building2 className="h-4 w-4" /> Resultados de la Consulta
                    </CardTitle>
                    <Badge variant="outline" className="bg-white/10 text-white border-white/20 text-[10px] font-black">
                      {searchResults.length} LOCALES ENCONTRADOS
                    </Badge>
                  </div>
                  <CardContent className="p-0">
                    <div className="overflow-auto max-h-[600px]">
                      <Table>
                        <TableHeader className="bg-muted/50 sticky top-0 z-10">
                          <TableRow>
                            <TableHead className="text-[10px] font-black uppercase">Código</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Ubicación</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Zona</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Local</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Multimedia</TableHead>
                            <TableHead className="text-right text-[10px] font-black uppercase">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {searchResults.map((local) => {
                            const photoCount = fotoKeys.filter(k => !!local[k]).length;
                            return (
                              <TableRow key={local.id} className="group hover:bg-primary/5 transition-colors">
                                <TableCell className="font-mono text-xs text-primary font-bold">{local.codigo_local || '-'}</TableCell>
                                <TableCell className="text-[10px] font-bold uppercase leading-tight">
                                  {local.departamento}<br/>
                                  <span className="text-muted-foreground">{local.distrito}</span>
                                </TableCell>
                                <TableCell className="text-[10px] font-bold uppercase">{local.zona || '-'}</TableCell>
                                <TableCell className="font-black text-xs uppercase">{local.local}</TableCell>
                                <TableCell>
                                  {photoCount > 0 ? (
                                    <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 gap-1 text-[9px] font-black border-green-200">
                                      <CheckCircle2 className="h-2 w-2" /> {photoCount} FOTOS
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[9px] font-black text-muted-foreground border-dashed">SIN FOTOS</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button size="sm" variant="outline" className="h-8 text-[10px] font-black uppercase border-primary text-primary hover:bg-primary hover:text-white transition-all" onClick={() => handleViewFicha(local)}>
                                    Ver Ficha
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )
            ) : (
              <div className="flex flex-col items-center justify-center py-32 border-2 border-dashed rounded-3xl bg-white/50">
                <Building2 className="h-16 w-16 text-muted-foreground opacity-10 mb-4" />
                <p className="text-sm font-black uppercase text-muted-foreground tracking-widest">Seleccione filtros para comenzar</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'gallery' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            {isLoadingAllLocales ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-xs font-black uppercase text-muted-foreground tracking-widest">Preparando Galería Nacional...</p>
              </div>
            ) : (
              <Accordion type="single" collapsible className="space-y-4">
                {structuredGallery.map(dept => {
                  const deptLocalesCount = Array.from(dept.districts.values()).flat().length;
                  const deptLocalesWithPhotos = Array.from(dept.districts.values()).flat().filter(l => hasAnyPhoto(l)).length;

                  return (
                    <AccordionItem key={dept.name} value={dept.name} className="border bg-white rounded-lg overflow-hidden shadow-sm px-0">
                      <AccordionTrigger className="hover:no-underline px-6 py-4 bg-muted/5 group data-[state=open]:bg-primary/5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full text-left">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black border border-primary/20 transition-all group-data-[state=open]:bg-primary group-data-[state=open]:text-white">
                              {dept.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h2 className="text-lg font-black uppercase tracking-tight">{dept.name}</h2>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">
                                {dept.districts.size} DISTRITOS ACTIVOS
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 pr-4">
                            <div className="text-right">
                              <p className="text-[9px] font-black text-muted-foreground uppercase leading-none mb-1">Cobertura Fotos</p>
                              <Badge variant={deptLocalesWithPhotos === deptLocalesCount ? "default" : "secondary"} className="text-[10px] font-black py-0 h-5">
                                {deptLocalesWithPhotos} / {deptLocalesCount} LOCALES
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-0 border-t">
                        <Accordion type="multiple" className="w-full">
                          {Array.from(dept.districts.entries()).map(([dist, items]) => {
                            const localesConFoto = items.filter(l => hasAnyPhoto(l));
                            const localesSinFoto = items.filter(l => !hasAnyPhoto(l));

                            return (
                              <AccordionItem key={dist} value={dist} className="border-none px-6 py-2 last:mb-2">
                                <AccordionTrigger className="hover:no-underline py-2 border-b border-dashed hover:border-primary/40 group/dist">
                                  <div className="flex items-center justify-between w-full pr-4">
                                    <div className="flex items-center gap-2">
                                      <Building2 className="h-4 w-4 text-primary opacity-40 group-hover/dist:opacity-100" />
                                      <span className="text-sm font-black uppercase text-foreground/80">{dist}</span>
                                    </div>
                                    <Badge variant="outline" className={cn("text-[9px] font-black h-5", localesSinFoto.length === 0 ? "bg-green-50 text-green-700 border-green-200" : "bg-muted/50")}>
                                      {localesConFoto.length} / {items.length} CON FOTOS
                                    </Badge>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-6">
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {localesConFoto.map(local => (
                                      <Card key={local.id} className="group/card overflow-hidden border-none shadow-md hover:shadow-xl transition-all cursor-pointer" onClick={() => handleViewFicha(local)}>
                                        <div className="relative aspect-[4/3] bg-muted">
                                          <Image src={getImageUrl(local.foto_frente || local.foto2 || '')} alt={local.local} fill className="object-cover transition-transform group-hover/card:scale-110" />
                                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity flex items-end p-3">
                                            <Button size="sm" variant="secondary" className="w-full h-7 text-[9px] font-black uppercase">Ver Detalle</Button>
                                          </div>
                                          <Badge className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-[8px] border-none">
                                            {fotoKeys.filter(k => !!local[k]).length} FOTOS
                                          </Badge>
                                        </div>
                                        <div className="p-3 bg-white">
                                          <p className="text-[10px] font-black uppercase truncate text-primary leading-none mb-1">{local.local}</p>
                                          <p className="text-[8px] font-bold text-muted-foreground uppercase truncate">CÓD: {local.codigo_local || 'S/N'}</p>
                                        </div>
                                      </Card>
                                    ))}
                                  </div>

                                  {localesSinFoto.length > 0 && (
                                    <div className="mt-6 p-4 bg-muted/30 rounded-xl border border-dashed">
                                      <p className="text-[10px] font-black text-muted-foreground uppercase mb-3 flex items-center gap-2">
                                        <AlertCircle className="h-3 w-3" /> Locales Pendientes de Imagen ({localesSinFoto.length})
                                      </p>
                                      <div className="flex flex-wrap gap-2">
                                        {localesSinFoto.map(local => (
                                          <Button 
                                            key={local.id} 
                                            variant="ghost" 
                                            className="h-auto py-1 px-3 bg-white border text-[10px] font-bold uppercase hover:border-primary hover:text-primary"
                                            onClick={() => handleViewFicha(local)}
                                          >
                                            {local.local}
                                          </Button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </div>
        )}
      </main>
      
      {/* Visualizador de Ficha Detallada */}
      <Dialog open={isFichaOpen} onOpenChange={setIsFichaOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
          {selectedLocal && (
            <>
              <div className="bg-primary p-6 text-white shrink-0">
                <DialogHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white/10 rounded-lg">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div>
                      <DialogTitle className="text-2xl font-black uppercase tracking-tight leading-none mb-1">
                        {selectedLocal.local}
                      </DialogTitle>
                      <DialogDescription className="text-white/70 font-bold uppercase text-[10px] flex items-center gap-2">
                        {selectedLocal.departamento} <span className="text-white/30">|</span> {selectedLocal.distrito}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
              </div>

              <ScrollArea className="flex-1 bg-muted/5">
                <div className="p-6 space-y-8">
                  {/* Datos Técnicos */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border shadow-sm">
                      <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Código Local</p>
                      <p className="text-sm font-black text-primary">{selectedLocal.codigo_local || 'NO ASIGNADO'}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border shadow-sm">
                      <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Zona Electoral</p>
                      <p className="text-sm font-black uppercase">{selectedLocal.zona || 'SIN ZONA'}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border shadow-sm md:col-span-2">
                      <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Dirección Exacta</p>
                      <p className="text-sm font-bold uppercase truncate">{selectedLocal.direccion || 'DIRECCIÓN NO DISPONIBLE'}</p>
                    </div>
                  </div>

                  {/* Galería de Fotos del Local */}
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" /> REPORTE FOTOGRÁFICO
                    </h4>
                    {fotoKeys.filter(k => !!selectedLocal[k]).length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {fotoKeys.filter(k => !!selectedLocal[k]).map(key => (
                              <Card key={key} className="overflow-hidden border-none shadow-md group/img">
                                  <div className="relative aspect-video">
                                      <Image src={getImageUrl(selectedLocal[key] as string)} alt={`Foto ${key}`} fill className="object-cover transition-transform group-hover/img:scale-105" />
                                      <div className="absolute inset-0 bg-black/20 group-hover/img:bg-transparent transition-colors" />
                                  </div>
                                  <div className="p-2 bg-white text-center">
                                    <p className="text-[8px] font-black uppercase text-muted-foreground">{key.replace(/_/g, ' ')}</p>
                                  </div>
                              </Card>
                          ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 border-2 border-dashed rounded-2xl bg-white/50">
                        <ImageIcon className="h-10 w-10 text-muted-foreground opacity-20 mx-auto mb-3" />
                        <p className="text-[10px] font-black text-muted-foreground uppercase">Este local no dispone de imágenes en el servidor.</p>
                      </div>
                    )}
                  </div>

                  {/* Geolocalización */}
                  {selectedLocal.gps && (
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                          <MapPin className="h-4 w-4" /> UBICACIÓN GEORREFERENCIADA
                        </h4>
                        <div className="bg-white p-2 rounded-2xl border shadow-lg">
                          <div className="aspect-video w-full rounded-xl overflow-hidden border">
                              <iframe
                                  width="100%"
                                  height="100%"
                                  loading="lazy"
                                  allowFullScreen
                                  referrerPolicy="no-referrer-when-downgrade"
                                  src={`https://maps.google.com/maps?q=${encodeURIComponent(selectedLocal.gps)}&z=16&output=embed`}
                              >
                              </iframe>
                          </div>
                          <div className="mt-3 flex items-center justify-between px-2 pb-1">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2">
                              <MapPin className="h-3 w-3" /> COORDENADAS: {selectedLocal.gps}
                            </p>
                            <a
                                href={`https://www.google.com/maps/search/?api=1&query=${selectedLocal.gps}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] font-black text-primary hover:underline uppercase"
                            >
                                Abrir en Google Maps
                            </a>
                          </div>
                        </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              <div className="bg-muted/30 p-4 border-t flex justify-end">
                <Button onClick={() => setIsFichaOpen(false)} className="font-black uppercase text-[10px] h-9">Cerrar Visualizador</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
