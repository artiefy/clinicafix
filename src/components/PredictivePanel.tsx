"use client";
import useSWR from "swr";

import { Prediction } from "@/types";

export default function PredictivePanel() {
  const { data: predictions } = useSWR<Prediction[]>("/api/predictions");
  const preds = predictions ?? [];

  return (
    <section className="bg-white/10 rounded-xl p-6 text-white shadow">
      <h3 className="text-xl font-bold mb-4">Analítica Predictiva</h3>
      {preds.map((pred) => (
        <p key={pred.id}>{pred.description}</p>
      ))}
    </section>
  );
}
