"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirebase } from '@/firebase';
import {
  collection, addDoc, getDocs, deleteDoc, doc, updateDoc, writeBatch,
} from 'firebase/firestore';
import { recordAuditLog } from '@/lib/audit';
import { cn } from '@/lib/utils';
import {
  Loader2, Plus, Building2, Trash2, CheckCircle2, Search,
  FileSpreadsheet, Download, Edit, X, FileUp, Sparkles,
  MapPin, ShieldAlert, ArrowLeft, ArrowRight, Database, Users
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Link from 'next/link';

type RegistroCivil = {
  id: string;
  numero: string;
  nombre: string;
  departamento: string;
  distrito: string;
};

export default function ImportarOficinasPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const isAdmin =
    user?.profile?.role === 'superadmin' ||
    user?.profile?.role === 'admin' ||
    user?.profile?.role === 'director' ||
    user?.isAdmin ||
    user?.isSuperAdmin ||
    user?.isOwner ||
    user?.email === 'edubtz11@gmail.com';

  const [registros, setRegistros] = useState<RegistroCivil[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulario manual
  const [form, setForm] = useState({ numero: '', nombre: '', departamento: '', distrito: '' });
  const [savingManual, setSavingManual] = useState(false);

  // Búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('TODOS');

  // Migración Excel
  const [showMigrateCard, setShowMigrateCard] = useState(true);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [migrationFileName, setMigrationFileName] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<Omit<RegistroCivil, 'id'>[]>([]);
  const [migrationMode, setMigrationMode] = useState<'upsert' | 'replace'>('upsert');
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<{ done: number; total: number } | null>(null);

  // Edición individual
  const [editingOffice, setEditingOffice] = useState<RegistroCivil | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Columnas detectadas
  const [detectedInfo, setDetectedInfo] = useState<{
    numeroCol: string;
    nombreCol: string;
    deptCol: string;
    distCol?: string;
    deducedDistricts: boolean;
  } | null>(null);

  // Carga del catálogo desde Firestore
  const loadRegistros = useCallback(async () => {
    if (!firestore || !isAdmin) return;
    setLoading(true);
    try {
      const snap = await getDocs(collection(firestore, 'registros-civiles'));
      const regs = snap.docs.map(d => ({ id: d.id, ...d.data() } as RegistroCivil));
      regs.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
      setRegistros(regs);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error al cargar catálogo de oficinas' });
    } finally {
      setLoading(false);
    }
  }, [firestore, isAdmin, toast]);

  useEffect(() => {
    loadRegistros();
  }, [loadRegistros]);

  const departamentos = useMemo(() => {
    const s = new Set<string>();
    registros.forEach(r => {
      if (r.departamento) s.add(r.departamento.toUpperCase().trim());
    });
    return Array.from(s).sort();
  }, [registros]);

  const normalizeHeader = (str: string) =>
    String(str || '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[º°#]/g, 'O')
      .replace(/[^A-Z0-9]/g, '_')
      .replace(/_+/g, '_');

  // Descargar plantilla oficial
  const handleDownloadTemplate = () => {
    const sampleData = [
      { 'Nº de oficina': '001', OFICINA: 'OFICINA REGISTRAL PRIMERA SECCIÓN', DEPARTAMENTO: '00 - ASUNCION', DISTRITO: 'ASUNCIÓN' },
      { 'Nº de oficina': '002', OFICINA: 'OFICINA REGISTRAL SEGUNDA SECCIÓN', DEPARTAMENTO: '00 - ASUNCION', DISTRITO: 'ASUNCIÓN' },
      { 'Nº de oficina': '015', OFICINA: 'OFICINA REGISTRAL FILIAL TERCERA SECCIÓN - MATERNO INFANTIL (SAN LORENZO)', DEPARTAMENTO: 'CENTRAL', DISTRITO: 'SAN LORENZO' },
      { 'Nº de oficina': '101', OFICINA: 'OFICINA REGISTRAL SAN ROQUE', DEPARTAMENTO: 'ALTO PARANÁ', DISTRITO: 'CIUDAD DEL ESTE' },
      { 'Nº de oficina': '205', OFICINA: 'OFICINA REGISTRAL HERNANDARIAS CENTRAL', DEPARTAMENTO: 'ALTO PARANÁ', DISTRITO: 'HERNANDARIAS' },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Oficinas_Registro_Civil');
    XLSX.writeFile(wb, 'Plantilla_Oficinas_Registro_Civil.xlsx');
    toast({
      title: 'Plantilla descargada',
      description: "Se ha descargado 'Plantilla_Oficinas_Registro_Civil.xlsx'.",
    });
  };

  // Exportar catálogo actual
  const handleExportOffices = () => {
    if (registros.length === 0) {
      toast({ variant: 'destructive', title: 'No hay oficinas registradas para exportar' });
      return;
    }
    const exportData = registros.map(r => ({
      'Nº de oficina': r.numero,
      OFICINA: r.nombre,
      DEPARTAMENTO: r.departamento,
      DISTRITO: r.distrito,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Oficinas_Registro_Civil');
    XLSX.writeFile(wb, `Oficinas_Registro_Civil_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({
      title: 'Catálogo exportado',
      description: `Se han exportado ${registros.length} oficinas a Excel.`,
    });
  };

  // Procesar archivo Excel/CSV
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setMigrationFileName(file.name);
    setParsedPreview([]);
    setDetectedInfo(null);
    setConfirmReplace(false);

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (json.length === 0) {
          toast({ variant: 'destructive', title: 'El archivo está vacío' });
          setIsParsing(false);
          return;
        }

        const headers = Object.keys(json[0] || {});

        const numKey = headers.find(h => {
          const norm = normalizeHeader(h);
          return (
            norm === 'NODE_OFICINA' ||
            norm === 'NO_DE_OFICINA' ||
            norm === 'N_DE_OFICINA' ||
            norm === 'NUMERO_DE_OFICINA' ||
            norm === 'NRO_DE_OFICINA' ||
            norm === 'NRO_OFICINA' ||
            norm === 'NUMERO' ||
            norm === 'NRO' ||
            norm === 'NO' ||
            norm === 'CODIGO' ||
            norm === 'OFICINA_NUMERO' ||
            (norm.includes('OFICINA') && (norm.startsWith('N_') || norm.startsWith('NO_') || norm.includes('NUM') || norm.includes('NRO')))
          );
        }) || headers.find(h => {
          const firstVal = json[0]?.[h];
          return !isNaN(Number(firstVal)) && String(firstVal).trim() !== '';
        }) || headers[0];

        const nombreKey = headers.find(h => {
          if (h === numKey) return false;
          const norm = normalizeHeader(h);
          return (
            norm === 'OFICINA' ||
            norm === 'NOMBRE' ||
            norm === 'DENOMINACION' ||
            norm === 'DESCRIPCION' ||
            norm === 'OFICINA_DESCRIPCION' ||
            norm === 'REGISTRO_CIVIL'
          );
        }) || headers.find(h => {
          if (h === numKey) return false;
          const norm = normalizeHeader(h);
          return (norm.includes('OFICINA') || norm.includes('NOMBRE')) && !norm.includes('NUM') && !norm.includes('NRO');
        });

        const deptKey = headers.find(h => {
          const norm = normalizeHeader(h);
          return norm.includes('DEPARTAMENTO') || norm === 'DEPTO' || norm === 'DPTO';
        });

        const distKey = headers.find(h => {
          const norm = normalizeHeader(h);
          return (
            norm.includes('DISTRITO') ||
            norm.includes('CIUDAD') ||
            norm.includes('MUNICIPIO') ||
            norm.includes('LOCALIDAD')
          );
        });

        const hasExplicitDist = !!distKey;
        setDetectedInfo({
          numeroCol: numKey || 'Deducida',
          nombreCol: nombreKey || 'Deducida',
          deptCol: deptKey || 'Deducida',
          distCol: distKey || undefined,
          deducedDistricts: !hasExplicitDist,
        });

        const KNOWN_CENTRAL_DISTRICTS = [
          'SAN LORENZO', 'LUQUE', 'CAPIATA', 'CAPIATÁ', 'LAMBARE', 'LAMBARÉ', 
          'FERNANDO DE LA MORA', 'LIMPIO', 'NEMBY', 'ÑEMBY', 'MARIANO ROQUE ALONSO', 
          'VILLA ELISA', 'ITAUGUA', 'ITAUGUÁ', 'ITA', 'ITÁ', 'AREGUA', 'AREGUÁ', 
          'YPACARAI', 'YPACARAÍ', 'SAN ANTONIO', 'VILLETA', 'GUARAMBARE', 'GUARAMBARÉ', 
          'YPANE', 'YPANÉ', 'J. AUGUSTO SALDIVAR', 'NUEVA ITALIA'
        ];

        const parsed: Omit<RegistroCivil, 'id'>[] = [];

        json.forEach((row, idx) => {
          let numero = numKey ? String(row[numKey] || '').trim() : '';
          let nombre = nombreKey ? String(row[nombreKey] || '').trim() : '';
          let departamento = deptKey ? String(row[deptKey] || '').trim().toUpperCase() : '';
          let distrito = distKey ? String(row[distKey] || '').trim().toUpperCase() : '';

          if (!numero && nombre) {
            const match = nombre.match(/^(\d+)[\s\-:]+(.+)$/);
            if (match) {
              numero = match[1];
              nombre = match[2].trim();
            }
          }

          if (!distrito) {
            const deptClean = departamento.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (deptClean.includes('ASUNCION') || deptClean.includes('CAPITAL')) {
              distrito = 'ASUNCIÓN';
            } else {
              const parenMatch = nombre.match(/\(([^)]+)\)/);
              if (parenMatch && parenMatch[1]) {
                const insideParen = parenMatch[1].trim().toUpperCase();
                if (!['IPS', 'MSPBS', 'INERAM', 'HOSPITAL'].includes(insideParen) && insideParen.length >= 3) {
                  distrito = insideParen;
                }
              }

              if (!distrito) {
                const foundDist = KNOWN_CENTRAL_DISTRICTS.find(d => 
                  nombre.toUpperCase().includes(d.toUpperCase())
                );
                if (foundDist) distrito = foundDist;
              }

              if (!distrito) {
                distrito = departamento || 'CENTRAL';
              }
            }
          }

          if (numero || nombre) {
            parsed.push({
              numero: String(numero || idx + 1).trim(),
              nombre: String(nombre || `OFICINA N° ${numero}`).trim().toUpperCase(),
              departamento: departamento || '00 - ASUNCION',
              distrito: distrito.toUpperCase(),
            });
          }
        });

        if (parsed.length === 0) {
          toast({
            variant: 'destructive',
            title: 'No se encontraron filas válidas',
            description: 'Verifique que el archivo incluya las columnas: Nº de oficina, OFICINA, DEPARTAMENTO.',
          });
        } else {
          setParsedPreview(parsed);
          toast({
            title: `Lectura correcta: ${parsed.length} oficinas detectadas`,
            description: !hasExplicitDist 
              ? 'Se identificaron las columnas y se dedujo el distrito automáticamente. Revise la vista previa antes de guardar.' 
              : 'Revise la vista previa y confirme la migración.',
          });
        }
      } catch (err) {
        console.error(err);
        toast({ variant: 'destructive', title: 'Error al procesar el archivo Excel' });
      } finally {
        setIsParsing(false);
      }
    };

    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // Ejecución de la migración
  const handleExecuteMigration = async () => {
    if (!firestore || parsedPreview.length === 0 || !user) return;

    if (migrationMode === 'replace' && !confirmReplace) {
      toast({
        variant: 'destructive',
        title: 'Confirmación requerida',
        description: 'Debe marcar la casilla de confirmación para reemplazar el catálogo existente.',
      });
      return;
    }

    setIsUploading(true);
    setMigrationProgress({ done: 0, total: parsedPreview.length });

    try {
      // 1. Si es modo reemplazo, vaciar catálogo previo
      if (migrationMode === 'replace') {
        const snap = await getDocs(collection(firestore, 'registros-civiles'));
        const BATCH_DELETE_SIZE = 100;
        for (let i = 0; i < snap.docs.length; i += BATCH_DELETE_SIZE) {
          const batch = writeBatch(firestore);
          snap.docs.slice(i, i + BATCH_DELETE_SIZE).forEach(d => {
            batch.delete(d.ref);
          });
          await batch.commit();
        }
      }

      // 2. Mapa existente para modo upsert (sincronizado directamente con Firestore)
      const existingMap = new Map<string, string>();
      if (migrationMode === 'upsert') {
        const snap = await getDocs(collection(firestore, 'registros-civiles'));
        snap.forEach(d => {
          const data = d.data();
          const num = String(data.numero ?? '').trim().toUpperCase();
          const dep = String(data.departamento ?? '').trim().toUpperCase();
          if (num && dep) existingMap.set(`${num}|${dep}`, d.id);
        });
      }

      // 3. Inserción / actualización en bloques de 100
      const BATCH_SIZE = 100;
      let processed = 0;

      for (let i = 0; i < parsedPreview.length; i += BATCH_SIZE) {
        const batch = writeBatch(firestore);
        const chunk = parsedPreview.slice(i, i + BATCH_SIZE);

        chunk.forEach(item => {
          const numClean = String(item.numero ?? '').trim();
          const nomClean = String(item.nombre ?? '').trim().toUpperCase();
          const depClean = String(item.departamento ?? '').trim().toUpperCase();
          const distClean = String(item.distrito ?? nomClean).trim().toUpperCase();

          const key = `${numClean.toUpperCase()}|${depClean}`;
          const existingId = migrationMode === 'upsert' ? existingMap.get(key) : null;

          const docData = {
            numero: numClean,
            nombre: nomClean,
            departamento: depClean || '00 - ASUNCION',
            distrito: distClean || 'ASUNCIÓN',
            fecha_actualizacion: new Date().toISOString(),
          };

          if (existingId) {
            const docRef = doc(firestore, 'registros-civiles', existingId);
            batch.set(docRef, docData, { merge: true });
          } else {
            const newRef = doc(collection(firestore, 'registros-civiles'));
            batch.set(newRef, {
              ...docData,
              fecha_creacion: new Date().toISOString(),
            });
          }
        });

        await batch.commit();
        processed += chunk.length;
        setMigrationProgress({ done: processed, total: parsedPreview.length });
      }

      recordAuditLog(firestore, {
        usuario_id: user.uid,
        usuario_nombre: user.profile?.username || user.email || 'Admin',
        usuario_rol: user.profile?.role || 'admin',
        accion: 'CREAR',
        modulo: 'gestion-de-datos',
        documento_id: 'migracion-registros-civiles',
        detalles: `Migración de ${parsedPreview.length} oficinas del Registro Civil (Modo: ${migrationMode === 'replace' ? 'Reemplazo' : 'Fusión/Upsert'}). Archivo: ${migrationFileName || 'Excel'}`,
      });

      toast({
        title: '🎉 ¡Migración completada con éxito!',
        description: `Se han procesado ${parsedPreview.length} oficinas del Registro Civil en el sistema.`,
      });

      setParsedPreview([]);
      setMigrationFileName(null);
      loadRegistros();
    } catch (e: any) {
      console.error("Error en migración masiva:", e);
      const isPermError = e?.message?.includes('insufficient permissions') || e?.code === 'permission-denied';
      toast({
        variant: 'destructive',
        title: 'Error durante la migración de datos',
        description: isPermError
          ? 'Las reglas de Firestore no están publicadas en Firebase Cloud. Debe desplegar las reglas a Firebase.'
          : (e?.message || 'Error inesperado al guardar datos.'),
      });
    } finally {
      setIsUploading(false);
      setMigrationProgress(null);
    }
  };

  // Agregar oficina manual
  const handleAddManual = async () => {
    if (!firestore) return;
    if (!form.numero || !form.nombre) {
      return toast({ variant: 'destructive', title: 'N° y Nombre son obligatorios' });
    }
    setSavingManual(true);
    try {
      await addDoc(collection(firestore, 'registros-civiles'), {
        numero: form.numero.trim(),
        nombre: form.nombre.trim().toUpperCase(),
        departamento: form.departamento.trim().toUpperCase() || 'SIN DEPARTAMENTO',
        distrito: form.distrito.trim().toUpperCase() || 'SIN DISTRITO',
        fecha_creacion: new Date().toISOString(),
      });
      setForm({ numero: '', nombre: '', departamento: '', distrito: '' });
      toast({ title: '✅ Oficina agregada correctamente al catálogo' });
      loadRegistros();
    } catch {
      toast({ variant: 'destructive', title: 'Error al guardar oficina' });
    } finally {
      setSavingManual(false);
    }
  };

  // Actualizar oficina existente
  const handleUpdateOffice = async () => {
    if (!firestore || !editingOffice) return;
    setSavingEdit(true);
    try {
      await updateDoc(doc(firestore, 'registros-civiles', editingOffice.id), {
        numero: String(editingOffice.numero || '').trim(),
        nombre: String(editingOffice.nombre || '').trim().toUpperCase(),
        departamento: String(editingOffice.departamento || '').trim().toUpperCase(),
        distrito: String(editingOffice.distrito || '').trim().toUpperCase(),
        fecha_actualizacion: new Date().toISOString(),
      });
      toast({ title: '✅ Oficina actualizada con éxito' });
      setEditingOffice(null);
      loadRegistros();
    } catch {
      toast({ variant: 'destructive', title: 'Error al actualizar' });
    } finally {
      setSavingEdit(false);
    }
  };

  // Eliminar oficina
  const handleRemove = async (id: string, nombre: string) => {
    if (!firestore || !confirm(`¿Está seguro de eliminar la oficina "${nombre}"?`)) return;
    try {
      await deleteDoc(doc(firestore, 'registros-civiles', id));
      toast({ title: 'Oficina eliminada del catálogo' });
      loadRegistros();
    } catch {
      toast({ variant: 'destructive', title: 'Error al eliminar' });
    }
  };

  // Filtrado de oficinas
  const filteredRegistros = useMemo(() => {
    return registros.filter(r => {
      const matchSearch =
        `${r.numero} ${r.nombre} ${r.distrito} ${r.departamento}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
      const matchDept =
        selectedDeptFilter === 'TODOS' ||
        (r.departamento && r.departamento.toUpperCase() === selectedDeptFilter.toUpperCase());
      return matchSearch && matchDept;
    });
  }, [registros, searchTerm, selectedDeptFilter]);

  // Agrupación por departamento -> distrito
  const groupedRegistros = useMemo(() => {
    const acc: Record<string, Record<string, RegistroCivil[]>> = {};
    filteredRegistros.forEach(r => {
      const dep = r.departamento || 'SIN DEPARTAMENTO';
      const dist = r.distrito || 'SIN DISTRITO';
      if (!acc[dep]) acc[dep] = {};
      if (!acc[dep][dist]) acc[dep][dist] = [];
      acc[dep][dist].push(r);
    });
    return Object.entries(acc).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredRegistros]);

  if (isUserLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin h-10 w-10 text-primary" />
      </div>
    );
  }

  // Si no es administrador, denegar acceso inmediatamente
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
        <Header title="Gestión de Datos: Oficinas" />
        <main className="flex-1 flex items-center justify-center p-6">
          <Card className="max-w-md w-full border-2 border-dashed rounded-3xl p-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-black uppercase text-foreground">Acceso Restringido</h2>
              <p className="text-xs text-muted-foreground font-medium">
                El módulo de migración masiva y catálogo de oficinas pertenece a <strong>Gestión de Datos</strong> y es exclusivo para Administradores del Sistema.
              </p>
            </div>
            <Button asChild className="font-black uppercase text-xs h-11 rounded-xl w-full">
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" /> Volver al Inicio
              </Link>
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Gestión de Datos: Migración de Oficinas" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        {/* Cabecera y accesos rápidos */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[9px] font-black uppercase bg-primary/10 text-primary border-primary/20">
                Gestión de Datos
              </Badge>
              <Badge variant="outline" className="text-[9px] font-black uppercase bg-amber-500/10 text-amber-600 border-amber-500/20">
                Solo Administradores
              </Badge>
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-primary mt-1">
              Catálogo y Migración de Oficinas (REC)
            </h1>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              Administración centralizada de las Oficinas del Registro del Estado Civil para asignación de usuarios y libros.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="font-black uppercase text-[10px] gap-1.5 h-10 rounded-xl"
            >
              <Download className="h-3.5 w-3.5" /> Plantilla Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportOffices}
              disabled={registros.length === 0}
              className="font-black uppercase text-[10px] gap-1.5 h-10 rounded-xl"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" /> Exportar ({registros.length})
            </Button>
            <Button asChild variant="outline" size="sm" className="font-black uppercase text-[10px] gap-1.5 h-10 rounded-xl border-2">
              <Link href="/users">
                <Users className="h-3.5 w-3.5 text-primary" /> Ir a Módulo Usuarios <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Resumen de Métricas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="rounded-2xl p-4 bg-white shadow-sm border space-y-1">
            <p className="text-[9px] font-black uppercase text-muted-foreground">Total Oficinas Registradas</p>
            <p className="text-2xl font-black uppercase text-primary">{registros.length}</p>
          </Card>
          <Card className="rounded-2xl p-4 bg-white shadow-sm border space-y-1">
            <p className="text-[9px] font-black uppercase text-muted-foreground">Departamentos Cubiertos</p>
            <p className="text-2xl font-black uppercase text-foreground">{departamentos.length}</p>
          </Card>
          <Card className="rounded-2xl p-4 bg-white shadow-sm border space-y-1">
            <p className="text-[9px] font-black uppercase text-muted-foreground">Colección Firestore</p>
            <p className="text-xs font-mono font-bold text-foreground truncate mt-1.5">registros-civiles</p>
          </Card>
          <Card className="rounded-2xl p-4 bg-white shadow-sm border space-y-1">
            <p className="text-[9px] font-black uppercase text-muted-foreground">Independencia de Geografía</p>
            <p className="text-xs font-black uppercase text-green-600 mt-1.5 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> 100% Aislado de DGRE
            </p>
          </Card>
        </div>

        {/* Banner de Garantía de Aislamiento */}
        <div className="bg-sky-50 border-2 border-sky-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="h-8 w-8 rounded-xl bg-sky-600/10 text-sky-700 flex items-center justify-center shrink-0 mt-0.5">
            <Database className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-black uppercase text-sky-950 flex items-center gap-2">
              Módulo Central de Datos — Catálogo Independiente
            </p>
            <p className="text-xs text-sky-900 leading-relaxed font-medium">
              Este catálogo se administra de forma <strong>completamente independiente</strong> a las oficinas electorales y geografía de la DGRE/TSJE (colección <code>datos</code>). No modifica ni reemplaza los registros electorales del sistema. Tras migrar o agregar oficinas aquí, las mismas quedan automáticamente habilitadas en el <strong>Módulo Usuarios</strong> para su asignación correspondiente a los funcionarios.
            </p>
          </div>
        </div>

        {/* SECCIÓN MIGRACIÓN EXCEL */}
        <Card className="rounded-[1.5rem] shadow-lg border-2 border-primary/20 overflow-hidden bg-white">
          <CardHeader className="bg-muted/10 p-6 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-black uppercase text-base flex items-center gap-2 text-primary">
                <FileUp className="h-5 w-5 text-amber-500" /> Migrador Masivo de Oficinas (.xlsx / .csv)
              </CardTitle>
              <CardDescription className="text-xs font-medium">
                Cargue archivos Excel con columnas: <span className="font-bold text-foreground">NUMERO, NOMBRE, DEPARTAMENTO, DISTRITO</span>.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMigrateCard(!showMigrateCard)}
              className="font-black uppercase text-[10px] h-8 rounded-xl"
            >
              {showMigrateCard ? 'Ocultar Subida' : 'Mostrar Subida'}
            </Button>
          </CardHeader>

          {showMigrateCard && (
            <CardContent className="p-6 space-y-6">
              {/* Zona de subida */}
              <div className="border-2 border-dashed border-primary/30 rounded-2xl p-8 bg-muted/5 text-center hover:bg-white hover:border-primary transition-all">
                <label htmlFor="file-migracion-oficinas" className="cursor-pointer flex flex-col items-center gap-2">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-1">
                    <FileSpreadsheet className="h-7 w-7 text-green-600" />
                  </div>
                  <span className="font-black uppercase text-xs text-primary">
                    {isParsing ? 'Procesando archivo...' : 'Haga clic para seleccionar archivo Excel o CSV'}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    Formatos compatibles: .xlsx, .xls, .csv (Detección automática inteligente de encabezados)
                  </span>
                </label>
                <input
                  id="file-migracion-oficinas"
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  disabled={isParsing || isUploading}
                />
                {migrationFileName && (
                  <p className="mt-3 text-xs font-black text-green-700 uppercase flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Archivo cargado: {migrationFileName}
                  </p>
                )}
              </div>

              {/* Vista previa si hay datos cargados */}
              {parsedPreview.length > 0 && (
                <div className="space-y-4 bg-white p-5 rounded-2xl border shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-3">
                    <div>
                      <h4 className="font-black uppercase text-xs text-foreground flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                        Vista Previa de la Migración ({parsedPreview.length} oficinas detectadas)
                      </h4>
                      <p className="text-[10px] text-muted-foreground">
                        Revise los datos antes de ejecutar la carga en la base de datos.
                      </p>
                    </div>
                    <Badge className="bg-green-600 text-white font-black text-[9px] uppercase px-3 py-1">
                      {parsedPreview.length} FILAS LISTAS
                    </Badge>
                  </div>

                  {detectedInfo && (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3.5 text-xs space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase text-primary">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Columnas Reconocidas:
                        <Badge variant="outline" className="bg-white text-[9px]">N°: {detectedInfo.numeroCol}</Badge>
                        <Badge variant="outline" className="bg-white text-[9px]">Oficina: {detectedInfo.nombreCol}</Badge>
                        <Badge variant="outline" className="bg-white text-[9px]">Dpto: {detectedInfo.deptCol}</Badge>
                        <Badge variant="outline" className="bg-white text-[9px]">Distrito: {detectedInfo.distCol || 'Autodeducido'}</Badge>
                      </div>
                      {detectedInfo.deducedDistricts && (
                        <p className="text-[10px] text-muted-foreground font-medium">
                          ℹ La columna <strong>DISTRITO</strong> no venía explícita; se dedujo inteligentemente por departamento y ciudad entre paréntesis. Puede editar los campos en la tabla inferior antes de migrar.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Tabla con scroll de las primeras 30 filas */}
                  <div className="overflow-x-auto border rounded-xl max-h-96 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/80 sticky top-0 text-[9px] font-black uppercase text-muted-foreground border-b shadow-sm z-10">
                        <tr>
                          <th className="p-2.5 w-20">N°</th>
                          <th className="p-2.5">Nombre / Denominación</th>
                          <th className="p-2.5 w-44">Departamento</th>
                          <th className="p-2.5 w-44">Distrito</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y font-bold">
                        {parsedPreview.slice(0, 30).map((row, idx) => (
                          <tr key={idx} className="hover:bg-muted/20">
                            <td className="p-2.5 font-black text-primary whitespace-nowrap">{row.numero}</td>
                            <td className="p-2.5 uppercase">{row.nombre}</td>
                            <td className="p-2.5">
                              <input
                                value={row.departamento}
                                onChange={e => {
                                  const val = e.target.value.toUpperCase();
                                  setParsedPreview(prev => {
                                    const n = [...prev];
                                    n[idx] = { ...n[idx], departamento: val };
                                    return n;
                                  });
                                }}
                                className="h-8 w-full border rounded px-2 font-bold text-xs uppercase bg-transparent hover:bg-white focus:bg-white"
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                value={row.distrito}
                                onChange={e => {
                                  const val = e.target.value.toUpperCase();
                                  setParsedPreview(prev => {
                                    const n = [...prev];
                                    n[idx] = { ...n[idx], distrito: val };
                                    return n;
                                  });
                                }}
                                className="h-8 w-full border rounded px-2 font-bold text-xs uppercase bg-transparent hover:bg-white focus:bg-white"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {parsedPreview.length > 30 && (
                      <div className="p-2.5 text-center text-[10px] font-black text-muted-foreground bg-muted/20 uppercase border-t">
                        Mostrando las primeras 30 de {parsedPreview.length} oficinas detectadas (todas serán migradas)
                      </div>
                    )}
                  </div>

                  {/* Modo de migración */}
                  <div className="p-4 bg-muted/20 rounded-xl space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-primary">Modo de Migración</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label
                        className={cn(
                          'flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all bg-white',
                          migrationMode === 'upsert' ? 'border-primary shadow-sm' : 'border-transparent'
                        )}
                      >
                        <input
                          type="radio"
                          name="mig-mode-page"
                          checked={migrationMode === 'upsert'}
                          onChange={() => setMigrationMode('upsert')}
                          className="mt-0.5"
                        />
                        <div>
                          <p className="text-xs font-black uppercase text-foreground">Fusión Inteligente / Upsert (Recomendado)</p>
                          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                            Agrega oficinas nuevas y actualiza las existentes de este catálogo si coincide el N° y departamento, conservando el resto intacto.
                          </p>
                        </div>
                      </label>

                      <label
                        className={cn(
                          'flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all bg-white',
                          migrationMode === 'replace' ? 'border-destructive shadow-sm' : 'border-transparent'
                        )}
                      >
                        <input
                          type="radio"
                          name="mig-mode-page"
                          checked={migrationMode === 'replace'}
                          onChange={() => setMigrationMode('replace')}
                          className="mt-0.5"
                        />
                        <div>
                          <p className="text-xs font-black uppercase text-destructive">Reemplazo del Catálogo de Registro Civil</p>
                          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                            Vacía únicamente las oficinas previas de este catálogo (REC) y carga las de este archivo. No toca ninguna otra oficina o dato del sistema.
                          </p>
                        </div>
                      </label>
                    </div>

                    {migrationMode === 'replace' && (
                      <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-2">
                        <Checkbox
                          id="conf-replace-page"
                          checked={confirmReplace}
                          onCheckedChange={c => setConfirmReplace(!!c)}
                        />
                        <label htmlFor="conf-replace-page" className="text-xs font-black uppercase text-destructive cursor-pointer">
                          Confirmo que deseo vaciar el catálogo previo de Registro Civil ({registros.length} oficinas) y reemplazarlo por las {parsedPreview.length} del archivo.
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Barra de progreso */}
                  {migrationProgress && (
                    <div className="space-y-1.5 pt-2">
                      <div className="flex justify-between text-xs font-black uppercase">
                        <span>Migrando datos a Firestore...</span>
                        <span>
                          {migrationProgress.done} / {migrationProgress.total} (
                          {Math.round((migrationProgress.done / migrationProgress.total) * 100)}%)
                        </span>
                      </div>
                      <div className="h-3 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-green-600 transition-all duration-200"
                          style={{
                            width: `${Math.round((migrationProgress.done / migrationProgress.total) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Acciones */}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => { setParsedPreview([]); setMigrationFileName(null); }}
                      disabled={isUploading}
                      className="font-black uppercase text-[10px] rounded-xl h-10 px-4"
                    >
                      Descartar Archivo
                    </Button>
                    <Button
                      onClick={handleExecuteMigration}
                      disabled={isUploading || (migrationMode === 'replace' && !confirmReplace)}
                      className="font-black uppercase text-[10px] gap-2 rounded-xl h-10 px-6 bg-black hover:bg-black/90 text-white shadow-lg"
                    >
                      {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-amber-400" />}
                      Confirmar y Ejecutar Migración ({parsedPreview.length} Oficinas)
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* ALTA INDIVIDUAL */}
        <div className="border rounded-2xl p-5 bg-white shadow-sm space-y-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Agregar Oficina Individualmente al Catálogo
          </p>
          <div className="grid gap-3 md:grid-cols-5 items-end">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase">N° Oficina</Label>
              <Input
                placeholder="Ej: 001"
                value={form.numero}
                onChange={e => setForm(p => ({ ...p, numero: e.target.value }))}
                className="border-2 font-bold h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase">Nombre / Denominación</Label>
              <Input
                placeholder="Ej: OFICINA CATEDRAL"
                value={form.nombre}
                onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                className="border-2 font-bold uppercase h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase">Departamento</Label>
              <Input
                placeholder="Ej: ALTO PARANÁ"
                value={form.departamento}
                onChange={e => setForm(p => ({ ...p, departamento: e.target.value }))}
                className="border-2 font-bold uppercase h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase">Distrito</Label>
              <Input
                placeholder="Ej: CIUDAD DEL ESTE"
                value={form.distrito}
                onChange={e => setForm(p => ({ ...p, distrito: e.target.value }))}
                className="border-2 font-bold uppercase h-10 rounded-xl"
              />
            </div>
            <Button
              onClick={handleAddManual}
              disabled={savingManual}
              className="font-black uppercase text-[10px] gap-2 h-10 rounded-xl bg-black hover:bg-black/90 text-white"
            >
              {savingManual ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Agregar Oficina
            </Button>
          </div>
        </div>

        {/* LISTADO DE OFICINAS REGISTRADAS */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="font-black uppercase text-sm tracking-tight text-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Directorio Oficial de Oficinas ({filteredRegistros.length} de {registros.length})
              </h3>
              <p className="text-[10px] text-muted-foreground">
                Agrupadas por departamento y distrito electoral para rápida consulta y asignación.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar oficina o distrito..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-8 h-9 border-2 font-bold text-xs rounded-xl"
                />
              </div>
              <Select value={selectedDeptFilter} onValueChange={setSelectedDeptFilter}>
                <SelectTrigger className="h-9 border-2 font-bold text-xs uppercase rounded-xl w-48 bg-white">
                  <SelectValue placeholder="Departamento..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos los Departamentos</SelectItem>
                  {departamentos.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {registros.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed">
              <Building2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs font-black uppercase text-muted-foreground">Sin oficinas registradas aún.</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Suba el archivo Excel en la sección superior para migrar las 502 oficinas.
              </p>
            </div>
          ) : groupedRegistros.length === 0 ? (
            <p className="text-xs text-muted-foreground font-bold uppercase text-center py-8">
              No se encontraron oficinas que coincidan con la búsqueda.
            </p>
          ) : (
            <div className="space-y-6">
              {groupedRegistros.map(([dep, distritosMap]) => {
                const totalOfisDep = Object.values(distritosMap).reduce((acc, curr) => acc + curr.length, 0);
                return (
                  <div key={dep} className="border rounded-2xl p-4 bg-white shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        <h4 className="font-black uppercase text-sm text-foreground">{dep}</h4>
                      </div>
                      <Badge className="bg-black text-white text-[9px] font-black uppercase px-2.5">
                        {totalOfisDep} {totalOfisDep === 1 ? 'oficina' : 'oficinas'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Object.entries(distritosMap).map(([distrito, ofis]) => (
                        <div key={distrito} className="bg-muted/15 rounded-xl p-3 border space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-wider text-primary flex items-center justify-between">
                            <span>{distrito}</span>
                            <span className="text-muted-foreground font-bold">({ofis.length})</span>
                          </p>
                          <div className="space-y-1.5">
                            {ofis.map(r => (
                              <div
                                key={r.id}
                                className="flex items-center justify-between border bg-white rounded-lg p-2 hover:border-primary/40 transition-colors"
                              >
                                <div className="min-w-0 pr-2">
                                  <p className="text-xs font-black uppercase text-foreground leading-tight truncate">
                                    N° {r.numero} — {r.nombre}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setEditingOffice(r)}
                                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                                    title="Editar oficina"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemove(r.id, r.nombre)}
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    title="Eliminar oficina"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal de edición rápida de oficina */}
        <Dialog open={!!editingOffice} onOpenChange={open => { if (!open) setEditingOffice(null); }}>
          <DialogContent className="max-w-md rounded-2xl p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-black uppercase flex items-center gap-2">
                <Edit className="h-4 w-4 text-primary" /> Editar Oficina del Registro Civil
              </DialogTitle>
              <DialogDescription className="text-xs font-medium">
                Actualice los datos identificatorios de la oficina.
              </DialogDescription>
            </DialogHeader>

            {editingOffice && (
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase">N° Oficina</Label>
                  <Input
                    value={editingOffice.numero}
                    onChange={e => setEditingOffice({ ...editingOffice, numero: e.target.value })}
                    className="border-2 font-bold h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase">Nombre / Denominación</Label>
                  <Input
                    value={editingOffice.nombre}
                    onChange={e => setEditingOffice({ ...editingOffice, nombre: e.target.value })}
                    className="border-2 font-bold uppercase h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase">Departamento</Label>
                  <Input
                    value={editingOffice.departamento}
                    onChange={e => setEditingOffice({ ...editingOffice, departamento: e.target.value })}
                    className="border-2 font-bold uppercase h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase">Distrito</Label>
                  <Input
                    value={editingOffice.distrito}
                    onChange={e => setEditingOffice({ ...editingOffice, distrito: e.target.value })}
                    className="border-2 font-bold uppercase h-10 rounded-xl"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="pt-3 border-t gap-2">
              <Button
                variant="outline"
                onClick={() => setEditingOffice(null)}
                className="font-black uppercase text-[10px] rounded-xl h-10 px-4"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUpdateOffice}
                disabled={savingEdit}
                className="font-black uppercase text-[10px] gap-1.5 rounded-xl h-10 px-5 bg-black hover:bg-black/90 text-white"
              >
                {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Guardar Cambios
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </main>
    </div>
  );
}
