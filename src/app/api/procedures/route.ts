import { NextRequest, NextResponse } from "next/server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/server/db";
import { patient_procedures, procedures } from "@/server/db/schema";

// zod schemas para parsear filas desde la BD
const procedureRowSchema = z.object({
  id: z.number(),
  patient_id: z.number(),
  nombre: z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  tiempo: z.number().nullable().optional(),
  audio_url: z.string().nullable().optional(),
  created_at: z.any(),
});
const patientProcedureRowSchema = z.object({
  id: z.number(),
  patient_id: z.number(),
  procedure_id: z.number().nullable().optional(),
  nombre: z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  tiempo: z.number().nullable().optional(),
  audio_url: z.string().nullable().optional(),
  created_at: z.any(),
});

// GET: /api/procedures?patientId=...
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const patientId = url.searchParams.get("patientId");
    if (patientId) {
      const pid = Number(patientId);
      if (!Number.isFinite(pid)) return NextResponse.json({ error: "patientId inválido" }, { status: 400 });

      // Intentar leer patient_procedures; si falla, fallback a procedures assigned
      let pRowsRaw: unknown[] = [];
      try {
        pRowsRaw = await db
          .select({
            id: patient_procedures.id,
            patient_id: patient_procedures.patient_id,
            procedure_id: patient_procedures.procedure_id,
            nombre: patient_procedures.nombre,
            descripcion: patient_procedures.descripcion,
            tiempo: patient_procedures.tiempo,
            audio_url: patient_procedures.audio_url,
            created_at: patient_procedures.created_at,
          })
          .from(patient_procedures)
          .where(eq(patient_procedures.patient_id, pid))
          .orderBy(patient_procedures.created_at);
      } catch (_err) {
        // fallback -> procedures table where patient_id = pid (old schema)
        const alt = await db
          .select({
            id: procedures.id,
            patient_id: procedures.patient_id,
            nombre: procedures.nombre,
            descripcion: procedures.descripcion,
            tiempo: procedures.tiempo,
            audio_url: procedures.audio_url,
            created_at: procedures.created_at,
          })
          .from(procedures)
          .where(eq(procedures.patient_id, pid))
          .orderBy(procedures.created_at);
        pRowsRaw = alt.map((a: unknown) => ({
          id: (a as { id: number }).id,
          patient_id: (a as { patient_id: number }).patient_id,
          procedure_id: (a as { id: number }).id,
          nombre: (a as { nombre?: string | null }).nombre ?? null,
          descripcion: (a as { descripcion?: string | null }).descripcion ?? null,
          tiempo: (a as { tiempo?: number | null }).tiempo ?? null,
          audio_url: (a as { audio_url?: string | null }).audio_url ?? null,
          created_at: (a as { created_at: unknown }).created_at,
        }));
      }

      // plantillas (procedures with patient_id = 0)
      const templatesRaw = await db
        .select({
          id: procedures.id,
          patient_id: procedures.patient_id,
          nombre: procedures.nombre,
          descripcion: procedures.descripcion,
          tiempo: procedures.tiempo,
          audio_url: procedures.audio_url,
          created_at: procedures.created_at,
        })
        .from(procedures)
        .where(eq(procedures.patient_id, 0));

      const templates = templatesRaw
        .map((t) => {
          const parsed = procedureRowSchema.safeParse(t);
          return parsed.success ? parsed.data : null;
        })
        .filter(Boolean) as z.infer<typeof procedureRowSchema>[];

      const tmplById = new Map<number, z.infer<typeof procedureRowSchema>>();
      templates.forEach((t) => tmplById.set(t.id, t));

      // normalizar pRowsRaw validando cada fila
      const pRows = pRowsRaw
        .map((r) => {
          const parsed = patientProcedureRowSchema.safeParse(r);
          if (!parsed.success) {
            // si no pasa validación, intentar coaccionar campos comunes
            const o = r as Record<string, unknown>;
            return {
              id: Number(o.id) || 0,
              patient_id: Number(o.patient_id) || pid,
              procedure_id: typeof o.procedure_id === "number" ? o.procedure_id : (o.id ? Number(o.id) : null),
              nombre: typeof o.nombre === "string" ? o.nombre : null,
              descripcion: typeof o.descripcion === "string" ? o.descripcion : null,
              tiempo: typeof o.tiempo === "number" ? o.tiempo : null,
              audio_url: typeof o.audio_url === "string" ? o.audio_url : null,
              created_at: o.created_at ?? null,
            } as z.infer<typeof patientProcedureRowSchema>;
          }
          return parsed.data;
        })
        .filter((x) => x.id && typeof x.patient_id === "number");

      // enrich con plantilla
      const rows = pRows.map((pr) => {
        const tpl = pr.procedure_id ? tmplById.get(pr.procedure_id) : undefined;
        return {
          id: pr.id,
          patient_id: pr.patient_id,
          procedure_id: pr.procedure_id,
          nombre: pr.nombre ?? tpl?.nombre ?? null,
          descripcion: pr.descripcion ?? tpl?.descripcion ?? null,
          tiempo: pr.tiempo ?? tpl?.tiempo ?? null,
          audio_url: pr.audio_url ?? tpl?.audio_url ?? null,
          created_at: pr.created_at,
        };
      });

      return NextResponse.json(rows);
    }

    // devolver todos los procedimientos asignados a pacientes (desde patient_procedures)
    const allPatientProceduresRaw = await db
      .select({
        id: patient_procedures.id,
        patient_id: patient_procedures.patient_id,
        nombre: patient_procedures.nombre,
        descripcion: patient_procedures.descripcion,
        tiempo: patient_procedures.tiempo,
        audio_url: patient_procedures.audio_url,
        created_at: patient_procedures.created_at,
      })
      .from(patient_procedures)
      .orderBy(patient_procedures.patient_id, patient_procedures.created_at);

    const allPatientProcedures = allPatientProceduresRaw
      .map((t) => procedureRowSchema.safeParse(t))
      .filter((p) => p.success)
      .map((p) => p.data);

    return NextResponse.json(allPatientProcedures);
  } catch (err) {
    console.error("GET /api/procedures error:", err);
    return NextResponse.json({ error: "Error al obtener procedimientos" }, { status: 500 });
  }
}

