import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  "projectId": "studio-1827480670-a09b0",
  "appId": "1:177194041005:web:802f6167cd0c9275d19024",
  "apiKey": "AIzaSyDSgDKEI3VvXae8hMfePipJp3L7CUfArBw",
  "authDomain": "studio-1827480670-a09b0.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "177194041005",
  "storageBucket": "studio-1827480670-a09b0.firebasestorage.app"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function inspect() {
  console.log("Inspeccionando coleccion 'maquinas'...");
  const snapshot = await getDocs(collection(db, "maquinas"));
  console.log(`Total maquinas en DB: ${snapshot.size}`);
  
  const byDist: Record<string, number> = {};
  const sample: any[] = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    const key = `${data.departamento} || ${data.distrito}`;
    byDist[key] = (byDist[key] || 0) + 1;
    if (String(data.distrito).includes("LOMA GRANDE")) {
      sample.push({ id: doc.id, ...data });
    }
  });

  console.log("Distribucion por distrito:", JSON.stringify(byDist, null, 2));
  console.log("Muestras de Loma Grande:", JSON.stringify(sample, null, 2));
}

inspect().catch(console.error);
