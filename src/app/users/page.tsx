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
  ShieldAlert
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useFirebase, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { collection, doc, setDoc, updateDoc, writeBatch, query, where, orderBy } from 'firebase/firestore';
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

  const isAdminView = useMemo(() => {
    return currentUser?.profile?.role === 'admin' || currentUser?.isOwner;
  }, [currentUser]);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !isAdminView) return null;
    return collection(firestore, 'users');
  }, [firestore, isAdminView]);

  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);
  const datosQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'datos') : null), [firestore]);
  const { data: datosData } = useCollection<Dato>(datosQuery);

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

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    const term = searchTerm.toLowerCase().trim();
    return users.filter(u => 
      u.username.toLowerCase().includes(term) || 
      u.email.toLowerCase().includes(term) || 
      u.role.toLowerCase().includes(term)
    ).sort((a,b) => a.username.localeCompare(b.username));
  }, [users, searchTerm]);

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
        toast({ title: 'Usuario eliminado' });
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
      username, email, role: regRole, 
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

      // GUARDADO CRÍTICO EN FIRESTORE
      await setDoc(doc(firestore, 'users', newUid), newUserProfile);

      toast({ title: 'Usuario creado con éxito' });
      form.reset(); 
      setSelectedModules(new Set()); 
      setSelectedPerms(new Set());
      await signOut(tempAuth);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Fallo al crear usuario', description: error.message });
    } finally { 
        if (tempApp) await deleteApp(tempApp).catch(() => {});
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
                <h1 className="text-3xl font-black uppercase text-primary">Matriz de Personal</h1>
                <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mt-1">Control de acceso y permisos del sistema</p>
            </div>
        </div>

        <Card className="shadow-xl border-none rounded-xl bg-white overflow-hidden">
          <form onSubmit={handleSubmit}>
            <CardHeader className="border-b bg-muted/10">
              <CardTitle className="uppercase font-black text-xs flex items-center gap-2 text-primary">
                <UserPlus className="h-4 w-4" /> Registrar Nuevo Acceso
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 pt-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2"><Label className="text-[9px] font-black uppercase">Nombre y Apellido</Label><Input name="username" required className="font-bold h-11 border-2 uppercase" /></div>
                <div className="space-y-2"><Label className="text-[9px] font-black uppercase">Correo</Label><Input name="email" type="email" required className="font-bold h-11 border-2" /></div>
                <div className="space-y-2"><Label className="text-[9px] font-black uppercase">Contraseña</Label><Input name="password" type="password" required className="font-bold h-11 border-2" /></div>
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase">Rol</Label>
                    <select name="role" required value={regRole} onChange={(e) => setRegRole(e.target.value as any)} className="w-full h-11 border-2 rounded-md font-black uppercase text-[10px] px-3">
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
                    <Label className="text-[9px] font-black uppercase">Departamento</Label>
                    <Select onValueChange={setRegDepartamento} value={regDepartamento}>
                        <SelectTrigger className="font-black h-11 border-2 uppercase text-[10px]"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                        <SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase">Distrito</Label>
                    <Select onValueChange={setRegDistrito} value={regDistrito} disabled={!regDepartamento}>
                        <SelectTrigger className="font-black h-11 border-2 uppercase text-[10px]"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                        <SelectContent>{districts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
              </div>
              <PermissionMatrix selectedPerms={selectedPerms} selectedModules={selectedModules} onTogglePerm={handleTogglePerm} onToggleModuleAction={handleToggleModuleAction} onToggleColumn={handleToggleColumn} />
            </CardContent>
            <CardFooter className="bg-muted/30 border-t p-6">
                <Button type="submit" className="w-full h-16 font-black uppercase shadow-xl bg-black hover:bg-black/90" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : <UserPlus className="mr-3 h-6 w-6" />}
                    REGISTRAR USUARIO
                </Button>
            </CardFooter>
          </form>
        </Card>

        <Card className="shadow-lg border-none overflow-hidden rounded-xl bg-white">
            <CardHeader className="bg-primary text-white py-4 px-6 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                    <Users className="h-4 w-4" /> Usuarios del Sistema
                </CardTitle>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
                    <Input placeholder="Buscar..." className="h-9 pl-9 text-[10px] bg-white/10 border-none text-white rounded-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="text-[9px] font-black uppercase px-6">Funcionario</TableHead>
                            <TableHead className="text-[9px] font-black uppercase">Rol</TableHead>
                            <TableHead className="text-[9px] font-black uppercase">Estado</TableHead>
                            <TableHead className="text-right text-[9px] font-black uppercase px-6">Acción</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoadingUsers ? <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="animate-spin mx-auto h-6 w-6 text-primary"/></TableCell></TableRow> : 
                        filteredUsers.map(u => (
                            <TableRow key={u.id}>
                                <TableCell className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="font-black text-xs uppercase">{u.username}</span>
                                        <span className="text-[9px] text-muted-foreground">{u.email}</span>
                                    </div>
                                </TableCell>
                                <TableCell><Badge variant="secondary" className="text-[8px] font-black uppercase">{u.role}</Badge></TableCell>
                                <TableCell>
                                    <Badge className={cn("text-[8px] font-black uppercase", u.active !== false ? "bg-green-600" : "bg-red-600")}>
                                        {u.active !== false ? "ACTIVO" : "INACTIVO"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right px-6">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingUser(u); setEditModalOpen(true); }}><Edit className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className={cn("h-8 w-8", u.active !== false ? "text-amber-600" : "text-green-600")} onClick={() => toggleUserStatus(u)}>
                                            {u.active !== false ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="rounded-2xl">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle className="font-black uppercase">¿Eliminar usuario?</AlertDialogTitle>
                                                    <AlertDialogDescription className="text-xs">Esta acción borrará permanentemente el perfil de {u.username}.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel className="font-bold text-[10px] uppercase">Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteUser(u)} className="bg-destructive font-black text-[10px] uppercase">Eliminar</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </main>

      <Dialog open={isEditModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden">
          {editingUser && (
            <form onSubmit={handleUpdateUser} className="flex flex-col h-full bg-white">
              <DialogHeader className="p-6 bg-black text-white shrink-0">
                <div className="flex justify-between items-center">
                    <DialogTitle className="text-xl font-black uppercase">Editar Perfil</DialogTitle>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" className="font-black uppercase text-[9px] h-8 bg-transparent text-white" onClick={() => handleApplyJefeProfile(true)}>PERFIL JEFE</Button>
                    </div>
                </div>
              </DialogHeader>
              <ScrollArea className="flex-1 p-8">
                <div className="space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Nombre</Label><Input value={editingUser.username} onChange={(e) => setEditingUser({...editingUser, username: e.target.value})} className="font-bold h-11 border-2 uppercase" /></div>
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Rol</Label>
                            <select value={editingUser.role} onChange={(e) => setEditingUser({...editingUser, role: e.target.value as any})} className="w-full h-11 border-2 rounded-md font-black uppercase text-[10px] px-3 bg-white">
                                <option value="admin">ADMIN</option>
                                <option value="director">DIRECTOR</option>
                                <option value="coordinador">COORDINADOR</option>
                                <option value="jefe">JEFE</option>
                                <option value="funcionario">FUNCIONARIO</option>
                                <option value="viewer">VIEWER</option>
                            </select>
                        </div>
                    </div>
                    <Separator />
                    <PermissionMatrix userObj={editingUser} isEditing={true} selectedPerms={selectedPerms} selectedModules={selectedModules} onTogglePerm={handleTogglePerm} onToggleModuleAction={handleToggleModuleAction} onToggleColumn={handleToggleColumn} />
                </div>
              </ScrollArea>
              <DialogFooter className="p-6 bg-muted/30 border-t">
                <Button type="submit" disabled={isSubmitting} className="w-full h-14 font-black uppercase bg-black hover:bg-black/90">
                    {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : "ACTUALIZAR MATRIZ"}
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
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>}>
      <UsersContent />
    </Suspense>
  );
}