
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

export type MaquinaVotacion = {
  id: string;
  codigo: string;
  departamento: string;
  distrito: string;
  fecha_registro: string;
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

export type Divulgador = {
  id: string;
  nombre: string;
  cedula: string;
  vinculo: 'PERMANENTE' | 'CONTRATADO' | 'COMISIONADO';
  departamento: string;
  distrito: string;
  fecha_registro: string;
}

export type AnexoIFila = {
  lugar: string;
  direccion: string;
  fecha_desde: string;
  fecha_hasta: string;
  hora_desde: string;
  hora_hasta: string;
}

export type AnexoI = {
  id: string;
  tipo_oficina: 'REGISTRO' | 'CENTRO_CIVICO' | 'OFICINA_CENTRAL';
  departamento: string;
  distrito: string;
  filas: AnexoIFila[];
  foto_respaldo: string;
  usuario_id: string;
  fecha_creacion: string;
}

export type AnexoIVFila = {
  lugar: string;
  fecha: string;
  hora_desde: string;
  hora_hasta: string;
  nombre_divulgador: string;
  cedula: string;
  vinculo: string;
  cantidad_personas: number;
}

export type AnexoIV = {
  id: string;
  departamento: string;
  distrito: string;
  semana_desde: string;
  semana_hasta: string;
  foto_respaldo_documental: string;
  filas: AnexoIVFila[];
  usuario_id: string;
  fecha_creacion: string;
}

export type Asignado = {
  id: string;
  nombre: string;
  cedula: string;
  vinculo: string;
}

export type SolicitudCapacitacion = {
  id: string;
  solicitante_entidad: string;
  otra_entidad?: string;
  tipo_solicitud: 'divulgacion' | 'capacitacion' | 'Lugar Fijo';
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
  // Campos antiguos para retrocompatibilidad
  divulgador_id?: string;
  divulgador_nombre?: string;
  divulgador_cedula?: string;
  divulgador_vinculo?: string;
  // Nueva estructura multi-personal
  asignados?: Asignado[];
  divulgadores?: Asignado[];
  fecha_creacion: string;
  cancelada?: boolean;
  motivo_cancelacion?: string;
  fecha_cancelacion?: string;
  usuario_cancelacion?: string;
  qr_enabled?: boolean;
  anexo_id?: string;
  fecha_cumplido?: string;
}

export type EncuestaSatisfaccion = {
  id: string;
  lugar_practica: string;
  fecha: string;
  hora: string;
  edad: string;
  genero: 'hombre' | 'mujer';
  pueblo_originario: boolean;
  utilidad_maquina: 'muy_util' | 'util' | 'poco_util' | 'nada_util';
  facilidad_maquina: 'muy_facil' | 'facil' | 'poco_facil' | 'nada_facil';
  seguridad_maquina: 'muy_seguro' | 'seguro' | 'poco_seguro' | 'nada_seguro';
  departamento: string;
  distrito: string;
  usuario_id: string;
  solicitud_id: string;
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
  foto_respaldo_documental: string;
  usuario_id: string;
  fecha_creacion: string;
  solicitud_id: string;
  divulgador_id: string;
  observaciones?: string;
}

export type MaquinaMovimiento = {
  codigo: string;
  pendrive_serie: string;
  credencial: boolean;
  auricular: boolean;
  acrilico: boolean;
  boletas: boolean;
  lacre_estado?: 'correcto' | 'violentado';
  // Campos de retorno
  retorno_credencial?: boolean;
  retorno_auricular?: boolean;
  retorno_acrilico?: boolean;
  retorno_boletas?: boolean;
}

export type MovimientoMaquina = {
  id: string;
  solicitud_id: string;
  departamento: string;
  distrito: string;
  // Multiples máquinas (hasta 3)
  maquinas: MaquinaMovimiento[];
  // Datos comunes
  fecha_salida: string;
  hora_salida: string;
  fecha_devolucion?: string;
  hora_devolucion?: string;
  foto_salida?: string | string[];
  foto_devolucion?: string | string[];
  fecha_creacion: string;
  // Responsables (Copia de la lista de la agenda en ese momento)
  responsables: Asignado[];
}

export type PartidoPolitico = {
  id: string;
  nombre: string;
  siglas: string;
  movimiento?: string;
}

export const initialDepartments: Department[] = [];
