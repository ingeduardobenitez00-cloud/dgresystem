
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { FileUp, Loader2, CheckCircle2, TableIcon, Database, PlusCircle, Trash2, Edit } from 'lucide-react';
import Header from '@/components/header';
import * as XLSX from 'xlsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type Department, type District, type ReportData } from '@/lib/data';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { collection, doc, writeBatch, getDocs, deleteDoc, setDoc, addDoc, updateDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


type PreviewData = {
  departamento: string;
  distrito: string;
};

export default function SettingsPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData[]>([]);
  const [reportPreviewData, setReportPreviewData] = useState<ReportData[]>([]);
  const { toast } = useToast();
  
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{type: 'department' | 'district', deptId: string, distId?: string, name: string} | null>(null);
  const [newItemName, setNewItemName] = useState('');

  const { firestore } = useFirebase();

  const departmentsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'departamentos') : null, [firestore]);
  const { data: savedData, isLoading: isLoadingDepartments } = useCollection<Department>(departmentsQuery);

  const [departmentsWithDistricts, setDepartmentsWithDistricts] = useState<(Department & {districts: District[]})[]>([]);

  useEffect(() => {
    if (savedData && firestore) {
      const fetchDistricts = async () => {
        const deptsWithDists = await Promise.all(
          savedData.map(async (dept) => {
            const districtsQuery = collection(firestore, 'departamentos', dept.id, 'distritos');
            try {
              const districtsSnapshot = await getDocs(districtsQuery);
              const districts = districtsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as District));
              return { ...dept, districts };
            } catch (error) {
               const contextualError = new FirestorePermissionError({
                operation: 'list',
                path: `departamentos/${dept.id}/distritos`,
               });
               errorEmitter.emit('permission-error', contextualError);
               return { ...dept, districts: [] };
            }
          })
        );
        setDepartmentsWithDistricts(deptsWithDists);
      };
      fetchDistricts();
    }
  }, [savedData, firestore]);


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.type === 'text/csv') {
        setFileName(file.name);
        parseFile(file);
      } else {
        toast({
          variant: 'destructive',
          title: 'Archivo no válido',
          description: 'Por favor, selecciona un archivo .xlsx o .csv',
        });
        e.target.value = ''; // Reset input
      }
    }
  };

  const parseFile = (file: File) => {
    setIsParsing(true);
    setPreviewData([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: ['DEPARTAMENTO', 'DISTRITO'] });
        
        if (json[0] && (json[0] as any)['DEPARTAMENTO'] === 'DEPARTAMENTO' && (json[0] as any)['DISTRITO'] === 'DISTRITO') {
          json.shift();
        }

        const parsedData: PreviewData[] = json.map((row: any) => ({
          departamento: row.DEPARTAMENTO,
          distrito: row.DISTRITO,
        }));
        
        setPreviewData(parsedData);
        toast({
          title: 'Vista previa generada',
          description: `Se han encontrado ${parsedData.length} registros en el archivo.`,
        });
      } catch (error) {
        console.error("Error parsing file:", error);
        toast({
          variant: 'destructive',
          title: 'Error al procesar el archivo',
          description: 'Asegúrate de que el archivo tenga las columnas DEPARTAMENTO y DISTRITO.',
        });
      } finally {
        setIsParsing(false);
      }
    };
    reader.onerror = () => {
      toast({
          variant: 'destructive',
          title: 'Error al leer el archivo',
          description: 'No se pudo leer el archivo seleccionado.',
      });
      setIsParsing(false);
    }
    reader.readAsBinaryString(file);
  };
  
  const handleReportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.type === 'text/csv') {
        setFileName(file.name);
        parseReportFile(file);
      } else {
        toast({
          variant: 'destructive',
          title: 'Archivo no válido',
          description: 'Por favor, selecciona un archivo .xlsx o .csv',
        });
        e.target.value = '';
      }
    }
  };

  const parseReportFile = (file: File) => {
    setIsParsing(true);
    setReportPreviewData([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: ReportData[] = XLSX.utils.sheet_to_json(worksheet);
        
        setReportPreviewData(json);
        toast({
          title: 'Vista previa de informe generada',
          description: `Se han encontrado ${json.length} registros en el archivo.`,
        });
      } catch (error) {
        console.error("Error parsing report file:", error);
        toast({
          variant: 'destructive',
          title: 'Error al procesar el archivo',
          description: 'El archivo no tiene el formato esperado.',
        });
      } finally {
        setIsParsing(false);
      }
    };
    reader.onerror = () => {
      toast({
          variant: 'destructive',
          title: 'Error al leer el archivo',
          description: 'No se pudo leer el archivo seleccionado.',
      });
      setIsParsing(false);
    }
    reader.readAsBinaryString(file);
  };


  const handleSaveData = async () => {
    if (!firestore) return;

    const batch = writeBatch(firestore);
    const deptsMap = new Map<string, { id: string; districts: Map<string, string> }>();
    
    // Pre-fill map with existing data to avoid duplicates
    for (const dept of departmentsWithDistricts) {
      const distsMap = new Map(dept.districts.map(d => [d.name.toLowerCase(), d.id]));
      deptsMap.set(dept.name.toLowerCase(), { id: dept.id, districts: distsMap });
    }

    for (const item of previewData) {
        let deptLower = item.departamento.toLowerCase();
        let distLower = item.distrito.toLowerCase();

        let deptEntry = deptsMap.get(deptLower);
        if (!deptEntry) {
            const newDeptRef = doc(collection(firestore, 'departamentos'));
            batch.set(newDeptRef, { name: item.departamento });
            deptEntry = { id: newDeptRef.id, districts: new Map() };
            deptsMap.set(deptLower, deptEntry);
        }

        if (!deptEntry.districts.has(distLower)) {
            const newDistRef = doc(collection(firestore, 'departamentos', deptEntry.id, 'distritos'));
            batch.set(newDistRef, { name: item.distrito });
            deptEntry.districts.set(distLower, newDistRef.id);
        }
    }

    try {
        await batch.commit();
        toast({
            title: 'Datos importados',
            description: 'Los nuevos departamentos y distritos se han añadido con éxito a Firestore.',
            action: <CheckCircle2 className="text-green-500" />,
        });
        setPreviewData([]);
        setFileName(null);
    } catch (error) {
        console.error("Error saving to Firestore:", error);
        toast({
            variant: 'destructive',
            title: 'Error al guardar',
            description: 'No se pudieron guardar los datos en Firestore.',
        });
    }
  };


  const handleAddItem = async (type: 'department' | 'district', deptId?: string) => {
      if (!firestore) return;
      const name = prompt(`Introduce el nombre del nuevo ${type === 'department' ? 'departamento' : 'distrito'}`);
      if (name) {
          if (type === 'department') {
              addDoc(collection(firestore, 'departamentos'), { name }).catch(err => {
                 const contextualError = new FirestorePermissionError({operation: 'create', path: `departamentos`});
                 errorEmitter.emit('permission-error', contextualError);
              });
          } else if (type === 'district' && deptId) {
              addDoc(collection(firestore, 'departamentos', deptId, 'distritos'), { name }).catch(err => {
                 const contextualError = new FirestorePermissionError({operation: 'create', path: `departamentos/${deptId}/distritos`});
                 errorEmitter.emit('permission-error', contextualError);
              });
          }
      }
  };

  const handleOpenEditModal = (type: 'department' | 'district', deptId: string, distId?: string, name: string) => {
    setEditingItem({ type, deptId, distId, name });
    setNewItemName(name);
    setEditModalOpen(true);
  };
  
  const handleUpdateItem = async () => {
    if (!editingItem || !newItemName || !firestore) return;

    const { type, deptId, distId } = editingItem;
    
    try {
      if (type === 'department') {
        const deptRef = doc(firestore, 'departamentos', deptId);
        await updateDoc(deptRef, { name: newItemName });
      } else if (type === 'district' && distId) {
        const distRef = doc(firestore, 'departamentos', deptId, 'distritos', distId);
        await updateDoc(distRef, { name: newItemName });
      }
      setEditModalOpen(false);
      setEditingItem(null);
      toast({ title: 'Elemento actualizado', description: 'El nombre ha sido cambiado con éxito.' });
    } catch (error) {
       toast({ title: 'Error al actualizar', variant: 'destructive' });
    }
  };
  
  const handleDeleteItem = async (type: 'department' | 'district', deptId: string, distId?: string) => {
      if (!firestore) return;
      try {
        if (type === 'department') {
            await deleteDoc(doc(firestore, 'departamentos', deptId));
        } else if (distId) {
            await deleteDoc(doc(firestore, 'departamentos', deptId, 'distritos', distId));
        }
        toast({ title: 'Elemento eliminado', variant: 'destructive' });
      } catch (error) {
        toast({ title: 'Error al eliminar', variant: 'destructive' });
      }
  };

  const handleSaveReportData = async () => {
    if (!firestore) return;
    const batch = writeBatch(firestore);
    const reportsCollection = collection(firestore, 'reports');
    reportPreviewData.forEach(report => {
      const newReportRef = doc(reportsCollection);
      batch.set(newReportRef, report);
    });
    
    try {
      await batch.commit();
      toast({
        title: 'Datos del informe guardados',
        description: 'Los nuevos datos del informe se han añadido con éxito a Firestore.',
        action: <CheckCircle2 className="text-green-500" />,
      });
      setReportPreviewData([]);
      setFileName(null);
    } catch (error) {
       toast({
          variant: 'destructive',
          title: 'Error al guardar el informe',
          description: 'No se pudieron guardar los datos del informe en Firestore.',
      });
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Configuración" />
      <main className="flex flex-1 flex-col items-center p-4 gap-8">
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5" />
              Importar Departamentos y Distritos
            </CardTitle>
            <CardDescription>
              Sube un archivo .xlsx o .csv con las columnas DEPARTAMENTO y DISTRITO para cargarlos en el sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <FileUp className="w-8 h-8 mb-3 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Haz clic para subir</span> o arrastra y suelta
                  </p>
                  <p className="text-xs text-muted-foreground">XLSX o CSV</p>
                </div>
                <Input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept=".xlsx,.csv" disabled={isParsing} />
              </label>
              {fileName && (previewData.length > 0 || reportPreviewData.length > 0) && (
                <p className="text-sm text-center text-muted-foreground">Archivo seleccionado: {fileName}</p>
              )}
            </div>
            
            {isParsing && (
              <div className="space-y-2 flex items-center justify-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <p className="text-sm font-medium text-center">Procesando archivo...</p>
              </div>
            )}
          </CardContent>
        </Card>

        {previewData.length > 0 && (
          <Card className="w-full max-w-4xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TableIcon className="h-5 w-5" />
                Vista Previa de Datos
              </CardTitle>
              <CardDescription>
                Revisa los datos que se importarán. Si todo es correcto, haz clic en "Guardar Datos".
              </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="max-h-64 overflow-auto border rounded-md">
                    <Table>
                        <TableHeader className="sticky top-0 bg-muted">
                            <TableRow>
                                <TableHead>Departamento</TableHead>
                                <TableHead>Distrito</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {previewData.map((row, index) => (
                                <TableRow key={index}>
                                    <TableCell>{row.departamento}</TableCell>
                                    <TableCell>{row.distrito}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                 <Button onClick={handleSaveData} className="w-full mt-6" size="lg">
                    Guardar Datos
                </Button>
            </CardContent>
          </Card>
        )}
        
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5" />
              Importar Información de Reporte
            </CardTitle>
            <CardDescription>
              Sube un archivo .xlsx o .csv con los detalles del informe.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label
                htmlFor="report-file-upload"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <FileUp className="w-8 h-8 mb-3 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Haz clic para subir</span> o arrastra y suelta
                  </p>
                  <p className="text-xs text-muted-foreground">XLSX o CSV para informes</p>
                </div>
                <Input id="report-file-upload" type="file" className="hidden" onChange={handleReportFileChange} accept=".xlsx,.csv" disabled={isParsing} />
              </label>
            </div>
          </CardContent>
        </Card>

        {reportPreviewData.length > 0 && (
          <Card className="w-full max-w-6xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TableIcon className="h-5 w-5" />
                Vista Previa del Informe
              </CardTitle>
              <CardDescription>
                Revisa los datos del informe que se importarán.
              </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="max-h-96 overflow-auto border rounded-md">
                    <Table>
                        <TableHeader className="sticky top-0 bg-muted">
                            <TableRow>
                                {Object.keys(reportPreviewData[0] || {}).map(key => <TableHead key={key}>{key}</TableHead>)}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportPreviewData.map((row, index) => (
                                <TableRow key={index}>
                                    {Object.values(row).map((value, i) => <TableCell key={i}>{String(value)}</TableCell>)}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                 <Button onClick={handleSaveReportData} className="w-full mt-6" size="lg">
                    Guardar Datos del Informe
                </Button>
            </CardContent>
          </Card>
        )}


        {departmentsWithDistricts.length > 0 && previewData.length === 0 && (
          <Card className="w-full max-w-4xl">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className='flex items-center gap-2'>
                  <Database className="h-5 w-5" />
                  Datos Guardados
                </div>
                <Button variant="outline" size="sm" onClick={() => handleAddItem('department')}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Añadir Departamento
                </Button>
              </CardTitle>
              <CardDescription>
                Estos son los departamentos y distritos actualmente en el sistema. Puedes editarlos o eliminarlos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {departmentsWithDistricts.map((department) => (
                  <AccordionItem value={department.id} key={department.id}>
                    <div className="flex items-center w-full">
                      <AccordionTrigger className="flex-1 text-base">{department.name}</AccordionTrigger>
                      <div className="flex gap-2 ml-4">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => {e.stopPropagation(); handleOpenEditModal('department', department.id, undefined, department.name)}}>
                              <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                              <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                                      <Trash2 className="h-4 w-4" />
                                  </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                  <AlertDialogHeader>
                                      <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                          Esta acción no se puede deshacer. Esto eliminará permanentemente el departamento y todos sus distritos.
                                      </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteItem('department', department.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                  </AlertDialogFooter>
                              </AlertDialogContent>
                          </AlertDialog>
                      </div>
                    </div>
                    <AccordionContent>
                      <div className="pl-4 space-y-2">
                        {department.districts.map((district) => (
                          <div key={district.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                            <span>{district.name}</span>
                            <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEditModal('district', department.id, district.id, district.name)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esta acción no se puede deshacer. Esto eliminará permanentemente el distrito.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteItem('district', department.id, district.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</Action>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" className="mt-2" onClick={() => handleAddItem('district', department.id)}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Añadir Distrito
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        )}
      </main>

       <Dialog open={isEditModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Nombre</DialogTitle>
            <DialogDescription>
              Introduce el nuevo nombre para "{editingItem?.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Nombre
              </Label>
              <Input
                id="name"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
                <Button type="button" variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleUpdateItem}>Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
