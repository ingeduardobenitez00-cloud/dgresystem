
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '@/components/header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, EyeOff, UserPlus, Users, Loader2, Edit, Trash2, Search, X, ShieldCheck, ShieldAlert, MapPin, Globe, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useFirebase, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { collection, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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

type UserProfile = {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'director' | 'jefe' | 'funcionario' | 'viewer';
  modules: string[];
  permissions: string[];
  departamento?: string;
  distrito?: string;
};

const ALL_MODULES = [
  'solicitud-capacitacion',
  'divulgadores',
  'agenda-capacitacion',
  'control-movimiento-maquinas',
  'denuncia-lacres',
  'encuesta-satisfaccion',
  'informe-divulgador',
  'informe-semanal-puntos-fijos',
  'estadisticas-capacitacion',
  'ficha',
  'fotos',
  'cargar-ficha',
  'resumen',
  'informe-general',
  'locales-votacion',
  'cargar-fotos-locales',
  'importar-reportes',
  'importar-locales',
  'importar-partidos',
  'users',
  'settings'
];

const MODULE_LABELS: { [key: string]: string } = {
  'solicitud-capacitacion': 'Anexo V - Solicitud',
  'divulgadores': 'Directorio Divulgadores',
  'agenda-capacitacion': 'Agenda de Actividades',
  'control-movimiento-maquinas': 'Movimiento de Máquinas',
  'denuncia-lacres': 'Denuncia de Lacres',
  'encuesta-satisfaccion': 'Encuesta Satisfacción',
  'informe-divulgador': 'Anexo III - Informe Div.',
  'informe-semanal-puntos-fijos': 'Anexo IV - Inf. Semanal',
  'estadisticas-capacitacion': 'Estadísticas CIDEE',
  'ficha': 'Vista de Ficha',
  'fotos': 'Imágenes',
  'cargar-ficha': 'Cargar Ficha',
  'resumen': 'Resumen Ubicaciones',
  'informe-general': 'Informe General PDF',
  'locales-votacion': 'Buscador de Locales',
  'cargar-fotos-locales': 'Carga Fotos Lote',
  'importar-reportes': 'Importar Reportes',
  'importar-locales': 'Importar Locales',
  'importar-partidos': 'Importar Partidos',
  'users': 'Usuarios',
  'settings': 'Configuración'
};

const MODULE_GROUPS = [
  {
    label: "CIDEE - CAPACITACIONES",
    modules: ['solicitud-capacitacion', 'divulgadores', 'agenda-capacitacion', 'control-movimiento-maquinas', 'denuncia-lacres', 'encuesta-satisfaccion', 'informe-divulgador', 'informe-semanal-puntos-fijos', 'estadisticas-capacitacion']
  },
  {
    label: "REGISTROS ELECTORALES",
    modules: ['ficha', 'fotos', 'cargar-ficha']
  },
  {
    label: "ANÁLISIS Y REPORTES",
    modules: ['resumen', 'informe-general']
  },
  {
    label: "LOCALES DE VOTACIÓN",
    modules: ['locales-votacion', 'cargar-fotos-locales']
  },
  {
    label: "GESTIÓN DE DATOS",
    modules: ['importar-reportes', 'importar-locales', 'importar-partidos']
  },
  {
    label: "SISTEMA",
    modules: ['users', 'settings']
  },
];

const ACTIONS = [
    { id: 'view', label: 'VER' },
    { id: 'add', label: 'GUARDAR' },
    { id: 'edit', label: 'EDITAR' },
    { id: 'delete', label: 'BORRAR' },
    { id: 'pdf', label: 'PDF' },
];

const GLOBAL_PERMISSIONS = ['admin_filter', 'assign_staff'];

/**
 * Plantillas de permisos por defecto para cada rol.
 * Al seleccionar un rol, el sistema marcará estos módulos automáticamente.
 */
