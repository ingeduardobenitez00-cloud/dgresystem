"use client";

import { useState, useEffect, Suspense, useCallback } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText, Save, Search, Trash2, Plus, ScrollText } from 'lucide-react';
import { useUser, useFirebase, useMemoFirebase, useCollectionOnce } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, where, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { type ActaDefuncion } from '@/lib/data';
import { recordAuditLog } from '@/lib/audit';
import { cn } from '@/lib/utils';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { compressImage } from '@/lib/image-utils';
import { Camera, ImageIcon } from 'lucide-react';

type FormState = Omit<ActaDefuncion, 'id' | 'usuario_id' | 'username' | 'fecha_creacion'>;

const emptyForm = (): FormState => ({
  oficina_numero: '', oficina_descripcion: '',
  departamento_registral: '', distrito_registral: '',
  fecha_dia: '', fecha_mes: '', fecha_anio: '',
  inscripcion_tomo: '', inscripcion_folio: '', inscripcion_acta: '',
  nombres: '', apellidos: '',
  cedula_identidad: '', sexo: '', nacionalidad: '', estado_civil: '',
  domicilio: '', fecha_nacimiento: '', lugar_nacimiento: '',
  fecha_fallecimiento: '', lugar_fallecimiento: '',
  nombre_padre: '', nombre_madre: '',
  declarante_nombre: '', declarante_cedula: '', declarante_vinculo: '',
  observaciones: '',
  oficial_nombre: '', oficial_cedula: '',
  lugar_expedicion: '', fecha_expedicion: '',
  foto_url: '',
});

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="bg-black text-white text-center py-2 px-4 rounded-lg my-6">
      <span className="text-xs font-black uppercase tracking-[0.2em]">{title}</span>
    </div>
  );
}

function FieldRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid gap-4 items-start", className)}>{children}</div>;
}

function Field({ label, children, small }: { label: string; children: React.ReactNode; small?: boolean }) {
  return (
    <div className="space-y-1">
      <Label className={cn("font-black uppercase tracking-tight", small ? "text-[9px]" : "text-[10px]")}>{label}</Label>
      {children}
    </div>
  );
}

