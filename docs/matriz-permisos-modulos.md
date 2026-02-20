
# Informe de Matriz de Permisos y Módulos - Sistema de Gestión CIDEE

Este documento detalla la estructura de seguridad y acceso del sistema, basada en roles jerárquicos y permisos granulares por módulo.

## 1. Jerarquía de Roles

| Rol | Descripción | Nivel de Acceso |
| :--- | :--- | :--- |
| **Administrador** | Control total del sistema y seguridad. | **Total (Global)** |
| **Director** | Supervisión nacional de reportes y estadísticas. | **Nacional (Lectura/PDF)** |
| **Jefe de Oficina** | Gestión de agenda y validación de informes. | **Regional (Gestión)** |
| **Funcionario** | Carga de datos edilicios y locales de votación. | **Local (Operativo)** |
| **Divulgador** | Ejecución de capacitaciones y Anexo III. | **Local (Campo)** |
| **Viewer** | Consulta de datos sin capacidad de edición. | **Limitado (Lectura)** |

---

## 2. Matriz de Módulos por Categoría

El acceso a estos módulos se define en el perfil de cada usuario (`user.profile.modules`).

### A. CIDEE - CAPACITACIONES
*   `solicitud-capacitacion`: Carga del Anexo V (Solicitudes).
*   `agenda-capacitacion`: Visualización y gestión del calendario.
*   `encuesta-satisfaccion`: Registro de feedback ciudadano.
*   `informe-divulgador`: Carga del Anexo III (Marcaciones).
*   `informe-semanal-puntos-fijos`: Consolidado Anexo IV.
*   `estadisticas-capacitacion`: Dashboard analítico de satisfacción.

### B. DGRE (Patrimonio)
*   `control-movimiento-maquinas`: Registro de salida y entrada de equipos.

### C. Registros Electorales (Edilicio)
*   `ficha`: Visualización de ficha técnica por distrito.
*   `fotos`: Galería fotográfica organizada.
*   `cargar-ficha`: Redirección directa al distrito asignado para carga.

### D. Locales de Votación
*   `locales-votacion`: Buscador georreferenciado de locales.
*   `cargar-fotos-locales`: Herramienta de carga masiva de fotos de campo.

### E. Gestión de Datos (Importación)
*   `importar-reportes`: Carga masiva desde Excel de datos edilicios.
*   `importar-locales`: Carga masiva de locales de votación.
*   `importar-partidos`: Gestión del directorio de agrupaciones políticas.

---

## 3. Permisos Granulares (Acciones)

Más allá de ver un módulo, el sistema valida acciones específicas (`user.profile.permissions`):

*   **View**: Permiso básico para entrar al módulo.
*   **Add**: Capacidad de crear nuevos registros (ej. `solicitud:add`).
*   **Edit**: Capacidad de modificar datos existentes (ej. `ficha:edit`).
*   **Delete**: Facultad de eliminar registros (restringido usualmente a Admins).
*   **PDF**: Capacidad de generar documentos oficiales.

### Permisos Especiales de Supervisión:
1.  **admin_filter**: Permite a un usuario no-admin ver datos de **todo el país** (ignora la restricción de distrito asignado).
2.  **assign_staff**: Permite asignar divulgadores a las actividades en la Agenda de Capacitaciones.

---

## 4. Lógica de Seguridad en Base de Datos (Firestore Rules)

El sistema aplica reglas estrictas:
*   Los datos de **Geografía** y **Partidos** son de lectura pública para usuarios logueados, pero solo editables por **Admin**.
*   Las **Solicitudes** y **Movimientos** pueden ser creados por funcionarios, pero solo los **Admins** pueden borrarlos.
*   Los **Perfiles de Usuario** solo pueden ser gestionados íntegramente por el rol **Admin**.
