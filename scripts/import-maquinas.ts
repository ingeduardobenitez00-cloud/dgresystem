import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

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

function cleanExcelName(name: string) {
  if (!name) return "";
  let cleaned = name.toUpperCase();
  cleaned = cleaned.replace(/REGISTRO ELECTORAL DE /g, '');
  cleaned = cleaned.replace(/REGISTRO ELECTORAL /g, '');
  return cleaned.trim();
}

function cleanSystemName(name: string) {
  if (!name) return "";
  // Removes pattern like "00 - 00 - 01 "
  return name.replace(/^\d+\s*-\s*\d+\s*-\s*\d+\s*/, '').trim().toUpperCase();
}

async function run() {
  console.log('\n=================================================');
  console.log('   IMPORTACIÓN DE MÁQUINAS (CRUCE INTELIGENTE)');
  console.log('=================================================\n');

  if (!email || !password) {
    console.error('❌ ERROR: Credenciales no encontradas (ADMIN_EMAIL, ADMIN_PASSWORD en .env).');
    process.exit(1);
  }

  try {
    console.log('🔐 Autenticando con:', email);
    await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ Acceso concedido.\n');

    const filePath = path.join(process.cwd(), 'maquinas.xlsx');
    console.log('📄 Leyendo archivo:', filePath);
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const excelData: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    console.log(`📊 Registros en Excel detectados: ${excelData.length}`);

    // Fetch `datos`
    console.log('🔍 Obteniendo lista de distritos desde Firebase...');
    const datosSnap = await getDocs(collection(db, 'datos'));
    const systemDistritos = datosSnap.docs.map(d => d.data());
    console.log(`🗺️ Distritos en el sistema: ${systemDistritos.length}`);
    
    let processedCount = 0;
    let notFoundCount = 0;
    
    const BATCH_SIZE = 400;
    const colRef = collection(db, 'maquinas');

    for (let i = 0; i < excelData.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = excelData.slice(i, i + BATCH_SIZE);

      chunk.forEach(item => {
        const local = String(item.LOCAL || '').trim();
        const serie = String(item.SERIE || '').trim();

        if (!local || !serie) return;

        const cleanLocal = cleanExcelName(local);
        
        // Find match in system
        const match = systemDistritos.find(d => {
            const sysDist = String(d.distrito || '');
            return cleanSystemName(sysDist) === cleanLocal;
        });

        if (match) {
            const newDoc = doc(colRef);
            batch.set(newDoc, {
                codigo: serie,
                departamento: match.departamento,
                distrito: match.distrito, // Keeps original name "00 - 00 - 01 LA ENCARNACION"
                fecha_registro: new Date().toISOString()
            });
            processedCount++;
        } else {
            console.log(`⚠️ No se encontró match para: "${local}" (limpio: "${cleanLocal}")`);
            notFoundCount++;
        }
      });

      await batch.commit();
      console.log(`🚀 Progreso: Procesando lote... (Guardados hasta ahora: ${processedCount})`);
    }

    console.log(`\n✅ Proceso completado. Máquinas guardadas: ${processedCount}. No encontradas: ${notFoundCount}`);
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ ERROR:', err.message);
    process.exit(1);
  }
}

run();