const ROLE_DEFAULTS: Record<UserProfile['role'], { modules: string[], permissions: string[] }> = {
  admin: {
    modules: ALL_MODULES,
    permissions: [...GLOBAL_PERMISSIONS, ...ALL_MODULES.flatMap(m => ACTIONS.map(a => `${m}:${a.id}`))]
  },
  director: {
    modules: ALL_MODULES.filter(m => !['users', 'settings'].includes(m)),
    permissions: ['admin_filter', ...ALL_MODULES.flatMap(m => [`${m}:view`, `${m}:pdf`])]
  },
  jefe: {
    modules: ['solicitud-capacitacion', 'divulgadores', 'agenda-capacitacion', 'control-movimiento-maquinas', 'denuncia-lacres', 'encuesta-satisfaccion', 'informe-divulgador', 'informe-semanal-puntos-fijos', 'estadisticas-capacitacion'],
    permissions: ['assign_staff', 'solicitud-capacitacion:view', 'solicitud-capacitacion:add', 'divulgadores:view', 'divulgadores:add', 'agenda-capacitacion:view', 'informe-divulgador:view', 'informe-divulgador:add', 'informe-semanal-puntos-fijos:view', 'informe-semanal-puntos-fijos:add', 'informe-semanal-puntos-fijos:pdf']
  },
  funcionario: {
    modules: ['ficha', 'fotos', 'cargar-ficha', 'locales-votacion', 'cargar-fotos-locales', 'solicitud-capacitacion'],
    permissions: ['ficha:view', 'ficha:edit', 'fotos:view', 'fotos:add', 'locales-votacion:view', 'solicitud-capacitacion:add']
  },
  viewer: {
    modules: ['resumen', 'estadisticas-capacitacion', 'locales-votacion'],
    permissions: ['resumen:view', 'estadisticas-capacitacion:view', 'locales-votacion:view']
  }
};

