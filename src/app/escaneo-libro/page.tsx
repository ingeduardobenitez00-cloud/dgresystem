"use client";

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirebase } from '@/firebase';
import {
  collection, addDoc, getDocs, getDoc, setDoc, deleteDoc, doc, query, where, orderBy,
  updateDoc, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { recordAuditLog } from '@/lib/audit';
import { cn } from '@/lib/utils';
import {
  Loader2, BookOpen, Camera, Plus, ArrowLeft, Building2, UserCheck, Trash2,
  CheckCircle2, ImageIcon, ChevronLeft, ChevronRight, Upload, Search, ScanLine,
  FileSpreadsheet, Download, RefreshCw, AlertCircle, Edit, Check, X, FileUp, Sparkles, Filter,
  MapPin, CheckSquare, Layers, FileText, Archive, Zap, ZapOff, RotateCw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { exportLibroToPdf, exportLibroToZip, FolioInfo } from '@/lib/libro-exporter';

/* ===================== Tipos ===================== */
const TOTAL_FOLIOS = 200;
const MAX_REGISTROS_POR_USUARIO = 2;

type RegistroCivil = {
  id: string;
  numero: string;
  nombre: string;
  departamento: string;
  distrito: string;
};

type Asignacion = {
  id: string; // = uid del usuario
  usuario_id: string;
  username: string;
  departamento?: string;
  distrito?: string;
  registros: string[]; // ids de registros-civiles (máx. 2)
};

type LibroEscaneo = {
  id: string;
  registro_civil_id: string;
  registro_civil_nombre: string;
  registro_civil_numero: string;
  departamento: string;
  distrito: string;
  nombre_libro?: string;
  tipo_libro: string;
  anio: string;
  tomo: string;
  numero_libro: string;
  folio_desde: number;
  total_folios: number;
  fecha_apertura: string;
  fecha_cierre: string;
  observaciones: string;
  folios_escaneados: number;
  usuario_id: string;
  username: string;
  fecha_creacion: string;
};

type Folio = { id: string; folio: number; foto: string; username: string; fecha: string };

type UserLite = {
  id: string;
  username: string;
  email: string;
  role?: string;
  departamento?: string;
  distrito?: string;
  oficinas_registro_civil?: string[];
};

/* ===================== Utilidades ===================== */
const geoMatches = (a?: string, b?: string): boolean => {
  if (!a || !b) return false;
  const clean = (s: string) =>
    String(s || '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/^\d+\s*-\s*/, '')
      .trim();
  const cA = clean(a);
  const cB = clean(b);
  if (cA === cB) return true;
  if (cA.includes(cB) || cB.includes(cA)) return true;
  if ((cA === 'CAPITAL' && cB === 'ASUNCION') || (cA === 'ASUNCION' && cB === 'CAPITAL')) return true;
  return false;
};

let cachedRegistros: RegistroCivil[] | null = null;

/** Compresión optimizada para manuscritos en alta resolución preservando legibilidad y evitando saturación de memoria RAM */
const compressPageToBlob = (fileOrBlob: File | Blob): Promise<Blob> =>
  new Promise((resolve, reject) => {
    // Si ya es un JPEG optimizado generado desde canvas o menor a 650KB, listo para subir
    if (fileOrBlob instanceof Blob && fileOrBlob.size < 650 * 1024 && fileOrBlob.type === 'image/jpeg') {
      return resolve(fileOrBlob);
    }
    const objectUrl = URL.createObjectURL(fileOrBlob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 1920; // 1920px garantiza legibilidad cristalina del manuscrito y reduce tamaño a ~300KB
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('No se pudo inicializar canvas'));
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('No se pudo generar el archivo de imagen'));
        },
        'image/jpeg',
        0.82
      );
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
    img.src = objectUrl;
  });

/** Captura directa desde el stream de video de la cámara a un Blob JPEG en milisegundos */
const captureVideoToBlob = (video: HTMLVideoElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const w = video.videoWidth || 1920;
    const h = video.videoHeight || 1080;
    const MAX = 1920;
    const scale = Math.min(1, MAX / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('No se pudo obtener el contexto del canvas'));
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('No se pudo capturar la foto de la cámara'));
      },
      'image/jpeg',
      0.82
    );
  });

const emptyLibro = {
  registro_civil_id: '', tipo_libro: 'DEFUNCIONES', anio: String(new Date().getFullYear()),
  tomo: '', numero_libro: '', folio_desde: '1', fecha_apertura: '', fecha_cierre: '', observaciones: '',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-black uppercase tracking-tight">{label}</Label>
      {children}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/70 border p-3">
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-sm font-black uppercase mt-0.5 break-words">{value || '—'}</p>
    </div>
  );
}

