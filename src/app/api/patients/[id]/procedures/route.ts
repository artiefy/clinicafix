import { NextRequest, NextResponse } from "next/server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/server/db";
import { procedures } from "@/server/db/schema";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const patientId = Number(params.id);
  if (!Number.isFinite(patientId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const rows = await db.select().from(procedures).where(eq(procedures.patient_id, patientId));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const patientId = Number(params.id);
  if (!Number.isFinite(patientId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const descripcion = form.get("descripcion");
    const safeDescripcion = typeof descripcion === "string" ? descripcion : "";
    await db.insert(procedures).values({ patient_id: patientId, descripcion: safeDescripcion });
    return NextResponse.json({ message: "Procedimiento guardado" });
  } else {
    const body = await req.json();
    const schema = z.object({ descripcion: z.string().optional() });
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    await db.insert(procedures).values({ patient_id: patientId, descripcion: parsed.data.descripcion ?? "" });
    return NextResponse.json({ message: "Procedimiento guardado" });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  // Actualiza el último procedimiento para el paciente
  const patientId = Number(params.id);
  if (!Number.isFinite(patientId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const body = await req.json();
  const schema = z.object({ descripcion: z.string().optional() });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  // Encuentra el último registro y actualízalo
  const rows = await db.select().from(procedures).where(eq(procedures.patient_id, patientId));
  if (rows.length === 0) return NextResponse.json({ error: "No hay procedimiento para actualizar" }, { status: 404 });
  const lastId = rows[rows.length - 1].id;
  await db.update(procedures).set({ descripcion: parsed.data.descripcion ?? "" }).where(eq(procedures.id, lastId));
  return NextResponse.json({ message: "Procedimiento actualizado" });
}
