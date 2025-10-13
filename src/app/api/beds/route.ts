import { NextResponse } from "next/server";

export function GET(_req: Request) {
  const beds = [
    { id: 1, status: "Disponible", room: "101", lastUpdate: "2024-06-10 13:00" },
    { id: 2, status: "Limpieza", room: "102", lastUpdate: "2024-06-10 12:45" },
    { id: 3, status: "Ocupada", room: "103", lastUpdate: "2024-06-10 11:30" },
  ];
  return NextResponse.json(beds);
}