export default function UsersPage() {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { user: currentUser, isUserLoading } = useUser();

  const usersQuery = useMemoFirebase(() => (firestore && currentUser?.profile?.role === 'admin' ? collection(firestore, 'users') : null), [firestore, currentUser]);
  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);
  const datosQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'datos') : null), [firestore]);
  const { data: datosData } = useCollection<Dato>(datosQuery);

  const [searchTerm, setSearchTerm] = useState('');
  
  // Registration States
  const [regDepartamento, setRegDepartamento] = useState<string>('');
  const [regDistrito, setRegDistrito] = useState<string>('');
  const [regRole, setRegRole] = useState<UserProfile['role']>('viewer');
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());

  // Editing States
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editRole, setEditRole] = useState<UserProfile['role']>();
  const [editDepartamento, setEditDepartamento] = useState<string>('');
  const [editDistrito, setEditDistrito] = useState<string>('');
  const [editSelectedModules, setEditSelectedModules] = useState<Set<string>>(new Set());
  const [editSelectedPerms, setEditSelectedPerms] = useState<Set<string>>(new Set());

  const [isSubmitting, setIsSubmitting] = useState(false);

  const departments = useMemo(() => {
    if (!datosData) return [];
    return [...new Set(datosData.map(d => d.departamento))].sort();
  }, [datosData]);

  const regDistricts = useMemo(() => {
    if (!datosData || !regDepartamento) return [];
    return [...new Set(datosData.filter(d => d.departamento === regDepartamento).map(d => d.distrito))].sort();
  }, [datosData, regDepartamento]);

  const editDistricts = useMemo(() => {
    if (!datosData || !editDepartamento) return [];
    return [...new Set(datosData.filter(d => d.departamento === editDepartamento).map(d => d.distrito))].sort();
  }, [datosData, editDepartamento]);

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!searchTerm.trim()) return users;

    const term = searchTerm.toLowerCase().trim();
    return users.filter(u => 
      u.username.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.role.toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

  // Aplicar sugerencias de rol automáticamente
  const applyRoleDefaults = (role: UserProfile['role'], isEdit: boolean = false) => {
    const defaults = ROLE_DEFAULTS[role];
    if (!defaults) return;

    if (isEdit) {
      setEditSelectedModules(new Set(defaults.modules));
      setEditSelectedPerms(new Set(defaults.permissions));
    } else {
      setSelectedModules(new Set(defaults.modules));
      setSelectedPerms(new Set(defaults.permissions));
    }
    
    toast({
      title: "Plantilla aplicada",
      description: `Se han sugerido permisos para el rol de ${role.toUpperCase()}.`,
    });
  };

  const toggleModule = (mod: string, isEdit: boolean = false) => {
    if (isEdit) {
      const next = new Set(editSelectedModules);
      if (next.has(mod)) {
        next.delete(mod);
        // Quitar también todos los permisos asociados
        const nextPerms = new Set(editSelectedPerms);
        ACTIONS.forEach(a => nextPerms.delete(`${mod}:${a.id}`));
        setEditSelectedPerms(nextPerms);
      } else {
        next.add(mod);
        // Por defecto añadir permiso de Ver
        const nextPerms = new Set(editSelectedPerms);
        nextPerms.add(`${mod}:view`);
        setEditSelectedPerms(nextPerms);
      }
      setEditSelectedModules(next);
    } else {
      const next = new Set(selectedModules);
      if (next.has(mod)) {
        next.delete(mod);
        const nextPerms = new Set(selectedPerms);
        ACTIONS.forEach(a => nextPerms.delete(`${mod}:${a.id}`));
        setSelectedPerms(nextPerms);
      } else {
        next.add(mod);
        const nextPerms = new Set(selectedPerms);
        nextPerms.add(`${mod}:view`);
        setSelectedPerms(nextPerms);
      }
      setSelectedModules(next);
    }
  };

  const togglePermission = (perm: string, mod: string, isEdit: boolean = false) => {
    if (isEdit) {
      const next = new Set(editSelectedPerms);
      if (next.has(perm)) {
        next.delete(perm);
      } else {
        next.add(perm);
        // Si se marca un permiso específico, asegurar que el módulo esté marcado
        const nextModules = new Set(editSelectedModules);
        nextModules.add(mod);
        setEditSelectedModules(nextModules);
      }
      setEditSelectedPerms(next);
    } else {
      const next = new Set(selectedPerms);
      if (next.has(perm)) {
        next.delete(perm);
      } else {
        next.add(perm);
        const nextModules = new Set(selectedModules);
        nextModules.add(mod);
        setSelectedModules(nextModules);
      }
      setSelectedPerms(next);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!firestore || !currentUser) return;

    setIsSubmitting(true);
    const formData = new FormData(form);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const username = formData.get('username') as string;

    const newUserProfile: Omit<UserProfile, 'id'> = { 
      username: username.toUpperCase(), 
      email, 
      role: regRole, 
      modules: Array.from(selectedModules), 
      permissions: Array.from(selectedPerms), 
      departamento: regDepartamento || '', 
      distrito: regDistrito || ''
    };

    const tempAppName = 'temp-creation-' + Math.random().toString(36).substring(7);
    let tempApp: FirebaseApp | undefined = undefined;

    try {
      tempApp = initializeApp(firebaseConfig, tempAppName);
      const tempAuth = getAuth(tempApp);
      const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
      await setDoc(doc(firestore, 'users', userCredential.user.uid), newUserProfile);
      await signOut(tempAuth);
      toast({ title: 'Usuario Creado' });
      form.reset();
      setRegDepartamento('');
      setRegDistrito('');
      setRegRole('viewer');
      setSelectedModules(new Set());
      setSelectedPerms(new Set());
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      if (tempApp) await deleteApp(tempApp);
      setIsSubmitting(false);
    }
  };
  
  const handleOpenEditModal = (user: UserProfile) => {
    setEditingUser(user);
    setEditRole(user.role);
    setEditDepartamento(user.departamento || '');
    setEditDistrito(user.distrito || '');
    setEditSelectedModules(new Set(user.modules || []));
    setEditSelectedPerms(new Set(user.permissions || []));
    setEditModalOpen(true);
  };

  const handleUpdateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore || !editingUser) return;
    setIsSubmitting(true);
    
    const isRegionalRole = editRole !== 'admin' && editRole !== 'director';
    const updatedFields = { 
      role: editRole, 
      modules: Array.from(editSelectedModules), 
      permissions: Array.from(editSelectedPerms), 
      departamento: isRegionalRole ? editDepartamento : editDepartamento || '', 
      distrito: isRegionalRole ? editDistrito : editDistrito || '' 
    };
    
    try {
      await updateDoc(doc(firestore, 'users', editingUser.id), updatedFields);
      toast({ title: 'Perfil Actualizado' });
      setEditModalOpen(false);
    } catch (error) {
       toast({ title: 'Error', variant: 'destructive' });
    } finally { setIsSubmitting(false); }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!firestore || !currentUser) return;
    try {
      await deleteDoc(doc(firestore, 'users', userId));
      toast({ title: 'Usuario eliminado exitosamente' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error al eliminar', description: error.message });
    }
  };

  const PermissionRow = ({ mod, isEdit = false }: { mod: string, isEdit?: boolean }) => {
    const curModules = isEdit ? editSelectedModules : selectedModules;
    const curPerms = isEdit ? editSelectedPerms : selectedPerms;

    return (
        <div className="grid grid-cols-12 gap-2 items-center py-2 px-3 border-b hover:bg-muted/30 transition-colors">
            <div className="col-span-2">
                <p className="font-bold text-[10px] uppercase tracking-tighter truncate">{MODULE_LABELS[mod] || mod}</p>
            </div>
            <div className="col-span-2 flex justify-center">
                <Checkbox 
                  checked={curModules.has(mod)} 
                  onCheckedChange={() => toggleModule(mod, isEdit)} 
                />
            </div>
            {ACTIONS.filter(a => a.id !== 'view').map(action => (
                <div key={action.id} className="col-span-2 flex justify-center">
                    <Checkbox 
                      checked={curPerms.has(`${mod}:${action.id}`)} 
                      onCheckedChange={() => togglePermission(`${mod}:${action.id}`, mod, isEdit)} 
                    />
                </div>
            ))}
        </div>
    );
  };

  const PermissionHeader = () => (
    <div className="grid grid-cols-12 gap-2 w-full text-center py-2 px-3 bg-muted/50 border-b">
        <div className="col-span-2"></div>
        {ACTIONS.map(action => (
            <div key={action.id} className="col-span-2 text-[9px] font-black uppercase text-primary">{action.label}</div>
        ))}
    </div>
  );

  const isGeoMandatory = (role: string) => {
    return role === 'jefe' || role === 'funcionario';
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted/5">
      <Header title="Gestión de Usuarios" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        <Card className="border-t-4 border-t-primary shadow-lg">
          <form onSubmit={handleSubmit}>
            <CardHeader className="bg-muted/30 border-b">
              <div className="flex justify-between items-center">
                <CardTitle className="uppercase font-black text-primary text-sm">NUEVO USUARIO Y MATRIZ DE PERMISOS</CardTitle>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="text-[9px] font-black uppercase h-8 border-primary/20 text-primary"
                    onClick={() => applyRoleDefaults(regRole)}
                  >
                    <Sparkles className="h-3 w-3 mr-1.5" /> Sugerir permisos
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-8 pt-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Nombre y Apellido</Label>
                  <Input name="username" required className="font-bold uppercase" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Correo Oficial</Label>
                  <Input name="email" type="email" required className="font-bold" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Contraseña Provisional</Label>
                  <Input name="password" type="password" required className="font-bold" />
                </div>
                
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">Rol Institucional</Label>
                    <Select 
                      name="role" 
                      required 
                      value={regRole} 
                      onValueChange={(v: any) => {
                        setRegRole(v);
                        applyRoleDefaults(v);
                      }}
                    >
                        <SelectTrigger className="font-bold h-11">
                        <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="director">Director</SelectItem>
                            <SelectItem value="jefe">Jefe de Oficina</SelectItem>
                            <SelectItem value="funcionario">Funcionario</SelectItem>
                            <SelectItem value="viewer">Visualizador</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase flex items-center gap-1">
                      <MapPin className="h-3 w-3"/> Departamento {isGeoMandatory(regRole) ? '*' : '(Opcional)'}
                    </Label>
                    <Select value={regDepartamento} onValueChange={(v) => { setRegDepartamento(v); setRegDistrito(''); }}>
                        <SelectTrigger className="font-bold h-11">
                            <SelectValue placeholder="Alcance Nacional" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="nacional" className="italic text-muted-foreground">--- NACIONAL ---</SelectItem>
                            {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase flex items-center gap-1">
                      <MapPin className="h-3 w-3"/> Distrito {isGeoMandatory(regRole) ? '*' : '(Opcional)'}
                    </Label>
                    <Select value={regDistrito} onValueChange={setRegDistrito} disabled={!regDepartamento || regDepartamento === 'nacional'}>
                        <SelectTrigger className="font-bold h-11">
                            <SelectValue placeholder="Elegir..." />
                        </SelectTrigger>
                        <SelectContent>
                            {regDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">ASIGNACIÓN DE MÓDULOS Y ACCIONES</Label>
                  <div className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="global-perm-admin_filter" 
                        name="global-perm-admin_filter" 
                        checked={selectedPerms.has('admin_filter')}
                        onCheckedChange={(checked) => {
                          const next = new Set(selectedPerms);
                          if(checked) next.add('admin_filter'); else next.delete('admin_filter');
                          setSelectedPerms(next);
                        }}
                      />
                      <label htmlFor="global-perm-admin_filter" className="text-[9px] font-black uppercase text-primary">Filtro Nacional</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="global-perm-assign_staff" 
                        name="global-perm-assign_staff" 
                        checked={selectedPerms.has('assign_staff')}
                        onCheckedChange={(checked) => {
                          const next = new Set(selectedPerms);
                          if(checked) next.add('assign_staff'); else next.delete('assign_staff');
                          setSelectedPerms(next);
                        }}
                      />
                      <label htmlFor="global-perm-assign_staff" className="text-[9px] font-black uppercase text-primary">Asignar Personal</label>
                    </div>
                  </div>
                </div>
                <Accordion type="multiple" className="w-full border rounded-xl overflow-hidden bg-white">
                    {MODULE_GROUPS.map((group, idx) => (
                        <AccordionItem value={`group-${idx}`} key={group.label}>
                            <AccordionTrigger className="hover:no-underline py-4 px-5 text-[10px] font-black uppercase text-primary bg-muted/10">
                                {group.label}
                            </AccordionTrigger>
                            <AccordionContent className="p-0">
                                <PermissionHeader />
                                <div className="divide-y">
                                    {group.modules.map(module => (
                                        <PermissionRow key={module} mod={module} />
                                    ))}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 border-t p-6">
              <Button type="submit" className="w-full h-12 font-black uppercase shadow-lg" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : "REGISTRAR USUARIO"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="uppercase font-black text-sm">Usuarios Activos en el Sistema</CardTitle>
            <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nombre..." className="pl-10 h-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-t bg-white overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                    <TableRow>
                        <TableHead className="text-[10px] font-black uppercase">Usuario</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">Jurisdicción</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">Rol</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase">Acciones</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {isLoadingUsers ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow>
                    ) : filteredUsers.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-10 font-bold uppercase text-muted-foreground">No se encontraron usuarios.</TableCell></TableRow>
                    ) : filteredUsers.map((user) => (
                        <TableRow key={user.id} className="hover:bg-muted/30">
                            <TableCell className="py-4">
                                <p className="font-black text-xs uppercase">{user.username}</p>
                                <p className="text-[10px] text-muted-foreground">{user.email}</p>
                            </TableCell>
                            <TableCell>
                                {user.departamento ? (
                                    <div className="space-y-0.5">
                                        <p className="text-[9px] font-black uppercase text-primary leading-none">{user.departamento}</p>
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase leading-none">{user.distrito}</p>
                                    </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-blue-700">
                                    <Globe className="h-3 w-3" />
                                    <span className="text-[9px] font-black uppercase">Nacional</span>
                                  </div>
                                )}
                            </TableCell>
                            <TableCell><Badge variant="secondary" className="text-[8px] uppercase font-black px-2 py-0.5">{user.role}</Badge></TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditModal(user)}><Edit className="h-4 w-4" /></Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>¿Eliminar usuario permanentemente?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Esta acción removerá el acceso de <strong>{user.username}</strong> al sistema.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteUser(user.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                    Confirmar Eliminación
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
          </CardContent>
        </Card>
      </main>

      {editingUser && (
        <Dialog open={isEditModalOpen} onOpenChange={setEditModalOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl">
                <DialogHeader className="p-6 bg-primary text-white shrink-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <DialogTitle className="text-xl font-black uppercase">Editar Perfil: {editingUser.username}</DialogTitle>
                        <DialogDescription className="text-white/70 font-bold uppercase text-[10px]">Actualice el rol, jurisdicción y permisos del usuario.</DialogDescription>
                      </div>
                      <Button 
                        type="button" 
                        variant="secondary" 
                        size="sm" 
                        className="text-[9px] font-black uppercase"
                        onClick={() => applyRoleDefaults(editRole || 'viewer', true)}
                      >
                        <Sparkles className="h-3 w-3 mr-1.5" /> Reestablecer según rol
                      </Button>
                    </div>
                </DialogHeader>
                <form onSubmit={handleUpdateUser} className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-8 bg-background">
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase">Rol Institucional</Label>
                                    <Select 
                                      name="role" 
                                      required 
                                      value={editRole} 
                                      onValueChange={(v: any) => {
                                        setEditRole(v);
                                        applyRoleDefaults(v, true);
                                      }}
                                    >
                                        <SelectTrigger className="font-bold h-11">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="admin">Administrador</SelectItem>
                                            <SelectItem value="director">Director</SelectItem>
                                            <SelectItem value="jefe">Jefe de Oficina</SelectItem>
                                            <SelectItem value="funcionario">Funcionario</SelectItem>
                                            <SelectItem value="viewer">Visualizador</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase flex items-center gap-1">
                                      <MapPin className="h-3 w-3"/> Departamento {isGeoMandatory(editRole || '') ? '*' : '(Opcional)'}
                                    </Label>
                                    <Select value={editDepartamento} onValueChange={(v) => { setEditDepartamento(v === 'nacional' ? '' : v); setEditDistrito(''); }}>
                                        <SelectTrigger className="font-bold h-11">
                                            <SelectValue placeholder="Alcance Nacional" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="nacional" className="italic text-muted-foreground">--- NACIONAL ---</SelectItem>
                                            {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase flex items-center gap-1">
                                      <MapPin className="h-3 w-3"/> Distrito {isGeoMandatory(editRole || '') ? '*' : '(Opcional)'}
                                    </Label>
                                    <Select value={editDistrito} onValueChange={setEditDistrito} disabled={!editDepartamento || editDepartamento === ''}>
                                        <SelectTrigger className="font-bold h-11">
                                            <SelectValue placeholder="Elegir..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {editDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">PERMISOS DE ACCESO</Label>
                                  <div className="flex gap-4">
                                    <div className="flex items-center space-x-2">
                                      <Checkbox 
                                        id="edit-global-perm-admin_filter" 
                                        checked={editSelectedPerms.has('admin_filter')}
                                        onCheckedChange={(checked) => {
                                          const next = new Set(editSelectedPerms);
                                          if(checked) next.add('admin_filter'); else next.delete('admin_filter');
                                          setEditSelectedPerms(next);
                                        }}
                                      />
                                      <label htmlFor="edit-global-perm-admin_filter" className="text-[9px] font-black uppercase text-primary">Filtro Nacional</label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Checkbox 
                                        id="edit-global-perm-assign_staff" 
                                        checked={editSelectedPerms.has('assign_staff')}
                                        onCheckedChange={(checked) => {
                                          const next = new Set(editSelectedPerms);
                                          if(checked) next.add('assign_staff'); else next.delete('assign_staff');
                                          setEditSelectedPerms(next);
                                        }}
                                      />
                                      <label htmlFor="edit-global-perm-assign_staff" className="text-[9px] font-black uppercase text-primary">Asignar Personal</label>
                                    </div>
                                  </div>
                                </div>
                                <Accordion type="multiple" className="w-full border rounded-xl overflow-hidden bg-white">
                                    {MODULE_GROUPS.map((group, idx) => (
                                        <AccordionItem value={`edit-group-${idx}`} key={`edit-${group.label}`}>
                                            <AccordionTrigger className="hover:no-underline py-3 px-5 text-[10px] font-black uppercase text-primary bg-muted/10">
                                                {group.label}
                                            </AccordionTrigger>
                                            <AccordionContent className="p-0">
                                                <PermissionHeader />
                                                <div className="divide-y">
                                                    {group.modules.map(module => (
                                                        <PermissionRow key={module} mod={module} isEdit={true} />
                                                    ))}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="p-6 bg-muted/30 border-t">
                        <DialogClose asChild><Button variant="ghost" className="font-bold uppercase text-xs">CANCELAR</Button></DialogClose>
                        <Button type="submit" className="font-black uppercase shadow-lg px-10" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                            ACTUALIZAR PERFIL
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
