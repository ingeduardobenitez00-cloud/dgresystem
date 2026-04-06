'use client'

import { Button } from '@/components/ui/button'
import { RefreshCw, AlertTriangle, Home } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-[#F8F9FA] text-center">
      <div className="max-w-md w-full animate-in fade-in zoom-in duration-500">
        <div className="h-20 w-20 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-8 border-4 border-orange-200">
            <AlertTriangle className="h-10 w-10 text-orange-500" />
        </div>
        
        <div className="space-y-4 mb-10">
            <h1 className="text-xl font-black uppercase text-primary tracking-tight">Interrupción del Sistema</h1>
            <p className="text-[10px] font-bold uppercase text-muted-foreground leading-relaxed px-4">
                Se ha producido un error inesperado al cargar este módulo.
            </p>
            {error.message && (
                <div className="bg-muted/50 p-3 rounded-lg border border-muted-foreground/10 mx-4">
                    <p className="text-[9px] font-mono text-muted-foreground break-all">
                        {error.message.substring(0, 150)}
                    </p>
                </div>
            )}
        </div>

        <div className="space-y-3">
            <Button 
                onClick={() => reset()}
                className="w-full h-14 bg-black hover:bg-black/90 text-white font-black uppercase text-xs shadow-xl gap-3 rounded-xl"
            >
                <RefreshCw className="h-4 w-4" /> Reintentar Carga
            </Button>
            
            <Button 
                variant="outline"
                onClick={() => window.location.href = '/'}
                className="w-full h-14 border-2 font-black uppercase text-xs gap-3 rounded-xl"
            >
                <Home className="h-4 w-4" /> Ir al Panel Principal
            </Button>
        </div>

        <footer className="mt-12 opacity-40">
            <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest leading-none">
                Justicia Electoral - República del Paraguay<br/>
                Soporte Técnico CIDEE 2026
            </p>
        </footer>
      </div>
    </div>
  )
}
