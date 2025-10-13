"use client";
import { useEffect, useState } from "react";

export default function PredictivePanel() {
  const [prediction, setPrediction] = useState<string>("");

  useEffect(() => {
    // TODO: fetch prediction from API route
    setPrediction("Se prevé liberar 5 camas antes de las 14:00h. Tiempo promedio de limpieza: 45 min.");
  }, []);

  return (
    <section className="bg-white/10 rounded-xl p-6 text-white shadow">
      <h3 className="text-xl font-bold mb-4">Analítica Predictiva</h3>
      <p>{prediction}</p>
    </section>
  );
}
