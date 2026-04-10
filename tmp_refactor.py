import os

def refactor_file(file_path, is_anexo_v=False):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Imports
    if "getCountFromServer" not in content:
        content = content.replace(
            "writeBatch } from 'firebase/firestore';",
            "writeBatch, getDocs, getCountFromServer } from 'firebase/firestore';"
        )
    
    # 2. Add dependencies for the Survey component if React is missing them
    if "import React" not in content:
        pass # useState and useEffect are already imported

    # 3. Modify `solicitudesQuery` to limit to 60 days
    core_query_original = """  const solicitudesQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !profile) return null;
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    let q;
    if (hasAdminFilter) q = colRef;
    else if (hasDeptFilter && profile.departamento) q = query(colRef, where('departamento', '==', profile.departamento));
    else if (hasDistFilter && profile.departamento && profile.distrito) {
        q = query(colRef, where('departamento', '==', profile.departamento), where('distrito', '==', profile.distrito));
    } else return null;

    return query(q, where('tipo_solicitud', '""" + ("in', ['divulgacion', 'capacitacion'])" if is_anexo_v else "==', 'Lugar Fijo')") + """);
  }, [firestore, isUserLoading, profile, hasAdminFilter, hasDeptFilter, hasDistFilter]);"""

    core_query_new = """  const solicitudesQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !profile) return null;
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - 60);
    const dateLimitStr = limitDate.toISOString().split('T')[0];
    
    let q = query(colRef, where('fecha', '>=', dateLimitStr));
    
    if (hasAdminFilter) {
        // q already configured
    }
    else if (hasDeptFilter && profile.departamento) {
        q = query(colRef, where('departamento', '==', profile.departamento), where('fecha', '>=', dateLimitStr));
    }
    else if (hasDistFilter && profile.departamento && profile.distrito) {
        q = query(colRef, where('departamento', '==', profile.departamento), where('distrito', '==', profile.distrito), where('fecha', '>=', dateLimitStr));
    } else return null;

    return query(q, where('tipo_solicitud', """ + ("'in', ['divulgacion', 'capacitacion'])" if is_anexo_v else "'==', 'Lugar Fijo')") + """);
  }, [firestore, isUserLoading, profile, hasAdminFilter, hasDeptFilter, hasDistFilter]);"""

    content = content.replace(core_query_original, core_query_new)

    # 4. Remove all massive data fetches
    def remove_between(text, start, end_including):
        s_idx = text.find(start)
        if s_idx == -1: return text
        e_idx = text.find(end_including, s_idx)
        if e_idx == -1: return text
        e_idx += len(end_including)
        return text[:s_idx] + text[e_idx:]

    content = remove_between(content, "const movimientosQuery = useMemoFirebase(() => {", "const { data: movimientosData } = useCollectionOnce<MovimientoMaquina>(movimientosQuery);")
    content = remove_between(content, "const informesQuery = useMemoFirebase(() => {", "const { data: informesData } = useCollectionOnce<InformeDivulgador>(informesQuery);")
    content = remove_between(content, "const encuestasQuery = useMemoFirebase(() => {", "const { data: encuestasData } = useCollectionOnce<EncuestaSatisfaccion>(encuestasQuery);")

    # 5. Insert exact chunk queries for movimientos & informes
    raw_solic_hook = "const { data: rawSolicitudes, isLoading: isLoadingSolicitudes } = useCollectionOnce<SolicitudCapacitacion>(solicitudesQuery);\n"
    
    chunk_logic = """
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

    Promise.all(chunks.map(chunk => 
        getDocs(query(collection(firestore, 'movimientos-maquinas'), where('solicitud_id', 'in', chunk)))
    )).then(snapshots => {
        const newMap = new Map();
        snapshots.forEach(snap => snap.docs.forEach(doc => newMap.set(doc.data().solicitud_id, { id: doc.id, ...doc.data() })));
        setMovimientosMap(newMap);
    }).catch(e => console.error(e));

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
"""

    if "const [movimientosMap" not in content:
        content = content.replace(raw_solic_hook, raw_solic_hook + chunk_logic)

    # 6. Apply mapped states in groupedData
    content = content.replace("movimientosData?.forEach(m => { if(!movMap.has(m.solicitud_id)) movMap.set(m.solicitud_id, m); });", "// use direct maps")
    content = content.replace("informesData?.forEach(i => { if(!infMap.has(i.solicitud_id)) infMap.set(i.solicitud_id, i); });", "// use direct maps")
    content = content.replace("const movMap = new Map();", "")
    content = content.replace("const infMap = new Map();", "")

    content = content.replace("const mov = movMap.get(sol.id);", "const mov = movimientosMap.get(sol.id);")
    content = content.replace("const inf = infMap.get(sol.id);", "const infDocs = informesMap.get(sol.id); const inf = infDocs && infDocs.length > 0 ? infDocs[0] : null;")

    # 7. Apply mapping in Render section
    content = content.replace(
        "const mov = movimientosData?.find(m => m.solicitud_id === item.id);",
        "const mov = movimientosMap.get(item.id);"
    )
    content = content.replace(
        "const itemInformes = informesData?.filter(i => i.solicitud_id === item.id) || [];",
        "const itemInformes = informesMap.get(item.id) || [];"
    )
    content = content.replace(
        "const itemEncuestas = encuestasData?.filter(e => e.solicitud_id === item.id) || [];",
        ""
    )

    # 8. Survey counter & Dependencies
    content = content.replace(
        "], [rawSolicitudes, datosData, movimientosData, informesData, currentTime, agendaSearch]);",
        "], [rawSolicitudes, datosData, movimientosMap, informesMap, currentTime, agendaSearch]);"
    )

    survey_component = """const SurveyCounter = ({ solicitudId, firestore }: any) => {
                                    const [count, setCount] = useState<number | null>(null);
                                    useEffect(() => {
                                        if (!firestore) return;
                                        getCountFromServer(query(collection(firestore, 'encuestas-satisfaccion'), where('solicitud_id', '==', solicitudId)))
                                            .then(snap => setCount(snap.data().count))
                                            .catch(() => setCount(0));
                                    }, [firestore, solicitudId]);
                                    return <span className="text-[9px] font-black uppercase text-inherit">ENCUESTAS: {count !== null ? count : '...'}</span>;
                                };\n\n                                return ("""

    if "const SurveyCounter" not in content:
        content = content.replace("return (\n                                    <Card", survey_component + "\n                                    <Card")

    content = content.replace(
        '<span className="text-[9px] font-black uppercase">ENCUESTAS: {itemEncuestas.length}</span>',
        '<SurveyCounter solicitudId={item.id} firestore={firestore} />'
    )

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)


refactor_file('c:/dgre/src/app/agenda-anexo-i/page.tsx', False)
refactor_file('c:/dgre/src/app/agenda-anexo-v/page.tsx', True)
print("SUCCESS")
