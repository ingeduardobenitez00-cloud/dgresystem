
"use client";

import { useMemo, useState } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useUser, useFirebase, useCollectionOnce, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where, getDocs } from 'firebase/firestore';
import { type InformeSemanalRegistro } from '@/lib/data';
import { 
    Loader2, 
    Archive, 
    Calendar, 
    Download, 
    FileSpreadsheet, 
    Users, 
    Building2,
    ChevronRight,
    MapPin,
    History
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateToDDMMYYYY, cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';

type ArchivoSemanal = {
    id: string;
    fecha_desde: string;
    fecha_hasta: string;
    total_informes: number;
    usuario_id: string;
    usuario_nombre: string;
    fecha_archivado: string;
};

export default function ArchivoSemanalesRegistroPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const profile = user?.profile;
  const isAdmin = !!user?.isAdmin;

  // Cargar lista de semanas archivadas
  const archivosQuery = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(collection(firestore, 'archivos-semanales-registro'), orderBy('fecha_archivado', 'desc'));
  }, [firestore, isAdmin]);

  const { data: archivos, isLoading: isLoadingArchivos } = useCollectionOnce<ArchivoSemanal>(archivosQuery);

  const handleExportExcel = async (archivo: ArchivoSemanal) => {
    if (!firestore) return;
    setIsExporting(archivo.id);
    
    try {
        // Consultar todos los informes pertenecientes a este archivo
        const q = query(
            collection(firestore, 'informes-semanales-registro'), 
            where('id_archivo', '==', archivo.id)
        );
        const snap = await getDocs(q);
        
        // FILTRO: Excluir Sede Central de la exportación Excel
        const informes = snap.docs
            .map(d => ({ ...d.data() } as InformeSemanalRegistro))
            .filter(inf => inf.departamento !== 'SEDE CENTRAL');

        if (informes.length === 0) {
            toast({ variant: 'destructive', title: "Sin datos regionales", description: "No se encontraron informes de registros regionales para este archivo." });
            return;
        }

        // Estructurar datos para Excel
        const excelData = informes.map(inf => ({
            'DEPARTAMENTO': inf.departamento,
            'DISTRITO': inf.distrito,
            'FECHA DESDE': formatDateToDDMMYYYY(inf.fecha_desde),
            'FECHA HASTA': formatDateToDDMMYYYY(inf.fecha_hasta),
            'INSCRIPCIONES 1RA VEZ': inf.inscripciones_1ra_vez,
            'ACTUALIZACION DATOS': inf.actualizacion_datos,
            'CAMBIO LOCAL': inf.cambio_local,
            'CAMBIO DISTRITO': inf.cambio_distrito,
            'TOTAL TRAMITES': inf.inscripciones_1ra_vez + inf.actualizacion_datos + inf.cambio_local + inf.cambio_distrito,
            'CANT. ORGANIZACIONES': inf.organizaciones_asistidas?.length || 0,
            'DETALLE ORGANIZACIONES': inf.organizaciones_asistidas?.map(o => `[${o.tipo}: ${o.nombre}]`).join('; ') || 'NINGUNA'
        })).sort((a,b) => a.DEPARTAMENTO.localeCompare(b.DEPARTAMENTO) || a.DISTRITO.localeCompare(b.DISTRITO));

        // Crear Libro de Excel
        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Informes Semanales Regionales");

        // Ajustar anchos de columna automáticamente
        const wscols = [
            {wch: 25}, {wch: 25}, {wch: 15}, {wch: 15}, {wch: 20}, {wch: 20}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 20}, {wch: 50}
        ];
        ws['!cols'] = wscols;

        XLSX.writeFile(wb, `Archivo-Registro-REGIONAL-${archivo.fecha_desde}-al-${archivo.fecha_hasta}.xlsx`);
        toast({ title: "Excel Generado (Regional)", description: "El reporte regional se ha descargado correctamente." });
    } catch (e) {
        toast({ variant: 'destructive', title: "Error de exportación" });
    } finally {
        setIsExporting(null);
    }
  };

  if (isUserLoading || isLoadingArchivos) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
        <Header title="Acceso Restringido" />
        <main className="flex-1 p-8 flex items-center justify-center">
          <Card className="max-w-md w-full text-center p-12 border-dashed rounded-[3rem]">
            <Archive className="h-20 w-20 mx-auto text-muted-foreground opacity-20 mb-6" />
            <h2 className="text-2xl font-black uppercase text-primary mb-2">Archivo Administrativo</h2>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Este módulo es exclusivo para la administración nacional.</p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Archivo de Semanas Cerradas" />
      <main className="flex-1 p-4 md:p-8 max-5xl mx-auto w-full space-y-8">
        
        <div>
            <h1 className="text-3xl font-black tracking-tight text-primary uppercase leading-none">Histórico de Registro</h1>
            <p className="text-muted-foreground text-[10px] font-bold uppercase flex items-center gap-2 mt-2 tracking-widest">
                <History className="h-3.5 w-3.5" /> Semanas archivadas y cerradas para auditoría externa (Filtrado Regional)
            </p>
        </div>

        {archivos?.length === 0 ? (
            <Card className="p-24 text-center border-4 border-dashed bg-white rounded-[3rem]">
                <div className="flex flex-col items-center justify-center opacity-20">
                    <Archive className="h-24 w-24 mb-6" />
                    <p className="font-black uppercase tracking-[0.2em] text-lg">No hay semanas archivadas aún</p>
                    <p className="text-xs font-bold mt-2">Los informes se guardan aquí tras el cierre administrativo semanal.</p>
                </div>
            </Card>
        ) : (
            <div className="grid grid-cols-1 gap-6">
                {archivos?.map((archivo) => (
                    <Card key={archivo.id} className="border-none shadow-xl overflow-hidden rounded-[2.5rem] bg-white group hover:shadow-2xl transition-all duration-500">
                        <div className="flex flex-col md:flex-row items-stretch">
                            <div className="bg-black text-white p-10 flex flex-col justify-center items-center md:w-64 shrink-0 gap-2">
                                <Archive className="h-10 w-10 opacity-40 mb-2" />
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">ID ARCHIVO</span>
                                <span className="font-black text-lg tracking-tighter">{archivo.id}</span>
                            </div>
                            
                            <div className="flex-1 p-10 space-y-8">
                                <div className="flex flex-col md:flex-row justify-between gap-6">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <Calendar className="h-6 w-6 text-primary" />
                                            <div>
                                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">PERIODO DE LA SEMANA</p>
                                                <h2 className="text-xl font-black uppercase text-[#1A1A1A]">
                                                    {formatDateToDDMMYYYY(archivo.fecha_desde)} AL {formatDateToDDMMYYYY(archivo.fecha_hasta)}
                                                </h2>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Users className="h-6 w-6 text-primary opacity-40" />
                                            <div>
                                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">RESPONSABLE CIERRE</p>
                                                <p className="font-bold text-sm uppercase">{archivo.usuario_nombre}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center justify-center px-8 py-4 bg-[#F8F9FA] rounded-3xl border-2 border-dashed">
                                        <Building2 className="h-5 w-5 text-primary opacity-30 mb-1" />
                                        <p className="text-3xl font-black text-primary leading-none">{archivo.total_informes}</p>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">INFORMES CAPTURADOS</p>
                                    </div>
                                </div>

                                <div className="pt-6 border-t flex flex-col md:flex-row items-center justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                            Archivado el {formatDateToDDMMYYYY(archivo.fecha_archivado.split('T')[0])}
                                        </span>
                                    </div>
                                    <Button 
                                        onClick={() => handleExportExcel(archivo)} 
                                        disabled={isExporting === archivo.id}
                                        className="h-14 px-10 rounded-2xl font-black uppercase text-xs gap-3 shadow-xl bg-green-600 hover:bg-green-700 text-white w-full md:w-auto"
                                    >
                                        {isExporting === archivo.id ? <Loader2 className="animate-spin h-5 w-5" /> : <FileSpreadsheet className="h-5 w-5" />}
                                        EXPORTAR DATOS REGIONALES
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        )}

        <div className="text-center pb-12 pt-8">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40 italic leading-relaxed">
                * Nota: Los informes de la Sede Central se omiten automáticamente de estas exportaciones para cumplir con el estándar regional.
            </p>
        </div>
      </main>
    </div>
  );
}
