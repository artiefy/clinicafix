"use client";
import useSWR from "swr";

import { Bed, Room } from "@/types";
import { to12HourWithDate } from "@/utils/time";

export default function BedStatusBoard() {
  const { data: bedsData } = useSWR<Bed[]>("/api/beds");
  const { data: roomsData } = useSWR<Room[]>("/api/rooms");

  const beds = Array.isArray(bedsData)
    ? bedsData.slice().sort((a, b) => new Date(String(b.last_update)).getTime() - new Date(String(a.last_update)).getTime())
    : [];
  const rooms = Array.isArray(roomsData) ? roomsData : [];

  const getRoomNumber = (room_id: number) => rooms.find((r) => r.id === room_id)?.number ?? room_id;

  const statusClass = (s: string) => {
    switch (s) {
      case "Disponible":
        return "bg-green-600";
      case "Limpieza":
        return "bg-yellow-500 text-white";
      case "Atención Médica":
        return "bg-red-600";
      case "Diagnostico y Procedimiento":
        return "bg-blue-600";
      case "Pre-egreso":
        return "bg-amber-600 text-white";
      case "Mantenimiento":
        return "bg-gray-500";
      case "Aislamiento":
        return "bg-indigo-800";
      case "Reserva":
        return "bg-purple-600";
      default:
        return "bg-gray-600";
    }
  };

  return (
    <section className="rounded-xl p-6 text-black shadow">
      <h3 className="text-xl font-bold mb-4">Estado de Camas</h3>
      <div className="overflow-x-auto rounded">
        <table className="w-full table-fixed min-w-[600px] text-black">
          <colgroup>
            <col style={{ width: "20%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "30%" }} />
            <col style={{ width: "30%" }} />
          </colgroup>
          <thead className="bg-gray-50/10">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Cama</th>
              <th className="px-4 py-3 text-left font-semibold">Habitación</th>
              <th className="px-4 py-3 text-left font-semibold">Estado</th>
              <th className="px-4 py-3 text-left font-semibold">Última actualización</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {beds.map((bed) => (
              <tr key={bed.id}>
                <td className="px-4 py-3 align-top">{bed.id}</td>
                <td className="px-4 py-3 align-top">{getRoomNumber(bed.room_id)}</td>
                <td className="px-4 py-3 align-top">
                  <span className={`px-2 py-1 rounded ${statusClass(bed.status)}`}>{bed.status}</span>
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
