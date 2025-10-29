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
import { Department, District } from '@/lib/data';
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


type PreviewData = {
  departamento: string;
  distrito: string;
};

type ReportPreviewData = {
  departamento?: string;
  distrito?: string;
  'estado-fisico'?: string;
  'descripcion-situacion'?: string;
  'cantidad-habitaciones'?: string;
  'habitacion-segura'?: string;
  'caracteristicas-habitacion'?: string;
  'dimensiones-habitacion'?: string;
  'cantidad-maquinas'?: string;
  'lugar-resguardo'?: string;
}

export default function SettingsPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData[]>([]);
  const [reportPreviewData, setReportPreviewData] = useState<ReportPreviewData[]>([]);
  const [savedData, setSavedData] = useState<Department[]>([]);
  const { toast } = useToast();
  
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{type: 'department' | 'district', deptId: string, distId?: string, name: string} | null>(null);
  const [newItemName, setNewItemName] = useState('');

  useEffect(() => {
    const storedData = localStorage.getItem('imported_departments');
    if (storedData) {
      try {
        setSavedData(JSON.parse(storedData));
      } catch (error) {
        console.error("Error parsing stored data:", error);
      }
    }
  }, []);

  const updateAndPersistData = (newData: Department[]) => {
    setSavedData(newData);
    localStorage.setItem('imported_departments', JSON.stringify(newData));
  };


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
        const json: ReportPreviewData[] = XLSX.utils.sheet_to_json(worksheet);
        
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


  const handleSaveData = () => {
    let currentData = [...savedData];

    previewData.forEach(item => {
      let dept = currentData.find(d => d.name.toLowerCase() === item.departamento.toLowerCase());
      if (!dept) {
        dept = {
          id: `d_${Date.now()}_${currentData.length}`,
          name: item.departamento,
          districts: []
        };
        currentData.push(dept);
      }

      const distExists = dept.districts.some(d => d.name.toLowerCase() === item.distrito.toLowerCase());
      if (!distExists) {
        const newDistrict: District = {
          id: `dist_${Date.now()}_${dept.districts.length}`,
          name: item.distrito,
          images: []
        };
        dept.districts.push(newDistrict);
      }
    });

    updateAndPersistData(currentData);
    
    toast({
      title: 'Datos importados',
      description: 'Los nuevos departamentos y distritos se han añadido con éxito.',
      action: <CheckCircle2 className="text-green-500" />,
    });

    setPreviewData([]);
    setFileName(null);
  };

  const handleOpenEditModal = (type: 'department' | 'district', deptId: string, distId?: string, name: string) => {
    setEditingItem({ type, deptId, distId, name });
    setNewItemName(name);
    setEditModalOpen(true);
  };
  
  const handleAddItem = (type: 'department' | 'district', deptId?: string) => {
      const name = prompt(`Introduce el nombre del nuevo ${type === 'department' ? 'departamento' : 'distrito'}`);
      if (name) {
          if (type === 'department') {
              const newDept: Department = {
                  id: `d_${Date.now()}`,
                  name,
                  districts: [],
              };
              updateAndPersistData([...savedData, newDept]);
          } else if (type === 'district' && deptId) {
              const newData = savedData.map(dept => {
                  if (dept.id === deptId) {
                      const newDistrict: District = {
                          id: `dist_${Date.now()}_${dept.districts.length}`,
                          name,
                          images: [],
                      };
                      return { ...dept, districts: [...dept.districts, newDistrict] };
                  }
                  return dept;
              });
              updateAndPersistData(newData);
          }
      }
  };

  const handleUpdateItem = () => {
    if (!editingItem || !newItemName) return;

    const { type, deptId, distId } = editingItem;
    let newData: Department[] = [];

    if (type === 'department') {
      newData = savedData.map(dept => 
        dept.id === deptId ? { ...dept, name: newItemName } : dept
      );
    } else if (type === 'district') {
      newData = savedData.map(dept => 
        dept.id === deptId 
          ? { 
              ...dept, 
              districts: dept.districts.map(dist => 
                dist.id === distId ? { ...dist, name: newItemName } : dist
              ) 
            } 
          : dept
      );
    }
    
    updateAndPersistData(newData);
    setEditModalOpen(false);
    setEditingItem(null);
    toast({ title: 'Elemento actualizado', description: 'El nombre ha sido cambiado con éxito.' });
  };
  
  const handleDeleteItem = (type: 'department' | 'district', deptId: string, distId?: string) => {
      let newData: Department[] = [];
      if (type === 'department') {
          newData = savedData.filter(dept => dept.id !== deptId);
      } else {
          newData = savedData.map(dept => {
              if (dept.id === deptId) {
                  return { ...dept, districts: dept.districts.filter(dist => dist.id !== distId) };
              }
              return dept;
          });
      }
      updateAndPersistData(newData);
      toast({ title: 'Elemento eliminado', variant: 'destructive' });
  };

  const handleSaveReportData = () => {
    console.log("Saving report data:", reportPreviewData);
    // Here you would typically save the data to your backend or state management
    toast({
      title: 'Datos del informe guardados',
      description: 'Los datos del informe se han procesado (simulado).',
      action: <CheckCircle2 className="text-green-500" />,
    });
    setReportPreviewData([]);
    setFileName(null);
  }


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
                                    {Object.values(row).map((value, i) => <TableCell key={i}>{value}</TableCell>)}
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


        {savedData.length > 0 && previewData.length === 0 && (
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
                {savedData.map((department) => (
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
                                            <AlertDialogAction onClick={() => handleDeleteItem('district', department.id, district.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
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
