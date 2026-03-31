
/**
 * @fileOverview Script de importación masiva optimizado para el Padrón Electoral.
 * Procesa archivos de gran volumen en bloques de 10,000 registros con pausas de enfriamiento.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, writeBatch, doc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

// Configuración de Firebase
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
  console.log('   MOTOR DE IMPORTACIÓN MASIVA V5.0 - PADRÓN');
  console.log('=================================================\n');

  if (!email || !password) {
    console.error('❌ ERROR: Credenciales no encontradas.');
    console.log('Uso: ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run import:padron\n');
    process.exit(1);
  }

  try {
    console.log('🔐 Autenticando administrador...');
    await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ Acceso concedido.\n');

    let filesProcessedCount = 0;
    // Escaneamos hasta 30 archivos para detectar cedula18.xlsx
    for (let i = 1; i <= 30; i++) {
      const fileName = `cedula${i}.xlsx`;
      const filePath = path.join(process.cwd(), 'scripts', fileName);
      
      if (fs.existsSync(filePath)) {
        const success = await importFile(fileName, filePath);
        if (success) filesProcessedCount++;
      }
    }

    if (filesProcessedCount === 0) {
      console.log('⚠️ No se encontraron archivos cedulaX.xlsx en la carpeta /scripts/');
      console.log('Asegúrese de que el archivo esté en: scripts/cedula18.xlsx\n');
    } else {
      console.log('\n🏁 PROCESO FINALIZADO EXITOSAMENTE PARA TODOS LOS ARCHIVOS.');
    }
    
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ ERROR FATAL:', err.message);
    process.exit(1);
  }
}

async function importFile(fileName: string, filePath: string): Promise<boolean> {
  console.log(`\n📄 PROCESANDO: ${fileName}`);
  console.log('-------------------------------------------------');
  
  try {
    const startTime = Date.now();
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

    const total = data.length;
    console.log(`📊 Registros detectados: ${total.toLocaleString()}`);

    const colRef = collection(db, 'padron');
    
    // Configuración de límites de carga
    const BATCH_SIZE = 400; // Reducido para evitar saturación de payload
    const COOLDOWN_CHUNK = 10000; // Pausa cada 10k registros como solicitó el usuario
    
    let processedCount = 0;

    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = data.slice(i, i + BATCH_SIZE);

      chunk.forEach((item) => {
        const newDoc = doc(colRef);
        batch.set(newDoc, {
          cedula: String(item.NUMERO_CED || item.numero_ced || '').trim(),
          apellido: String(item.APELLIDO || item.apellido || '').trim(),
          nombre: String(item.NOMBRE || item.nombre || '').trim(),
          sexo: String(item.SEXO || item.sexo || '').trim(),
          nacional: String(item.NACIONAL || item.nacional || '').trim(),
          nom_padre: String(item.NOM_PADRE || item.nom_padre || '').trim(),
          nom_madre: String(item.NOM_MADRE || item.nom_madre || '').trim(),
          direccion: String(item.DIRECCION || item.direccion || '').trim(),
          nom_conj: String(item.NOM_CONJ || item.nom_conj || '').trim(),
          fecha_naci: String(item.FECHA_NACI || item.fecha_naci || '').trim(),
          barrio_ciu: String(item.BARRIO_CIU || item.barrio_ciu || '').trim(),
          archivo_origen: fileName,
          fecha_carga: new Date().toISOString()
        });
      });

      await batch.commit();
      processedCount += chunk.length;
      
      const percent = Math.round((processedCount / total) * 100);
      process.stdout.write(`\r🚀 Progreso: ${processedCount.toLocaleString()} / ${total.toLocaleString()} (${percent}%)`);
      
      // Lógica de pausas de estabilidad
      if (processedCount % COOLDOWN_CHUNK === 0) {
          process.stdout.write(`\n⏸️ Pausa de estabilidad (3s) para enfriar conexión...`);
          await new Promise(res => setTimeout(res, 3000));
          console.log('\n');
      } else {
          // Micro-pausa entre batches
          await new Promise(res => setTimeout(res, 150));
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n\n✅ ${fileName} completado en ${duration}s.`);
    return true;
  } catch (e: any) {
    console.error(`\n❌ Error en ${fileName}:`, e.message);
    return false;
  }
}

run();