/* ===================== Componente principal ===================== */
function EscaneoLibroContent() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const role = user?.profile?.role;
  const isAdmin = role === 'admin' || role === 'superadmin' || user?.email === 'edubtz11@gmail.com';

  const [registros, setRegistros] = useState<RegistroCivil[]>([]);
  const [misRegistrosIds, setMisRegistrosIds] = useState<string[]>([]);
  const [oficinaSeleccionadaId, setOficinaSeleccionadaId] = useState<string>('');
  const [libros, setLibros] = useState<LibroEscaneo[]>([]);
  const [loading, setLoading] = useState(true);
  const [libroActivo, setLibroActivo] = useState<LibroEscaneo | null>(null);
  const [autoStartCamera, setAutoStartCamera] = useState(false);
  const [showNuevoLibro, setShowNuevoLibro] = useState(false);

  const searchParams = useSearchParams();
  const urlLibroId = searchParams.get('libro');

  // Si hay un libro en el URL o guardado en sessionStorage, restaurarlo inmediatamente sin recargar todo el módulo
  useEffect(() => {
    const targetId = urlLibroId || (typeof window !== 'undefined' ? sessionStorage.getItem('escaneo_activo_libro_id') : null);
    if (!firestore || !targetId || libroActivo?.id === targetId) return;

    let isMounted = true;
    (async () => {
      try {
        const snap = await getDoc(doc(firestore, 'libros-escaneo', targetId));
        if (snap.exists() && isMounted) {
          const data = { id: snap.id, ...snap.data() } as LibroEscaneo;
          setLibroActivo(data);
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('escaneo_activo_libro_id', snap.id);
            const url = new URL(window.location.href);
            if (url.searchParams.get('libro') !== snap.id) {
              url.searchParams.set('libro', snap.id);
              window.history.replaceState({}, '', url.toString());
            }
          }
        }
      } catch (err) {
        console.warn('Error restaurando libro activo:', err);
      }
    })();
    return () => { isMounted = false; };
  }, [firestore, urlLibroId, libroActivo?.id]);

  /* -------- Carga inicial -------- */
  const loadBase = useCallback(async () => {
    if (!firestore || !user) return;
    setLoading(true);
    try {
      let regs = cachedRegistros;
      if (!regs || regs.length === 0) {
        const regSnap = await getDocs(collection(firestore, 'registros-civiles'));
        regs = regSnap.docs.map(d => ({ id: d.id, ...d.data() } as RegistroCivil));
        regs.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        cachedRegistros = regs;
      }
      setRegistros(regs);

      // Cargar SOLAMENTE las oficinas asignadas específicamente a este usuario (máximo 2)
      let ids: string[] = [];
      try {
        const asigSnap = await getDoc(doc(firestore, 'asignaciones-registro-civil', user.uid));
        if (asigSnap.exists()) {
          const d = asigSnap.data();
          if (Array.isArray(d.registros) && d.registros.length > 0) {
            ids = d.registros;
          }
        }
      } catch (err) {
        console.warn('Error leyendo asignaciones:', err);
      }

      if (ids.length === 0) {
        try {
          const userDocSnap = await getDoc(doc(firestore, 'users', user.uid));
          if (userDocSnap.exists()) {
            const uData = userDocSnap.data();
            if (Array.isArray(uData.oficinas_registro_civil) && uData.oficinas_registro_civil.length > 0) {
              ids = uData.oficinas_registro_civil;
            }
          }
        } catch (ue) {
          console.warn('Error leyendo user doc:', ue);
        }
      }

      if (ids.length === 0 && Array.isArray(user.profile?.oficinas_registro_civil) && user.profile.oficinas_registro_civil.length > 0) {
        ids = user.profile.oficinas_registro_civil;
      }

      setMisRegistrosIds(ids);

      // Cargar libros de las oficinas asignadas
      if (ids.length > 0) {
        const q = query(
          collection(firestore, 'libros-escaneo'),
          where('registro_civil_id', 'in', ids.slice(0, 30))
        );
        const lSnap = await getDocs(q);
        const ls = lSnap.docs.map(d => ({ id: d.id, ...d.data() } as LibroEscaneo));
        ls.sort((a, b) => (b.fecha_creacion || '').localeCompare(a.fecha_creacion || ''));
        setLibros(ls);
      } else {
        setLibros([]);
      }
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error al cargar datos' });
    } finally {
      setLoading(false);
    }
  }, [firestore, user, toast]);

  useEffect(() => { loadBase(); }, [loadBase]);

  const handleOpenLibro = useCallback((l: LibroEscaneo) => {
    setAutoStartCamera(false);
    setLibroActivo(l);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('escaneo_activo_libro_id', l.id);
      const url = new URL(window.location.href);
      url.searchParams.set('libro', l.id);
      window.history.pushState({}, '', url.toString());
    }
  }, []);

  const handleBackFromLibro = useCallback(() => {
    setLibroActivo(null);
    setAutoStartCamera(false);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('escaneo_activo_libro_id');
      const url = new URL(window.location.href);
      url.searchParams.delete('libro');
      window.history.pushState({}, '', url.toString());
    }
    loadBase();
  }, [loadBase]);

  const misRegistros = useMemo(
    () => registros.filter(r => misRegistrosIds.includes(r.id)),
    [registros, misRegistrosIds]
  );

  // Mantener seleccionada una oficina activa por defecto
  useEffect(() => {
    if (misRegistros.length > 0) {
      if (!oficinaSeleccionadaId || !misRegistros.some(r => r.id === oficinaSeleccionadaId)) {
        setOficinaSeleccionadaId(misRegistros[0].id);
      }
    }
  }, [misRegistros, oficinaSeleccionadaId]);

  const oficinaActiva = useMemo(
    () => misRegistros.find(r => r.id === oficinaSeleccionadaId) || misRegistros[0] || null,
    [misRegistros, oficinaSeleccionadaId]
  );

  const [downloadModal, setDownloadModal] = useState<{
    open: boolean;
    title: string;
    current: number;
    total: number;
    message: string;
  } | null>(null);

  const handleDownloadLibro = async (libroTarget: LibroEscaneo, format: 'pdf' | 'zip') => {
    if (!firestore) return;
    try {
      setDownloadModal({
        open: true,
        title: `Generando ${format === 'pdf' ? 'PDF' : 'archivo ZIP'}`,
        current: 0,
        total: 1,
        message: 'Consultando folios digitalizados...',
      });

      const snap = await getDocs(collection(firestore, 'libros-escaneo', libroTarget.id, 'folios'));
      const foliosList = snap.docs.map(d => d.data() as FolioInfo).sort((a, b) => a.folio - b.folio);

      if (foliosList.length === 0) {
        setDownloadModal(null);
        return toast({
          variant: 'destructive',
          title: 'Sin folios escaneados',
          description: 'Este libro aún no tiene folios fotografiados para descargar.',
        });
      }

      setDownloadModal({
        open: true,
        title: `Descargando ${libroTarget.nombre_libro || 'Libro'} (${format.toUpperCase()})`,
        current: 0,
        total: foliosList.length,
        message: `Preparando ${foliosList.length} folios...`,
      });

      if (format === 'pdf') {
        await exportLibroToPdf(libroTarget, foliosList, (cur, tot, msg) => {
          setDownloadModal(prev => prev ? { ...prev, current: cur, total: tot, message: msg } : null);
        });
      } else {
        await exportLibroToZip(libroTarget, foliosList, (cur, tot, msg) => {
          setDownloadModal(prev => prev ? { ...prev, current: cur, total: tot, message: msg } : null);
        });
      }

      toast({
        title: '✅ Descarga completada con éxito',
        description: `Se descargó "${libroTarget.nombre_libro || 'Libro'}" en formato ${format.toUpperCase()}.`,
      });
    } catch (err: any) {
      console.error('Error al exportar libro:', err);
      toast({
        variant: 'destructive',
        title: 'Error al exportar',
        description: err?.message || 'Ocurrió un error durante la descarga del libro.',
      });
    } finally {
      setTimeout(() => setDownloadModal(null), 800);
    }
  };

  if (isUserLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  }

  /* -------- Vista de un libro -------- */
  if (libroActivo) {
    return (
      <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
        <Header title="Escaneo de Libro" />
        <LibroScanner
          libro={libroActivo}
          autoStartCamera={autoStartCamera}
          onBack={handleBackFromLibro}
          onLibroChange={setLibroActivo}
          onDownload={(fmt) => handleDownloadLibro(libroActivo, fmt)}
        />
        {downloadModal && (
          <Dialog open={downloadModal.open} onOpenChange={() => {}}>
            <DialogContent className="max-w-md rounded-3xl p-6 sm:p-8 space-y-4">
              <DialogHeader className="text-center space-y-2">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center animate-bounce">
                  <Download className="h-7 w-7" />
                </div>
                <DialogTitle className="font-black uppercase text-base sm:text-lg">
                  {downloadModal.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Por favor espere mientras procesamos los folios del libro.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs font-black uppercase text-muted-foreground">
                  <span>Progreso</span>
                  <span>
                    {Math.round(((downloadModal.current || 0) / Math.max(1, downloadModal.total || 1)) * 100)}%
                  </span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{
                      width: `${Math.round(((downloadModal.current || 0) / Math.max(1, downloadModal.total || 1)) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-center font-bold text-foreground animate-pulse pt-1">
                  {downloadModal.message}
                </p>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Escaneo de Libro" />
      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Escaneo de Libro</h1>
            <p className="text-muted-foreground font-medium flex items-center gap-2 mt-1 text-sm">
              <ScanLine className="h-4 w-4" /> Relevamiento fotográfico de los {TOTAL_FOLIOS} folios del Libro de Defunciones
            </p>
          </div>
        </div>

        <LibrosList
          loading={loading}
          libros={libros}
          misRegistros={misRegistros}
          oficinaSeleccionadaId={oficinaSeleccionadaId}
          onSelectOficina={setOficinaSeleccionadaId}
          onOpen={handleOpenLibro}
          onNuevo={() => setShowNuevoLibro(true)}
          onDownload={handleDownloadLibro}
        />

        <NuevoLibroDialog
          open={showNuevoLibro}
          onOpenChange={setShowNuevoLibro}
          oficinaActiva={oficinaActiva}
          onCreatedAndStartScan={(l) => {
            setShowNuevoLibro(false);
            setLibros(prev => [l, ...prev]);
            setAutoStartCamera(true);
            handleOpenLibro(l);
          }}
        />

        {downloadModal && (
          <Dialog open={downloadModal.open} onOpenChange={() => {}}>
            <DialogContent className="max-w-md rounded-3xl p-6 sm:p-8 space-y-4">
              <DialogHeader className="text-center space-y-2">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center animate-bounce">
                  <Download className="h-7 w-7" />
                </div>
                <DialogTitle className="font-black uppercase text-base sm:text-lg">
                  {downloadModal.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Por favor espere mientras procesamos los folios del libro.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs font-black uppercase text-muted-foreground">
                  <span>Progreso</span>
                  <span>
                    {Math.round(((downloadModal.current || 0) / Math.max(1, downloadModal.total || 1)) * 100)}%
                  </span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{
                      width: `${Math.round(((downloadModal.current || 0) / Math.max(1, downloadModal.total || 1)) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-center font-bold text-foreground animate-pulse pt-1">
                  {downloadModal.message}
                </p>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </main>
    </div>
  );
}


/* ===================== Listado de libros ===================== */
function LibrosList({
  loading,
  libros,
  misRegistros,
  oficinaSeleccionadaId,
  onSelectOficina,
  onOpen,
  onNuevo,
  onDownload,
}: {
  loading: boolean;
  libros: LibroEscaneo[];
  misRegistros: RegistroCivil[];
  oficinaSeleccionadaId: string;
  onSelectOficina: (id: string) => void;
  onOpen: (l: LibroEscaneo) => void;
  onNuevo: () => void;
  onDownload: (l: LibroEscaneo, format: 'pdf' | 'zip') => void;
}) {
  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  const librosFiltrados = oficinaSeleccionadaId
    ? libros.filter(l => l.registro_civil_id === oficinaSeleccionadaId)
    : libros;

  return (
    <div className="space-y-6">
      {/* TARJETA DE OFICINAS ASIGNADAS AL USUARIO */}
      <Card className="rounded-[1.75rem] border-t-8 border-t-primary shadow-xl bg-white overflow-hidden">
        <CardContent className="p-6 md:p-8 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                <Building2 className="h-4 w-4" />
                Oficina del Registro Civil Asignada
              </p>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tight text-foreground mt-0.5">
                {misRegistros.length > 1
                  ? 'Seleccione la oficina con la que va a trabajar'
                  : 'Oficina Habilitada para Escaneo'}
              </h2>
              <p className="text-xs text-muted-foreground font-medium">
                {misRegistros.length > 1
                  ? 'Usted tiene 2 oficinas asignadas. Haga clic en una para activarla y cargar sus libros.'
                  : 'Los libros creados y escaneados quedarán vinculados a esta oficina registral.'}
              </p>
            </div>

            <Button
              onClick={onNuevo}
              disabled={misRegistros.length === 0}
              className="font-black uppercase text-xs gap-2 bg-black hover:bg-black/90 text-white h-12 px-6 rounded-2xl shadow-lg shrink-0"
            >
              <Plus className="h-5 w-5 text-emerald-400" /> Agregar Libro
            </Button>
          </div>

          {misRegistros.length === 0 ? (
            <div className="p-8 rounded-2xl bg-destructive/5 border-2 border-dashed border-destructive/20 text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-black uppercase text-destructive">
                  No tiene ninguna Oficina del Registro Civil asignada
                </p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Para poder agregar y escanear libros, un administrador debe asignarle una o dos oficinas del Registro Civil desde el módulo de Usuarios.
                </p>
              </div>
              <Link href="/users">
                <Button variant="outline" size="sm" className="font-black uppercase text-[10px] mt-2 rounded-xl">
                  Ir al Directorio de Usuarios
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {misRegistros.map(r => {
                const isSelected = r.id === oficinaSeleccionadaId;
                return (
                  <div
                    key={r.id}
                    onClick={() => onSelectOficina(r.id)}
                    className={cn(
                      'p-4 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between gap-3 shadow-sm',
                      isSelected
                        ? 'border-primary bg-primary/[0.04] ring-2 ring-primary/20 shadow-md'
                        : 'border-border/80 hover:border-primary/40 bg-white hover:bg-muted/10'
                    )}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={cn(
                          'h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors',
                          isSelected ? 'bg-primary text-white shadow-sm' : 'bg-muted text-muted-foreground'
                        )}
                      >
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-black uppercase truncate text-foreground leading-tight">
                          N° {r.numero} — {r.nombre}
                        </p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase truncate mt-1">
                          📍 {r.distrito}, {r.departamento}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isSelected ? (
                        <Badge className="bg-primary text-white text-[9px] font-black uppercase gap-1 py-1 px-3 shadow-sm">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> TRABAJANDO AQUÍ
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] font-black uppercase py-1 px-3 hover:bg-muted">
                          SELECCIONAR
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* LISTADO DE LIBROS DE LA OFICINA SELECCIONADA */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
            Libros de Defunciones ({librosFiltrados.length})
          </p>
          {librosFiltrados.length > 0 && (
            <Button
              onClick={onNuevo}
              size="sm"
              variant="outline"
              disabled={misRegistros.length === 0}
              className="font-black uppercase text-[10px] gap-1.5 h-8 rounded-xl"
            >
              <Plus className="h-3.5 w-3.5" /> Agregar Libro
            </Button>
          )}
        </div>

        {librosFiltrados.length === 0 ? (
          <Card className="rounded-2xl border-2 border-dashed p-12 text-center bg-white space-y-3">
            <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto" />
            <div className="space-y-1">
              <p className="text-xs font-black uppercase text-foreground">
                No hay libros registrados para esta oficina todavía
              </p>
              <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                Presione el botón &quot;Agregar Libro&quot; arriba para ingresar el nombre del libro y comenzar a capturar los folios con la cámara.
              </p>
            </div>
            <Button
              onClick={onNuevo}
              disabled={misRegistros.length === 0}
              className="font-black uppercase text-[10px] gap-2 rounded-xl h-10 px-5 mt-2 bg-black hover:bg-black/90 text-white"
            >
              <Plus className="h-4 w-4 text-emerald-400" /> Agregar Primer Libro
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {librosFiltrados.map(l => {
              const pct = Math.round(((l.folios_escaneados || 0) / (l.total_folios || TOTAL_FOLIOS)) * 100);
              const cantFolios = l.folios_escaneados || 0;
              return (
                <Card
                  key={l.id}
                  onClick={() => onOpen(l)}
                  className="cursor-pointer rounded-2xl hover:shadow-xl hover:-translate-y-0.5 transition-all border-l-8 border-l-primary bg-white group flex flex-col justify-between"
                >
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                          Libro de {l.tipo_libro}
                        </p>
                        <p className="text-base font-black uppercase text-foreground truncate">
                          {l.nombre_libro || `Tomo ${l.tomo || '—'} · Libro ${l.numero_libro || '—'}`}
                        </p>
                        <p className="text-[11px] font-bold uppercase text-muted-foreground mt-0.5">
                          Año {l.anio}
                        </p>
                      </div>
                      {pct === 100 && <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />}
                    </div>

                    <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1 truncate">
                      <Building2 className="h-3 w-3 shrink-0" /> N° {l.registro_civil_numero} — {l.registro_civil_nombre}
                    </p>

                    <div>
                      <div className="flex justify-between text-[10px] font-black uppercase mb-1">
                        <span>{cantFolios} / {l.total_folios} folios</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn('h-full transition-all duration-300', pct === 100 ? 'bg-green-600' : 'bg-primary')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* BOTÓN DESCARGAR LIBRO COMPLETO (PDF O FOTOS ZIP) */}
                    <div
                      className="pt-3 border-t flex items-center justify-between gap-2 mt-2"
                      onClick={e => e.stopPropagation()}
                    >
                      <span className="text-[9px] font-bold uppercase text-muted-foreground">
                        {cantFolios === 0 ? 'Sin folios' : 'Descargar completo'}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={cantFolios === 0}
                            className="h-8 px-3 text-[10px] font-black uppercase gap-1.5 rounded-xl hover:bg-black hover:text-white transition-all shadow-sm"
                          >
                            <Download className="h-3.5 w-3.5 text-primary" />
                            Descargar
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-60 rounded-2xl p-2 shadow-2xl">
                          <DropdownMenuItem
                            onClick={() => onDownload(l, 'pdf')}
                            className="font-black uppercase text-xs p-2.5 rounded-xl cursor-pointer gap-2.5 flex items-center"
                          >
                            <FileText className="h-4 w-4 text-rose-500" />
                            <div>
                              <p className="leading-tight">Descargar en PDF</p>
                              <p className="text-[9px] text-muted-foreground font-normal">Portada oficial y {cantFolios} folios</p>
                            </div>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onDownload(l, 'zip')}
                            className="font-black uppercase text-xs p-2.5 rounded-xl cursor-pointer gap-2.5 flex items-center"
                          >
                            <Archive className="h-4 w-4 text-amber-500" />
                            <div>
                              <p className="leading-tight">Descargar en Fotos (ZIP)</p>
                              <p className="text-[9px] text-muted-foreground font-normal">Todas las {cantFolios} fotos originales</p>
                            </div>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

          </div>
        )}
      </div>
    </div>
  );
}

/* ===================== Diálogo nuevo libro ===================== */
function NuevoLibroDialog({
  open,
  onOpenChange,
  oficinaActiva,
  onCreatedAndStartScan,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  oficinaActiva: RegistroCivil | null;
  onCreatedAndStartScan: (l: LibroEscaneo) => void;
}) {
  const { user } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [nombreLibro, setNombreLibro] = useState('');
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNombreLibro('');
      setAnio(String(new Date().getFullYear()));
    }
  }, [open]);

  const handleSiguiente = async () => {
    if (!firestore || !user) return;
    if (!oficinaActiva) {
      return toast({ variant: 'destructive', title: 'Seleccione una oficina', description: 'Debe haber una oficina activa seleccionada.' });
    }
    const cleanNombre = nombreLibro.trim();
    if (!cleanNombre) {
      return toast({ variant: 'destructive', title: 'Nombre requerido', description: 'Por favor ingrese el nombre del libro para continuar.' });
    }

    setSaving(true);
    try {
      const newDocRef = doc(collection(firestore, 'libros-escaneo'));
      const anioVal = anio.trim() || String(new Date().getFullYear());

      const data: LibroEscaneo = {
        id: newDocRef.id,
        registro_civil_id: oficinaActiva.id,
        registro_civil_nombre: oficinaActiva.nombre,
        registro_civil_numero: oficinaActiva.numero,
        departamento: oficinaActiva.departamento,
        distrito: oficinaActiva.distrito,
        nombre_libro: cleanNombre.toUpperCase(),
        tipo_libro: 'DEFUNCIONES',
        anio: anioVal,
        tomo: cleanNombre.toUpperCase(),
        numero_libro: '1',
        folio_desde: 1,
        total_folios: TOTAL_FOLIOS,
        fecha_apertura: new Date().toISOString().split('T')[0],
        fecha_cierre: '',
        observaciones: '',
        folios_escaneados: 0,
        usuario_id: user.uid,
        username: user.profile?.username || user.email || '',
        fecha_creacion: new Date().toISOString(),
      };

      // Guardar en Firestore
      await setDoc(newDocRef, { ...data, server_timestamp: serverTimestamp() });

      recordAuditLog(firestore, {
        usuario_id: user.uid,
        usuario_nombre: data.username || 'Usuario',
        usuario_rol: user.profile?.role || 'funcionario',
        accion: 'CREAR',
        modulo: 'escaneo-libro',
        documento_id: newDocRef.id,
        detalles: `Libro "${data.nombre_libro}" creado en N° ${oficinaActiva.numero} — ${oficinaActiva.nombre}`,
      });

      toast({ title: '✅ Libro creado', description: 'Iniciando captura con la cámara...' });
      onCreatedAndStartScan(data);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error al crear el libro' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Agregar Nuevo Libro
          </DialogTitle>
          <DialogDescription className="text-xs">
            Ingrese el nombre del libro para abrirlo y comenzar a fotografiar los {TOTAL_FOLIOS} folios.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* OFICINA SELECCIONADA */}
          {oficinaActiva && (
            <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase text-muted-foreground">Oficina de Registro Civil</p>
                <p className="text-xs font-black uppercase text-foreground truncate">
                  N° {oficinaActiva.numero} — {oficinaActiva.nombre}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase truncate">
                  📍 {oficinaActiva.distrito}, {oficinaActiva.departamento}
                </p>
              </div>
            </div>
          )}

          {/* CAMPO: NOMBRE DEL LIBRO */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-black uppercase text-foreground flex items-center justify-between">
              <span>Nombre del Libro *</span>
              <span className="text-[9px] text-primary font-bold">Obligatorio</span>
            </Label>
            <Input
              placeholder="Ej: LIBRO DE DEFUNCIONES 2024 / TOMO I"
              value={nombreLibro}
              onChange={e => setNombreLibro(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSiguiente();
                }
              }}
              className="h-12 border-2 font-black text-xs uppercase rounded-xl shadow-sm px-3.5"
              autoFocus
            />
            <p className="text-[10px] text-muted-foreground font-medium">
              Escriba el nombre, tomo o número de identificación que figura en la portada.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Año</Label>
              <Input
                value={anio}
                onChange={e => setAnio(e.target.value)}
                className="h-10 border-2 font-bold text-xs rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Total Folios</Label>
              <Input
                value={`${TOTAL_FOLIOS} folios`}
                disabled
                className="h-10 border-2 font-bold text-xs rounded-xl bg-muted/40"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="pt-3 gap-2 flex-col sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="font-black uppercase text-[10px] h-11 rounded-xl w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSiguiente}
            disabled={saving || !nombreLibro.trim()}
            className="font-black uppercase text-xs h-11 px-6 rounded-xl gap-2 bg-black hover:bg-black/90 text-white shadow-xl w-full sm:flex-1"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4 text-emerald-400" />}
            Siguiente (Iniciar Captura)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ===================== Modal de Cámara en Vivo (Ultra Rápida) ===================== */
function CameraScannerModal({
  open,
  onClose,
  targetFolio,
  onTargetFolioChange,
  numeros,
  folios,
  onSaveBlob,
  onFallbackNative,
}: {
  open: boolean;
  onClose: () => void;
  targetFolio: number;
  onTargetFolioChange: (n: number) => void;
  numeros: number[];
  folios: Record<number, Folio>;
  onSaveBlob: (n: number, blob: Blob) => Promise<boolean>;
  onFallbackNative: (n: number) => void;
}) {
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [flash, setFlash] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startStream = useCallback(async () => {
    stopStream();
    setErrorMsg(null);
    setTorchOn(false);
    setHasTorch(false);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setErrorMsg('El navegador no tiene soporte directo para cámara en vivo. Use la cámara del sistema.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      const track = stream.getVideoTracks()[0];
      if (track) {
        const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
        setHasTorch(Boolean(caps?.torch));
      }
    } catch (err: any) {
      console.warn('Error accediendo a cámara:', err);
      setErrorMsg(
        err?.name === 'NotAllowedError'
          ? 'Permiso de cámara denegado en el navegador.'
          : 'No se pudo iniciar la cámara en vivo del dispositivo.'
      );
    }
  }, [facingMode, stopStream]);

  useEffect(() => {
    if (open) {
      startStream();
    } else {
      stopStream();
      setLastSaved(null);
    }
    return () => {
      stopStream();
    };
  }, [open, startStream, stopStream]);

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: next }],
      });
      setTorchOn(next);
    } catch (e) {
      console.warn('Error alternando linterna:', e);
    }
  };

  const toggleFacingMode = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleCapture = async () => {
    if (!videoRef.current || isCapturing) return;
    setIsCapturing(true);
    setFlash(true);
    setTimeout(() => setFlash(false), 150);

    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(40);
      }
    } catch {}

    try {
      const blob = await captureVideoToBlob(videoRef.current);
      const current = targetFolio;
      await onSaveBlob(current, blob);
      setLastSaved(current);
      setTimeout(() => setLastSaved(null), 2000);

      if (autoAdvance) {
        const next = numeros.find(x => x > current && !folios[x]);
        if (next) {
          onTargetFolioChange(next);
        }
      }
    } catch (err: any) {
      console.error('Error al capturar folio:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  if (!open) return null;

  const yaEscaneado = !!folios[targetFolio];
  const idx = numeros.indexOf(targetFolio);
  const prevFolio = idx > 0 ? numeros[idx - 1] : null;
  const nextFolio = idx < numeros.length - 1 ? numeros[idx + 1] : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 text-white flex flex-col justify-between select-none animate-in fade-in duration-200">
      {/* BARRA SUPERIOR */}
      <div className="p-4 sm:p-5 flex items-center justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent z-30">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-white hover:bg-white/20 font-black uppercase text-xs h-9 px-3 gap-1 rounded-xl"
        >
          <X className="h-4 w-4" /> Cerrar
        </Button>

        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 bg-emerald-600/80 backdrop-blur-md px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
            Cámara en Vivo
          </div>
          <h2 className="text-base sm:text-lg font-black uppercase tracking-tight mt-0.5">
            Folio {targetFolio} <span className="text-xs text-white/60 font-medium">de {numeros[numeros.length - 1]}</span>
          </h2>
          {yaEscaneado && (
            <p className="text-[10px] font-bold text-amber-300 uppercase">
              ⚠️ Ya tiene foto (se reemplazará)
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {hasTorch && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTorch}
              className={cn("h-9 w-9 rounded-xl text-white", torchOn ? "bg-amber-500 hover:bg-amber-600 text-black" : "hover:bg-white/20")}
              title="Linterna"
            >
              {torchOn ? <Zap className="h-4 w-4" /> : <ZapOff className="h-4 w-4" />}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFacingMode}
            className="h-9 w-9 rounded-xl text-white hover:bg-white/20"
            title="Cambiar Cámara"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* VISOR CENTRAL DE LA CÁMARA */}
      <div className="relative flex-1 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
        {errorMsg ? (
          <div className="bg-zinc-900 border border-zinc-700 text-white rounded-3xl p-6 max-w-sm text-center space-y-4 shadow-2xl">
            <AlertCircle className="h-10 w-10 text-amber-400 mx-auto" />
            <p className="text-sm font-bold">{errorMsg}</p>
            <p className="text-xs text-zinc-400">
              Puede continuar utilizando la cámara del sistema o cargando fotos desde sus archivos.
            </p>
            <Button
              onClick={() => { onClose(); onFallbackNative(targetFolio); }}
              className="w-full bg-emerald-600 hover:bg-emerald-500 font-black uppercase text-xs rounded-xl h-11 gap-2"
            >
              <Camera className="h-4 w-4" /> Abrir Cámara del Sistema
            </Button>
          </div>
        ) : (
          <div className="relative w-full max-w-md aspect-[3/4] max-h-[68vh] rounded-3xl overflow-hidden border-2 border-white/20 bg-zinc-950 shadow-2xl flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Flash al disparar */}
            {flash && (
              <div className="absolute inset-0 bg-white z-20 pointer-events-none transition-opacity duration-150" />
            )}

            {/* Guías de encuadre para la hoja del libro */}
            <div className="absolute inset-5 pointer-events-none border-2 border-dashed border-white/30 rounded-2xl flex flex-col justify-between p-3">
              <div className="flex justify-between items-start">
                <div className="w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl shadow-sm" />
                <div className="w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl shadow-sm" />
              </div>
              <div className="text-center">
                <span className="bg-black/70 backdrop-blur-md text-[10px] font-black uppercase px-3 py-1 rounded-full text-emerald-300 tracking-wider shadow">
                  Alinee la página del folio aquí
                </span>
              </div>
              <div className="flex justify-between items-end">
                <div className="w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl shadow-sm" />
                <div className="w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl shadow-sm" />
              </div>
            </div>

            {/* Aviso flotante de guardado */}
            {lastSaved !== null && (
              <div className="absolute top-4 bg-emerald-500 text-white font-black uppercase text-xs px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-2 z-30 animate-bounce">
                <Check className="h-4 w-4" /> ¡Folio {lastSaved} Guardado!
              </div>
            )}
          </div>
        )}
      </div>

      {/* BARRA INFERIOR DE CONTROLES */}
      <div className="p-4 sm:p-6 bg-gradient-to-t from-black/90 via-black/70 to-transparent space-y-3 z-30">
        <div className="flex items-center justify-center gap-6">
          <Button
            variant="ghost"
            size="sm"
            disabled={!prevFolio || isCapturing}
            onClick={() => prevFolio && onTargetFolioChange(prevFolio)}
            className="text-white hover:bg-white/20 font-black uppercase text-xs rounded-xl h-10 px-3 gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> Folio {prevFolio || '—'}
          </Button>

          {/* BOTÓN DISPARADOR PRINCIPAL */}
          <button
            type="button"
            disabled={isCapturing || !!errorMsg}
            onClick={handleCapture}
            className={cn(
              "relative h-20 w-20 rounded-full border-4 border-white flex items-center justify-center transition-all shadow-2xl active:scale-90",
              isCapturing ? "opacity-50 cursor-not-allowed bg-zinc-700" : "bg-emerald-500 hover:bg-emerald-400 cursor-pointer hover:scale-105"
            )}
          >
            <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center">
              {isCapturing ? (
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              ) : (
                <Camera className="h-8 w-8 text-white drop-shadow" />
              )}
            </div>
          </button>

          <Button
            variant="ghost"
            size="sm"
            disabled={!nextFolio || isCapturing}
            onClick={() => nextFolio && onTargetFolioChange(nextFolio)}
            className="text-white hover:bg-white/20 font-black uppercase text-xs rounded-xl h-10 px-3 gap-1"
          >
            Folio {nextFolio || '—'} <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* AJUSTES Y ALTERNATIVA NATIVA */}
        <div className="flex flex-wrap items-center justify-between gap-2 max-w-md mx-auto pt-1">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase text-white/90">
            <Checkbox
              checked={autoAdvance}
              onCheckedChange={v => setAutoAdvance(!!v)}
              className="border-white data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
            />
            <span>Avance continuo (Siguiente folio)</span>
          </label>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => { onClose(); onFallbackNative(targetFolio); }}
            className="text-white/70 hover:text-white hover:bg-white/10 font-bold uppercase text-[10px] h-8 px-2"
          >
            <Upload className="h-3.5 w-3.5 mr-1" /> Usar cámara nativa / archivo
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ===================== Escáner de folios ===================== */
function LibroScanner({
  libro,
  autoStartCamera = false,
  onBack,
  onLibroChange,
  onDownload,
}: {
  libro: LibroEscaneo;
  autoStartCamera?: boolean;
  onBack: () => void;
  onLibroChange: (l: LibroEscaneo) => void;
  onDownload?: (format: 'pdf' | 'zip') => void;
}) {
  const { user } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [folios, setFolios] = useState<Record<number, Folio>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const [filter, setFilter] = useState<'todos' | 'pendientes' | 'escaneados'>('todos');
  const [liveCameraOpen, setLiveCameraOpen] = useState(false);
  const [liveCameraFolio, setLiveCameraFolio] = useState<number>(libro.folio_desde || 1);

  const cameraRef = useRef<HTMLInputElement>(null);
  const bulkRef = useRef<HTMLInputElement>(null);
  const targetFolio = useRef<number>(1);

  const role = user?.profile?.role;
  const isAdmin = role === 'admin' || role === 'superadmin' || user?.email === 'edubtz11@gmail.com';
  const desde = libro.folio_desde || 1;
  const numeros = useMemo(() => Array.from({ length: libro.total_folios || TOTAL_FOLIOS }, (_, i) => desde + i), [libro, desde]);
  const escaneados = Object.keys(folios).length;
  const pct = Math.round((escaneados / numeros.length) * 100);
  const siguientePendiente = numeros.find(n => !folios[n]);

  useEffect(() => {
    if (!firestore) return;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(firestore, 'libros-escaneo', libro.id, 'folios'));
        const map: Record<number, Folio> = {};
        snap.docs.forEach(d => { const f = { id: d.id, ...d.data() } as Folio; map[f.folio] = f; });
        setFolios(map);
      } catch {
        toast({ variant: 'destructive', title: 'Error al cargar folios' });
      } finally {
        setLoading(false);
      }
    })();
  }, [firestore, libro.id, toast]);

  const openLiveCamera = (n: number) => {
    setLiveCameraFolio(n);
    setLiveCameraOpen(true);
  };

  const openNativeCamera = (n: number) => {
    targetFolio.current = n;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('escaneo_target_folio', String(n));
    }
    cameraRef.current?.click();
  };

  // Si se viene desde el botón "Siguiente" de Agregar Libro, abrir directamente la cámara en vivo
  useEffect(() => {
    if (autoStartCamera) {
      const timer = setTimeout(() => {
        openLiveCamera(libro.folio_desde || 1);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [autoStartCamera, libro.folio_desde]);

  const syncCount = useCallback(async (count: number) => {
    if (!firestore) return;
    await updateDoc(doc(firestore, 'libros-escaneo', libro.id), { folios_escaneados: count });
    onLibroChange({ ...libro, folios_escaneados: count });
  }, [firestore, libro, onLibroChange]);

  const saveFolio = async (n: number, fileOrBlob: File | Blob): Promise<boolean> => {
    if (!firestore || !user) return false;
    setUploading(n);
    try {
      // 1. Optimizar resolución del folio preservando legibilidad de manuscritos
      const blob = await compressPageToBlob(fileOrBlob);

      // 2. Subir directamente a Cloudflare R2 mediante nuestra API
      const formData = new FormData();
      formData.append('file', blob, `folio_${String(n).padStart(4, '0')}.jpg`);
      formData.append('libroId', libro.id);
      formData.append('folio', String(n));

      const res = await fetch('/api/r2/upload', {
        method: 'POST',
        body: formData,
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Error subiendo imagen a Cloudflare R2');
      }

      const publicUrl = resData.url;

      // 3. Guardar metadatos y URL pública en Firestore
      const data = {
        folio: n,
        foto: publicUrl,
        usuario_id: user.uid,
        username: user.profile?.username || user.email || '',
        fecha: new Date().toISOString(),
      };
      const isNew = !folios[n];
      await setDoc(doc(firestore, 'libros-escaneo', libro.id, 'folios', String(n).padStart(4, '0')), data);
      setFolios(prev => ({ ...prev, [n]: { id: String(n), ...data } }));
      if (isNew) {
        await syncCount(Object.keys(folios).length + 1);
      }
      return isNew;
    } finally {
      setUploading(null);
    }
  };

  const handleCamera = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const n = targetFolio.current;
    try {
      await saveFolio(n, file);
      toast({ title: `✅ Folio ${n} guardado con éxito` });
    } catch (err: any) {
      console.error(err);
      toast({ variant: 'destructive', title: `Error al guardar folio ${n}`, description: err?.message });
    }
  };

  const handleBulk = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    e.target.value = '';
    if (files.length === 0) return;
    const pendientes = numeros.filter(n => !folios[n]);
    const lote = files.slice(0, pendientes.length);
    if (files.length > pendientes.length) {
      toast({ title: 'Aviso', description: `Solo hay ${pendientes.length} folios pendientes; se cargarán las primeras ${lote.length} fotos.` });
    }
    setBulkProgress({ done: 0, total: lote.length });
    let count = escaneados;
    for (let i = 0; i < lote.length; i++) {
      try {
        if (await saveFolio(pendientes[i], lote[i])) count++;
      } catch (err: any) {
        toast({ variant: 'destructive', title: `Error en folio ${pendientes[i]}`, description: err?.message });
      }
      setBulkProgress({ done: i + 1, total: lote.length });
    }
    await syncCount(count);
    setBulkProgress(null);
    toast({ title: `✅ ${lote.length} folios subidos a R2` });
  };

  const handleDeleteFolio = async (n: number) => {
    if (!firestore || !folios[n]) return;
    try {
      await deleteDoc(doc(firestore, 'libros-escaneo', libro.id, 'folios', String(n).padStart(4, '0')));
      // Eliminar también de Cloudflare R2
      fetch('/api/r2/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libroId: libro.id, folio: n }),
      }).catch(err => console.warn('Aviso al eliminar de R2:', err));

      setFolios(prev => { const c = { ...prev }; delete c[n]; return c; });
      await syncCount(Math.max(0, escaneados - 1));
      setViewer(null);
      toast({ title: `Folio ${n} eliminado` });
    } catch {
      toast({ variant: 'destructive', title: 'Error al eliminar' });
    }
  };

  const visibles = numeros.filter(n =>
    filter === 'todos' ? true : filter === 'pendientes' ? !folios[n] : !!folios[n]
  );

  return (
    <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full space-y-6">
      {/* Modal de Cámara en Vivo */}
      <CameraScannerModal
        open={liveCameraOpen}
        onClose={() => setLiveCameraOpen(false)}
        targetFolio={liveCameraFolio}
        onTargetFolioChange={setLiveCameraFolio}
        numeros={numeros}
        folios={folios}
        onSaveBlob={async (n, blob) => {
          const isNew = await saveFolio(n, blob);
          toast({ title: `✅ Folio ${n} guardado` });
          return isNew;
        }}
        onFallbackNative={(n) => openNativeCamera(n)}
      />

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCamera} />
      <input ref={bulkRef} type="file" accept="image/*" multiple className="hidden" onChange={handleBulk} />

      <Button variant="ghost" onClick={onBack} className="font-black uppercase text-[10px] gap-2 -ml-2">
        <ArrowLeft className="h-4 w-4" /> Volver a libros
      </Button>

      {/* BANNER PRINCIPAL DE CAPTURA ACTIVA CON CÁMARA */}
      {siguientePendiente ? (
        <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 text-white rounded-3xl p-5 md:p-6 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-emerald-500/30">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
              <Camera className="h-7 w-7 text-white animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">
                Captura Directa con Cámara
              </p>
              <h3 className="text-lg md:text-xl font-black uppercase tracking-tight">
                Folio Pendiente: N° {siguientePendiente} de {numeros.length}
              </h3>
              <p className="text-xs text-emerald-100 font-medium">
                Presione el botón para abrir la cámara en vivo y escanear de forma rápida y continua.
              </p>
            </div>
          </div>
          <Button
            onClick={() => siguientePendiente && openLiveCamera(siguientePendiente)}
            className="bg-white text-emerald-950 hover:bg-emerald-50 font-black uppercase text-xs h-12 px-7 rounded-2xl shadow-xl gap-2 shrink-0 w-full sm:w-auto"
          >
            <Camera className="h-5 w-5 text-emerald-600 animate-pulse" /> Abrir Cámara en Vivo (Folio {siguientePendiente})
          </Button>
        </div>
      ) : (
        <div className="bg-green-600 text-white rounded-2xl p-4 text-center font-black uppercase text-sm shadow-lg">
          ✅ ¡Libro Completado! Los {numeros.length} folios han sido fotografiados exitosamente.
        </div>
      )}

      {/* ===== ENCABEZADO: DETALLE DEL LIBRO ===== */}
      <Card className="shadow-2xl border-t-8 border-t-primary rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="bg-primary/5 border-b p-6 md:p-8">
          <CardTitle className="text-center space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Dirección General del Registro del Estado Civil</p>
            <p className="text-2xl font-black uppercase text-primary">
              {libro.nombre_libro || `Libro de ${libro.tipo_libro}`}
            </p>
            <p className="text-[11px] font-bold uppercase text-muted-foreground">Relevamiento fotográfico de folios de defunciones</p>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 md:p-8 space-y-6">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <DetailItem label="Registro Civil" value={`N° ${libro.registro_civil_numero} — ${libro.registro_civil_nombre}`} />
            <DetailItem label="Departamento" value={libro.departamento} />
            <DetailItem label="Distrito" value={libro.distrito} />
            <DetailItem label="Año" value={libro.anio} />
            <DetailItem label="Tomo" value={libro.tomo} />
            <DetailItem label="N° de Libro" value={libro.numero_libro} />
            <DetailItem label="Folios" value={`${desde} al ${desde + numeros.length - 1}`} />
            <DetailItem label="Apertura / Cierre" value={`${libro.fecha_apertura || '—'} / ${libro.fecha_cierre || '—'}`} />
          </div>
          {libro.observaciones && <DetailItem label="Observaciones" value={libro.observaciones} />}
          <div>
            <div className="flex justify-between text-[11px] font-black uppercase mb-1.5">
              <span>Progreso: {escaneados} / {numeros.length} folios</span><span>{pct}%</span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div className={cn('h-full transition-all duration-500', pct === 100 ? 'bg-green-600' : 'bg-primary')} style={{ width: `${pct}%` }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== ACCIONES ===== */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => siguientePendiente && openLiveCamera(siguientePendiente)}
            disabled={!siguientePendiente || uploading !== null || !!bulkProgress}
            className="font-black uppercase text-[10px] gap-2 h-11 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
          >
            <Camera className="h-4 w-4" /> {siguientePendiente ? `Fotografiar folio ${siguientePendiente} (En Vivo)` : 'Libro completo'}
          </Button>

          <Button
            variant="outline"
            onClick={() => siguientePendiente && openNativeCamera(siguientePendiente)}
            disabled={!siguientePendiente || uploading !== null || !!bulkProgress}
            className="font-black uppercase text-[10px] gap-2 h-11"
          >
            <ImageIcon className="h-4 w-4 text-muted-foreground" /> Cámara del sistema / Galería
          </Button>

          <Button
            variant="outline"
            onClick={() => bulkRef.current?.click()}
            disabled={!siguientePendiente || !!bulkProgress}
            className="font-black uppercase text-[10px] gap-2 h-11"
          >
            <Upload className="h-4 w-4" /> Cargar varias fotos
          </Button>

          {/* BOTÓN DESCARGAR LIBRO EN SCANNER */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                disabled={escaneados === 0}
                className="font-black uppercase text-[10px] gap-2 h-11 rounded-xl shadow-sm hover:bg-black hover:text-white transition-all"
              >
                <Download className="h-4 w-4 text-primary" /> Descargar Libro
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60 rounded-2xl p-2 shadow-2xl">
              <DropdownMenuItem
                onClick={() => onDownload?.('pdf')}
                className="font-black uppercase text-xs p-2.5 rounded-xl cursor-pointer gap-2.5 flex items-center"
              >
                <FileText className="h-4 w-4 text-rose-500" />
                <div>
                  <p className="leading-tight">Descargar en PDF</p>
                  <p className="text-[9px] text-muted-foreground font-normal">Documento oficial de alta resolución ({escaneados} folios)</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDownload?.('zip')}
                className="font-black uppercase text-xs p-2.5 rounded-xl cursor-pointer gap-2.5 flex items-center"
              >
                <Archive className="h-4 w-4 text-amber-500" />
                <div>
                  <p className="leading-tight">Descargar en Fotos (ZIP)</p>
                  <p className="text-[9px] text-muted-foreground font-normal">Todas las {escaneados} fotos JPG en un archivo ZIP</p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex gap-1">
          {(['todos', 'pendientes', 'escaneados'] as const).map(f => (
            <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)} className="font-black uppercase text-[9px]">{f}</Button>
          ))}
        </div>
      </div>

      {bulkProgress && (
        <div className="rounded-xl border bg-white p-4 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-xs font-black uppercase">Cargando {bulkProgress.done} / {bulkProgress.total}...</span>
        </div>
      )}

      {/* ===== GRILLA DE FOLIOS ===== */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
          {visibles.map(n => {
            const f = folios[n];
            return (
              <button key={n} type="button"
                onClick={() => (f ? setViewer(n) : openLiveCamera(n))}
                className={cn(
                  'relative aspect-[3/4] rounded-lg border-2 overflow-hidden flex flex-col items-center justify-center transition-all hover:scale-105 hover:shadow-lg',
                  f ? 'border-green-600' : 'border-dashed border-muted-foreground/30 bg-white hover:border-primary'
                )}>
                {f ? (
                  <img src={f.foto} alt={`Folio ${n}`} className="absolute inset-0 w-full h-full object-cover" />
                ) : uploading === n ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <Camera className="h-5 w-5 text-muted-foreground/50" />
                )}
                <span className={cn(
                  'absolute bottom-0 inset-x-0 text-[10px] font-black py-0.5 text-center',
                  f ? 'bg-green-600 text-white' : 'bg-muted/60'
                )}>{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ===== VISOR ===== */}
      <Dialog open={viewer !== null} onOpenChange={o => !o && setViewer(null)}>
        <DialogContent className="max-w-3xl rounded-2xl">
          {viewer !== null && folios[viewer] && (
            <>
              <DialogHeader>
                <DialogTitle className="font-black uppercase flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Folio {viewer}</DialogTitle>
                <DialogDescription>
                  Capturado por {folios[viewer].username} — {new Date(folios[viewer].fecha).toLocaleString('es-PY')}
                </DialogDescription>
              </DialogHeader>
              <div className="relative bg-black rounded-xl overflow-hidden">
                <img src={folios[viewer].foto} alt={`Folio ${viewer}`} className="w-full max-h-[65vh] object-contain" />
                <button type="button" onClick={() => { const p = numeros.slice().reverse().find(x => x < viewer && folios[x]); if (p) setViewer(p); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-2"><ChevronLeft className="h-5 w-5" /></button>
                <button type="button" onClick={() => { const nx = numeros.find(x => x > viewer && folios[x]); if (nx) setViewer(nx); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-2"><ChevronRight className="h-5 w-5" /></button>
              </div>
              <DialogFooter className="gap-2">
                {isAdmin && (
                  <Button variant="destructive" onClick={() => handleDeleteFolio(viewer)} className="font-black uppercase text-[10px] gap-2">
                    <Trash2 className="h-4 w-4" /> Eliminar
                  </Button>
                )}
                <Button variant="outline" onClick={() => { const n = viewer; setViewer(null); openLiveCamera(n); }} className="font-black uppercase text-[10px] gap-2">
                  <Camera className="h-4 w-4" /> Volver a fotografiar en vivo
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

/* ===================== Panel de asignaciones (admin) ===================== */
function AsignacionesPanel({ registros }: { registros: RegistroCivil[] }) {
  const { user } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserLite[]>([]);
  const [asignaciones, setAsignaciones] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('TODOS');
  const [distFilter, setDistFilter] = useState('TODOS');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'SIN_ASIGNAR' | 'PARCIAL' | 'COMPLETO'>('TODOS');
  const [editing, setEditing] = useState<UserLite | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [modalDept, setModalDept] = useState('');
  const [showOtherDistricts, setShowOtherDistricts] = useState(false);

  // Departamentos únicos a partir de los usuarios y del catálogo de oficinas
  const allDepartments = useMemo(() => {
    const s = new Set<string>();
    users.forEach(u => { if (u.departamento) s.add(u.departamento.toUpperCase()); });
    registros.forEach(r => { if (r.departamento) s.add(r.departamento.toUpperCase()); });
    return Array.from(s).sort();
  }, [users, registros]);

  // Distritos filtrados según el departamento seleccionado
  const availableDistricts = useMemo(() => {
    const s = new Set<string>();
    const filterD = deptFilter !== 'TODOS' ? deptFilter : null;
    users.forEach(u => {
      if (!filterD || (u.departamento && u.departamento.toUpperCase() === filterD)) {
        if (u.distrito) s.add(u.distrito.toUpperCase());
      }
    });
    registros.forEach(r => {
      if (!filterD || (r.departamento && r.departamento.toUpperCase() === filterD)) {
        if (r.distrito) s.add(r.distrito.toUpperCase());
      }
    });
    return Array.from(s).sort();
  }, [users, registros, deptFilter]);

  const loadData = useCallback(async () => {
    if (!firestore) return;
    setLoading(true);
    try {
      const [uSnap, aSnap] = await Promise.all([
        getDocs(collection(firestore, 'users')),
        getDocs(collection(firestore, 'asignaciones-registro-civil')),
      ]);
      setUsers(
        uSnap.docs
          .map(d => ({ id: d.id, ...(d.data() as any) }))
          .sort((a, b) => (a.username || a.email || '').localeCompare(b.username || b.email || ''))
      );
      const map: Record<string, string[]> = {};
      aSnap.docs.forEach(d => {
        const data = d.data() as Asignacion;
        map[d.id] = data.registros || [];
      });
      setAsignaciones(map);
    } catch {
      toast({ variant: 'destructive', title: 'Error al cargar usuarios' });
    } finally {
      setLoading(false);
    }
  }, [firestore, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const regName = (id: string) => {
    const r = registros.find(x => x.id === id);
    return r ? `N° ${r.numero} — ${r.nombre} (${r.distrito})` : 'Registro no encontrado';
  };

  const regObj = (id: string) => registros.find(x => x.id === id);

  const openEditor = (u: UserLite) => {
    const current = asignaciones[u.id] || u.oficinas_registro_civil || [];
    setEditing(u);
    setSel(current);
    setShowOtherDistricts(false);
    const userDept = (u.departamento || '').toUpperCase();
    const firstRegDept = current[0] ? registros.find(r => r.id === current[0])?.departamento : null;
    setModalDept(firstRegDept || userDept || (allDepartments[0] || ''));
  };

  const toggle = (id: string) => {
    setSel(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= MAX_REGISTROS_POR_USUARIO) {
        toast({
          variant: 'destructive',
          title: 'Límite alcanzado',
          description: `El usuario de este distrito solo puede tener asignado un máximo de ${MAX_REGISTROS_POR_USUARIO} oficinas del Registro Civil.`,
        });
        return prev;
      }
      return [...prev, id];
    });
  };

  const save = async () => {
    if (!firestore || !editing || !user) return;
    setSaving(true);
    try {
      const finalRegs = sel.slice(0, MAX_REGISTROS_POR_USUARIO);
      await setDoc(doc(firestore, 'asignaciones-registro-civil', editing.id), {
        usuario_id: editing.id,
        username: editing.username || editing.email,
        departamento: editing.departamento || '',
        distrito: editing.distrito || '',
        registros: finalRegs,
        actualizado_por: user.uid,
        fecha_actualizacion: new Date().toISOString(),
      });

      // Sincronizar en el documento del usuario para acceso inmediato
      try {
        await updateDoc(doc(firestore, 'users', editing.id), {
          oficinas_registro_civil: finalRegs,
        });
      } catch (e) {
        console.warn('No se pudo actualizar el campo en users', e);
      }

      setAsignaciones(prev => ({ ...prev, [editing.id]: finalRegs }));
      recordAuditLog(firestore, {
        usuario_id: user.uid,
        usuario_nombre: user.profile?.username || user.email || 'Usuario',
        usuario_rol: user.profile?.role || 'admin',
        accion: 'EDITAR',
        modulo: 'escaneo-libro',
        documento_id: editing.id,
        detalles: `Asignación de oficinas del Registro Civil a ${editing.username || editing.email} (Distrito: ${editing.distrito || 'N/A'}): ${finalRegs.map(regName).join(', ') || 'Ninguna'}`,
      });
      toast({
        title: '✅ Asignación guardada con éxito',
        description: `Se han asignado ${finalRegs.length} de ${MAX_REGISTROS_POR_USUARIO} oficinas a ${editing.username || editing.email}.`,
      });
      setEditing(null);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error al guardar la asignación' });
    } finally {
      setSaving(false);
    }
  };

  // Filtrado de usuarios
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch =
        `${u.username || ''} ${u.email || ''} ${u.distrito || ''} ${u.departamento || ''}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchesDept =
        deptFilter === 'TODOS' ||
        (u.departamento && u.departamento.toUpperCase() === deptFilter.toUpperCase());
      const matchesDist =
        distFilter === 'TODOS' ||
        (u.distrito && u.distrito.toUpperCase() === distFilter.toUpperCase());

      const count = (asignaciones[u.id] || []).length;
      let matchesStatus = true;
      if (statusFilter === 'SIN_ASIGNAR') matchesStatus = count === 0;
      else if (statusFilter === 'PARCIAL') matchesStatus = count === 1;
      else if (statusFilter === 'COMPLETO') matchesStatus = count >= 2;

      return matchesSearch && matchesDept && matchesDist && matchesStatus;
    });
  }, [users, search, deptFilter, distFilter, statusFilter, asignaciones]);

  // Estadísticas rápidas
  const stats = useMemo(() => {
    let sin = 0;
    let uno = 0;
    let dos = 0;
    users.forEach(u => {
      const n = (asignaciones[u.id] || []).length;
      if (n === 0) sin++;
      else if (n === 1) uno++;
      else dos++;
    });
    return { total: users.length, sin, uno, dos };
  }, [users, asignaciones]);

  // Oficinas del distrito del usuario que se está editando
  const editingUserDistrictOffices = useMemo(() => {
    if (!editing) return [];
    const distNorm = (editing.distrito || '').trim().toUpperCase();
    const deptNorm = (editing.departamento || '').trim().toUpperCase();
    return registros.filter(r => {
      const rDist = (r.distrito || '').trim().toUpperCase();
      const rDept = (r.departamento || '').trim().toUpperCase();
      if (distNorm) {
        return geoMatches(rDist, distNorm) && (!deptNorm || geoMatches(rDept, deptNorm));
      }
      return deptNorm ? geoMatches(rDept, deptNorm) : true;
    });
  }, [editing, registros]);

  // Oficinas secundarias para explorar otros distritos
  const modalOtherOffices = useMemo(() => {
    if (!modalDept) return [];
    return registros.filter(
      r => geoMatches(r.departamento, modalDept)
    );
  }, [registros, modalDept]);

  const modalOtherOfficesByDistrict = useMemo(() => {
    const g: Record<string, RegistroCivil[]> = {};
    modalOtherOffices.forEach(r => {
      const k = r.distrito || 'SIN DISTRITO';
      (g[k] = g[k] || []).push(r);
    });
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]));
  }, [modalOtherOffices]);

  return (
    <div className="space-y-6">
      {/* Resumen de Asignaciones */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-none shadow-sm bg-white p-4">
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Usuarios</p>
          <p className="text-2xl font-black uppercase mt-1 text-primary">{stats.total}</p>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm bg-white p-4 border-l-4 border-l-green-600">
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Con 2 Oficinas (Completo)</p>
          <p className="text-2xl font-black uppercase mt-1 text-green-600">{stats.dos}</p>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm bg-white p-4 border-l-4 border-l-amber-500">
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Con 1 Oficina (Parcial)</p>
          <p className="text-2xl font-black uppercase mt-1 text-amber-600">{stats.uno}</p>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm bg-white p-4 border-l-4 border-l-destructive">
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Sin Oficinas (0/2)</p>
          <p className="text-2xl font-black uppercase mt-1 text-destructive">{stats.sin}</p>
        </Card>
      </div>

      <Card className="rounded-[1.5rem] shadow-lg border-none bg-white overflow-hidden">
        <CardHeader className="bg-muted/10 p-6 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="font-black uppercase text-lg flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" /> Asignación de Usuarios de Distritos a Oficinas del Registro Civil
              </CardTitle>
              <CardDescription className="text-xs font-medium">
                Cada funcionario distrital puede ser asignado a 1 o hasta {MAX_REGISTROS_POR_USUARIO} oficinas del Registro Civil para el relevamiento de libros.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadData} className="font-black uppercase text-[10px] gap-2 h-9">
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Recargar
            </Button>
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-dashed">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por funcionario o correo..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-10 border-2 font-bold text-xs rounded-xl"
              />
            </div>
            <div>
              <Select value={deptFilter} onValueChange={v => { setDeptFilter(v); setDistFilter('TODOS'); }}>
                <SelectTrigger className="h-10 border-2 font-bold text-xs uppercase rounded-xl">
                  <SelectValue placeholder="Departamento..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos los Departamentos</SelectItem>
                  {allDepartments.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={distFilter} onValueChange={setDistFilter}>
                <SelectTrigger className="h-10 border-2 font-bold text-xs uppercase rounded-xl">
                  <SelectValue placeholder="Distrito..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos los Distritos</SelectItem>
                  {availableDistricts.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
                <SelectTrigger className="h-10 border-2 font-bold text-xs uppercase rounded-xl">
                  <SelectValue placeholder="Estado de Asignación..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos los Estados</SelectItem>
                  <SelectItem value="SIN_ASIGNAR">Sin Asignación (0/2)</SelectItem>
                  <SelectItem value="PARCIAL">Con 1 Oficina (1/2)</SelectItem>
                  <SelectItem value="COMPLETO">Con 2 Oficinas (2/2)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-3">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin h-8 w-8 text-primary" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground font-bold uppercase text-xs">
              No se encontraron usuarios con los filtros seleccionados.
            </div>
          ) : (
            filteredUsers.map(u => {
              const a = asignaciones[u.id] || u.oficinas_registro_civil || [];
              const isFull = a.length >= MAX_REGISTROS_POR_USUARIO;
              const isPartial = a.length === 1;

              return (
                <div
                  key={u.id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-4 border rounded-2xl p-4 bg-white hover:bg-muted/10 transition-all shadow-sm"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black uppercase text-primary leading-tight">
                        {u.username || u.email}
                      </p>
                      <Badge variant="outline" className="text-[8px] font-black uppercase">
                        {u.role || 'USUARIO'}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="text-[8px] font-black uppercase bg-primary/10 text-primary border-primary/20 flex items-center gap-1"
                      >
                        <MapPin className="h-2.5 w-2.5" />
                        {u.departamento || 'SIN DEP.'} — {u.distrito || 'SIN DISTRITO'}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-medium lowercase">
                      {u.email}
                    </p>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {a.length === 0 ? (
                        <span className="text-[10px] text-destructive font-black uppercase flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Sin oficinas del Registro Civil asignadas (0/{MAX_REGISTROS_POR_USUARIO})
                        </span>
                      ) : (
                        a.map(id => {
                          const r = regObj(id);
                          return (
                            <Badge
                              key={id}
                              variant="secondary"
                              className="text-[9px] font-black uppercase py-0.5 px-2 bg-muted/60 flex items-center gap-1.5 border"
                            >
                              <Building2 className="h-3 w-3 text-primary" />
                              {r ? `N° ${r.numero} — ${r.nombre} (${r.distrito})` : 'Oficina no encontrada'}
                            </Badge>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <Badge
                      className={cn(
                        "text-[9px] font-black uppercase px-2.5 py-1",
                        isFull
                          ? "bg-green-600 text-white"
                          : isPartial
                          ? "bg-amber-500 text-white"
                          : "bg-destructive/10 text-destructive border-destructive/20"
                      )}
                    >
                      {a.length} / {MAX_REGISTROS_POR_USUARIO} ASIGNADAS
                    </Badge>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => openEditor(u)}
                      className="font-black uppercase text-[10px] gap-1.5 h-9 rounded-xl shadow-sm bg-black hover:bg-black/90 text-white"
                    >
                      <Building2 className="h-3.5 w-3.5" /> Asignar Oficinas
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>

        {/* Modal de Asignación por Distrito */}
        <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
          <DialogContent className="max-w-2xl rounded-2xl max-h-[92vh] flex flex-col p-6">
            <DialogHeader>
              <DialogTitle className="font-black uppercase flex items-center gap-2 text-xl">
                <Building2 className="h-5 w-5 text-primary" /> Asignar Oficinas del Registro Civil
              </DialogTitle>
              <DialogDescription className="text-xs">
                Asigne 1 o 2 oficinas a <span className="font-black uppercase text-foreground">{editing?.username || editing?.email}</span>.
              </DialogDescription>
            </DialogHeader>

            {/* Tarjeta de Jurisdicción del Usuario */}
            <div className="bg-primary/5 rounded-xl p-3 border border-primary/20 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Jurisdicción del Usuario</p>
                  <p className="text-xs font-black uppercase text-primary">
                    {editing?.departamento || 'Sin Departamento'} — {editing?.distrito || 'Sin Distrito'}
                  </p>
                </div>
              </div>
              <Badge className={cn("text-[9px] font-black uppercase", sel.length === 2 ? "bg-green-600" : "bg-black text-white")}>
                {sel.length} / {MAX_REGISTROS_POR_USUARIO} Seleccionadas
              </Badge>
            </div>

            {/* Oficinas ya seleccionadas */}
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-tight text-muted-foreground">
                Oficinas Seleccionadas ({sel.length}/{MAX_REGISTROS_POR_USUARIO})
              </Label>
              <div className="flex flex-wrap gap-1.5 min-h-[34px] p-2 bg-muted/20 border rounded-xl">
                {sel.length === 0 && (
                  <span className="text-[10px] font-bold uppercase text-muted-foreground p-1">
                    Ninguna oficina seleccionada aún. Marque hasta 2 oficinas a continuación.
                  </span>
                )}
                {sel.map(id => (
                  <Badge key={id} className="text-[9px] font-black uppercase gap-1.5 py-1 px-2.5 bg-black text-white">
                    <Building2 className="h-3 w-3 text-amber-400" />
                    {regName(id)}
                    <button
                      type="button"
                      onClick={() => toggle(id)}
                      className="ml-1 rounded-full hover:bg-white/20 p-0.5 text-xs font-bold leading-none"
                    >
                      ✕
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Área scrolleable de selección */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Sección prioritaria: Oficinas del distrito del usuario */}
              {editing?.distrito && (
                <div className="border-2 border-primary/20 rounded-xl p-3.5 bg-white space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      Oficinas en su Distrito ({editing.distrito})
                    </p>
                    <Badge variant="outline" className="text-[8px] font-black uppercase">
                      {editingUserDistrictOffices.length} disponibles
                    </Badge>
                  </div>

                  {editingUserDistrictOffices.length === 0 ? (
                    <div className="p-4 bg-muted/20 rounded-lg text-center">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">
                        No hay oficinas del Registro Civil registradas aún para el distrito de {editing.distrito}.
                      </p>
                      <p className="text-[9px] text-muted-foreground mt-1">
                        Utilice la pestaña &quot;Registros Civiles&quot; para migrar o agregar las oficinas de este distrito.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {editingUserDistrictOffices.map(r => {
                        const checked = sel.includes(r.id);
                        const disabled = !checked && sel.length >= MAX_REGISTROS_POR_USUARIO;
                        return (
                          <label
                            key={r.id}
                            className={cn(
                              'flex items-center justify-between border-2 rounded-xl p-3 cursor-pointer transition-all',
                              checked ? 'border-primary bg-primary/5 shadow-sm' : 'hover:border-primary/30',
                              disabled && 'opacity-40 cursor-not-allowed'
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={checked}
                                disabled={disabled}
                                onCheckedChange={() => toggle(r.id)}
                                className="h-4 w-4"
                              />
                              <div>
                                <p className="text-xs font-black uppercase text-foreground">
                                  Oficina N° {r.numero} — {r.nombre}
                                </p>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase">
                                  {r.distrito}, {r.departamento}
                                </p>
                              </div>
                            </div>
                            {checked && (
                              <Badge className="bg-primary text-white text-[8px] font-black uppercase">
                                ASIGNADA
                              </Badge>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Botón / Acordeón para ver oficinas de otros distritos */}
              <div className="space-y-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOtherDistricts(!showOtherDistricts)}
                  className="w-full font-black uppercase text-[10px] justify-between h-9 border-dashed rounded-xl"
                >
                  <span className="flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5" />
                    {showOtherDistricts ? 'Ocultar otras oficinas' : 'Explorar oficinas de otros distritos o departamentos'}
                  </span>
                  <span>{showOtherDistricts ? '▲' : '▼'}</span>
                </Button>

                {showOtherDistricts && (
                  <div className="space-y-3 p-3 bg-muted/20 rounded-xl border border-dashed">
                    <Field label="Seleccionar Departamento">
                      <Select value={modalDept} onValueChange={setModalDept}>
                        <SelectTrigger className="h-10 border-2 font-bold text-xs uppercase bg-white rounded-xl">
                          <SelectValue placeholder="Seleccionar departamento..." />
                        </SelectTrigger>
                        <SelectContent>
                          {allDepartments.map(d => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    <div className="max-h-60 overflow-y-auto space-y-3 p-1">
                      {modalOtherOfficesByDistrict.map(([dist, ofis]) => (
                        <div key={dist} className="space-y-1">
                          <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground px-1 flex items-center gap-1">
                            <Building2 className="h-3 w-3" /> Distrito: {dist} ({ofis.length} oficinas)
                          </p>
                          <div className="space-y-1">
                            {ofis.map(r => {
                              const checked = sel.includes(r.id);
                              const disabled = !checked && sel.length >= MAX_REGISTROS_POR_USUARIO;
                              return (
                                <label
                                  key={r.id}
                                  className={cn(
                                    'flex items-center justify-between border rounded-lg p-2.5 cursor-pointer bg-white transition-colors',
                                    checked && 'border-primary bg-primary/5',
                                    disabled && 'opacity-40 cursor-not-allowed'
                                  )}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <Checkbox
                                      checked={checked}
                                      disabled={disabled}
                                      onCheckedChange={() => toggle(r.id)}
                                    />
                                    <span className="text-xs font-black uppercase">
                                      N° {r.numero} — {r.nombre}
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-muted-foreground uppercase font-bold">
                                    {r.distrito}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="pt-4 border-t gap-2">
              <Button
                variant="outline"
                onClick={() => setEditing(null)}
                className="font-black uppercase text-[10px] rounded-xl h-10 px-5"
              >
                Cancelar
              </Button>
              <Button
                onClick={save}
                disabled={saving}
                className="font-black uppercase text-[10px] gap-2 rounded-xl h-10 px-6 bg-black hover:bg-black/90 text-white"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Guardar Asignación ({sel.length}/{MAX_REGISTROS_POR_USUARIO})
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    </div>
  );
}

export default function EscaneoLibroPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>}>
      <EscaneoLibroContent />
    </Suspense>
  );
}
