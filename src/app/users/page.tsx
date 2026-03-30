
"use client";

import { useState, useEffect, useMemo } from 'react';
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
  ShieldAlert, 
  MapPin, 
  Globe, 
  CheckCircle2,
  Lock,
  Settings,
  ChevronRight,
  UserCircle,
  X,
  Landmark,
  Building2,
  AlertCircle,
  Zap,
  Activity,
  Power,
  PowerOff,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useFirebase, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { collection, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
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
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
      { id: 'anexo-i', label: 'ANEXO I - LUGARES FIJOS' },
      { id: 'lista-anexo-i', label: 'LISTADO DE ANEXO I' },
      { id: 'solicitud-capacitacion', label: 'ANEXO V - SOLICITUDES' },
      { id: 'agenda-anexo-i', label: 'AGENDA ANEXO I' },
      { id: 'agenda-anexo-v', label: 'AGENDA ANEXO V' },
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
    category: "GESTIÓN DE DATOS",
    items: [
      { id: 'importar-reportes', label: 'IMPORTAR REPORTES' },
      { id: 'importar-locales', label: 'IMPORTAR LOCALES' },
      { id: 'importar-partidos', label: 'IMPORTAR PARTIDOS' },
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
                            <div className="flex items-center gap-1">
                                <Checkbox 
                                    checked={allInColSelected}
                                    onCheckedChange={() => onToggleColumn(a.id, cat.items, isEditing)}
                                    className="h-3.5 w-3.5 border-primary/30"
                                />
                                <span className="text-[7px] font-black text-muted-foreground">ALL</span>
                            </div>
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

export default function UsersPage() {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { user: currentUser, isUserLoading: isAuthLoading, isProfileLoading } = useUser();

  const isAdminView = useMemo(() => {
    if (isProfileLoading || !currentUser?.profile) return false;
    return currentUser.profile.role === 'admin' || currentUser.email === 'edubtz11@gmail.com';
  }, [currentUser, isProfileLoading]);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !isAdminView) return null;
    return collection(firestore, 'users');
  }, [firestore, isAdminView]);

  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);
  const datosQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'datos') : null), [firestore]);
  const { data: datosData } = useCollection<Dato>(datosQuery);

  const presenceQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'presencia') : null), [firestore]);
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

  const departments = useMemo(() => {
    if (!datosData) return [];
    return [...new Set(datosData.map(d => d.departamento))].sort();
  }, [datosData]);

  const districts = useMemo(() => {
    if (!datosData || !regDepartamento) return [];
    return [...new Set(datosData.filter(d => d.departamento === regDepartamento).map(d => d.distrito))].sort();
  }, [datosData, regDepartamento]);

  const stats = useMemo(() => {
    if (!users || !datosData) return { total: 0, active: 0, coverage: 0 };
    
    const userDistricts = new Set();
    users.forEach(u => {
        if (u.departamento && u.distrito && u.departamento !== 'ALCANCE NACIONAL') {
            userDistricts.add(`${u.departamento}-${u.distrito}`);
        }
    });

    const totalDistricts = datosData.filter(d => d.departamento !== 'SEDE CENTRAL').length;
    const coverage = totalDistricts > 0 ? Math.round((userDistricts.size / totalDistricts) * 100) : 0;

    return {
        total: users.length,
        active: users.filter(u => u.active !== false).length,
        coverage
    };
  }, [users, datosData]);

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    const term = searchTerm.toLowerCase().trim();
    return users.filter(u => 
      u.username.toLowerCase().includes(term) || 
      u.email.toLowerCase().includes(term) || 
      u.role.toLowerCase().includes(term) ||
      (u.distrito && u.distrito.toLowerCase().includes(term)) ||
      (u.departamento && u.departamento.toLowerCase().includes(term))
    ).sort((a,b) => a.username.localeCompare(b.username));
  }, [users, searchTerm]);

  const userHierarchy = useMemo(() => {
    if (!datosData) return [];
    const term = searchTerm.toLowerCase().trim();
    const depts: Record<string, { name: string, districts: Record<string, { name: string, users: UserProfile[] }> }> = {};

    // Inicializar departamentos y distritos del maestro de geografía (Para ver distritos pendientes)
    datosData.forEach(d => {
      if (!depts[d.departamento]) depts[d.departamento] = { name: d.departamento, districts: {} };
      if (!depts[d.departamento].districts[d.distrito]) {
        depts[d.departamento].districts[d.distrito] = { name: d.distrito, users: [] };
      }
    });

    // Mapear usuarios filtrados a sus respectivos departamentos y distritos
    filteredUsers.forEach(u => {
      const deptName = u.departamento || 'ALCANCE NACIONAL';
      const distName = u.distrito || 'TODOS LOS DISTRITOS';

      if (!depts[deptName]) depts[deptName] = { name: deptName, districts: {} };
      if (!depts[deptName].districts[distName]) depts[deptName].districts[distName] = { name: distName, users: [] };
      depts[deptName].districts[distName].users.push(u);
    });

    // Filtrar la jerarquía para que sea "directa" al buscar
    return Object.values(depts)
      .map(dept => {
        const districtsArray = Object.values(dept.districts);
        const activeDistricts = districtsArray.filter(d => d.users.length > 0);
        
        return {
          ...dept,
          activeCount: activeDistricts.length,
          totalCount: districtsArray.length,
          districts: districtsArray.sort((a, b) => a.name.localeCompare(b.name))
        };
      })
      .filter(dept => {
        if (!term) return dept.districts.some(d => d.users.length > 0);
        return dept.name.toLowerCase().includes(term) || dept.districts.some(d => d.name.toLowerCase().includes(term) || d.users.length > 0);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [datosData, filteredUsers, searchTerm]);

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
            const allSelected = items.every(item => next.has(`${item.id}:${actionId}`));
            items.forEach(item => {
                const key = `${item.id}:${actionId}`;
                if (allSelected) next.delete(key);
                else { next.add(key); setSelectedModules(m => new Set(m).add(item.id)); }
            });
            return next;
        });
    }
  };

  const handleApplyCIDEEProfile = (isEditing = false) => {
    const cideeModules = MODULE_STRUCTURE.find(c => c.category === "CIDEE - CAPACITACIONES")?.items.map(i => i.id) || [];
    const actions = ['view', 'add', 'edit', 'pdf'];
    const newPerms = new Set<string>();
    const newModules = new Set<string>();
    cideeModules.forEach(m => { newModules.add(m); actions.forEach(a => newPerms.add(`${m}:${a}`)); });
    newPerms.add('district_filter');
    newPerms.add('assign_staff');
    if (isEditing && editingUser) {
        setEditingUser({ ...editingUser, role: 'coordinador', modules: Array.from(new Set([...(editingUser.modules || []), ...Array.from(newModules)])), permissions: Array.from(new Set([...(editingUser.permissions || []), ...Array.from(newPerms)])) });
    } else {
        setRegRole('coordinador'); setSelectedModules(newModules); setSelectedPerms(newPerms);
    }
    toast({ title: "Perfil CIDEE Aplicado" });
  };
  
  const toggleUserStatus = (user: UserProfile) => {
    if (!firestore || user.email === 'edubtz11@gmail.com') return;
    const currentStatus = user.active !== false;
    const newStatus = !currentStatus;
    const docRef = doc(firestore, 'users', user.id);
    updateDoc(docRef, { active: newStatus })
      .then(() => toast({ title: newStatus ? 'Usuario Habilitado' : 'Usuario Desactivado' }))
      .catch((error) => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update' })));
  };

  const handleDeleteUser = (user: UserProfile) => {
    if (!firestore || user.email === 'edubtz11@gmail.com') return;
    const userDocRef = doc(firestore, 'users', user.id);
    deleteDoc(userDocRef).then(() => toast({ title: 'Usuario Elimnado' }))
      .catch((error) => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: userDocRef.path, operation: 'delete' })));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!firestore || !currentUser) return;

    setIsSubmitting(true);
    const formData = new FormData(form);
    const email = (formData.get('email') as string || '').trim();
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

    const tempAppName = 'temp-creation-' + Math.random().toString(36).substring(7);
    let tempApp: FirebaseApp | undefined = undefined;
    try {
      tempApp = initializeApp(firebaseConfig, tempAppName);
      const tempAuth = getAuth(tempApp);
      const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
      await setDoc(doc(firestore, 'users', userCredential.user.uid), newUserProfile);
      await signOut(tempAuth);
      toast({ title: 'Usuario Creado con Éxito' });
      form.reset(); setSelectedModules(new Set()); setSelectedPerms(new Set());
    } catch (error: any) { toast({ variant: 'destructive', title: 'Error', description: error.message }); }
    finally { if (tempApp) await deleteApp(tempApp); setIsSubmitting(false); }
  };

  const handleUpdateUser = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore || !editingUser) return;
    setIsSubmitting(true);
    const updateData = { 
        username: editingUser.username.toUpperCase(), 
        role: editingUser.role, 
        modules: editingUser.modules || [], 
        permissions: editingUser.permissions || [], 
        departamento: editingUser.departamento || 'ALCANCE NACIONAL', 
        distrito: editingUser.distrito || 'TODOS LOS DISTRITOS' 
    };
    const docRef = doc(firestore, 'users', editingUser.id);
    updateDoc(docRef, updateData).then(() => { toast({ title: 'Perfil Actualizado' }); setEditModalOpen(false); setIsSubmitting(false); })
      .catch(async (error) => { errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update' })); setIsSubmitting(false); });
  };

  if (isAuthLoading || isProfileLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary"/></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/5">
      <Header title="Administración de Accesos" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h1 className="text-3xl font-black tracking-tight uppercase text-primary leading-none">Matriz de Personal</h1>
                <p className="text-muted-foreground text-[10px] font-bold uppercase flex items-center gap-2 mt-2 tracking-widest">
                    <ShieldCheck className="h-3 w-3" /> Control de identidades y validación de roles
                </p>
            </div>
            <div className="flex flex-col md:flex-row items-end gap-4">
                <Card className="bg-white border-2 border-primary/10 p-4 rounded-2xl flex items-center gap-4 min-w-[180px] shadow-sm">
                    <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center"><Building2 className="h-5 w-5 text-primary" /></div>
                    <div>
                        <p className="text-[8px] font-black uppercase text-muted-foreground leading-none mb-1">COBERTURA NACIONAL</p>
                        <p className="text-2xl font-black text-primary">{stats.coverage}%</p>
                    </div>
                </Card>
                <Card className="bg-black text-white p-4 rounded-2xl flex items-center gap-4 min-w-[180px] shadow-xl">
                    <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center"><Users className="h-5 w-5" /></div>
                    <div>
                        <p className="text-[8px] font-black uppercase opacity-60 tracking-widest leading-none mb-1">PERSONAL REGISTRADO</p>
                        <p className="text-2xl font-black">{stats.total}</p>
                    </div>
                </Card>
            </div>
        </div>

        <Card className="shadow-2xl border-none overflow-hidden rounded-xl bg-white">
          <form onSubmit={handleSubmit}>
            <CardHeader className="border-b py-6 bg-muted/10">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <CardTitle className="uppercase font-black text-xs flex items-center gap-2 tracking-widest text-primary"><UserPlus className="h-4 w-4" /> Registrar Funcionario</CardTitle>
                <Button type="button" variant="outline" size="sm" className="font-black uppercase text-[10px] gap-2 h-9" onClick={() => handleApplyCIDEEProfile(false)}><Zap className="h-3.5 w-3.5 fill-primary" /> PERFIL CIDEE</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-10 pt-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2"><Label className="text-[9px] font-black uppercase">Nombre y Apellido</Label><Input name="username" placeholder="Nombre y Apellido" required className="font-bold h-11 border-2 uppercase" /></div>
                <div className="space-y-2"><Label className="text-[9px] font-black uppercase">Correo Institucional</Label><Input name="email" type="email" placeholder="usuario@tsje.gov.py" required className="font-bold h-11 border-2" /></div>
                <div className="space-y-2"><Label className="text-[9px] font-black uppercase">Contraseña</Label><Input name="password" type="password" required className="font-bold h-11 border-2" /></div>
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase">Rol Institucional</Label>
                    <Select onValueChange={(v: any) => setRegRole(v)} value={regRole}>
                        <SelectTrigger className="font-black h-11 border-2 uppercase text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="admin">ADMINISTRADOR</SelectItem><SelectItem value="director">DIRECTOR</SelectItem><SelectItem value="coordinador">COORDINADOR CIDEE</SelectItem><SelectItem value="jefe">JEFE DE OFICINA</SelectItem><SelectItem value="funcionario">FUNCIONARIO</SelectItem><SelectItem value="viewer">SOLO LECTURA</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase">Departamento</Label>
                    <Select onValueChange={setRegDepartamento} value={regDepartamento}>
                        <SelectTrigger className="font-black h-11 border-2 uppercase text-[10px]"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                        <SelectContent><SelectItem value="N/A">ALCANCE NACIONAL</SelectItem>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase">Distrito</Label>
                    <Select onValueChange={setRegDistrito} value={regDistrito} disabled={!regDepartamento || regDepartamento === 'N/A'}>
                        <SelectTrigger className="font-black h-11 border-2 uppercase text-[10px]"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                        <SelectContent><SelectItem value="N/A">TODOS LOS DISTRITOS</SelectItem>{districts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
              </div>
              <Separator />
              <PermissionMatrix selectedPerms={selectedPerms} selectedModules={selectedModules} onTogglePerm={handleTogglePerm} onToggleModuleAction={handleToggleModuleAction} onToggleColumn={handleToggleColumn} />
            </CardContent>
            <CardFooter className="bg-muted/30 border-t p-6"><Button type="submit" className="w-full h-16 font-black uppercase shadow-xl text-lg" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin mr-3" /> : "REGISTRAR ACCESO CENTRAL"}</Button></CardFooter>
          </form>
        </Card>

        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-primary p-6 rounded-xl shadow-lg">
                <div className="flex items-center gap-3">
                    <Users className="h-6 w-6 text-white opacity-50" />
                    <div>
                        <h2 className="text-white font-black uppercase text-sm">Directorio de Usuarios</h2>
                        <p className="text-white/60 font-bold uppercase text-[9px]">Gestión jerárquica de permisos y estados</p>
                    </div>
                </div>
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                    <Input placeholder="Buscar por nombre, distrito o dpto..." className="h-10 pl-10 text-[10px] font-bold bg-white/10 border-white/20 text-white rounded-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </div>

            {isLoadingUsers ? <div className="flex justify-center items-center py-20 bg-white rounded-xl shadow-md"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div> : (
                <Accordion type="multiple" className="space-y-4">
                    {userHierarchy.map((dept) => (
                        <AccordionItem key={dept.name} value={dept.name} className="border-none bg-white rounded-xl shadow-md overflow-hidden">
                            <AccordionTrigger className="hover:no-underline px-8 py-5 bg-white group">
                                <div className="flex items-center justify-between w-full pr-6 text-left">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-lg bg-primary/5 text-primary flex items-center justify-center font-black border border-primary/10">
                                            <Landmark className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-black uppercase tracking-tight text-[#1A1A1A]">{dept.name}</h2>
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">{dept.activeCount} OFICINAS ACTIVAS</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge variant="secondary" className="bg-muted text-muted-foreground text-[8px] font-black uppercase">{dept.totalCount} TOTAL</Badge>
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[8px] font-black uppercase">{dept.districts.reduce((acc, d) => acc + d.users.length, 0)} PERSONAL</Badge>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-8 pb-8 pt-2">
                                <Accordion type="multiple" className="space-y-3 pt-4">
                                    {dept.districts.map((dist) => {
                                        return (
                                            <AccordionItem key={dist.name} value={dist.name} className="border-2 rounded-xl overflow-hidden transition-all hover:border-primary/10">
                                                <AccordionTrigger className="hover:no-underline px-6 py-3 bg-muted/5 group">
                                                    <div className="flex items-center justify-between w-full pr-4">
                                                        <div className="flex items-center gap-3">
                                                            <Building2 className={cn("h-4 w-4", dist.users.length > 0 ? "text-primary" : "text-muted-foreground/30")} />
                                                            <span className={cn("font-black uppercase text-xs", dist.users.length === 0 && "text-muted-foreground/60")}>{dist.name}</span>
                                                        </div>
                                                        {dist.users.length > 0 ? (
                                                            <Badge className="bg-black text-white text-[8px] font-black">{dist.users.length} PERSONAL</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="border-dashed border-primary/20 text-primary/40 text-[7px] font-black uppercase">PENDIENTE DE REGISTRO</Badge>
                                                        )}
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="p-0 bg-white">
                                                    {dist.users.length > 0 ? (
                                                        <div className="overflow-x-auto">
                                                            <Table>
                                                                <TableHeader className="bg-muted/30">
                                                                    <TableRow>
                                                                        <TableHead className="text-[8px] font-black uppercase px-6">Funcionario</TableHead>
                                                                        <TableHead className="text-[8px] font-black uppercase">Rol</TableHead>
                                                                        <TableHead className="text-[8px] font-black uppercase px-6">Última Conexión</TableHead>
                                                                        <TableHead className="text-[8px] font-black uppercase">Estado</TableHead>
                                                                        <TableHead className="text-right text-[8px] font-black uppercase px-6">Acción</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {dist.users.map(u => {
                                                                        const isUserOwner = u.email === 'edubtz11@gmail.com';
                                                                        const isActive = u.active === true || isUserOwner;
                                                                        
                                                                        return (
                                                                            <TableRow key={u.id} className="hover:bg-primary/5">
                                                                                <TableCell className="px-6 py-3">
                                                                                    <div className="flex flex-col">
                                                                                        <span className="font-black text-[11px] uppercase text-primary leading-none">{u.username}</span>
                                                                                        <span className="text-[9px] font-bold text-muted-foreground mt-1">{u.email}</span>
                                                                                    </div>
                                                                                </TableCell>
                                                                                <TableCell><Badge variant="secondary" className="text-[7px] font-black uppercase bg-primary/5 text-primary border-none">{u.role}</Badge></TableCell>
                                                                                <TableCell className="px-6 py-3">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <Clock className="h-3.5 w-3.5 text-muted-foreground opacity-40" />
                                                                                        <span className="text-[9px] font-black uppercase text-muted-foreground">
                                                                                            {(() => {
                                                                                                const presence = presenceData?.find(p => p.usuario_id === u.id);
                                                                                                if (!presence?.ultima_actividad) return 'SIN REGISTRO';
                                                                                                try {
                                                                                                    return format(presence.ultima_actividad.toDate(), "dd/MM/yy HH:mm", { locale: es });
                                                                                                } catch (e) {
                                                                                                    return 'SIN REGISTRO';
                                                                                                }
                                                                                            })()}
                                                                                        </span>
                                                                                    </div>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    {isActive ? (
                                                                                        <Badge className="bg-green-600 text-white text-[7px] font-black uppercase">ACTIVO</Badge>
                                                                                    ) : u.registration_method === 'auto_registro_jefe' ? (
                                                                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[7px] font-black uppercase">PENDIENTE</Badge>
                                                                                    ) : (
                                                                                        <Badge variant="destructive" className="text-[7px] font-black uppercase">INACTIVO</Badge>
                                                                                    )}
                                                                                </TableCell>
                                                                                <TableCell className="text-right px-6">
                                                                                    <div className="flex justify-end gap-2">
                                                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingUser({...u}); setEditModalOpen(true); }}><Edit className="h-4 w-4" /></Button>
                                                                                        <Button variant="ghost" size="icon" className={cn("h-8 w-8", isActive ? "text-amber-600" : "text-green-600")} title={isActive ? "Deshabilitar Acceso" : "Habilitar Acceso"} onClick={() => toggleUserStatus(u)} disabled={isUserOwner}>
                                                                                            {isActive ? <ShieldAlert className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                                                                                        </Button>
                                                                                        <AlertDialog>
                                                                                            <AlertDialogTrigger asChild>
                                                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" disabled={isUserOwner}>
                                                                                                    <Trash2 className="h-4 w-4" />
                                                                                                </Button>
                                                                                            </AlertDialogTrigger>
                                                                                            <AlertDialogContent className="rounded-[2rem]">
                                                                                                <AlertDialogHeader>
                                                                                                    <AlertDialogTitle className="font-black uppercase">¿ELIMINAR ACCESO?</AlertDialogTitle>
                                                                                                    <AlertDialogDescription className="text-xs font-medium uppercase">
                                                                                                        Esta acción es permanente. Se borrará el perfil de {u.username} del sistema central.
                                                                                                    </AlertDialogDescription>
                                                                                                </AlertDialogHeader>
                                                                                                <AlertDialogFooter className="pt-6">
                                                                                                    <AlertDialogCancel className="rounded-xl text-[10px] font-black">CANCELAR</AlertDialogCancel>
                                                                                                    <AlertDialogAction onClick={() => handleDeleteUser(u)} className="bg-destructive text-white rounded-xl text-[10px] font-black">ELIMINAR DEFINITIVAMENTE</AlertDialogAction>
                                                                                                </AlertDialogFooter>
                                                                                            </AlertDialogContent>
                                                                                        </AlertDialog>
                                                                                    </div>
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        );
                                                                    })}</TableBody>
                                                            </Table>
                                                        </div>
                                                    ) : (
                                                        <div className="py-10 text-center space-y-2 opacity-30">
                                                            <UserCircle className="h-8 w-8 mx-auto text-muted-foreground" />
                                                            <p className="text-[10px] font-black uppercase">Oficina pendiente de asignación</p>
                                                        </div>
                                                    )}
                                                </AccordionContent>
                                            </AccordionItem>
                                        );
                                    })}
                                </Accordion>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            )}
        </div>
      </main>

      <Dialog open={isEditModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl">
          {editingUser && (
            <form onSubmit={handleUpdateUser} className="flex flex-col h-full bg-white">
              <DialogHeader className="p-8 bg-black text-white shrink-0">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-white/10 rounded-xl flex items-center justify-center"><Settings className="h-6 w-6" /></div>
                        <div><DialogTitle className="text-2xl font-black uppercase">Editar Perfil</DialogTitle><DialogDescription className="text-white/60 font-bold uppercase text-[9px]">ID: {editingUser.id}</DialogDescription></div>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="font-black uppercase text-[10px] h-9" onClick={() => handleApplyCIDEEProfile(true)}><Zap className="h-3.5 w-3.5 fill-white" /> PERFIL CIDEE</Button>
                </div>
              </DialogHeader>
              <ScrollArea className="flex-1">
                <div className="p-8 space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="space-y-3"><Label className="text-[10px] font-black uppercase">Nombre</Label><Input value={editingUser.username} onChange={(e) => setEditingUser({...editingUser, username: e.target.value})} className="font-bold h-12 border-2 uppercase" /></div>
                        <div className="space-y-3"><Label className="text-[10px] font-black uppercase">Rol</Label><Select onValueChange={(v: any) => setEditingUser({...editingUser, role: v})} value={editingUser.role}><SelectTrigger className="font-black h-12 border-2 text-[10px] uppercase"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">ADMIN</SelectItem><SelectItem value="director">DIRECTOR</SelectItem><SelectItem value="coordinador">COORDINADOR</SelectItem><SelectItem value="jefe">JEFE</SelectItem><SelectItem value="funcionario">FUNCIONARIO</SelectItem><SelectItem value="viewer">VIEWER</SelectItem></SelectContent></Select></div>
                        <div className="space-y-3"><Label className="text-[10px] font-black uppercase">Dpto</Label><Select onValueChange={(v) => setEditingUser({...editingUser, departamento: v, distrito: ''})} value={editingUser.departamento || 'N/A'}><SelectTrigger className="font-black h-12 border-2 text-[10px] uppercase"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="N/A">NACIONAL</SelectItem>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-3"><Label className="text-[10px] font-black uppercase">Distrito</Label><Select onValueChange={(v) => setEditingUser({...editingUser, distrito: v})} value={editingUser.distrito || 'N/A'} disabled={!editingUser.departamento || editingUser.departamento === 'N/A'}><SelectTrigger className="font-black h-12 border-2 text-[10px] uppercase"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="N/A">TODOS</SelectItem>{datosData?.filter(d => d.departamento === editingUser.departamento).map(d => <SelectItem key={d.distrito} value={d.distrito}>{d.distrito}</SelectItem>)}</SelectContent></Select></div>
                    </div>
                    <Separator />
                    <PermissionMatrix userObj={editingUser} isEditing={true} selectedPerms={selectedPerms} selectedModules={selectedModules} onTogglePerm={handleTogglePerm} onToggleModuleAction={handleToggleModuleAction} onToggleColumn={handleToggleColumn} />
                </div>
              </ScrollArea>
              <DialogFooter className="p-8 bg-muted/30 border-t"><DialogClose asChild><Button variant="outline" type="button" className="font-black uppercase text-[10px] px-8 h-14">CANCELAR</Button></DialogClose><Button type="submit" disabled={isSubmitting} className="font-black uppercase text-xs h-14 flex-1 shadow-xl bg-black hover:bg-black/90">{isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : "ACTUALIZAR MATRIZ"}</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
