"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { FileUp, Loader2, CheckCircle2, TableIcon } from 'lucide-react';
import Header from '@/components/header';
import * as XLSX from 'xlsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Department, District } from '@/lib/data';

type PreviewData = {
  departamento: string;
  distrito: string;
};

export default function SettingsPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData[]>([]);
  const { toast } = useToast();

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
        
        // Remove header row if it exists
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


  const handleSaveData = () => {
    // This is where you would typically save the data to your state management or backend.
    // For now, we'll store it in localStorage to persist it across the session.
    
    const newDepartments: Department[] = [];
    previewData.forEach(item => {
      let dept = newDepartments.find(d => d.name === item.departamento);
      if (!dept) {
        dept = {
          id: `d_${Date.now()}_${newDepartments.length}`,
          name: item.departamento,
          districts: []
        };
        newDepartments.push(dept);
      }

      const distExists = dept.districts.some(d => d.name === item.distrito);
      if (!distExists) {
        const newDistrict: District = {
          id: `dist_${Date.now()}_${dept.districts.length}`,
          name: item.distrito,
          images: []
        };
        dept.districts.push(newDistrict);
      }
    });

    localStorage.setItem('imported_departments', JSON.stringify(newDepartments));
    
    toast({
      title: 'Datos guardados',
      description: 'Los nuevos departamentos y distritos se han guardado con éxito.',
      action: <CheckCircle2 className="text-green-500" />,
    });

    // Reset the view
    setPreviewData([]);
    setFileName(null);
  };

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Configuración" />
      <main className="flex flex-1 flex-col items-center p-4 gap-8">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <FileUp className="h-6 w-6" />
              Importar Datos
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
                  <FileUp className="w-10 h-10 mb-3 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Haz clic para subir</span> o arrastra y suelta
                  </p>
                  <p className="text-xs text-muted-foreground">XLSX o CSV</p>
                </div>
                <Input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept=".xlsx,.csv" disabled={isParsing} />
              </label>
              {fileName && (
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
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <TableIcon className="h-6 w-6" />
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
      </main>
    </div>
  );
}
