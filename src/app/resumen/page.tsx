
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection } from 'firebase/firestore';
import { type Dato, type ReportData } from '@/lib/data';
import { Loader2, Building, CheckCircle, Shield, FileText, Landmark, Vote, Scale, Home, HelpCircle, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cleanFileName } from '@/lib/utils';


interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

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
    reports: ReportData[];
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

type ComisariaData = {
    [department: string]: string[];
}


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
  const router = useRouter();
  const { toast } = useToast();

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollection<Dato>(datosQuery);
  
  const reportsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'reports') : null, [firestore]);
  const { data: reportsData, isLoading: isLoadingReports } = useCollection<ReportData>(reportsQuery);

  const [structuredData, setStructuredData] = useState<DepartmentWithDistricts[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [comisariaData, setComisariaData] = useState<ComisariaData>({});

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [districtsForCategory, setDistrictsForCategory] = useState<string[]>([]);
  
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [logo1Base64, setLogo1Base64] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogo = async (path: string, setter: (data: string | null) => void) => {
        try {
            const response = await fetch(path);
            const blob = await response.blob();
            const reader = new FileReader();
            reader.onloadend = () => setter(reader.result as string);
            reader.readAsDataURL(blob);
        } catch (error) {
            console.error(`Error fetching logo ${path}:`, error);
        }
    };
    fetchLogo('/logo1.png', setLogo1Base64);
    fetchLogo('/logo.png', setLogoBase64);
  }, []);

  useEffect(() => {
    if (datosData && reportsData) {
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
      
      const initialCategoryData = (): CategoryData => ({ count: 0, districts: [], reports: [] });
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
      summary.totalReports.reports = reportsData;

      reportsData.forEach(report => {
        const lugar = report['lugar-resguardo'] ? report['lugar-resguardo'].toLowerCase().trim() : '';
        const fullDistrictName = `${report.departamento} - ${report.distrito}`;
        
        if (lugar.includes('habitacion segura') || lugar.includes('registro electoral')) {
            summary.habitacionSegura.count++;
            summary.habitacionSegura.districts.push(fullDistrictName);
            summary.habitacionSegura.reports.push(report);
        } else if (lugar.includes('comisaria')) {
            summary.comisaria.count++;
            summary.comisaria.districts.push(fullDistrictName);
            summary.comisaria.reports.push(report);
        } else if (lugar.includes('parroquia')) {
            summary.parroquia.count++;
            summary.parroquia.districts.push(fullDistrictName);
            summary.parroquia.reports.push(report);
        } else if (lugar.includes('local de votacion') || lugar.includes('local votacion')) {
            summary.localVotacion.count++;
            summary.localVotacion.districts.push(fullDistrictName);
            summary.localVotacion.reports.push(report);
        } else if (lugar.includes('juzgado')) {
            summary.juzgado.count++;
            summary.juzgado.districts.push(fullDistrictName);
            summary.juzgado.reports.push(report);
        } else if (lugar.includes('intendencia')) {
            summary.propiedadIntendencia.count++;
            summary.propiedadIntendencia.districts.push(fullDistrictName);
            summary.propiedadIntendencia.reports.push(report);
        } else {
            summary.otrosNoEspecificado.count++;
            summary.otrosNoEspecificado.districts.push(fullDistrictName);
            summary.otrosNoEspecificado.reports.push(report);
        }
      });
      setSummaryData(summary);
    }
  }, [datosData, reportsData]);

  useEffect(() => {
    if (reportsData) {
        const comisariaSummary: ComisariaData = {};
        reportsData.forEach(report => {
            const lugar = report['lugar-resguardo'] ? report['lugar-resguardo'].toLowerCase().trim() : '';
            if (lugar.includes('comisaria')) {
                const deptName = report.departamento!;
                const distName = report.distrito!;
                if (!comisariaSummary[deptName]) {
                    comisariaSummary[deptName] = [];
                }
                comisariaSummary[deptName].push(distName);
            }
        });
        setComisariaData(comisariaSummary);
    }
}, [reportsData]);

