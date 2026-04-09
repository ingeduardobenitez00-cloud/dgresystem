
"use client";

import { useState, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calendar as CalendarIcon, Save, ShieldCheck, AlertCircle } from 'lucide-react';
import { useUser, useFirebase, useDocOnce, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { cn } from '@/lib/utils';

export default function ConfiguracionSemanalPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: undefined,
    to: undefined,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar configuración actual
  const configRef = useMemoFirebase(() => firestore ? doc(firestore, 'config', 'reporte_semanal') : null, [firestore]);
  const { data: configData, isLoading: isLoadingConfig } = useDocOnce<any>(configRef);

  useEffect(() => {
    if (configData) {
      setDateRange({
        from: configData.fecha_desde ? new Date(configData.fecha_desde + 'T12:00:00') : undefined,
        to: configData.fecha_hasta ? new Date(configData.fecha_hasta + 'T12:00:00') : undefined,
      });
    }
  }, [configData]);

  const handleSaveConfig = async () => {
    if (!firestore || !user) return;
    if (!dateRange?.from || !dateRange?.to) {
      toast({ variant: "destructive", title: "Rango incompleto", description: "Seleccione ambas fechas para el periodo semanal." });
      return;
    }

    setIsSubmitting(true);
    try {
      await setDoc(doc(firestore, 'config', 'reporte_semanal'), {
        fecha_desde: format(dateRange.from, "yyyy-MM-dd"),
        fecha_hasta: format(dateRange.to, "yyyy-MM-dd"),
        actualizado_por: user.profile?.username || user.email,
        ultima_actualizacion: serverTimestamp(),
      });
      toast({ title: "Configuración Guardada", description: "El periodo semanal ha sido actualizado para todo el país." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error al guardar", description: "No se pudo actualizar la configuración global." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isUserLoading || isLoadingConfig) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  const isAdmin = user?.profile?.role === 'admin';

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col bg-muted/10">
        <Header title="Acceso Restringido" />
        <main className="flex-1 p-8 flex items-center justify-center">
          <Card className="max-w-md w-full text-center p-8 border-dashed">
            <AlertCircle className="h-16 w-16 mx-auto text-muted-foreground opacity-20 mb-4" />
            <h2 className="text-xl font-black uppercase text-primary mb-2">Módulo de Administración</h2>
            <p className="text-xs text-muted-foreground font-bold uppercase">Solo los administradores pueden configurar los periodos globales de reporte.</p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Configuración de Fechas" />
      <main className="flex-1 p-4 md:p-8 max-w-2xl mx-auto w-full space-y-8">
        <div>
            <h1 className="text-3xl font-black tracking-tight text-[#1A1A1A] uppercase">Periodo de Reporte</h1>
            <p className="text-muted-foreground text-sm font-medium mt-1">Establezca el rango de fechas que los funcionarios utilizarán para el Informe Semanal.</p>
        </div>

        <Card className="border-none shadow-2xl rounded-[2rem] bg-white overflow-hidden">
          <CardHeader className="bg-black text-white p-8">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" /> CONTROL GLOBAL DE FECHAS
            </CardTitle>
          </CardHeader>
          <CardContent className="p-10 space-y-8 text-center">
            <div className="space-y-4">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Rango Semanal Vigente</p>
                <Popover>
                    <PopoverTrigger asChild>
                        <div className={cn(
                            "h-20 w-full flex items-center justify-center px-6 font-black text-2xl border-4 rounded-[1.5rem] bg-white cursor-pointer hover:border-primary transition-all shadow-inner",
                            !dateRange?.from && "text-muted-foreground/30 border-dashed"
                        )}>
                            <CalendarIcon className="mr-4 h-8 w-8 opacity-20" />
                            {dateRange?.from ? (
                                dateRange.to ? `${format(dateRange.from, "dd/MM/yy")} - ${format(dateRange.to, "dd/MM/yy")}` : format(dateRange.from, "dd/MM/yy")
                            ) : <span>SELECCIONAR RANGO</span>}
                        </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-2xl overflow-hidden" align="center">
                        <Calendar mode="range" selected={dateRange} onSelect={setDateRange} locale={es} initialFocus className="bg-white" />
                    </PopoverContent>
                </Popover>
            </div>

            <div className="bg-muted/30 p-6 rounded-2xl border-2 border-dashed">
                <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed">
                    Al guardar este rango, todos los funcionarios del país verán estas fechas precargadas en su módulo de "Informe Semanal de Registro".
                </p>
            </div>
          </CardContent>
          <CardFooter className="p-0 border-t">
            <Button onClick={handleSaveConfig} disabled={isSubmitting || !dateRange?.from || !dateRange?.to} className="w-full h-20 text-xl font-black uppercase rounded-none tracking-widest bg-black hover:bg-black/90">
                {isSubmitting ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : <Save className="mr-3 h-6 w-6" />}
                PUBLICAR RANGO NACIONAL
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
