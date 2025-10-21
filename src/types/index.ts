export interface Room {
  id: number;
  number: number;
}

export type BedStatus =
  | "Disponible"
  | "Atención Médica"
  | "Limpieza"
  | "Diagnostico y Procedimiento"
  | "Pre-egreso"

// Nuevo: estados específicos para la columna Limpieza
export type AuxBedStatus = "Limpieza" | "Mantenimiento" | "Aislamiento" | "Reserva";

export interface Bed {
  id: number;
  room_id: number;
  status: BedStatus;
  last_update: Date | string;
  aux_status?: AuxBedStatus | null;
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
  // audio asociado al diagnóstico (si se graba desde la UI)
  diagnostic_audio_url?: string | null;
  diagnostic_audio_recorded_at?: Date | string | null;
  diagnostic_audio_duration_seconds?: number | null;

  // nuevos datos personales
  city?: string | null;
  phone?: string | null;
  blood_type?: string | null;
  birth_date?: string | null; // ISO date string (YYYY-MM-DD)
  extra_comment?: string | null;
}

// Nuevo: audios de diagnóstico (tabla independiente)
export interface DiagnosticAudio {
  id: number;
  patient_id: number;
  audio_url: string;
  audio_recorded_at?: Date | string | null;
  audio_duration_seconds?: number | null;
  audio_mime?: string | null;
  created_at: Date | string;
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

// New: procedimiento individual relacionado a paciente
export interface Procedure {
  id: number;
  patient_id: number;
  descripcion: string;
  created_at: Date | string;
  // ahora los audios se guardan en la tabla procedure_audios (varios por procedimiento)
  // campo opcional para compatibilidad con UI (puede venir del backend como convenience)
  audio_url?: string | null;
}

// Nuevo: registros de audio asociados a procedimientos (múltiples por procedimiento)
export interface ProcedureAudio {
  id: number;
  procedure_id: number;
  patient_id: number;
  audio_url: string;
  audio_recorded_at?: Date | string | null;
  audio_duration_seconds?: number | null;
  audio_mime?: string | null;
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
