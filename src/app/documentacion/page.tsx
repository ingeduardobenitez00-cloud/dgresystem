
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
  HelpCircle,
  ExternalLinkIcon,
  ShoppingCart,
  MessageCircle,
  LockKeyhole,
  ClipboardCheck,
  ArrowLeftRight,
  UserCheck,
  TableProperties
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
            Guía técnica y operativa del Sistema de Gestión Integral.
          </p>
        </div>

        <Tabs defaultValue="manual-cidee" className="space-y-8">
          <TabsList className="grid w-full grid-cols-1 md:grid-cols-5 lg:w-[1000px] bg-white border shadow-sm h-auto p-1">
            <TabsTrigger value="manual-cidee" className="gap-2 font-black uppercase text-[10px] py-2">
              <ClipboardCheck className="h-3.5 w-3.5" /> Manual CIDEE
            </TabsTrigger>
            <TabsTrigger value="correo" className="gap-2 font-black uppercase text-[10px] py-2">
              <Mail className="h-3.5 w-3.5" /> Autenticación
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

          <TabsContent value="manual-cidee" className="animate-in fade-in duration-500 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 space-y-6">
                <Card className="border-t-4 border-t-primary shadow-lg">
                  <CardHeader className="bg-muted/10">
                    <CardTitle className="uppercase font-black text-lg flex items-center gap-2 text-primary">
                      <BookOpen className="h-5 w-5" /> Guía de Operación Paso a Paso
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase">
                      Procedimientos estándar para el Módulo de Capacitaciones.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-8">
                    <Accordion type="single" collapsible className="w-full space-y-4">
                      
                      <AccordionItem value="item-1" className="border rounded-2xl px-6 bg-white shadow-sm overflow-hidden">
                        <AccordionTrigger className="hover:no-underline py-6">
                          <div className="flex items-center gap-4 text-left">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black">1</div>
                            <div>
                              <p className="font-black uppercase text-sm">Registro de Solicitudes (Anexo V)</p>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">Entrada de datos y georreferenciación</p>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-8 text-xs font-medium space-y-4 text-muted-foreground leading-relaxed">
                          <p>Al recibir un pedido de una organización política:</p>
                          <ul className="list-disc pl-5 space-y-2 uppercase text-[10px] font-bold">
                            <li>Seleccione el Partido del buscador oficial.</li>
                            <li>Defina Fecha, Hora y Local exacto.</li>
                            <li><b>IMPORTANTE:</b> Haga doble clic en el mapa para capturar las coordenadas GPS.</li>
                            <li>Adjunte la foto de la solicitud física.</li>
                            <li>Descargue la Proforma PDF para archivo del Registro.</li>
                          </ul>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="item-2" className="border rounded-2xl px-6 bg-white shadow-sm overflow-hidden">
                        <AccordionTrigger className="hover:no-underline py-6">
                          <div className="flex items-center gap-4 text-left">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black">2</div>
                            <div>
                              <p className="font-black uppercase text-sm">Control Logístico (F01 / F02)</p>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">Movimiento de Máquinas de Votación</p>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-8 text-xs font-medium space-y-4 text-muted-foreground leading-relaxed">
                          <p>Para garantizar la seguridad de los equipos:</p>
                          <ul className="list-disc pl-5 space-y-2 uppercase text-[10px] font-bold">
                            <li><b>Salida:</b> Registre serie de la MV y Pendrive. Adjunte F01 firmado (obligatorio).</li>
                            <li><b>Retorno:</b> Verifique estado de lacres.</li>
                            <li><b>Denuncia:</b> Si el lacre está violentado, registre la denuncia con evidencia fotográfica antes de cerrar.</li>
                            <li>Adjunte F02 firmado para cerrar el ciclo de la máquina.</li>
                          </ul>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="item-3" className="border rounded-2xl px-6 bg-white shadow-sm overflow-hidden">
                        <AccordionTrigger className="hover:no-underline py-6">
                          <div className="flex items-center gap-4 text-left">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black">3</div>
                            <div>
                              <p className="font-black uppercase text-sm">Informe de Productividad (Anexo III)</p>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">Carga de marcaciones individuales</p>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-8 text-xs font-medium space-y-4 text-muted-foreground leading-relaxed">
                          <p>Al terminar la capacitación:</p>
                          <ul className="list-disc pl-5 space-y-2 uppercase text-[10px] font-bold">
                            <li>Vincule la actividad agendada (se completarán datos automáticamente).</li>
                            <li>Use el tablero táctil para marcar cada ciudadano capacitado.</li>
                            <li>Adjunte fotos de respaldo del evento y del formulario físico firmado.</li>
                          </ul>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="item-4" className="border rounded-2xl px-6 bg-white shadow-sm overflow-hidden">
                        <AccordionTrigger className="hover:no-underline py-6">
                          <div className="flex items-center gap-4 text-left">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black">4</div>
                            <div>
                              <p className="font-black uppercase text-sm">Consolidado Semanal (Anexo IV)</p>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">Generación automática de rendición</p>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-8 text-xs font-medium space-y-4 text-muted-foreground leading-relaxed">
                          <p>Al cierre de la semana:</p>
                          <ul className="list-disc pl-5 space-y-2 uppercase text-[10px] font-bold">
                            <li>El sistema extrae todos los Anexos III del periodo.</li>
                            <li>No requiere carga manual de filas.</li>
                            <li>Genere el PDF horizontal (Landscape) listo para remitir a la Coordinación.</li>
                          </ul>
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
                    <AlertCircle className="h-4 w-4" /> Recordatorio Crítico
                  </h3>
                  <p className="text-xs leading-relaxed opacity-80 mb-6 font-bold uppercase">
                    La veracidad de los datos está respaldada por las coordenadas GPS y las fotografías de los formularios firmados.
                  </p>
                  <Separator className="bg-white/20 mb-6" />
                  <p className="text-[10px] leading-relaxed font-medium opacity-60 italic uppercase">
                    Todo registro sin respaldo documental fotográfico será considerado inválido durante las auditorías nacionales.
                  </p>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="correo" className="animate-in fade-in duration-500 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 space-y-6">
                <Card className="border-t-4 border-t-blue-600 shadow-lg">
                  <CardHeader className="bg-blue-50/50">
                    <CardTitle className="uppercase font-black text-lg flex items-center gap-2 text-blue-700">
                      <LockKeyhole className="h-5 w-5" /> Recuperación Alternativa
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase">
                      Métodos para cuando el correo de reseteo llega a SPAM o no es recibido.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-5 border-2 border-dashed rounded-2xl bg-white space-y-3">
                            <div className="flex items-center gap-2">
                                <MessageCircle className="h-5 w-5 text-green-600" />
                                <span className="font-black uppercase text-xs">Vía WhatsApp Soporte</span>
                            </div>
                            <p className="text-[10px] font-medium text-muted-foreground leading-relaxed">
                                El sistema incluye un botón de <b>"Soporte WhatsApp"</b> en el Login. Esto permite al usuario contactar al administrador para que este verifique su cuenta manualmente en la Consola.
                            </p>
                        </div>
                        <div className="p-5 border-2 border-dashed rounded-2xl bg-white space-y-3">
                            <div className="flex items-center gap-2">
                                <ShieldAlert className="h-5 w-5 text-amber-600" />
                                <span className="font-black uppercase text-xs">Acción del Administrador</span>
                            </div>
                            <p className="text-[10px] font-medium text-muted-foreground leading-relaxed">
                                El administrador puede entrar a <b>Firebase Console > Auth</b>, buscar al usuario y usar la opción <b>"Restablecer contraseña"</b>. Esto envía un nuevo correo que el administrador puede monitorear.
                            </p>
                        </div>
                    </div>
                    <Separator />
                    <div className="space-y-4">
                        <h3 className="font-black uppercase text-sm">¿Cómo evitar el SPAM definitivamente?</h3>
                        <Accordion type="single" collapsible className="w-full space-y-4">
                            <AccordionItem value="obtener-dominio" className="border rounded-xl px-4 bg-white shadow-sm">
                                <AccordionTrigger className="hover:no-underline">
                                    <div className="flex items-center gap-3">
                                        <ShoppingCart className="h-5 w-5 text-green-600" />
                                        <span className="font-black uppercase text-sm">Opción A: Comprar un Dominio</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="space-y-4 pb-6">
                                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                                        Firebase no vende dominios. Debes comprar uno (ej. <code className="bg-muted px-1">tsje-gestion.com</code>) en proveedores como GoDaddy o Namecheap. 
                                        <b> Sin un dominio propio, los correos siempre tendrán riesgo de SPAM.</b>
                                    </p>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="sin-dominio-smtp" className="border rounded-xl px-4 bg-white shadow-sm">
                                <AccordionTrigger className="hover:no-underline">
                                    <div className="flex items-center gap-3">
                                        <Settings2 className="h-5 w-5 text-amber-600" />
                                        <span className="font-black uppercase text-sm">Opción B: Usar Gmail como Remitente (Relay SMTP)</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="space-y-4 pb-6">
                                    <p className="text-xs text-muted-foreground mb-4">Si no tienes dominio, puedes hacer que Firebase use tu Gmail personal para enviar los mensajes:</p>
                                    <div className="bg-amber-50 p-4 rounded-xl space-y-3 border border-amber-100">
                                        <p className="text-[11px] font-bold text-amber-900 uppercase">PASOS CONFIGURACIÓN SMTP:</p>
                                        <ol className="text-[10px] space-y-2 list-decimal pl-4 font-medium uppercase">
                                            <li>Entra a tu Cuenta de Google {">"} Seguridad {">"} **Contraseña de Aplicaciones**.</li>
                                            <li>Genera una clave de 16 caracteres para "Correo".</li>
                                            <li>En Firebase Console {">"} Authentication {">"} Templates {">"} **Configuración de SMTP**.</li>
                                            <li>Servidor: <code className="bg-white px-1">smtp.gmail.com</code> | Puerto: <code className="bg-white px-1">465</code>.</li>
                                            <li>Usa tu correo y la clave de 16 caracteres.</li>
                                        </ol>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="lg:col-span-4 space-y-6">
                <Card className="bg-black text-white p-8 rounded-[2rem] shadow-2xl relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 opacity-10">
                    <Globe className="h-32 w-32" />
                  </div>
                  <h3 className="font-black uppercase text-xs mb-6 flex items-center gap-2 text-amber-400">
                    <AlertCircle className="h-4 w-4" /> Recomendación VIP
                  </h3>
                  <p className="text-xs leading-relaxed opacity-80 mb-6 font-bold uppercase">
                    La forma más profesional de operar es solicitar a la Dirección de Informática un <b>Subdominio Institucional</b>.
                  </p>
                  <Separator className="bg-white/20 mb-6" />
                  <p className="text-[10px] leading-relaxed font-medium opacity-60 italic uppercase">
                    Esto permite validar el sistema ante los servidores de Google, asegurando que el 100% de los correos lleguen a la bandeja de entrada principal.
                  </p>
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
