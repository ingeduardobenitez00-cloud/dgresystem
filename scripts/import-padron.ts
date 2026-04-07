/**
 * @fileOverview Motor de Importación Ultra-Estable para Padrón Electoral V6.0.
 * Diseñado para evitar bloqueos por saturación en cargas de gran volumen (500k+).
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, writeBatch, doc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const firebaseConfig = {
  "projectId": "studio-1827480670-a09b0",
  "appId": "1:177194041005:web:802f6167cd0c9275d19024",
  "apiKey": "AIzaSyDSgDKEI3VvXae8hMfePipJp3L7CUfArBw",
  "authDomain": "studio-1827480670-a09b0.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "177194041005"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

async function run() {
  console.log('\n=================================================');
  console.log('   MOTOR DE IMPORTACIÓN ULTRA-ESTABLE V6.0');
  console.log('=================================================\n');

  if (!email || !password) {
    console.error('❌ ERROR: Credenciales no encontradas.');
    process.exit(1);
  }

  try {
    console.log('🔐 Autenticando con:', email);
    await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ Acceso concedido.\n');

    let processedCount = 0;
    // Buscamos hasta el archivo 30 para asegurar que encontremos cedula18.xlsx
    for (let i = 1; i <= 30; i++) {
      const fileName = `cedula${i}.xlsx`;
      const filePath = path.join(process.cwd(), 'scripts', fileName);
      if (fs.existsSync(filePath)) {
        await importFile(fileName, filePath);
        processedCount++;
      }
    }

    if (processedCount === 0) {
      console.log('⚠️ No se encontraron archivos en scripts/ (Buscando cedula1.xlsx hasta cedula30.xlsx)');
    }
    
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ ERROR CRÍTICO:', err.message);
    process.exit(1);
  }
}

async function importFile(fileName: string, filePath: string) {
  console.log(`\n📄 INICIANDO PROCESO: ${fileName}`);
  
  const startTime = Date.now();
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  console.log(`📊 Registros detectados: ${data.length.toLocaleString()}`);

  // Configuración de ráfaga ultra-segura para 500,000 registros
  const BATCH_SIZE = 500; // Máximo permitido por Firestore para writeBatch
  const STABILITY_PAUSE = 2000; // 2 segundos cada 20,000 registros para refrescar la conexión
  
  let currentCount = 0;
  const colRef = collection(db, 'padron');

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = data.slice(i, i + BATCH_SIZE);

    chunk.forEach(item => {
      const newDoc = doc(colRef);
      batch.set(newDoc, {
        cedula: String(item.NUMERO_CED || item.numero_ced || '').trim(),
        apellido: String(item.APELLIDO || item.apellido || '').trim(),
        nombre: String(item.NOMBRE || item.nombre || '').trim(),
        sexo: String(item.SEXO || item.sexo || '').trim(),
        nacional: String(item.NACIONAL || item.nacional || '').trim(),
        direccion: String(item.DIRECCION || item.direccion || '').trim(),
        fecha_naci: String(item.FECHA_NACI || item.fecha_naci || '').trim(),
        barrio_ciu: String(item.BARRIO_CIU || item.barrio_ciu || '').trim(),
        archivo_origen: fileName,
        fecha_importacion: new Date().toISOString()
      });
    });

    try {
      await batch.commit();
      currentCount += chunk.length;
      
      const percent = Math.round((currentCount / data.length) * 100);
      process.stdout.write(`\r🚀 Progreso: ${currentCount.toLocaleString()} / ${data.length.toLocaleString()} (${percent}%)`);

      // Control de flujo para estabilidad térmica de la conexión gRPC
      if (currentCount % 20000 === 0) {
        console.log(`\n⏳ Estabilizando conexión (registros: ${currentCount.toLocaleString()})...`);
        await new Promise(res => setTimeout(res, STABILITY_PAUSE));
      } else {
        await new Promise(res => setTimeout(res, 50)); // Micro-pausa obligatoria entre commits
      }
    } catch (e: any) {
      console.error(`\n❌ Error en lote (registros ${currentCount}-${currentCount + BATCH_SIZE}):`, e.message);
      // Reintentar tras una pausa larga si falla por congestión
      console.log('⏳ Esperando 5 segundos para reintentar...');
      await new Promise(res => setTimeout(res, 5000));
      i -= BATCH_SIZE; // Reintentar este mismo lote
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n✅ ${fileName} finalizado en ${duration}s.`);
}

run();