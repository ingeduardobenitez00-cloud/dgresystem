const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // I'll assume it's there or use default

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function debugActivities() {
  console.log('--- BUSCANDO ACTIVIDADES DE CORDILLERA ---');
  const snap = await db.collection('solicitudes-capacitacion')
    .where('departamento', '>=', '03')
    .where('departamento', '<=', '03\uf8ff')
    .limit(10)
    .get();
  
  if (snap.empty) {
    console.log('No se encontraron actividades para Cordillera (03)');
  } else {
    snap.forEach(doc => {
      const data = doc.data();
      console.log(`ID: ${doc.id} | Depto: "${data.departamento}" | Dist: "${data.distrito}" | Tipo: ${data.tipo_solicitud} | Cumplida: ${data.fecha_cumplido || 'NO'}`);
    });
  }
}

debugActivities().catch(console.error);
