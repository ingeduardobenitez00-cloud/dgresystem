
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
  UserCircle
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
      { id: 'solicitud-capacitacion', label: 'ANEXO V - SOLICITUD' },
      { id: 'divulgadores', label: 'DIRECTORIO DIVULGADORES' },
      { id: 'agenda-capacitacion', label: 'AGENDA DE ACTIVIDADES' },
      { id: 'control-movimiento-maquinas', label: 'MOVIMIENTO DE MÁQUINAS' },
      { id: 'denuncia-lacres', label: 'DENUNCIA DE LACRES' },
      { id: 'encuesta-satisfaccion', label: 'ENCUESTA SATISFACCIÓN' },
      { id: 'informe-divulgador', label: 'ANEXO III - INFORME DIV.' },
      { id: 'informe-semanal-puntos-fijos', label: 'ANEXO IV - INF. SEMANAL' },
      { id: 'estadisticas-capacitacion', label: 'ESTADÍSTICAS CIDEE' },
    ]
  },
  {
    category: "REGISTROS ELECTORALES",
    items: [
      { id: 'ficha', label: 'VISTA DE FICHA' },
      { id: 'fotos', label: 'GALERÍA FOTOGRÁFICA' },
      { id: 'cargar-ficha', label: 'CARGAR FICHA' },
    ]
  },
  {
    category: "ANÁLISIS Y REPORTES",
    items: [
      { id: 'resumen', label: 'RESUMEN UBICACIONES' },
      { id: 'informe-general', label: 'INFORME GENERAL PDF' },
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
    ]
  }
];

const GLOBAL_PERMS = [
  { id: 'admin_filter', label: 'FILTRO NACIONAL' },
  { id: 'department_filter', label: 'FILTRO DEPARTAMENTAL' },
  { id: 'district_filter', label: 'FILTRO DISTRITAL' },
  { id: 'assign_staff', label: 'ASIGNAR PERSONAL' },
];

