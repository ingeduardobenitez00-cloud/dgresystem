# Informe Técnico: Módulo CIDEE - CAPACITACIONES

## 1. Introducción
El módulo **CIDEE - CAPACITACIONES** es el núcleo operativo del sistema para la gestión, supervisión y reporte de las actividades de divulgación y capacitación técnica sobre el uso de la Máquina de Votación y funciones de miembros de mesa en todo el territorio nacional paraguayo.

## 2. Componentes del Módulo

### A. Solicitud de Capacitación (Anexo V)
*   **Función**: Captura digital de solicitudes de partidos y movimientos políticos.
*   **Capacidades Técnicas**: 
    *   Georreferenciación interactiva (Leaflet/OSM).
    *   Captura de firma/documento mediante cámara o galería (Data URI).
    *   Generación automática de PDF oficial (jsPDF) con logo institucional.

### B. Agenda de Capacitación (Reporte Dinámico)
*   **Función**: Supervisión nacional de actividades agendadas organizada por departamentos y distritos.
*   **Gestión Administrativa**:
    *   **Asignación de Divulgadores**: Los Jefes y Administradores pueden asignar personal específico a cada actividad.
    *   **Filtro Jerárquico**: Visualización tipo reporte con códigos oficiales de departamentos (ej. 00 - ASUNCIÓN).

### C. Encuesta de Satisfacción
*   **Función**: Medición de la experiencia del ciudadano con la máquina de votación.
*   **Integración**: Importación automática de datos desde la agenda vinculada (Lugar, Fecha, Hora).
*   **Métricas**: Evalúa utilidad, facilidad y seguridad percibida.

### D. Informe del Divulgador (Anexo III)
*   **Función**: Control individual de marcaciones por cada ciudadano capacitado.
*   **Automatización**: Al vincularse con una actividad asignada en agenda, autocompleta:
    *   Nombre y Cédula del Divulgador.
    *   Vínculo Laboral y Oficina.
    *   Lugar y Horario pactado.
*   **Interfaz**: Tablero de marcaciones rápidas (hasta 104 personas por registro).

### E. Informe Semanal Puntos Fijos (Anexo IV)
*   **Función**: Consolidado semanal administrativo.
*   **Inteligencia de Datos**: **Carga Automática**. El sistema extrae los datos de todos los Anexos III registrados en el distrito seleccionado y los presenta en formato tabular listo para exportación.
*   **Exportación**: Generación de PDF en formato horizontal (Landscape) con validación de firmas.

### F. Estadísticas CIDEE
*   **Función**: Dashboard analítico en tiempo real.
*   **Visualización**: Gráficos de barras y tortas (Recharts) sobre:
    *   Distribución por género y rango de edad.
    *   Nivel de satisfacción y utilidad percibida.

## 3. Matriz de Roles y Permisos

| Rol | Alcance Territorial | Capacidades |
| :--- | :--- | :--- |
| **Administrador / Director** | Nacional | Acceso total, gestión de usuarios, generación de reportes globales. |
| **Jefe** | Nacional/Asignado | Asignación de personal en agenda, supervisión de reportes regionales. |
| **Funcionario / Divulgador** | Distrito Asignado | Carga de solicitudes, encuestas e informes individuales. |

## 4. Arquitectura de Datos
*   **Persistencia**: Firebase Firestore (NoSQL) con sincronización en tiempo real.
*   **Seguridad**: Reglas de Seguridad de Firestore (Security Rules) que restringen la edición por ubicación asignada.
*   **Frontend**: Next.js 14 (App Router) con componentes ShadCN UI para una interfaz profesional y responsiva.

---
*Fin del Informe Técnico - CIDEE*