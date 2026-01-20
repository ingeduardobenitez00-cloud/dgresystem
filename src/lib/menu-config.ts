import { FileText, BarChart3, Users, Settings, FileArchive, UploadCloud, ImageIcon } from 'lucide-react';

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
    href: '/users',
    label: 'Usuarios',
    icon: Users,
    description: 'Gestiona los usuarios y sus permisos en el sistema.',
  },
  {
    href: '/settings',
    label: 'Configuración',
    icon: Settings,
    description: 'Importa datos y configura la aplicación.',
  },
];
