"use client";

import { useState, useEffect, useMemo, Suspense } from 'react';
import Header from '@/components/header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  UserPlus, 
  Users, 
  Loader2, 
  Edit, 
  Trash2, 
  Search, 
  ShieldCheck, 
  Building2, 
  Settings, 
  X, 
  Landmark, 
  Zap, 
  Power, 
  PowerOff, 
  UserCircle,
  Mail,
  ShieldAlert,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  UserCheck,
  Shield
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useFirebase, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { collection, doc, setDoc, updateDoc, writeBatch, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { type Dato } from '@/lib/data';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useSearchParams } from 'next/navigation';
import { recordAuditLog } from '@/lib/audit';

type UserProfile = {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'director' | 'coordinador' | 'jefe' | 'funcionario' | 'viewer';
  modules: string[];
  permissions: string[];
  departamento?: string;
  distrito?: string;
  active?: boolean;
  registration_method?: string;
};

const ACTION_LABELS = [
  { id: 'view', label: 'VER' },
  { id: 'add', label: 'GUARDAR' },
  { id: 'edit', label: 'EDITAR' },
  { id: 'delete', label: 'BORRAR' },
  { id: 'pdf', label: 'PDF' },
];

const MODULE_STRUCTURE = [
  {
    category: "CIDEE - CAPACITACIONES",
    items: [
      { id: 'calendario-capacitaciones', label: 'CALENDARIO MENSUAL' },
      { id: 'anexo-i', label: 'ANEXO I - LUGARES FIJOS' },
      { id: 'lista-anexo-i', label: 'LISTADO DE ANEXO I' },
      { id: 'solicitud-capacitacion', label: 'ANEXO V - SOLICITUDES' },
      { id: 'agenda-anexo-i', label: 'AGENDA ANEXO I' },
      { id: 'agenda-anexo-v', label: 'AGENDA ANEXO V' },
      { id: 'maquinas', label: 'INVENTARIO DE MÁQUIS' },
      { id: 'control-movimiento-maquinas', label: 'MOVIMIENTO DE MÁQUINAS' },
      { id: 'denuncia-lacres', label: 'DENUNCIA DE LACRES' },
      { id: 'informe-movimientos-denuncias', label: 'TRAZABILIDAD LOGÍSTICA' },
      { id: 'informe-divulgador', label: 'ANEXO III - INFORME DEL DIVULGADOR' },
      { id: 'galeria-capacitaciones', label: 'GALERÍA DE EVIDENCIAS' },
      { id: 'informe-semanal-puntos-fijos', label: 'ANEXO IV - INFORME SEMANAL' },
      { id: 'lista-anexo-iv', label: 'LISTADO DE ANEXO IV' },
      { id: 'divulgadores', label: 'DIRECTORIO DIVULGADORES' },
      { id: 'estadisticas-capacitacion', label: 'ESTADÍSTICAS CIDEE' },
      { id: 'encuesta-satisfaccion', label: 'ANEXO II - ENCUESTA DE SATISFACCIÓN' },
      { id: 'archivo-capacitaciones', label: 'HISTORIAL / ARCHIVO' },
    ]
  },
  {
    category: "REGISTROS ELECTORALES",
    items: [
      { id: 'ficha', label: 'VISTA DE FICHA' },
      { id: 'fotos', label: 'GALERÍA FOTOGRÁFICA' },
      { id: 'cargar-ficha', label: 'CARGAR FICHA' },
      { id: 'configuracion-semanal', label: 'CONFIGURACIÓN FECHAS' },
      { id: 'informe-semanal-registro', label: 'INF. SEMANAL REGISTRO' },
      { id: 'reporte-semanal-registro', label: 'MONITOR DE INFORMES' },
      { id: 'archivo-semanal-registro', label: 'ARCHIVO DE INFORMES' },
    ]
  },
  {
    category: "ANÁLISIS Y REPORTES",
    items: [
      { id: 'resumen', label: 'RESUMEN UBICACIONES' },
      { id: 'informe-general', label: 'INFORME GENERAL PDF' },
      { id: 'conexiones', label: 'MONITOREO CONEXIONES' },
    ]
  },
  {
    category: "LOCALES DE VOTACIÓN",
    items: [
      { id: 'locales-votacion', label: 'BUSCADOR DE LOCALES' },
      { id: 'cargar-fotos-locales', label: 'CARGAR FOTOS LOTE' },
    ]
  },
  {
    category: "SISTEMA",
    items: [
      { id: 'users', label: 'GESTIÓN USUARIOS' },
      { id: 'settings', label: 'CONFIGURACIÓN' },
      { id: 'documentacion', label: 'DOCUMENTACIÓN' },
      { id: 'auditoria', label: 'AUDITORÍA DEL SISTEMA' },
    ]
  }
];

