
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, limit, query, where } from "firebase/firestore";
import * as dotenv from "dotenv";

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function inspect() {
  console.log("Inspeccionando solicitudes-capacitacion...");
  const q = query(collection(db, "solicitudes-capacitacion"), limit(50));
  const snapshot = await getDocs(q);
  
  const stats = {
    total: snapshot.size,
    byDepto: {} as any,
    byTipo: {} as any,
    concluidas: 0,
    canceladas: 0,
    pendientes: 0
  };

  snapshot.forEach(doc => {
    const data = doc.data();
    const depto = data.departamento || "SIN DEP";
    stats.byDepto[depto] = (stats.byDepto[depto] || 0) + 1;
    
    const tipo = data.tipo_solicitud || "SIN TIPO";
    stats.byTipo[tipo] = (stats.byTipo[tipo] || 0) + 1;
    
    if (data.cancelada) stats.canceladas++;
    else if (data.fecha_cumplido) stats.concluidas++;
    else stats.pendientes++;
  });

  console.log(JSON.stringify(stats, null, 2));
}

inspect().catch(console.error);
