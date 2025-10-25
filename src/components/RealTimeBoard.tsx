"use client";
import BedStatusBoard from "./BedStatusBoard";
import BedSwapBoard from "./BedSwapBoard";
import Dashboard from "./Dashboard";
import EgressTracker from "./EgressTracker";

export default function RealTimeBoard() {
  return (
    <div className="w-full max-w-[96vw] mx-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <h2 className="card-title mb-4">Tablero en Tiempo Real</h2>
        <div className="card-lg mb-6">
          <BedSwapBoard />
        </div>
        <div className="card-lg mb-6">
          <BedStatusBoard />
        </div>
        <div className="card-lg">
          <Dashboard />
        </div>
      </div>
      <div className="flex flex-col gap-8">
        <EgressTracker />
      </div>
    </div>
  );
}
