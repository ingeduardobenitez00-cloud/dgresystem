
'use client';

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query } from 'firebase/firestore';
import { type Dato, type ReportData } from '@/lib/data';
import { Loader2, Building, CheckCircle, Shield, Landmark, FileText } from 'lucide-react';

type DistrictWithReport = {
  name: string;
  report: ReportData | null;
};

type DepartmentWithDistricts = {
  name: string;
  districts: DistrictWithReport[];
};

type SummaryCounts = {
    totalReports: number;
    habitacionSegura: number;
    comisaria: number;
    otros: number;
};

const ResguardoIcon = ({ lugar }: { lugar: string }) => {
  const normalizedLugar = lugar ? lugar.toLowerCase() : '';

  if (normalizedLugar.includes('habitacion segura') || normalizedLugar.includes('registro electoral')) {
    return <CheckCircle className="h-5 w-5 text-green-600" />;
  }
  if (normalizedLugar.includes('comisaria')) {
    return <Shield className="h-5 w-5 text-blue-600" />;
  }
  return <Building className="h-5 w-5 text-muted-foreground" />;
};


export default function ResumenPage() {
  const { firestore } = useFirebase();

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollection<Dato>(datosQuery);
  
  const reportsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'reports') : null, [firestore]);
  const { data: reportsData, isLoading: isLoadingReports } = useCollection<ReportData>(reportsQuery);

  const [structuredData, setStructuredData] = useState<DepartmentWithDistricts[]>([]);
  const [summaryCounts, setSummaryCounts] = useState<SummaryCounts>({
    totalReports: 0,
    habitacionSegura: 0,
    comisaria: 0,
    otros: 0,
  });
  
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
      
      // Calculate summary counts
      let habitacionSegura = 0;
      let comisaria = 0;
      let otros = 0;

      reportsData.forEach(report => {
        const lugar = report['lugar-resguardo'] ? report['lugar-resguardo'].toLowerCase() : '';
        if (lugar.includes('habitacion segura') || lugar.includes('registro electoral')) {
          habitacionSegura++;
        } else if (lugar.includes('comisaria')) {
          comisaria++;
        } else if (lugar) {
            otros++;
        }
      });

      setSummaryCounts({
        totalReports: reportsData.length,
        habitacionSegura,
        comisaria,
        otros,
      });

    }
  }, [datosData, reportsData]);

  const isLoading = isLoadingDatos || isLoadingReports;

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Resumen Detallado por Ubicación" />
      <main className="flex flex-1 flex-col p-4 gap-8">

        <Card className="w-full max-w-6xl mx-auto">
            <CardHeader>
                <CardTitle>Resumen General</CardTitle>
                <CardDescription>
                    Visión global de los informes registrados en el sistema.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Informes</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summaryCounts.totalReports}</div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Habitación Segura / Registro</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summaryCounts.habitacionSegura}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Comisaría</CardTitle>
                        <Shield className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summaryCounts.comisaria}</div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Otros Lugares</CardTitle>
                        <Building className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summaryCounts.otros}</div>
                    </CardContent>
                </Card>
            </CardContent>
        </Card>

        <Card className="w-full max-w-6xl mx-auto">
          <CardHeader>
            <CardTitle>Informe Detallado</CardTitle>
            <CardDescription>
              Explora los informes para cada departamento y distrito.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Accordion type="multiple" className="w-full">
                {structuredData.map((department) => (
                  <AccordionItem value={department.name} key={department.name}>
                    <AccordionTrigger className="text-lg font-semibold hover:no-underline data-[state=open]:text-primary">
                      {department.name}
                    </AccordionTrigger>
                    <AccordionContent>
                      <Accordion type="multiple" className="w-full space-y-4 px-4">
                        {department.districts.map((district) => (
                          <AccordionItem value={district.name} key={district.name}>
                            <AccordionTrigger className="text-md font-medium border-b-0">
                                {district.name}
                            </AccordionTrigger>
                            <AccordionContent className="pt-2">
                              {district.report ? (
                                <Card className="bg-muted/50">
                                  <CardContent className="p-4 space-y-3 text-sm">
                                    {Object.entries(district.report).map(([key, value]) => {
                                      if (key === 'departamento' || key === 'distrito' || key === 'id' || !value) return null;
                                      
                                      const formattedKey = key.replace(/-/g, ' ');

                                      if(key === 'lugar-resguardo') {
                                        return (
                                          <div key={key}>
                                            <p className="font-semibold capitalize text-muted-foreground">{formattedKey}:</p>
                                            <div className="flex items-center gap-2">
                                              <ResguardoIcon lugar={String(value)} />
                                              <p>{String(value)}</p>
                                            </div>
                                          </div>
                                        )
                                      }

                                      return (
                                          <div key={key}>
                                            <p className="font-semibold capitalize text-muted-foreground">{formattedKey}:</p>
                                            <p>{String(value)}</p>
                                          </div>
                                      );
                                    })}
                                  </CardContent>
                                </Card>
                              ) : (
                                <div className="text-center py-4 text-muted-foreground text-sm">
                                  <p>No hay informe para este distrito.</p>
                                </div>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
