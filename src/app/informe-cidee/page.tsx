"use client";

import { useState } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { 
  FileDown, 
  Loader2, 
  CheckCircle2, 
  Info, 
  ShieldAlert, 
  Calendar, 
  MapPin, 
  Cpu, 
  ShieldCheck,
  Eye,
  FileText
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function InformeCideePage() {
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadWord = () => {
    setIsDownloading(true);
    try {
      const htmlContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' 
      xmlns:w='urn:schemas-microsoft-com:office:word' 
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
    <meta charset="utf-8">
    <title>Informe Técnico de Módulos: CAPACITACIONES - CIDEE</title>
    <!--[if gte mso 9]>
    <xml>
        <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
    </xml>
    <![endif]-->
    <style>
        @page {
            size: A4;
            margin: 2.54cm;
        }
        body {
            font-family: 'Calibri', 'Arial', sans-serif;
            color: #333333;
            line-height: 1.5;
            font-size: 11pt;
        }
        h1 {
            font-family: 'Arial', sans-serif;
            color: #1a365d;
            font-size: 24pt;
            border-bottom: 2px solid #1a365d;
            padding-bottom: 5px;
            margin-top: 0;
            margin-bottom: 20px;
            text-transform: uppercase;
        }
        h2 {
            font-family: 'Arial', sans-serif;
            color: #2c5282;
            font-size: 16pt;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 3px;
            margin-top: 30px;
            margin-bottom: 15px;
            text-transform: uppercase;
        }
        h3 {
            font-family: 'Arial', sans-serif;
            color: #2b6cb0;
            font-size: 13pt;
            margin-top: 20px;
            margin-bottom: 10px;
        }
        p {
            margin-top: 0;
            margin-bottom: 10px;
            text-align: justify;
        }
        .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            border: none;
        }
        .header-table td {
            border: none;
            padding: 5px;
        }
        .institution-title {
            font-size: 10pt;
            font-weight: bold;
            color: #4a5568;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .system-title {
            font-size: 18pt;
            font-weight: bold;
            color: #1a365d;
        }
        .meta-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            background-color: #f7fafc;
            border: 1px solid #e2e8f0;
        }
        .meta-table td {
            padding: 10px;
            border: 1px solid #e2e8f0;
            font-size: 10pt;
        }
        .meta-label {
            font-weight: bold;
            color: #4a5568;
            width: 20%;
            background-color: #edf2f7;
        }
        table.matrix-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            margin-bottom: 30px;
        }
        table.matrix-table th {
            background-color: #1a365d;
            color: #ffffff;
            font-weight: bold;
            text-align: left;
            padding: 10px;
            font-size: 10pt;
            border: 1px solid #1a365d;
            text-transform: uppercase;
        }
        table.matrix-table td {
            padding: 8px 10px;
            border: 1px solid #e2e8f0;
            font-size: 9.5pt;
        }
        table.matrix-table tr:nth-child(even) {
            background-color: #f7fafc;
        }
        .alert-box {
            background-color: #ebf8ff;
            border-left: 4px solid #3182ce;
            padding: 12px;
            margin-bottom: 20px;
            font-size: 10pt;
            color: #2b6cb0;
        }
        .alert-box-important {
            background-color: #fffaf0;
            border-left: 4px solid #dd6b20;
            padding: 12px;
            margin-bottom: 20px;
            font-size: 10pt;
            color: #dd6b20;
        }
        .page-break {
            page-break-before: always;
        }
        .screenshot-container {
            text-align: center;
            margin-top: 15px;
            margin-bottom: 25px;
            background-color: #f7fafc;
            padding: 10px;
            border: 1px solid #e2e8f0;
        }
        .screenshot-image {
            max-width: 580px;
            width: 100%;
            height: auto;
            border: 1px solid #cbd5e0;
        }
        .screenshot-caption {
            font-size: 8.5pt;
            color: #718096;
            margin-top: 5px;
            font-style: italic;
        }
        .module-meta {
            font-size: 9.5pt;
            color: #4a5568;
            margin-bottom: 10px;
            background-color: #f7fafc;
            padding: 8px;
            border-left: 3px solid #cbd5e0;
        }
    </style>
</head>
<body>
    <table class="header-table">
        <tr>
            <td>
                <div class="institution-title">DIRECCIÓN GENERAL DEL REGISTRO ELECTORAL</div>
                <div class="system-title">JUSTICIA ELECTORAL</div>
            </td>
        </tr>
    </table>

    <h1>INFORME TÉCNICO DE SISTEMA</h1>
    <h3 style="margin-top: -15px; color: #718096; font-size: 14pt;">Módulos Operativos de CAPACITACIONES - CIDEE</h3>

    <table class="meta-table">
        <tr>
            <td class="meta-label">Documento:</td>
            <td>Análisis Funcional y Manual Técnico de Módulos</td>
            <td class="meta-label">Fecha:</td>
            <td>11 de Mayo de 2026</td>
        </tr>
        <tr>
            <td class="meta-label">Área Temática:</td>
            <td>Centro de Información y Documentación Electoral (CIDEE)</td>
            <td class="meta-label">Autor:</td>
            <td>Asistente Antigravity AI (Pair Programming con Superadmin)</td>
        </tr>
        <tr>
            <td class="meta-label">Servidor Local:</td>
            <td>http://localhost:3000/</td>
            <td class="meta-label">Estado:</td>
            <td>Entorno Homologado y Verificado</td>
        </tr>
    </table>

    <div class="alert-box">
        <strong>INFORMACIÓN:</strong> Este documento ha sido compilado automáticamente a partir del análisis directo de los archivos de código fuente de la aplicación Next.js y las capturas de pantalla de alta resolución recolectadas de manera autónoma en el servidor local de desarrollo.
    </div>

    <h2>1. INTRODUCCIÓN Y ALCANCE</h2>
    <p>
        El presente informe técnico describe en detalle el funcionamiento, la arquitectura y la interfaz gráfica de usuario de los módulos que componen el ecosistema de <strong>Capacitaciones y Divulgaciones del CIDEE</strong> dentro del Sistema de Gestión de la Dirección General del Registro Electoral (DGRE).
    </p>
    <p>
        La implementación está basada en una arquitectura moderna con <strong>Next.js (App Router)</strong>, estilizada mediante <strong>TailwindCSS</strong> y componentes interactivos basados en <strong>Radix UI (Shadcn)</strong>. La persistencia y autenticación de datos se realizan mediante los servicios de <strong>Firebase (Cloud Firestore y Firebase Auth)</strong>, lo cual permite una sincronización en tiempo real de las planificaciones operativas, el stock físico de las máquinas de votación y las evidencias fotográficas de campo.
    </p>

    <div class="page-break"></div>

    <h2>2. MATRIZ DE MÓDULOS REGISTRADOS</h2>
    <p>A continuación se lista la estructura de navegación y el propósito general de cada uno de los 16 módulos analizados:</p>

    <table class="matrix-table">
        <thead>
            <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 25%;">Módulo</th>
                <th style="width: 20%;">Ruta de Acceso</th>
                <th style="width: 50%;">Propósito Operativo</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>1</td>
                <td><b>Calendario Mensual</b></td>
                <td>/calendario-capacitaciones</td>
                <td>Planificación nacional y vista mensual consolidada de las capacitaciones y divulgaciones.</td>
            </tr>
            <tr>
                <td>2</td>
                <td><b>Anexo I - Lugares Fijos</b></td>
                <td>/anexo-i</td>
                <td>Formulario de planificación semanal de puntos fijos de divulgación electoral.</td>
            </tr>
            <tr>
                <td>3</td>
                <td><b>Puntos Fijos Divulgación</b></td>
                <td>/puntos-fijos</td>
                <td>Buscador, mapa y visualizador georreferenciado de los puntos fijos de divulgación.</td>
            </tr>
            <tr>
                <td>4</td>
                <td><b>Listado de Anexo I</b></td>
                <td>/lista-anexo-i</td>
                <td>Consulta, edición, aprobación y exportación en PDF de planificaciones enviadas.</td>
            </tr>
            <tr>
                <td>5</td>
                <td><b>Anexo V - Solicitudes</b></td>
                <td>/solicitud-capacitacion</td>
                <td>Registro y creación de solicitudes de capacitación para agrupaciones políticas.</td>
            </tr>
            <tr>
                <td>6</td>
                <td><b>Agenda Anexo I</b></td>
                <td>/agenda-anexo-i</td>
                <td>Calendario cronológico de actividades operativas programadas por el Anexo I.</td>
            </tr>
            <tr>
                <td>7</td>
                <td><b>Agenda Anexo V</b></td>
                <td>/agenda-anexo-v</td>
                <td>Calendario específico para el control y ejecución de solicitudes de partidos políticos (Anexo V).</td>
            </tr>
            <tr>
                <td>8</td>
                <td><b>Inventario de Máquinas</b></td>
                <td>/maquinas</td>
                <td>Control de stock, números de serie y disponibilidad de máquinas de votación por distrito.</td>
            </tr>
            <tr>
                <td>9</td>
                <td><b>Movimiento de Máquinas</b></td>
                <td>/control-movimiento-maquinas</td>
                <td>Registro detallado de salidas, retornos, custodios y estados físicos de los equipos.</td>
            </tr>
            <tr>
                <td>10</td>
                <td><b>Denuncia de Lacres</b></td>
                <td>/denuncia-lacres</td>
                <td>Módulo crítico de seguridad para reportar daños o adulteraciones de los precintos.</td>
            </tr>
            <tr>
                <td>11</td>
                <td><b>Trazabilidad Logística</b></td>
                <td>/informe-movimientos-denuncias</td>
                <td>Panel analítico que cruza movimientos con reportes de incidencias e irregularidades.</td>
            </tr>
            <tr>
                <td>12</td>
                <td><b>Anexo III - Divulgador</b></td>
                <td>/informe-divulgador</td>
                <td>Registro individualizado de ciudadanos capacitados por cada divulgador de máquina.</td>
            </tr>
            <tr>
                <td>13</td>
                <td><b>Galería de Evidencias</b></td>
                <td>/galeria-capacitaciones</td>
                <td>Registro fotográfico y evidencias de actividades clasificadas por distrito y fechas.</td>
            </tr>
            <tr>
                <td>14</td>
                <td><b>Anexo IV - Informe Semanal</b></td>
                <td>/informe-semanal-puntos-fijos</td>
                <td>Consolidación y cuantificación semanal de personas capacitadas y encuestas.</td>
            </tr>
            <tr>
                <td>15</td>
                <td><b>Listado de Anexo IV</b></td>
                <td>/lista-anexo-iv</td>
                <td>Historial de reportes consolidados semanales generados, con soporte de firma digital.</td>
            </tr>
            <tr>
                <td>16</td>
                <td><b>Anexo II - Encuesta</b></td>
                <td>/encuesta-satisfaccion</td>
                <td>Encuesta digital de usabilidad y experiencia ciudadana en el uso de la máquina de votación.</td>
            </tr>
        </tbody>
    </table>

    <div class="page-break"></div>

    <h2>3. DETALLE FUNCIONAL Y CAPTURAS DE MÓDULOS</h2>

    <h3>1. Calendario Mensual (<code>/calendario-capacitaciones</code>)</h3>
    <div class="module-meta">
        <strong>Nivel de Acceso:</strong> Superadmin, Coordinador CIDEE, Jefe Distrital (Lectura)
    </div>
    <p>
        El módulo del Calendario representa la vista unificada nacional de toda la fuerza operativa desplegada en campo. Integra en una grilla de tiempo dinámica los eventos agendados mediante el Anexo I y el Anexo V.
    </p>
    <div class="screenshot-container">
        <img class="screenshot-image" src="file:///C:/Users/EDU DJ/.gemini/antigravity/brain/947f7112-c28e-402b-a36c-6fea4c1b6629/calendario_capacitaciones_1778503962700.png">
    </div>

    <h3>2. Anexo I - Lugares Fijos (<code>/anexo-i</code>)</h3>
    <div class="module-meta">
        <strong>Nivel de Acceso:</strong> Superadmin, Jefe Distrital (Lectura/Escritura)
    </div>
    <p>
        El Anexo I es el formulario base de planificación semanal. Exige vincular un número de serie de equipo y los números de los precintos plásticos de seguridad (lacres).
    </p>
    <div class="screenshot-container">
        <img class="screenshot-image" src="file:///C:/Users/EDU DJ/.gemini/antigravity/brain/947f7112-c28e-402b-a36c-6fea4c1b6629/anexo_i_1778504008330.png">
    </div>

    <h3>3. Puntos Fijos Divulgación (<code>/puntos-fijos</code>)</h3>
    <div class="module-meta">
        <strong>Nivel de Acceso:</strong> Acceso Público / Todos los Roles
    </div>
    <p>
        Módulo cartográfico interactivo que visualiza geográficamente la cobertura nacional de divulgación utilizando Leaflet.js.
    </p>
    <div class="screenshot-container">
        <img class="screenshot-image" src="file:///C:/Users/EDU DJ/.gemini/antigravity/brain/947f7112-c28e-402b-a36c-6fea4c1b6629/puntos_fijos_1778504028159.png">
    </div>

    <h3>4. Listado de Anexo I (<code>/lista-anexo-i</code>)</h3>
    <div class="module-meta">
        <strong>Nivel de Acceso:</strong> Superadmin, Coordinador CIDEE (Aprobación), Jefe Distrital (Lectura/Edición)
    </div>
    <p>
        Administra el ciclo de vida de las planificaciones enviadas (Borrador, Pendiente, Aprobado, Rechazado).
    </p>
    <div class="screenshot-container">
        <img class="screenshot-image" src="file:///C:/Users/EDU DJ/.gemini/antigravity/brain/947f7112-c28e-402b-a36c-6fea4c1b6629/lista_anexo_i_1778504047651.png">
    </div>

    <h3>5. Anexo V - Solicitudes (<code>/solicitud-capacitacion</code>)</h3>
    <div class="module-meta">
        <strong>Nivel de Acceso:</strong> Superadmin, Jefe Distrital, Partidos Autorizados (Escritura)
    </div>
    <p>
        Permite documentar de forma estructurada los pedidos de capacitación formal de agrupaciones políticas, movimientos sociales u organismos civiles externos.
    </p>
    <div class="screenshot-container">
        <img class="screenshot-image" src="file:///C:/Users/EDU DJ/.gemini/antigravity/brain/947f7112-c28e-402b-a36c-6fea4c1b6629/solicitud_capacitacion_1778504066422.png">
    </div>

    <h3>6. Agenda Anexo I (<code>/agenda-anexo-i</code>)</h3>
    <div class="module-meta">
        <strong>Nivel de Acceso:</strong> Todos los Roles (Lectura)
    </div>
    <p>
        Vista limpia de calendario dedicada exclusivamente a los periodos de divulgación operativa del Anexo I.
    </p>
    <div class="screenshot-container">
        <img class="screenshot-image" src="file:///C:/Users/EDU DJ/.gemini/antigravity/brain/947f7112-c28e-402b-a36c-fea4c1b6629/agenda_anexo_i_1778504096281.png">
    </div>

    <h3>7. Agenda Anexo V (<code>/agenda-anexo-v</code>)</h3>
    <div class="module-meta">
        <strong>Nivel de Acceso:</strong> Todos los Roles (Lectura)
    </div>
    <p>
        Calendario específico enfocado en el cronograma de instrucción cívica brindada a partidos políticos.
    </p>
    <div class="screenshot-container">
        <img class="screenshot-image" src="file:///C:/Users/EDU DJ/.gemini/antigravity/brain/947f7112-c28e-402b-a36c-6fea4c1b6629/agenda_anexo_v_1778504107524.png">
    </div>

    <h3>8. Inventario de Máquinas (<code>/maquinas</code>)</h3>
    <div class="module-meta">
        <strong>Nivel de Acceso:</strong> Superadmin (Edición), Jefe Distrital (Lectura/Stock)
    </div>
    <p>
        Gestor central de activos tecnológicos que controla números de serie, departamentos y disponibilidad.
    </p>
    <div class="screenshot-container">
        <img class="screenshot-image" src="file:///C:/Users/EDU DJ/.gemini/antigravity/brain/947f7112-c28e-402b-a36c-6fea4c1b6629/maquinas_1778504122152.png">
    </div>

    <h3>9. Movimiento de Máquinas (<code>/control-movimiento-maquinas</code>)</h3>
    <div class="module-meta">
        <strong>Nivel de Acceso:</strong> Superadmin, Jefe Distrital (Escritura)
    </div>
    <p>
        Bitácora logística de entradas y salidas de máquinas del depósito del Registro Electoral.
    </p>
    <div class="screenshot-container">
        <img class="screenshot-image" src="file:///C:/Users/EDU DJ/.gemini/antigravity/brain/947f7112-c28e-402b-a36c-6fea4c1b6629/control_movimiento_maquinas_1778504133575.png">
    </div>

    <h3>10. Denuncia de Lacres (<code>/denuncia-lacres</code>)</h3>
    <div class="module-meta">
        <strong>Nivel de Acceso:</strong> Todos los Roles (Escritura)
    </div>
    <p>
        Módulo crítico para reportar daños, roturas o faltas de lacres de seguridad con carga de fotos probatorias.
    </p>
    <div class="screenshot-container">
        <img class="screenshot-image" src="file:///C:/Users/EDU DJ/.gemini/antigravity/brain/947f7112-c28e-402b-a36c-6fea4c1b6629/denuncia_lacres_1778504144736.png">
    </div>

    <h3>11. Trazabilidad Logística (<code>/informe-movimientos-denuncias</code>)</h3>
    <div class="module-meta">
        <strong>Nivel de Acceso:</strong> Superadmin, Coordinador CIDEE (Auditoría)
    </div>
    <p>
        Monitoreo cruzado inteligente de stock, movimientos e incidentes de lacres para disparar alertas de seguridad.
    </p>
    <div class="screenshot-container">
        <img class="screenshot-image" src="file:///C:/Users/EDU DJ/.gemini/antigravity/brain/947f7112-c28e-402b-a36c-6fea4c1b6629/informe_movimientos_denuncias_1778504165800.png">
    </div>

    <h3>12. Anexo III - Informe del Divulgador (<code>/informe-divulgador</code>)</h3>
    <div class="module-meta">
        <strong>Nivel de Acceso:</strong> Divulgador, Jefe Distrital (Escritura)
    </div>
    <p>
        Registro demográfico y estadístico de ciudadanos instruidos de forma individual (tablero de 104 celdas).
    </p>
    <div class="screenshot-container">
        <img class="screenshot-image" src="file:///C:/Users/EDU DJ/.gemini/antigravity/brain/947f7112-c28e-402b-a36c-6fea4c1b6629/informe_divulgador_1778504176459.png">
    </div>

    <h3>13. Galería de Evidencias (<code>/galeria-capacitaciones</code>)</h3>
    <div class="module-meta">
        <strong>Nivel de Acceso:</strong> Todos los Roles (Lectura)
    </div>
    <p>
        Galería fotográfica de campo filtrable para validar la ejecución física de las actividades en campo.
    </p>
    <div class="screenshot-container">
        <img class="screenshot-image" src="file:///C:/Users/EDU DJ/.gemini/antigravity/brain/947f7112-c28e-402b-a36c-6fea4c1b6629/galeria_capacitaciones_1778504188973.png">
    </div>

    <h3>14. Anexo IV - Informe Semanal (<code>/informe-semanal-puntos-fijos</code>)</h3>
    <div class="module-meta">
        <strong>Nivel de Acceso:</strong> Jefe Distrital (Cierre/Firma)
    </div>
    <p>
        Consolidador automático semanal de datos demográficos y encuestas recolectadas.
    </p>
    <div class="screenshot-container">
        <img class="screenshot-image" src="file:///C:/Users/EDU DJ/.gemini/antigravity/brain/947f7112-c28e-402b-a36c-6fea4c1b6629/informe_semanal_puntos_fijos_1778504202386.png">
    </div>

    <h3>15. Listado de Anexo IV (<code>/lista-anexo-iv</code>)</h3>
    <div class="module-meta">
        <strong>Nivel de Acceso:</strong> Superadmin, Coordinador CIDEE (Auditoría)
    </div>
    <p>
        Grilla histórica de reportes distritales semanales cerrados y firmados.
    </p>
    <div class="screenshot-container">
        <img class="screenshot-image" src="file:///C:/Users/EDU DJ/.gemini/antigravity/brain/947f7112-c28e-402b-a36c-6fea4c1b6629/lista_anexo_iv_1778504213934.png">
    </div>

    <h3>16. Anexo II - Encuesta de Satisfacción (<code>/encuesta-satisfaccion</code>)</h3>
    <div class="module-meta">
        <strong>Nivel de Acceso:</strong> Divulgador, Ciudadano Externo (Escritura)
    </div>
    <p>
        Formulario táctil para evaluar la percepción ciudadana sobre el uso de la máquina de votación.
    </p>
    <div class="screenshot-container">
        <img class="screenshot-image" src="file:///C:/Users/EDU DJ/.gemini/antigravity/brain/947f7112-c28e-402b-a36c-6fea4c1b6629/encuesta_satisfaccion_1778504226325.png">
    </div>

    <h2>4. ARQUITECTURA DE DATOS E INTEGRACIÓN CON FIRESTORE</h2>
    <p>
        La persistencia se realiza bajo Firestore. Las colecciones clave mapeadas son: <code>users</code>, <code>maquinas</code>, <code>movimientos_maquinas</code>, <code>anexo1</code>, <code>solicitudes_anexo5</code>, <code>divulgador_informes</code>, <code>encuestas_satisfaccion</code>, y <code>denuncia_lacres</code>.
    </p>

    <h2>5. CONCLUSIÓN GENERAL</h2>
    <p>
        Este sistema garantiza altos estándares de ciberseguridad, transparencia y ordenamiento estadístico en el Paraguay de cara a las capacitaciones del uso de tecnologías de voto electrónico.
    </p>

    <p style="text-align: center; margin-top: 50px; font-weight: bold; font-size: 10pt;">
        ____________________________________________<br>
        DIRECCIÓN GENERAL DEL REGISTRO ELECTORAL (DGRE)<br>
        SISTEMA DE GESTIÓN INTEGRADA - JUSTICIA ELECTORAL
    </p>
</body>
</html>
      `;

      // Se agrega el BOM de UTF-8 para evitar problemas de acentuacion en Word español
      const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'informe_sistema_cidee.doc';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "¡Informe Word Descargado!",
        description: "El archivo 'informe_sistema_cidee.doc' se ha descargado correctamente en tu equipo.",
      });
    } catch (error) {
      console.error("Error al descargar:", error);
      toast({
        variant: "destructive",
        title: "Error al descargar",
        description: "No se pudo generar el documento Word. Revisa la consola.",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Informe Técnico CIDEE" />
      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full space-y-8">
        
        {/* Cabecera del Módulo */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-primary hover:bg-primary/90 text-[9px] font-black tracking-widest uppercase py-1 px-3 rounded-full">
                MÓDULO DE SISTEMA
              </Badge>
              <Badge variant="outline" className="text-[9px] font-bold tracking-wider uppercase py-1 px-3 border-primary text-primary bg-primary/5">
                V1.0.0
              </Badge>
            </div>
            <h1 className="text-3xl font-black tracking-tight uppercase text-primary mt-2">
              Generador de Informe Técnico
            </h1>
            <p className="text-muted-foreground text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              Documentación funcional oficial y capturas de pantalla de Capacitaciones.
            </p>
          </div>
          
          <Button 
            className="font-black uppercase text-xs h-14 px-10 shadow-2xl bg-black hover:bg-black/90 gap-3 rounded-2xl"
            onClick={handleDownloadWord}
            disabled={isDownloading}
          >
            {isDownloading ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileDown className="h-6 w-6" />}
            DESCARGAR INFORME WORD (.DOC)
          </Button>
        </div>

        {/* Tarjetas de Información Rápida */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-none shadow-lg rounded-3xl bg-white p-6 flex gap-4 items-start">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <FileText className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="font-black uppercase text-[10px] text-muted-foreground">CONTENIDO</p>
              <p className="text-sm font-bold uppercase text-primary">16 Submódulos</p>
              <p className="text-[10px] font-medium leading-relaxed uppercase text-muted-foreground">
                Análisis pormenorizado del ecosistema operativo CIDEE.
              </p>
            </div>
          </Card>

          <Card className="border-none shadow-lg rounded-3xl bg-white p-6 flex gap-4 items-start">
            <div className="h-12 w-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="font-black uppercase text-[10px] text-muted-foreground">SEGURIDAD</p>
              <p className="text-sm font-bold uppercase text-primary">Matriz RBAC</p>
              <p className="text-[10px] font-medium leading-relaxed uppercase text-muted-foreground">
                Mapeo de accesos de Superadmin, Jefes y Divulgadores.
              </p>
            </div>
          </Card>

          <Card className="border-none shadow-lg rounded-3xl bg-white p-6 flex gap-4 items-start">
            <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Cpu className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="font-black uppercase text-[10px] text-muted-foreground">INTEGRIDAD</p>
              <p className="text-sm font-bold uppercase text-primary">Local Imágenes</p>
              <p className="text-[10px] font-medium leading-relaxed uppercase text-muted-foreground">
                Capturas de pantalla enlazadas a tu base local del sistema.
              </p>
            </div>
          </Card>
        </div>

        {/* Detalles e Instrucciones */}
        <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="bg-primary text-white p-8">
            <CardTitle className="uppercase font-black text-xl flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6" /> Características de la Exportación
            </CardTitle>
            <CardDescription className="text-primary-foreground/80 font-bold uppercase text-[9px] tracking-widest mt-1">
              Formato de intercambio oficial de la Justicia Electoral
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-4">
              <h3 className="font-black uppercase text-sm text-primary border-l-4 border-primary pl-4">
                ¿Qué contiene el documento descargable?
              </h3>
              <ul className="space-y-3">
                <li className="flex gap-3 text-xs font-medium leading-relaxed">
                  <div className="h-5 w-5 rounded-full bg-black text-white flex items-center justify-center text-[10px] font-black shrink-0">1</div>
                  <p className="uppercase"><b>Maquetación Institucional:</b> Encabezado de la Dirección General de Registro Electoral y pie de página oficial de la Justicia Electoral.</p>
                </li>
                <li className="flex gap-3 text-xs font-medium leading-relaxed">
                  <div className="h-5 w-5 rounded-full bg-black text-white flex items-center justify-center text-[10px] font-black shrink-0">2</div>
                  <p className="uppercase"><b>Tablas de Módulos:</b> Estructura de navegación Next.js con archivos controladores asociados para auditoría rápida.</p>
                </li>
                <li className="flex gap-3 text-xs font-medium leading-relaxed">
                  <div className="h-5 w-5 rounded-full bg-black text-white flex items-center justify-center text-[10px] font-black shrink-0">3</div>
                  <p className="uppercase"><b>Imágenes Vinculadas:</b> Las 16 capturas de pantalla están enlazadas con rutas absolutas de tu computadora para una carga óptima y offline.</p>
                </li>
              </ul>
            </div>

            <div className="p-6 bg-green-50 border-2 border-dashed border-green-200 rounded-3xl flex items-start gap-3 mt-4">
              <Info className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-[10px] font-black text-green-800 uppercase">INSTRUCCIONES DE USO EN WORD:</p>
                <p className="text-[9px] font-bold text-green-700 uppercase leading-normal">
                  Al abrir el archivo descargado "informe_sistema_cidee.doc" en Microsoft Word, el programa cargará el contenido visual y las tablas de forma óptima. Ve a "Archivo" &gt; "Guardar como" y guárdalo como "Documento de Word (*.docx)" para consolidar todas las imágenes definitivamente dentro del archivo de forma nativa.
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-muted/30 border-t p-6 flex justify-between items-center">
            <span className="text-[9px] font-black uppercase text-muted-foreground">
              Desarrollado para el Centro de Información y Documentación Electoral (CIDEE)
            </span>
          </CardFooter>
        </Card>

        {/* Pie de Página */}
        <div className="text-center pb-12">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em] opacity-40">
            Justicia Electoral - República del Paraguay - 2026
          </p>
        </div>
      </main>
    </div>
  );
}
