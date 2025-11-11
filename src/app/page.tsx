
'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BookMarked, FileText, BarChart3, Users, Settings } from 'lucide-react';
import Header from '@/components/header';

const menuItems = [
  {
    href: '/ficha',
    label: 'Vista de Ficha',
    icon: FileText,
    description: 'Consulta informes detallados e imágenes por distrito.',
  },
  {
    href: '/resumen',
    label: 'Resumen',
    icon: BarChart3,
    description: 'Explora un resumen detallado de los informes.',
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

export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Panel Principal" />
      <main className="flex-1 p-4 sm:p-6 md:p-8">
        <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Bienvenido al Informe Edilicio
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
                Selecciona una sección para empezar a trabajar.
            </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((item) => (
            <Link href={item.href} key={item.href} className="group">
              <Card className="h-full transition-all duration-200 ease-in-out group-hover:shadow-lg group-hover:border-primary/50 group-hover:-translate-y-1">
                <CardHeader className="flex flex-row items-center gap-4">
                  <item.icon className="h-8 w-8 text-primary" />
                  <div>
                    <CardTitle>{item.label}</CardTitle>
                    <CardDescription className="mt-1">
                      {item.description}
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
