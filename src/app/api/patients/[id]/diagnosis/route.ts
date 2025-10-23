import { NextRequest, NextResponse } from "next/server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/server/db";
import { patients } from "@/server/db/schema";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const patientId = Number(params.id);
  if (!Number.isFinite(patientId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const [p] = await db.select().from(patients).where(eq(patients.id, patientId));
  if (!p) return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
  return NextResponse.json({ diagnosticos_procedimientos: p.diagnosticos_procedimientos ?? "" });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const patientId = Number(params.id);
  if (!Number.isFinite(patientId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const text = form.get("diagnosticos_procedimientos");
    const safeText = typeof text === "string" ? text : "";
    await db.update(patients).set({ diagnosticos_procedimientos: safeText }).where(eq(patients.id, patientId));
    return NextResponse.json({ message: "Diagnóstico actualizado" });
  } else {
    const body = await req.json();
    const schema = z.object({ diagnosticos_procedimientos: z.string().optional() });
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    await db.update(patients).set({ diagnosticos_procedimientos: parsed.data.diagnosticos_procedimientos ?? "" }).where(eq(patients.id, patientId));
    return NextResponse.json({ message: "Diagnóstico actualizado" });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return POST(req, { params });
}
