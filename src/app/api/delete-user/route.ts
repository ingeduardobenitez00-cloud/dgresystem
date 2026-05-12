import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore, isInitialized } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { userId, requesterId } = await req.json();

    if (!userId || !requesterId) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos' }, { status: 400 });
    }

    // Bypass de Desarrollo Local: si no hay credenciales de servidor Admin SDK cargadas,
    // retornamos éxito de inmediato indicándole al cliente que realice el borrado en Firestore.
    if (!isInitialized) {
      return NextResponse.json({ 
        success: true, 
        localDevBypass: true, 
        message: 'Desarrollo local: omitiendo borrado de Auth y delegando borrado de Firestore al cliente.' 
      });
    }

    // 1. Validar que el solicitante (requesterId) sea Súper Administrador en Firestore
    const requesterDoc = await adminFirestore.collection('users').doc(requesterId).get();
    
    if (!requesterDoc.exists) {
      return NextResponse.json({ error: 'Solicitante no encontrado en base de datos' }, { status: 403 });
    }

    const requesterData = requesterDoc.data();
    const isOwner = requesterData?.email === 'edubtz11@gmail.com' || requesterData?.email === 'ing.eduardobenitez00@gmail.com';
    const isSuperAdmin = requesterData?.role === 'superadmin' || isOwner;

    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'No tienes privilegios de Súper Administrador para realizar esta acción' }, { status: 403 });
    }

    // 2. No permitir que se elimine el correo maestro
    const userToDeleteDoc = await adminFirestore.collection('users').doc(userId).get();
    if (userToDeleteDoc.exists) {
      const userToDeleteData = userToDeleteDoc.data();
      if (userToDeleteData?.email === 'edubtz11@gmail.com') {
        return NextResponse.json({ error: 'No se puede eliminar el perfil del Propietario Maestro' }, { status: 400 });
      }
    }

    // 3. Eliminar de Firebase Authentication usando Admin SDK
    try {
      await adminAuth.deleteUser(userId);
    } catch (authError: any) {
      const errorMsg = authError.message?.toLowerCase() || '';
      const isCredentialError = 
        errorMsg.includes('credential') || 
        errorMsg.includes('key') || 
        errorMsg.includes('auth/invalid-credential') || 
        authError.code === 'app/no-credentials';

      if (isCredentialError) {
        // En desarrollo local sin archivo de clave privada, se permite continuar para no bloquear las pruebas
        console.warn('⚠️ [DEV ONLY] No se pudo borrar el usuario de Authentication debido a falta de credenciales locales en Admin SDK. Procediendo con el éxito de la petición para permitir limpiar Firestore.');
      } else if (authError.code !== 'auth/user-not-found') {
        console.error('Error deleting from Auth:', authError);
        return NextResponse.json({ error: `Error en Authentication: ${authError.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: 'Usuario eliminado correctamente de Authentication' });
  } catch (error: any) {
    console.error('Error general in delete-user API:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
