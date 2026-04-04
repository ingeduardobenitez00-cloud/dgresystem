
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import 'leaflet/dist/leaflet.css';
import 'leaflet-geosearch/dist/geosearch.css';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import AppLayout from '@/components/app-layout';

const inter = Inter({ 
  subsets: ['latin'], 
  variable: '--font-sans',
  display: 'swap',
  preload: true,
});

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: {
    default: 'Justicia Electoral | Sistema de Gestión',
    template: '%s | Justicia Electoral',
  },
  description: 'Sistema oficial de gestión de informes y capacitaciones.',
  keywords: ['justicia electoral', 'paraguay', 'capacitación'],
  authors: [{ name: 'Justicia Electoral' }],
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo1.png',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Sistema de Gestión',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/logo1.png" />
        {/* SCRIPT DE AUTO-RECUPERACIÓN DE VERSIÓN REFORZADO */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var handleVersionError = function(e) {
              var message = e.message || (e.reason && e.reason.message) || "";
              if (/chunk|loading|manifest/i.test(message)) {
                if (!window.location.search.includes('v=')) {
                  console.warn('Inconsistencia de versión detectada. Sincronizando...');
                  var separator = window.location.href.indexOf('?') !== -1 ? '&' : '?';
                  window.location.href = window.location.origin + window.location.pathname + separator + 'v=' + Date.now();
                }
              }
            };
            window.addEventListener('error', handleVersionError, true);
            window.addEventListener('unhandledrejection', handleVersionError);
          })();
        ` }} />
      </head>
      <body
        className={cn(
          'min-h-screen bg-background font-sans antialiased',
          inter.variable
        )}
      >
        <FirebaseClientProvider>
          <AppLayout>{children}</AppLayout>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
