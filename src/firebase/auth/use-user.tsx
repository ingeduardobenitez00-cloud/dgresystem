'use client';
import { useMemo } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { type User } from 'firebase/auth';

export interface UserProfile {
  username?: string;
  role?: 'admin' | 'director' | 'coordinador' | 'jefe' | 'funcionario' | 'viewer';
  departamento?: string;
  distrito?: string;
  modules?: string[];
  permissions?: string[];
  cedula?: string;
  vinculo?: 'PERMANENTE' | 'CONTRATADO' | 'COMISIONADO' | string;
  active?: boolean;
  registration_method?: string;
}

export type AppUser = User & {
  profile?: UserProfile | null;
  isAdmin?: boolean;
  isOwner?: boolean;
};

export interface UserHookResult {
  user: AppUser | null;
  isUserLoading: boolean;
  isProfileLoading: boolean;
  userError: Error | null;
}

export const useUser = (): UserHookResult => {
  const { user: authUser, isUserLoading: isAuthLoading, userError: authError, firestore } = useFirebase();

  const userProfileDocRef = useMemoFirebase(() => {
    if (!firestore || !authUser?.uid) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [firestore, authUser?.uid]);

  const { data: profileData, isLoading: isProfileLoading, error: profileError } = useDoc<UserProfile>(userProfileDocRef);
  
  const email = authUser?.email?.toLowerCase() || '';
  const isOwner = email === 'edubtz11@gmail.com' || email === 'eduardobritz1@gmail.com' || email === 'eduardobritz11@gmail.com';

  const enrichedUser = useMemo(() => {
    if (!authUser) return null;
    
    // PERFIL SINTÉTICO DE EMERGENCIA PARA EL DUEÑO
    // Si el correo coincide, ignoramos cualquier error de Firestore y otorgamos todo.
    if (isOwner) {
      const allModules = [
        'calendario-capacitaciones', 'anexo-i', 'lista-anexo-i', 'solicitud-capacitacion', 'agenda-anexo-i', 
        'agenda-anexo-v', 'maquinas', 'control-movimiento-maquinas', 'denuncia-lacres', 
        'informe-movimientos-denuncias', 'encuesta-satisfaccion', 'informe-divulgador', 
        'galeria-capacitaciones', 'informe-semanal-puntos-fijos', 'lista-anexo-iv', 
        'archivo-capacitaciones', 'divulgadores', 'estadisticas-capacitacion',
        'ficha', 'fotos', 'cargar-ficha', 'configuracion-semanal', 'informe-semanal-registro',
        'reporte-semanal-registro', 'archivo-semanal-registro', 'resumen', 'informe-general',
        'conexiones', 'locales-votacion', 'cargar-fotos-locales', 'importar-reportes',
        'importar-locales', 'importar-partidos', 'users', 'settings', 'documentacion', 'auditoria'
      ];

      const allPermissions = [
        'admin_filter', 'department_filter', 'district_filter', 'assign_staff', 'generar_pdf'
      ];

      allModules.forEach(m => {
        ['view', 'add', 'edit', 'delete', 'pdf'].forEach(a => {
          allPermissions.push(`${m}:${a}`);
        });
      });

      return {
        ...authUser,
        profile: {
          username: profileData?.username || 'ADMINISTRADOR MAESTRO',
          role: 'admin',
          active: true,
          departamento: profileData?.departamento || 'SEDE CENTRAL',
          distrito: profileData?.distrito || 'ASUNCIÓN',
          modules: allModules,
          permissions: allPermissions
        },
        isAdmin: true,
        isOwner: true
      };
    }
    
    return {
      ...authUser,
      profile: profileData,
      isAdmin: profileData?.role === 'admin',
      isOwner: false
    };
  }, [authUser, profileData, isOwner]);

  return {
    user: enrichedUser,
    isUserLoading: isAuthLoading,
    // Si es el dueño, los datos están listos inmediatamente gracias al perfil sintético.
    isProfileLoading: isOwner ? false : isProfileLoading,
    userError: isOwner ? null : (authError || profileError),
  };
};