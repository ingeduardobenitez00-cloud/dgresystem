
'use client';

import { useState, useMemo, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type Dato, type ReportData } from '@/lib/data';
import { Label } from '@/components/ui/label';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where } from 'firebase/firestore';

export default function FichaPage() {
  const { firestore } = useFirebase();

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData } = useCollection<Dato>(datosQuery);

  const [departments, setDepartments] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');

  useEffect(() => {
    if (datosData) {
      const uniqueDepts = [...new Set(datosData.map(d => d.departamento))].sort();
      setDepartments(uniqueDepts);
    }
  }, [datosData]);

  const reportsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    let q = collection(firestore, 'reports');

    let conditions: any[] = [];
    if (selectedDept) {
        conditions.push(where('departamento', '==', selectedDept));
    }
    if (selectedDistrict) {
        conditions.push(where('distrito', '==', selectedDistrict));
    }

    if (conditions.length > 0) {
        return query(q, ...conditions);
    }
    
    return q;
  }, [firestore, selectedDept, selectedDistrict]);

  const { data: filteredReports } = useCollection<ReportData>(reportsQuery);

  const handleDeptChange = async (deptName: string) => {
    setSelectedDistrict('');
    setDistricts([]);

    if (deptName === 'all-depts') {
        setSelectedDept('');
        return;
    }

    setSelectedDept(deptName);

    if (deptName && datosData) {
        const relatedDistricts = datosData
            .filter(d => d.departamento === deptName)
            .map(d => d.distrito)
            .sort();
        setDistricts([...new Set(relatedDistricts)]);
    }
  };

  const handleDistrictChange = (distName: string) => {
    if (distName === 'all-districts') {
      setSelectedDistrict('');
    } else {
      setSelectedDistrict(distName);
    }
  };
  
  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Vista de Ficha" />
      <main className="flex flex-1 flex-col p-4 gap-8">
        <Card className="w-full max-w-6xl mx-auto">
          <CardHeader>
            <CardTitle>Filtros de Visualización</CardTitle>
            <CardDescription>
              Selecciona un departamento y distrito para ver la información detallada.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 space-y-2">
              <Label>Departamento</Label>
              <Select onValueChange={handleDeptChange} value={selectedDept || 'all-depts'}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar Departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-depts">Todos los Departamentos</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-2">
              <Label>Distrito</Label>
              <Select
                onValueChange={handleDistrictChange}
                value={selectedDistrict || 'all-districts'}
                disabled={!selectedDept}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar Distrito" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-districts">Todos los Distritos</SelectItem>
                  {districts.map((dist) => (
                    <SelectItem key={dist} value={dist}>
                      {dist}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl mx-auto">
            {filteredReports && filteredReports.length > 0 ? (
                filteredReports.map((report, index) => (
                    <Card key={index}>
                        <CardHeader>
                            <CardTitle>{report.distrito}, {report.departamento}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                           {Object.entries(report).map(([key, value]) => {
                             if (key === 'departamento' || key === 'distrito' || key === 'id') return null;
                             return (
                               <div key={key}>
                                 <p className="font-semibold capitalize text-muted-foreground">{key.replace(/-/g, ' ')}:</p>
                                 <p>{String(value)}</p>
                               </div>
                             );
                           })}
                        </CardContent>
                    </Card>
                ))
            ) : (
                <div className="col-span-full text-center py-12">
                    <p className="text-muted-foreground">No hay reportes que coincidan con los filtros seleccionados.</p>
                </div>
            )}
        </div>
      </main>
    </div>
  );
}
