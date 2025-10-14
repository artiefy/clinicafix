"use client";
import { useEffect, useState } from "react";

import { Bed, Room } from "@/types";
import { to12HourWithDate } from "@/utils/time"; // <-- nuevo import

export default function BedStatusBoard() {
  const [beds, setBeds] = useState<Bed[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  // Polling: recargar estado de camas y habitaciones cada 5s para reflejar cambios en tiempo real
  useEffect(() => {
    let mounted = true;
    const fetchAll = async () => {
      try {
        const [bedsRes, roomsRes] = await Promise.all([fetch("/api/beds"), fetch("/api/rooms")]);
        if (!mounted) return;
        const bedsData = (await bedsRes.json()) as Bed[];
        const roomsData = (await roomsRes.json()) as Room[];
        const sortedBeds = Array.isArray(bedsData)
          ? bedsData.slice().sort((a, b) => new Date(String(b.last_update)).getTime() - new Date(String(a.last_update)).getTime())
          : [];
        setBeds(sortedBeds);
        setRooms(roomsData ?? []);
      } catch {
        if (!mounted) return;
        setBeds([]);
        setRooms([]);
      }
    };

    fetchAll();
    const id = setInterval(fetchAll, 5000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
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
                <td className="px-4 py-3 align-top">{to12HourWithDate(bed.last_update)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
