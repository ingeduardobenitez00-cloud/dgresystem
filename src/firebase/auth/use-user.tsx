'use client';
import { useMemo } from 'react';
import { useFirebase, useMemoFirebase } from '../provider';
import { useDocOnce } from '../firestore/use-doc-once';
import { doc } from 'firebase/firestore';
import { type User } from 'firebase/auth';

export interface UserProfile {
  username?: string;
  role?: 'admin' | 'superadmin' | 'director' | 'coordinador' | 'jefe' | 'funcionario' | 'viewer';
  departamento?: string;
  distrito?: string;
  modules?: string[];
  permissions?: string[];
  cedula?: string;
  vinculo?: 'PERMANENTE' | 'CONTRATADO' | 'COMISIONADO' | string;
  active?: boolean;
  registration_method?: string;
  photo_url?: string | null;
}

export const CIDEE_MODULES = [
  'calendario-capacitaciones', 'anexo-i', 'lista-anexo-i', 'solicitud-capacitacion', 'agenda-anexo-i', 
  'agenda-anexo-v', 'maquinas', 'control-movimiento-maquinas', 'denuncia-lacres', 
  'informe-movimientos-denuncias', 'informe-divulgador', 'galeria-capacitaciones', 
  'informe-semanal-puntos-fijos', 'lista-anexo-iv', 'divulgadores', 
  'encuesta-satisfaccion', 'archivo-capacitaciones', 'reportes-pdf', 'puntos-fijos'
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
  isSuperAdmin?: boolean;
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

  const { data: profileData, isLoading: isProfileLoading, error: profileError } = useDocOnce<UserProfile>(userProfileDocRef);
  
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
        'archivo-capacitaciones', 'divulgadores', 
        'ficha', 'fotos', 'cargar-ficha', 'configuracion-semanal', 'informe-semanal-registro',
        'reporte-semanal-registro', 'archivo-semanal-registro', 'resumen', 'informe-general',
        'conexiones', 'locales-votacion', 'cargar-fotos-locales', 'importar-reportes',
        'importar-locales', 'importar-partidos', 'users', 'settings', 'documentacion', 'auditoria',
        'reportes-pdf', 'puntos-fijos', 'estadisticas-solicitudes'
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
          username: profileData?.username || authUser.displayName || 'SÚPER ADMINISTRADOR',
          role: 'superadmin' as const,
          active: true,
          departamento: profileData?.departamento || 'SEDE CENTRAL',
          distrito: profileData?.distrito || 'ASUNCIÓN',
          photo_url: profileData?.photo_url || authUser.photoURL || null,
          modules: allModules,
          permissions: allPermissions
        },
        isAdmin: true,
        isSuperAdmin: true,
        isOwner: true,
        isStaff: true
      };
    }
    
    const role = profileData?.role;
    const isSuperAdmin = role === 'superadmin' || isOwner;
    const isAdmin = role === 'admin' || role === 'director' || isSuperAdmin;
    const isStaff = isAdmin || role === 'coordinador' || role === 'jefe';
    const isCideeStaff = role === 'coordinador';
    const isJefeStaff = role === 'jefe';

    let enrichedModules = [...(profileData?.modules || [])];
    let enrichedPermissions = [...(profileData?.permissions || [])];

    // ASIGNACIÓN AUTOMÁTICA DE MÓDULOS Y PERMISOS POR ROL
    if (isCideeStaff && enrichedModules.length === 0) {
      enrichedModules = [...CIDEE_MODULES];
      const autoPerms: string[] = [];
      CIDEE_MODULES.forEach(m => ['view', 'add', 'pdf'].forEach(a => autoPerms.push(`${m}:${a}`)));
      enrichedPermissions = [...new Set([...enrichedPermissions, ...autoPerms])];
    } else if (isJefeStaff && enrichedModules.length === 0) {
      enrichedModules = [...JEFE_MODULES];
      const autoPerms: string[] = [];
      JEFE_MODULES.forEach(m => ['view', 'add', 'pdf'].forEach(a => autoPerms.push(`${m}:${a}`)));
      enrichedPermissions = [...new Set([...enrichedPermissions, ...autoPerms])];
    }

    return {
      ...authUser,
      profile: {
        ...profileData,
        modules: enrichedModules.length > 0 ? enrichedModules : profileData?.modules,
        permissions: enrichedPermissions.length > 0 ? enrichedPermissions : profileData?.permissions,
        username: profileData?.username || authUser.displayName || (isStaff ? role?.toUpperCase() : 'USUARIO'),
        photo_url: profileData?.photo_url || authUser.photoURL || null,
        role: profileData?.role || (isStaff ? role : 'funcionario'),
        active: profileData?.active ?? true,
        departamento: profileData?.departamento || '',
        distrito: profileData?.distrito || ''
      },
      isAdmin,
      isSuperAdmin,
      isOwner: isOwner,
      isStaff,
      isCideeStaff,
      isJefeStaff
    };
  }, [authUser, profileData, isOwner]);

  const result = useMemo(() => ({
    user: enrichedUser,
    isUserLoading: isAuthLoading || (!!authUser && isProfileLoading && !isOwner),
    isProfileLoading: isOwner ? false : isProfileLoading,
    userError: isOwner ? null : (authError || profileError),
  }), [enrichedUser, isAuthLoading, isProfileLoading, isOwner, authError, profileError, authUser]);

  return result;
}
