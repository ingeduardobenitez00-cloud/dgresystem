
# Informe de Funciones y Módulos: Sistema de Gestión CIDEE

## 1. Matriz de Funciones por Rol

### A. Administrador (Nivel Nacional)
*   **Gestión de Seguridad**: Control total sobre la creación de usuarios, gestión de contraseñas y asignación de permisos granulares.
*   **Configuración Maestra**: Importación y edición de la estructura geográfica (Departamentos y Distritos) y códigos oficiales.
*   **Carga Masiva**: Herramientas de importación desde Excel para locales de votación y reportes edilicios históricos.
*   **Supervisión Global**: Capacidad de generar el **Informe General PDF**, un documento consolidado de todo el país con índice automático y paginación.
*   **Mantenimiento**: Carga masiva de fotografías de locales mediante reconocimiento de nombres de archivo.

### B. Jefe (Nivel Regional / Supervisión)
*   **Gestión de Agenda**: Asignación de divulgadores específicos a las solicitudes de capacitación aprobadas.
*   **Validación Administrativa**: Supervisión de los Informes del Divulgador (Anexo III) cargados por su personal.
*   **Consolidación Automatizada**: Generación y validación del **Informe Semanal (Anexo IV)**, el cual se autocompleta con la actividad de sus distritos asignados.
*   **Análisis de Datos**: Uso del dashboard de estadísticas para monitorear el desempeño y la satisfacción ciudadana en tiempo real.

### C. Divulgador / Funcionario (Nivel Operativo)
*   **Ejecución de Campo**: Carga de la **Solicitud de Capacitación (Anexo V)** con georreferenciación GPS y captura de firma.
*   **Control de Equipos**: Registro del **Movimiento de Máquinas** (salida y devolución) vinculado a la actividad agendada.
*   **Registro de Productividad**: Uso del **Anexo III** para marcar la cantidad de ciudadanos capacitados mediante un tablero táctil de 104 celdas.
*   **Recolección de Feedback**: Registro de la **Encuesta de Satisfacción** vinculada automáticamente a la agenda asignada.
*   **Documentación Edilicia**: Carga de la ficha técnica y las 8 categorías de fotos obligatorias del Registro Electoral asignado.

---

## 2. Descripción de los Módulos del Sistema

### Módulo CIDEE - CAPACITACIONES
1.  **Solicitud (Anexo V)**: Digitaliza el pedido de las organizaciones políticas. Incluye mapa interactivo para fijar coordenadas y cámara para adjuntar el documento físico firmado.
2.  **Agenda Dinámica**: Centro de control donde se visualizan las actividades pendientes y se asigna el personal responsable.
3.  **Control Movimiento Máquinas**: Registro de salida y entrada de equipos de votación, con generación de formularios 01 y 02.
4.  **Informe Anexo III**: Registro individual por sesión de capacitación. Autocompleta los datos del funcionario (Nombre, Cédula, Vínculo) si fue asignado en agenda.
5.  **Informe Semanal Anexo IV**: Módulo de **Inteligencia de Datos**. Consolida automáticamente todos los Anexos III del distrito en una tabla resumen para exportación PDF horizontal.
6.  **Estadísticas CIDEE**: Dashboard analítico con gráficos interactivos (Recharts) sobre distribución de género, edad y percepción de seguridad de la Máquina de Votación.

### Módulo de Registros Electorales
1.  **Vista de Ficha**: Reporte técnico detallado sobre el estado edilicio, dimensiones de habitaciones seguras y resguardo de equipos.
2.  **Galería Fotográfica**: Organización jerárquica de imágenes con visor avanzado (zoom, navegación y borrado selectivo).
3.  **Informe General**: Motor de reportes que genera un documento PDF único con toda la información edilicia y fotográfica del país.

### Módulo de Locales de Votación
1.  **Buscador Georreferenciado**: Filtro avanzado por Zona y Local para ubicar puntos de votación con enlace directo a Google Maps.
2.  **Carga Masiva de Fotos**: Permite subir cientos de imágenes a la vez, vinculándolas automáticamente al local correcto mediante procesamiento de texto.

---

## 3. Conclusión de la Implementación (Para Presentación)

La implementación del **Sistema de Gestión Integral de la Justicia Electoral** marca un hito en la transformación digital de la institución, pasando de procesos manuales dispersos a una plataforma centralizada de alta eficiencia.

**Puntos Clave:**
*   **Optimización del Tiempo**: La automatización del Anexo IV elimina la carga manual de datos, reduciendo el trabajo administrativo de horas a segundos.
*   **Garantía de Veracidad**: La integración de coordenadas GPS y captura de fotos en tiempo real asegura que la capacitación y la supervisión ocurrieron en el lugar y momento reportado.
*   **Coherencia de Datos**: Al estar todos los módulos vinculados (Agenda -> Encuesta -> Anexo III -> Anexo IV), se elimina el error humano y la duplicidad de información.
*   **Escalabilidad y Seguridad**: El sistema utiliza tecnología de punta (Next.js + Firebase) que permite el acceso simultáneo de cientos de funcionarios con reglas de seguridad estrictas por ubicación geográfica.

**Resultado Final**: Una herramienta robusta que garantiza la transparencia y mejora la calidad del servicio de capacitación electoral en todo el Paraguay.
