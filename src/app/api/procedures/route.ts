import { NextRequest, NextResponse } from "next/server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/server/db";
import { procedures } from "@/server/db/schema";

// GET: /api/procedures?patientId=...
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const patientId = url.searchParams.get("patientId");
    if (!patientId) return NextResponse.json({ error: "patientId requerido" }, { status: 400 });
    const pid = Number(patientId);
    if (!Number.isFinite(pid)) return NextResponse.json({ error: "patientId inválido" }, { status: 400 });
    const rows = await db.select().from(procedures).where(eq(procedures.patient_id, pid)).orderBy(procedures.created_at);
    return NextResponse.json(rows);
  } catch (err) {
    console.error("GET /api/procedures error:", err);
    return NextResponse.json({ error: "Error al obtener procedimientos" }, { status: 500 });
  }
}

// POST: crear procedimiento
export async function POST(req: NextRequest) {
  const body = await req.json();
  const schema = z.object({
    patient_id: z.number(),
    descripcion: z.string(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  const now = new Date();
  const [inserted] = await db
    .insert(procedures)
    .values({
      patient_id: parsed.data.patient_id,
      descripcion: parsed.data.descripcion,
      created_at: now,
    })
    .returning();
  return NextResponse.json(inserted);
}
