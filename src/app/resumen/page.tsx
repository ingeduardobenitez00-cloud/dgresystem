'use client';

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query } from 'firebase/firestore';
import { type Dato, type ReportData } from '@/lib/data';
import { Loader2, Building, CheckCircle, Shield, FileText, Landmark, Vote, Scale, Home, HelpCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

type DistrictWithReport = {
  name: string;
  report: ReportData | null;
};

type DepartmentWithDistricts = {
  name: string;
  districts: DistrictWithReport[];
};

type CategoryData = {
    count: number;
    districts: string[];
}

type SummaryData = {
    totalReports: CategoryData;
    habitacionSegura: CategoryData;
    comisaria: CategoryData;
    parroquia: CategoryData;
    localVotacion: CategoryData;
    juzgado: CategoryData;
    propiedadIntendencia: CategoryData;
    otrosNoEspecificado: CategoryData;
};

const ResguardoIcon = ({ lugar }: { lugar: string | undefined }) => {
  const normalizedLugar = lugar ? lugar.toLowerCase() : '';

  if (normalizedLugar.includes('habitacion segura') || normalizedLugar.includes('registro electoral')) {
    return <CheckCircle className="h-5 w-5 text-green-600" title="Habitación Segura / Registro Electoral" />;
  }
  if (normalizedLugar.includes('comisaria')) {
    return <Shield className="h-5 w-5 text-blue-600" title="Comisaría" />;
  }
  return <Building className="h-5 w-5 text-muted-foreground" title="Otro Lugar" />;
};


export default function ResumenPage() {
  const { firestore } = useFirebase();

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollection<Dato>(datosQuery);
  
  const reportsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'reports') : null, [firestore]);
  const { data: reportsData, isLoading: isLoadingReports } = useCollection<ReportData>(reportsQuery);

  const [structuredData, setStructuredData] = useState<DepartmentWithDistricts[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [districtsForCategory, setDistrictsForCategory] = useState<string[]>([]);

  useEffect(() => {
    if (datosData && reportsData) {
      // Structure data for detailed list
      const departments: Record<string, Set<string>> = {};
      datosData.forEach(d => {
        if (!departments[d.departamento]) {
          departments[d.departamento] = new Set();
        }
        departments[d.departamento].add(d.distrito);
      });

      const structured: DepartmentWithDistricts[] = Object.keys(departments).sort().map(deptName => {
        const districts = Array.from(departments[deptName]).sort();
        const districtsWithReports: DistrictWithReport[] = districts.map(distName => {
          const report = reportsData.find(r => r.departamento === deptName && r.distrito === distName) || null;
          return { name: distName, report };
        });

        return { name: deptName, districts: districtsWithReports };
      });
      setStructuredData(structured);
      
      // Calculate summary counts and districts
      const initialCategoryData = (): CategoryData => ({ count: 0, districts: [] });
      const summary: SummaryData = {
        totalReports: initialCategoryData(),
        habitacionSegura: initialCategoryData(),
        comisaria: initialCategoryData(),
        parroquia: initialCategoryData(),
        localVotacion: initialCategoryData(),
        juzgado: initialCategoryData(),
        propiedadIntendencia: initialCategoryData(),
        otrosNoEspecificado: initialCategoryData(),
      };
      
      summary.totalReports.count = reportsData.length;
      summary.totalReports.districts = reportsData.map(r => `${r.departamento} - ${r.distrito}`);

      reportsData.forEach(report => {
        const lugar = report['lugar-resguardo'] ? report['lugar-resguardo'].toLowerCase() : '';
        const districtName = `${report.departamento} - ${report.distrito}`;
        let categorized = false;

        if (lugar.includes('habitacion segura') || lugar.includes('registro electoral')) {
          summary.habitacionSegura.count++;
          summary.habitacionSegura.districts.push(districtName);
          categorized = true;
        }
        if (lugar.includes('comisaria')) {
          summary.comisaria.count++;
          summary.comisaria.districts.push(districtName);
          categorized = true;
        }
        if (lugar.includes('parroquia')) {
          summary.parroquia.count++;
          summary.parroquia.districts.push(districtName);
          categorized = true;
        }
        if (lugar.includes('local de votacion') || lugar.includes('local votacion')) {
          summary.localVotacion.count++;
          summary.localVotacion.districts.push(districtName);
          categorized = true;
        }
        if (lugar.includes('juzgado')) {
          summary.juzgado.count++;
          summary.juzgado.districts.push(districtName);
          categorized = true;
        }
        if (lugar.includes('intendencia')) {
          summary.propiedadIntendencia.count++;
          summary.propiedadIntendencia.districts.push(districtName);
          categorized = true;
        }
        
        if (!categorized && lugar) {
            summary.otrosNoEspecificado.count++;
            summary.otrosNoEspecificado.districts.push(districtName);
        }
      });

      setSummaryData(summary);
    }
  }, [datosData, reportsData]);

  const handleCategoryClick = (category: keyof SummaryData | 'otros', title: string) => {
    if (!summaryData) return;
    
    let districts: string[] = [];
    if (category === 'otros') {
        districts = [
            ...summaryData.parroquia.districts,
            ...summaryData.localVotacion.districts,
            ...summaryData.juzgado.districts,
            ...summaryData.propiedadIntendencia.districts,
            ...summaryData.otrosNoEspecificado.districts,
        ];
    } else {
        districts = summaryData[category].districts;
    }
    
    setSelectedCategory(title);
    setDistrictsForCategory(districts.sort());
    setIsDialogOpen(true);
  };
  
  const isLoading = isLoadingDatos || isLoadingReports;

  if (isLoading || !summaryData) {
    return (
        <div className="flex min-h-screen w-full flex-col">
            <Header title="Resumen Detallado por Ubicación" />
            <main className="flex flex-1 flex-col p-4 gap-8 justify-center items-center">
                 <Loader2 className="h-12 w-12 animate-spin text-primary" />
                 <p className="text-muted-foreground">Cargando datos del resumen...</p>
            </main>
        </div>
    );
  }

  const summaryCards = [
    { key: 'totalReports', title: 'Total de Informes', icon: FileText, onClick: () => handleCategoryClick('totalReports', 'Total de Informes') },
    { key: 'habitacionSegura', title: 'Habitación Segura / Registro', icon: CheckCircle, className: 'text-green-600', onClick: () => handleCategoryClick('habitacionSegura', 'Habitación Segura / Registro') },
    { key: 'comisaria', title: 'Comisaría', icon: Shield, className: 'text-blue-600', onClick: () => handleCategoryClick('comisaria', 'Comisaría') },
  ] as const;

  const otrosCount = summaryData.parroquia.count + summaryData.localVotacion.count + summaryData.juzgado.count + summaryData.propiedadIntendencia.count + summaryData.otrosNoEspecificado.count;

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Resumen Detallado por Ubicación" />
      <main className="flex flex-1 flex-col p-4 gap-8">

        <Card className="w-full max-w-6xl mx-auto">
            <CardHeader>
                <CardTitle>Resumen General</CardTitle>
                <CardDescription>
                    Visión global de los informes registrados en el sistema. Haz clic en una tarjeta para ver los distritos.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
               {summaryCards.map(card => {
                 const Icon = card.icon;
                 return (
                    <Card key={card.key} onClick={card.onClick} className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                            <Icon className={`h-4 w-4 text-muted-foreground ${card.className || ''}`} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summaryData[card.key].count}</div>
                        </CardContent>
                    </Card>
                 )
               })}
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Resguardo en Otros Lugares</CardTitle>
                        <Building className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold" onClick={() => handleCategoryClick('otros', 'Resguardo en Otros Lugares')} role="button">{otrosCount}</div>
                        <Accordion type="single" collapsible className="w-full text-xs">
                          <AccordionItem value="item-1">
                            <AccordionTrigger className="p-0 hover:no-underline">Ver desglose</AccordionTrigger>
                            <AccordionContent className="pt-2 space-y-1">
                              <div className="flex justify-between items-center cursor-pointer hover:font-semibold" onClick={() => handleCategoryClick('parroquia', 'Parroquia')}>
                                <span className="flex items-center"><Landmark className="mr-2 h-4 w-4 text-amber-600" />Parroquia:</span>
                                <span>{summaryData.parroquia.count}</span>
                              </div>
                              <div className="flex justify-between items-center cursor-pointer hover:font-semibold" onClick={() => handleCategoryClick('localVotacion', 'Local de Votación')}>
                                <span className="flex items-center"><Vote className="mr-2 h-4 w-4 text-cyan-600" />Local de Votación:</span>
                                <span>{summaryData.localVotacion.count}</span>
                              </div>
                              <div className="flex justify-between items-center cursor-pointer hover:font-semibold" onClick={() => handleCategoryClick('juzgado', 'Juzgado')}>
                                <span className="flex items-center"><Scale className="mr-2 h-4 w-4 text-gray-600" />Juzgado:</span>
                                <span>{summaryData.juzgado.count}</span>
                              </div>
                              <div className="flex justify-between items-center cursor-pointer hover:font-semibold" onClick={() => handleCategoryClick('propiedadIntendencia', 'Prop. Intendencia')}>
                                <span className="flex items-center"><Home className="mr-2 h-4 w-4 text-rose-600" />Prop. Intendencia:</span>
                                <span>{summaryData.propiedadIntendencia.count}</span>
                              </div>
                              <div className="flex justify-between items-center cursor-pointer hover:font-semibold" onClick={() => handleCategoryClick('otrosNoEspecificado', 'Otros no especificados')}>
                                <span className="flex items-center"><HelpCircle className="mr-2 h-4 w-4 text-gray-400" />Otros no especificados:</span>
                                <span>{summaryData.otrosNoEspecificado.count}</span>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                    </CardContent>
                </Card>
            </CardContent>
        </Card>

        <Card className="w-full max-w-6xl mx-auto">
          <CardHeader>
            <CardTitle>Informe Detallado por Distrito</CardTitle>
            <CardDescription>
              Explora los informes para cada departamento y distrito.
            </CardDescription>
          </CardHeader>
          <CardContent>
              <Accordion type="multiple" className="w-full">
                {structuredData.map((department) => (
                  <AccordionItem value={department.name} key={department.name}>
                    <AccordionTrigger className="text-lg font-semibold hover:no-underline data-[state=open]:text-primary">
                      {department.name}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 px-4">
                        {department.districts.map((district) => (
                          <div key={district.name} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                            <span className="text-md font-medium">{district.name}</span>
                            {district.report ? (
                              <ResguardoIcon lugar={district.report['lugar-resguardo']} />
                            ) : (
                              <p className="text-sm text-muted-foreground italic">No hay informe</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
          </CardContent>
        </Card>
      </main>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md">
              <DialogHeader>
                  <DialogTitle>Distritos en: {selectedCategory}</DialogTitle>
                  <DialogDescription>
                      Listado de ubicaciones para la categoría seleccionada.
                  </DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-72 w-full rounded-md border p-4">
                  {districtsForCategory.length > 0 ? (
                      <ul className="space-y-2">
                          {districtsForCategory.map((dist, index) => (
                              <li key={index} className="text-sm">{dist}</li>
                          ))}
                      </ul>
                  ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                          No hay distritos en esta categoría.
                      </p>
                  )}
              </ScrollArea>
          </DialogContent>
      </Dialog>
    </div>
  );
}
