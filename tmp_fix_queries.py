import os
import re

def fix_file(file_path, is_anexo_v=False):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Match the entire problem block
    pattern = re.compile(r"  const solicitudesQuery = useMemoFirebase\(\(\) => \{.+?return query\(q, where\('tipo_solicitud', [^\)]+\)\);\n  \}, \[firestore, isUserLoading, profile, hasAdminFilter, hasDeptFilter, hasDistFilter\]\);", re.DOTALL)
    
    original_hook = """  const solicitudesQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !profile) return null;
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    let q;
    if (hasAdminFilter) q = colRef;
    else if (hasDeptFilter && profile.departamento) q = query(colRef, where('departamento', '==', profile.departamento));
    else if (hasDistFilter && profile.departamento && profile.distrito) {
        q = query(colRef, where('departamento', '==', profile.departamento), where('distrito', '==', profile.distrito));
    } else return null;

    """ + ("return query(q, where('tipo_solicitud', 'in', ['divulgacion', 'capacitacion']));" if is_anexo_v else "return query(q, where('tipo_solicitud', '==', 'Lugar Fijo'));") + """
  }, [firestore, isUserLoading, profile, hasAdminFilter, hasDeptFilter, hasDistFilter]);"""

    content = pattern.sub(original_hook, content)

    # Insert client side filtering locally
    filter_hook_orig = r"const relevantIds = rawSolicitudes\s+\.filter\(sol => !sol\.cancelada\)"
    filter_hook_new = """const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - 60);
    const dateLimitStr = limitDate.toISOString().split('T')[0];

    const relevantIds = rawSolicitudes
        .filter(sol => !sol.cancelada && sol.fecha >= dateLimitStr)"""
    
    content = re.sub(filter_hook_orig, filter_hook_new, content)

    # Add same limit to groupedData
    grouped_base_orig = r"const activeSolicitudes = rawSolicitudes\.filter\(sol => \{\s*if \(sol\.cancelada\) return false;"
    grouped_base_new = """const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - 60);
    const dateLimitStr = limitDate.toISOString().split('T')[0];

    const activeSolicitudes = rawSolicitudes.filter(sol => {
        if (sol.cancelada || sol.fecha < dateLimitStr) return false;"""
    
    content = re.sub(grouped_base_orig, grouped_base_new, content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

fix_file('src/app/agenda-anexo-i/page.tsx', False)
fix_file('src/app/agenda-anexo-v/page.tsx', True)
print("SUCCESS")
