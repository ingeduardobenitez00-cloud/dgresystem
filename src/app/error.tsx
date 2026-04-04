
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, AlertCircle, ShieldAlert, Loader2 } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Registro técnico del error para auditoría silenciosa
    console.error('SISTEMA - ERROR CRÍTICO DETECTADO:', error)
    
    // Si es un error de carga de componentes (común tras publicar), recargamos automáticamente
    // Solo si no estamos ya en un proceso de sincronización para evitar bucles infinitos
    const isChunkError = error.message?.toLowerCase().includes('chunk') || 
                       error.message?.toLowerCase().includes('loading') ||
                       error.message?.toLowerCase().includes('manifest');

    if (isChunkError && !window.location.search.includes('v=')) {
        console.warn('Inconsistencia de versión detectada. Sincronizando automáticamente...');
        handleSync();
    }
  }, [error])

  const handleSync = async () => {
    setIsSyncing(true);
    try {
        console.log('Iniciando limpieza profunda de caché y service workers...');
        
        // 1. Desregistrar Service Workers (si existen)
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
                console.log('Service Worker desregistrado');
            }
        }

        // 2. Limpiar Cache Storage
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            for (const cacheName of cacheNames) {
                await caches.delete(cacheName);
                console.log('Caché eliminado:', cacheName);
            }
        }

        // 3. Limpiar localStorage de control de versiones si existiera (opcional)
        // localStorage.removeItem('app-version');

    } catch (e) {
        console.error('Error durante la sincronización:', e);
    } finally {
        // 4. Forzar recarga total ignorando la caché del navegador
        // Usamos una semilla de tiempo para asegurar que el servidor entregue la versión fresca
        const separator = window.location.href.includes('?') ? '&' : '?';
        window.location.href = window.location.origin + window.location.pathname + separator + 'v=' + Date.now();
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-[#F8F9FA] text-center">
      <div className="max-w-md w-full animate-in fade-in zoom-in duration-500">
        <div className="h-24 w-24 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-8 border-4 border-destructive/20 shadow-lg">
            <ShieldAlert className="h-12 w-12 text-destructive" />
        </div>
        
        <div className="space-y-4 mb-10">
            <h1 className="text-2xl font-black uppercase text-primary tracking-tight leading-none">Error de Versión</h1>
            <p className="text-xs font-bold uppercase text-muted-foreground leading-relaxed px-4">
                Se han detectado actualizaciones recientes en el sistema que requieren una sincronización de memoria en su dispositivo.
            </p>
        </div>

        <div className="bg-white p-8 border-2 rounded-[2rem] shadow-2xl space-y-6">
            <Button 
                onClick={handleSync}
                disabled={isSyncing}
                className="w-full h-16 bg-black hover:bg-black/90 text-white font-black uppercase text-sm shadow-xl gap-3 rounded-2xl disabled:opacity-70"
            >
                {isSyncing ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                    <RefreshCw className="h-5 w-5" />
                )}
                {isSyncing ? 'Sincronizando...' : 'Sincronizar y Reiniciar'}
            </Button>
            
            <div className="flex items-center gap-3 bg-muted/30 p-4 rounded-xl text-left border">
                <AlertCircle className="h-5 w-5 text-primary opacity-40 shrink-0" />
                <p className="text-[10px] font-medium uppercase text-muted-foreground italic">
                    Esta acción instalará la última versión del sistema y corregirá cualquier error de navegación automáticamente.
                </p>
            </div>
        </div>

        <footer className="mt-12 opacity-40">
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                Justicia Electoral - República del Paraguay - 2026
            </p>
        </footer>
      </div>
    </div>
  )
}
