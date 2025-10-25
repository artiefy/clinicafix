"use client";
import useSWR from "swr";

import { Alert } from "@/types";

export default function CleaningAlerts() {
  const { data: alerts } = useSWR<Alert[]>("/api/alerts");
  const list = alerts ?? [];

  return (
    <section className="card">
      <h3 className="card-title">Alertas de Limpieza</h3>
      <div className="card-subtitle">
        Total alertas: <strong>{list.length}</strong>
      </div>
    </section>
  );
}