export default function UsersPage() {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { user: currentUser, isUserLoading: isMeLoading } = useUser();

  const usersQuery = useMemoFirebase(() => (firestore && currentUser?.profile?.role === 'admin' ? collection(firestore, 'users') : null), [firestore, currentUser]);
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
      
      if (nextPerms.has(permKey)) {
        nextPerms.delete(permKey);
      } else {
        nextPerms.add(permKey);
        nextModules.add(moduleId);
      }
      
      setEditingUser({ 
        ...editingUser, 
        permissions: Array.from(nextPerms),
        modules: Array.from(nextModules)
      });
    } else {
      setSelectedPerms(prev => {
        const next = new Set(prev);
        if (next.has(permKey)) next.delete(permKey);
        else {
          next.add(permKey);
          setSelectedModules(m => new Set(m).add(moduleId));
        }
        return next;
      });
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
      const docRef = doc(firestore, 'users', userCredential.user.uid);
      await setDoc(docRef, newUserProfile);
      await signOut(tempAuth);
      toast({ title: 'Usuario Creado' });
      form.reset();
      setSelectedModules(new Set());
      setSelectedPerms(new Set());
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      if (tempApp) await deleteApp(tempApp);
      setIsSubmitting(false);
    }
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
      departamento: editingUser.departamento || '',
      distrito: editingUser.distrito || ''
    };
    
    const docRef = doc(firestore, 'users', editingUser.id);
    updateDoc(docRef, updateData)
      .then(() => {
        toast({ title: 'Perfil Actualizado' });
        setEditModalOpen(false);
        setIsSubmitting(false);
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: updateData }));
        setIsSubmitting(false);
      });
  };

  const PermissionMatrix = ({ userObj, isEditing = false }: { userObj?: Partial<UserProfile>, isEditing?: boolean }) => {
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
                  onCheckedChange={() => handleTogglePerm(p.id, isEditing)}
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
                      {ACTION_LABELS.map(a => (
                        <TableHead key={a.id} className="text-center text-[9px] font-black uppercase py-4">{a.label}</TableHead>
                      ))}
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
                                onCheckedChange={() => handleToggleModuleAction(module.id, action.id, isEditing)}
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

  if (isMeLoading || isLoadingUsers) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/5">
      <Header title="Gestión de Usuarios" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h1 className="text-3xl font-black tracking-tight uppercase text-primary leading-none">Matriz de Personal</h1>
                <p className="text-muted-foreground text-[10px] font-bold uppercase flex items-center gap-2 mt-2 tracking-widest">
                    <ShieldCheck className="h-3 w-3" /> Configuración de perfiles y accesos de seguridad
                </p>
            </div>
        </div>

        <Card className="shadow-2xl border-none overflow-hidden rounded-xl bg-white">
          <form onSubmit={handleSubmit}>
            <CardHeader className="border-b py-6 bg-muted/10">
              <CardTitle className="uppercase font-black text-xs flex items-center gap-2 tracking-widest text-primary">
                <UserPlus className="h-4 w-4" /> Registrar Funcionario
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-10 pt-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Nombre y Apellido</Label>
                    <Input name="username" placeholder="CARGA EN MAYÚSCULAS" required className="font-bold uppercase h-11 border-2" />
                </div>
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Correo Institucional</Label>
                    <Input name="email" type="email" placeholder="usuario@tsje.gov.py" required className="font-bold h-11 border-2" />
                </div>
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Contraseña</Label>
                    <Input name="password" type="password" required className="font-bold h-11 border-2" />
                </div>
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-primary">Rol Institucional</Label>
                    <Select onValueChange={(v: any) => setRegRole(v)} value={regRole}>
                        <SelectTrigger className="font-black h-11 border-2 uppercase text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="admin" className="font-black text-[10px]">ADMINISTRADOR</SelectItem>
                            <SelectItem value="director" className="font-black text-[10px]">DIRECTOR</SelectItem>
                            <SelectItem value="jefe" className="font-black text-[10px]">JEFE DE OFICINA</SelectItem>
                            <SelectItem value="funcionario" className="font-black text-[10px]">FUNCIONARIO</SelectItem>
                            <SelectItem value="viewer" className="font-black text-[10px]">SOLO LECTURA</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Departamento Asignado</Label>
                    <Select onValueChange={setRegDepartamento} value={regDepartamento}>
                        <SelectTrigger className="font-black h-11 border-2 uppercase text-[10px]"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="N/A" className="font-black text-[10px]">ALCANCE NACIONAL</SelectItem>
                            {departments.map(d => <SelectItem key={d} value={d} className="font-black text-[10px]">{d}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Distrito Asignado</Label>
                    <Select onValueChange={setRegDistrito} value={regDistrito} disabled={!regDepartamento || regDepartamento === 'N/A'}>
                        <SelectTrigger className="font-black h-11 border-2 uppercase text-[10px]"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="N/A" className="font-black text-[10px]">TODOS LOS DISTRITOS</SelectItem>
                            {districts.map(d => <SelectItem key={d} value={d} className="font-black text-[10px]">{d}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
              </div>

              <Separator />

              <PermissionMatrix />

            </CardContent>
            <CardFooter className="bg-muted/30 border-t p-6">
              <Button type="submit" className="w-full h-16 font-black uppercase shadow-xl text-lg tracking-widest" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin mr-3" /> : "REGISTRAR ACCESO CENTRAL"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card className="shadow-xl overflow-hidden border-none rounded-xl">
            <CardHeader className="bg-primary text-white py-5 px-8 flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="uppercase font-black text-sm tracking-widest">Personal Activo ({filteredUsers.length})</CardTitle>
                </div>
                <div className="relative w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                    <Input 
                        placeholder="Buscar por nombre..." 
                        className="h-10 pl-10 text-[10px] font-bold bg-white/10 border-white/20 text-white placeholder:text-white/30 rounded-full"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </CardHeader>
            <CardContent className="p-0 bg-white">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest px-8">Funcionario</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest">Rol</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest">Jurisdicción</TableHead>
                            <TableHead className="text-right text-[9px] font-black uppercase tracking-widest px-8">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredUsers.map(user => (
                            <TableRow key={user.id} className="hover:bg-primary/5 transition-colors border-b">
                                <TableCell className="py-5 px-8">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center font-black text-[10px]">
                                            {user.username.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-black text-xs uppercase text-primary">{user.username}</p>
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase">{user.email}</p>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/20 bg-primary/5 text-primary">
                                        {user.role}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <p className="text-[9px] font-black uppercase flex items-center gap-1.5">
                                        <Globe className="h-3 w-3 opacity-40" /> {user.departamento || 'NACIONAL'}
                                    </p>
                                    {user.distrito && user.distrito !== 'N/A' && (
                                        <p className="text-[8px] font-bold text-muted-foreground uppercase mt-0.5 ml-4">
                                            {user.distrito}
                                        </p>
                                    )}
                                </TableCell>
                                <TableCell className="text-right px-8">
                                    <div className="flex justify-end gap-3">
                                        <Button variant="outline" size="icon" className="h-9 w-9 border-primary/10 hover:bg-primary hover:text-white transition-all" onClick={() => {
                                            setEditingUser({ ...user });
                                            setEditModalOpen(true);
                                        }}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="outline" size="icon" className="h-9 w-9 text-destructive/60 hover:bg-destructive hover:text-white">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle className="font-black uppercase">¿Eliminar acceso?</AlertDialogTitle>
                                                    <AlertDialogDescription className="text-xs">Revocará permanentemente los permisos de este funcionario.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel className="font-bold text-[10px] uppercase">Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => {
                                                        const docRef = doc(firestore, 'users', user.id);
                                                        deleteDoc(docRef).catch(() => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' })));
                                                    }} className="bg-destructive text-white font-black text-[10px] uppercase">Eliminar</AlertDialogAction>
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
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 border-none shadow-2xl overflow-hidden rounded-2xl">
          {editingUser && (
            <form onSubmit={handleUpdateUser} className="flex flex-col h-full bg-white overflow-hidden">
              <DialogHeader className="p-8 bg-black text-white shrink-0">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
                        <Settings className="h-6 w-6" />
                    </div>
                    <div>
                        <DialogTitle className="text-2xl font-black uppercase leading-none">Editar Perfil</DialogTitle>
                        <DialogDescription className="text-white/60 font-bold uppercase text-[9px] tracking-widest mt-2">
                            FUNCIONARIO: {editingUser.username}
                        </DialogDescription>
                    </div>
                </div>
              </DialogHeader>
              
              <ScrollArea className="flex-1">
                <div className="p-8 space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Nombre y Apellido</Label>
                            <Input 
                                value={editingUser.username} 
                                onChange={(e) => setEditingUser({...editingUser, username: e.target.value.toUpperCase()})}
                                className="font-bold uppercase h-12 border-2" 
                            />
                        </div>
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase text-primary">Rol</Label>
                            <Select onValueChange={(v: any) => setEditingUser({...editingUser, role: v})} value={editingUser.role}>
                                <SelectTrigger className="font-black h-12 border-2 text-[10px] uppercase"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin" className="font-black text-[10px]">ADMINISTRADOR</SelectItem>
                                    <SelectItem value="director" className="font-black text-[10px]">DIRECTOR</SelectItem>
                                    <SelectItem value="jefe" className="font-black text-[10px]">JEFE DE OFICINA</SelectItem>
                                    <SelectItem value="funcionario" className="font-black text-[10px]">FUNCIONARIO</SelectItem>
                                    <SelectItem value="viewer" className="font-black text-[10px]">SOLO LECTURA</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Departamento</Label>
                            <Select onValueChange={(v) => setEditingUser({...editingUser, departamento: v, distrito: ''})} value={editingUser.departamento || 'N/A'}>
                                <SelectTrigger className="font-black h-12 border-2 text-[10px] uppercase"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="N/A" className="font-black text-[10px]">ALCANCE NACIONAL</SelectItem>
                                    {departments.map(d => <SelectItem key={d} value={d} className="font-black text-[10px]">{d}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Distrito</Label>
                            <Select onValueChange={(v) => setEditingUser({...editingUser, distrito: v})} value={editingUser.distrito || 'N/A'} disabled={!editingUser.departamento || editingUser.departamento === 'N/A'}>
                                <SelectTrigger className="font-black h-12 border-2 text-[10px] uppercase"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="N/A" className="font-black text-[10px]">TODOS LOS DISTRITOS</SelectItem>
                                    {datosData?.filter(d => d.departamento === editingUser.departamento).map(d => <SelectItem key={d.distrito} value={d.distrito} className="font-black text-[10px]">{d.distrito}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Separator />

                    <PermissionMatrix userObj={editingUser} isEditing={true} />
                </div>
              </ScrollArea>
              
              <DialogFooter className="p-8 bg-muted/30 border-t shrink-0">
                <DialogClose asChild><Button variant="outline" type="button" className="font-black uppercase text-[10px] px-8 h-14">CANCELAR</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting} className="font-black uppercase text-xs px-12 h-14 flex-1 shadow-xl">
                    {isSubmitting ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : "ACTUALIZAR MATRIZ DE PERFIL"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
