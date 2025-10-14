export interface Room {
  id: number;
  number: number;
}

export interface Bed {
  id: number;
  room_id: number;
  status: string;
  last_update: Date;
}

// Define explicit patient status literals
export type PatientStatus = "sin cama" | "con cama" | "de alta" | "Pendiente" | "En Proceso";

export interface Patient {
  id: number;
  name: string;
  bed_id: number | null; // null = sin cama
  discharge_status: PatientStatus;
  estimated_time: string | null;
}

export interface Discharge {
  id: number;
  patient: string;
  bed_id: number;
  status: string;
  expected_time: Date | null;
  created_at: Date;
}

export interface Prediction {
  id: number;
  description: string;
  created_at: Date;
}

export interface Alert {
  id: number;
  bed_id: number;
  type: string;
  timestamp: Date;
}

export interface Post {
  id: number;
  name: string | null;
  created_at: Date;
  updated_at: Date;
}
