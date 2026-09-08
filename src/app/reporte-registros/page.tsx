"use client";

import { useMemo, useState, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFirebase, useCollectionOnce, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { type Dato } from '@/lib/data';
import { 
    Loader2, 
    Landmark, 
    Building2, 
    Download, 
    FileDown, 
    Layers, 
    FileText,
    PieChart
} from 'lucide-react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';

export default function ReporteRegistrosPage() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [logoBase64, setLogoBase64] = useState<string | null>(null);

    useEffect(() => {
        const fetchLogo = async () => {
            try {
                const response = await fetch('/logo.png');
                const blob = await response.blob();
                const reader = new FileReader();
                reader.onloadend = () => setLogoBase64(reader.result as string);
                reader.readAsDataURL(blob);
            } catch (error) {
                console.error("Error fetching logo:", error);
            }
        };
        fetchLogo();
    }, []);

    const datosQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'datos');
    }, [firestore]);

    const { data: datosData, isLoading } = useCollectionOnce<Dato>(datosQuery);

    const hierarchy = useMemo(() => {
        if (!datosData) return [];
        
        const depts: Record<string, { name: string, districts: string[] }> = {};
        
        datosData.forEach(d => {
            const depto = d.departamento || 'SIN DEPARTAMENTO';
            const dist = d.distrito || 'SIN DISTRITO';

            // Ignorar departamentos institucionales
            if (depto.includes('CIDEE') || depto.includes('DGRE') || depto.includes('VDRE') || depto.includes('SEDE CENTRAL')) {
                return;
            }

            if (!depts[depto]) depts[depto] = { name: depto, districts: [] };
            if (!depts[depto].districts.includes(dist)) {
                depts[depto].districts.push(dist);
            }
        });

        return Object.values(depts)
            .map(dept => ({
                ...dept,
                districts: dept.districts.sort((a, b) => a.localeCompare(b))
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [datosData]);

    const totalRegistros = useMemo(() => {
        return hierarchy.reduce((acc, curr) => acc + curr.districts.length, 0);
    }, [hierarchy]);

    const exportToExcel = () => {
        if (!hierarchy.length) return;
        const data: any[] = [];
        let index = 1;

        hierarchy.forEach(d => {
            d.districts.forEach(dist => {
                data.push({
                    "N°": index++,
                    "DEPARTAMENTO": d.name,
                    "REGISTRO ELECTORAL (DISTRITO)": dist
                });
            });
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Registros_Electorales");

        ws['!cols'] = [
            { wch: 6 },
            { wch: 25 },
            { wch: 40 }
        ];

        XLSX.writeFile(wb, `Listado_Registros_Electorales_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast({ title: "Excel exportado exitosamente" });
    };

    const exportToPDF = () => {
        if (!hierarchy.length) return;

        const doc = new jsPDF();
        const margin = 14;
        const pageWidth = doc.internal.pageSize.getWidth();

        if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', margin, 10, 15, 15);
        }

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("INFORME DE REGISTROS ELECTORALES", pageWidth / 2, 18, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Cantidad Total: ${totalRegistros} Registros Electorales`, pageWidth / 2, 24, { align: 'center' });
        doc.setDrawColor(200);
        doc.line(margin, 28, pageWidth - margin, 28);

        let currentY = 35;

        hierarchy.forEach(dept => {
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text(`DEPARTAMENTO: ${dept.name} (${dept.districts.length} Registros)`, margin, currentY);
            currentY += 5;

            const body = dept.districts.map((dist, i) => [i + 1, dist]);

            autoTable(doc, {
                startY: currentY,
                head: [["Nº", "Registro Electoral (Distrito u Oficina)"]],
                body: body,
                theme: 'grid',
                headStyles: { fillColor: [26, 26, 26], fontSize: 8 },
                bodyStyles: { fontSize: 8 },
                margin: { left: margin, right: margin }
            });

            currentY = (doc as any).lastAutoTable.finalY + 15;

            if (currentY > 260) {
                doc.addPage();
                currentY = 20;
            }
        });

        doc.save(`Reporte_Registros_Electorales_${new Date().toISOString().split('T')[0]}.pdf`);
        toast({ title: "PDF generado exitosamente" });
    };

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
    }

    return (
        <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
            <Header title="Reporte de Registros Electorales" />
            
            <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8 animate-in fade-in duration-500">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Layers className="h-8 w-8 text-primary" />
                            <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Directorio de Oficinas</h1>
                        </div>
                        <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                             Cantidad de Registros Electorales por Departamento
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <Button 
                            onClick={exportToExcel} 
                            disabled={hierarchy.length === 0}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] h-12 px-6 gap-2 shadow-xl rounded-xl transition-all"
                        >
                            <FileDown className="h-4 w-4" /> Exportar Excel
                        </Button>
                        <Button 
                            onClick={exportToPDF} 
                            disabled={hierarchy.length === 0}
                            className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] h-12 px-6 gap-2 shadow-xl rounded-xl transition-all"
                        >
                            <FileText className="h-4 w-4" /> Exportar PDF
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-white border-none shadow-xl rounded-[2rem] overflow-hidden">
                        <CardContent className="p-8 flex items-center gap-6">
                            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                                <Landmark className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Total de Departamentos</p>
                                <p className="text-5xl font-black text-primary leading-none">{hierarchy.length}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-white border-none shadow-xl rounded-[2rem] overflow-hidden">
                        <CardContent className="p-8 flex items-center gap-6">
                            <div className="h-16 w-16 rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0">
                                <Building2 className="h-8 w-8 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Total Registros Electorales</p>
                                <p className="text-5xl font-black text-blue-600 leading-none">{totalRegistros}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {hierarchy.length === 0 ? (
                    <Card className="p-20 text-center border-dashed bg-white rounded-[2.5rem]">
                        <div className="flex flex-col items-center justify-center opacity-20">
                            <Layers className="h-20 w-20 mb-4" />
                            <p className="font-black uppercase tracking-widest text-sm">No se encontraron datos</p>
                        </div>
                    </Card>
                ) : (
                    <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
                        <CardHeader className="p-8 border-b border-neutral-100 bg-neutral-50/50">
                            <CardTitle className="font-black uppercase text-sm tracking-widest flex items-center gap-2">
                                <PieChart className="h-4 w-4 text-primary" /> Distribución Territorial
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8">
                            <Accordion type="multiple" className="space-y-4">
                                {hierarchy.map((dept) => (
                                    <AccordionItem key={dept.name} value={dept.name} className="border-2 rounded-2xl bg-white shadow-sm overflow-hidden transition-all data-[state=open]:border-primary/20">
                                        <AccordionTrigger className="hover:no-underline px-6 py-5 bg-white group data-[state=open]:bg-muted/10">
                                            <div className="flex items-center gap-4 text-left w-full pr-4">
                                                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center transition-colors group-hover:bg-primary/20">
                                                    <Landmark className="h-5 w-5" />
                                                </div>
                                                <div className="flex-1">
                                                    <h2 className="text-lg font-black uppercase tracking-tight text-[#1A1A1A]">{dept.name}</h2>
                                                </div>
                                                <div className="flex items-center">
                                                    <Badge className="bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-black uppercase px-3 py-1">
                                                        {dept.districts.length} REGISTROS
                                                    </Badge>
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="px-6 pb-6 pt-2 border-t border-dashed bg-muted/5">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-4">
                                                {dept.districts.map((dist, idx) => (
                                                    <div key={idx} className="flex items-center gap-3 p-3 bg-white border rounded-xl shadow-sm hover:border-primary/30 transition-colors">
                                                        <Building2 className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                                                        <span className="font-black uppercase text-[10px] tracking-tight text-foreground/80 line-clamp-2">
                                                            {dist}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </CardContent>
                    </Card>
                )}
            </main>
        </div>
    );
}
