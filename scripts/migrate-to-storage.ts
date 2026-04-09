
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';
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
    const colRef = collection(db, collectionName);
    const snapshot = await getDocs(colRef);
    
    let migratedCount = 0;
    
    for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const value = data[fieldName];
        
        if (!value) continue;

        try {
            if (Array.isArray(value)) {
                // Es una galería (ej: fotos_evidencia)
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
                }
            } else {
                // Es una sola foto
                const result = await migrateValue(collectionName, docSnap.id, fieldName, value);
                if (result !== value) {
                    await updateDoc(doc(db, collectionName, docSnap.id), { [fieldName]: result });
                    migratedCount++;
                    console.log(`✅ ${docSnap.id} migrado con éxito.`);
                }
            }
        } catch (error) {
            console.error(`❌ Error migrando ${docSnap.id}:`, error);
        }
    }
    console.log(`--- Finalizado: ${migratedCount} documentos actualizados en ${collectionName} ---`);
}

async function main() {
    try {
        // Módulos principales con imágenes Base64 antiguas
        await migrateCollection('denuncias-lacres', 'foto_lacre');
        await migrateCollection('solicitudes-capacitacion', 'foto_cedula');
        await migrateCollection('anexo-i', 'foto_respaldo');
        await migrateCollection('informes-semanales-anexo-iv', 'fotos_evidencia'); // Nota: este puede ser array, requiere ajuste si es array
        await migrateCollection('users', 'photo_url');
        
        console.log('MIGRACIÓN TOTAL COMPLETADA');
    } catch (error) {
        console.error('Error global:', error);
    }
}

main();
