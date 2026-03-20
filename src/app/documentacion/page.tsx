
"use client";

import { useState, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  BookOpen, 
  ShieldCheck, 
  Cpu, 
  Users, 
  FileText, 
  Globe, 
  MapPin, 
  Navigation, 
  Landmark, 
  Mail, 
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  Info,
  Camera,
  Layers,
  Search,
  Database,
  Building2,
  ClipboardCheck,
  ArrowLeftRight,
  UserCheck,
  TableProperties,
  Download,
  Loader2,
  FileDown,
  Printer,
  X,
  PlusCircle,
  Save,
  QrCode
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

const cn = (...inputs: any[]) => inputs.filter(Boolean).join(' ');

const Separator = ({ className }: { className?: string }) => <div className={cn("h-px w-full bg-border", className)} />;

export default function DocumentacionPage() {
  const { toast } = useToast();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
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

  const handleDownloadManual = async () => {
    if (!logoBase64) {
        toast({ variant: 'destructive', title: "Cargando recursos..." });
        return;
    }
    
    setIsGeneratingPdf(true);
    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;

        doc.addImage(logoBase64, 'PNG', margin, 15, 20, 20);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.text("MANUAL OPERATIVO CIDEE", pageWidth / 2, 30, { align: 'center' });
        doc.setFontSize(14);
        doc.text("GUÍA PARA JEFES DE OFICINA - V2.5", pageWidth / 2, 40, { align: 'center' });
        
        doc.setLineWidth(0.5);
        doc.line(margin, 45, pageWidth - margin, 45);

        let y = 60;
        const addSection = (title: string, content: string[]) => {
            doc.setFontSize(12); doc.setFont('helvetica', 'bold');
            doc.text(title, margin, y);
            y += 7;
            doc.setFontSize(10); doc.setFont('helvetica', 'normal');
            content.forEach(line => {
                const lines = doc.splitTextToSize(line, pageWidth - (margin * 2));
                doc.text(lines, margin + 5, y);
                y += (lines.length * 5) + 2;
            });
            y += 5;
        };

        addSection("1. ANEXO V - NUEVA SOLICITUD", [
            "• CARGA: Seleccione el Partido Político del buscador o ingrese manualmente en 'Otra Entidad'.",
            "• GPS OBLIGATORIO: Debe hacer DOBLE CLIC en el mapa para capturar las coordenadas exactas. Sin esto, el registro no podrá guardarse.",
            "• VALIDACIÓN: Use la lupa de búsqueda en el campo Cédula para traer datos oficiales del Padrón Electoral.",
            "• GUARDADO: Requiere adjuntar la foto del pedido físico firmado (Botón Cámara o Galería).",
            "• PDF: Una vez guardado, genere el PDF oficial para la firma del solicitante."
        ]);

        addSection("2. AGENDA Y ASIGNACIÓN", [
            "• FUNCIÓN: Visualice las actividades pendientes de su distrito.",
            "• ASIGNAR: Haga clic en 'ASIGNAR' para elegir un divulgador del directorio oficial.",
            "• CUMPLIMIENTO: Cuando una actividad tiene F02 y Anexo III, aparecerá una alerta verde por 2 minutos antes de archivarse automáticamente."
        ]);

        addSection("3. MOVIMIENTO DE MÁQUINAS (F01/F02)", [
            "• SALIDA (F01): Vincule la actividad, registre serie de MV y Pendrive. Marque los kits entregados.",
            "• DEVOLUCIÓN (F02): Verifique los LACRES. Si están VIOLENTADOS, el sistema exige una denuncia oficial.",
            "• REQUISITO: Es obligatorio subir la foto del formulario físico firmado en cada movimiento."
        ]);

        addSection("4. ANEXO III - INFORME INDIVIDUAL", [
            "• MARCACIONES: Use el tablero táctil de 104 celdas para registrar cada práctica ciudadana.",
            "• EVIDENCIAS: Suba hasta 5 fotos del evento en campo.",
            "• CIERRE: Adjunte la foto del Anexo III físico firmado por la jefatura."
        ]);

        doc.save("Manual-Jefe-CIDEE-2026.pdf");
        toast({ title: "Manual Descargado" });
    } catch (e) {
        toast({ variant: 'destructive', title: "Error al generar PDF" });
    } finally {
        setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Manual de Usuario" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight uppercase text-primary">Guía Operativa CIDEE</h1>
            <p className="text-muted-foreground text-sm font-medium flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Instrucciones detalladas para Jefes de Oficina y Funcionarios.
            </p>
          </div>
          <Button 
            className="font-black uppercase text-xs h-14 px-10 shadow-2xl bg-black hover:bg-black/90 gap-3 rounded-2xl"
            onClick={handleDownloadManual}
            disabled={isGeneratingPdf}
          >
            {isGeneratingPdf ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileDown className="h-6 w-6" />}
            DESCARGAR MANUAL PDF
          </Button>
        </div>

        <Tabs defaultValue="anexo-v" className="space-y-8">
          <TabsList className="flex flex-wrap w-full bg-white border shadow-sm h-auto p-1 rounded-2xl">
            <TabsTrigger value="anexo-v" className="flex-1 gap-2 font-black uppercase text-[10px] py-4 rounded-xl data-[state=active]:bg-black data-[state=active]:text-white">
              <ClipboardCheck className="h-3.5 w-3.5" /> Anexo V (Solicitud)
            </TabsTrigger>
            <TabsTrigger value="agenda" className="flex-1 gap-2 font-black uppercase text-[10px] py-4 rounded-xl data-[state=active]:bg-black data-[state=active]:text-white">
              <CalendarDays className="h-3.5 w-3.5" /> Agenda
            </TabsTrigger>
            <TabsTrigger value="movimientos" className="flex-1 gap-2 font-black uppercase text-[10px] py-4 rounded-xl data-[state=active]:bg-black data-[state=active]:text-white">
              <ArrowLeftRight className="h-3.5 w-3.5" /> F01 / F02
            </TabsTrigger>
            <TabsTrigger value="anexo-iii" className="flex-1 gap-2 font-black uppercase text-[10px] py-4 rounded-xl data-[state=active]:bg-black data-[state=active]:text-white">
              <UserCheck className="h-3.5 w-3.5" /> Anexo III
            </TabsTrigger>
            <TabsTrigger value="anexo-iv" className="flex-1 gap-2 font-black uppercase text-[10px] py-4 rounded-xl data-[state=active]:bg-black data-[state=active]:text-white">
              <TableProperties className="h-3.5 w-3.5" /> Anexo IV (Semanal)
            </TabsTrigger>
          </TabsList>

          {/* TAB: ANEXO V */}
          <TabsContent value="anexo-v" className="animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
                        <CardHeader className="bg-primary text-white p-8">
                            <CardTitle className="uppercase font-black text-xl flex items-center gap-3">
                                <PlusCircle className="h-6 w-6" /> Registro de Solicitud (Anexo V)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            <div className="space-y-4">
                                <h3 className="font-black uppercase text-sm text-primary border-l-4 border-primary pl-4">¿Cómo se carga?</h3>
                                <ul className="space-y-4">
                                    <li className="flex gap-4">
                                        <div className="h-6 w-6 rounded-full bg-black text-white flex items-center justify-center text-[10px] font-black shrink-0">1</div>
                                        <p className="text-xs font-medium leading-relaxed"><b>Selección de Entidad:</b> Use el buscador de partidos. Si es una comisión o club, use el campo "Otra Entidad". No deje ambos vacíos.</p>
                                    </li>
                                    <li className="flex gap-4">
                                        <div className="h-6 w-6 rounded-full bg-black text-white flex items-center justify-center text-[10px] font-black shrink-0">2</div>
                                        <p className="text-xs font-medium leading-relaxed"><b>Georreferenciación Crítica:</b> Busque la dirección en el mapa y haga <b>DOBLE CLIC</b> sobre el punto exacto. El sistema capturará las coordenadas GPS automáticamente.</p>
                                    </li>
                                    <li className="flex gap-4">
                                        <div className="h-6 w-6 rounded-full bg-black text-white flex items-center justify-center text-[10px] font-black shrink-0">3</div>
                                        <p className="text-xs font-medium leading-relaxed"><b>Búsqueda por Cédula:</b> Ingrese el número del solicitante y haga clic en la <b>Lupa (Buscador)</b>. Los datos se traerán directamente del Padrón Electoral para evitar errores.</p>
                                    </li>
                                </ul>
                            </div>

                            <div className="p-6 bg-amber-50 border-2 border-dashed border-amber-200 rounded-3xl space-y-3">
                                <div className="flex items-center gap-2 text-amber-700">
                                    <ShieldAlert className="h-5 w-5" />
                                    <span className="font-black uppercase text-xs">Campos Obligatorios</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <Badge variant="outline" className="bg-white border-amber-200 text-[8px] font-black uppercase">Entidad Solicitante</Badge>
                                    <Badge variant="outline" className="bg-white border-amber-200 text-[8px] font-black uppercase">Lugar / Local</Badge>
                                    <Badge variant="outline" className="bg-white border-amber-200 text-[8px] font-black uppercase">Coordenadas GPS</Badge>
                                    <Badge variant="outline" className="bg-white border-amber-200 text-[8px] font-black uppercase">Respaldo (Foto Anexo V)</Badge>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/30 border-t p-6">
                            <p className="text-[10px] font-black uppercase text-muted-foreground italic">Botón Negro: "GUARDAR Y AGENDAR ACTIVIDAD"</p>
                        </CardFooter>
                    </Card>
                </div>
                <div className="space-y-6">
                    <Card className="bg-black text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                        <div className="absolute -right-4 -top-4 opacity-10"><Camera className="h-32 w-32" /></div>
                        <h3 className="font-black uppercase text-xs mb-6 text-primary-foreground">Respaldo Visual</h3>
                        <p className="text-[11px] leading-relaxed font-medium uppercase opacity-80">
                            Es obligatorio capturar o subir la foto de la solicitud física firmada. Use el botón "Cámara en Vivo" para una captura directa o "Galería" si ya tiene el archivo.
                        </p>
                    </Card>
                </div>
            </div>
          </TabsContent>

          {/* TAB: AGENDA */}
          <TabsContent value="agenda" className="animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
                        <CardHeader className="bg-primary text-white p-8">
                            <CardTitle className="uppercase font-black text-xl flex items-center gap-3">
                                <CalendarDays className="h-6 w-6" /> Gestión de Agenda
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            <div className="space-y-4">
                                <h3 className="font-black uppercase text-sm text-primary border-l-4 border-primary pl-4">Operaciones de Jefatura</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-5 border-2 rounded-2xl bg-[#F8F9FA] space-y-2">
                                        <p className="font-black uppercase text-[10px] flex items-center gap-2">
                                            <Users className="h-4 w-4 text-blue-600" /> ASIGNAR PERSONAL
                                        </p>
                                        <p className="text-[10px] font-medium leading-relaxed uppercase">Haga clic en 'ASIGNAR' y seleccione un divulgador de su distrito. Esto autocompletará los informes futuros.</p>
                                    </div>
                                    <div className="p-5 border-2 rounded-2xl bg-[#F8F9FA] space-y-2">
                                        <p className="font-black uppercase text-[10px] flex items-center gap-2">
                                            <QrCode className="h-4 w-4 text-primary" /> CÓDIGO QR
                                        </p>
                                        <p className="text-[10px] font-medium leading-relaxed uppercase">Genere el QR para que los ciudadanos escaneen y completen la encuesta de satisfacción en el lugar.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 bg-green-50 border-4 border-dashed border-green-200 rounded-[2rem] space-y-4">
                                <div className="flex items-center gap-3 text-green-700">
                                    <CheckCircle2 className="h-6 w-6" />
                                    <span className="font-black uppercase text-sm">Actividades Cumplidas</span>
                                </div>
                                <p className="text-[11px] font-bold text-green-800 uppercase leading-relaxed">
                                    Cuando una actividad tiene la DEVOLUCIÓN DE MÁQUINA (F02) y el INFORME ANEXO III cargados, el sistema mostrará una alerta verde. El registro permanecerá visible 2 MINUTOS en la Agenda y luego se moverá automáticamente al módulo de HISTORIAL / ARCHIVO.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <div className="space-y-6">
                    <Card className="p-8 border-none shadow-xl bg-white rounded-[2.5rem]">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-destructive">
                                <AlertCircle className="h-5 w-5" />
                                <span className="font-black uppercase text-xs">Alertas de Vencimiento</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground font-bold leading-relaxed uppercase italic">
                                Si una actividad ya pasó de fecha y no tiene informe o devolución, el sistema la resaltará en rojo con un mensaje de advertencia sobre los documentos faltantes.
                            </p>
                        </div>
                    </Card>
                </div>
            </div>
          </TabsContent>

          {/* TAB: MOVIMIENTOS */}
          <TabsContent value="movimientos" className="animate-in fade-in duration-500">
            <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
                <CardHeader className="bg-primary text-white p-8">
                    <CardTitle className="uppercase font-black text-xl flex items-center gap-3">
                        <ArrowLeftRight className="h-6 w-6" /> Movimiento de Máquinas (F01 y F02)
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full border-2 border-black flex items-center justify-center font-black text-sm">A</div>
                                <h3 className="font-black uppercase text-sm">SALIDA DE EQUIPO (F01)</h3>
                            </div>
                            <ul className="space-y-3 text-[11px] font-medium uppercase">
                                <li className="flex gap-2"><b>• Vínculo:</b> Seleccione la actividad de la agenda.</li>
                                <li className="flex gap-2"><b>• Serie:</b> Elija la máquina desde el Inventario asignado.</li>
                                <li className="flex gap-2"><b>• Pendrive:</b> Escriba la serie del pendrive de divulgación.</li>
                                <li className="flex gap-2 text-primary"><b>• Respaldo:</b> Suba foto del F01 físico firmado por el Jefe.</li>
                            </ul>
                        </div>
                        <div className="space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full border-2 border-black flex items-center justify-center font-black text-sm">B</div>
                                <h3 className="font-black uppercase text-sm">DEVOLUCIÓN DE EQUIPO (F02)</h3>
                            </div>
                            <ul className="space-y-3 text-[11px] font-medium uppercase">
                                <li className="flex gap-2"><b>• Lacre:</b> Verifique visualmente el estado del lacre.</li>
                                <li className="flex gap-2 text-destructive"><b>• Alerta:</b> Si marca 'VIOLENTADO', el sistema bloquea el guardado y exige ir al módulo de Denuncia.</li>
                                <li className="flex gap-2 text-primary"><b>• Respaldo:</b> Suba foto del F02 físico firmado por el Jefe.</li>
                            </ul>
                        </div>
                    </div>

                    <div className="bg-black text-white p-10 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-8 shadow-2xl">
                        <ShieldAlert className="h-16 w-16 text-destructive shrink-0" />
                        <div className="space-y-3">
                            <p className="font-black uppercase text-sm text-destructive">Protocolo de Seguridad Nacional</p>
                            <p className="text-[10px] font-bold leading-relaxed uppercase opacity-80">
                                La manipulación de los lacres de seguridad es una falta grave. El sistema no permite cerrar el ciclo logístico sin un reporte de irregularidad si se detecta daño en los mismos.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: ANEXO III */}
          <TabsContent value="anexo-iii" className="animate-in fade-in duration-500">
            <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
                <CardHeader className="bg-primary text-white p-8">
                    <CardTitle className="uppercase font-black text-xl flex items-center gap-3">
                        <UserCheck className="h-6 w-6" /> Informe del Divulgador (Anexo III)
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="space-y-6">
                            <h3 className="font-black uppercase text-sm text-primary">Carga de Marcaciones</h3>
                            <p className="text-[11px] font-bold uppercase leading-relaxed text-muted-foreground">
                                El sistema presenta un tablero de <b>104 celdas</b>. Por cada ciudadano que practique con la máquina, el personal debe tocar una celda para marcarla con una "X". El total se calcula automáticamente.
                            </p>
                            <div className="flex items-center gap-4">
                                <div className="h-14 w-14 rounded-xl border-2 border-black flex items-center justify-center font-black text-xl bg-muted/30">X</div>
                                <span className="text-[9px] font-black uppercase tracking-widest">Ejemplo de marcación táctil</span>
                            </div>
                        </div>
                        <div className="space-y-6">
                            <h3 className="font-black uppercase text-sm text-primary">Respaldos de Productividad</h3>
                            <ul className="space-y-4 text-[11px] font-bold uppercase">
                                <li className="flex gap-3">
                                    <Camera className="h-5 w-5 text-primary opacity-40 shrink-0" />
                                    <span><b>Evidencia Campo:</b> Suba hasta 5 fotos de la capacitación ocurriendo en vivo.</span>
                                </li>
                                <li className="flex gap-3">
                                    <FileText className="h-5 w-5 text-destructive shrink-0" />
                                    <span><b>Anexo III Firmado:</b> Es OBLIGATORIO subir la foto del formulario físico con la firma y el sello de la oficina.</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="bg-muted/10 border-t p-6">
                    <Button variant="outline" className="font-black uppercase text-[10px] border-2 h-10 gap-2" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
                        <Printer className="h-4 w-4" /> GENERAR PDF PARA FIRMA FÍSICA
                    </Button>
                </CardFooter>
            </Card>
          </TabsContent>

          {/* TAB: ANEXO IV */}
          <TabsContent value="anexo-iv" className="animate-in fade-in duration-500">
            <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
                <CardHeader className="bg-primary text-white p-8">
                    <CardTitle className="uppercase font-black text-xl flex items-center gap-3">
                        <TableProperties className="h-6 w-6" /> Informe Semanal (Anexo IV)
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                    <div className="p-10 bg-muted/5 border-2 border-dashed rounded-[3rem] text-center space-y-6">
                        <Database className="h-16 w-16 text-primary mx-auto opacity-20" />
                        <h3 className="font-black uppercase text-lg">Inteligencia de Datos</h3>
                        <p className="text-xs font-bold text-muted-foreground uppercase leading-relaxed max-w-2xl mx-auto">
                            Este módulo ya no requiere carga manual de datos. Al seleccionar su distrito y el rango de fechas, el sistema **EXTRAE AUTOMÁTICAMENTE** todos los Anexos III registrados en la semana y los consolida en una tabla lista para impresión.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="p-6 border-2 rounded-2xl bg-white space-y-3">
                            <p className="font-black uppercase text-[10px] text-primary">PASO 1: FILTRAR</p>
                            <p className="text-[10px] font-medium uppercase leading-relaxed">Seleccione el rango de fechas (Desde el Lunes al Domingo) para capturar la producción de la semana.</p>
                        </div>
                        <div className="p-6 border-2 rounded-2xl bg-white space-y-3">
                            <p className="font-black uppercase text-[10px] text-primary">PASO 2: GUARDAR</p>
                            <p className="text-[10px] font-medium uppercase leading-relaxed">Haga clic en 'GUARDAR REPORTE' para archivar el consolidado en la nube institucional.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-12 text-center pb-12">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em] opacity-40">Justicia Electoral - República del Paraguay - 2026</p>
        </div>
      </main>
    </div>
  );
}
