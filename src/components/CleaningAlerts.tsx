"use client";
import { useEffect, useState } from "react";

interface Alert {
  bedId: number;
  room: string;
  status: "Pendiente" | "En Proceso" | "Completada";
  timestamp: string;
}

export default function CleaningAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    // TODO: fetch cleaning alerts from API route
    setAlerts([
      { bedId: 2, room: "102", status: "En Proceso", timestamp: "2024-06-10 12:45" },
      { bedId: 4, room: "104", status: "Pendiente", timestamp: "2024-06-10 13:10" },
    ]);
  }, []);

  return (
    <section className="bg-white/10 rounded-xl p-6 text-white shadow">
      <h3 className="text-xl font-bold mb-4">Alertas de Limpieza</h3>
      <ul>
        {alerts.map((alert) => (
          <li key={alert.bedId} className="mb-2">
            <strong>Cama {alert.bedId} - Habitación {alert.room}:</strong>{" "}
            <span
              className={`px-2 py-1 rounded ${alert.status === "Pendiente"
                  ? "bg-yellow-500"
                  : alert.status === "En Proceso"
                    ? "bg-blue-600"
                    : "bg-green-600"
                }`}
            >
              {alert.status}
            </span>{" "}
            <span className="text-xs text-gray-300">({alert.timestamp})</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
