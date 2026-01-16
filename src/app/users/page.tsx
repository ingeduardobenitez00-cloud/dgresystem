
"use client";

import { useState, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, EyeOff, UserPlus, Users, Loader2, Edit, Trash2, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, getAuth, signOut } from 'firebase/auth';
import { collection, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
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
  role: 'admin' | 'funcionario' | 'viewer';
  modules: string[];
  permissions: string[];
  departamento?: string;
  distrito?: string;
};

const ALL_MODULES = ['fotos', 'ficha', 'resumen', 'settings', 'users', 'cargar-ficha', 'informe-general'];
const MODULE_LABELS: { [key: string]: string } = {
  fotos: 'Imágenes',
  ficha: 'Vista de Ficha',
  resumen: 'Resumen',
  settings: 'Configuración',
  users: 'Usuarios',
  'cargar-ficha': 'Cargar Ficha',
  'informe-general': 'Informe General',
};
const ALL_PERMISSIONS = ['add', 'edit', 'delete'];
const PERMISSION_LABELS: { [key: string]: string } = {
    add: 'Agregar',
    edit: 'Editar',
    delete: 'Borrar',
};


export default function UsersPage() {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const { toast } = useToast();
  const { auth, firestore } = useFirebase();
  const { user: currentUser, isUserLoading } = useUser();

  const usersQuery = useMemoFirebase(() => (firestore && currentUser?.profile?.role === 'admin' ? collection(firestore, 'users') : null), [firestore, currentUser]);
  const { data: users, isLoading: isLoadingUsers, setData: setUsers } = useCollection<UserProfile>(usersQuery);
  const datosQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'datos') : null), [firestore]);
  const { data: datosData } = useCollection<Dato>(datosQuery);

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

    const modules = ALL_MODULES.filter(module => formData.get(`access-${module}`));
    const permissions = ALL_PERMISSIONS.filter(permission => formData.get(`perm-${permission}`));

    const newUserProfile: Omit<UserProfile, 'id'> = { username, email, role, modules, permissions, departamento, distrito };

    const tempAppName = 'temp-user-creation';
    let tempApp: FirebaseApp | undefined = undefined;

    try {
      tempApp = getApps().find(app => app.name === tempAppName) || initializeApp(firebaseConfig, tempAppName);
      const tempAuth = getAuth(tempApp);

      const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
      const user = userCredential.user;

      await setDoc(doc(firestore, 'users', user.uid), newUserProfile);
      
      if (setUsers) {
        const newUserForList: UserProfile = {
            id: user.uid,
            username,
            email,
            role,
            modules,
            permissions,
            departamento: role === 'admin' ? '' : departamento,
            distrito: role === 'admin' ? '' : distrito,
        };
        setUsers((prevUsers) => [...(prevUsers || []), newUserForList]);
      }

      await signOut(tempAuth);

      toast({
        title: 'Usuario Creado',
        description: 'El nuevo usuario ha sido guardado con éxito.',
      });
      form.reset();
      setSelectedDepartment('');
    } catch (error: any) {
      console.error('Error creating user:', error);
      if (error.code === 'auth/email-already-in-use') {
        toast({
          variant: 'destructive',
          title: 'Error al crear usuario',
          description: 'El correo electrónico ya está registrado. Por favor, utiliza otro.',
        });
      } else {
        const contextualError = new FirestorePermissionError({
          operation: 'create',
          path: `users/<new_user_id>`,
          requestResourceData: newUserProfile,
        });
        errorEmitter.emit('permission-error', contextualError);
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
    const modules = ALL_MODULES.filter(module => formData.get(`access-${module}`));
    const permissions = ALL_PERMISSIONS.filter(permission => formData.get(`perm-${permission}`));
    
    const updatedFields = { role, modules, permissions, departamento, distrito };

    const userDocRef = doc(firestore, 'users', editingUser.id);

    try {
      await updateDoc(userDocRef, updatedFields);
      
      toast({ title: 'Usuario Actualizado', description: 'Los datos del usuario se han guardado.' });
      setEditModalOpen(false);
      setEditingUser(null);
    } catch (error) {
       const contextualError = new FirestorePermissionError({
            operation: 'update',
            path: `users/${editingUser.id}`,
            requestResourceData: updatedFields,
       });
       errorEmitter.emit('permission-error', contextualError);
       toast({ title: 'Error al actualizar', variant: 'destructive', description: 'No se pudo actualizar el usuario.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!firestore || !currentUser) return;
    try {
        await deleteDoc(doc(firestore, 'users', userId));
        
        toast({ title: 'Usuario Eliminado', description: 'El registro del usuario ha sido eliminado de Firestore.' });
    } catch (error) {
        const contextualError = new FirestorePermissionError({
            operation: 'delete',
            path: `users/${userId}`,
        });
        errorEmitter.emit('permission-error', contextualError);
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
        description: 'No se pudo enviar el correo de restablecimiento. Inténtalo de nuevo.',
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
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Gestión de Usuarios" />
      <main className="flex flex-1 flex-col items-center p-4 gap-8">
        <Card className="w-full max-w-4xl">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Crear Nuevo Usuario
              </CardTitle>
              <CardDescription>
                Rellena los campos para añadir un nuevo usuario al sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="username">Usuario</Label>
                  <Input id="username" name="username" placeholder="ej. juanperez" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input id="email" name="email" type="email" placeholder="ej. juan.perez@dominio.com" required />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
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
                    <Label htmlFor="role">Rol</Label>
                    <Select name="role" required defaultValue="viewer">
                        <SelectTrigger id="role">
                        <SelectValue placeholder="Seleccionar un rol" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="funcionario">Funcionario</SelectItem>
                            <SelectItem value="viewer">Visualizador</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
              </div>
              
              <Separator />

              <div className="space-y-4">
                  <Label>Asignación de Ubicación (Opcional)</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                          <Label htmlFor="departamento">Departamento</Label>
                          <Select name="departamento" onValueChange={setSelectedDepartment}>
                              <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar departamento"/>
                              </SelectTrigger>
                              <SelectContent>
                                  {departments.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="distrito">Distrito</Label>
                          <Select name="distrito" disabled={!selectedDepartment}>
                              <SelectTrigger>
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
                <Label>Acceso a Módulos</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {ALL_MODULES.map(module => (
                        <div key={module} className="flex items-center space-x-2">
                            <Checkbox id={`access-${module}`} name={`access-${module}`} />
                            <Label htmlFor={`access-${module}`} className="font-normal capitalize">
                                {MODULE_LABELS[module] || module}
                            </Label>
                        </div>
                    ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label>Permisos</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {ALL_PERMISSIONS.map(permission => (
                        <div key={permission} className="flex items-center space-x-2">
                            <Checkbox id={`perm-${permission}`} name={`perm-${permission}`} />
                            <Label htmlFor={`perm-${permission}`} className="font-normal capitalize">
                                {PERMISSION_LABELS[permission] || permission}
                            </Label>
                        </div>
                    ))}
                </div>
              </div>

            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Usuario
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card className="w-full max-w-7xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Listado de Usuarios
            </CardTitle>
            <CardDescription>
                Usuarios registrados en el sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingUsers ? (
                <div className="flex justify-center items-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Usuario</TableHead>
                            <TableHead>Correo</TableHead>
                            <TableHead>Rol</TableHead>
                            <TableHead>Departamento</TableHead>
                            <TableHead>Distrito</TableHead>
                            <TableHead>Módulos</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {users && users.length > 0 ? (
                            users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell className="font-medium">{user.username}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>
                                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="capitalize">{user.role}</Badge>
                                </TableCell>
                                <TableCell>{user.departamento || '-'}</TableCell>
                                <TableCell>{user.distrito || '-'}</TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1 max-w-xs">
                                        {user.modules.map(module => <Badge key={module} variant="outline" className="capitalize">{MODULE_LABELS[module] || module}</Badge>)}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEditModal(user)}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                     <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <KeyRound className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Restablecer Contraseña</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                   ¿Estás seguro de que quieres enviar un correo de restablecimiento de contraseña a {user.email}?
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleResetPassword(user.email)}>Enviar Correo</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Esta acción eliminará el registro del usuario de la base de datos, pero no su cuenta de autenticación.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteUser(user.id, user.email)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </TableCell>
                            </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    No hay usuarios registrados.
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
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Editar Usuario: {editingUser.username}</DialogTitle>
                    <DialogDescription>
                        Ajusta el rol, los módulos y los permisos para este usuario.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleUpdateUser}>
                    <div className="py-4 space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="edit-role">Rol</Label>
                            <Select name="role" required value={editRole} onValueChange={(value: UserProfile['role']) => {
                                setEditRole(value);
                                if (value === 'admin') {
                                    setEditDept('');
                                    setEditDist('');
                                    setSelectedDepartment('');
                                }
                            }}>
                                <SelectTrigger id="edit-role">
                                <SelectValue placeholder="Seleccionar un rol" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">Administrador</SelectItem>
                                    <SelectItem value="funcionario">Funcionario</SelectItem>
                                    <SelectItem value="viewer">Visualizador</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Separator />
                        <div className="space-y-4">
                            <Label>Asignación de Ubicación (Opcional)</Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="departamento-edit">Departamento</Label>
                                    <Select name="departamento" value={editDept} onValueChange={(value) => {
                                        setEditDept(value);
                                        setEditDist('');
                                        setSelectedDepartment(value);
                                    }} disabled={editRole === 'admin'}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar departamento"/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {departments.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="distrito-edit">Distrito</Label>
                                    <Select name="distrito" value={editDist} onValueChange={setEditDist} disabled={!selectedDepartment || editRole === 'admin'}>
                                        <SelectTrigger>
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
                            <Label>Acceso a Módulos</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {ALL_MODULES.map(module => (
                                    <div key={`edit-mod-${module}`} className="flex items-center space-x-2">
                                        <Checkbox id={`edit-access-${module}`} name={`access-${module}`} defaultChecked={editingUser.modules.includes(module)} />
                                        <Label htmlFor={`edit-access-${module}`} className="font-normal capitalize">
                                            {MODULE_LABELS[module] || module}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <Separator />
                        <div className="space-y-4">
                            <Label>Permisos</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {ALL_PERMISSIONS.map(permission => (
                                    <div key={`edit-perm-${permission}`} className="flex items-center space-x-2">
                                        <Checkbox id={`edit-perm-${permission}`} name={`perm-${permission}`} defaultChecked={editingUser.permissions.includes(permission)} />
                                        <Label htmlFor={`edit-perm-${permission}`} className="font-normal capitalize">
                                            {PERMISSION_LABELS[permission] || permission}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">Cancelar</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar Cambios
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
