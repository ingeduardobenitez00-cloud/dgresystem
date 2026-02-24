
"use client";

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, EyeOff, UserPlus, Users, Loader2, Edit, Trash2, KeyRound, Search, X, ShieldCheck, ShieldAlert, FileDown } from 'lucide-react';
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
  'fotos', 
  'ficha', 
  'resumen', 
  'settings', 
  'users', 
  'cargar-ficha', 
  'informe-general', 
  'importar-reportes', 
  'importar-locales', 
  'locales-votacion', 
  'cargar-fotos-locales',
  'solicitud-capacitacion',
  'agenda-capacitacion',
  'divulgadores',
  'encuesta-satisfaccion',
  'informe-divulgador',
  'informe-semanal-puntos-fijos',
  'estadisticas-capacitacion',
  'importar-partidos',
  'control-movimiento-maquinas'
];

const MODULE_LABELS: { [key: string]: string } = {
  fotos: 'Imágenes',
  ficha: 'Vista de Ficha',
  resumen: 'Resumen Ubicaciones',
  settings: 'Configuración Sistema',
  users: 'Gestión de Usuarios',
  'cargar-ficha': 'Cargar Ficha Técnica',
  'informe-general': 'Informe General PDF',
  'importar-reportes': 'Importar Reportes Edilicios',
  'importar-locales': 'Importar Locales Votación',
  'locales-votacion': 'Buscador de Locales',
  'cargar-fotos-locales': 'Carga Masiva Fotos',
  'solicitud-capacitacion': 'Anexo V - Solicitud',
  'agenda-capacitacion': 'Agenda de Actividades',
  'divulgadores': 'Directorio Divulgadores',
  'encuesta-satisfaccion': 'Encuesta Satisfacción',
  'informe-divulgador': 'Anexo III - Informe Div.',
  'informe-semanal-puntos-fijos': 'Anexo IV - Inf. Semanal',
  'estadisticas-capacitacion': 'Estadísticas CIDEE',
  'importar-partidos': 'Importar Partidos Políticos',
  'control-movimiento-maquinas': 'Movimiento de Máquinas'
};

const MODULE_GROUPS = [
  {
    label: "CIDEE - CAPACITACIONES",
    modules: ['solicitud-capacitacion', 'agenda-capacitacion', 'divulgadores', 'encuesta-satisfaccion', 'informe-divulgador', 'informe-semanal-puntos-fijos', 'estadisticas-capacitacion']
  },
  {
    label: "DGRE",
    modules: ['control-movimiento-maquinas']
  },
  {
    label: "Registros Electorales",
    modules: ['ficha', 'fotos', 'cargar-ficha']
  },
  {
    label: "Análisis y Reportes",
    modules: ['resumen', 'informe-general']
  },
  {
    label: "Locales de Votación",
    modules: ['locales-votacion', 'cargar-fotos-locales']
  },
  {
    label: "Gestión de Datos",
    modules: ['importar-reportes', 'importar-locales', 'importar-partidos']
  },
  {
    label: "Sistema",
    modules: ['users', 'settings']
  },
];

const ACTIONS = [
    { id: 'view', label: 'Ver' },
    { id: 'add', label: 'Guardar' },
    { id: 'edit', label: 'Editar' },
    { id: 'delete', label: 'Borrar' },
    { id: 'pdf', label: 'PDF' },
];

const GLOBAL_PERMISSIONS = ['admin_filter', 'assign_staff'];
const GLOBAL_PERMISSION_LABELS: { [key: string]: string } = {
    admin_filter: 'Filtrar Todo el País',
    assign_staff: 'Asignar Personal en Agenda'
};

