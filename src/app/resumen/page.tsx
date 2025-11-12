
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
  id: string;
  name: string;
  districts: DistrictWithReport[];
};

type CategoryDistrictInfo = {
    displayName: string;
    departamento: string;
    distrito: string;
};

type CategoryData = {
    count: number;
    districts: CategoryDistrictInfo[];
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

type BreakdownData = {
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
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollection<Dato>(datosQuery);
  
  const reportsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'reports') : null, [firestore]);
  const { data: reportsData, isLoading: isLoadingReports } = useCollection<ReportData>(reportsQuery);

  const [structuredData, setStructuredData] = useState<DepartmentWithDistricts[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [comisariaData, setComisariaData] = useState<BreakdownData>({});
  const [habitacionSeguraData, setHabitacionSeguraData] = useState<BreakdownData>({});

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [districtsForCategory, setDistrictsForCategory] = useState<CategoryDistrictInfo[]>([]);
  
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

      let deptIdCounter = 0;
      const structured: DepartmentWithDistricts[] = Object.keys(departments).sort().map(deptName => {
        const districts = Array.from(departments[deptName]).sort();
        const districtsWithReports: DistrictWithReport[] = districts.map(distName => {
          const report = reportsData.find(r => r.departamento === deptName && r.distrito === distName) || null;
          return { name: distName, report };
        });

        return { id: `dept-${deptIdCounter++}`, name: deptName, districts: districtsWithReports };
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
      summary.totalReports.districts = reportsData.map(r => ({ displayName: `${r.departamento} - ${r.distrito}`, departamento: r.departamento!, distrito: r.distrito! }));
      summary.totalReports.reports = reportsData;

      reportsData.forEach(report => {
        const lugar = report['lugar-resguardo'] ? report['lugar-resguardo'].toLowerCase().trim() : '';
        const districtInfo: CategoryDistrictInfo = {
            displayName: `${report.departamento} - ${report.distrito}`,
            departamento: report.departamento!,
            distrito: report.distrito!,
        };
        
        if (lugar.includes('habitacion segura') || lugar.includes('registro electoral')) {
            summary.habitacionSegura.count++;
            summary.habitacionSegura.districts.push(districtInfo);
            summary.habitacionSegura.reports.push(report);
        } else if (lugar.includes('comisaria')) {
            summary.comisaria.count++;
            summary.comisaria.districts.push(districtInfo);
            summary.comisaria.reports.push(report);
        } else if (lugar.includes('parroquia')) {
            summary.parroquia.count++;
            summary.parroquia.districts.push(districtInfo);
            summary.parroquia.reports.push(report);
        } else if (lugar.includes('local de votacion') || lugar.includes('local votacion')) {
            summary.localVotacion.count++;
            summary.localVotacion.districts.push(districtInfo);
            summary.localVotacion.reports.push(report);
        } else if (lugar.includes('juzgado')) {
            summary.juzgado.count++;
            summary.juzgado.districts.push(districtInfo);
            summary.juzgado.reports.push(report);
        } else if (lugar.includes('intendencia')) {
            summary.propiedadIntendencia.count++;
            summary.propiedadIntendencia.districts.push(districtInfo);
            summary.propiedadIntendencia.reports.push(report);
        } else {
            summary.otrosNoEspecificado.count++;
            summary.otrosNoEspecificado.districts.push(districtInfo);
            summary.otrosNoEspecificado.reports.push(report);
        }
      });
      setSummaryData(summary);
    }
  }, [datosData, reportsData]);

  useEffect(() => {
    if (reportsData) {
        const comisariaSummary: BreakdownData = {};
        const habitacionSeguraSummary: BreakdownData = {};

        reportsData.forEach(report => {
            const lugar = report['lugar-resguardo'] ? report['lugar-resguardo'].toLowerCase().trim() : '';
            const deptName = report.departamento!;
            const distName = report.distrito!;

            if (lugar.includes('comisaria')) {
                if (!comisariaSummary[deptName]) {
                    comisariaSummary[deptName] = [];
                }
                comisariaSummary[deptName].push(distName);
            } else if (lugar.includes('habitacion segura') || lugar.includes('registro electoral')) {
                 if (!habitacionSeguraSummary[deptName]) {
                    habitacionSeguraSummary[deptName] = [];
                }
                habitacionSeguraSummary[deptName].push(distName);
            }
        });
        setComisariaData(comisariaSummary);
        setHabitacionSeguraData(habitacionSeguraSummary);
    }
}, [reportsData]);

