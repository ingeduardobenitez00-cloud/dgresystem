
"use client";

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, EyeOff, UserPlus, Users, Loader2, Edit, Trash2, KeyRound, Search, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useFirebase, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, getAuth, signOut } from 'firebase/auth';
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
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { type Dato } from '@/lib/data';
import { initializeApp, getApps, deleteApp, type FirebaseApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';

type UserProfile = {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'director' | 'jefe' | 'funcionario' | 'divulgador' | 'viewer';
  modules: string[];
  permissions: string[];
  departamento?: string;
  distrito?: string;
  cedula?: string;
  vinculo?: string;
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
    modules: ['solicitud-capacitacion', 'agenda-capacitacion', 'control-movimiento-maquinas', 'encuesta-satisfaccion', 'informe-divulgador', 'informe-semanal-puntos-fijos', 'estadisticas-capacitacion']
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

const ALL_PERMISSIONS = ['add', 'edit', 'delete', 'view_report', 'view_images', 'generar_pdf', 'admin_filter', 'assign_staff'];
const PERMISSION_LABELS: { [key: string]: string } = {
    add: 'Crear Registros',
    edit: 'Modificar Datos',
    delete: 'Eliminar Registros',
    view_report: 'Ver Fichas Técnicas',
    view_images: 'Ver Galerías',
    generar_pdf: 'Descargar Documentos PDF',
    admin_filter: 'Filtrar Todo el País',
    assign_staff: 'Asignar Personal en Agenda'
};

export default function UsersPage() {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const { toast } = useToast();
  const { auth, firestore } = useFirebase();
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
      (u.distrito?.toLowerCase().includes(term)) ||
      (u.cedula?.toLowerCase().includes(term))
    );
  }, [users, searchTerm]);

  const togglePasswordVisibility = () => {
    setPasswordVisible(!passwordVisible);
  };
  
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!firestore || !currentUser) {
      toast({
        variant: 'destructive',
        title: 'Error de Firebase',
        description: 'Los servicios principales no están disponibles.',
      });
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData(form);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const username = formData.get('username') as string;
    const role = formData.get('role') as UserProfile['role'];
    const departamento = formData.get('departamento') as string;
    const distrito = formData.get('distrito') as string;
    const cedula = formData.get('cedula') as string;
    const vinculo = formData.get('vinculo') as string;

    const modules = ALL_MODULES.filter(module => formData.get(`access-${module}`));
    const permissions = ALL_PERMISSIONS.filter(permission => formData.get(`perm-${permission}`));

    const newUserProfile: Omit<UserProfile, 'id'> = { 
      username, 
      email, 
      role, 
      modules, 
      permissions, 
      departamento, 
      distrito,
      ...(role === 'divulgador' ? { cedula, vinculo } : {})
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

      toast({
        title: 'Usuario Creado',
        description: 'El nuevo usuario ha sido guardado con éxito.',
      });
      form.reset();
      setSelectedDepartment('');
      setSelectedRole('viewer');
    } catch (error: any) {
      console.error('Error creating user:', error);
      if (error.code === 'auth/email-already-in-use') {
        toast({
          variant: 'destructive',
          title: 'Error al crear usuario',
          description: 'El correo electrónico ya está registrado.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error al crear usuario',
          description: error.message || 'Ocurrió un error inesperado.',
        });
      }
    } finally {
      if (tempApp) {
        try {
          await deleteApp(tempApp);
        } catch (e) {
          console.error('Failed to delete temporary Firebase app instance:', e);
        }
      }
      setIsSubmitting(false);
    }
  };
  
  const handleOpenEditModal = (user: UserProfile) => {
    setEditingUser(user);
    setEditRole(user.role);
    setEditDept(user.departamento || '');
    setEditDist(user.distrito || '');
    if(user.departamento) {
        setSelectedDepartment(user.departamento);
    } else {
        setSelectedDepartment('');
    }
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
    const cedula = formData.get('cedula') as string;
    const vinculo = formData.get('vinculo') as string;
    const modules = ALL_MODULES.filter(module => formData.get(`access-${module}`));
    const permissions = ALL_PERMISSIONS.filter(permission => formData.get(`perm-${permission}`));
    
    const updatedFields: any = { 
      role, 
      modules, 
      permissions, 
      departamento, 
      distrito,
      ...(role === 'divulgador' ? { cedula, vinculo } : { cedula: '', vinculo: '' })
    };

    const userDocRef = doc(firestore, 'users', editingUser.id);

    try {
      await updateDoc(userDocRef, updatedFields);
      toast({ title: 'Usuario Actualizado', description: 'Los datos del usuario se han guardado.' });
      setEditModalOpen(false);
      setEditingUser(null);
    } catch (error) {
       toast({ title: 'Error al actualizar', variant: 'destructive', description: 'No se pudo actualizar el usuario.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!firestore || !currentUser) return;
    try {
        await deleteDoc(doc(firestore, 'users', userId));
        toast({ title: 'Usuario Eliminado', description: 'El registro del usuario ha sido eliminado de Firestore.' });
    } catch (error) {
        toast({ title: 'Error al eliminar', variant: 'destructive', description: 'No se pudo eliminar el usuario.' });
    }
  };

  const handleResetPassword = async (email: string) => {
    if (!auth || !firestore || !currentUser) return;
    try {
      await sendPasswordResetEmail(auth, email);
      toast({
        title: 'Correo enviado',
        description: `Se ha enviado un correo para restablecer la contraseña a ${email}.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo enviar el correo de restablecimiento.',
      });
    }
  };

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

  if (currentUser?.profile?.role !== 'admin') {
    return (
      <div className="flex min-h-screen w-full flex-col">
        <Header title="Acceso Denegado" />
        <main className="flex flex-1 items-center justify-center p-4">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <CardTitle>Acceso Denegado</CardTitle>
              <CardDescription>
                No tienes permisos para acceder a esta sección.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Por favor, contacta a un administrador si crees que esto es un error.</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/5">
      <Header title="Gestión de Usuarios" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        <Card className="border-t-4 border-t-primary shadow-lg">
          <form onSubmit={handleSubmit}>
            <CardHeader className="bg-muted/30">
              <CardTitle className="flex items-center gap-2 uppercase font-black">
                <UserPlus className="h-5 w-5 text-primary" />
                Crear Nuevo Funcionario
              </CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase">
                Asigne accesos y módulos específicos para el personal operativo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-[10px] font-black uppercase">Usuario (Nombre)</Label>
                  <Input id="username" name="username" placeholder="ej. juanperez" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[10px] font-black uppercase">Correo Electrónico</Label>
                  <Input id="email" name="email" type="email" placeholder="ej. juan.perez@dominio.com" required />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-[10px] font-black uppercase">Contraseña Provisional</Label>
                  <div className="relative">
                    <Input id="password" name="password" type={passwordVisible ? 'text' : 'password'} placeholder="••••••••" required />
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
                    <Label htmlFor="role" className="text-[10px] font-black uppercase">Rol Institucional</Label>
                    <Select name="role" required defaultValue="viewer" onValueChange={setSelectedRole}>
                        <SelectTrigger id="role" className="font-bold">
                        <SelectValue placeholder="Seleccionar un rol" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="admin">Administrador (Nacional)</SelectItem>
                            <SelectItem value="director">Director</SelectItem>
                            <SelectItem value="jefe">Jefe de Oficina</SelectItem>
                            <SelectItem value="funcionario">Funcionario Operativo</SelectItem>
                            <SelectItem value="divulgador">Divulgador (CIDEE)</SelectItem>
                            <SelectItem value="viewer">Visualizador / Observador</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
              </div>

              {selectedRole === 'divulgador' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-primary/5 border-2 border-dashed border-primary/20 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-2">
                    <Label htmlFor="cedula" className="text-primary font-black text-[10px] uppercase">Número de Cédula (C.I.C.)</Label>
                    <Input id="cedula" name="cedula" placeholder="Ej: 1.234.567" required className="font-black h-12 text-lg border-primary/20" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vinculo" className="text-primary font-black text-[10px] uppercase">Tipo de Vínculo Laboral</Label>
                    <Select name="vinculo" required defaultValue="CONTRATADO">
                      <SelectTrigger id="vinculo" className="h-12 font-bold">
                        <SelectValue placeholder="Seleccionar vínculo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PERMANENTE">PERMANENTE</SelectItem>
                        <SelectItem value="CONTRATADO">CONTRATADO</SelectItem>
                        <SelectItem value="COMISIONADO">COMISIONADO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              
              <Separator />

              <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Asignación Geográfica (Jurisdicción)</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                          <Label htmlFor="departamento" className="text-[10px] font-bold uppercase">Departamento</Label>
                          <Select name="departamento" onValueChange={setSelectedDepartment}>
                              <SelectTrigger className="font-bold">
                                  <SelectValue placeholder="Seleccionar departamento"/>
                              </SelectTrigger>
                              <SelectContent>
                                  {departments.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="distrito" className="text-[10px] font-bold uppercase">Distrito / Oficina</Label>
                          <Select name="distrito" disabled={!selectedDepartment}>
                              <SelectTrigger className="font-bold">
                                  <SelectValue placeholder="Seleccionar distrito"/>
                              </SelectTrigger>
                              <SelectContent>
                                  {districts.map(dist => <SelectItem key={dist} value={dist}>{dist}</SelectItem>)}
                              </SelectContent>
                          </Select>
                      </div>
                  </div>
              </div>
              
              <Separator />

              <div className="space-y-4">
                <Label className="text-sm font-black uppercase tracking-tight text-primary">Asignación de Módulos y Permisos</Label>
                <Accordion type="multiple" className="w-full border rounded-xl overflow-hidden bg-white shadow-inner">
                    {MODULE_GROUPS.map((group, idx) => (
                        <AccordionItem value={`group-${idx}`} key={group.label} className="border-b last:border-b-0 px-4">
                            <AccordionTrigger className="hover:no-underline py-4 text-xs font-black uppercase text-muted-foreground">
                                {group.label}
                            </AccordionTrigger>
                            <AccordionContent className="pb-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                    {group.modules.map(module => (
                                        <div key={module} className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                                            <Checkbox id={`access-${module}`} name={`access-${module}`} className="h-5 w-5" />
                                            <Label htmlFor={`access-${module}`} className="font-bold text-[11px] uppercase cursor-pointer">
                                                {MODULE_LABELS[module] || module}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                                {group.label === 'Sistema' && (
                                    <>
                                        <Separator className="my-6" />
                                        <div className="space-y-3">
                                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Atributos y Permisos Globales</Label>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-2 border-dashed p-4 rounded-xl bg-muted/10">
                                                {ALL_PERMISSIONS.map(permission => (
                                                    <div key={permission} className="flex items-center space-x-2">
                                                        <Checkbox id={`perm-${permission}`} name={`perm-${permission}`} />
                                                        <Label htmlFor={`perm-${permission}`} className="font-bold text-[10px] uppercase cursor-pointer">
                                                            {PERMISSION_LABELS[permission] || permission}
                                                        </Label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
              </div>

            </CardContent>
            <CardFooter className="bg-muted/30 border-t p-6">
              <Button type="submit" className="w-full h-14 font-black uppercase text-lg shadow-lg" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> PROCESANDO...</> : "REGISTRAR FUNCIONARIO"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 uppercase font-black">
                        <Users className="h-5 w-5 text-primary" />
                        Directorio de Personal
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase">
                        {filteredUsers.length} funcionario(s) registrados en el sistema.
                    </CardDescription>
                </div>
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Buscar por nombre, cédula o ubicación..." 
                        className="pl-10 h-11 text-xs font-bold"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => setSearchTerm('')}
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    )}
                </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingUsers ? (
                <div className="flex justify-center items-center h-48">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
            ) : (
                <div className="overflow-x-auto border rounded-xl">
                    <Table>
                        <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="text-[10px] font-black uppercase">Funcionario</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Correo Acceso</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Rol</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Ubicación</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Módulos Activos</TableHead>
                            <TableHead className="text-right text-[10px] font-black uppercase">Acciones</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {filteredUsers.length > 0 ? (
                            filteredUsers.map((user) => (
                            <TableRow key={user.id} className="group/row hover:bg-muted/20 transition-colors">
                                <TableCell className="font-black text-xs uppercase leading-tight">
                                    {user.username}
                                    {user.cedula && <p className="text-[9px] text-muted-foreground font-normal">C.I. {user.cedula}</p>}
                                </TableCell>
                                <TableCell className="text-xs">{user.email}</TableCell>
                                <TableCell>
                                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="capitalize text-[9px] font-black uppercase">{user.role}</Badge>
                                </TableCell>
                                <TableCell className="text-[9px] font-bold uppercase leading-tight">
                                    {user.departamento || '-'}<br/>
                                    <span className="text-muted-foreground font-normal">{user.distrito || ''}</span>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                                        {user.modules?.length ? user.modules.slice(0, 3).map(module => (
                                            <Badge key={module} variant="outline" className="text-[8px] uppercase font-black border-primary/20">
                                                {MODULE_LABELS[module] || module}
                                            </Badge>
                                        )) : <span className="text-[8px] italic text-muted-foreground">Sin módulos</span>}
                                        {user.modules?.length > 3 && <span className="text-[8px] font-black text-primary">+{user.modules.length - 3}</span>}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                        <Button variant="outline" size="icon" className="h-8 w-8 hover:bg-primary hover:text-white" onClick={() => handleOpenEditModal(user)}>
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
                                                    <AlertDialogTitle className="uppercase font-black">¿Eliminar Funcionario?</AlertDialogTitle>
                                                    <AlertDialogDescription className="text-xs uppercase font-bold">
                                                        Esta acción eliminará el registro de {user.username}. Esta operación no se puede deshacer.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel className="uppercase font-bold text-xs">Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteUser(user.id)} className="bg-destructive hover:bg-destructive/90 uppercase font-black text-xs">Eliminar Definitivamente</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </TableCell>
                            </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-xs font-bold uppercase text-muted-foreground">
                                    No se encontraron funcionarios registrados.
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
            <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 bg-muted/30 shrink-0">
                    <DialogTitle className="uppercase font-black">Editar Perfil: {editingUser.username}</DialogTitle>
                    <DialogDescription className="text-[10px] font-bold uppercase">
                        Modifique los módulos asignados y el alcance territorial del funcionario.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleUpdateUser} className="flex-1 flex flex-col overflow-hidden">
                    <ScrollArea className="flex-1 p-6">
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-role" className="text-[10px] font-black uppercase">Rol Institucional</Label>
                                    <Select name="role" required value={editRole} onValueChange={(value: UserProfile['role']) => {
                                        setEditRole(value);
                                        if (value === 'admin' || value === 'director' || value === 'jefe') {
                                            setEditDept('');
                                            setEditDist('');
                                            setSelectedDepartment('');
                                        }
                                    }}>
                                        <SelectTrigger id="edit-role" className="font-bold">
                                        <SelectValue placeholder="Seleccionar un rol" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="admin">Administrador</SelectItem>
                                            <SelectItem value="director">Director</SelectItem>
                                            <SelectItem value="jefe">Jefe</SelectItem>
                                            <SelectItem value="funcionario">Funcionario</SelectItem>
                                            <SelectItem value="divulgador">Divulgador</SelectItem>
                                            <SelectItem value="viewer">Visualizador</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {editRole === 'divulgador' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="cedula-edit" className="text-[10px] font-black uppercase">C.I.C.</Label>
                                            <Input id="cedula-edit" name="cedula" defaultValue={editingUser.cedula} required className="font-bold" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="vinculo-edit" className="text-[10px] font-black uppercase">Vínculo</Label>
                                            <Select name="vinculo" required defaultValue={editingUser.vinculo || 'CONTRATADO'}>
                                                <SelectTrigger id="vinculo-edit" className="font-bold">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="PERMANENTE">PERMANENTE</SelectItem>
                                                    <SelectItem value="CONTRATADO">CONTRATADO</SelectItem>
                                                    <SelectItem value="COMISIONADO">COMISIONADO</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Separator />
                            
                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Jurisdicción Asignada</Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="departamento-edit" className="text-[10px] font-bold uppercase">Departamento</Label>
                                        <Select name="departamento" value={editDept} onValueChange={(value) => {
                                            setEditDept(value);
                                            setEditDist('');
                                            setSelectedDepartment(value);
                                        }}>
                                            <SelectTrigger className="font-bold">
                                                <SelectValue placeholder="Seleccionar departamento"/>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {departments.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="distrito-edit" className="text-[10px] font-bold uppercase">Distrito / Oficina</Label>
                                        <Select name="distrito" value={editDist} onValueChange={setEditDist} disabled={!selectedDepartment}>
                                            <SelectTrigger className="font-bold">
                                                <SelectValue placeholder="Seleccionar distrito"/>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {districts.map(dist => <SelectItem key={dist} value={dist}>{dist}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <Label className="text-sm font-black uppercase text-primary">Acceso a Módulos y Atributos</Label>
                                <Accordion type="multiple" className="w-full border rounded-xl overflow-hidden bg-white">
                                    {MODULE_GROUPS.map((group, idx) => (
                                        <AccordionItem value={`edit-group-${idx}`} key={`edit-${group.label}`} className="border-b last:border-b-0 px-4">
                                            <AccordionTrigger className="hover:no-underline py-3 text-[10px] font-black uppercase text-muted-foreground">
                                                {group.label}
                                            </AccordionTrigger>
                                            <AccordionContent className="pb-4">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                                    {group.modules.map(module => (
                                                        <div key={`edit-${module}`} className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                                                            <Checkbox id={`edit-access-${module}`} name={`access-${module}`} defaultChecked={editingUser.modules?.includes(module)} className="h-5 w-5" />
                                                            <Label htmlFor={`edit-access-${module}`} className="font-bold text-[11px] uppercase cursor-pointer">
                                                                {MODULE_LABELS[module] || module}
                                                            </Label>
                                                        </div>
                                                    ))}
                                                </div>
                                                {group.label === 'Sistema' && (
                                                    <>
                                                        <Separator className="my-4" />
                                                        <div className="space-y-3">
                                                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Permisos Globales</Label>
                                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border-2 border-dashed p-4 rounded-xl bg-muted/10">
                                                                {ALL_PERMISSIONS.map(permission => (
                                                                    <div key={`edit-perm-${permission}`} className="flex items-center space-x-2">
                                                                        <Checkbox id={`edit-perm-${permission}`} name={`perm-${permission}`} defaultChecked={editingUser.permissions?.includes(permission)} />
                                                                        <Label htmlFor={`edit-perm-${permission}`} className="font-bold text-[10px] uppercase cursor-pointer">
                                                                            {PERMISSION_LABELS[permission] || permission}
                                                                        </Label>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </div>
                        </div>
                    </ScrollArea>
                    <DialogFooter className="p-6 bg-muted/30 border-t gap-3">
                        <DialogClose asChild>
                            <Button type="button" variant="outline" className="uppercase font-bold h-12">Cancelar</Button>
                        </DialogClose>
                        <Button type="submit" className="h-12 font-black uppercase flex-1 shadow-lg" disabled={isSubmitting}>
                            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> GUARDANDO...</> : "GUARDAR CAMBIOS"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
