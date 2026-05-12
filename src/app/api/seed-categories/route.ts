import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, doc, writeBatch } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import { DEFAULT_CATEGORIES } from '@/lib/default-categories';

export async function GET() {
  try {
    // Inicializar Firebase Client-side SDK de manera segura en el servidor de Next.js
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getFirestore(app);

    const batch = writeBatch(db);

    DEFAULT_CATEGORIES.forEach((cat) => {
      const docRef = doc(collection(db, 'modulo_clasificaciones'), cat.id);
      batch.set(docRef, {
        label: cat.label,
        description: cat.description,
        modules: cat.modules,
        orden: cat.orden
      });
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: 'Base de datos sembrada con éxito con las clasificaciones por defecto.',
      seededCount: DEFAULT_CATEGORIES.length,
      categories: DEFAULT_CATEGORIES.map(c => c.label)
    });
  } catch (error: any) {
    console.error('Error al sembrar categorías:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error desconocido'
    }, { status: 500 });
  }
}
