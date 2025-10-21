"use client";
import BedStatusBoard from "./BedStatusBoard";
import BedSwapBoard from "./BedSwapBoard";
import CleaningAlerts from "./CleaningAlerts";
import Dashboard from "./Dashboard";
import EgressTracker from "./EgressTracker";
import PredictivePanel from "./PredictivePanel";

export default function RealTimeBoard() {
  return (
    <div className="w-full max-w-[96vw] mx-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">Tablero en Tiempo Real</h2>
        <BedSwapBoard />
        <BedStatusBoard />
        <Dashboard />
      </div>
      <div className="flex flex-col gap-8">
        <PredictivePanel />
        <CleaningAlerts />
        <EgressTracker />
      </div>
    </div>
  );
}
