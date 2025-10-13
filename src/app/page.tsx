import BedStatusBoard from "@/components/BedStatusBoard";
import BedSwapBoard from "@/components/BedSwapBoard";
import CleaningAlerts from "@/components/CleaningAlerts";
import Dashboard from "@/components/Dashboard";
import EgressTracker from "@/components/EgressTracker";
import PredictivePanel from "@/components/PredictivePanel";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      <div className="w-full max-w-6xl mx-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="flex flex-col gap-8">
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
    </main>
  );
}