export default function UsersPage() {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { user: currentUser, isUserLoading } = useUser();

  const usersQuery = useMemoFirebase(() => (firestore && currentUser?.profile?.role === 'admin' ? collection(firestore, 'users') : null), [firestore, currentUser]);
  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);
  const datosQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'datos') : null), [firestore]);
  const { data: datosData } = useCollection<Dato>(datosQuery);

  const [searchTerm, setSearchTerm] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('viewer');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  const [editRole, setEditRole] = useState<UserProfile['role']>();
  const [editDept, setEditDept] = useState<string | undefined>('');
  const [editDist, setEditDist] = useState<string | undefined>('');

  useEffect(() => {
    if (datosData) {
      const uniqueDepts = [...new Set(datosData.map(d => d.departamento))].sort();
      setDepartments(uniqueDepts);
    }
  }, [datosData]);
  
  useEffect(() => {
    if (selectedDepartment && datosData) {
      const uniqueDistricts = [...new Set(datosData.filter(d => d.departamento === selectedDepartment).map(d => d.distrito))].sort();
      setDistricts(uniqueDistricts);
    } else {
      setDistricts([]);
    }
  }, [selectedDepartment, datosData]);

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!searchTerm.trim()) return users;

    const term = searchTerm.toLowerCase().trim();
    return users.filter(u => 
      u.username.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.role.toLowerCase().includes(term) ||
      (u.departamento?.toLowerCase().includes(term)) ||
      (u.distrito?.toLowerCase().includes(term))
    );
  }, [users, searchTerm]);

  const togglePasswordVisibility = () => {
    setPasswordVisible(!passwordVisible);
  };
  
  const processPermissions = (formData: FormData, isEdit: boolean = false) => {
    const prefix = isEdit ? 'edit-' : '';
    const modules: string[] = [];
    const permissions: string[] = [];

    ALL_MODULES.forEach(mod => {
        if (formData.get(`${prefix}access-${mod}`)) {
            modules.push(mod);
            permissions.push(`${mod}:view`);
        }
        ACTIONS.filter(a => a.id !== 'view').forEach(action => {
            if (formData.get(`${prefix}perm-${mod}-${action.id}`)) {
                permissions.push(`${mod}:${action.id}`);
            }
        });
    });

    GLOBAL_PERMISSIONS.forEach(perm => {
        if (formData.get(`${prefix}global-perm-${perm}`)) {
            permissions.push(perm);
        }
    });

    return { modules, permissions };
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
    const role = formData.get('role') as UserProfile['role'];
    const departamento = formData.get('departamento') as string;
    const distrito = formData.get('distrito') as string;

    const { modules, permissions } = processPermissions(formData);

    const newUserProfile: Omit<UserProfile, 'id'> = { 
      username, 
      email, 
      role, 
      modules, 
      permissions, 
      departamento, 
      distrito
    };

    const tempAppName = 'temp-user-creation-' + Math.random().toString(36).substring(7);
    let tempApp: FirebaseApp | undefined = undefined;

    try {
      tempApp = initializeApp(firebaseConfig, tempAppName);
      const tempAuth = getAuth(tempApp);

      const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
      const user = userCredential.user;

      await setDoc(doc(firestore, 'users', user.uid), newUserProfile);
      await signOut(tempAuth);

      toast({ title: 'Usuario Creado' });
      form.reset();
      setSelectedDepartment('');
      setSelectedRole('viewer');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error al crear usuario', description: error.message });
    } finally {
      if (tempApp) await deleteApp(tempApp);
      setIsSubmitting(false);
    }
  };
  
  const handleOpenEditModal = (user: UserProfile) => {
    setEditingUser(user);
    setEditRole(user.role);
    setEditDept(user.departamento || '');
    setEditDist(user.distrito || '');
    setSelectedDepartment(user.departamento || '');
    setEditModalOpen(true);
  };

  const handleUpdateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore || !editingUser || !currentUser) return;

    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const role = formData.get('role') as UserProfile['role'];
    const departamento = formData.get('departamento') as string;
    const distrito = formData.get('distrito') as string;
    
    const { modules, permissions } = processPermissions(formData, true);
    
    const updatedFields: any = { 
      role, 
      modules, 
      permissions, 
      departamento, 
      distrito
    };

    try {
      await updateDoc(doc(firestore, 'users', editingUser.id), updatedFields);
      toast({ title: 'Usuario Actualizado' });
      setEditModalOpen(false);
      setEditingUser(null);
    } catch (error) {
       toast({ title: 'Error al actualizar', variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!firestore || !currentUser) return;
    try {
        await deleteDoc(doc(firestore, 'users', userId));
        toast({ title: 'Usuario Eliminado' });
    } catch (error) {
        toast({ title: 'Error al eliminar', variant: 'destructive' });
    }
  };

  const PermissionRow = ({ mod, isEdit = false }: { mod: string, isEdit?: boolean }) => {
    const prefix = isEdit ? 'edit-' : '';
    const user = editingUser;
    
    return (
        <div className="grid grid-cols-12 gap-2 items-center py-2 px-3 border-b border-muted/50 hover:bg-muted/30 transition-colors last:border-0">
            <div className="col-span-2">
                <p className="font-bold text-[10px] uppercase tracking-tighter truncate">{MODULE_LABELS[mod] || mod}</p>
            </div>
            <div className="col-span-2 flex justify-center">
                <Checkbox 
                    id={`${prefix}access-${mod}`} 
                    name={`${prefix}access-${mod}`} 
                    defaultChecked={isEdit ? user?.modules?.includes(mod) : false} 
                />
            </div>
            {ACTIONS.filter(a => a.id !== 'view').map(action => (
                <div key={action.id} className="col-span-2 flex justify-center">
                    <Checkbox 
                        id={`${prefix}perm-${mod}-${action.id}`} 
                        name={`${prefix}perm-${mod}-${action.id}`} 
                        defaultChecked={isEdit ? user?.permissions?.includes(`${mod}:${action.id}`) : false}
                    />
                </div>
            ))}
        </div>
    );
  };

  const PermissionHeader = () => (
    <div className="grid grid-cols-12 gap-2 w-full text-center py-2 px-3 bg-muted/50 border-b border-muted">
        <div className="col-span-2"></div>
        {ACTIONS.map(action => (
            <div key={action.id} className="col-span-2 text-[9px] font-black uppercase text-primary">
                {action.label}
            </div>
        ))}
    </div>
  );

  if (isUserLoading) {
    return (
      <div className="flex min-h-screen w-full flex-col">
        <Header title="Gestión de Usuarios" />
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/5">
      <Header title="Gestión de Usuarios" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        <Card className="border-t-4 border-t-primary shadow-lg overflow-hidden">
          <form onSubmit={handleSubmit}>
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="flex items-center gap-2 uppercase font-black text-primary">
                <UserPlus className="h-5 w-5" />
                Crear Nuevo Usuario Sistema
              </CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase">
                Defina los datos básicos y la matriz de permisos para el nuevo ingreso.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 pt-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-[10px] font-black uppercase text-muted-foreground">Nombre de Usuario</Label>
                  <Input id="username" name="username" placeholder="ej. juanperez" required className="font-bold" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[10px] font-black uppercase text-muted-foreground">Correo Electrónico</Label>
                  <Input id="email" name="email" type="email" placeholder="ej. juan.perez@dominio.com" required className="font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-[10px] font-black uppercase text-muted-foreground">Contraseña Provisional</Label>
                  <div className="relative">
                    <Input id="password" name="password" type={passwordVisible ? 'text' : 'password'} placeholder="••••••••" required className="font-bold" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute inset-y-0 right-0 h-full w-10 text-muted-foreground"
                      onClick={togglePasswordVisibility}
                    >
                      {passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="role" className="text-[10px] font-black uppercase text-muted-foreground">Rol Jerárquico</Label>
                    <Select name="role" required defaultValue="viewer" onValueChange={setSelectedRole}>
                        <SelectTrigger id="role" className="font-bold">
                        <SelectValue placeholder="Seleccionar un rol" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="admin">Administrador (Nacional)</SelectItem>
                            <SelectItem value="director">Director</SelectItem>
                            <SelectItem value="jefe">Jefe de Oficina</SelectItem>
                            <SelectItem value="funcionario">Funcionario Operativo</SelectItem>
                            <SelectItem value="viewer">Visualizador / Observador</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                    <ShieldCheck className="h-3 w-3" /> Asignación Territorial
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                          <Label htmlFor="departamento" className="text-[10px] font-bold uppercase text-muted-foreground">Departamento</Label>
                          <Select name="departamento" onValueChange={setSelectedDepartment}>
                              <SelectTrigger className="font-bold">
                                  <SelectValue placeholder="Elegir dpto..."/>
                              </SelectTrigger>
                              <SelectContent>
                                  {departments.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="distrito" className="text-[10px] font-bold uppercase text-muted-foreground">Distrito / Oficina</Label>
                          <Select name="distrito" disabled={!selectedDepartment}>
                              <SelectTrigger className="font-bold">
                                  <SelectValue placeholder="Elegir distrito..."/>
                              </SelectTrigger>
                              <SelectContent>
                                  {districts.map(dist => <SelectItem key={dist} value={dist}>{dist}</SelectItem>)}
                              </SelectContent>
                          </Select>
                      </div>
                  </div>
              </div>
              
              <Separator />

              <div className="space-y-6">
                <Label className="text-sm font-black uppercase tracking-tight text-primary block">Matriz de Módulos y Permisos</Label>
                
                <Accordion type="multiple" className="w-full border rounded-xl overflow-hidden bg-white shadow-sm">
                    {MODULE_GROUPS.map((group, idx) => (
                        <AccordionItem value={`group-${idx}`} key={group.label} className="border-b last:border-b-0">
                            <AccordionTrigger className="hover:no-underline py-4 px-5 text-[10px] font-black uppercase text-primary bg-muted/10">
                                {group.label}
                            </AccordionTrigger>
                            <AccordionContent className="p-0">
                                <PermissionHeader />
                                <div className="divide-y divide-muted/30">
                                    {group.modules.map(module => (
                                        <PermissionRow key={module} mod={module} />
                                    ))}
                                </div>
                                {group.label === 'Sistema' && (
                                    <div className="p-5 bg-primary/5">
                                        <Label className="text-[10px] font-black uppercase text-primary tracking-widest mb-4 block">Permisos de Supervisión Global</Label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {GLOBAL_PERMISSIONS.map(permission => (
                                                <div key={permission} className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-primary/10">
                                                    <Checkbox id={`global-perm-${permission}`} name={`global-perm-${permission}`} />
                                                    <Label htmlFor={`global-perm-${permission}`} className="font-bold text-[10px] uppercase cursor-pointer">
                                                        {GLOBAL_PERMISSION_LABELS[permission] || permission}
                                                    </Label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
              </div>

            </CardContent>
            <CardFooter className="bg-muted/30 border-t p-6">
              <Button type="submit" className="w-full h-14 font-black uppercase text-lg shadow-xl" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "REGISTRAR EN BASE DE DATOS"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card className="shadow-lg border-none">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 uppercase font-black text-primary">
                        <Users className="h-5 w-5" />
                        Nómina de Usuarios Activos
                    </CardTitle>
                    <Badge variant="outline" className="text-[9px] font-black uppercase">{filteredUsers.length} Usuarios Registrados</Badge>
                </div>
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Buscar usuario o departamento..." 
                        className="pl-10 h-11 text-xs font-bold border-2"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingUsers ? (
                <div className="flex justify-center items-center h-48"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
            ) : (
                <div className="overflow-x-auto border rounded-xl bg-white">
                    <Table>
                        <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="text-[10px] font-black uppercase">Usuario</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Correo Acceso</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Jurisdicción</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Rol</TableHead>
                            <TableHead className="text-right text-[10px] font-black uppercase">Acciones</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {filteredUsers.length > 0 ? (
                            filteredUsers.map((user) => (
                            <TableRow key={user.id} className="group/row hover:bg-muted/20 transition-colors">
                                <TableCell className="font-black text-xs uppercase leading-tight">
                                    {user.username}
                                </TableCell>
                                <TableCell className="text-xs font-medium">{user.email}</TableCell>
                                <TableCell className="text-[9px] font-bold uppercase leading-tight">
                                    {user.departamento || '-'}<br/>
                                    <span className="text-muted-foreground font-normal">{user.distrito || ''}</span>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="capitalize text-[9px] font-black uppercase tracking-widest">{user.role}</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button variant="outline" size="icon" className="h-8 w-8 hover:bg-primary hover:text-white border-primary/20" onClick={() => handleOpenEditModal(user)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle className="uppercase font-black text-destructive flex items-center gap-2">
                                                        <ShieldAlert className="h-5 w-5" /> ¿Eliminar Registro?
                                                    </AlertDialogTitle>
                                                    <AlertDialogDescription className="text-xs uppercase font-bold">
                                                        Dará de baja permanentemente a {user.username}. Esta acción es irreversible.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel className="uppercase font-bold text-xs">Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteUser(user.id)} className="bg-destructive hover:bg-destructive/90 uppercase font-black text-xs">Confirmar Baja</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </TableCell>
                            </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="h-32 text-center text-xs font-bold uppercase text-muted-foreground border-dashed">
                                    No se encontraron usuarios registrados.
                                </TableCell>
                            </TableRow>
                        )}
                        </TableBody>
                    </Table>
                </div>
            )}
          </CardContent>
        </Card>

      </main>
      
      {editingUser && (
        <Dialog open={isEditModalOpen} onOpenChange={setEditModalOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 bg-primary text-white shrink-0">
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight">Editar Perfil de Usuario</DialogTitle>
                    <DialogDescription className="text-white/70 font-bold uppercase text-[10px]">
                        ID de Sistema: {editingUser.id} | Correo: {editingUser.email}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleUpdateUser} className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-8 bg-background">
                        <div className="space-y-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-role" className="text-[10px] font-black uppercase text-primary">Rol Institucional</Label>
                                    <Select name="role" required value={editRole} onValueChange={(value: UserProfile['role']) => {
                                        setEditRole(value);
                                        if (value === 'admin' || value === 'director' || value === 'jefe') {
                                            setEditDept('');
                                            setEditDist('');
                                            setSelectedDepartment('');
                                        }
                                    }}>
                                        <SelectTrigger id="edit-role" className="font-bold border-2 h-12">
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
                            </div>

                            <Separator />
                            
                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                    <ShieldCheck className="h-3 w-3" /> Jurisdicción Asignada
                                </Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="departamento-edit" className="text-[10px] font-bold uppercase text-muted-foreground">Departamento</Label>
                                        <Select name="departamento" value={editDept} onValueChange={(value) => {
                                            setEditDept(value);
                                            setEditDist('');
                                            setSelectedDepartment(value);
                                        }}>
                                            <SelectTrigger className="font-bold h-11">
                                                <SelectValue placeholder="Seleccionar dpto..."/>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {departments.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="distrito-edit" className="text-[10px] font-bold uppercase text-muted-foreground">Distrito / Oficina</Label>
                                        <Select name="distrito" value={editDist} onValueChange={setEditDist} disabled={!selectedDepartment}>
                                            <SelectTrigger className="font-bold h-11">
                                                <SelectValue placeholder="Seleccionar distrito..."/>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {districts.map(dist => <SelectItem key={dist} value={dist}>{dist}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-6">
                                <Label className="text-sm font-black uppercase tracking-tight text-primary block">Matriz de Módulos y Permisos</Label>
                                <Accordion type="multiple" className="w-full border rounded-xl overflow-hidden shadow-sm">
                                    {MODULE_GROUPS.map((group, idx) => (
                                        <AccordionItem value={`edit-group-${idx}`} key={`edit-${group.label}`} className="border-b last:border-b-0">
                                            <AccordionTrigger className="hover:no-underline py-3 px-5 text-[10px] font-black uppercase text-primary bg-muted/10">
                                                {group.label}
                                            </AccordionTrigger>
                                            <AccordionContent className="p-0">
                                                <PermissionHeader />
                                                <div className="divide-y divide-muted/30">
                                                    {group.modules.map(module => (
                                                        <PermissionRow key={module} mod={module} isEdit={true} />
                                                    ))}
                                                </div>
                                                {group.label === 'Sistema' && (
                                                    <div className="p-5 bg-primary/5">
                                                        <Label className="text-[10px] font-black uppercase text-primary tracking-widest mb-4 block">Permisos de Supervisión Global</Label>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            {GLOBAL_PERMISSIONS.map(permission => (
                                                                <div key={permission} className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-primary/10">
                                                                    <Checkbox id={`edit-global-perm-${permission}`} name={`edit-global-perm-${permission}`} defaultChecked={editingUser.permissions?.includes(permission)} />
                                                                    <Label htmlFor={`edit-global-perm-${permission}`} className="font-bold text-[10px] uppercase cursor-pointer">
                                                                        {GLOBAL_PERMISSION_LABELS[permission] || permission}
                                                                    </Label>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="p-6 bg-muted/30 border-t gap-3 shrink-0">
                        <DialogClose asChild>
                            <Button type="button" variant="outline" className="uppercase font-bold h-12 px-8">Cancelar</Button>
                        </DialogClose>
                        <Button type="submit" className="h-12 font-black uppercase flex-1 shadow-lg text-lg" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "ACTUALIZAR PERFIL"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
