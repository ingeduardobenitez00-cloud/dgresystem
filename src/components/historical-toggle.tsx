"use client";

import { useElectionPeriod, ElectionPeriod } from "@/context/election-period-context";
import { Archive, History, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

interface HistoricalToggleProps {
  isHistorical?: boolean;
  setIsHistorical?: (val: boolean) => void;
  period?: ElectionPeriod;
  setPeriod?: (val: ElectionPeriod) => void;
  isAdmin?: boolean;
  className?: string;
}

// Bandera global para habilitar el selector de periodos electorales
const FEATURE_FLAG_HISTORIAL_ENABLED = true;

export function HistoricalToggle({
  isHistorical: propIsHistorical,
  setIsHistorical: propSetIsHistorical,
  period: propPeriod,
  setPeriod: propSetPeriod,
  isAdmin = true,
  className
}: HistoricalToggleProps) {
  const context = useElectionPeriod();

  if (!isAdmin || !FEATURE_FLAG_HISTORIAL_ENABLED) return null;

  const currentPeriod: ElectionPeriod =
    propPeriod ??
    context?.period ??
    (propIsHistorical ? 'internas' : 'actual');

  const handleSelect = (selected: ElectionPeriod) => {
    if (propSetPeriod) {
      propSetPeriod(selected);
    }
    if (context?.setPeriod) {
      context.setPeriod(selected);
    }
    if (propSetIsHistorical) {
      propSetIsHistorical(selected !== 'actual');
    }
  };

  return (
    <div className={cn(
      "flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white p-2 sm:p-2.5 rounded-2xl border-2 shadow-sm transition-all",
      currentPeriod === 'actual' ? "border-emerald-200 bg-emerald-50/20" :
      currentPeriod === 'generales' ? "border-indigo-300 bg-indigo-50/25" :
      "border-amber-300 bg-amber-50/25",
      className
    )}>
      {/* Indicador del Periodo Seleccionado */}
      <div className="flex items-center gap-2.5 px-2 py-1">
        <div className={cn(
          "h-9 w-9 rounded-xl flex items-center justify-center transition-all shadow-sm shrink-0",
          currentPeriod === 'actual' ? "bg-emerald-600 text-white shadow-emerald-200" :
          currentPeriod === 'generales' ? "bg-indigo-600 text-white shadow-indigo-200" :
          "bg-amber-600 text-white shadow-amber-200"
        )}>
          {currentPeriod === 'actual' ? <Scale className="h-4.5 w-4.5" /> :
           currentPeriod === 'generales' ? <Archive className="h-4.5 w-4.5" /> :
           <History className="h-4.5 w-4.5" />}
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md",
              currentPeriod === 'actual' ? "bg-emerald-100 text-emerald-800" :
              currentPeriod === 'generales' ? "bg-indigo-100 text-indigo-800" :
              "bg-amber-100 text-amber-800"
            )}>
              {currentPeriod === 'actual' ? "PROCESO ACTIVO" : "HISTORIAL ARCHIVADO"}
            </span>
          </div>
          <span className="text-[10px] font-black text-foreground uppercase tracking-tight mt-0.5">
            {currentPeriod === 'actual' ? "CONSEJO DE LA MAGISTRATURA" :
             currentPeriod === 'generales' ? "ELECCIONES GENERALES 2026" :
             "ELECCIONES INTERNAS 2026"}
          </span>
        </div>
      </div>

      {/* Botones de Selección */}
      <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl w-full sm:w-auto self-stretch sm:self-auto">
        {/* Consejo de la Magistratura (Actual) */}
        <button
          type="button"
          onClick={() => handleSelect('actual')}
          className={cn(
            "flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer",
            currentPeriod === 'actual'
              ? "bg-white text-emerald-700 shadow-sm border border-emerald-300 font-black"
              : "text-muted-foreground hover:text-foreground hover:bg-white/50"
          )}
          title="Ver datos activos: Elecciones del Consejo de la Magistratura"
        >
          <Scale className="h-3 w-3" />
          <span>ACTUAL</span>
          {currentPeriod === 'actual' && (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </button>

        {/* Generales 2026 */}
        <button
          type="button"
          onClick={() => handleSelect('generales')}
          className={cn(
            "flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer",
            currentPeriod === 'generales'
              ? "bg-white text-indigo-700 shadow-sm border border-indigo-300 font-black"
              : "text-muted-foreground hover:text-foreground hover:bg-white/50"
          )}
          title="Ver datos archivados de Elecciones Generales 2026"
        >
          <Archive className="h-3 w-3" />
          <span>GENERALES</span>
        </button>

        {/* Internas 2026 */}
        <button
          type="button"
          onClick={() => handleSelect('internas')}
          className={cn(
            "flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer",
            currentPeriod === 'internas'
              ? "bg-white text-amber-700 shadow-sm border border-amber-300 font-black"
              : "text-muted-foreground hover:text-foreground hover:bg-white/50"
          )}
          title="Ver datos archivados de Elecciones Internas 2026"
        >
          <History className="h-3 w-3" />
          <span>INTERNAS</span>
        </button>
      </div>
    </div>
  );
}
