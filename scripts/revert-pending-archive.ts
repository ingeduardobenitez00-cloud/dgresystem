import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Setup firebase admin using FIREBASE_SERVICE_ACCOUNT_KEY env var
if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    console.error("Missing FIREBASE_SERVICE_ACCOUNT_KEY in .env.local");
    process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (getApps().length === 0) {
    initializeApp({
        credential: cert(serviceAccount)
    });
}

const db = getFirestore();

async function run() {
    console.log("Fetching all solicitudes-capacitacion...");
    const solSnap = await db.collection('solicitudes-capacitacion').get();
    
    console.log(`Found ${solSnap.size} solicitudes. Checking for improperly archived ones...`);
    let count = 0;
    
    for (const doc of solSnap.docs) {
        const data = doc.data();
        
        // We only care about items that have fecha_cumplido set but are not cancelled
        if (!data.fecha_cumplido || data.cancelada) {
            continue;
        }

        const isMM = data.es_capacitacion_mm || (data.tipo_solicitud || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes('capacitacion');
        
        // Fetch movimientos for this solicitud
        const movQuery = await db.collection('movimientos-maquinas').where('solicitud_id', '==', doc.id).limit(1).get();
        const mov = movQuery.empty ? null : movQuery.docs[0].data();
        
        let isFinished = false;

        if (isMM) {
            const totalMM = (data.cant_hombres || 0) + (data.cant_mujeres || 0);
            isFinished = !!(mov?.fecha_devolucion && totalMM > 0);
        } else {
            // Check if there's any report
            const infQuery = await db.collection('informes-divulgador').where('solicitud_id', '==', doc.id).limit(1).get();
            const hasReport = !infQuery.empty;
            isFinished = !!(mov?.fecha_devolucion && hasReport);
        }

        if (!isFinished) {
            console.log(`Reverting ${doc.id} (${data.lugar_local}) - isMM: ${isMM}, mov: ${!!mov?.fecha_devolucion}, MM count: ${(data.cant_hombres || 0) + (data.cant_mujeres || 0)}`);
            // It was archived prematurely. Remove fecha_cumplido.
            // Using update with FieldValue.delete()
            const { FieldValue } = require('firebase-admin/firestore');
            await db.collection('solicitudes-capacitacion').doc(doc.id).update({
                fecha_cumplido: FieldValue.delete()
            });
            count++;
        }
    }

    console.log(`Done! Reverted ${count} records back to the agenda.`);
}

run().catch(console.error);