const handleGeneratePdf = async () => {
    if (!structuredData || !summaryData || !logo1Base64 || !logoBase64) return;
    setIsGeneratingPdf(true);

    try {
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' }) as jsPDFWithAutoTable;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        const title = "Informe Detallado por Ubicación";

        const addHeader = () => {
            if (logo1Base64) doc.addImage(logo1Base64, 'PNG', margin, 10, 20, 20);
            if (logoBase64) doc.addImage(logoBase64, 'PNG', pageWidth - margin - 20, 10, 20, 20);
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text(title, pageWidth / 2, 22, { align: 'center' });
        };
        
        const addFooter = (data: any) => {
            doc.setFontSize(10);
            doc.text(`Página ${data.pageNumber}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        };
        
        let finalBody: any[] = [];
        structuredData.forEach(department => {
             finalBody.push([{ content: `Departamento: ${department.name.toUpperCase()}`, colSpan: 2, styles: { fontStyle: 'bold', halign: 'left', fillColor: [230, 230, 230] } }]);
            department.districts.forEach(district => {
                finalBody.push([
                    district.name,
                    district.report ? district.report['lugar-resguardo'] || 'N/A' : 'Sin informe'
                ]);
            });
        });
        
        autoTable(doc, {
            head: [['Distrito', 'Lugar de Resguardo']],
            body: finalBody,
            startY: 35,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 9, cellPadding: 2, lineWidth: 0.1, lineColor: [189, 195, 199] },
            columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 'auto' } },
            didDrawPage: (data) => {
                addHeader();
                addFooter(data);
            },
            margin: { top: 35, bottom: 20 }
        });
        
        const summaryBody = [
            ['Habitaciones Seguras', summaryData.habitacionSegura.count],
            ['Comisarías', summaryData.comisaria.count],
            ['Parroquias', summaryData.parroquia.count],
            ['Locales de Votación', summaryData.localVotacion.count],
            ['Juzgados', summaryData.juzgado.count],
            ['Propiedad de Intendencia', summaryData.propiedadIntendencia.count],
            ['Otros / No Especificado', summaryData.otrosNoEspecificado.count],
        ];

        const totalGeneral = summaryBody.reduce((sum, row) => sum + (row[1] as number), 0);

        autoTable(doc, {
            head: [['Resumen de Lugares de Resguardo', 'Total']],
            body: summaryBody,
            foot: [['TOTAL GENERAL', totalGeneral]],
            theme: 'striped',
            headStyles: { fillColor: [44, 62, 80], textColor: 255, fontStyle: 'bold' },
            footStyles: { fillColor: [44, 62, 80], textColor: 255, fontStyle: 'bold' },
            didDrawPage: (data) => {
                addHeader();
                addFooter(data);
            }
        });
        
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
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' }) as jsPDFWithAutoTable;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        
        const addHeader = () => {
            if (logo1Base64) doc.addImage(logo1Base64, 'PNG', margin, 10, 20, 20);
            if (logoBase64) doc.addImage(logoBase64, 'PNG', pageWidth - margin - 20, 10, 20, 20);
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text(title, pageWidth / 2, 22, { align: 'center' });
        };

        const addFooter = (data: any) => {
            doc.setFontSize(10);
            doc.text(`Página ${data.pageNumber}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        };
        
        const groupedByDept: Record<string, ReportData[]> = categoryReports
            .sort((a,b) => (a.departamento || '').localeCompare(b.departamento || ''))
            .reduce((acc, report) => {
                const department = report.departamento || 'Sin Departamento';
                if (!acc[department]) {
                    acc[department] = [];
                }
                acc[department].push(report);
                return acc;
            }, {} as Record<string, ReportData[]>);

        let finalBody: any[] = [];
        Object.entries(groupedByDept).forEach(([dept, reports]) => {
            finalBody.push([
                { content: `Departamento: ${dept.toUpperCase()}`, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [230, 230, 230], textColor: 0 } },
            ]);
            reports.sort((a,b) => (a.distrito || '').localeCompare(b.distrito || '')).forEach(report => {
                finalBody.push([report.distrito || 'N/A', report['lugar-resguardo'] || 'N/A']);
            });
        });
        
        autoTable(doc, {
            head: [['Distrito', 'Lugar de Resguardo']],
            body: finalBody,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 9, cellPadding: 2, lineWidth: 0.1, lineColor: [189, 195, 199] },
            columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 'auto' } },
            didDrawPage: (data) => {
              addHeader();
              addFooter(data);
            },
            margin: { top: 35, bottom: 20 }
        });
        
        const summaryBody = Object.entries(groupedByDept).map(([dept, reports]) => [dept, reports.length]);
        const totalGeneral = summaryBody.reduce((sum, row) => sum + (row[1] as number), 0);

        autoTable(doc, {
            head: [['Resumen por Departamento', 'Total']],
            body: summaryBody,
            foot: [['TOTAL GENERAL', totalGeneral]],
            theme: 'striped',
            headStyles: { fillColor: [44, 62, 80], textColor: 255, fontStyle: 'bold' },
            footStyles: { fillColor: [44, 62, 80], textColor: 255, fontStyle: 'bold' },
            didDrawPage: (data) => {
                addHeader();
                addFooter(data);
            }
        });

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
    
    let districts: CategoryDistrictInfo[] = [];
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
    setDistrictsForCategory(districts.sort((a,b) => a.displayName.localeCompare(b.displayName)));
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

  if (isLoading || !summaryData || !isClient) {
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
    { key: 'totalReports', title: 'Total de Informes', icon: FileText },
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
                        <div className="h-full rounded-md p-6 pb-4">
                            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <h3 className="text-sm font-medium">{card.title}</h3>
                                <Icon className={`h-4 w-4 text-muted-foreground`} />
                            </div>
                            <div>
                                <div className="text-2xl font-bold cursor-pointer" onClick={() => handleCategoryClick(card.key, card.title)}>
                                  {summaryData[card.key].count}
                                </div>
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
                        onClick={(e) => { e.stopPropagation(); handleGenerateCategoryPdf('habitacionSegura', 'Detalle: Registros con Habitaciones Seguras'); }}
                        disabled={isGeneratingPdf}
                        aria-label="Generar PDF para Registros con Habitaciones Seguras"
                    >
                        {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    </Button>
                    <div className="h-full rounded-md p-6 pb-4">
                        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <h3 className="text-sm font-medium">Registros con Habitaciones Seguras</h3>
                            <CheckCircle className="h-4 w-4 text-muted-foreground text-green-600" />
                        </div>
                        <div className="space-y-2">
                            <div className="text-2xl font-bold">{summaryData.habitacionSegura.count}</div>
                            <Accordion type="single" collapsible className="w-full text-xs">
                              <AccordionItem value="item-1">
                                <AccordionTrigger className="p-0 hover:no-underline">
                                    <div className="cursor-pointer" onClick={(e) => { e.stopPropagation(); handleCategoryClick('habitacionSegura', 'Detalle: Registros con Habitaciones Seguras');}}>Ver desglose</div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 space-y-1">
                                    <Accordion type="multiple" className="w-full">
                                    {Object.entries(habitacionSeguraData).sort(([deptA], [deptB]) => deptA.localeCompare(deptB)).map(([dept, districts]) => (
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
                        onClick={(e) => { e.stopPropagation(); handleGenerateCategoryPdf('comisaria', 'Detalle: Lugar de Resguardo Comisaria'); }}
                        disabled={isGeneratingPdf}
                        aria-label="Generar PDF para Lugar de Resguardo Comisaria"
                    >
                        {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    </Button>
                    <div className="h-full rounded-md p-6 pb-4">
                        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <h3 className="text-sm font-medium">Lugar de Resguardo Comisaria</h3>
                            <Shield className="h-4 w-4 text-muted-foreground text-blue-600" />
                        </div>
                        <div className="space-y-2">
                            <div className="text-2xl font-bold">{summaryData.comisaria.count}</div>
                            <Accordion type="single" collapsible className="w-full text-xs">
                              <AccordionItem value="item-1">
                                <AccordionTrigger className="p-0 hover:no-underline">
                                    <div className="cursor-pointer" onClick={(e) => { e.stopPropagation(); handleCategoryClick('comisaria', 'Detalle: Lugar de Resguardo Comisaria');}}>Ver desglose</div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 space-y-1">
                                    <Accordion type="multiple" className="w-full">
                                    {Object.entries(comisariaData).sort(([deptA], [deptB]) => deptA.localeCompare(deptB)).map(([dept, districts]) => (
                                        <AccordionItem value={dept} key={dept}>
                                            <AccordionTrigger className="p-0 hover-no-underline text-xs">
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
                    <div className="h-full rounded-md p-6 pb-4">
                        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <h3 className="text-sm font-medium">Resguardo en Otros Lugares</h3>
                            <Building className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{otrosCount}</div>
                            <Accordion type="single" collapsible className="w-full text-xs">
                              <AccordionItem value="item-1">
                                <AccordionTrigger className="p-0 hover:no-underline">
                                    <div className="cursor-pointer" onClick={(e) => { e.stopPropagation(); handleCategoryClick('otros', 'Detalle: Resguardo en Otros Lugares');}}>Ver desglose</div>
                                </AccordionTrigger>
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
                  <AccordionItem value={department.id} key={department.id}>
                    <AccordionTrigger className="text-lg font-semibold hover:no-underline data-[state=open]:text-primary">
                      {department.name}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 px-4">
                        {department.districts.map((district) => (
                          <div key={district.name} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                            <span 
                              className="text-md font-medium cursor-pointer hover:underline"
                              onClick={() => handleDistrictClick(department.name, district.name)}
                            >
                                {district.name}
                            </span>
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
                          {districtsForCategory.map((districtInfo, index) => {
                             return (
                              <Button
                                  key={index}
                                  variant="ghost"
                                  className="w-full justify-start text-left h-auto py-2"
                                  onClick={() => handleDistrictClick(districtInfo.departamento, districtInfo.distrito)}
                              >
                                {districtInfo.displayName}
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
