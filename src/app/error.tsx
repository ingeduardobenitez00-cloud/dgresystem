'use client'

import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Registro técnico del error
    console.error('SISTEMA - ERROR:', error);
    
    const isChunkError = error.message?.toLowerCase().includes('chunk') || 
                       error.message?.toLowerCase().includes('loading') ||
                       error.message?.toLowerCase().includes('manifest') ||
                       error.digest?.includes('chunk');

    if (isChunkError) {
        const params = new URLSearchParams(window.location.search);
        const retry = parseInt(params.get('retry') || '0');
        
        if (retry < 2) {
            // Recarga automática silenciosa
            const nextRetry = retry + 1;
            window.location.href = `${window.location.origin}${window.location.pathname}?v=${Date.now()}&retry=${nextRetry}`;
        }
    }
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary opacity-20" />
        <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground animate-pulse">
            Sincronizando Versión...
        </p>
        <button 
          onClick={() => window.location.href = '/'}
          className="text-[9px] uppercase font-bold text-primary underline"
        >
          Volver al Inicio
        </button>
      </div>
    </div>
  )
}
