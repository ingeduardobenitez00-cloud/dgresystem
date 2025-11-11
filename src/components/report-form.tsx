
"use client";

import { useForm } from 'react-hook-form';
import { type ReportData } from '@/lib/data';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Building, MapPin } from 'lucide-react';
import { useEffect } from 'react';

interface ReportFormProps {
    initialData?: ReportData | null;
    onSubmit?: (data: Omit<ReportData, 'id'>) => void;
    readOnly?: boolean;
    departamento?: string;
    distrito?: string;
    children?: React.ReactNode;
}

export function ReportForm({ initialData, onSubmit, readOnly = false, departamento, distrito, children }: ReportFormProps) {
    const { register, handleSubmit, reset } = useForm<Omit<ReportData, 'id'>>({
        defaultValues: initialData || {},
    });

    useEffect(() => {
        reset(initialData || {});
    }, [initialData, reset]);

    const handleFormSubmit = (data: Omit<ReportData, 'id'>) => {
        if (onSubmit) {
            const finalData = {
                ...data,
                departamento: departamento || initialData?.departamento || '',
                distrito: distrito || initialData?.distrito || '',
            };
            onSubmit(finalData);
        }
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <div className="space-y-2">
                    <Label htmlFor="estado-fisico">Estado Físico</Label>
                    <div className="relative">
                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="estado-fisico" {...register('estado-fisico')} readOnly={readOnly} className="pl-9" />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="cantidad-habitaciones">Cantidad de Habitaciones</Label>
                    <Input id="cantidad-habitaciones" {...register('cantidad-habitaciones')} readOnly={readOnly} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="habitacion-segura">Habitación Segura</Label>
                    <Input id="habitacion-segura" {...register('habitacion-segura')} readOnly={readOnly} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="dimensiones-habitacion">Dimensiones Habitación</Label>
                    <Input id="dimensiones-habitacion" {...register('dimensiones-habitacion')} readOnly={readOnly} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="cantidad-maquinas">Cantidad de Máquinas</Label>
                    <Input id="cantidad-maquinas" {...register('cantidad-maquinas')} readOnly={readOnly} />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="lugar-resguardo">Lugar de Resguardo</Label>
                    <div className="relative">
                         <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="lugar-resguardo" {...register('lugar-resguardo')} readOnly={readOnly} className="pl-9" />
                    </div>
                </div>
                <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="descripcion-situacion">Descripción</Label>
                    <Textarea id="descripcion-situacion" {...register('descripcion-situacion')} readOnly={readOnly} rows={3} />
                </div>
                <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="caracteristicas-habitacion">Características Habitación</Label>
                    <Textarea id="caracteristicas-habitacion" {...register('caracteristicas-habitacion')} readOnly={readOnly} rows={3} />
                </div>
            </div>
            {children}
        </form>
    );
}
