"use client";

import React, { useEffect, useState } from "react";

import { Bed, Room } from "@/types";

function formatDate(date: Date | string) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function Dashboard() {
  const [beds, setBeds] = useState<Bed[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard").then((res) => res.json()),
      fetch("/api/rooms").then((res) => res.json()),
    ])
      .then(([bedsData, roomsData]) => {
        setBeds(Array.isArray(bedsData) ? bedsData : []);
        setRooms(Array.isArray(roomsData) ? roomsData : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div>Cargando...</div>;

  const getRoomNumber = (room_id: number) =>
    rooms.find((r) => r.id === room_id)?.number ?? room_id;

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Estado de Camas desde la base de datos</h2>
      <table className="w-full bg-white text-black rounded shadow">
        <thead>
          <tr>
            <th>ID</th>
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
              <td>{bed.status}</td>
              <td>{formatDate(bed.last_update)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
