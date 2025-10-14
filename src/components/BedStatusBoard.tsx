"use client";
import { useEffect, useState } from "react";

import { Bed, Room } from "@/types";

function formatDate(date: Date | string) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function BedStatusBoard() {
  const [beds, setBeds] = useState<Bed[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/beds").then((res) => res.json() as Promise<Bed[]>),
      fetch("/api/rooms").then((res) => res.json() as Promise<Room[]>),
    ])
      .then(([bedsData, roomsData]) => {
        // Ordenar por last_update descendente (más reciente primero)
        const sortedBeds = Array.isArray(bedsData)
          ? bedsData.slice().sort((a, b) => new Date(b.last_update).getTime() - new Date(a.last_update).getTime())
          : [];
        setBeds(sortedBeds);
        setRooms(roomsData);
      })
      .catch(() => {
        setBeds([]);
        setRooms([]);
      });
  }, []);

  const getRoomNumber = (room_id: number) =>
    rooms.find((r) => r.id === room_id)?.number ?? room_id;

  return (
    <section className="rounded-xl p-6 text-white shadow">
      <h3 className="text-xl font-bold mb-4">Estado de Camas</h3>
      <div className="overflow-hidden rounded">
        <table className="w-full text-white table-auto">
          <thead className="bg-gray-50/10">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Cama</th>
              <th className="px-4 py-3 text-left font-semibold">Habitación</th>
              <th className="px-4 py-3 text-left font-semibold">Estado</th>
              <th className="px-4 py-3 text-left font-semibold">Última actualización</th>
            </tr>
          </thead>
          <tbody className="divide-y ">
            {beds.map((bed) => (
              <tr key={bed.id}>
                <td className="px-4 py-3 align-top">{bed.id}</td>
                <td className="px-4 py-3 align-top">{getRoomNumber(bed.room_id)}</td>
                <td className="px-4 py-3 align-top">
                  <span
                    className={`px-2 py-1 rounded ${bed.status === "Disponible"
                      ? "bg-green-600"
                      : bed.status === "Limpieza"
                        ? "bg-yellow-500 text-white"
                        : bed.status === "Ocupada"
                          ? "bg-red-600"
                          : "bg-blue-600"
                      }`}
                  >
                    {bed.status}
                  </span>
                </td>
                <td className="px-4 py-3 align-top">{formatDate(bed.last_update)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
