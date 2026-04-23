
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useFirebase, useUser, useDocOnce } from '@/firebase';
import { doc } from 'firebase/firestore';
import { type Dato, type ReportData } from '@/lib/data';
import { Loader2, Building, CheckCircle, Shield, FileText, Landmark, Vote, Scale, Home, HelpCircle, Download, RefreshCw, AlertTriangle } from 'lucide-react';
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

type DistrictInfoForBreakdown = {
    name: string;
    code?: string;
    deptCode?: string;
    deptName: string;
}

type BreakdownData = {
    [department: string]: DistrictInfoForBreakdown[];
}

const ResguardoIcon = ({ lugar }: { lugar: string | undefined }) => {
  const normalizedLugar = lugar ? lugar.toLowerCase() : '';
  if (normalizedLugar.includes('habitacion') || normalizedLugar.includes('segura') || normalizedLugar.includes('registro')) {
    return <CheckCircle className="h-5 w-5 text-green-600" />;
  }
  if (normalizedLugar.includes('comisaria')) {
    return <Shield className="h-5 w-5 text-blue-600" />;
  }
  return <Building className="h-5 w-5 text-muted-foreground" />;
};

export default function ResumenPage() {
  const { firestore } = useFirebase();
  const { user: currentUser, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Leer resumen pre-calculado (Bajo Costo)
  const statsDocRef = useMemo(() => firestore ? doc(firestore, 'stats-summary', 'ubicaciones') : null, [firestore]);
  const { data: summary, isLoading: isLoadingSummary } = useDocOnce<any>(statsDocRef);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [districtsForCategory, setDistrictsForCategory] = useState<CategoryDistrictInfo[]>([]);
  
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [logo1Base64, setLogo1Base64] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  const canGeneratePdf = currentUser?.isAdmin || currentUser?.profile?.permissions?.includes('generar_pdf');

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

  const structuredData = summary?.structuredData || [];
  const summaryData = summary?.summaryData || null;

const handleGeneratePdf = async () => {
    if (!structuredData || !summaryData || !logo1Base64 || !logoBase64) return;
    setIsGeneratingPdf(true);
    try {
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' }) as jsPDFWithAutoTable;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        const addHeader = () => {
            if (logo1Base64) doc.addImage(logo1Base64, 'PNG', margin, 10, 20, 20);
            if (logoBase64) doc.addImage(logoBase64, 'PNG', pageWidth - margin - 20, 10, 20, 20);
            doc.setFontSize(16); doc.setFont('helvetica', 'bold');
            doc.text("Informe Detallado por Ubicación", pageWidth / 2, 22, { align: 'center' });
        };
        const addFooter = (data: any) => {
            doc.setFontSize(10); doc.text(`Página ${data.pageNumber}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        };
        let finalBody: any[] = [];
        structuredData.forEach((department: any) => {
             finalBody.push([{ content: `Departamento: ${department.name.toUpperCase()}`, colSpan: 2, styles: { fontStyle: 'bold', halign: 'left', fillColor: [230, 230, 230] } }]);
            department.districts.forEach((district: any) => {
                finalBody.push([district.name, district.report ? district.report['lugar-resguardo'] || 'N/A' : 'Sin informe']);
            });
        });
        autoTable(doc, {
            head: [['Distrito', 'Lugar de Resguardo']],
            body: finalBody,
            startY: 35,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
            didDrawPage: (data) => { addHeader(); addFooter(data); },
            margin: { top: 35, bottom: 20 }
        });
        doc.save(`Informe-Resumen-Detallado.pdf`);
    } catch (error) {
        toast({ title: 'Error', description: 'No se pudo generar el PDF.', variant: 'destructive' });
    } finally { setIsGeneratingPdf(false); }
};

  const handleCategoryClick = (category: string, title: string) => {
    if (!summaryData) return;
    let districts: CategoryDistrictInfo[] = [];
    
    if (category === 'otros') {
        // En el nuevo resumen, esto ya viene pre-calculado o podemos mostrar los que no son Habitación/Comisaría
        // Para simplificar, si el usuario hace clic en 'otros', mostramos una lista vacía o filtramos del structuredData
        // Por ahora, como es una vista de consulta rápida, dejaremos que vea el desglose por distrito abajo.
        toast({ title: "Desglose disponible abajo", description: "Puedes ver el detalle de cada distrito en la sección inferior." });
        return;
    } else {
        // El nuevo summaryData tiene los conteos, pero el desglose completo está en structuredData
        // No necesitamos el Dialog para esta versión de alto rendimiento
        toast({ title: "Detalle por Distrito", description: "Utiliza el acordeón de abajo para ver los lugares específicos." });
        return;
    }
  };
  
  const handleDistrictClick = (deptName: string, distName: string) => {
    if (deptName && distName) {
      router.push(`/ficha?dept=${encodeURIComponent(deptName)}&dist=${encodeURIComponent(distName)}`);
    }
  };

  if (isUserLoading || isLoadingSummary || !isClient) {
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

  if (!summaryData) {
    return (
        <div className="flex min-h-screen w-full flex-col">
            <Header title="Resumen Detallado por Ubicación" />
            <main className="flex flex-1 flex-col p-4 gap-8 justify-center items-center text-center">
                 <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
                 <h2 className="text-xl font-bold">Resumen No Sincronizado</h2>
                 <p className="text-muted-foreground max-w-md">
                    Los datos del resumen aún no han sido generados. 
                    Por favor, solicita al administrador que realice una <b>Sincronización de Datos</b> desde el panel de Reportes.
                 </p>
                  {currentUser?.isAdmin && (
                     <Button onClick={() => router.push('/reportes-pdf')} className="mt-4">
                         Ir a Sincronizar
                     </Button>
                 )}
            </main>
        </div>
    );
  }

  const otrosCount = (summaryData.parroquia?.count || 0) + 
                     (summaryData.localVotacion?.count || 0) + 
                     (summaryData.juzgado?.count || 0) + 
                     (summaryData.propiedadIntendencia?.count || 0) + 
                     (summaryData.otros?.count || 0);


  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Resumen Detallado por Ubicación" />
      <main className="flex flex-1 flex-col p-4 gap-8">
        <Card className="w-full max-w-6xl mx-auto">
            <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                      <CardTitle>Resumen General</CardTitle>
                      <CardDescription>Visión global de los informes registrados en el sistema.</CardDescription>
                  </div>
                    {canGeneratePdf && (
                        <Button onClick={handleGeneratePdf} disabled={isGeneratingPdf} size="sm">
                            {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            Generar Resumen PDF
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="text-sm font-medium">Total de Informes</h3>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="text-2xl font-bold cursor-pointer" onClick={() => handleCategoryClick('totalReports', 'Total de Informes')}>
                        {summaryData.totalReports.count}
                    </div>
                </Card>
                <Card className="p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="text-sm font-medium">Habitaciones Seguras</h3>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="text-2xl font-bold cursor-pointer" onClick={() => handleCategoryClick('habitacionSegura', 'Habitaciones Seguras')}>
                        {summaryData.habitacionSegura.count}
                    </div>
                </Card>
                <Card className="p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="text-sm font-medium">Comisarías</h3>
                        <Shield className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="text-2xl font-bold cursor-pointer" onClick={() => handleCategoryClick('comisaria', 'Comisarías')}>
                        {summaryData.comisaria.count}
                    </div>
                </Card>
                <Card className="p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="text-sm font-medium">Otros Lugares</h3>
                        <Building className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="text-2xl font-bold cursor-pointer" onClick={() => handleCategoryClick('otros', 'Otros Lugares')}>
                        {otrosCount}
                    </div>
                </Card>
            </CardContent>
        </Card>

        <Card className="w-full max-w-6xl mx-auto">
          <CardHeader>
            <CardTitle>Informe Detallado por Distrito</CardTitle>
            <CardDescription>Explora los informes para cada departamento y distrito.</CardDescription>
          </CardHeader>
          <CardContent>
              <Accordion type="multiple" className="w-full">
                {structuredData.map((department: any) => (
                  <AccordionItem value={department.id} key={department.id}>
                    <AccordionTrigger className="text-lg font-semibold hover:no-underline">{department.name}</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 px-4">
                        {department.districts.map((district: any) => (
                          <div key={district.name} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                            <span className="text-md font-medium cursor-pointer hover:underline" onClick={() => handleDistrictClick(department.name, district.name)}>
                                {district.name}
                            </span>
                            {district.report ? <ResguardoIcon lugar={district.report['lugar-resguardo']} /> : <p className="text-sm text-muted-foreground italic">No hay informe</p>}
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
              <DialogHeader><DialogTitle>{selectedCategory}</DialogTitle></DialogHeader>
              <ScrollArea className="h-72 w-full rounded-md border">
                  <div className="p-4 space-y-1">
                      {districtsForCategory.map((info, idx) => (
                          <Button key={idx} variant="ghost" className="w-full justify-start h-auto py-2" onClick={() => handleDistrictClick(info.departamento, info.distrito)}>
                            {info.displayName}
                          </Button>
                      ))}
                  </div>
              </ScrollArea>
          </DialogContent>
      </Dialog>
    </div>
  );
}
