const fs = require('fs');

function refactorFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Add getDocs, getCountFromServer to imports
    if (!content.includes('getDocs')) {
        content = content.replace("writeBatch } from 'firebase/firestore';", "writeBatch, getDocs, getCountFromServer } from 'firebase/firestore';");
    }

    // 2. Remove old queries
    content = content.replace(/const movimientosQuery = useMemoFirebase[\\s\\S]*?const \\{ data: movimientosData \\} = useCollectionOnce<MovimientoMaquina>\\(movimientosQuery\\);/g, '');
    content = content.replace(/const informesQuery = useMemoFirebase[\\s\\S]*?const \\{ data: informesData \\} = useCollectionOnce<InformeDivulgador>\\(informesQuery\\);/g, '');
    content = content.replace(/const encuestasQuery = useMemoFirebase[\\s\\S]*?const \\{ data: encuestasData \\} = useCollectionOnce<EncuestaSatisfaccion>\\(encuestasQuery\\);/g, '');

    // 3. Replace old rawSolicitudes logic and insert chunk logic
    const oldRawSolicitudes = /const \\{ data: rawSolicitudes, isLoading: isLoadingSolicitudes \\} = useCollectionOnce<SolicitudCapacitacion>\\(solicitudesQuery\\);/g;
    
    const chunkFetchingLogic = `
  const { data: rawSolicitudes, isLoading: isLoadingSolicitudes } = useCollectionOnce<SolicitudCapacitacion>(solicitudesQuery);

  const [movimientosMap, setMovimientosMap] = useState<Map<string, MovimientoMaquina>>(new Map());
  const [informesMap, setInformesMap] = useState<Map<string, InformeDivulgador[]>>(new Map());

  useEffect(() => {
    if (!firestore || !rawSolicitudes || rawSolicitudes.length === 0) return;
    
    const relevantIds = rawSolicitudes
        .filter(sol => !sol.cancelada) 
        .map(sol => sol.id);
        
    if (relevantIds.length === 0) return;

    const uniqueIds = Array.from(new Set(relevantIds));
    const chunks = [];
    for (let i = 0; i < uniqueIds.length; i += 30) {
        chunks.push(uniqueIds.slice(i, i + 30));
    }

    // Fetch Movimientos
    Promise.all(chunks.map(chunk => 
        getDocs(query(collection(firestore, 'movimientos-maquinas'), where('solicitud_id', 'in', chunk)))
    )).then(snapshots => {
        const newMap = new Map();
        snapshots.forEach(snap => snap.docs.forEach(doc => newMap.set(doc.data().solicitud_id, { id: doc.id, ...doc.data() })));
        setMovimientosMap(newMap);
    }).catch(e => console.error(e));

    // Fetch Informes
    Promise.all(chunks.map(chunk => 
        getDocs(query(collection(firestore, 'informes-divulgador'), where('solicitud_id', 'in', chunk)))
    )).then(snapshots => {
        const newMap = new Map();
        snapshots.forEach(snap => snap.docs.forEach(doc => {
            const id = doc.data().solicitud_id;
            if (!newMap.has(id)) newMap.set(id, []);
            newMap.get(id).push({ id: doc.id, ...doc.data() });
        }));
        setInformesMap(newMap);
    }).catch(e => console.error(e));

  }, [firestore, rawSolicitudes]);
`;
    content = content.replace(oldRawSolicitudes, chunkFetchingLogic);

    // 4. Update core let q structure to prune past 60 days
    const regexLetQ = /let q;\\n\\s+if \\(hasAdminFilter\\) q = colRef;/g;
    content = content.replace(regexLetQ, `let q;
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - 60);
    const dateLimitStr = limitDate.toISOString().split('T')[0];
    const baseQ = query(colRef, where('fecha', '>=', dateLimitStr));
    
    if (hasAdminFilter) q = baseQ;`);

    content = content.replace(/where\\('departamento', '==', profile\\.departamento\\)\\);/g, \"where('departamento', '==', profile.departamento), where('fecha', '>=', dateLimitStr));\");
    content = content.replace(/where\\('distrito', '==', profile\\.distrito\\)\\);/g, \"where('distrito', '==', profile.distrito), where('fecha', '>=', dateLimitStr));\");

    content = content.replace(/where\\('tipo_solicitud', '==', 'Lugar Fijo'\\)\\);/g, \"where('tipo_solicitud', '==', 'Lugar Fijo'), where('fecha', '>=', dateLimitStr));\");
    content = content.replace(/where\\('tipo_solicitud', 'in', \\['divulgacion', 'capacitacion'\\]\\)\\);/g, \"where('tipo_solicitud', 'in', ['divulgacion', 'capacitacion']), where('fecha', '>=', dateLimitStr));\");


    // 5. Replace Map uses internally to groupedData
    content = content.replace(/const movMap = new Map\\(\\);\\n\\s+movimientosData\\?.+;/g, '');
    content = content.replace(/const infMap = new Map\\(\\);\\n\\s+informesData\\?.+;/g, '');

    content = content.replace(/const mov = movMap\\.get\\(sol\\.id\\);/g, 'const mov = movimientosMap.get(sol.id);');
    content = content.replace(/const inf = infMap\\.get\\(sol\\.id\\);/g, 'const inf = informesMap.get(sol.id);');

    // 6. Fix individual card accesses
    content = content.replace(/const mov = movimientosData\\?\\.find\\(m => m\\.solicitud_id === item\\.id\\);/g, 'const mov = movimientosMap.get(item.id);');
    
    content = content.replace(/const itemInformes = informesData\\?\\.filter\\(.*\\) \\|\\| \\[\\];/g, 'const itemInformes = informesMap.get(item.id) || [];');
    content = content.replace(/const itemEncuestas = encuestasData\\?\\.filter\\(.*\\) \\|\\| \\[\\];/g, '');

    // 7. Inject SurveyCounter logic
    const surveyCounterDef = `
    const SurveyCounter = ({ solicitudId, firestore }) => {
        const [count, setCount] = useState(null);
        useEffect(() => {
            if (!firestore) return;
            getCountFromServer(query(collection(firestore, 'encuestas-satisfaccion'), where('solicitud_id', '==', solicitudId)))
                .then(snap => setCount(snap.data().count))
                .catch(() => setCount(0));
        }, [firestore, solicitudId]);
        return <span className=\"text-[9px] font-black uppercase text-inherit\">ENCUESTAS: {count !== null ? count : '...'}</span>;
    };
    `;
    if (!content.includes('const SurveyCounter')) {
        content = content.replace(/return groupedData\\.length === 0/g, surveyCounterDef + '\\n        return groupedData.length === 0');
    }

    content = content.replace(/<span className="text-\\[9px\\] font-black uppercase">ENCUESTAS: \\{itemEncuestas\\.length\\}<\\/span>/g, '<SurveyCounter solicitudId={item.id} firestore={firestore} />');

    // Dependencies in groupedData
    content = content.replace(/, movimientosData, informesData/g, ', movimientosMap, informesMap');
    content = content.replace(/const isClosed = mov\\?\\.fecha_devolucion && inf;/g, 'const isClosed = mov?.fecha_devolucion && (inf && inf.length > 0);');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully Processed', filePath);
}

try {
    refactorFile('src/app/agenda-anexo-i/page.tsx');
    refactorFile('src/app/agenda-anexo-v/page.tsx');
} catch (e) {
    console.error('Error executing script', e);
}
