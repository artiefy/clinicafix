import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { patients } from "@/server/db/schema";
import { Patient } from "@/types";

export async function GET() {
  try {
    try {
      const patientsData = await db.select().from(patients);
      if (!Array.isArray(patientsData)) {
        console.error("GET /api/patients: resultado inesperado:", patientsData);
        return NextResponse.json([] as Patient[]);
      }
      return NextResponse.json(patientsData as Patient[]);
    } catch (err: unknown) {
      // Si falla la consulta con schema, loguear y devolver array vacío.
      // Nota: evita intentar raw queries aquí (db.query) porque en este proyecto causa errores de tipado.
      console.error(
        "GET /api/patients: fallo en consulta con schema. Revisa que el schema y la BD estén sincronizados.",
        err
      );
      return NextResponse.json([] as Patient[]);
    }
  } catch (outer) {
    console.error("GET /api/patients: error no manejado:", outer);
    return NextResponse.json([] as Patient[]);
  }
}