const handleGeneratePdf = async () => {
    if (!structuredData || !summaryData || !logo1Base64 || !logoBase64) return;
    setIsGeneratingPdf(true);

    try {
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' }) as jsPDFWithAutoTable;
        
        const addHeaderAndFooter = (pageNumber: number, totalPages: number) => {
            if (logo1Base64) doc.addImage(logo1Base64, 'PNG', 15, 5, 20, 20);
            if (logoBase64) doc.addImage(logoBase64, 'PNG', doc.internal.pageSize.getWidth() - 15 - 20, 5, 20, 20);
            doc.setFontSize(10);
            doc.text(`Página ${pageNumber} / ${totalPages}`, doc.internal.pageSize.getWidth() - 15, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
        };

        const detailedBody = structuredData.flatMap(department => {
            const departmentHeader = [{ content: `Departamento: ${department.name.toUpperCase()}`, colSpan: 2, styles: { fontStyle: 'bold', halign: 'left', fillColor: [220, 220, 220] } }];
            const tableHeader = [{ content: 'Distrito', styles: { fontStyle: 'bold' } }, { content: 'Lugar de Resguardo', styles: { fontStyle: 'bold' } }];
            const departmentRows = department.districts.map(district => [
                district.name,
                district.report ? district.report['lugar-resguardo'] || 'N/A' : 'Sin informe'
            ]);
            return [departmentHeader, tableHeader, ...departmentRows];
        });

        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text("Informe Detallado por Ubicación", doc.internal.pageSize.getWidth() / 2, 30, { align: 'center' });

        autoTable(doc, {
            body: detailedBody,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2, lineWidth: 0.1, lineColor: [100, 100, 100] },
            columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 'auto' } },
            startY: 40,
        });
        
        const totalPages = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            addHeaderAndFooter(i, totalPages);
        }

        doc.save(`Informe-Resumen-Detallado.pdf`);
    } catch (error) {
        console.error("Error generating PDF:", error);
        toast({ title: 'Error', description: 'No se pudo generar el informe en PDF.', variant: 'destructive' });
    } finally {
        setIsGeneratingPdf(false);
    }
};

