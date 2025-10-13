import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { discharges } from "@/server/db/schema";
import { Discharge } from "@/types";

export async function GET() {
  try {
    const dischargesData = await db.select().from(discharges);
    return NextResponse.json(dischargesData as Discharge[]);
  } catch (_err) {
    return NextResponse.json({ error: "Error al obtener egresos" }, { status: 500 });
  }
}
