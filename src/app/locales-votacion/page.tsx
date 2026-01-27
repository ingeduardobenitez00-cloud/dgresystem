'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { type LocalVotacion, type Dato } from '@/lib/data';
import Header from '@/components/header';
import { Loader2, Vote, Search, MapPin } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';

const fotoKeys: (keyof LocalVotacion)[] = [
  'foto_frente', 'foto2', 'foto3', 'foto4', 'foto5',
  'foto6', 'foto7', 'foto8', 'foto9', 'foto10'
];

export default function LocalesVotacionPage() {
  const { firestore } = useFirebase();

  // Data for filters
  const datosQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'datos') : null), [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollection<Dato>(datosQuery);
  const allLocalesForFiltersQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'locales-votacion') : null), [firestore]);
  const { data: allLocalesForFilters, isLoading: isLoadingAllLocales } = useCollection<LocalVotacion>(allLocalesForFiltersQuery);

  const [departments, setDepartments] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [zonas, setZonas] = useState<string[]>([]);
  const [locales, setLocales] = useState<string[]>([]);

  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedLocalFilter, setSelectedLocalFilter] = useState<string | null>(null);
  const [shouldFetch, setShouldFetch] = useState(false);

  // Data for locales
  const localesQuery = useMemoFirebase(() => {
    if (!firestore || !shouldFetch) return null;

    const conditions = [];
    if (selectedDepartment) {
      conditions.push(where('departamento', '==', selectedDepartment));
    }
    if (selectedDistrict) {
      conditions.push(where('distrito', '==', selectedDistrict));
    }
    if (selectedZone) {
      conditions.push(where('zona', '==', selectedZone));
    }
    if (selectedLocalFilter) {
      conditions.push(where('local', '==', selectedLocalFilter));
    }

    if (conditions.length > 0) {
      return query(collection(firestore, 'locales-votacion'), ...conditions);
    }
    
    // The search is only triggered via button, so we don't need a case for no conditions
    return null;
  }, [firestore, shouldFetch, selectedDepartment, selectedDistrict, selectedZone, selectedLocalFilter]);

  const { data: localesData, isLoading: isLoadingLocales } = useCollection<LocalVotacion>(localesQuery);
  
  const [selectedLocal, setSelectedLocal] = useState<LocalVotacion | null>(null);
  const [isFichaOpen, setIsFichaOpen] = useState(false);

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
    setLocales([]);
  }, [selectedDepartment, datosData]);

  useEffect(() => {
    if (selectedDistrict && allLocalesForFilters) {
      const uniqueZonas = [...new Set(allLocalesForFilters
        .filter(l => l.departamento === selectedDepartment && l.distrito === selectedDistrict && l.zona)
        .map(l => l.zona!)
      )].sort();
      setZonas(uniqueZonas);
    } else {
      setZonas([]);
    }
    setLocales([]);
    setSelectedZone(null); 
  }, [selectedDistrict, selectedDepartment, allLocalesForFilters]);

  useEffect(() => {
    if (selectedDistrict && allLocalesForFilters) {
        let filteredLocales = allLocalesForFilters.filter(l => l.departamento === selectedDepartment && l.distrito === selectedDistrict);

        if (selectedZone) {
            filteredLocales = filteredLocales.filter(l => l.zona === selectedZone);
        }

        const uniqueLocales = [...new Set(filteredLocales.map(l => l.local))].sort();
        setLocales(uniqueLocales);
    } else {
        setLocales([]);
    }
    setSelectedLocalFilter(null);
  }, [selectedZone, selectedDistrict, selectedDepartment, allLocalesForFilters]);
  
  const handleViewFicha = (local: LocalVotacion) => {
    setSelectedLocal(local);
    setIsFichaOpen(true);
  };

  const handleDepartmentChange = (value: string) => {
    setSelectedDepartment(value);
    setSelectedDistrict(null);
    setSelectedZone(null);
    setSelectedLocalFilter(null);
    setShouldFetch(false);
  };
  
  const handleDistrictChange = (value: string) => {
    setSelectedDistrict(value === 'all' ? null : value);
    setSelectedZone(null);
    setSelectedLocalFilter(null);
    setShouldFetch(false);
  };

  const handleZoneChange = (value: string) => {
    setSelectedZone(value === 'all' ? null : value);
    setSelectedLocalFilter(null);
    setShouldFetch(false);
  };

  const handleLocalChange = (value: string) => {
    setSelectedLocalFilter(value === 'all' ? null : value);
    setShouldFetch(false);
  };

  const handleSearch = () => {
    if (selectedDepartment) {
      setShouldFetch(true);
    }
  };

  const isSearching = shouldFetch && isLoadingLocales;
  const isLoadingFilters = isLoadingDatos || isLoadingAllLocales;

  const photos = selectedLocal ? fotoKeys.map(key => ({ key, src: selectedLocal[key] as string })).filter(p => p.src) : [];

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Locales de Votación" />
      <main className="flex-1 p-4 md:p-6 lg:p-8 gap-8">
        <Card className="w-full max-w-7xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Vote className="h-6 w-6" />
              Búsqueda de Locales de Votación
            </CardTitle>
            <CardDescription>
              Filtra los locales de votación por departamento, distrito, zona y local.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="space-y-2">
                <label className="text-sm font-medium">Departamento</label>
                <Select onValueChange={handleDepartmentChange} value={selectedDepartment || ''} disabled={isLoadingFilters}>
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingFilters ? 'Cargando...' : 'Selecciona un departamento'} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Distrito</label>
                <Select onValueChange={handleDistrictChange} value={selectedDistrict || 'all'} disabled={!selectedDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="all">Todos</SelectItem>
                    {districts.map(dist => <SelectItem key={dist} value={dist}>{dist}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
               <div className="space-y-2">
                <label className="text-sm font-medium">Zona</label>
                <Select onValueChange={handleZoneChange} value={selectedZone || 'all'} disabled={!selectedDistrict}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {zonas.map(zona => <SelectItem key={zona} value={zona}>{zona}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Local</label>
                <Select onValueChange={handleLocalChange} value={selectedLocalFilter || 'all'} disabled={!selectedDistrict}>
                    <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {locales.map(local => <SelectItem key={local} value={local}>{local}</SelectItem>)}
                    </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSearch} disabled={!selectedDepartment || isSearching} className="w-full">
                {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Buscar
              </Button>
            </div>
          </CardContent>
        </Card>

        {isSearching && (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        )}
        
        {shouldFetch && !isSearching && (
          <Card className="w-full max-w-7xl mx-auto">
            <CardHeader>
                <CardTitle>Resultados de la Búsqueda</CardTitle>
                <CardDescription>
                  {localesData ? `Se encontraron ${localesData.length} locales de votación.` : 'No se encontraron locales para la selección actual.'}
                </CardDescription>
            </CardHeader>
            <CardContent>
              {localesData && localesData.length > 0 ? (
                <div className="overflow-auto border rounded-md">
                   <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Departamento</TableHead>
                          <TableHead>Distrito</TableHead>
                          <TableHead>Zona</TableHead>
                          <TableHead>Local</TableHead>
                          <TableHead>Dirección</TableHead>
                          <TableHead>GPS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {localesData.map((local) => (
                          <TableRow key={local.id}>
                            <TableCell>{local.codigo_local}</TableCell>
                            <TableCell>{local.departamento}</TableCell>
                            <TableCell>{local.distrito}</TableCell>
                            <TableCell>{local.zona || '-'}</TableCell>
                            <TableCell 
                              className="font-medium cursor-pointer hover:underline"
                              onClick={() => handleViewFicha(local)}
                            >
                              {local.local}
                            </TableCell>
                            <TableCell>{local.direccion}</TableCell>
                            <TableCell>{local.gps}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No se encontraron locales de votación para la selección actual.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
      
      <Dialog open={isFichaOpen} onOpenChange={setIsFichaOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          {selectedLocal && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedLocal.local}</DialogTitle>
                <DialogDescription>
                  {selectedLocal.departamento} - {selectedLocal.distrito}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="py-4 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <p><span className="font-semibold">Código:</span> {selectedLocal.codigo_local || 'N/A'}</p>
                      <p><span className="font-semibold">Zona:</span> {selectedLocal.zona || 'N/A'}</p>
                      <p className="md:col-span-2"><span className="font-semibold">Dirección:</span> {selectedLocal.direccion || 'N/A'}</p>
                      <div className="md:col-span-2">
                        <span className="font-semibold">GPS:</span>{' '}
                        {selectedLocal.gps ? (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${selectedLocal.gps}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <span>{selectedLocal.gps}</span>
                            <MapPin className="h-4 w-4" />
                          </a>
                        ) : (
                          'N/A'
                        )}
                      </div>
                  </div>
                  
                  <Separator />

                  {selectedLocal.gps && (
                    <div>
                        <h4 className="font-semibold mb-4 text-lg">Ubicación en el Mapa</h4>
                        <div className="aspect-video w-full rounded-md overflow-hidden border">
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
                    </div>
                  )}

                  {selectedLocal.gps && <Separator />}
                  
                  <div>
                    <h4 className="font-semibold mb-4 text-lg">Fotos</h4>
                    {photos.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {photos.map(({ key, src }) => (
                              <Card key={key} className="overflow-hidden">
                                  <div className="relative aspect-video">
                                      <Image src={`/${src}`} alt={`Foto ${key}`} fill className="object-cover" />
                                  </div>
                                  <CardFooter className="p-2 text-xs text-muted-foreground capitalize">
                                      {key.replace(/_/g, ' ')}
                                  </CardFooter>
                              </Card>
                          ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No hay fotos para este local.</p>
                    )}
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
