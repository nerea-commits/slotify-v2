export interface Empresa {
  id: string;
  nombre: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  horario_inicio?: string;
  horario_fin?: string;
  color_primario?: string;
  color_secundario?: string;
  logo_url?: string;
  dias_laborables?: number[];
  auth_user_id?: string;
}

export interface Profesional {
  id: string;
  nombre: string;
  rol: string;
  pin?: string;
  empresa_id: string;
  horario_inicio?: string;
  horario_fin?: string;
}

export interface Cliente {
  id: string;
  nombre: string;
  telefono?: string;
  email?: string;
  notas?: string;
  empresa_id: string;
}

export interface Servicio {
  id: string;
  nombre: string;
  duracion_minutos?: number;
  precio?: number;
  empresa_id: string;
}