// POST: create template OR assign existing template to patient (patient_procedures)
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "Content-Type no soportado en este endpoint" }, { status: 415 });
  }

  const body = await req.json();

  // intentar asignación a patient_procedures primero
  const assignSchema = z.object({
    patient_id: z.number(),
    procedure_id: z.number().optional(),
    descripcion: z.string().optional(),
    tiempo: z.number().optional(),
    audio_url: z.string().optional(),
  });
  const assignParsed = assignSchema.safeParse(body);
  if (assignParsed.success) {
    const v = assignParsed.data;
    const insertObj: {
      patient_id: number;
      procedure_id?: number | null;
      descripcion?: string | null;
      tiempo?: number | null;
      audio_url?: string | null;
      created_at: Date;
    } = {
      patient_id: v.patient_id,
      created_at: new Date(),
    };
    if (typeof v.procedure_id === "number") insertObj.procedure_id = v.procedure_id;
    if (typeof v.descripcion === "string") insertObj.descripcion = v.descripcion;
    if (typeof v.tiempo === "number") insertObj.tiempo = v.tiempo;
    if (typeof v.audio_url === "string") insertObj.audio_url = v.audio_url;

    try {
      const [inserted] = await db.insert(patient_procedures).values(insertObj).returning();
      return NextResponse.json(inserted);
    } catch (err) {
      console.warn("Insert into patient_procedures failed, falling back to procedures table:", String(err));
      // fallback: create a procedures row with patient_id set (older schema)
      const procInsert: {
        patient_id: number;
        nombre?: string | null;
        descripcion?: string | null;
        tiempo?: number | null;
        audio_url?: string | null;
        created_at: Date;
      } = {
        patient_id: v.patient_id,
        created_at: new Date(),
      };
      if (typeof v.descripcion === "string") procInsert.nombre = v.descripcion;
      if (typeof v.descripcion === "string") procInsert.descripcion = v.descripcion;
      if (typeof v.tiempo === "number") procInsert.tiempo = v.tiempo;
      if (typeof v.audio_url === "string") procInsert.audio_url = v.audio_url;
      const [insertedFallback] = await db.insert(procedures).values(procInsert).returning();
      return NextResponse.json(insertedFallback);
    }
  }

  // crear plantilla en procedures (patient_id === 0)
  const schema = z.object({
    patient_id: z.number().optional().default(0),
    nombre: z.string().min(1),
    descripcion: z.string().optional(),
    tiempo: z.number().optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const insertValues: {
    patient_id: number;
    nombre: string;
    descripcion?: string | null;
    tiempo?: number | null;
    created_at: Date;
  } = {
    patient_id: parsed.data.patient_id,
    nombre: parsed.data.nombre,
    created_at: new Date(),
  };
  if (typeof parsed.data.descripcion === "string") insertValues.descripcion = parsed.data.descripcion;
  if (typeof parsed.data.tiempo === "number") insertValues.tiempo = parsed.data.tiempo;

  const [inserted] = await db.insert(procedures).values(insertValues).returning();
  return NextResponse.json(inserted);
}
