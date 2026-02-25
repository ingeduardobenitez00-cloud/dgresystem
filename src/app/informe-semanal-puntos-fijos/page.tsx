
"use client";

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, TableProperties, CheckCircle2, FileDown, DatabaseZap, AlertCircle, Search } from 'lucide-react';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy } from 'firebase/firestore';
import { type InformeDivulgador, type Dato } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDateToDDMMYYYY } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function InformeSemanalAnexoIVPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);

  const profile = user?.profile;
  const hasAdminFilter = ['admin', 'director'].includes(profile?.role || '') || profile?.permissions?.includes('admin_filter');
  const hasDeptFilter = !hasAdminFilter && profile?.permissions?.includes('department_filter');
  const hasDistFilter = !hasAdminFilter && !hasDeptFilter && (profile?.permissions?.includes('district_filter') || profile?.role === 'jefe' || profile?.role === 'funcionario');

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData } = useCollection<Dato>(datosQuery);

  useEffect(() => {
    if (!isUserLoading && profile) {
      if (hasDeptFilter && profile.departamento) setSelectedDepartment(profile.departamento);
      else if (hasDistFilter && profile.departamento && profile.distrito) {
        setSelectedDepartment(profile.departamento);
        setSelectedDistrict(profile.distrito);
      }
    }
  }, [isUserLoading, profile, hasDeptFilter, hasDistFilter]);

  const informesQuery = useMemoFirebase(() => {
    if (!firestore || !selectedDepartment || !selectedDistrict) return null;
    return query(collection(firestore, 'informes-divulgador'), where('departamento', '==', selectedDepartment), where('distrito', '==', selectedDistrict));
  }, [firestore, selectedDepartment, selectedDistrict]);

  const { data: rawInformesAnexoIII, isLoading: isLoadingInformes } = useCollection<InformeDivulgador>(informesQuery);

  const informesAnexoIII = useMemo(() => {
    if (!rawInformesAnexoIII) return null;
    return [...rawInformesAnexoIII].sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [rawInformesAnexoIII]);

  const handleSubmit = () => {
    if (!firestore || !user || !informesAnexoIII || informesAnexoIII.length === 0) {
        toast({ variant: "destructive", title: "Sin datos" }); return;
    }

    setIsSubmitting(true);
    const docData = {
      departamento: selectedDepartment || '',
      distrito: selectedDistrict || '',
      filas: informesAnexoIII.map(inf => ({
        lugar: inf.lugar_divulgacion,
        fecha: inf.fecha,
        hora_desde: inf.hora_desde,
        hora_hasta: inf.hora_hasta,
        nombre_divulgador: inf.nombre_divulgador,
        cedula: inf.cedula_divulgador,
        vinculo: inf.vinculo,
        cantidad_personas: inf.total_personas || 0,
      })),
      usuario_id: user.uid,
      fecha_creacion: new Date().toISOString(),
      server_timestamp: serverTimestamp(),
    };

    addDoc(collection(firestore, 'informes-semanales-anexo-iv'), docData)
      .then(() => {
        toast({ title: "¡Consolidado Guardado!" });
        setIsSubmitting(false);
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'informes-semanales-anexo-iv', operation: 'create', requestResourceData: docData }));
        setIsSubmitting(false);
      });
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <Header title="Informe Semanal - Anexo IV" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        <Card className="shadow-xl border-t-4 border-t-primary">
          <CardHeader className="bg-primary/5">
            <CardTitle className="font-black uppercase text-lg">Anexo IV - Consolidado Semanal</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoadingInformes ? <Loader2 className="animate-spin mx-auto" /> : (
                <Button onClick={handleSubmit} disabled={isSubmitting || !informesAnexoIII?.length} className="w-full h-14 font-black uppercase">
                    {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <DatabaseZap className="mr-2" />}
                    GUARDAR REPORTE OFICIAL ({informesAnexoIII?.length || 0} registros)
                </Button>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
