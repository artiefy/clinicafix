import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { alerts } from "@/server/db/schema";
import { Alert } from "@/types";

export async function GET() {
  try {
    const alertsData = await db.select().from(alerts);
    return NextResponse.json(alertsData as Alert[]);
  } catch (_err) {
    return NextResponse.json({ error: "Error al obtener alertas" }, { status: 500 });
  }
}
