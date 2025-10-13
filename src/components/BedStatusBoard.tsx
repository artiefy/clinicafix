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
        setBeds(bedsData);
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
    <section className="bg-white/10 rounded-xl p-6 text-white shadow">
      <h3 className="text-xl font-bold mb-4">Estado de Camas</h3>
      <table className="w-full text-left">
        <thead>
          <tr>
            <th>Cama</th>
            <th>Habitación</th>
            <th>Estado</th>
            <th>Última actualización</th>
          </tr>
        </thead>
        <tbody>
          {beds.map((bed) => (
            <tr key={bed.id}>
              <td>{bed.id}</td>
              <td>{getRoomNumber(bed.room_id)}</td>
              <td>
                <span
                  className={`px-2 py-1 rounded ${bed.status === "Disponible"
                    ? "bg-green-600"
                    : bed.status === "Limpieza"
                      ? "bg-yellow-500"
                      : bed.status === "Ocupada"
                        ? "bg-red-600"
                        : "bg-blue-600"
                    }`}
                >
                  {bed.status}
                </span>
              </td>
              <td>{formatDate(bed.last_update)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
