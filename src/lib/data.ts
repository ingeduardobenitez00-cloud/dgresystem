
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
  divulgador_id?: string;
  divulgador_nombre?: string;
  divulgador_cedula?: string;
  fecha_creacion: string;
}

export type EncuestaSatisfaccion = {
  id: string;
  lugar_practica: string;
  fecha: string;
  hora: string;
  edad: string;
  genero: 'hombre' | 'mujer' | 'pueblo_originario';
  utilidad_maquina: 'muy_util' | 'util' | 'poco_util' | 'nada_util';
  facilidad_maquina: 'muy_facil' | 'facil' | 'poco_facil' | 'nada_facil';
  seguridad_maquina: 'muy_seguro' | 'seguro' | 'poco_seguro' | 'nada_seguro';
  departamento: string;
  distrito: string;
  usuario_id: string;
  fecha_creacion: string;
}

export type InformeDivulgador = {
  id: string;
  lugar_divulgacion: string;
  fecha: string;
  hora_desde: string;
  hora_hasta: string;
  nombre_divulgador: string;
  cedula_divulgador: string;
  vinculo: string;
  oficina: string;
  departamento: string;
  distrito: string;
  total_personas: number;
  marcaciones: number[];
  fotos?: string[];
  usuario_id: string;
  fecha_creacion: string;
}

export type InformeSemanalFila = {
  lugar: string;
  fecha: string;
  hora_desde: string;
  hora_hasta: string;
  nombre_divulgador: string;
  cedula: string;
  vinculo: string;
  cantidad_personas: number;
}

export type InformeSemanalAnexoIV = {
  id: string;
  semana_desde: string;
  semana_hasta: string;
  departamento: string;
  distrito: string;
  filas: InformeSemanalFila[];
  usuario_id: string;
  fecha_creacion: string;
}

export const initialDepartments: Department[] = [];
