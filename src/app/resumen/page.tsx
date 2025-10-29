
'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection } from 'firebase/firestore';
import { type ReportData, type Dato, type Department } from '@/lib/data';
import { Loader2, ServerCrash } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function ResumenPage() {
  const { firestore } = useFirebase();

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollection<Dato>(datosQuery);
  
  const reportsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'reports') : null, [firestore]);
  const { data: reportsData, isLoading: isLoadingReports } = useCollection<ReportData>(reportsQuery);

  const [departmentsWithDetails, setDepartmentsWithDetails] = useState<Department[]>([]);

  useEffect(() => {
    if (datosData && reportsData) {
      const depts: Record<string, Set<string>> = {};
      datosData.forEach(d => {
        if (!depts[d.departamento]) {
          depts[d.departamento] = new Set();
        }
        depts[d.departamento].add(d.distrito);
      });

      const deptsArray: Department[] = Object.keys(depts).sort().map(deptName => ({
        id: deptName,
        name: deptName,
        districts: Array.from(depts[deptName]).sort().map(distName => {
          const districtReports = reportsData.filter(
            report => report.departamento === deptName && report.distrito === distName
          );
          return {
            id: distName,
            name: distName,
            reports: districtReports,
          };
        }),
      }));

      setDepartmentsWithDetails(deptsArray);
    }
  }, [datosData, reportsData]);

  const isLoading = isLoadingDatos || isLoadingReports;

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Resumen de Estados" />
      <main className="flex flex-1 flex-col p-4 md:p-6 gap-6">
        <Card className="w-full max-w-6xl mx-auto">
          <CardHeader>
            <CardTitle>Resumen Detallado por Ubicación</CardTitle>
            <CardDescription>
              Explore los detalles de los informes para cada departamento y distrito.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center h-48">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            ) : departmentsWithDetails.length > 0 ? (
              <Accordion type="single" collapsible className="w-full">
                {departmentsWithDetails.map((department) => (
                  <AccordionItem value={department.id} key={department.id}>
                    <AccordionTrigger className="text-lg font-medium hover:no-underline data-[state=open]:text-primary">
                      {department.name}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pl-4 pt-2">
                        {department.districts.map((district) => (
                          <div key={district.id}>
                            <h4 className="text-md font-semibold mb-2">{district.name}</h4>
                            {district.reports && district.reports.length > 0 ? (
                              <div className="grid gap-4">
                                {district.reports.map(report => (
                                  <Card key={report.id} className="bg-muted/50">
                                    <CardContent className="p-4 space-y-2 text-sm">
                                      {Object.entries(report).map(([key, value]) => {
                                        if (key === 'departamento' || key === 'distrito' || key === 'id') return null;
                                        return (
                                          <div key={key} className="grid grid-cols-2 gap-2">
                                            <p className="font-semibold capitalize text-muted-foreground">{key.replace(/-/g, ' ')}:</p>
                                            <p>{String(value)}</p>
                                          </div>
                                        );
                                      })}
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            ) : (
                               <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-md">
                                No hay informes para este distrito.
                               </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                    <ServerCrash className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-semibold">No se encontraron datos.</p>
                    <p className="text-muted-foreground">
                        Asegúrate de haber importado los departamentos y reportes en la página de Configuración.
                    </p>
                </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
