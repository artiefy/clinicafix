export interface Room {
  id: number;
  number: number;
}

export type BedStatus =
  | "Disponible"
  | "Ocupada"
  | "Limpieza"
  | "Mantenimiento"
  | "Aislamiento"
  | "Reserva";

export interface Bed {
  id: number;
  room_id: number;
  status: BedStatus;
  last_update: Date | string;
}

// Estados de paciente y columnas ordenadas
export type PatientStatus =
  | "activo"
  | "inactivo"
  | "pendiente"
  | "de alta"
  | "con cama"
  | "sin cama"
  | "diagnosticos_procedimientos"
  | "pre-egreso";

export interface Patient {
  id: number;
  name: string;
  bed_id: number | null;
  status?: PatientStatus;
  diagnostico?: string;
  procedimiento?: string;
  diagnosticos_procedimientos?: string;
  pre_egreso?: string;
  discharge_status?: PatientStatus;
  estimated_time: string | null;
}

export interface PatientHistory {
  id: number;
  patient_id: number;
  tipo: "texto" | "audio";
  contenido: string;
  fecha: Date | string;
}

export interface Discharge {
  id: number;
  patient: string;
  bed_id: number;
  status: string;
  expected_time: Date | string | null;
  created_at: Date | string;
}

export interface Prediction {
  id: number;
  description: string;
  created_at: Date | string;
}

export interface Alert {
  id: number;
  bed_id: number;
  type: string;
  timestamp: Date | string;
}

export interface Post {
  id: number;
  name: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}