const GLOBAL_PERMS = [
  { id: 'admin_filter', label: 'FILTRO NACIONAL' },
  { id: 'department_filter', label: 'FILTRO DEPARTAMENTAL' },
  { id: 'district_filter', label: 'FILTRO DISTRITAL' },
  { id: 'assign_staff', label: 'ASIGNAR PERSONAL' },
];

const PermissionMatrix = ({ 
  userObj, 
  isEditing = false, 
  selectedPerms, 
  selectedModules,
  onTogglePerm, 
  onToggleModuleAction,
  onToggleColumn
}: { 
  userObj?: Partial<UserProfile>, 
  isEditing?: boolean,
  selectedPerms: Set<string>,
  selectedModules: Set<string>,
  onTogglePerm: (id: string, editing: boolean) => void,
  onToggleModuleAction: (modId: string, actId: string, editing: boolean) => void,
  onToggleColumn: (actionId: string, items: {id: string}[], editing: boolean) => void
}) => {
  const currentPerms = new Set(isEditing ? (userObj?.permissions || []) : Array.from(selectedPerms));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Asignación de Módulos y Acciones</h3>
        <div className="flex flex-wrap gap-4">
          {GLOBAL_PERMS.map(p => (
            <div key={p.id} className="flex items-center space-x-2">
              <Checkbox 
                id={`global-${p.id}-${isEditing ? 'edit' : 'new'}`}
                checked={currentPerms.has(p.id)}
                onCheckedChange={() => onTogglePerm(p.id, isEditing)}
              />
              <Label htmlFor={`global-${p.id}-${isEditing ? 'edit' : 'new'}`} className="text-[9px] font-black uppercase cursor-pointer">{p.label}</Label>
            </div>
          ))}
        </div>
      </div>

      <Accordion type="multiple" className="border rounded-lg overflow-hidden bg-white shadow-sm">
        {MODULE_STRUCTURE.map((cat) => (
          <AccordionItem key={cat.category} value={cat.category} className="border-b last:border-0">
            <AccordionTrigger className="px-6 py-3 hover:no-underline bg-muted/5">
              <span className="text-[10px] font-black uppercase tracking-wider">{cat.category}</span>
            </AccordionTrigger>
            <AccordionContent className="p-0">
              <Table>
                <TableHeader className="bg-white">
                  <TableRow className="border-b hover:bg-transparent">
                    <TableHead className="w-1/3"></TableHead>
                    {ACTION_LABELS.map(a => {
                      const allInColSelected = cat.items.every(item => currentPerms.has(`${item.id}:${a.id}`));
                      return (
                        <TableHead key={a.id} className="text-center py-4">
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="text-[9px] font-black uppercase">{a.label}</span>
                            <Checkbox 
                                checked={allInColSelected}
                                onCheckedChange={() => onToggleColumn(a.id, cat.items, isEditing)}
                                className="h-3.5 w-3.5 border-primary/30"
                            />
                          </div>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cat.items.map(module => (
                    <TableRow key={module.id} className="border-b last:border-0 hover:bg-muted/5 transition-colors">
                      <TableCell className="px-6 py-4">
                        <span className="text-[10px] font-bold uppercase">{module.label}</span>
                      </TableCell>
                      {ACTION_LABELS.map(action => {
                        const permKey = `${module.id}:${action.id}`;
                        return (
                          <TableCell key={action.id} className="text-center py-4">
                            <Checkbox 
                              checked={currentPerms.has(permKey)}
                              onCheckedChange={() => onToggleModuleAction(module.id, action.id, isEditing)}
                              className="mx-auto"
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};

function UsersContent() {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { user: currentUser, isUserLoading: isAuthLoading } = useUser();
  const searchParams = useSearchParams();

  const isMasterAdmin = useMemo(() => {
    return ['edubtz11@gmail.com', 'ing.eduardobenitez00@gmail.com', 'eduardobritz1@gmail.com'].includes(currentUser?.email?.toLowerCase() || '');
  }, [currentUser]);

  const isAdminView = useMemo(() => {
    return currentUser?.profile?.role === 'admin' || isMasterAdmin;
  }, [currentUser, isMasterAdmin]);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !isAdminView) return null;
    return collection(firestore, 'users');
  }, [firestore, isAdminView]);

  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);
  const datosQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'datos') : null), [firestore]);
  const { data: datosData } = useCollection<Dato>(datosQuery);

  const presenceQuery = useMemoFirebase(() => firestore ? collection(firestore, 'presencia') : null, [firestore]);
  const { data: presenceData } = useCollection<any>(presenceQuery);

  const [searchTerm, setSearchTerm] = useState('');
  const [regDepartamento, setRegDepartamento] = useState<string>('');
  const [regDistrito, setRegDistrito] = useState<string>('');
  const [regRole, setRegRole] = useState<UserProfile['role']>('funcionario');
  
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());

  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const searchVal = searchParams.get('search');
    if (searchVal) setSearchTerm(searchVal);
  }, [searchParams]);

  const departments = useMemo(() => {
    if (!datosData) return [];
    return [...new Set(datosData.map(d => d.departamento))].sort();
  }, [datosData]);

  const districts = useMemo(() => {
    if (!datosData || !regDepartamento) return [];
    return [...new Set(datosData.filter(d => d.departamento === regDepartamento).map(d => d.distrito))].sort();
  }, [datosData, regDepartamento]);

  const ghostUsers = useMemo(() => {
    if (!presenceData || !users) return [];
    const userEmails = new Set(users.map(u => u.email.toLowerCase()));
    return presenceData
        .filter(p => !userEmails.has(p.email?.toLowerCase()))
        .filter(p => p.email && p.email !== '')
        .map(p => ({
            id: p.usuario_id || p.id,
            email: p.email,
            username: p.username || 'USUARIO DESCONOCIDO',
            departamento: p.departamento,
            distrito: p.distrito
        }));
  }, [presenceData, users]);

  const hierarchy = useMemo(() => {
    if (!datosData) return [];
    
    const term = searchTerm.toLowerCase().trim();
    const activeUsers = users || [];

    const depts: Record<string, { name: string, districts: Record<string, { name: string, users: UserProfile[] }> }> = {};

    datosData.forEach(d => {
      if (!depts[d.departamento]) depts[d.departamento] = { name: d.departamento, districts: {} };
      if (!depts[d.departamento].districts[d.distrito]) {
        depts[d.departamento].districts[d.distrito] = { name: d.distrito, users: [] };
      }
    });

    activeUsers.forEach(u => {
      const dept = u.departamento || 'ALCANCE NACIONAL';
      const dist = u.distrito || 'TODOS LOS DISTRITOS';
      
      if (dept === 'ALCANCE NACIONAL') {
          if (!depts[dept]) depts[dept] = { name: dept, districts: {} };
          if (!depts[dept].districts[dist]) depts[dept].districts[dist] = { name: dist, users: [] };
          depts[dept].districts[dist].users.push(u);
      } else if (depts[dept]?.districts[dist]) {
          depts[dept].districts[dist].users.push(u);
      }
    });

    return Object.values(depts)
      .map(dept => ({
        ...dept,
        districts: Object.values(dept.districts)
          .filter(dist => {
            const matchesLocation = dist.name.toLowerCase().includes(term) || dept.name.toLowerCase().includes(term);
            const matchesUser = dist.users.some(u => 
                u.username.toLowerCase().includes(term) || 
                u.email.toLowerCase().includes(term)
            );
            return matchesLocation || matchesUser;
          })
          .sort((a, b) => a.name.localeCompare(b.name))
      }))
      .filter(dept => dept.districts.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [datosData, users, searchTerm]);

  const handleTogglePerm = (permId: string, isEditing = false) => {
    if (isEditing && editingUser) {
      const next = new Set(editingUser.permissions || []);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      setEditingUser({ ...editingUser, permissions: Array.from(next) });
    } else {
      setSelectedPerms(prev => {
        const next = new Set(prev);
        if (next.has(permId)) next.delete(permId);
        else next.add(permId);
        return next;
      });
    }
  };

  const handleToggleModuleAction = (moduleId: string, actionId: string, isEditing = false) => {
    const permKey = `${moduleId}:${actionId}`;
    if (isEditing && editingUser) {
      const nextPerms = new Set(editingUser.permissions || []);
      const nextModules = new Set(editingUser.modules || []);
      if (nextPerms.has(permKey)) nextPerms.delete(permKey);
      else { nextPerms.add(permKey); nextModules.add(moduleId); }
      setEditingUser({ ...editingUser, permissions: Array.from(nextPerms), modules: Array.from(nextModules) });
    } else {
      setSelectedPerms(prev => {
        const next = new Set(prev);
        if (next.has(permKey)) next.delete(permKey);
        else { next.add(permKey); setSelectedModules(m => new Set(m).add(moduleId)); }
        return next;
      });
    }
  };

  const handleToggleColumn = (actionId: string, items: {id: string}[], isEditing = false) => {
    if (isEditing && editingUser) {
        const nextPerms = new Set(editingUser.permissions || []);
        const nextModules = new Set(editingUser.modules || []);
        const allSelected = items.every(item => nextPerms.has(`${item.id}:${actionId}`));
        items.forEach(item => {
            const key = `${item.id}:${actionId}`;
            if (allSelected) nextPerms.delete(key);
            else { nextPerms.add(key); nextModules.add(item.id); }
        });
        setEditingUser({ ...editingUser, permissions: Array.from(nextPerms), modules: Array.from(nextModules) });
    } else {
        setSelectedPerms(prev => {
            const next = new Set(prev);
            const allSelected = items.every(item => item.id && next.has(`${item.id}:${actionId}`));
            items.forEach(item => {
                const key = `${item.id}:${actionId}`;
                if (allSelected) next.delete(key);
                else { next.add(key); setSelectedModules(m => new Set(m).add(item.id)); }
            });
            return next;
        });
    }
  };

  const handleApplyJefeProfile = (isEditing = false) => {
    const jefeModules = [
      'calendario-capacitaciones', 'anexo-i', 'lista-anexo-i', 'solicitud-capacitacion',
      'agenda-anexo-i', 'agenda-anexo-v', 'maquinas', 'control-movimiento-maquinas', 
      'denuncia-lacres', 'informe-divulgador', 'informe-semanal-puntos-fijos', 
      'lista-anexo-iv', 'encuesta-satisfaccion', 'archivo-capacitaciones'
    ];
    const actions = ['view', 'add', 'pdf'];
    const newPerms = new Set<string>();
    jefeModules.forEach(m => actions.forEach(a => newPerms.add(`${m}:${a}`)));
    newPerms.add('district_filter');
    newPerms.add('assign_staff');

    if (isEditing && editingUser) {
      setEditingUser({ ...editingUser, role: 'jefe', modules: jefeModules, permissions: Array.from(newPerms) });
    } else {
      setRegRole('jefe'); setSelectedModules(new Set(jefeModules)); setSelectedPerms(newPerms);
    }
    toast({ title: "Perfil Jefe Aplicado" });
  };

  const handleRepairGhost = (ghost: any) => {
    setEditingUser({
        id: ghost.id,
        email: ghost.email,
        username: ghost.username,
        role: 'funcionario',
        departamento: ghost.departamento || 'ALCANCE NACIONAL',
        distrito: ghost.distrito || 'TODOS LOS DISTRITOS',
        modules: [],
        permissions: [],
        active: true
    });
    setEditModalOpen(true);
  };

  const toggleUserStatus = (user: UserProfile) => {
    if (!firestore || user.email === currentUser?.email) return;
    const currentStatus = user.active !== false;
    updateDoc(doc(firestore, 'users', user.id), { active: !currentStatus })
      .then(() => toast({ title: currentStatus ? 'Acceso Revocado' : 'Acceso Restaurado' }));
  };

  const handleDeleteUser = async (user: UserProfile) => {
    if (!firestore || user.email === currentUser?.email) return;
    setIsSubmitting(true);
    const batch = writeBatch(firestore);
    batch.delete(doc(firestore, 'users', user.id));
    batch.delete(doc(firestore, 'presencia', user.id));
    try {
        await batch.commit();
        toast({ title: 'Usuario eliminado del directorio' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error al eliminar' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!firestore || !currentUser) return;

    setIsSubmitting(true);
    const formData = new FormData(form);
    const email = (formData.get('email') as string || '').trim().toLowerCase();
    const password = formData.get('password') as string;
    const username = (formData.get('username') as string || '').toUpperCase();
    
    const newUserProfile = { 
      username, 
      email, 
      role: regRole, 
      modules: Array.from(selectedModules), 
      permissions: Array.from(selectedPerms), 
      departamento: regDepartamento || 'ALCANCE NACIONAL', 
      distrito: regDistrito || 'TODOS LOS DISTRITOS', 
      active: true,
      registration_method: 'creado_por_admin'
    };

    const tempAppName = 'temp-creation-' + Date.now();
    let tempApp: FirebaseApp | undefined = undefined;
    
    try {
      tempApp = initializeApp(firebaseConfig, tempAppName);
      const tempAuth = getAuth(tempApp);
      const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
      const newUid = userCredential.user.uid;

      const userDocRef = doc(firestore, 'users', newUid);
      
      // GUARDADO ATÓMICO: Primero Auth, luego Firestore
      await setDoc(userDocRef, {
        ...newUserProfile,
        id: newUid,
        fecha_creacion: new Date().toISOString()
      });
      
      toast({ title: 'Usuario registrado con éxito' });
      form.reset(); 
      setSelectedModules(new Set()); 
      setSelectedPerms(new Set());

      await signOut(tempAuth);
    } catch (error: any) {
      console.error("Error en registro:", error);
      toast({ 
        variant: 'destructive', 
        title: 'Fallo al registrar usuario', 
        description: error.message || 'Error de permisos o red.' 
      });
    } finally { 
        if (tempApp) await deleteApp(tempApp).catch(() => {});
        setIsSubmitting(false); 
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !editingUser) return;
    setIsSubmitting(true);
    const userDocRef = doc(firestore, 'users', editingUser.id);
    const updateData = {
        username: editingUser.username.toUpperCase(),
        role: editingUser.role,
        modules: editingUser.modules,
        permissions: editingUser.permissions,
        active: editingUser.active ?? true,
        email: editingUser.email,
        departamento: editingUser.departamento || 'ALCANCE NACIONAL',
        distrito: editingUser.distrito || 'TODOS LOS DISTRITOS'
    };

    try {
        await setDoc(userDocRef, updateData, { merge: true });
        toast({ title: "Perfil Actualizado" });
        setEditModalOpen(false);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error al actualizar' });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (isAuthLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Gestión de Usuarios" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h1 className="text-3xl font-black uppercase text-primary tracking-tighter">Matriz de Personal</h1>
                <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5" /> Control de acceso y permisos del sistema
                </p>
            </div>
            
            {/* DIAGNÓSTICO MAESTRO */}
            {isMasterAdmin && (
                <div className="bg-green-600 text-white px-6 py-3 rounded-2xl flex items-center gap-3 shadow-xl animate-in zoom-in duration-500">
                    <Shield className="h-5 w-5 text-white" />
                    <div>
                        <p className="text-[10px] font-black uppercase leading-none">Status: Súper Administrador</p>
                        <p className="text-[8px] font-bold uppercase opacity-80 mt-1">Permisos Maestros Activados por Email</p>
                    </div>
                </div>
            )}
        </div>

        {/* RADAR DE INTEGRIDAD */}
        {ghostUsers.length > 0 && (
            <div className="p-6 bg-amber-50 border-4 border-dashed border-amber-200 rounded-[2.5rem] space-y-6 animate-in slide-in-from-top duration-700 shadow-2xl">
                <div className="flex items-center gap-4 text-amber-700">
                    <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center border-2 border-amber-300">
                        <AlertTriangle className="h-7 w-7 text-amber-600 animate-pulse" />
                    </div>
                    <div>
                        <span className="font-black uppercase text-lg tracking-tight">Radar de Integridad: Usuarios sin Perfil ({ghostUsers.length})</span>
                        <p className="text-[10px] font-bold uppercase text-amber-600 tracking-widest">Cuentas en Authentication que requieren creación de perfil en Firestore.</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ghostUsers.map(ghost => (
                        <Card key={ghost.id} className="bg-white border-none shadow-lg overflow-hidden group hover:ring-2 hover:ring-amber-400 transition-all">
                            <div className="p-5 flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black uppercase text-primary leading-tight">{ghost.username}</span>
                                        <span className="text-[9px] font-bold text-muted-foreground lowercase">{ghost.email}</span>
                                    </div>
                                    <Button 
                                        onClick={() => handleRepairGhost(ghost)} 
                                        className="h-10 bg-amber-600 hover:bg-amber-700 text-white font-black uppercase text-[9px] px-4 rounded-xl gap-2 shadow-md"
                                    >
                                        <RefreshCw className="h-3.5 w-3.5" /> REPARAR
                                    </Button>
                                </div>
                                <div className="flex items-center gap-2 text-[9px] font-black text-muted-foreground uppercase pt-3 border-t border-dashed">
                                    <MapPin className="h-3 w-3 opacity-40" /> {ghost.departamento} | {ghost.distrito}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        )}

        <Card className="shadow-xl border-none rounded-[2rem] bg-white overflow-hidden">
          <form onSubmit={handleSubmit}>
            <CardHeader className="border-b bg-muted/10 p-8">
              <CardTitle className="uppercase font-black text-xs flex items-center gap-2 text-primary">
                <UserPlus className="h-4 w-4" /> Registrar Nuevo Acceso Oficial
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 p-10">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2"><Label className="text-[9px] font-black uppercase">Nombre y Apellido</Label><Input name="username" required className="font-bold h-11 border-2 uppercase rounded-xl" /></div>
                <div className="space-y-2"><Label className="text-[9px] font-black uppercase">Correo</Label><Input name="email" type="email" required className="font-bold h-11 border-2 rounded-xl" /></div>
                <div className="space-y-2"><Label className="text-[9px] font-black uppercase">Contraseña</Label><Input name="password" type="password" required className="font-bold h-11 border-2 rounded-xl" /></div>
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase">Rol Institucional</Label>
                    <select name="role" required value={regRole} onChange={(e) => setRegRole(e.target.value as any)} className="w-full h-11 border-2 rounded-xl font-black uppercase text-[10px] px-3 bg-white">
                        <option value="admin">ADMINISTRADOR</option>
                        <option value="director">DIRECTOR</option>
                        <option value="coordinador">COORDINADOR</option>
                        <option value="jefe">JEFE DE OFICINA</option>
                        <option value="funcionario">FUNCIONARIO</option>
                        <option value="viewer">SOLO LECTURA</option>
                    </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase">Jurisdicción: Departamento</Label>
                    <Select onValueChange={setRegDepartamento} value={regDepartamento}>
                        <SelectTrigger className="font-black h-11 border-2 uppercase text-[10px] rounded-xl"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                        <SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase">Jurisdicción: Distrito</Label>
                    <Select onValueChange={setRegDistrito} value={regDistrito} disabled={!regDepartamento}>
                        <SelectTrigger className="font-black h-11 border-2 uppercase text-[10px] rounded-xl"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                        <SelectContent>{districts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
              </div>
              <div className="flex justify-end pt-4">
                  <Button type="button" variant="outline" className="font-black text-[9px] uppercase border-2 h-10 px-6 rounded-xl gap-2 hover:bg-black hover:text-white transition-all" onClick={() => handleApplyJefeProfile(false)}>
                    <UserCheck className="h-4 w-4" /> Aplicar Perfil Jefe Estándar
                  </Button>
              </div>
              <PermissionMatrix selectedPerms={selectedPerms} selectedModules={selectedModules} onTogglePerm={handleTogglePerm} onToggleModuleAction={handleToggleModuleAction} onToggleColumn={handleToggleColumn} />
            </CardContent>
            <CardFooter className="bg-muted/30 border-t p-8">
                <Button type="submit" className="w-full h-20 font-black uppercase text-xl shadow-2xl bg-black hover:bg-black/90 rounded-none tracking-widest" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin mr-3 h-8 w-8" /> : <UserPlus className="mr-3 h-8 w-8" />}
                    ALTA DE USUARIO Y PERFIL
                </Button>
            </CardFooter>
          </form>
        </Card>

        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black uppercase text-primary flex items-center gap-3 tracking-tighter">
                    <Users className="h-7 w-7" /> DIRECTORIO POR JURISDICCIÓN
                </h2>
                <div className="relative w-64 md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                    <Input 
                        placeholder="Buscar por nombre, correo o zona..." 
                        className="h-12 pl-10 font-bold border-2 rounded-2xl bg-white shadow-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {isLoadingUsers ? (
                <div className="flex justify-center py-20"><Loader2 className="h-12 w-12 animate-spin text-primary opacity-20"/></div>
            ) : hierarchy.length === 0 ? (
                <Card className="p-32 text-center border-4 border-dashed bg-white rounded-[3rem] opacity-20">
                    <p className="font-black uppercase tracking-[0.2em] text-xl">Sin resultados encontrados</p>
                </Card>
            ) : (
                <Accordion type="multiple" className="space-y-6">
                    {hierarchy.map((dept) => {
                        const filledCount = dept.districts.filter(d => d.users.length > 0).length;
                        return (
                            <AccordionItem key={dept.name} value={dept.name} className="border-none bg-white rounded-[2rem] shadow-sm overflow-hidden">
                                <AccordionTrigger className="hover:no-underline px-8 py-6 bg-white group">
                                    <div className="flex items-center justify-between w-full pr-6">
                                        <div className="flex items-center gap-6 text-left">
                                            <div className="h-14 w-14 rounded-2xl bg-primary/5 text-primary flex items-center justify-center shadow-inner relative group-hover:scale-105 transition-transform">
                                                <Landmark className="h-7 w-7" />
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-black uppercase tracking-tight text-[#1A1A1A]">{dept.name}</h2>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{dept.districts.length} DISTRITOS EN JURISDICCIÓN</p>
                                            </div>
                                        </div>
                                        <Badge variant="secondary" className="bg-black text-white text-[9px] font-black uppercase px-4 h-7 rounded-full shadow-lg">
                                            {filledCount} CUMPLIDOS
                                        </Badge>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-8 pb-8 pt-2">
                                    <Accordion type="multiple" className="space-y-4">
                                        {dept.districts.map((dist) => {
                                            const isPending = dist.users.length === 0;
                                            return (
                                                <AccordionItem key={dist.name} value={dist.name} className="border-none">
                                                    <AccordionTrigger className="hover:no-underline py-4 bg-[#F8F9FA] rounded-2xl px-6 group border-2 border-dashed border-muted transition-all hover:border-primary/20">
                                                        <div className="flex items-center justify-between w-full pr-4">
                                                            <div className="flex items-center gap-4">
                                                                <Building2 className={cn("h-5 w-5 transition-colors", isPending ? "text-muted-foreground/30" : "text-primary")} />
                                                                <span className="font-black uppercase text-sm tracking-tight text-foreground/80">{dist.name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                {isPending ? (
                                                                    <Badge variant="outline" className="text-destructive border-destructive/20 bg-destructive/[0.03] text-[8px] font-black uppercase flex gap-2 items-center px-3 py-1">
                                                                        <AlertCircle className="h-3 w-3" /> PENDIENTE
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge className="bg-green-600 text-white text-[8px] font-black uppercase flex gap-2 items-center px-3 py-1 shadow-md">
                                                                        <CheckCircle2 className="h-3 w-3" /> CUMPLIDO
                                                                    </Badge>
                                                                )}
                                                                {!isPending && <Badge variant="secondary" className="bg-black text-white text-[9px] font-black min-w-[28px]">{dist.users.length}</Badge>}
                                                            </div>
                                                        </div>
                                                    </AccordionTrigger>
                                                    <AccordionContent className="pt-6 px-2">
                                                        {!isPending && (
                                                            <div className="overflow-x-auto border-2 rounded-2xl bg-white shadow-inner">
                                                                <Table>
                                                                    <TableHeader className="bg-muted/30">
                                                                        <TableRow>
                                                                            <TableHead className="text-[9px] font-black uppercase px-8">Funcionario Autorizado</TableHead>
                                                                            <TableHead className="text-[9px] font-black uppercase">Rol Sistema</TableHead>
                                                                            <TableHead className="text-[9px] font-black uppercase">Estado</TableHead>
                                                                            <TableHead className="text-right text-[9px] font-black uppercase px-8">Gestión</TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {dist.users.map(u => (
                                                                            <TableRow key={u.id} className="hover:bg-muted/10 transition-colors border-b last:border-0">
                                                                                <TableCell className="px-8 py-5">
                                                                                    <div className="flex items-center gap-3">
                                                                                        <div className="h-9 w-9 rounded-xl bg-primary/5 flex items-center justify-center font-black text-xs text-primary border border-primary/10">
                                                                                            {u.username.substring(0, 2).toUpperCase()}
                                                                                        </div>
                                                                                        <div className="flex flex-col">
                                                                                            <span className="font-black text-xs uppercase text-primary leading-tight">{u.username}</span>
                                                                                            <span className="text-[9px] text-muted-foreground font-bold lowercase">{u.email}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/10 bg-primary/[0.02]">
                                                                                        {u.role}
                                                                                    </Badge>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <div className={cn(
                                                                                            "h-2 w-2 rounded-full",
                                                                                            u.active !== false ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-red-500"
                                                                                        )} />
                                                                                        <span className={cn("text-[9px] font-black uppercase", u.active !== false ? "text-green-600" : "text-destructive")}>
                                                                                            {u.active !== false ? 'Activo' : 'Bloqueado'}
                                                                                        </span>
                                                                                    </div>
                                                                                </TableCell>
                                                                                <TableCell className="text-right px-8">
                                                                                    <div className="flex justify-end gap-2">
                                                                                        <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-primary/5 text-primary/40 hover:text-primary transition-all" onClick={() => { setEditingUser(u); setEditModalOpen(true); }}><Edit className="h-4 w-4" /></Button>
                                                                                        <Button variant="ghost" size="icon" className={cn("h-9 w-9 transition-all", u.active !== false ? "text-amber-600/40 hover:text-amber-600 hover:bg-amber-50" : "text-green-600/40 hover:text-green-600 hover:bg-green-50")} onClick={() => toggleUserStatus(u)}>
                                                                                            {u.active !== false ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                                                                                        </Button>
                                                                                        <AlertDialog>
                                                                                            <AlertDialogTrigger asChild>
                                                                                                <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive/40 hover:text-destructive hover:bg-destructive/5"><Trash2 className="h-4 w-4" /></Button>
                                                                                            </AlertDialogTrigger>
                                                                                            <AlertDialogContent className="rounded-3xl border-none shadow-2xl p-8">
                                                                                                <AlertDialogHeader className="space-y-4">
                                                                                                    <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto border-4 border-destructive/20">
                                                                                                        <ShieldAlert className="h-8 w-8 text-destructive" />
                                                                                                    </div>
                                                                                                    <AlertDialogTitle className="font-black uppercase tracking-tight text-center text-xl">¿ELIMINAR ACCESO DEFINITIVAMENTE?</AlertDialogTitle>
                                                                                                    <AlertDialogDescription className="text-xs font-bold uppercase leading-relaxed text-muted-foreground text-center">
                                                                                                        Se borrará el perfil de <span className="text-primary font-black">{u.username}</span> en Firestore y su rastro de conexión. El acceso será revocado de inmediato.
                                                                                                    </AlertDialogDescription>
                                                                                                </AlertDialogHeader>
                                                                                                <AlertDialogFooter className="mt-8 sm:justify-center gap-4">
                                                                                                    <AlertDialogCancel className="h-12 rounded-xl font-black uppercase text-[10px] px-8 border-2">CANCELAR</AlertDialogCancel>
                                                                                                    <AlertDialogAction onClick={() => handleDeleteUser(u)} className="h-12 bg-destructive hover:bg-destructive/90 text-white rounded-xl font-black uppercase text-[10px] px-8 shadow-xl">
                                                                                                        SÍ, ELIMINAR PERFIL
                                                                                                    </AlertDialogAction>
                                                                                                </AlertDialogFooter>
                                                                                            </AlertDialogContent>
                                                                                        </AlertDialog>
                                                                                    </div>
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                        )}
                                                    </AccordionContent>
                                                </AccordionItem>
                                            );
                                        })}
                                    </Accordion>
                                </AccordionContent>
                            </AccordionItem>
                        );
                    })}
                </Accordion>
            )}
        </div>
      </main>

      <Dialog open={isEditModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-5xl h-[95vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem]">
          {editingUser && (
            <form onSubmit={handleUpdateUser} className="flex flex-col h-full bg-white">
              <DialogHeader className="p-8 bg-black text-white shrink-0">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-6">
                        <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                            <Settings className="h-6 w-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-black uppercase tracking-tight leading-none">Configurar Perfil Institucional</DialogTitle>
                            <DialogDescription className="text-white/60 font-bold uppercase text-[10px] tracking-widest mt-2">USUARIO: {editingUser.email}</DialogDescription>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button type="button" variant="outline" className="font-black uppercase text-[10px] h-10 bg-transparent text-white border-white/30 hover:bg-white/10 px-6 rounded-xl" onClick={() => handleApplyJefeProfile(true)}>MODO JEFE</Button>
                        <Button variant="ghost" size="icon" onClick={() => setEditModalOpen(false)} className="text-white/40 hover:text-white"><X className="h-6 w-6"/></Button>
                    </div>
                </div>
              </DialogHeader>
              <ScrollArea className="flex-1 p-10 bg-[#F8F9FA]">
                <div className="space-y-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 bg-white p-8 rounded-[2rem] shadow-sm border-2 border-dashed">
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">Nombre y Apellido</Label><Input value={editingUser.username} onChange={(e) => setEditingUser({...editingUser, username: e.target.value})} className="font-bold h-12 border-2 uppercase rounded-xl" /></div>
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">Rol de Sistema</Label>
                            <select value={editingUser.role} onChange={(e) => setEditingUser({...editingUser, role: e.target.value as any})} className="w-full h-12 border-2 rounded-xl font-black uppercase text-[10px] px-4 bg-white">
                                <option value="admin">ADMIN</option>
                                <option value="director">DIRECTOR</option>
                                <option value="coordinador">COORDINADOR</option>
                                <option value="jefe">JEFE</option>
                                <option value="funcionario">FUNCIONARIO</option>
                                <option value="viewer">VIEWER</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Estado de Acceso</Label>
                            <div className="flex items-center gap-4 pt-2">
                                <Checkbox 
                                    id="edit-status" 
                                    checked={editingUser.active !== false} 
                                    onCheckedChange={(val) => setEditingUser({...editingUser, active: !!val})}
                                    className="h-5 w-5"
                                />
                                <Label htmlFor="edit-status" className={cn("text-[11px] font-black uppercase", editingUser.active !== false ? "text-green-600" : "text-destructive")}>
                                    {editingUser.active !== false ? "ACCESO HABILITADO" : "ACCESO BLOQUEADO"}
                                </Label>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Jurisdicción</Label>
                            <p className="text-xs font-black uppercase tracking-tight text-primary mt-2">{editingUser.departamento} | {editingUser.distrito}</p>
                        </div>
                    </div>
                    
                    <PermissionMatrix userObj={editingUser} isEditing={true} selectedPerms={selectedPerms} selectedModules={selectedModules} onTogglePerm={handleTogglePerm} onToggleModuleAction={handleToggleModuleAction} onToggleColumn={handleToggleColumn} />
                </div>
              </ScrollArea>
              <DialogFooter className="p-8 bg-white border-t">
                <Button type="submit" disabled={isSubmitting} className="w-full h-20 font-black uppercase bg-black hover:bg-black/90 shadow-2xl tracking-[0.2em] text-lg rounded-none">
                    {isSubmitting ? <Loader2 className="animate-spin h-8 w-8" /> : <Zap className="h-8 w-8 mr-2" />}
                    ACTUALIZAR MATRIZ DE SEGURIDAD
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>}>
      <UsersContent />
    </Suspense>
  );
}