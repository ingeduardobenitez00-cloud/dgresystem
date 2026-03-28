
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
  
  const enrichedUser = useMemo(() => {
    if (!authUser) return null;
    
    const isOwner = authUser.email === 'edubtz11@gmail.com';
    const isAdmin = isOwner || profileData?.role === 'admin';

    // PERFIL SINTÉTICO DE EMERGENCIA PARA EL PROPIETARIO
    // Si el documento en Firestore no existe o fue borrado por un intruso,
    // inyectamos un perfil con todos los privilegios para evitar errores de null en el sistema.
    let finalProfile = profileData;
    
    if (isOwner && !profileData) {
      finalProfile = {
        username: 'ADMINISTRADOR MAESTRO',
        role: 'admin',
        departamento: 'SEDE CENTRAL',
        distrito: 'ASUNCIÓN',
        active: true,
        modules: [
          'anexo-i', 'lista-anexo-i', 'solicitud-capacitacion', 'agenda-anexo-i', 
          'agenda-anexo-v', 'control-movimiento-maquinas', 'denuncia-lacres', 
          'informe-movimientos-denuncias', 'encuesta-satisfaccion', 'informe-divulgador', 
          'galeria-capacitaciones', 'informe-semanal-puntos-fijos', 'lista-anexo-iv', 
          'archivo-capacitaciones', 'divulgadores', 'estadisticas-capacitacion',
          'ficha', 'fotos', 'cargar-ficha', 'configuracion-semanal', 'informe-semanal-registro',
          'reporte-semanal-registro', 'archivo-semanal-registro', 'resumen', 'informe-general',
          'conexiones', 'locales-votacion', 'cargar-fotos-locales', 'importar-reportes',
          'importar-locales', 'importar-partidos', 'users', 'settings', 'documentacion', 'auditoria'
        ],
        permissions: ['admin_filter', 'department_filter', 'district_filter', 'assign_staff', 'generar_pdf']
      };
    }
    
    return {
      ...authUser,
      profile: finalProfile,
      isAdmin
    };
  }, [authUser, profileData]);

  return {
    user: enrichedUser,
    isUserLoading: isAuthLoading,
    isProfileLoading: isProfileLoading,
    userError: authError || profileError,
  };
};
