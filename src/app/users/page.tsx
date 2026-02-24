"use client";

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, EyeOff, UserPlus, Users, Loader2, Edit, Trash2, Search, X, ShieldCheck, ShieldAlert } from 'lucide-react';
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
  'encuesta-satisfaccion',
  'informe-divulgador',
  'informe-semanal-puntos-fijos',
  'estadisticas-capacitacion',
  'control-movimiento-maquinas',
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
  'encuesta-satisfaccion': 'Encuesta Satisfacción',
  'informe-divulgador': 'Anexo III - Informe Div.',
  'informe-semanal-puntos-fijos': 'Anexo IV - Inf. Semanal',
  'estadisticas-capacitacion': 'Estadísticas CIDEE',
  'control-movimiento-maquinas': 'Movimiento de Máquinas',
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
    modules: ['solicitud-capacitacion', 'divulgadores', 'agenda-capacitacion', 'control-movimiento-maquinas', 'encuesta-satisfaccion', 'informe-divulgador', 'informe-semanal-puntos-fijos', 'estadisticas-capacitacion']
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
    { id: 'view', label: 'VER' },
    { id: 'add', label: 'GUARDAR' },
    { id: 'edit', label: 'EDITAR' },
    { id: 'delete', label: 'BORRAR' },
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
      u.role.toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

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
    setEditDept(user.departamento || '');
    setEditDist(user.distrito || '');
    setSelectedDepartment(user.departamento || '');
    setEditModalOpen(true);
  };

  const handleUpdateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore || !editingUser) return;
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const { modules, permissions } = processPermissions(formData, true);
    const updatedFields = { 
      role: formData.get('role') as any, 
      modules, 
      permissions, 
      departamento: formData.get('departamento') as string, 
      distrito: formData.get('distrito') as string 
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
    const prefix = isEdit ? 'edit-' : '';
    const user = editingUser;
    return (
        <div className="grid grid-cols-12 gap-2 items-center py-2 px-3 border-b hover:bg-muted/30 transition-colors">
            <div className="col-span-2">
                <p className="font-bold text-[10px] uppercase tracking-tighter truncate">{MODULE_LABELS[mod] || mod}</p>
            </div>
            <div className="col-span-2 flex justify-center">
                <Checkbox id={`${prefix}access-${mod}`} name={`${prefix}access-${mod}`} defaultChecked={isEdit ? user?.modules?.includes(mod) : false} />
            </div>
            {ACTIONS.filter(a => a.id !== 'view').forEach(action => (
                <div key={action.id} className="col-span-2 flex justify-center">
                    <Checkbox id={`${prefix}perm-${mod}-${action.id}`} name={`${prefix}perm-${mod}-${action.id}`} defaultChecked={isEdit ? user?.permissions?.includes(`${mod}:${action.id}`) : false} />
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

  return (
    <div className="flex min-h-screen flex-col bg-muted/5">
      <Header title="Gestión de Usuarios" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        <Card className="border-t-4 border-t-primary shadow-lg">
          <form onSubmit={handleSubmit}>
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="uppercase font-black text-primary text-sm">MATRIZ DE MÓDULOS Y PERMISOS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 pt-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Usuario</Label>
                  <Input name="username" required className="font-bold" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Correo</Label>
                  <Input name="email" type="email" required className="font-bold" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Contraseña</Label>
                  <Input name="password" type="password" required className="font-bold" />
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">Rol</Label>
                    <Select name="role" required defaultValue="viewer">
                        <SelectTrigger className="font-bold">
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

              <div className="space-y-6">
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
              <Button type="submit" className="w-full font-black uppercase" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : "REGISTRAR USUARIO"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="uppercase font-black text-sm">Usuarios Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-xl bg-white overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                    <TableRow>
                        <TableHead className="text-[10px] font-black uppercase">Usuario</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">Correo</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">Rol</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase">Acciones</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                            <TableCell className="font-black text-xs uppercase">{user.username}</TableCell>
                            <TableCell className="text-xs">{user.email}</TableCell>
                            <TableCell><Badge className="text-[9px] uppercase">{user.role}</Badge></TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditModal(user)}><Edit className="h-4 w-4" /></Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>¿Está absolutamente seguro?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Esta acción eliminará permanentemente el perfil de <strong>{user.username}</strong> de la base de datos.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteUser(user.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                    Eliminar
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
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 bg-primary text-white shrink-0">
                    <DialogTitle className="text-xl font-black uppercase">Editar Usuario: {editingUser.username}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleUpdateUser} className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-8 bg-background">
                        <div className="space-y-8">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase">Rol</Label>
                                    <Select name="role" required value={editRole} onValueChange={(v: any) => setEditRole(v)}>
                                        <SelectTrigger className="font-bold">
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
                    <DialogFooter className="p-6 bg-muted/30 border-t">
                        <DialogClose asChild><Button variant="outline">Cerrar</Button></DialogClose>
                        <Button type="submit" disabled={isSubmitting}>GUARDAR CAMBIOS</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
