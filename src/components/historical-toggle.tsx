"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Archive, History } from "lucide-react";
import { cn } from "@/lib/utils";

interface HistoricalToggleProps {
  isHistorical: boolean;
  setIsHistorical: (val: boolean) => void;
  isAdmin: boolean;
  className?: string;
}

// Cambiar a 'true' cuando se haya realizado el reseteo para mostrar el botón de historial
const FEATURE_FLAG_HISTORIAL_ENABLED = false;

export function HistoricalToggle({ isHistorical, setIsHistorical, isAdmin, className }: HistoricalToggleProps) {
  if (!isAdmin || !FEATURE_FLAG_HISTORIAL_ENABLED) return null;

  return (
    <div className={cn("flex items-center gap-3 bg-white p-3 rounded-2xl border-2 border-dashed shadow-sm transition-colors", isHistorical ? "border-primary/50 bg-primary/5" : "border-muted", className)}>
      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center transition-colors", isHistorical ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
        {isHistorical ? <History className="h-5 w-5" /> : <Archive className="h-5 w-5" />}
      </div>
      <div className="flex flex-col">
        <Label htmlFor="historical-mode" className={cn("text-[10px] font-black uppercase tracking-widest cursor-pointer", isHistorical ? "text-primary" : "text-muted-foreground")}>
          {isHistorical ? "VIENDO HISTORIAL" : "MODO HISTORIAL"}
        </Label>
        <span className="text-[8px] font-bold text-muted-foreground uppercase">
          {isHistorical ? "INTERNAS 2026" : "VER INTERNAS 2026"}
        </span>
      </div>
      <Switch
        id="historical-mode"
        checked={isHistorical}
        onCheckedChange={setIsHistorical}
        className="ml-4 data-[state=checked]:bg-primary"
      />
    </div>
  );
}
