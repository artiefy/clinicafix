"use client";

import React from "react";

import useSWR from "swr";

import { Bed, Room } from "@/types";
import { to12HourWithDate } from "@/utils/time"; // <-- nuevo import

export default function Dashboard() {
  const { data: beds } = useSWR<Bed[]>("/api/dashboard");
  const { data: rooms } = useSWR<Room[]>("/api/rooms");
  const bedsList = beds ?? [];
  const roomsList = rooms ?? [];

  const getRoomNumber = (room_id: number) =>
    roomsList.find((r) => r.id === room_id)?.number ?? room_id;

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Estado de Camas desde la base de datos</h2>
      <div className="overflow-hidden rounded shadow">
        <table className="w-full bg-white text-black table-auto">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">ID</th>
              <th className="px-4 py-3 text-left font-semibold">Habitación</th>
              <th className="px-4 py-3 text-left font-semibold">Estado</th>
              <th className="px-4 py-3 text-left font-semibold">Última actualización</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {bedsList.map((bed) => (
              <tr key={bed.id} className="last:pb-4">
                <td className="px-4 py-3 align-top">{bed.id}</td>
                <td className="px-4 py-3 align-top">{getRoomNumber(bed.room_id)}</td>
                <td className="px-4 py-3 align-top">{bed.status}</td>
                <td className="px-4 py-3 align-top">{to12HourWithDate(bed.last_update)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
