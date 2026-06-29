import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query } from "firebase/firestore";
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

async function calcularEstadisticas() {
  console.log("📊 Obteniendo datos de Firebase...");

  // 1. Obtener la lista maestra de departamentos y distritos
  const datosSnapshot = await getDocs(collection(db, "datos"));
  const masterDistritos = new Set<string>();
  const distritosPorDepto: Record<string, string[]> = {};
  let totalDistritosOficiales = 0;

  datosSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.departamento && data.distrito) {
      const depto = data.departamento.toUpperCase().trim();
      const dist = data.distrito.toUpperCase().trim();
      const key = `${depto}||${dist}`;
      
      if (!masterDistritos.has(key)) {
        masterDistritos.add(key);
        if (!distritosPorDepto[depto]) distritosPorDepto[depto] = [];
        distritosPorDepto[depto].push(dist);
        totalDistritosOficiales++;
      }
    }
  });

  // 2. Obtener el uso real del sistema (Solicitudes de Capacitación / Actividades)
  const solicitudesSnapshot = await getDocs(collection(db, "solicitudes-capacitacion"));
  const distritosConUso = new Set<string>();
  let totalSolicitudes = 0;

  solicitudesSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.departamento && data.distrito) {
      const depto = data.departamento.toUpperCase().trim();
      const dist = data.distrito.toUpperCase().trim();
      distritosConUso.add(`${depto}||${dist}`);
      totalSolicitudes++;
    }
  });

  // 3. Procesar resultados
  const faltantes: Record<string, string[]> = {};
  let distritosUsados = 0;

  masterDistritos.forEach(key => {
    if (distritosConUso.has(key)) {
      distritosUsados++;
    } else {
      const [depto, dist] = key.split("||");
      if (!faltantes[depto]) faltantes[depto] = [];
      faltantes[depto].push(dist);
    }
  });

  // 4. Imprimir Reporte
  console.log("\n========================================================");
  console.log("🏆 REPORTE GLOBAL DE USO DEL SISTEMA (DGRE - CIDEE)");
  console.log("========================================================");
  console.log(`📌 Total de Departamentos registrados: ${Object.keys(distritosPorDepto).length}`);
  console.log(`📌 Total de Distritos a nivel país: ${totalDistritosOficiales}`);
  console.log(`📈 Actividades Operativas Registradas (Solicitudes): ${totalSolicitudes}`);
  
  if (totalDistritosOficiales > 0) {
    const porcentaje = ((distritosUsados / totalDistritosOficiales) * 100).toFixed(2);
    console.log(`\n✅ DISTRITOS CON USO DEL SISTEMA: ${distritosUsados} (${porcentaje}%)`);
    console.log(`❌ DISTRITOS QUE AÚN NO UTILIZARON: ${totalDistritosOficiales - distritosUsados} (${(100 - parseFloat(porcentaje)).toFixed(2)}%)`);
  }

  console.log("\n========================================================");
  console.log("🚨 DETALLE DE DISTRITOS FALTANTES (SIN ACTIVIDAD):");
  console.log("========================================================");
  
  for (const depto in faltantes) {
    console.log(`\n📍 ${depto} (${faltantes[depto].length} distritos faltantes):`);
    console.log(`   - ${faltantes[depto].join(', ')}`);
  }
  
  if (Object.keys(faltantes).length === 0) {
    console.log("¡Felicidades! Todos los distritos del país tienen uso registrado.");
  }
  
  console.log("\n========================================================");
  process.exit(0);
}

calcularEstadisticas().catch(error => {
  console.error("Error al calcular estadísticas:", error);
  process.exit(1);
});
