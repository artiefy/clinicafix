import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { procedures } from "@/server/db/schema";

// GET: /api/procedures/list - lista de procedimientos predefinidos
export async function GET() {
  try {
    const rows = await db
      .select({
        id: procedures.id,
        nombre: procedures.nombre,
        descripcion: procedures.descripcion,
        tiempo: procedures.tiempo,
        created_at: procedures.created_at,
      })
      .from(procedures)
      .where(eq(procedures.patient_id, 0))
      .orderBy(procedures.id);
    return NextResponse.json(rows);
  } catch (err) {
    console.error("GET /api/procedures/list error:", err);
    return NextResponse.json({ error: "Error al obtener lista de procedimientos" }, { status: 500 });
  }
}
