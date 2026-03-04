
"use client";

import { useState, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  ExternalLink,
  CheckCircle2,
  Info,
  Settings2,
  HelpCircle,
  ShoppingCart,
  MessageCircle,
  LockKeyhole,
  ClipboardCheck,
  ArrowLeftRight,
  UserCheck,
  TableProperties,
  Download,
  Loader2,
  FileDown,
  Camera,
  Layers,
  Search,
  Database,
  Building2,
  Settings
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from '@/hooks/use-toast';

const cn = (...inputs: any[]) => inputs.filter(Boolean).join(' ');

const Separator = ({ className }: { className?: string }) => <div className={cn("h-px w-full bg-border", className)} />;

export default function DocumentacionPage() {
  const { toast } = useToast();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [logo1Base64, setLogo1Base64] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogos = async () => {
      try {
        const r1 = await fetch('/logo.png');
        const b1 = await r1.blob();
        const reader1 = new FileReader();
        reader1.onloadend = () => setLogoBase64(reader1.result as string);
        reader1.readAsDataURL(b1);

        const r2 = await fetch('/logo1.png');
        const b2 = await r2.blob();
        const reader2 = new FileReader();
        reader2.onloadend = () => setLogo1Base64(reader2.result as string);
        reader2.readAsDataURL(b2);
      } catch (error) {
        console.error("Error fetching logos for manual:", error);
      }
    };
    fetchLogos();
  }, []);

  const handleDownloadManual = async () => {
    if (!logoBase64 || !logo1Base64) {
        toast({ variant: 'destructive', title: "Error de recursos", description: "Cargando logos institucionales, intente de nuevo en un segundo." });
        return;
    }
    
    setIsGeneratingPdf(true);
    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        const maxWidth = pageWidth - (margin * 2);

        // Helper para renderizar párrafos con envoltorio de texto
        const renderWrappedText = (text: string | string[], x: number, y: number, fontSize = 9, fontStyle = 'normal') => {
            doc.setFont('helvetica', fontStyle);
            doc.setFontSize(fontSize);
            const lines = doc.splitTextToSize(text, maxWidth - (x - margin));
            doc.text(lines, x, y);
            return y + (lines.length * (fontSize * 0.5)) + 2;
        };

        const renderSectionTitle = (title: string, y: number) => {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text(title, margin, y);
            return y + 8;
        };

        const renderSubTitle = (title: string, y: number) => {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text(title, margin, y);
            return y + 6;
        };

        // --- PORTADA ---
        doc.addImage(logoBase64, 'PNG', margin, 20, 30, 30);
        doc.addImage(logo1Base64, 'PNG', pageWidth - margin - 35, 20, 35, 20);
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(24);
        doc.text("MANUAL DE USUARIO DETALLADO", pageWidth / 2, 100, { align: 'center' });
        doc.setFontSize(18);
        doc.text("SISTEMA DE GESTIÓN", pageWidth / 2, 115, { align: 'center' });
        doc.setFontSize(14);
        doc.text("JUSTICIA ELECTORAL", pageWidth / 2, 125, { align: 'center' });
        
        doc.setLineWidth(1);
        doc.line(margin, 140, pageWidth - margin, 140);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text("Dirección General del Registro Electoral", pageWidth / 2, 150, { align: 'center' });
        doc.text("Centro de Información, Documentación y Educación Electoral (CIDEE)", pageWidth / 2, 156, { align: 'center' });
        
        doc.text(`Versión: 2.5 (Estable)`, pageWidth / 2, 254, { align: 'center' });
        doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, pageWidth / 2, 260, { align: 'center' });
        doc.text("República del Paraguay", pageWidth / 2, 266, { align: 'center' });

        // --- PÁGINA 2: INTRODUCCIÓN Y CAPACITACIONES ---
        doc.addPage();
        let y = 30;
        y = renderSectionTitle("INTRODUCCIÓN AL SISTEMA", y);
        y = renderWrappedText("El Sistema de Gestión de la Justicia Electoral es una plataforma centralizada diseñada para optimizar los procesos de la Dirección General del Registro Electoral y el CIDEE. Este manual detalla los pasos obligatorios para garantizar la integridad de los datos, la trazabilidad logística y el cumplimiento de los informes semanales.", margin, y, 10);

        y += 10;
        y = renderSectionTitle("1. MÓDULO CIDEE - CAPACITACIONES", y);
        y = renderSubTitle("1.1 Anexo V - Solicitud de Capacitación", y);
        
        const anexoVSteps = [
            "• Selector de Partido: Use el buscador para elegir la organización. Si no existe, use 'Otra Entidad' para ingreso manual.",
            "• Georreferenciación CRÍTICA: Es obligatorio hacer DOBLE CLIC en el mapa sobre la ubicación exacta. Esto captura las coordenadas GPS necesarias para auditoría nacional.",
            "• Datos del Solicitante: Use la lupa de búsqueda para validar el número de cédula contra el Padrón Electoral Nacional. Esto garantiza la veracidad del solicitante.",
            "• Respaldo Documental: Capture la foto del pedido físico firmado antes de guardar el registro digital.",
            "• Generación PDF: Descargue la proforma oficial para que el solicitante firme el documento físico de respaldo en el lugar del evento."
        ];
        
        anexoVSteps.forEach(step => {
            y = renderWrappedText(step, margin + 5, y);
        });

        y += 5;
        y = renderSubTitle("1.2 Movimiento de Máquinas (F01 y F02)", y);
        const movSteps = [
            "• Salida (F01): Vincule la actividad de la agenda. Registre el Nro. de Serie de la MV y del Pendrive de capacitación.",
            "• Kits Técnicos: Marque la entrega de Auriculares, Credencial, Acrílico y las 5 Boletas de práctica.",
            "• Respaldo F01: Es obligatorio adjuntar la foto del formulario de salida firmado físicamente por el Jefe de Oficina.",
            "• Devolución (F02): Al reingreso, verifique el estado de los LACRES. Si están 'Violentados', el sistema bloquea el reingreso y exige una Denuncia Oficial inmediata.",
            "• Cierre de Ciclo: La actividad desaparece de la agenda pendiente una vez registrado el reingreso exitoso en el F02."
        ];
        movSteps.forEach(step => {
            y = renderWrappedText(step, margin + 5, y);
        });

        // --- PÁGINA 3: ANEXO III Y REGISTROS ---
        doc.addPage();
        y = 30;
        y = renderSubTitle("1.3 Anexo III - Informe Individual de Productividad", y);
        const anexoIIISteps = [
            "• Vínculo con Agenda: Al seleccionar la actividad, se completan automáticamente los datos del divulgador asignado.",
            "• Tablero Táctil: Marque una 'X' por cada ciudadano que realice la práctica. El sistema admite hasta 104 marcaciones por informe.",
            "• Evidencias del Evento: Suba hasta 5 fotografías de la actividad en campo para validación visual.",
            "• Respaldo Documental: Es obligatorio adjuntar la foto del Anexo III físico firmado y sellado por la Jefatura."
        ];
        anexoIIISteps.forEach(step => {
            y = renderWrappedText(step, margin + 5, y);
        });

        y += 10;
        y = renderSectionTitle("2. MÓDULO REGISTROS ELECTORALES (EDILICIO)", y);
        y = renderSubTitle("2.1 Ficha Técnica y Relevamiento", y);
        const fichaSteps = [
            "• Datos Estructurales: Se debe informar el estado físico, cantidad de habitaciones y dimensiones exactas de la Habitación Segura para el resguardo.",
            "• Resguardo de Equipos: Indique el lugar exacto donde se guardan las Máquinas de Votación (debe coincidir con la foto #5 de la galería).",
            "• Galería de 8 Fotos Obligatorias: Se deben cargar las 8 fotos reglamentarias del protocolo institucional para que el informe sea válido."
        ];
        fichaSteps.forEach(step => {
            y = renderWrappedText(step, margin + 5, y);
        });

        y += 5;
        y = renderSubTitle("2.2 Informe Semanal Operativo (Registro)", y);
        const infRegSteps = [
            "• Trámites Cuantitativos: Ingrese la cantidad de Inscripciones 1ra Vez, Actualizaciones y Traslados realizados durante la semana.",
            "• Organizaciones Asistidas: Detalle el Tipo (Comisión, Cooperativa, etc.) y el Nombre de cada entidad asistida fuera del cronograma electoral.",
            "• Monitor de Cumplimiento: La Dirección Nacional supervisa en tiempo real qué distritos han enviado su reporte dentro del periodo configurado."
        ];
        infRegSteps.forEach(step => {
            y = renderWrappedText(step, margin + 5, y);
        });

        // --- PÁGINA 4: ADMINISTRACIÓN ---
        doc.addPage();
        y = 30;
        y = renderSectionTitle("3. SEGURIDAD Y ADMINISTRACIÓN DEL SISTEMA", y);
        y = renderSubTitle("3.1 Gestión de Usuarios y Matriz de Permisos", y);
        const userSteps = [
            "• Roles Institucionales: Se definen perfiles como Admin, Director, Jefe de Oficina, Funcionario y Viewer.",
            "• Filtros Territoriales: El sistema aplica automáticamente restricciones por Departamento o Distrito según el perfil configurado.",
            "• Monitoreo de Conexiones: Visualización en tiempo real de usuarios activos y su ubicación dentro de los módulos del sistema."
        ];
        userSteps.forEach(step => {
            y = renderWrappedText(step, margin + 5, y);
        });

        y += 10;
        y = renderSubTitle("3.2 Auditoría Técnica (Bitácora)", y);
        const auditSteps = [
            "• Trazabilidad Total: Cada creación, edición o borrado de datos queda registrado con Usuario, Fecha, Hora e IP de conexión.",
            "• Integridad de Datos: El sistema previene el borrado accidental mediante diálogos de confirmación obligatorios para registros críticos."
        ];
        auditSteps.forEach(step => {
            y = renderWrappedText(step, margin + 5, y);
        });

        // Pie de página en todas las páginas
        const pageCount = doc.internal.pages.length - 1;
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'italic');
            doc.text(`Manual de Usuario - Sistema de Gestión - Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        }

        doc.save("Manual-Usuario-Detallado-V2.5.pdf");
        toast({ title: "Manual Generado", description: "El documento detallado se ha descargado correctamente con ajuste de texto." });
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Error al generar manual" });
    } finally {
        setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted/5">
      <Header title="Documentación Detallada" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight uppercase text-primary">Base de Conocimiento</h1>
            <p className="text-muted-foreground text-sm font-medium flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Guía técnica, operativa y de seguridad del Sistema de Gestión.
            </p>
          </div>
          <Button 
            className="font-black uppercase text-xs h-14 px-10 shadow-2xl bg-black hover:bg-black/90 gap-3 rounded-2xl transition-all hover:scale-105"
            onClick={handleDownloadManual}
            disabled={isGeneratingPdf}
          >
            {isGeneratingPdf ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileDown className="h-6 w-6" />}
            DESCARGAR MANUAL DETALLADO PDF
          </Button>
        </div>

        <Tabs defaultValue="flujo-capacitacion" className="space-y-8">
          <TabsList className="flex flex-wrap w-full bg-white border shadow-sm h-auto p-1 rounded-xl">
            <TabsTrigger value="flujo-capacitacion" className="flex-1 gap-2 font-black uppercase text-[10px] py-3 rounded-lg">
              <Layers className="h-3.5 w-3.5" /> Flujo CIDEE
            </TabsTrigger>
            <TabsTrigger value="registros" className="flex-1 gap-2 font-black uppercase text-[10px] py-3 rounded-lg">
              <Building2 className="h-3.5 w-3.5" /> Registros
            </TabsTrigger>
            <TabsTrigger value="correo" className="flex-1 gap-2 font-black uppercase text-[10px] py-3 rounded-lg">
              <Mail className="h-3.5 w-3.5" /> Autenticación
            </TabsTrigger>
            <TabsTrigger value="roles" className="flex-1 gap-2 font-black uppercase text-[10px] py-3 rounded-lg">
              <Users className="h-3.5 w-3.5" /> Seguridad
            </TabsTrigger>
            <TabsTrigger value="tecnico" className="flex-1 gap-2 font-black uppercase text-[10px] py-3 rounded-lg">
              <Cpu className="h-3.5 w-3.5" /> Soporte Técnico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="flujo-capacitacion" className="animate-in fade-in duration-500 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 space-y-6">
                <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden">
                  <CardHeader className="bg-primary text-white p-8">
                    <CardTitle className="uppercase font-black text-xl flex items-center gap-3">
                      <ClipboardCheck className="h-6 w-6" /> Proceso de Capacitaciones
                    </CardTitle>
                    <CardDescription className="text-white/60 text-[10px] font-bold uppercase tracking-widest">
                      Guía paso a paso desde la recepción hasta la rendición.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-8 bg-white">
                    <Accordion type="single" collapsible className="w-full space-y-4">
                      
                      <AccordionItem value="anexo-v" className="border-2 rounded-[1.5rem] px-6 bg-white overflow-hidden transition-all hover:border-primary/20">
                        <AccordionTrigger className="hover:no-underline py-6">
                          <div className="flex items-center gap-4 text-left">
                            <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary font-black text-lg">1</div>
                            <div>
                              <p className="font-black uppercase text-sm">Registro de Solicitud (Anexo V)</p>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">Captura de datos y georreferenciación obligatoria</p>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-8 space-y-6">
                          <div className="p-5 bg-muted/30 rounded-2xl space-y-4">
                            <p className="text-[11px] font-black uppercase text-primary">CAMPOS A COMPLETAR:</p>
                            <ul className="space-y-3">
                                <li className="flex gap-3 text-xs font-medium">
                                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                    <span><b>Entidad Solicitante:</b> Seleccione el Partido Político del buscador oficial o ingrese el nombre manualmente.</span>
                                </li>
                                <li className="flex gap-3 text-xs font-medium">
                                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                                    <span><b>Mapa GPS:</b> Es MANDATORIO hacer doble clic en el mapa. Esto vincula la ubicación exacta del evento para auditoría nacional.</span>
                                </li>
                                <li className="flex gap-3 text-xs font-medium">
                                    <Search className="h-4 w-4 text-blue-600 shrink-0" />
                                    <span><b>Cédula:</b> Use el botón de búsqueda para validar los datos del apoderado contra el Padrón Nacional.</span>
                                </li>
                                <li className="flex gap-3 text-xs font-medium">
                                    <Camera className="h-4 w-4 text-amber-600 shrink-0" />
                                    <span><b>Respaldo:</b> Capture la foto del pedido físico firmado por la organización política.</span>
                                </li>
                            </ul>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="logistica" className="border-2 rounded-[1.5rem] px-6 bg-white overflow-hidden transition-all hover:border-primary/20">
                        <AccordionTrigger className="hover:no-underline py-6">
                          <div className="flex items-center gap-4 text-left">
                            <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary font-black text-lg">2</div>
                            <div>
                              <p className="font-black uppercase text-sm">Control Logística (F01 / F02)</p>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">Movimiento de Máquinas de Votación</p>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-8 space-y-6">
                          <div className="p-5 bg-muted/30 rounded-2xl space-y-4">
                            <p className="text-[11px] font-black uppercase text-primary">PASOS PARA LA SALIDA (F01):</p>
                            <ul className="space-y-2 text-xs font-medium">
                                <li>1. Registre el <b>Nro. de Serie</b> de la Máquina de Votación.</li>
                                <li>2. Ingrese el <b>Nro. de Serie del Pendrive</b> de capacitación.</li>
                                <li>3. Verifique la entrega de: Credencial, Auricular, Acrílico y 5 Boletas.</li>
                                <li>4. Adjunte foto del F01 físico firmado por el Jefe.</li>
                            </ul>
                            <Separator />
                            <p className="text-[11px] font-black uppercase text-destructive">PROTOCOLO DE DEVOLUCIÓN (F02):</p>
                            <p className="text-xs font-medium leading-relaxed italic">
                                Al retornar, el sistema exige verificar los <b>LACRES DE SEGURIDAD</b>. Si el lacre fue violentado, el sistema bloquea el reingreso y genera una alerta automática que obliga a registrar la denuncia con evidencia fotográfica.
                            </p>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="productividad" className="border-2 rounded-[1.5rem] px-6 bg-white overflow-hidden transition-all hover:border-primary/20">
                        <AccordionTrigger className="hover:no-underline py-6">
                          <div className="flex items-center gap-4 text-left">
                            <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary font-black text-lg">3</div>
                            <div>
                              <p className="font-black uppercase text-sm">Informe de Productividad (Anexo III)</p>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">Carga de marcaciones individuales por ciudadano</p>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-8 space-y-6">
                          <div className="p-5 bg-muted/30 rounded-2xl space-y-4">
                            <p className="text-[11px] font-black uppercase text-primary">USO DEL TABLERO TÁCTIL:</p>
                            <p className="text-xs font-medium leading-relaxed">
                                El sistema presenta un tablero de 104 celdas. Por cada ciudadano que practique con la máquina, el divulgador debe tocar una celda para marcarla con una "X".
                            </p>
                            <p className="text-[11px] font-black uppercase text-primary">EVIDENCIAS FOTOGRÁFICAS:</p>
                            <p className="text-xs font-medium leading-relaxed">
                                Se deben subir fotografías que demuestren la ejecución de la actividad. Además, es <b>OBLIGATORIO</b> adjuntar la foto del Anexo III físico firmado y sellado por la jefatura del Registro Electoral.
                            </p>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                    </Accordion>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-4 space-y-6">
                <Card className="bg-black text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 opacity-10">
                    <ShieldCheck className="h-32 w-32" />
                  </div>
                  <h3 className="font-black uppercase text-xs mb-6 flex items-center gap-2 text-primary-foreground">
                    <AlertCircle className="h-4 w-4" /> REGLAS CRÍTICAS
                  </h3>
                  <div className="space-y-6">
                    <div>
                        <p className="text-[10px] font-black uppercase text-primary leading-none mb-2">GEORREFERENCIACIÓN</p>
                        <p className="text-[11px] leading-relaxed opacity-80 font-medium uppercase">
                            Todo registro sin coordenadas GPS capturadas mediante doble clic será invalidado por la Dirección Nacional.
                        </p>
                    </div>
                    <Separator className="bg-white/20" />
                    <div>
                        <p className="text-[10px] font-black uppercase text-primary leading-none mb-2">RESPALDOS FÍSICOS</p>
                        <p className="text-[11px] leading-relaxed opacity-80 font-medium uppercase">
                            Las fotografías de los formularios firmados (Anexo V, F01, F02, Anexo III) son requerimientos obligatorios de carga.
                        </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-8 border-none shadow-xl bg-white rounded-[2.5rem]">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Info className="h-5 w-5 text-primary" />
                            <span className="font-black uppercase text-xs">Asistencia Ciudadana</span>
                        </div>
                        <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                            En cada capacitación, invite a los ciudadanos a escanear el <b>CÓDIGO QR</b> de encuesta generado en la agenda. Esto alimenta automáticamente el tablero de estadísticas del CIDEE.
                        </p>
                    </div>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="registros" className="animate-in fade-in duration-500 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
                    <CardHeader className="bg-muted/10 p-8 border-b">
                        <CardTitle className="uppercase font-black text-lg flex items-center gap-2">
                            <Layers className="h-5 w-5 text-primary" /> Ficha Edilicia Técnica
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                            Este módulo documenta la infraestructura física de cada oficina del Registro Electoral. Es fundamental para la planificación de seguridad.
                        </p>
                        <div className="space-y-4">
                            <p className="text-[10px] font-black uppercase text-primary">DATOS OBLIGATORIOS:</p>
                            <ul className="text-xs font-medium space-y-2">
                                <li>• Dimensiones exactas de la habitación segura.</li>
                                <li>• Tipo de cerramiento y techo de la zona de resguardo.</li>
                                <li>• Cantidad de máquinas de votación en stock permanente.</li>
                                <li>• Descripción general de la situación edilicia.</li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
                    <CardHeader className="bg-muted/10 p-8 border-b">
                        <CardTitle className="uppercase font-black text-lg flex items-center gap-2">
                            <Camera className="h-5 w-5 text-primary" /> Galería Obligatoria
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                            Cada registro debe contener exactamente las 8 fotos reglamentarias del protocolo institucional.
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                            <Badge variant="outline" className="text-[8px] font-black uppercase p-2 border-primary/10">1. FRENTE DEL REGISTRO</Badge>
                            <Badge variant="outline" className="text-[8px] font-black uppercase p-2 border-primary/10">2. COSTADO DERECHO</Badge>
                            <Badge variant="outline" className="text-[8px] font-black uppercase p-2 border-primary/10">3. COSTADO IZQUIERDO</Badge>
                            <Badge variant="outline" className="text-[8px] font-black uppercase p-2 border-primary/10">4. FONDO DEL LOCAL</Badge>
                            <Badge variant="outline" className="text-[8px] font-black uppercase p-2 border-primary/10">5. HAB. SEGURA (INTERIOR)</Badge>
                            <Badge variant="outline" className="text-[8px] font-black uppercase p-2 border-primary/10">6. HAB. SEGURA (TECHO)</Badge>
                            <Badge variant="outline" className="text-[8px] font-black uppercase p-2 border-primary/10">7. OTRAS HABITACIONES</Badge>
                            <Badge variant="outline" className="text-[8px] font-black uppercase p-2 border-primary/10">8. FORMULARIO FIRMADO</Badge>
                        </div>
                    </CardContent>
                </Card>
            </div>
          </TabsContent>

          <TabsContent value="correo" className="animate-in fade-in duration-500 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 space-y-6">
                <Card className="border-t-4 border-t-blue-600 shadow-lg bg-white rounded-3xl overflow-hidden">
                  <CardHeader className="bg-blue-50/50 p-8">
                    <CardTitle className="uppercase font-black text-lg flex items-center gap-2 text-blue-700">
                      <LockKeyhole className="h-5 w-5" /> Autenticación y Recuperación
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase">
                      Procedimientos para el acceso seguro al sistema.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8 p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-6 border-2 border-dashed rounded-[2rem] bg-white space-y-3 shadow-sm">
                            <div className="flex items-center gap-2">
                                <MessageCircle className="h-5 w-5 text-green-600" />
                                <span className="font-black uppercase text-xs">Vía WhatsApp Soporte</span>
                            </div>
                            <p className="text-[10px] font-medium text-muted-foreground leading-relaxed uppercase">
                                Use el botón de <b>"Soporte WhatsApp"</b> en el Login. El administrador nacional puede verificar su identidad y resetear su cuenta manualmente.
                            </p>
                        </div>
                        <div className="p-6 border-2 border-dashed rounded-[2rem] bg-white space-y-3 shadow-sm">
                            <div className="flex items-center gap-2">
                                <ShieldAlert className="h-5 w-5 text-amber-600" />
                                <span className="font-black uppercase text-xs">Reseteo por Correo</span>
                            </div>
                            <p className="text-[10px] font-medium text-muted-foreground leading-relaxed uppercase">
                                Si no recibe el correo, verifique siempre la carpeta <b>SPAM</b>. El remitente oficial es el motor de seguridad de Google Cloud.
                            </p>
                        </div>
                    </div>
                    <Separator />
                    <div className="bg-amber-50 border border-amber-200 p-6 rounded-[2rem] space-y-4">
                        <h3 className="font-black uppercase text-xs flex items-center gap-2 text-amber-800">
                            <Settings2 className="h-4 w-4" /> Recomendación de Infraestructura
                        </h3>
                        <p className="text-[11px] text-amber-900 font-medium leading-relaxed uppercase">
                            Para evitar problemas de SPAM definitivamente, la Dirección de Informática debe configurar un <b>Relay SMTP</b> institucional o un <b>Subdominio Validado</b> para el sistema.
                        </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="lg:col-span-4">
                <Card className="bg-black text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 opacity-10">
                    <Globe className="h-32 w-32" />
                  </div>
                  <h3 className="font-black uppercase text-xs mb-6 flex items-center gap-2 text-amber-400">
                    <ShieldCheck className="h-4 w-4" /> Acceso Restringido
                  </h3>
                  <p className="text-xs leading-relaxed opacity-80 mb-6 font-bold uppercase">
                    El sistema detecta automáticamente la ubicación del usuario. Los intentos de acceso desde IPs no autorizadas quedan registrados en la bitácora de auditoría nacional.
                  </p>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="roles" className="animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
                  <CardHeader className="bg-primary text-white p-8">
                    <CardTitle className="uppercase font-black text-lg">Jerarquía Institucional de Usuarios</CardTitle>
                    <CardDescription className="text-white/60 text-[10px] font-bold uppercase">Niveles de acceso y capacidades operativas.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Accordion type="single" collapsible className="w-full">
                      {[
                        { 
                          rol: "Administrador Nacional", 
                          desc: "Control total del sistema, gestión de la estructura geográfica, importaciones masivas y control de seguridad nacional.", 
                          acceso: "Acceso Total (Global)",
                          icon: ShieldCheck,
                          color: "text-red-600"
                        },
                        { 
                          rol: "Director / Coordinador", 
                          desc: "Supervisión de estadísticas nacionales, descarga de informes generales PDF y monitoreo de cumplimiento regional.", 
                          acceso: "Nacional (Lectura / Auditoría)",
                          icon: Globe,
                          color: "text-blue-600"
                        },
                        { 
                          rol: "Jefe de Oficina Distrital", 
                          desc: "Gestión de agenda, asignación de divulgadores, validación administrativa de Anexos III y firma del Consolidado Semanal.", 
                          acceso: "Regional (Gestión / Validación)",
                          icon: Landmark,
                          color: "text-amber-600"
                        },
                        { 
                          rol: "Funcionario Operativo", 
                          desc: "Carga de solicitudes (Anexo V), informes de productividad (Anexo III), movimientos logísticos y ficha edilicia.", 
                          acceso: "Local (Operativo / Carga)",
                          icon: Navigation,
                          color: "text-green-600"
                        }
                      ].map((item, i) => (
                        <AccordionItem key={i} value={`item-${i}`} className="border-b px-8 py-2 last:border-0 hover:bg-muted/5 transition-colors">
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-4">
                              <div className={cn("h-10 w-10 rounded-xl bg-muted flex items-center justify-center", item.color.replace('text', 'bg').replace('600', '100'))}>
                                <item.icon className={cn("h-5 w-5", item.color)} />
                              </div>
                              <span className="font-black uppercase text-sm tracking-tight">{item.rol}</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-6">
                            <div className="space-y-4 pt-2 border-l-2 border-muted pl-6 ml-5">
                              <p className="text-xs font-medium text-muted-foreground leading-relaxed uppercase">{item.desc}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest:">Nivel de Seguridad:</span>
                                <Badge variant="secondary" className="text-[9px] font-black uppercase bg-primary/5 text-primary border-none px-3">
                                  {item.acceso}
                                </Badge>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-6">
                <Card className="bg-primary text-white shadow-2xl border-none overflow-hidden rounded-[2.5rem]">
                  <CardHeader className="p-8">
                    <CardTitle className="uppercase font-black text-sm tracking-widest flex items-center gap-2">
                        <ShieldAlert className="h-5 w-5 text-amber-400" /> Auditoría Centralizada
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 pt-0 space-y-6">
                    <div className="flex items-center gap-3">
                      <Database className="h-8 w-8 text-green-400" />
                      <div>
                        <p className="text-[10px] font-black uppercase opacity-70">Firestore Security Rules</p>
                        <p className="text-sm font-black uppercase">Blindaje Activo</p>
                      </div>
                    </div>
                    <Separator className="bg-white/20" />
                    <p className="text-[10px] leading-relaxed font-bold opacity-80 uppercase italic">
                      Cada acción (CREAR, EDITAR, BORRAR) es validada en el servidor contra la matriz de permisos. Cualquier intento de vulneración queda registrado con la IP y el Usuario en la bitácora de seguridad.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tecnico" className="animate-in fade-in duration-500 space-y-8">
            <Card className="shadow-2xl border-none rounded-[2.5rem] overflow-hidden bg-white">
              <CardHeader className="bg-muted/10 p-8 border-b">
                <CardTitle className="uppercase font-black text-xl flex items-center gap-3">
                    <Settings className="h-6 w-6" /> Arquitectura del Sistema
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase">Tecnología de última generación al servicio de la democracia.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y-2 divide-muted/30">
                  {[
                    { label: "Core de Desarrollo", value: "Next.js 14 + React 18", desc: "Motor de alto rendimiento con carga optimizada para conexiones móviles inestables." },
                    { label: "Persistencia de Datos", value: "Firebase Firestore NoSQL", desc: "Base de datos en tiempo real con capacidad offline para trabajo de campo." },
                    { label: "Motor de Reportes", value: "jsPDF + AutoTable + html2canvas", desc: "Generación dinámica de proformas institucionales sin necesidad de servidores externos." },
                    { label: "Geolocalización", value: "Leaflet + OpenStreetMap", desc: "Cartografía interactiva para auditoría de eventos sin dependencia de licencias pagas." },
                    { label: "Interfaz de Usuario", value: "Tailwind CSS + ShadCN UI", desc: "Diseño institucional, limpio y totalmente responsivo (Mobile-First)." }
                  ].map((tech, i) => (
                    <div key={i} className="p-8 flex flex-col md:flex-row md:items-center gap-6 hover:bg-muted/5 transition-colors">
                      <div className="md:w-1/3">
                        <p className="text-[10px] font-black uppercase text-primary mb-1 tracking-widest">{tech.label}</p>
                        <p className="font-black text-sm uppercase">{tech.value}</p>
                      </div>
                      <div className="md:w-2/3 border-l-2 border-muted pl-6">
                        <p className="text-xs text-muted-foreground font-medium leading-relaxed">{tech.desc}</p>
                      </div>
                    </div>
                  ))}
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
