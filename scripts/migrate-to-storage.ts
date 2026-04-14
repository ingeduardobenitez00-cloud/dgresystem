
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc, query, where, limit, startAfter, orderBy } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import * as dotenv from 'dotenv';

dotenv.config();

const firebaseConfig = {
    projectId: "studio-1827480670-a09b0",
    appId: "1:177194041005:web:802f6167cd0c9275d19024",
    apiKey: "AIzaSyDSgDKEI3VvXae8hMfePipJp3L7CUfArBw",
    authDomain: "studio-1827480670-a09b0.firebaseapp.com",
    storageBucket: "studio-1827480670-a09b0.firebasestorage.app",
    messagingSenderId: "177194041005"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

async function migrateValue(collectionName: string, docId: string, fieldName: string, value: string, suffix: string = ''): Promise<string> {
    if (!value || typeof value !== 'string' || value.startsWith('http') || !value.startsWith('data:')) {
        return value;
    }
    const storagePath = `${collectionName}/${docId}_${fieldName}${suffix}_legacy`;
    const storageRef = ref(storage, storagePath);
    await uploadString(storageRef, value, 'data_url');
    return await getDownloadURL(storageRef);
}

async function migrateCollection(collectionName: string, fieldName: string) {
    console.log(`--- Iniciando migración de col: ${collectionName} [campo: ${fieldName}] ---`);
    let lastDoc = null;
    let migratedCount = 0;
    let totalProcessed = 0;
    const BATCH_SIZE = 20; // Tamaño pequeño por el peso de los base64
    
    while (true) {
        let snapshot;
        if (lastDoc) {
            snapshot = await getDocs(query(collection(db, collectionName), orderBy('__name__'), startAfter(lastDoc), limit(BATCH_SIZE)));
        } else {
            snapshot = await getDocs(query(collection(db, collectionName), orderBy('__name__'), limit(BATCH_SIZE)));
        }
        if (snapshot.empty) break;
        
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        
        // Process batch in parallel
        await Promise.all(snapshot.docs.map(async (docSnap) => {
            totalProcessed++;
            const data = docSnap.data();
            const value = data[fieldName];
            
            if (!value) return;

            try {
                if (Array.isArray(value)) {
                    const newUrls = [];
                    let changed = false;
                    for (let i = 0; i < value.length; i++) {
                        const result = await migrateValue(collectionName, docSnap.id, fieldName, value[i], `_${i}`);
                        if (result !== value[i]) changed = true;
                        newUrls.push(result);
                    }
                    if (changed) {
                        await updateDoc(doc(db, collectionName, docSnap.id), { [fieldName]: newUrls });
                        migratedCount++;
                        console.log(`✅ [${totalProcessed}] ${docSnap.id} migrado (Array).`);
                    }
                } else {
                    const result = await migrateValue(collectionName, docSnap.id, fieldName, value);
                    if (result !== value) {
                        await updateDoc(doc(db, collectionName, docSnap.id), { [fieldName]: result });
                        migratedCount++;
                        console.log(`✅ [${totalProcessed}] ${docSnap.id} migrado (Single).`);
                    }
                }
            } catch (error) {
                console.error(`❌ Error migrando ${docSnap.id}:`, error);
            }
        }));
        console.log(`... Progresando: ${totalProcessed} documentos procesados en ${collectionName}`);
    }
    console.log(`--- Finalizado: ${migratedCount} documentos actualizados en ${collectionName} ---`);
}

async function main() {
    try {
        // Módulos principales con imágenes Base64 antiguas
        // Módulos con imágenes Base64 antiguas
        await migrateCollection('informes-divulgador', 'fotos');
        await migrateCollection('informes-divulgador', 'foto_respaldo_documental');
        
        await migrateCollection('movimientos-maquinas', 'foto_salida');
        await migrateCollection('movimientos-maquinas', 'foto_devolucion');
        
        await migrateCollection('denuncias-lacres', 'foto_evidencia');
        await migrateCollection('denuncias-lacres', 'foto_respaldo_documental');
        
        await migrateCollection('solicitudes-capacitacion', 'foto_firma');
        
        await migrateCollection('anexo-i', 'foto_respaldo');
        
        await migrateCollection('locales-votacion', 'foto_frente');
        await migrateCollection('locales-votacion', 'foto2');
        await migrateCollection('locales-votacion', 'foto3');
        await migrateCollection('locales-votacion', 'foto4');
        await migrateCollection('locales-votacion', 'foto5');
        
        await migrateCollection('users', 'photo_url');
        
        console.log('MIGRACIÓN TOTAL COMPLETADA');
    } catch (error) {
        console.error('Error global:', error);
    }
}

main();
