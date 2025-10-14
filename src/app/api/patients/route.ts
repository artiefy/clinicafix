import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { patients } from "@/server/db/schema";
import { Patient } from "@/types";

export async function GET() {
  try {
    const patientsData = await db.select().from(patients);
    return NextResponse.json(patientsData as Patient[]);
  } catch (_err) {
    return NextResponse.json({ error: "Error al obtener pacientes" }, { status: 500 });
  }
}
