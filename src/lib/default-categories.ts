export interface ModuleCategory {
  id: string;
  label: string;
  description: string;
  modules: string[];
  orden: number;
}

export const DEFAULT_CATEGORIES: ModuleCategory[] = [
  {
    id: "cidee-capacitaciones",
    label: "CIDEE - CAPACITACIONES",
    description: "Planificación de capacitaciones, control de inventario de máquinas, denuncias de lacres y reportes del personal del CIDEE.",
    modules: [
      'calendario-capacitaciones',
      'anexo-i',
      'lista-anexo-i',
      'puntos-fijos',
      'solicitud-capacitacion',
      'agenda-anexo-i',
      'agenda-anexo-v',
      'maquinas',
      'control-movimiento-maquinas',
      'denuncia-lacres',
      'informe-movimientos-denuncias',
      'informe-divulgador',
      'galeria-capacitaciones',
      'informe-semanal-puntos-fijos',
      'lista-anexo-iv',
      'archivo-capacitaciones',
      'archivo-anexo-i',
      'archivo-anexo-v',
      'divulgadores',
      'encuesta-satisfaccion'
    ],
    orden: 1
  },
  {
    id: "registros-electorales",
    label: "REGISTROS ELECTORALES",
    description: "Carga de fichas distritales, galerías fotográficas del proceso de inscripción, informes semanales del Registro Electoral y actas de defunción.",
    modules: [
      'ficha',
      'fotos',
      'cargar-ficha',
      'configuracion-semanal',
      'informe-semanal-registro',
      'reporte-semanal-registro',
      'archivo-semanal-registro',
      'acta-defuncion'
    ],
    orden: 2
  },
  {
    id: "analisis-y-reportes",
    label: "ANÁLISIS Y REPORTES",
    description: "Consolidados ejecutivos de cobertura, exportaciones en formato PDF e informes estadísticos avanzados.",
    modules: [
      'resumen',
      'informe-general',
      'reportes-pdf',
      'compendio-general',
      'informe-cidee',
      'estadisticas-solicitudes'
    ],
    orden: 3
  },
  {
    id: "locales-de-votacion",
    label: "LOCALES DE VOTACIÓN",
    description: "Buscador avanzado de locales y georreferenciación y módulo de carga masiva de fotos.",
    modules: [
      'locales-votacion',
      'cargar-fotos-locales'
    ],
    orden: 4
  },
  {
    id: "gestion-de-datos",
    label: "Gestión de Datos",
    description: "Herramientas de importación masiva de reportes, locales y partidos políticos.",
    modules: [
      'importar-reportes',
      'importar-locales',
      'importar-partidos'
    ],
    orden: 5
  },
  {
    id: "depuraciones",
    label: "DEPURACIONES",
    description: "Módulos de depuración, optimización de base de datos y tareas de limpieza.",
    modules: [],
    orden: 6
  },
  {
    id: "sistema",
    label: "SISTEMA",
    description: "Administración de usuarios, monitoreo de conexiones en tiempo real, auditoría técnica y configuración.",
    modules: [
      'users',
      'conexiones',
      'settings',
      'documentacion',
      'auditoria'
    ],
    orden: 7
  }
];
