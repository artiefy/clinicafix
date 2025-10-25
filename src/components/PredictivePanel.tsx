"use client";
import useSWR from "swr";

import { Prediction } from "@/types";

export default function PredictivePanel() {
  const { data: predictions } = useSWR<Prediction[]>("/api/predictions");
  const preds = predictions ?? [];

  return (
    <section className="card">
      <h3 className="card-title">Analítica Predictiva</h3>
      <div className="text-white">
        {preds.map((pred) => (
          <p key={pred.id} className="mb-2">
            {pred.description}
          </p>
        ))}
      </div>
    </section>
  );
}
