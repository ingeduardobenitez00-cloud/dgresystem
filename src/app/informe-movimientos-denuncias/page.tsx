
"use client";

import { useMemo, useState, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useUser, useFirebase, useCollectionOnce, useCollectionPaginated, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { type MovimientoMaquina, type Dato } from '@/lib/data';
import { Loader2, ArrowLeftRight, ShieldAlert, Building2, Landmark, Search, Calendar, MapPin, Truck, Undo2, FileWarning, ChevronDown, Check, ChevronsUpDown, Activity, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDateToDDMMYYYY, cn, normalizeGeo } from '@/lib/utils';

function MovementRow({ mov, denuncias }: { mov: MovimientoMaquina, denuncias?: any[] }) {
    const hasDenuncia = denuncias?.some(d => d.solicitud_id === mov.solicitud_id);
    const hasIrregularidadKits = mov.maquinas?.some(maq => 
        (maq.credencial && !maq.retorno_credencial) || 
        (maq.auricular && !maq.retorno_auricular) || 
        (maq.acrilico && !maq.retorno_acrilico) || 
        (maq.boletas && !maq.retorno_boletas)
    );
    
    return (
        <Card key={mov.id} className={cn(
            "border-2 shadow-md transition-all rounded-2xl overflow-hidden",
            hasDenuncia ? "border-destructive bg-destructive/[0.03]" : "border-muted/20 bg-white"
        )}>
            <div className="flex flex-col md:flex-row">
                {/* INDICADOR LATERAL */}
                <div className={cn(
                    "w-full md:w-2 min-h-[4px]",
                    hasDenuncia ? "bg-destructive" : "bg-primary/20"
                )} />
                
                <div className="flex-1 p-6">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                        <div className="md:col-span-4 space-y-2">
                            <div className="flex items-start gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                <span className="font-black uppercase text-[11px] leading-snug">{mov.departamento} - {mov.distrito}</span>
                            </div>
                            <div className="flex flex-col gap-2 mt-2">
                                {mov.maquinas?.map((maq, i) => (
                                    <div key={i} className="flex flex-col gap-1.5 border border-primary/10 rounded-xl p-2.5 bg-slate-50/50">
                                        <Badge variant="outline" className={cn(
                                            "font-black text-[9px] uppercase whitespace-nowrap self-start",
                                            hasDenuncia && (maq.lacre_estado === 'violentado') ? "border-destructive text-destructive bg-destructive/5" : "border-primary/20 bg-white"
                                        )}>
                                            <span className="text-muted-foreground mr-1">CÓDIGO DE MÁQUINA:</span> {maq.codigo}
                                        </Badge>
                                        <div className="flex flex-col gap-3 mt-2">
                                            <div className="bg-primary/5 p-2 rounded-xl border border-primary/10">
                                                <div className="text-[9px] font-black uppercase text-primary mb-1.5 flex items-center gap-1">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-primary" /> DETALLE DE SALIDA
                                                </div>
                                                <div className="grid grid-cols-2 gap-1.5 text-[8px] font-bold text-muted-foreground uppercase">
                                                    <div className="flex justify-between items-center bg-white px-2 py-1 rounded-md border border-slate-100 shadow-sm">
                                                        <span>Pendrive</span>
                                                        <span className="text-black font-black">{maq.pendrive_serie || 'NO LLEVÓ'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-white px-2 py-1 rounded-md border border-slate-100 shadow-sm">
                                                        <span>Credencial</span>
                                                        <span className={maq.credencial ? "text-black font-black" : "text-muted-foreground"}>{maq.credencial ? 'SI' : 'NO LLEVÓ'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-white px-2 py-1 rounded-md border border-slate-100 shadow-sm">
                                                        <span>Auricular</span>
                                                        <span className={maq.auricular ? "text-black font-black" : "text-muted-foreground"}>{maq.auricular ? 'SI' : 'NO LLEVÓ'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-white px-2 py-1 rounded-md border border-slate-100 shadow-sm">
                                                        <span>Acrílico</span>
                                                        <span className={maq.acrilico ? "text-black font-black" : "text-muted-foreground"}>{maq.acrilico ? 'SI' : 'NO LLEVÓ'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-white px-2 py-1 rounded-md border border-slate-100 shadow-sm col-span-2">
                                                        <span>Boletas</span>
                                                        <span className={maq.boletas ? "text-black font-black" : "text-muted-foreground"}>{maq.boletas ? 'SI' : 'NO LLEVÓ'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-green-50 p-2 rounded-xl border border-green-100">
                                                <div className="text-[9px] font-black uppercase text-green-700 mb-1.5 flex items-center gap-1">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> DETALLE DE RETORNO
                                                </div>
                                                <div className="grid grid-cols-2 gap-1.5 text-[8px] font-bold text-muted-foreground uppercase">
                                                    <div className="flex justify-between items-center bg-white px-2 py-1 rounded-md border border-slate-100 shadow-sm">
                                                        <span>Pendrive</span>
                                                        <span className={maq.pendrive_serie ? "text-green-600 font-black" : "text-muted-foreground"}>
                                                            {maq.pendrive_serie ? 'SI' : 'NO LLEVÓ'}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-white px-2 py-1 rounded-md border border-slate-100 shadow-sm">
                                                        <span>Credencial</span>
                                                        <span className={maq.retorno_credencial ? "text-green-600 font-black" : (maq.credencial ? "text-red-500 font-black" : "text-muted-foreground")}>
                                                            {maq.retorno_credencial ? 'SI' : (maq.credencial ? 'NO RETORNÓ' : 'NO LLEVÓ')}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-white px-2 py-1 rounded-md border border-slate-100 shadow-sm">
                                                        <span>Auricular</span>
                                                        <span className={maq.retorno_auricular ? "text-green-600 font-black" : (maq.auricular ? "text-red-500 font-black" : "text-muted-foreground")}>
                                                            {maq.retorno_auricular ? 'SI' : (maq.auricular ? 'NO RETORNÓ' : 'NO LLEVÓ')}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-white px-2 py-1 rounded-md border border-slate-100 shadow-sm">
                                                        <span>Acrílico</span>
                                                        <span className={maq.retorno_acrilico ? "text-green-600 font-black" : (maq.acrilico ? "text-red-500 font-black" : "text-muted-foreground")}>
                                                            {maq.retorno_acrilico ? 'SI' : (maq.acrilico ? 'NO RETORNÓ' : 'NO LLEVÓ')}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-white px-2 py-1 rounded-md border border-slate-100 shadow-sm col-span-2">
                                                        <span>Boletas</span>
                                                        <span className={maq.retorno_boletas ? "text-green-600 font-black" : (maq.boletas ? "text-red-500 font-black" : "text-muted-foreground")}>
                                                            {maq.retorno_boletas ? 'SI' : (maq.boletas ? 'NO RETORNÓ' : 'NO LLEVÓ')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="md:col-span-3 space-y-1">
                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">RESPONSABLES</p>
                            {mov.responsables?.map((resp, i) => (
                                <div key={i} className="leading-tight">
                                    <p className="font-black text-[10px] uppercase break-words">{resp.nombre}</p>
                                    <p className="text-[8px] font-bold text-muted-foreground">C.I. {resp.cedula}</p>
                                </div>
                            ))}
                        </div>

                        <div className="md:col-span-3 grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-blue-600">
                                    <Truck className="h-3 w-3" />
                                    <span className="text-[9px] font-black uppercase">SALIDA</span>
                                </div>
                                <p className="text-[10px] font-bold">{mov.fecha_salida ? `${formatDateToDDMMYYYY(mov.fecha_salida)} ${mov.hora_salida} HS` : '---'}</p>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-green-600">
                                    <Undo2 className="h-3 w-3" />
                                    <span className="text-[9px] font-black uppercase">REGRESO</span>
                                </div>
                                <p className="text-[10px] font-bold">{mov.fecha_devolucion ? `${formatDateToDDMMYYYY(mov.fecha_devolucion)} ${mov.hora_devolucion} HS` : '---'}</p>
                            </div>
                        </div>

                        <div className="md:col-span-2 flex flex-col items-end gap-2">
                            {hasDenuncia ? (
                                <div className="bg-destructive text-white px-4 py-2 rounded-xl flex items-center gap-2 animate-pulse">
                                    <FileWarning className="h-4 w-4" />
                                    <span className="text-[9px] font-black uppercase tracking-tighter">DENUNCIA ACTIVA</span>
                                </div>
                            ) : (
                                <div className="bg-green-100 text-green-700 px-4 py-2 rounded-xl flex items-center gap-2">
                                    <ShieldAlert className="h-4 w-4 opacity-40" />
                                    <span className="text-[9px] font-black uppercase">SIN IRREGULARIDAD MÁQUINA</span>
                                </div>
                            )}
                            {hasIrregularidadKits && (
                                <div className="bg-orange-100 text-orange-700 px-4 py-2 rounded-xl flex items-center gap-2">
                                    <FileWarning className="h-4 w-4" />
                                    <span className="text-[9px] font-black uppercase">IRREGULARIDAD KITS</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}

function DistrictArchiveSection({ 
    distName, 
    searchTerm,
    allDeptItems = [],
    isDeptLoading = false,
    denuncias = [],
    dateFrom,
    dateTo
}: any) {
    const [visibleCount, setVisibleCount] = useState(5);
    const [isOpen, setIsOpen] = useState(false);
    
    const items = useMemo(() => {
        const target = normalizeGeo(distName);
        const term = (searchTerm || '').toLowerCase().trim();
        
        return (allDeptItems || []).filter((mov: any) => {
            const matchesDistrict = normalizeGeo(mov.distrito) === target;
            const matchesSearch = !term || 
                                 (mov.distrito || '').toLowerCase().includes(term) || 
                                 (mov.maquinas_codigos || []).some((c: string) => c.toLowerCase().includes(term)) ||
                                 (mov.responsables || []).some((r: any) => r.nombre.toLowerCase().includes(term));
            
            let matchesDate = true;
            if (dateFrom || dateTo) {
                const movDate = mov.fecha_creacion ? mov.fecha_creacion.split('T')[0] : '';
                if (dateFrom && movDate < dateFrom) matchesDate = false;
                if (dateTo && movDate > dateTo) matchesDate = false;
            }

            return matchesDistrict && matchesSearch && matchesDate;
        }).sort((a: any, b: any) => (b.fecha_creacion || '').localeCompare(a.fecha_creacion || ''));
    }, [allDeptItems, distName, searchTerm, dateFrom, dateTo]);

    if (items.length === 0 && !isDeptLoading) return null;

    return (
        <AccordionItem value={distName} className="border-none">
            <AccordionTrigger 
                onClick={() => setIsOpen(!isOpen)} 
                className="hover:no-underline py-4 bg-[#F8F9FA] rounded-2xl px-6 group border border-dashed"
            >
                <div className="flex items-center gap-3">
                    <Building2 className={cn("h-5 w-5 transition-colors", isOpen ? "text-primary" : "text-muted-foreground")} />
                    <h3 className={cn("font-black uppercase text-sm tracking-tight", isOpen ? "text-primary" : "text-muted-foreground")}>
                        {distName}
                    </h3>
                    {items.length > 0 && (
                        <Badge variant="secondary" className="bg-black text-white text-[8px] font-black px-2">
                            {items.length} MOVIMIENTOS
                        </Badge>
                    )}
                </div>
            </AccordionTrigger>
            <AccordionContent className="pt-6 px-2 pb-6 space-y-4">
                {items.slice(0, visibleCount).map((mov: any) => (
                    <MovementRow key={mov.id} mov={mov} denuncias={denuncias} />
                ))}
                
                {items.length > visibleCount && (
                    <div className="pt-4 flex justify-center">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setVisibleCount(prev => prev + 10)}
                            className="font-black text-[9px] uppercase tracking-widest hover:bg-white gap-2 h-10 px-6 rounded-xl border border-dashed border-muted-foreground/20"
                        >
                            Ver más movimientos ({items.length - visibleCount} más)
                            <ChevronDown className="h-3 w-3" />
                        </Button>
                    </div>
                )}
            </AccordionContent>
        </AccordionItem>
    );
}

function DepartmentSection({ dept, firestore, searchTerm, denuncias, dateFrom, dateTo, isHistorical }: any) {
    const [isOpen, setIsOpen] = useState(false);

    // Fetch ALL department items for this module
    const q = useMemoFirebase(() => {
        if (!firestore || !isOpen) return null;
        const colName = isHistorical ? 'movimientos-maquinas_internas_2026' : 'movimientos-maquinas';
        return query(
            collection(firestore, colName),
            where('departamento', '==', dept.name),
            orderBy('fecha_creacion', 'desc')
        );
    }, [firestore, dept.name, isOpen, isHistorical]);

    const { data: allDeptItems, isLoading: isDeptLoading } = useCollectionOnce<MovimientoMaquina>(q);

    return (
        <AccordionItem value={dept.name} className="border-none bg-white rounded-[2rem] shadow-sm overflow-hidden">
            <AccordionTrigger 
                className="hover:no-underline px-8 py-6 bg-white group"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-4 text-left">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black transition-transform group-data-[state=open]:scale-110">
                        <Landmark className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight text-[#1A1A1A]">{dept.name}</h2>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            {isOpen ? 'EXPLORANDO MOVIMIENTOS' : 'CLIC PARA VER DISTRITOS'}
                        </p>
                    </div>
                </div>
            </AccordionTrigger>
            <AccordionContent className="px-8 pb-8 pt-2">
                {isDeptLoading ? (
                    <div className="flex flex-col items-center justify-center py-10 opacity-40">
                        <Loader2 className="h-6 w-6 animate-spin mb-2" />
                        <p className="text-[9px] font-black uppercase tracking-widest">Sincronizando departamento...</p>
                    </div>
                ) : (
                    <Accordion type="multiple" className="space-y-4">
                        {dept.districts.map((distName: string) => (
                            <DistrictArchiveSection 
                                key={distName}
                                distName={distName}
                                searchTerm={searchTerm}
                                allDeptItems={allDeptItems}
                                isDeptLoading={isDeptLoading}
                                denuncias={denuncias}
                                dateFrom={dateFrom}
                                dateTo={dateTo}
                            />
                        ))}
                    </Accordion>
                )}
            </AccordionContent>
        </AccordionItem>
    );
}

import { HistoricalToggle } from "@/components/historical-toggle";

export default function InformeMovimientosDenunciasPage() {
  const { firestore } = useFirebase();
  const { user, isUserLoading, isProfileLoading } = useUser();
  const [search, setSearch] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [itemsToExport, setItemsToExport] = useState<MovimientoMaquina[] | null>(null);
  const [isHistorical, setIsHistorical] = useState(false);

  const handleGeneratePdf = async () => {
      if (!firestore) return;
      setIsGeneratingPdf(true);
      try {
          let constraints: any[] = [];
          if (selectedDepartment && selectedDepartment !== 'ALL') {
               constraints.push(where('departamento', '==', selectedDepartment));
          }
          constraints.push(orderBy('fecha_creacion', 'desc'));
          
          const colName = isHistorical ? 'movimientos-maquinas_internas_2026' : 'movimientos-maquinas';
          const snapshot = await getDocs(query(collection(firestore, colName), ...constraints));
          let items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MovimientoMaquina));

          if (selectedDistrict && selectedDistrict !== 'ALL') {
              items = items.filter(m => normalizeGeo(m.distrito) === normalizeGeo(selectedDistrict));
          }
          if (dateFrom) {
              items = items.filter(m => (m.fecha_creacion || '') >= dateFrom);
          }
          if (dateTo) {
              items = items.filter(m => (m.fecha_creacion || '').split('T')[0] <= dateTo);
          }
          if (search) {
              const term = search.toLowerCase().trim();
              items = items.filter(m => 
                  (m.distrito || '').toLowerCase().includes(term) ||
                  ((m as any).maquinas_codigos || []).some((c: any) => c.toLowerCase().includes(term)) ||
                  ((m as any).responsables || []).some((r: any) => r.nombre.toLowerCase().includes(term))
              );
          }
          
          if (items.length === 0) {
              alert('No hay movimientos que coincidan con los filtros seleccionados.');
              setIsGeneratingPdf(false);
              return;
          }
          
          setItemsToExport(items);
      } catch (e) {
          console.error(e);
          alert('Error al obtener datos para PDF. Verifique su conexión y permisos.');
          setIsGeneratingPdf(false);
      }
  };

  useEffect(() => {
      if (itemsToExport && itemsToExport.length > 0) {
          const generate = async () => {
              try {
                  const pdf = new jsPDF('p', 'mm', 'a4');
                  const pageWidth = pdf.internal.pageSize.getWidth();
                  const pageHeight = pdf.internal.pageSize.getHeight();
                  let cursorY = 20;

                  const pages = document.querySelectorAll('.pdf-export-page');
                  
                  for (let i = 0; i < pages.length; i++) {
                      const pageNode = pages[i] as HTMLElement;
                      const canvas = await html2canvas(pageNode, { 
                          scale: 1.5, 
                          useCORS: true, 
                          backgroundColor: '#ffffff',
                          windowWidth: 1000
                      });
                      const imgData = canvas.toDataURL('image/jpeg', 0.85);
                      const imgProps = pdf.getImageProperties(imgData);
                      const pdfWidth = pageWidth;
                      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                      if (i > 0) {
                          pdf.addPage();
                      }

                      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

                      // Numeración de páginas
                      pdf.setFontSize(8);
                      pdf.setTextColor(150);
                      pdf.text(`Página ${i + 1} de ${pages.length}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
                  }

                  pdf.save(`Reporte_Movimientos_${new Date().toISOString().split('T')[0]}.pdf`);
              } catch (err) {
                  console.error("Error generating PDF:", err);
                  alert("Ocurrió un error al generar el PDF.");
              } finally {
                  setItemsToExport(null);
                  setIsGeneratingPdf(false);
              }
          };
          
          setTimeout(generate, 1500);
      }
  }, [itemsToExport]);

  const exportPages = useMemo(() => {
      if (!itemsToExport) return [];
      const pages: MovimientoMaquina[][] = [];
      let currentPage: MovimientoMaquina[] = [];
      let currentWeight = 0;
      
      itemsToExport.forEach(mov => {
          const weight = mov.maquinas?.length || 1;
          if (currentWeight + weight > 4 && currentPage.length > 0) {
              pages.push(currentPage);
              currentPage = [mov];
              currentWeight = weight;
          } else {
              currentPage.push(mov);
              currentWeight += weight;
          }
      });
      if (currentPage.length > 0) {
          pages.push(currentPage);
      }
      return pages;
  }, [itemsToExport]);

  const profile = user?.profile;
  const role = profile?.role;
  const permissions = profile?.permissions || [];
  const isAdminGlobal = !!user?.isAdmin || permissions.includes('admin_filter');

  // Cargar datos de departamentos/distritos para los filtros
  const datosRef = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData } = useCollectionOnce<any>(datosRef);

  const departments = useMemo(() => {
    if (!datosData) return [];
    return [...new Set(datosData.map((d: any) => d.departamento))].sort();
  }, [datosData]);

  const districts = useMemo(() => {
    if (!datosData || !selectedDepartment) return [];
    return [...new Set(datosData.filter((d: any) => d.departamento === selectedDepartment).map((d: any) => d.distrito))].sort();
  }, [datosData, selectedDepartment]);

  // Inicializar jurisdicción por perfil
  useEffect(() => {
    if (!isProfileLoading && profile) {
      if (profile.departamento && !selectedDepartment) {
        setSelectedDepartment(profile.departamento);
      }
      if (profile.distrito && !selectedDistrict) {
        setSelectedDistrict(profile.distrito);
      }
    }
  }, [isProfileLoading, profile]);

  const isLoadingMovs = false;

  const denunciasQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    const colName = isHistorical ? 'denuncias-lacres_internas_2026' : 'denuncias-lacres';
    return collection(firestore, colName);
  }, [firestore, isHistorical]);

  const { data: denuncias } = useCollectionOnce<any>(denunciasQuery);

  const depts = useMemo(() => {
    if (!datosData || !profile) return [];
    
    // Lista de departamentos única
    const deptList = Array.from(new Set(datosData.map((d: any) => d.departamento))).map(name => ({
        name,
        districts: Array.from(new Set(datosData.filter((d: any) => d.departamento === name).map((d: any) => d.distrito))).sort()
    })).sort((a, b) => a.name.localeCompare(b.name));

    // Si es admin global y tiene seleccionado un departamento específico en el filtro
    if (isAdminGlobal && selectedDepartment && selectedDepartment !== 'ALL') {
        return deptList.filter(d => d.name === selectedDepartment).map(d => ({
            ...d,
            districts: selectedDistrict && selectedDistrict !== 'ALL' 
                ? d.districts.filter(dist => normalizeGeo(dist) === normalizeGeo(selectedDistrict))
                : d.districts
        }));
    }

    // Si es restringido por perfil
    if (!isAdminGlobal) {
        if (permissions.includes('department_filter') && profile.departamento) {
            return deptList.filter(d => d.name === profile.departamento).map(d => ({
                ...d,
                districts: selectedDistrict && selectedDistrict !== 'ALL' 
                    ? d.districts.filter(dist => normalizeGeo(dist) === normalizeGeo(selectedDistrict))
                    : d.districts
            }));
        }
        if (role === 'jefe' || permissions.includes('district_filter')) {
            return deptList.filter(d => d.name === profile.departamento).map(d => ({
                ...d,
                districts: d.districts.filter(dist => normalizeGeo(dist) === normalizeGeo(profile.distrito || ''))
            }));
        }
    }

    return deptList;
  }, [datosData, profile, isAdminGlobal, selectedDepartment, selectedDistrict]);

  if (isUserLoading || isLoadingMovs) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Trazabilidad Logística" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-primary uppercase leading-none">Control de Movimientos</h1>
                <p className="text-muted-foreground text-[10px] font-bold uppercase flex items-center gap-2 mt-2 tracking-widest">
                    <ArrowLeftRight className="h-3.5 w-3.5" /> Auditoría de equipos y detección de irregularidades
                </p>
            </div>
            <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-center justify-end">
                <HistoricalToggle 
                    isHistorical={isHistorical} 
                    setIsHistorical={setIsHistorical} 
                    isAdmin={isAdminGlobal} 
                />
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                    <Input 
                        placeholder="Buscar local o responsable..." 
                        className="h-12 pl-10 font-bold border-2 rounded-2xl bg-white shadow-sm"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>
        </div>

        {/* FILTROS JURISDICCIONALES (CARGA INTELIGENTE) */}
        <Card className="border-primary/20 shadow-sm bg-white rounded-3xl overflow-hidden">
            <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
                    <div className="space-y-2 lg:col-span-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest">DEPARTAMENTO</Label>
                        <Select 
                            onValueChange={(v) => { setSelectedDepartment(v); setSelectedDistrict(null); }} 
                            value={selectedDepartment || undefined}
                            disabled={!isAdminGlobal && (profile?.role === 'jefe' || profile?.permissions?.includes('district_filter') || profile?.permissions?.includes('department_filter'))}
                        >
                            <SelectTrigger className="h-12 text-sm font-black border-2 rounded-2xl bg-[#F8F9FA] transition-all focus:ring-primary/20">
                                <SelectValue placeholder="TODO EL PAÍS" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-2 shadow-2xl">
                                <SelectItem value="ALL" className="text-[10px] font-black uppercase py-3 border-b text-primary">TODO EL PAÍS</SelectItem>
                                {departments.map(d => <SelectItem key={d} value={d} className="text-[10px] font-black uppercase py-3 border-b last:border-0">{d}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2 lg:col-span-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest">DISTRITO</Label>
                        <Select 
                            onValueChange={setSelectedDistrict} 
                            value={selectedDistrict || undefined} 
                            disabled={!selectedDepartment || (!isAdminGlobal && (profile?.role === 'jefe' || profile?.permissions?.includes('district_filter')))}
                        >
                            <SelectTrigger className="h-12 text-sm font-black border-2 rounded-2xl bg-[#F8F9FA] transition-all focus:ring-primary/20">
                                <SelectValue placeholder={!selectedDepartment ? "---" : "TODOS LOS DISTRITOS"} />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-2 shadow-2xl">
                                <SelectItem value="ALL" className="text-[10px] font-black uppercase py-3 border-b text-primary">TODOS LOS DISTRITOS</SelectItem>
                                {districts.map(d => <SelectItem key={d} value={d} className="text-[10px] font-black uppercase py-3 border-b last:border-0">{d}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2 lg:col-span-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest">DESDE</Label>
                        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-12 border-2 rounded-2xl bg-[#F8F9FA] font-bold" />
                    </div>
                    
                    <div className="space-y-2 lg:col-span-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest">HASTA</Label>
                        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-12 border-2 rounded-2xl bg-[#F8F9FA] font-bold" />
                    </div>
                </div>

                <div className="mt-6 flex flex-col md:flex-row justify-between items-center gap-4 border-t border-primary/10 pt-6">
                    <div className="bg-primary/5 border border-primary/10 rounded-2xl p-3 flex items-center gap-3 w-full md:w-auto">
                        <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center shrink-0 shadow-lg">
                            <Activity className="h-4 w-4" />
                        </div>
                        <p className="text-[9px] font-bold text-primary uppercase leading-tight tracking-tight">
                            CARGA INTELIGENTE ACTIVA: Elija una jurisdicción para auditar movimientos sin saturar el sistema.
                        </p>
                    </div>
                    
                    <Button 
                        onClick={handleGeneratePdf} 
                        disabled={isGeneratingPdf}
                        className="h-12 rounded-2xl px-8 font-black uppercase tracking-widest flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
                    >
                        {isGeneratingPdf ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                        {isGeneratingPdf ? 'GENERANDO PDF...' : 'GENERAR PDF'}
                    </Button>
                </div>
            </CardContent>
        </Card>

        <Accordion type="multiple" className="space-y-6">
            {depts.map((dept) => (
                <DepartmentSection 
                    key={dept.name} 
                    dept={dept} 
                    firestore={firestore} 
                    searchTerm={search}
                    denuncias={denuncias}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    isHistorical={isHistorical}
                />
            ))}
        </Accordion>

        <div className="text-center pb-10">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40 italic">
                * El sistema resalta en rojo los movimientos vinculados a denuncias oficiales de lacres violentados.
            </p>
        </div>
      </main>

      {/* CONTENEDOR OCULTO PARA PDF */}
      {itemsToExport && (
          <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
              <div className="bg-white" id="pdf-export-container" style={{ width: '1000px' }}>
                  {exportPages.map((pageItems, pageIdx) => {
                      return (
                          <div key={pageIdx} className="pdf-export-page bg-white p-8 flex flex-col gap-6" style={{ width: '1000px' }}>
                              <div className="mb-2 flex items-center justify-between border-b pb-4 border-slate-100">
                                  <img src="/logo.png" alt="TSJE" className="h-14 w-auto object-contain" crossOrigin="anonymous" />
                                  <div className="text-center">
                                      <h2 className="text-2xl font-black">Reporte de Movimientos - Trazabilidad Logística</h2>
                                      {dateFrom || dateTo ? (
                                          <p className="text-gray-500 font-bold mt-1">Filtro: {dateFrom ? `Desde ${dateFrom}` : ''} {dateTo ? `Hasta ${dateTo}` : ''}</p>
                                      ) : null}
                                  </div>
                                  <img src="/logo1.png" alt="DGRE" className="h-14 w-auto object-contain" crossOrigin="anonymous" />
                              </div>
                          {pageItems.map(mov => (
                              <div key={mov.id} className="border border-slate-100 shadow-sm rounded-3xl p-2 bg-[#F8F9FA]">
                                  <MovementRow mov={mov} denuncias={denuncias || undefined} />
                              </div>
                          ))}
                      </div>
                  );
              })}
              </div>
          </div>
      )}
    </div>
  );
}
