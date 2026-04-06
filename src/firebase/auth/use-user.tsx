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

export const CIDEE_MODULES = [
  'calendario-capacitaciones', 'anexo-i', 'lista-anexo-i', 'solicitud-capacitacion', 'agenda-anexo-i', 
  'agenda-anexo-v', 'maquinas', 'control-movimiento-maquinas', 'denuncia-lacres', 
  'informe-movimientos-denuncias', 'informe-divulgador', 'galeria-capacitaciones', 
  'informe-semanal-puntos-fijos', 'lista-anexo-iv', 'divulgadores', 'estadisticas-capacitacion',
  'encuesta-satisfaccion', 'archivo-capacitaciones', 'reportes-pdf'
];

export const JEFE_MODULES = [
  'calendario-capacitaciones', 'anexo-i', 'lista-anexo-i', 'solicitud-capacitacion', 'agenda-anexo-i', 
  'agenda-anexo-v', 'maquinas', 'control-movimiento-maquinas', 'denuncia-lacres', 
  'informe-divulgador', 'informe-semanal-puntos-fijos', 'lista-anexo-iv', 
  'encuesta-satisfaccion', 'archivo-capacitaciones', 'reportes-pdf'
];

export type AppUser = User & {
  profile?: UserProfile | null;
  isAdmin?: boolean;
  isOwner?: boolean;
  isStaff?: boolean;
  isCideeStaff?: boolean;
  isJefeStaff?: boolean;
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
  const isOwner = [
    'edubtz11@gmail.com',
    'eduardobritz1@gmail.com',
    'eduardobritz11@gmail.com',
    'edubtz100@gmail.com',
    'ing.eduardobenitez00@gmail.com'
  ].includes(email);

  const enrichedUser = useMemo(() => {
    if (!authUser) return null;
    
    // PERFIL SINTÉTICO DE EMERGENCIA PARA EL DUEÑO
    // Si el correo coincide, otorgamos acceso total ignorando el estado de Firestore.
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
        'importar-locales', 'importar-partidos', 'users', 'settings', 'documentacion', 'auditoria',
        'reportes-pdf'
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
          username: profileData?.username || 'SÚPER ADMINISTRADOR',
          role: 'admin' as const,
          active: true,
          departamento: profileData?.departamento || 'SEDE CENTRAL',
          distrito: profileData?.distrito || 'ASUNCIÓN',
          modules: allModules,
          permissions: allPermissions
        },
        isAdmin: true,
        isOwner: true,
        isStaff: true
      };
    }
    
    const role = profileData?.role;
    const isStaff = role === 'admin' || role === 'director' || role === 'coordinador' || role === 'jefe';
    const isCideeStaff = role === 'coordinador';
    const isJefeStaff = role === 'jefe';

    let modules = profileData?.modules || [];
    let permissions = profileData?.permissions || [];

    // ASIGNACIÓN AUTOMÁTICA DE MÓDULOS Y PERMISOS POR ROL
    if (isCideeStaff && modules.length === 0) {
      modules = [...CIDEE_MODULES];
      CIDEE_MODULES.forEach(m => ['view', 'add', 'pdf'].forEach(a => permissions.push(`${m}:${a}`)));
    } else if (isJefeStaff && modules.length === 0) {
      modules = [...JEFE_MODULES];
      JEFE_MODULES.forEach(m => ['view', 'add', 'pdf'].forEach(a => permissions.push(`${m}:${a}`)));
    }

    return {
      ...authUser,
      profile: {
        ...profileData,
        modules: modules.length > 0 ? modules : profileData?.modules,
        permissions: permissions.length > 0 ? permissions : profileData?.permissions,
        username: profileData?.username || (isStaff ? role?.toUpperCase() : 'USUARIO'),
        role: profileData?.role || (isStaff ? role : 'funcionario'),
        active: profileData?.active ?? true,
        departamento: profileData?.departamento || '',
        distrito: profileData?.distrito || ''
      },
      isAdmin: role === 'admin',
      isOwner: isOwner,
      isStaff,
      isCideeStaff,
      isJefeStaff
    };
  }, [authUser, profileData, isOwner]);

  return {
    user: enrichedUser,
    isUserLoading: isAuthLoading,
    isProfileLoading: isOwner ? false : isProfileLoading,
    userError: isOwner ? null : (authError || profileError),
  };
};