const handleGenerateCategoryPdf = async (categoryKey: keyof SummaryData | 'otros', title: string) => {
    if (!summaryData || !logo1Base64 || !logoBase64) return;
    setIsGeneratingPdf(true);
    
    let categoryReports: ReportData[] = [];
     if (categoryKey === 'otros') {
        categoryReports = [
            ...summaryData.parroquia.reports,
            ...summaryData.localVotacion.reports,
            ...summaryData.juzgado.reports,
            ...summaryData.propiedadIntendencia.reports,
            ...summaryData.otrosNoEspecificado.reports,
        ];
    } else {
        categoryReports = summaryData[categoryKey].reports;
    }

    try {
        const doc = new jsPDF() as jsPDFWithAutoTable;
        
        const addHeaderAndFooter = (pageNumber: number, totalPages: number) => {
            if (logo1Base64) doc.addImage(logo1Base64, 'PNG', 15, 5, 20, 20);
            if (logoBase64) doc.addImage(logoBase64, 'PNG', doc.internal.pageSize.getWidth() - 15 - 20, 5, 20, 20);
            
            doc.setFontSize(10);
            doc.text(`Página ${pageNumber} / ${totalPages}`, doc.internal.pageSize.getWidth() - 15, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
        };
        
        const groupedByDept: Record<string, {distrito: string}[]> = categoryReports
            .sort((a,b) => (a.departamento || '').localeCompare(b.departamento || ''))
            .reduce((acc, report) => {
                const department = report.departamento || 'Sin Departamento';
                if (!acc[department]) {
                    acc[department] = [];
                }
                acc[department].push({
                  distrito: report.distrito || 'Sin Distrito',
                });
                return acc;
            }, {} as Record<string, {distrito: string}[]>);

        let finalBody: any[] = [];
        Object.entries(groupedByDept).forEach(([dept, districts]) => {
          finalBody.push([
            { content: `Departamento: ${dept.toUpperCase()} (${districts.length})`, colSpan: 1, styles: { fontStyle: 'bold', fillColor: [220, 220, 220], textColor: 0 } },
          ]);
          districts.sort((a,b) => a.distrito.localeCompare(b.distrito)).forEach(d => {
            finalBody.push([d.distrito]);
          });
        });

        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(title, doc.internal.pageSize.getWidth() / 2, 30, { align: 'center' });
        
        autoTable(doc, {
            body: finalBody,
            theme: 'grid',
            headStyles: { halign: 'center', fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', fontSize: 18, lineWidth: 0 },
            styles: { fontSize: 8, cellPadding: 2, lineWidth: 0.1, lineColor: [100, 100, 100] },
            startY: 40,
        });

        const totalPages = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          addHeaderAndFooter(i, totalPages);
        }
        
        doc.save(`Informe-${cleanFileName(title)}.pdf`);
    } catch (error) {
        console.error("Error generating category PDF:", error);
        toast({ title: 'Error', description: 'No se pudo generar el informe en PDF.', variant: 'destructive' });
    } finally {
        setIsGeneratingPdf(false);
    }
};

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
  
  const handleDistrictClick = (deptName: string, distName: string) => {
    if (deptName && distName) {
      const deptParam = encodeURIComponent(deptName);
      const distParam = encodeURIComponent(distName);
      router.push(`/ficha?dept=${deptParam}&dist=${distParam}`);
    }
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
    { key: 'habitacionSegura', title: 'Registros con Habitaciones Seguras', icon: CheckCircle, className: 'text-green-600', onClick: () => handleCategoryClick('habitacionSegura', 'Registros con Habitaciones Seguras') },
  ] as const;

  const otrosCount = summaryData.parroquia.count + summaryData.localVotacion.count + summaryData.juzgado.count + summaryData.propiedadIntendencia.count + summaryData.otrosNoEspecificado.count;

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Resumen Detallado por Ubicación" />
      <main className="flex flex-1 flex-col p-4 gap-8">

        <Card className="w-full max-w-6xl mx-auto">
            <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                      <CardTitle>Resumen General</CardTitle>
                      <CardDescription>
                          Visión global de los informes registrados en el sistema.
                      </CardDescription>
                  </div>
                   <Button onClick={handleGeneratePdf} disabled={isGeneratingPdf} size="sm">
                       {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                       Generar Resumen PDF
                   </Button>
                </div>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
               {summaryCards.map(card => {
                 const Icon = card.icon;
                 return (
                    <Card key={card.key} className="relative">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 h-7 w-7 text-muted-foreground"
                            onClick={(e) => { e.stopPropagation(); handleGenerateCategoryPdf(card.key, card.title); }}
                            disabled={isGeneratingPdf}
                            aria-label={`Generar PDF para ${card.title}`}
                        >
                           {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        </Button>
                        <div onClick={card.onClick} className="cursor-pointer hover:bg-muted/50 transition-colors h-full rounded-md p-6 pb-4">
                            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <h3 className="text-sm font-medium">{card.title}</h3>
                                <Icon className={`h-4 w-4 text-muted-foreground ${card.className || ''}`} />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{summaryData[card.key].count}</div>
                            </div>
                        </div>
                    </Card>
                 )
               })}
                <Card className="relative">
                     <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7 text-muted-foreground"
                        onClick={(e) => { e.stopPropagation(); handleGenerateCategoryPdf('comisaria', 'Detalle: Lugar de Resguardo Comisaria'); }}
                        disabled={isGeneratingPdf}
                        aria-label="Generar PDF para Lugar de Resguardo Comisaria"
                    >
                        {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    </Button>
                    <div className="transition-colors h-full rounded-md p-6 pb-4">
                        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <h3 className="text-sm font-medium">Lugar de Resguardo Comisaria</h3>
                            <Shield className="h-4 w-4 text-muted-foreground text-blue-600" />
                        </div>
                        <div className="space-y-2">
                            <div className="text-2xl font-bold">{summaryData.comisaria.count}</div>
                            <Accordion type="single" collapsible className="w-full text-xs">
                              <AccordionItem value="item-1">
                                <AccordionTrigger className="p-0 hover:no-underline">Ver desglose</AccordionTrigger>
                                <AccordionContent className="pt-2 space-y-1">
                                    <Accordion type="multiple" className="w-full">
                                    {Object.entries(comisariaData).sort(([deptA], [deptB]) => deptA.localeCompare(deptB)).map(([dept, districts]) => (
                                        <AccordionItem value={dept} key={dept}>
                                            <AccordionTrigger className="p-0 hover:no-underline text-xs">
                                               {dept} ({districts.length})
                                            </AccordionTrigger>
                                            <AccordionContent className="pt-2 pl-4 space-y-1">
                                                {districts.map(dist => (
                                                    <div key={dist} className="text-xs cursor-pointer hover:font-semibold" onClick={(e) => { e.stopPropagation(); handleDistrictClick(dept, dist); }}>{dist}</div>
                                                ))}
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                    </Accordion>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                        </div>
                    </div>
                </Card>
                 <Card className="relative">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7 text-muted-foreground"
                        onClick={(e) => { e.stopPropagation(); handleGenerateCategoryPdf('otros', 'Detalle: Resguardo en Otros Lugares'); }}
                        disabled={isGeneratingPdf}
                        aria-label="Generar PDF para Resguardo en Otros Lugares"
                    >
                        {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    </Button>
                    <div className="transition-colors h-full rounded-md p-6 pb-4">
                        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <h3 className="text-sm font-medium">Resguardo en Otros Lugares</h3>
                            <Building className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{otrosCount}</div>
                            <Accordion type="single" collapsible className="w-full text-xs">
                              <AccordionItem value="item-1">
                                <AccordionTrigger className="p-0 hover:no-underline">Ver desglose</AccordionTrigger>
                                <AccordionContent className="pt-2 space-y-1">
                                  <div className="flex justify-between items-center cursor-pointer hover:font-semibold text-xs" onClick={(e) => { e.stopPropagation(); handleCategoryClick('parroquia', 'Parroquia');}}>
                                    <span className="flex items-center"><Landmark className="mr-2 h-4 w-4 text-amber-600" />Parroquia:</span>
                                    <span>{summaryData.parroquia.count}</span>
                                  </div>
                                  <div className="flex justify-between items-center cursor-pointer hover:font-semibold text-xs" onClick={(e) => { e.stopPropagation(); handleCategoryClick('localVotacion', 'Local de Votación');}}>
                                    <span className="flex items-center"><Vote className="mr-2 h-4 w-4 text-cyan-600" />Local de Votación:</span>
                                    <span>{summaryData.localVotacion.count}</span>
                                  </div>
                                  <div className="flex justify-between items-center cursor-pointer hover:font-semibold text-xs" onClick={(e) => { e.stopPropagation(); handleCategoryClick('juzgado', 'Juzgado');}}>
                                    <span className="flex items-center"><Scale className="mr-2 h-4 w-4 text-gray-600" />Juzgado:</span>
                                    <span>{summaryData.juzgado.count}</span>
                                  </div>
                                  <div className="flex justify-between items-center cursor-pointer hover:font-semibold text-xs" onClick={(e) => { e.stopPropagation(); handleCategoryClick('propiedadIntendencia', 'Prop. Intendencia');}}>
                                    <span className="flex items-center"><Home className="mr-2 h-4 w-4 text-rose-600" />Prop. Intendencia:</span>
                                    <span>{summaryData.propiedadIntendencia.count}</span>
                                  </div>
                                  <div className="flex justify-between items-center cursor-pointer hover:font-semibold text-xs" onClick={(e) => { e.stopPropagation(); handleCategoryClick('otrosNoEspecificado', 'Otros no especificados');}}>
                                    <span className="flex items-center"><HelpCircle className="mr-2 h-4 w-4 text-gray-400" />Otros no especificados:</span>
                                    <span>{summaryData.otrosNoEspecificado.count}</span>
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                        </div>
                    </div>
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
                      Listado de ubicaciones para la categoría seleccionada. Haz clic en un distrito para ver su ficha.
                  </DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-72 w-full rounded-md border">
                  {districtsForCategory.length > 0 ? (
                      <div className="p-4 space-y-1">
                          {districtsForCategory.map((dist, index) => {
                             const [deptName, distName] = dist.split(' - ');
                             return (
                              <Button
                                  key={index}
                                  variant="ghost"
                                  className="w-full justify-start text-left h-auto py-2"
                                  onClick={() => handleDistrictClick(deptName, distName)}
                              >
                                {dist}
                              </Button>
                             )
                          })}
                      </div>
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

    