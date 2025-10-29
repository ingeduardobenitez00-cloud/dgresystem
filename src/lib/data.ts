export interface ImageData {
  id: string;
  src: string;
  alt: string;
  tags: string[];
  date: string;
  category: string;
  hint: string;
  departamento?: string;
  distrito?: string;
}

export interface District {
  id: string;
  name: string;
}

export interface Department {
  id: string;
  name: string;
  districts: District[];
}

export type ReportData = {
  id: string;
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

export type Dato = {
    departamento: string;
    distrito: string;
}

export const initialDepartments: Department[] = [];

    