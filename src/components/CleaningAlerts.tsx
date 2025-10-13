"use client";
import { useEffect, useState } from "react";

import { Alert, Bed, Room } from "@/types";

function formatDate(date: Date | string) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function CleaningAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/alerts").then((res) => res.json() as Promise<Alert[]>),
      fetch("/api/beds").then((res) => res.json() as Promise<Bed[]>),
      fetch("/api/rooms").then((res) => res.json() as Promise<Room[]>),
    ])
      .then(([alertsData, bedsData, roomsData]) => {
        setAlerts(alertsData);
        setBeds(bedsData);
        setRooms(roomsData);
      })
      .catch(() => {
        setAlerts([]);
        setBeds([]);
        setRooms([]);
      });
  }, []);

  const getRoomNumber = (bed_id: number) => {
    const bed = beds.find((b) => b.id === bed_id);
    return bed ? rooms.find((r) => r.id === bed.room_id)?.number ?? bed.room_id : "";
  };

  return (
    <section className="bg-white/10 rounded-xl p-6 text-white shadow">
      <h3 className="text-xl font-bold mb-4">Alertas de Limpieza</h3>
      <ul>
        {alerts.map((alert) => (
          <li key={alert.id} className="mb-2">
            <strong>
              Cama {alert.bed_id} - Habitación {getRoomNumber(alert.bed_id)}:
            </strong>{" "}
            <span
              className={`px-2 py-1 rounded ${alert.type === "Pendiente"
                ? "bg-yellow-500"
                : alert.type === "En Proceso"
                  ? "bg-blue-600"
                  : "bg-green-600"
                }`}
            >
              {alert.type}
            </span>{" "}
            <span className="text-xs text-gray-300">
              ({formatDate(alert.timestamp)})
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
