import { NextRequest, NextResponse } from "next/server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/server/db";
import { pre_egresos } from "@/server/db/schema";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const patientId = Number(params.id);
  if (!Number.isFinite(patientId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const rows = await db.select().from(pre_egresos).where(eq(pre_egresos.patient_id, patientId));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const patientId = Number(params.id);
  if (!Number.isFinite(patientId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const contenido = form.get("contenido");
    const safeContenido = typeof contenido === "string" ? contenido : "";
    await db.insert(pre_egresos).values({ patient_id: patientId, contenido: safeContenido });
    return NextResponse.json({ message: "Pre-egreso guardado" });
  } else {
    const body = await req.json();
    const schema = z.object({ contenido: z.string().optional() });
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    await db.insert(pre_egresos).values({ patient_id: patientId, contenido: parsed.data.contenido ?? "" });
    return NextResponse.json({ message: "Pre-egreso guardado" });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  // Actualiza el último registro de pre-egreso para el paciente
  const patientId = Number(params.id);
  if (!Number.isFinite(patientId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const body = await req.json();
  const schema = z.object({ contenido: z.string().optional() });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  // Encuentra el último registro y actualízalo
  const rows = await db.select().from(pre_egresos).where(eq(pre_egresos.patient_id, patientId));
  if (rows.length === 0) return NextResponse.json({ error: "No hay pre-egreso para actualizar" }, { status: 404 });
  const lastId = rows[rows.length - 1].id;
  await db.update(pre_egresos).set({ contenido: parsed.data.contenido ?? "" }).where(eq(pre_egresos.id, lastId));
  return NextResponse.json({ message: "Pre-egreso actualizado" });
}
