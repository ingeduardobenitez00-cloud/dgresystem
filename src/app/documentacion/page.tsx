
"use client";

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
  HelpCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const cn = (...inputs: any[]) => inputs.filter(Boolean).join(' ');

const Separator = ({ className }: { className?: string }) => <div className={cn("h-px w-full bg-border", className)} />;

export default function DocumentacionPage() {
  return (
    <div className="flex min-h-screen flex-col bg-muted/5">
      <Header title="Documentación del Sistema" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight uppercase text-primary">Documentación Institucional</h1>
          <p className="text-muted-foreground text-sm font-medium flex items-center gap-2 mt-1">
            < BookOpen className="h-4 w-4" />
            Guía técnica y operativa del Sistema de Gestión Integral CIDEE.
          </p>
        </div>

        <Tabs defaultValue="correo" className="space-y-8">
          <TabsList className="grid w-full grid-cols-1 md:grid-cols-4 lg:w-[800px] bg-white border shadow-sm h-auto p-1">
            <TabsTrigger value="correo" className="gap-2 font-black uppercase text-[10px] py-2">
              <Mail className="h-3.5 w-3.5" /> Autenticación de Correo
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-2 font-black uppercase text-[10px] py-2">
              <Users className="h-3.5 w-3.5" /> Roles y Permisos
            </TabsTrigger>
            <TabsTrigger value="cidee" className="gap-2 font-black uppercase text-[10px] py-2">
              <FileText className="h-3.5 w-3.5" /> Módulo CIDEE
            </TabsTrigger>
            <TabsTrigger value="tecnico" className="gap-2 font-black uppercase text-[10px] py-2">
              <Cpu className="h-3.5 w-3.5" /> Arquitectura
            </TabsTrigger>
          </TabsList>

          <TabsContent value="correo" className="animate-in fade-in duration-500 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 space-y-6">
                <Card className="border-t-4 border-t-[#EA4335] shadow-lg">
                  <CardHeader className="bg-muted/5">
                    <CardTitle className="uppercase font-black text-lg flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-[#EA4335]" /> Configuración para evitar el SPAM
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase">
                      Guía para que los correos de reseteo de contraseña lleguen a la bandeja de entrada.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8 pt-6">
                    
                    <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-6">
                        <div className="flex gap-3">
                            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                            <p className="text-xs text-amber-800 font-bold uppercase leading-tight">
                                Sin una firma digital válida (DKIM), Gmail marcará los correos automáticos como sospechosos. Aquí tienes dos caminos a seguir:
                            </p>
                        </div>
                    </div>

                    <Accordion type="single" collapsible className="w-full space-y-4">
                        <AccordionItem value="con-dominio" className="border rounded-xl px-4 bg-white">
                            <AccordionTrigger className="hover:no-underline">
                                <div className="flex items-center gap-3">
                                    <Globe className="h-5 w-5 text-blue-600" />
                                    <span className="font-black uppercase text-sm">Opción A: Tengo un dominio propio</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-4 pb-6">
                                <p className="text-xs text-muted-foreground">Esta es la solución definitiva. Sigue estos pasos en la Consola de Firebase:</p>
                                <div className="space-y-3 pl-4">
                                    <div className="flex items-start gap-2">
                                        <Badge className="bg-black text-[8px] h-5 w-5 rounded-full p-0 flex items-center justify-center shrink-0">1</Badge>
                                        <p className="text-xs">Ve a <b>Authentication > Templates</b> y edita "Password Reset".</p>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <Badge className="bg-black text-[8px] h-5 w-5 rounded-full p-0 flex items-center justify-center shrink-0">2</Badge>
                                        <p className="text-xs">Haz clic en <b>"Personalizar dominio"</b> e ingresa tu URL (ej. tsje.gov.py).</p>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <Badge className="bg-black text-[8px] h-5 w-5 rounded-full p-0 flex items-center justify-center shrink-0">3</Badge>
                                        <p className="text-xs">Copia los registros <b>TXT</b> y <b>CNAME</b> que te entregue Firebase y pégalos en tu panel de control de DNS.</p>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="sin-dominio" className="border rounded-xl px-4 bg-white">
                            <AccordionTrigger className="hover:no-underline">
                                <div className="flex items-center gap-3">
                                    <HelpCircle className="h-5 w-5 text-amber-600" />
                                    <span className="font-black uppercase text-sm">Opción B: No tengo dominio propio</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-4 pb-6">
                                <p className="text-xs text-muted-foreground">Si no puedes adquirir un dominio, aplica estas estrategias para mejorar la entrega:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Card className="p-4 border-dashed border-2 bg-muted/10">
                                        <p className="text-[10px] font-black uppercase text-primary mb-2">Entrenamiento de Filtros</p>
                                        <p className="text-[11px] leading-tight text-muted-foreground italic">
                                            Indica a los funcionarios que la primera vez deben buscar el correo en "Spam" y marcarlo como <b>"No es Spam"</b>. Esto le dice a Google que el remitente es de confianza.
                                        </p>
                                    </Card>
                                    <Card className="p-4 border-dashed border-2 bg-muted/10">
                                        <p className="text-[10px] font-black uppercase text-primary mb-2">Nombre Institucional</p>
                                        <p className="text-[11px] leading-tight text-muted-foreground italic">
                                            Como ya has configurado el nombre "Dirección General del Registro Electoral", esto ayuda a que los filtros de contenido no sean tan agresivos.
                                        </p>
                                    </Card>
                                </div>
                                <div className="bg-blue-50 p-4 rounded-xl flex items-start gap-3 mt-4 border border-blue-100">
                                    <Info className="h-5 w-5 text-blue-600 shrink-0" />
                                    <p className="text-[11px] text-blue-800 font-bold uppercase leading-tight">
                                        NOTA: Firebase NO permite usar una cuenta @gmail.com personal como remitente oficial para evitar "Spoofing" (suplantación de identidad).
                                    </p>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>

                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-4 space-y-6">
                <Card className="bg-black text-white p-8 rounded-[2rem] shadow-2xl relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 opacity-10">
                    <Settings2 className="h-32 w-32" />
                  </div>
                  <h3 className="font-black uppercase text-xs mb-6 flex items-center gap-2 text-amber-400">
                    <ShieldAlert className="h-4 w-4" /> Importancia Técnica
                  </h3>
                  <p className="text-xs leading-relaxed opacity-80 mb-6 font-bold uppercase">
                    Los correos que salen desde subdominios genéricos de Google (`.firebaseapp.com`) son los blancos más fáciles para los filtros de spam automáticos. Autenticar un dominio propio es la única forma de garantizar un 100% de éxito en la entrega.
                  </p>
                  <Separator className="bg-white/20 mb-6" />
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">BENEFICIOS DEL DOMINIO:</p>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> Firma Digital DKIM válida
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> Reputación de remitente alta
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> Imagen 100% Institucional
                        </div>
                    </div>
                  </div>
                </Card>

                <Card className="p-6 border-2 border-dashed flex flex-col items-center text-center gap-4">
                    <ExternalLink className="h-8 w-8 text-muted-foreground opacity-20" />
                    <p className="text-[10px] font-black uppercase text-muted-foreground">Manual de Firebase</p>
                    <Button variant="outline" className="w-full font-black uppercase text-[10px]" asChild>
                        <a href="https://firebase.google.com/docs/auth/admin/email-settings" target="_blank" rel="noopener noreferrer">Ver Documentación Oficial</a>
                    </Button>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="roles" className="animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <Card className="border-t-4 border-t-primary shadow-lg">
                  <CardHeader>
                    <CardTitle className="uppercase font-black text-lg">Jerarquía de Usuarios</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase">Definición de accesos según el cargo institucional.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Accordion type="single" collapsible className="w-full">
                      {[
                        { 
                          rol: "Administrador", 
                          desc: "Control total del sistema y seguridad.", 
                          acceso: "Total (Global)",
                          icon: ShieldCheck,
                          color: "text-red-600"
                        },
                        { 
                          rol: "Director", 
                          desc: "Supervisión nacional de reportes y estadísticas.", 
                          acceso: "Nacional (Lectura/PDF)",
                          icon: Globe,
                          color: "text-blue-600"
                        },
                        { 
                          rol: "Jefe de Oficina", 
                          desc: "Gestión de agenda, asignación de personal y validación de informes.", 
                          acceso: "Regional (Gestión)",
                          icon: Landmark,
                          color: "text-amber-600"
                        },
                        { 
                          rol: "Funcionario / Divulgador", 
                          desc: "Carga de datos operativos, ejecución de campo y reportes edilicios.", 
                          acceso: "Local (Operativo)",
                          icon: Navigation,
                          color: "text-green-600"
                        }
                      ].map((item, i) => (
                        <AccordionItem key={i} value={`item-${i}`} className="border-b px-6">
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-3">
                              <item.icon className={cn("h-5 w-5", item.color)} />
                              <span className="font-black uppercase text-sm">{item.rol}</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-6">
                            <div className="space-y-4 pt-2">
                              <p className="text-xs font-medium text-muted-foreground">{item.desc}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black uppercase text-muted-foreground">Nivel de Acceso:</span>
                                <Badge variant="secondary" className="text-[9px] font-black uppercase bg-primary/5 text-primary border-none">
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

                <Card className="border-t-4 border-t-primary shadow-lg">
                  <CardHeader>
                    <CardTitle className="uppercase font-black text-lg">Jerarquía de Filtros Territoriales</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase">Lógica de visibilidad de datos implementada.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {[
                      { 
                        title: "Filtro Nacional (admin_filter)", 
                        desc: "Permite visualizar datos de todos los departamentos y distritos del país simultáneamente. Ignora las restricciones geográficas del perfil.",
                        icon: Globe
                      },
                      { 
                        title: "Filtro Departamental (department_filter)", 
                        desc: "Limita la visibilidad a todos los distritos pertenecientes al departamento asignado en el perfil del usuario.",
                        icon: Landmark
                      },
                      { 
                        title: "Filtro Distrital (district_filter)", 
                        desc: "Restricción máxima. El usuario solo visualiza y gestiona información de su oficina local específica.",
                        icon: MapPin
                      }
                    ].map((f, i) => (
                      <div key={i} className="flex gap-4 p-4 rounded-xl bg-muted/30 border border-dashed">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <f.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-black uppercase text-xs text-primary mb-1">{f.title}</h4>
                          <p className="text-[11px] font-medium text-muted-foreground leading-relaxed">{f.desc}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="bg-primary text-white shadow-xl border-none overflow-hidden">
                  <CardHeader>
                    <CardTitle className="uppercase font-black text-sm">Estado de Seguridad</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="h-8 w-8 text-green-400" />
                      <div>
                        <p className="text-[10px] font-black uppercase opacity-70">Firestore Rules</p>
                        <p className="text-sm font-black uppercase">Protección Activa</p>
                      </div>
                    </div>
                    <Separator className="bg-white/20" />
                    <p className="text-[10px] leading-relaxed font-bold opacity-80 uppercase">
                      Cada petición a la base de datos es validada en el servidor. El sistema impide el acceso a datos fuera de la jurisdicción autorizada, incluso si se intenta modificar el código del navegador.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="cidee" className="animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                {
                  title: "Anexo V - Solicitud",
                  desc: "Digitaliza el pedido de las organizaciones políticas. Incluye mapa interactivo para coordenadas GPS y captura de firma/documento físico.",
                  modules: ["Georreferenciación", "Validación en Padrón", "Generación de PDF"]
                },
                {
                  title: "Anexo III - Informe Individual",
                  desc: "Registro por sesión de capacitación. Incluye tablero de marcaciones táctil para hasta 104 ciudadanos y registro fotográfico de respaldo.",
                  modules: ["Auto-completado desde Agenda", "Tablero de Marcación", "Galería de Evento"]
                },
                {
                  title: "Anexo IV - Informe Semanal",
                  desc: "Motor de Inteligencia de Datos que consolida automáticamente todos los Anexos III del distrito en un resumen tabular horizontal.",
                  modules: ["Sincronización Automática", "Validación de Firmas", "Exportación Landscape"]
                },
                {
                  title: "Movimiento de Máquinas",
                  desc: "Control de trazabilidad de los equipos de votación. Registra salida (F01) y devolución (F02) con control de estado de lacres.",
                  modules: ["Formulario 01/02", "Alerta de Lacres", "Denuncia Automática"]
                }
              ].map((mod, i) => (
                <Card key={i} className="shadow-lg hover:border-primary transition-all">
                  <CardHeader className="bg-muted/30 border-b">
                    <CardTitle className="uppercase font-black text-primary text-sm">{mod.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <p className="text-xs font-medium text-muted-foreground leading-relaxed">{mod.desc}</p>
                    <div className="flex flex-wrap gap-2">
                      {mod.modules.map(m => (
                        <Badge key={m} variant="outline" className="text-[8px] font-black uppercase border-primary/20">
                          {m}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="tecnico" className="animate-in fade-in duration-500">
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="uppercase font-black">Stack Tecnológico</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase">Componentes del núcleo del sistema.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {[
                    { label: "Frontend", value: "Next.js 14 (App Router) + React 18", desc: "Interfaz moderna, rápida y con renderizado optimizado." },
                    { label: "Estilos", value: "Tailwind CSS + ShadCN UI", desc: "Diseño institucional, profesional y totalmente responsivo." },
                    { label: "Backend", value: "Firebase Firestore & Auth", desc: "Base de datos NoSQL en tiempo real con seguridad a nivel de registro." },
                    { label: "Reportes", value: "jsPDF + AutoTable + html2canvas", desc: "Generación dinámica de documentos oficiales en el navegador." },
                    { label: "Mapas", value: "Leaflet + OpenStreetMap", desc: "Geolocalización de actividades sin costos de licencias externas." }
                  ].map((tech, i) => (
                    <div key={i} className="p-6 flex flex-col md:flex-row md:items-center gap-4">
                      <div className="md:w-1/3">
                        <p className="text-[10px] font-black uppercase text-primary mb-1">{tech.label}</p>
                        <p className="font-bold text-sm">{tech.value}</p>
                      </div>
                      <div className="md:w-2/3">
                        <p className="text-xs text-muted-foreground font-medium">{tech.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-12 text-center pb-8">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Justicia Electoral - República del Paraguay</p>
        </div>
      </main>
    </div>
  );
}
