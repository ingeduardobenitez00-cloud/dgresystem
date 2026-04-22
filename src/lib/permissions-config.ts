export const ACTION_LABELS = [
  { id: 'view', label: 'VER' },
  { id: 'add', label: 'GUARDAR' },
  { id: 'edit', label: 'EDITAR' },
  { id: 'delete', label: 'BORRAR' },
  { id: 'pdf', label: 'PDF' },
];

export const MODULE_STRUCTURE = [
  {
    category: "CIDEE - CAPACITACIONES",
    items: [
      { id: 'calendario-capacitaciones', label: 'CALENDARIO MENSUAL' },
      { id: 'anexo-i', label: 'ANEXO I - LUGARES FIJOS' },
      { id: 'lista-anexo-i', label: 'LISTADO DE ANEXO I' },
      { id: 'solicitud-capacitacion', label: 'ANEXO V - SOLICITUDES' },
      { id: 'agenda-anexo-i', label: 'AGENDA ANEXO I' },
      { id: 'agenda-anexo-v', label: 'AGENDA ANEXO V' },
      { id: 'maquinas', label: 'INVENTARIO DE MÁQUIS' },
      { id: 'control-movimiento-maquinas', label: 'MOVIMIENTO DE MÁQUINAS' },
      { id: 'denuncia-lacres', label: 'DENUNCIA DE LACRES' },
      { id: 'informe-movimientos-denuncias', label: 'TRAZABILIDAD LOGÍSTICA' },
      { id: 'informe-divulgador', label: 'ANEXO III - INFORME DEL DIVULGADOR' },
      { id: 'galeria-capacitaciones', label: 'GALERÍA DE EVIDENCIAS' },
      { id: 'informe-semanal-puntos-fijos', label: 'ANEXO IV - INFORME SEMANAL' },
      { id: 'lista-anexo-iv', label: 'LISTADO DE ANEXO IV' },
      { id: 'divulgadores', label: 'DIRECTORIO DIVULGADORES' },
      { id: 'estadisticas-capacitacion', label: 'ESTADÍSTICAS CIDEE' },
      { id: 'encuesta-satisfaccion', label: 'ANEXO II - ENCUESTA DE SATISFACCIÓN' },
      { id: 'archivo-capacitaciones', label: 'HISTORIAL / ARCHIVO' },
    ]
  },
  {
    category: "REGISTROS ELECTORALES",
    items: [
      { id: 'ficha', label: 'VISTA DE FICHA' },
      { id: 'fotos', label: 'GALERÍA FOTOGRÁFICA' },
      { id: 'cargar-ficha', label: 'CARGAR FICHA' },
      { id: 'configuracion-semanal', label: 'CONFIGURACIÓN FECHAS' },
      { id: 'informe-semanal-registro', label: 'INF. SEMANAL REGISTRO' },
      { id: 'reporte-semanal-registro', label: 'MONITOR DE INFORMES' },
      { id: 'archivo-semanal-registro', label: 'ARCHIVO DE INFORMES' },
    ]
  },
  {
    category: "ANÁLISIS Y REPORTES",
    items: [
      { id: 'resumen', label: 'RESUMEN UBICACIONES' },
      { id: 'informe-general', label: 'INFORME GENERAL PDF' },
      { id: 'reportes-pdf', label: 'REPORTES PDF Y ESTADÍSTICAS' },
      { id: 'estadisticas-solicitudes', label: 'ESTADÍSTICAS SOLICITUDES' },
      { id: 'informe-territorial', label: 'INFORME TERRITORIAL' },
      { id: 'conexiones', label: 'MONITOREO CONEXIONES' },
    ]
  },
  {
    category: "LOCALES DE VOTACIÓN",
    items: [
      { id: 'locales-votacion', label: 'BUSCADOR DE LOCALES' },
      { id: 'cargar-fotos-locales', label: 'CARGAR FOTOS LOTE' },
    ]
  },
  {
    category: "SISTEMA",
    items: [
      { id: 'users', label: 'GESTIÓN USUARIOS' },
      { id: 'settings', label: 'CONFIGURACIÓN' },
      { id: 'documentacion', label: 'DOCUMENTACIÓN' },
      { id: 'auditoria', label: 'AUDITORÍA DEL SISTEMA' },
    ]
  }
];

export const GLOBAL_PERMS = [
  { id: 'admin_filter', label: 'FILTRO NACIONAL' },
  { id: 'department_filter', label: 'FILTRO DEPARTAMENTAL' },
  { id: 'district_filter', label: 'FILTRO DISTRITAL' },
  { id: 'assign_staff', label: 'ASIGNAR PERSONAL' },
];