function RadioGroup({ name, options, value, onChange }: {
  name: string; options: { label: string; value: string }[];
  value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-3 flex-wrap">
      {options.map(opt => (
        <label key={opt.value} className={cn(
          "flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 cursor-pointer text-[10px] font-black uppercase transition-all",
          value === opt.value ? "bg-black text-white border-black" : "border-muted hover:border-black/30"
        )}>
          <input type="radio" name={name} value={opt.value} checked={value === opt.value}
            onChange={() => onChange(opt.value)} className="hidden" />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

function ActaDefuncionContent() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'nuevo' | 'historial'>('nuevo');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchingCedula, setIsSearchingCedula] = useState(false);
  const [padronFound, setPadronFound] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const actasQuery = useMemoFirebase(() => {
    if (!firestore || activeTab !== 'historial') return null;
    return query(collection(firestore, 'actas-defuncion'), orderBy('fecha_creacion', 'desc'), limit(50));
  }, [firestore, activeTab]);

  const { data: actas, isLoading: isLoadingActas, setData: setActas } = useCollectionOnce<ActaDefuncion>(actasQuery);

  const today = new Date();
  useEffect(() => {
    setForm(prev => ({
      ...prev,
      fecha_dia: String(today.getDate()).padStart(2, '0'),
      fecha_mes: String(today.getMonth() + 1).padStart(2, '0'),
      fecha_anio: String(today.getFullYear()),
      fecha_expedicion: today.toISOString().split('T')[0],
    }));
  }, []);

  const set = (field: keyof FormState, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const searchCedulaInPadron = useCallback(async (cedulaInput: string, target: 'difunto' | 'declarante' | 'oficial') => {
    const cleanTerm = (cedulaInput || '').trim().replace(/\./g, ''); 
    if (!firestore || cleanTerm.length < 5) return;
    
    setIsSearchingCedula(true);
    try {
      const q = query(collection(firestore, 'padron'), where('cedula', '==', cleanTerm), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const found = snap.docs[0].data();
        const fullName = `${found.nombre} ${found.apellido}`.toUpperCase();
        
        if (target === 'difunto') {
          // Convertir sexo
          const sexo: any = found.sexo === 'M' || found.sexo === 'F' ? found.sexo : '';
          
          // Convertir fecha de nacimiento
          let fechaNaci = '';
          if (found.fecha_naci) {
            const parts = found.fecha_naci.split('/');
            if (parts.length === 3) {
              fechaNaci = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            } else if (found.fecha_naci.includes('-')) {
               fechaNaci = found.fecha_naci;
            }
          }

          setForm(prev => ({ 
            ...prev, 
            nombres: found.nombre?.toUpperCase() || '',
            apellidos: found.apellido?.toUpperCase() || '',
            sexo: sexo,
            domicilio: found.direccion?.toUpperCase() || '',
            fecha_nacimiento: fechaNaci,
            nacionalidad: 'P'
          }));
          setPadronFound(true);
        } else if (target === 'declarante') {
          setForm(prev => ({ 
            ...prev, 
            declarante_nombre: fullName
          }));
        } else if (target === 'oficial') {
          setForm(prev => ({ 
            ...prev, 
            oficial_nombre: fullName
          }));
        }

        toast({ title: "Datos encontrados", description: `Se ha identificado a: ${fullName}` });
      } else { 
        if (target === 'difunto') setPadronFound(false);
        toast({ variant: "destructive", title: "No encontrado", description: "La cédula no figura en el padrón." });
      }
    } catch (error) { 
      if (target === 'difunto') setPadronFound(false); 
      toast({ variant: "destructive", title: "Error de búsqueda" });
    } finally { 
      setIsSearchingCedula(false); 
    }
  }, [firestore, toast]);

  const inp = (field: keyof FormState, placeholder = '') => (
    <Input
      value={form[field] as string}
      onChange={e => set(field, e.target.value)}
      placeholder={placeholder}
      className="h-9 border-2 font-semibold text-sm bg-white uppercase"
    />
  );

  const smallInp = (field: keyof FormState, placeholder = '', w = 'w-20') => (
    <Input
      value={form[field] as string}
      onChange={e => set(field, e.target.value)}
      placeholder={placeholder}
      className={cn("h-9 border-2 font-semibold text-sm bg-white uppercase text-center", w)}
    />
  );

  const handlePreview = () => {
    if (!form.nombres || !form.apellidos || !form.fecha_fallecimiento) {
      toast({ variant: 'destructive', title: 'Campos requeridos', description: 'Nombres, Apellidos y Fecha de Fallecimiento son obligatorios.' });
      return;
    }
    if (!form.foto_url) {
      toast({ variant: 'destructive', title: 'Foto requerida', description: 'Por favor, suba una foto del acta física.' });
      return;
    }
    setShowPreview(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUri = await compressImage(file);
      set('foto_url', dataUri);
      toast({ title: 'Foto cargada correctamente' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error al procesar la foto' });
    }
  };

  const handleSubmit = async () => {
    if (!firestore || !user) return;
    setIsSubmitting(true);
    try {
      const data = {
        ...form,
        usuario_id: user.uid,
        username: user.profile?.username || user.email || '',
        fecha_creacion: new Date().toISOString(),
        server_timestamp: serverTimestamp(),
      };
      const ref = await addDoc(collection(firestore, 'actas-defuncion'), data);
      recordAuditLog(firestore, {
        usuario_id: user.uid,
        usuario_nombre: user.profile?.username || user.email || 'Usuario',
        usuario_rol: user.profile?.role || 'funcionario',
        accion: 'CREAR',
        modulo: 'acta-defuncion',
        documento_id: ref.id,
        detalles: `Acta de Defunción registrada para ${form.nombres} ${form.apellidos}`,
      });
      toast({ title: '✅ Acta registrada exitosamente' });
      setForm(emptyForm());
      setShowPreview(false);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error al guardar', description: 'Intente de nuevo.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, nombre: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'actas-defuncion', id));
      setActas(prev => prev?.filter(a => a.id !== id) ?? []);
      toast({ variant: 'destructive', title: `Acta de ${nombre} eliminada` });
    } catch {
      toast({ variant: 'destructive', title: 'Error al eliminar' });
    }
  };

  const filteredActas = actas?.filter(a =>
    `${a.nombres} ${a.apellidos} ${a.cedula_identidad}`.toLowerCase().includes(searchTerm.toLowerCase())
  ) ?? [];

  if (isUserLoading) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="animate-spin h-8 w-8 text-primary" />
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Acta de Defunción" />
      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
        {/* Page Title */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Constancia del Acta de Defunción</h1>
            <p className="text-muted-foreground font-medium flex items-center gap-2 mt-1 text-sm">
              <ScrollText className="h-4 w-4" /> Ministerio de Justicia — Dirección General del Registro del Estado Civil
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={activeTab === 'nuevo' ? 'default' : 'outline'}
              onClick={() => setActiveTab('nuevo')}
              className="font-black uppercase text-[10px] gap-2"
            >
              <Plus className="h-4 w-4" /> Nuevo Registro
            </Button>
            <Button
              variant={activeTab === 'historial' ? 'default' : 'outline'}
              onClick={() => setActiveTab('historial')}
              className="font-black uppercase text-[10px] gap-2"
            >
              <FileText className="h-4 w-4" /> Historial
            </Button>
          </div>
        </div>

        {/* ===== FORMULARIO ===== */}
        {activeTab === 'nuevo' && (
          <Card className="shadow-2xl border-t-8 border-t-primary rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="bg-primary/5 border-b p-8">
              <CardTitle className="text-center space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">República del Paraguay — Justicia Electoral</p>
                <p className="text-sm font-black uppercase">Ministerio de Justicia</p>
                <p className="text-[11px] font-bold uppercase text-muted-foreground">Dirección General del Registro del Estado Civil</p>
                <p className="text-2xl font-black uppercase text-primary mt-2">Constancia del Acta de Defunción</p>
                <p className="text-[9px] font-medium text-muted-foreground">Expedido para uso exclusivo de la Justicia Electoral (Art. 151 - Ley 834/96)</p>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-8 space-y-2">

              {/* DATOS DE LA OFICINA REGISTRAL */}
              <SectionHeader title="Datos de la Oficina Registral" />
              <FieldRow className="grid-cols-2 md:grid-cols-4">
                <Field label="Oficina N°">{smallInp('oficina_numero', '000', 'w-full')}</Field>
                <div className="col-span-3">
                  <Field label="Oficina Descripción">{inp('oficina_descripcion', 'Descripción de la oficina...')}</Field>
                </div>
              </FieldRow>
              <FieldRow className="grid-cols-1 md:grid-cols-2 mt-3">
                <Field label="Departamento">{inp('departamento_registral', 'Departamento...')}</Field>
                <Field label="Distrito">{inp('distrito_registral', 'Distrito...')}</Field>
              </FieldRow>

              {/* DATOS DEL ACTA */}
              <SectionHeader title="Datos del Acta" />
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                {/* FECHA */}
                <div className="md:col-span-4 space-y-2">
                  <Label className="text-[10px] font-black uppercase text-primary tracking-wider">Fecha del Acta</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[8px] font-bold text-muted-foreground uppercase text-center block">Día</Label>
                      <Input value={form.fecha_dia} onChange={e => set('fecha_dia', e.target.value)}
                        placeholder="DD" className="h-10 border-2 text-center font-black text-sm rounded-xl" maxLength={2} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[8px] font-bold text-muted-foreground uppercase text-center block">Mes</Label>
                      <Input value={form.fecha_mes} onChange={e => set('fecha_mes', e.target.value)}
                        placeholder="MM" className="h-10 border-2 text-center font-black text-sm rounded-xl" maxLength={2} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[8px] font-bold text-muted-foreground uppercase text-center block">Año</Label>
                      <Input value={form.fecha_anio} onChange={e => set('fecha_anio', e.target.value)}
                        placeholder="AAAA" className="h-10 border-2 text-center font-black text-sm rounded-xl" maxLength={4} />
                    </div>
                  </div>
                </div>

                {/* INSCRIPCION */}
                <div className="md:col-span-8 space-y-2">
                  <Label className="text-[10px] font-black uppercase text-primary tracking-wider">Datos de la Inscripción</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[8px] font-bold text-muted-foreground uppercase text-center block">Tomo</Label>
                      <Input value={form.inscripcion_tomo} onChange={e => set('inscripcion_tomo', e.target.value)}
                        placeholder="Tomo" className="h-10 border-2 font-black text-sm text-center rounded-xl bg-muted/5" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[8px] font-bold text-muted-foreground uppercase text-center block">Folio</Label>
                      <Input value={form.inscripcion_folio} onChange={e => set('inscripcion_folio', e.target.value)}
                        placeholder="Folio" className="h-10 border-2 font-black text-sm text-center rounded-xl bg-muted/5" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[8px] font-bold text-muted-foreground uppercase text-center block">Acta Nº</Label>
                      <Input value={form.inscripcion_acta} onChange={e => set('inscripcion_acta', e.target.value)}
                        placeholder="Acta" className="h-10 border-2 font-black text-sm text-center rounded-xl bg-muted/5" />
                    </div>
                  </div>
                </div>
              </div>

              {/* DATOS DEL DIFUNTO */}
              <SectionHeader title="Datos del Difunto" />
              <div className="border-2 rounded-2xl p-6 space-y-4 bg-muted/5">
                <Field label="Nombres">
                  <Input
                    value={form.nombres}
                    readOnly
                    placeholder="Se llenará al buscar la cédula..."
                    className="h-9 border-2 font-semibold text-sm bg-muted/20 uppercase cursor-not-allowed"
                  />
                </Field>
                <Field label="Apellidos">
                  <Input
                    value={form.apellidos}
                    readOnly
                    placeholder="Se llenará al buscar la cédula..."
                    className="h-9 border-2 font-semibold text-sm bg-muted/20 uppercase cursor-not-allowed"
                  />
                </Field>

                <FieldRow className="grid-cols-2 md:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-tight">Cédula de Identidad N°</Label>
                    <div className="flex gap-1">
                      <Input
                        value={form.cedula_identidad}
                        onChange={e => {
                          set('cedula_identidad', e.target.value);
                          setPadronFound(false);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            searchCedulaInPadron(form.cedula_identidad, 'difunto');
                          }
                        }}
                        placeholder="1234567"
                        className={cn(
                          "h-9 border-2 font-semibold text-sm bg-white uppercase transition-all",
                          padronFound && "border-green-500 bg-green-50"
                        )}
                      />
                      <Button 
                        variant="secondary" 
                        size="icon" 
                        className="h-9 w-9 shrink-0" 
                        onClick={() => searchCedulaInPadron(form.cedula_identidad, 'difunto')}
                        disabled={isSearchingCedula}
                      >
                        {isSearchingCedula ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <Field label="Sexo">
                    <div className="opacity-60 pointer-events-none">
                      <RadioGroup name="sexo" value={form.sexo}
                        onChange={v => set('sexo', v)}
                        options={[{ label: 'M', value: 'M' }, { label: 'F', value: 'F' }]} />
                    </div>
                  </Field>
                  <Field label="Nacionalidad">
                    <RadioGroup name="nacionalidad" value={form.nacionalidad}
                      onChange={v => set('nacionalidad', v)}
                      options={[{ label: 'P', value: 'P' }, { label: 'E', value: 'E' }]} />
                  </Field>
                  <Field label="Estado Civil">
                    <RadioGroup name="estado_civil" value={form.estado_civil}
                      onChange={v => set('estado_civil', v)}
                      options={[
                        { label: 'Soltero', value: 'soltero' },
                        { label: 'Casado', value: 'casado' },
                        { label: 'Viudo', value: 'viudo' },
                        { label: 'Otro', value: 'otro' },
                      ]} />
                  </Field>
                </FieldRow>

                <Field label="Domicilio">
                  <Input
                    value={form.domicilio}
                    readOnly
                    placeholder="Se llenará al buscar la cédula..."
                    className="h-9 border-2 font-semibold text-sm bg-muted/20 uppercase cursor-not-allowed"
                  />
                </Field>

                <FieldRow className="grid-cols-1 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Fecha de Nacimiento (DD/MM/AAAA)</Label>
                    <Input type="date" value={form.fecha_nacimiento}
                      readOnly
                      className="h-9 border-2 font-bold text-sm bg-muted/20 cursor-not-allowed" />
                  </div>
                  <Field label="Lugar de Nacimiento (Localidad)">{inp('lugar_nacimiento', 'Ciudad / Localidad...')}</Field>
                </FieldRow>

                <FieldRow className="grid-cols-1 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Fecha de Fallecimiento (DD/MM/AAAA) *</Label>
                    <Input type="date" value={form.fecha_fallecimiento}
                      onChange={e => set('fecha_fallecimiento', e.target.value)}
                      className="h-9 border-2 font-bold text-sm bg-white border-primary/50" />
                  </div>
                  <Field label="Lugar de Fallecimiento (Localidad)">{inp('lugar_fallecimiento', 'Ciudad / Localidad...')}</Field>
                </FieldRow>

                <Field label="Nombre y Apellido del PADRE del difunto">{inp('nombre_padre', 'Nombres y Apellidos...')}</Field>
                <Field label="Nombre y Apellido de la MADRE del difunto">{inp('nombre_madre', 'Nombres y Apellidos...')}</Field>
              </div>

              {/* DATOS DEL DECLARANTE */}
              <SectionHeader title="Datos del Declarante" />
              <div className="border-2 rounded-2xl p-6 space-y-4 bg-muted/5">
                <Field label="Nombre y Apellido">
                  <Input
                    value={form.declarante_nombre}
                    readOnly
                    placeholder="Se llenará al buscar la cédula..."
                    className="h-9 border-2 font-semibold text-sm bg-muted/20 uppercase cursor-not-allowed"
                  />
                </Field>
                <FieldRow className="grid-cols-1 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-tight">Cédula de Identidad N° (Declarante)</Label>
                    <div className="flex gap-1">
                      <Input
                        value={form.declarante_cedula}
                        onChange={e => set('declarante_cedula', e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            searchCedulaInPadron(form.declarante_cedula, 'declarante');
                          }
                        }}
                        placeholder="1234567"
                        className="h-9 border-2 font-semibold text-sm bg-white uppercase"
                      />
                      <Button 
                        variant="secondary" 
                        size="icon" 
                        className="h-9 w-9 shrink-0" 
                        onClick={() => searchCedulaInPadron(form.declarante_cedula, 'declarante')}
                        disabled={isSearchingCedula}
                      >
                        {isSearchingCedula ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <Field label="Vinculo del Declarante">
                    <RadioGroup name="declarante_vinculo" value={form.declarante_vinculo}
                      onChange={v => set('declarante_vinculo', v)}
                      options={[
                        { label: 'Cónyuge', value: 'conyuge' },
                        { label: 'Padre', value: 'padre' },
                        { label: 'Madre', value: 'madre' },
                        { label: 'Hijo/a', value: 'hijo_a' },
                        { label: 'Otro', value: 'otro' },
                      ]} />
                  </Field>
                </FieldRow>
                <Field label="Observaciones">
                  <Textarea value={form.observaciones}
                    onChange={e => set('observaciones', e.target.value)}
                    placeholder="Observaciones adicionales..."
                    className="min-h-[80px] border-2 font-medium text-sm bg-white resize-none" />
                </Field>
              </div>

              {/* DATOS DE LA EXPEDICIÓN */}
              <SectionHeader title="Datos de la Expedición del Certificado" />
              <div className="border-2 rounded-2xl p-6 space-y-4 bg-muted/5">
                <FieldRow className="grid-cols-1 md:grid-cols-2">
                  <div>
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Nombre y Apellido del Oficial del Registro Civil</Label>
                    <Input
                      value={form.oficial_nombre}
                      readOnly
                      placeholder="Se llenará al buscar la cédula..."
                      className="h-9 border-2 font-bold text-sm bg-muted/20 mt-1 uppercase cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-tight">Cédula de Identidad N° (Oficial)</Label>
                    <div className="flex gap-1">
                      <Input
                        value={form.oficial_cedula}
                        onChange={e => set('oficial_cedula', e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            searchCedulaInPadron(form.oficial_cedula, 'oficial');
                          }
                        }}
                        placeholder="1234567"
                        className="h-9 border-2 font-semibold text-sm bg-white uppercase"
                      />
                      <Button 
                        variant="secondary" 
                        size="icon" 
                        className="h-9 w-9 shrink-0" 
                        onClick={() => searchCedulaInPadron(form.oficial_cedula, 'oficial')}
                        disabled={isSearchingCedula}
                      >
                        {isSearchingCedula ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </FieldRow>
                <FieldRow className="grid-cols-1 md:grid-cols-2">
                  <Field label="Lugar de Expedición">{inp('lugar_expedicion', 'Ciudad de expedición...')}</Field>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Fecha de Expedición</Label>
                    <Input type="date" value={form.fecha_expedicion}
                      onChange={e => set('fecha_expedicion', e.target.value)}
                      className="h-9 border-2 font-bold text-sm bg-white" />
                  </div>
                </FieldRow>
                <div className="border-t pt-6 mt-4">
                  <div className="max-w-md mx-auto space-y-4 text-center">
                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Foto del Acta Física *</Label>
                    {form.foto_url ? (
                      <div className="relative aspect-[3/4] w-full max-w-[200px] mx-auto rounded-xl overflow-hidden border-2 border-primary">
                        <img src={form.foto_url} alt="Acta" className="w-full h-full object-cover" />
                        <label className="absolute bottom-2 right-2 bg-black/70 hover:bg-black text-white p-2 rounded-full cursor-pointer transition-colors">
                          <Camera className="h-4 w-4" />
                          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                        </label>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full max-w-[200px] mx-auto aspect-[3/4] border-2 border-dashed border-primary/50 rounded-xl cursor-pointer hover:bg-primary/5 hover:border-primary transition-all group">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                          <Camera className="h-6 w-6 text-primary" />
                        </div>
                        <span className="text-[10px] font-black uppercase text-primary">Subir Foto</span>
                        <span className="text-[8px] font-medium text-muted-foreground mt-1">Obligatorio</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Notas legales */}
              <div className="mt-6 space-y-1 border-t pt-4">
                {[
                  '*El acta digitalizada debe coincidir exactamente con el documento físico.',
                  '*Asegúrese de que la foto sea legible y abarque todo el documento.',
                  '*El presente documento deberá ser remitido a la Dirección de Actualización y Depuración del RCP de la Justicia Electoral',
                ].map((n, i) => (
                  <p key={i} className="text-[9px] text-muted-foreground italic font-medium">{n}</p>
                ))}
              </div>
            </CardContent>

            <CardFooter className="p-0 overflow-hidden">
              <Button
                onClick={handlePreview}
                disabled={isSubmitting}
                className="w-full h-20 text-xl font-black uppercase rounded-none tracking-widest bg-primary hover:bg-primary/90 gap-4"
              >
                {isSubmitting ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                PREVISUALIZAR Y REGISTRAR
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* ===== HISTORIAL ===== */}
        {activeTab === 'historial' && (
          <Card className="shadow-2xl rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-primary/5 border-b p-6">
              <CardTitle className="flex items-center gap-3 uppercase font-black text-primary text-lg">
                <FileText className="h-6 w-6" /> Historial de Actas Registradas
              </CardTitle>
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nombre, apellido o cédula..."
                  className="pl-9 h-10 border-2"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingActas ? (
                <div className="flex justify-center items-center py-16">
                  <Loader2 className="animate-spin h-8 w-8 text-primary" />
                </div>
              ) : filteredActas.length === 0 ? (
                <div className="text-center py-16 space-y-2 opacity-40">
                  <ScrollText className="h-10 w-10 mx-auto" />
                  <p className="text-sm font-black uppercase tracking-widest">No se encontraron actas</p>
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="divide-y">
                    {filteredActas.map(acta => (
                      <div key={acta.id} className="p-5 hover:bg-muted/20 transition-colors group">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1 flex-1 min-w-0">
                            <p className="font-black uppercase text-sm">{acta.nombres} {acta.apellidos}</p>
                            <div className="flex flex-wrap gap-2 text-[10px]">
                              {acta.cedula_identidad && <Badge variant="outline" className="font-bold">CI: {acta.cedula_identidad}</Badge>}
                              {acta.fecha_fallecimiento && <Badge variant="secondary" className="font-bold">Fallec.: {acta.fecha_fallecimiento}</Badge>}
                              {acta.estado_civil && <Badge className="font-bold capitalize bg-primary/10 text-primary border-0">{acta.estado_civil}</Badge>}
                              {acta.distrito_registral && <Badge variant="outline" className="font-bold">{acta.departamento_registral} - {acta.distrito_registral}</Badge>}
                            </div>
                            <p className="text-[9px] text-muted-foreground font-medium uppercase">
                              Registrado por: {acta.username} · {new Date(acta.fecha_creacion).toLocaleString('es-PY')}
                            </p>
                          </div>
                          {(user?.isAdmin || user?.isOwner) && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon"
                                  className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar acta?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción eliminará permanentemente el acta de defunción de <strong>{acta.nombres} {acta.apellidos}</strong>.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(acta.id, `${acta.nombres} ${acta.apellidos}`)}
                                    className="bg-destructive hover:bg-destructive/90">
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {/* DIALOG DE PREVISUALIZACION */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-5xl w-full h-[90vh] p-0 overflow-hidden flex flex-col rounded-[2rem]">
          <div className="bg-primary p-6 text-white text-center shrink-0">
            <DialogTitle className="text-xl font-black uppercase tracking-widest flex items-center justify-center gap-2">
              <ScrollText className="h-6 w-6" /> Constatación de Carga
            </DialogTitle>
            <DialogDescription className="text-white/70 text-[10px] font-medium uppercase mt-2">
              Verifique que los datos ingresados coincidan exactamente con la fotografía del acta física.
            </DialogDescription>
          </div>
          
          <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0 bg-muted/10">
            {/* Lado izquierdo: Foto */}
            <div className="flex-1 border-r border-dashed bg-black/5 p-6 flex flex-col min-h-0 overflow-y-auto">
              <Label className="text-[10px] font-black uppercase text-muted-foreground mb-4 shrink-0 flex items-center gap-2">
                <ImageIcon className="h-4 w-4" /> Formulario Físico (Acta Escaneada/Foto)
              </Label>
              <div className="flex-1 relative rounded-xl overflow-hidden border shadow-inner bg-white flex items-center justify-center">
                {form.foto_url && (
                  <img src={form.foto_url} alt="Previsualización" className="max-w-full max-h-full object-contain" />
                )}
              </div>
            </div>

            {/* Lado derecho: Datos */}
            <div className="flex-1 p-6 flex flex-col min-h-0">
              <Label className="text-[10px] font-black uppercase text-primary mb-4 shrink-0 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Formulario Digital (Datos Cargados)
              </Label>
              <ScrollArea className="flex-1 border rounded-xl bg-white shadow-inner p-6">
                <div className="space-y-6">
                  {/* Difunto */}
                  <div>
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground border-b pb-2 mb-3">Datos del Difunto</h4>
                    <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                      <div>
                        <p className="text-[8px] font-bold text-muted-foreground uppercase">Nombres y Apellidos</p>
                        <p className="font-black text-xs uppercase">{form.nombres} {form.apellidos}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-bold text-muted-foreground uppercase">Cédula de Identidad</p>
                        <p className="font-black text-xs">{form.cedula_identidad || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-bold text-muted-foreground uppercase">Fecha Fallecimiento</p>
                        <p className="font-black text-xs">{form.fecha_fallecimiento}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-bold text-muted-foreground uppercase">Lugar Fallecimiento</p>
                        <p className="font-black text-xs uppercase">{form.lugar_fallecimiento || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-bold text-muted-foreground uppercase">Fecha Nacimiento</p>
                        <p className="font-black text-xs">{form.fecha_nacimiento || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-bold text-muted-foreground uppercase">Sexo / Nacionalidad</p>
                        <p className="font-black text-xs uppercase">{form.sexo || '-'} / {form.nacionalidad || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Acta */}
                  <div>
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground border-b pb-2 mb-3">Datos del Acta</h4>
                    <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                      <div>
                        <p className="text-[8px] font-bold text-muted-foreground uppercase">Tomo / Folio / Acta N°</p>
                        <p className="font-black text-xs">{form.inscripcion_tomo || '-'} / {form.inscripcion_folio || '-'} / {form.inscripcion_acta || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-bold text-muted-foreground uppercase">Fecha del Acta</p>
                        <p className="font-black text-xs">{form.fecha_dia}/{form.fecha_mes}/{form.fecha_anio}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[8px] font-bold text-muted-foreground uppercase">Oficina Registral</p>
                        <p className="font-black text-xs uppercase">N° {form.oficina_numero} - {form.oficina_descripcion}</p>
                      </div>
                    </div>
                  </div>

                  {/* Declarante y Oficial */}
                  <div>
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground border-b pb-2 mb-3">Intervinientes</h4>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[8px] font-bold text-muted-foreground uppercase">Declarante</p>
                        <p className="font-black text-xs uppercase">{form.declarante_nombre || 'N/A'} (CI: {form.declarante_cedula || 'N/A'}) - {form.declarante_vinculo}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-bold text-muted-foreground uppercase">Oficial del Registro</p>
                        <p className="font-black text-xs uppercase">{form.oficial_nombre || 'N/A'} (CI: {form.oficial_cedula || 'N/A'})</p>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter className="shrink-0 p-6 bg-white border-t sm:justify-between items-center flex-row">
            <Button variant="ghost" className="font-black uppercase text-[10px]" onClick={() => setShowPreview(false)}>
              Revisar Datos
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="font-black uppercase text-[10px] tracking-widest h-12 px-8 bg-green-600 hover:bg-green-700">
              {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Confirmar y Registrar Acta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ActaDefuncionPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>}>
      <ActaDefuncionContent />
    </Suspense>
  );
}
