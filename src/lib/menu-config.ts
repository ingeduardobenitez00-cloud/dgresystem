
import { FileText, BarChart3, Users, Settings, FileArchive, UploadCloud, ImageIcon, FileUp, Vote, CalendarDays, ClipboardCheck, MessageSquareHeart, UserCheck } from 'lucide-react';

export const dashboardMenuItems = [
  {
    href: '/ficha',
    label: 'Vista de Ficha',
    icon: FileText,
    description: 'Consulta informes detallados e imágenes por distrito.',
  },
  {
    href: '/fotos',
    label: 'Imágenes',
    icon: ImageIcon,
    description: 'Explora y gestiona las imágenes de los registros.',
  },
  {
    href: '/cargar-ficha',
    label: 'Cargar Ficha',
    icon: UploadCloud,
    description: 'Accede a tu distrito asignado para cargar datos.',
  },
  {
    href: '/solicitud-capacitacion',
    label: 'Nueva Solicitud',
    icon: ClipboardCheck,
    description: 'Crea una nueva solicitud de capacitación con firma.',
  },
  {
    href: '/agenda-capacitacion',
    label: 'Agenda',
    icon: CalendarDays,
    description: 'Visualiza el calendario de capacitaciones agendadas.',
  },
  {
    href: '/encuesta-satisfaccion',
    label: 'Encuesta Satisfacción',
    icon: MessageSquareHeart,
    description: 'Formulario de encuesta sobre el uso de la máquina.',
  },
  {
    href: '/informe-divulgador',
    label: 'Informe del Divulgador',
    icon: UserCheck,
    description: 'Control individual de marcaciones por ciudadano (Anexo III).',
  },
  {
    href: '/resumen',
    label: 'Resumen',
    icon: BarChart3,
    description: 'Explora un resumen detallado de los informes.',
  },
  {
    href: '/informe-general',
    label: 'Informe General',
    icon: FileArchive,
    description: 'Genera un PDF consolidado de todos los distritos.',
  },
  {
    href: '/importar-reportes',
    label: 'Importar Reportes',
    icon: FileUp,
    description: 'Importa datos de informes desde un archivo Excel.',
  },
  {
    href: '/importar-locales',
    label: 'Importar Locales',
    icon: FileUp,
    description: 'Importa locales de votación desde un archivo Excel.',
  },
  {
    href: '/cargar-fotos-locales',
    label: 'Cargar Fotos Locales',
    icon: UploadCloud,
    description: 'Sube un lote de fotos para los locales de votación.',
  },
  {
    href: '/locales-votacion',
    label: 'Locales de Votación',
    icon: Vote,
    description: 'Consulta los locales de votación importados.',
  },
  {
    href: '/users',
    label: 'Usuarios',
    icon: Users,
    description: 'Gestiona los usuarios y sus permisos en el sistema.',
  },
  {
    href: '/settings',
    label: 'Configuración',
    icon: Settings,
    description: 'Importa datos geográficos y configura la aplicación.',
  },
];
