"use client";
import useSWR from "swr";

import { Alert } from "@/types";

export default function CleaningAlerts() {
  const { data: alerts } = useSWR<Alert[]>("/api/alerts");
  const list = alerts ?? [];

  return (
    <section className="bg-white/10 rounded-xl p-6 text-white shadow">
      <h3 className="text-xl font-bold mb-4">Alertas de Limpieza</h3>
      <div className="text-sm text-gray-200">Total alertas: {list.length}</div>
    </section>
  );
}
