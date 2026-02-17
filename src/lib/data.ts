
export interface ImageData {
  id: string;
  src: string;
  alt: string;
  tags?: string[];
  date?: string;
  category?: string;
  hint: string;
  departamento: string;
  distrito: string;
}

export interface District {
  id: string;
  name: string;
  departmentId: string;
  reports?: ReportData[];
}

export interface Department {
  id: string;
  name: string;
  districts: District[];
}

export type ReportData = {
  id: string;
  departamento: string;
  distrito: string;
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
    id?: string;
    departamento: string;
    departamento_codigo?: string;
    distrito: string;
    distrito_codigo?: string;
}

export type LocalVotacion = {
  id: string;
  codigo_local?: string;
  departamento: string;
  distrito: string;
  zona?: string;
  local: string;
  direccion?: string;
  gps?: string;
  foto_frente?: string;
  foto2?: string;
  foto3?: string;
  foto4?: string;
  foto5?: string;
  foto6?: string;
  foto7?: string;
  foto8?: string;
  foto9?: string;
  foto10?: string;
}

export type SolicitudCapacitacion = {
  id: string;
  solicitante_entidad: string;
  tipo_solicitud: 'divulgacion' | 'capacitacion';
  fecha: string;
  hora_desde: string;
  hora_hasta: string;
  lugar_local: string;
  direccion_calle: string;
  barrio_compania: string;
  departamento: string;
  distrito: string;
  rol_solicitante: 'apoderado' | 'otro';
  nombre_completo: string;
  cedula: string;
  telefono: string;
  gps: string;
  foto_firma?: string;
  usuario_id: string;
  fecha_creacion: string;
}

export const initialDepartments: Department[] = [];
