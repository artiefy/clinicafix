"use client";
import { useEffect, useState } from "react";

import { Prediction } from "@/types";

export default function PredictivePanel() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);

  useEffect(() => {
    fetch("/api/predictions")
      .then((res) => res.json())
      .then((data: Prediction[]) => setPredictions(data))
      .catch(() => setPredictions([]));
  }, []);

  return (
    <section className="bg-white/10 rounded-xl p-6 text-white shadow">
      <h3 className="text-xl font-bold mb-4">Analítica Predictiva</h3>
      {predictions.map((pred) => (
        <p key={pred.id}>{pred.description}</p>
      ))}
    </section>
  );
}
