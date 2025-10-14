import BedStatusBoard from "@/components/BedStatusBoard";
import BedSwapBoard from "@/components/BedSwapBoard";
import CleaningAlerts from "@/components/CleaningAlerts";
import EgressTracker from "@/components/EgressTracker";
import PredictivePanel from "@/components/PredictivePanel";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white py-8">
      <div className="w-full max-w-6xl mx-auto p-4 flex flex-col gap-8">
        {/* Top: full-width columns row (drag & drop board) */}
        <section aria-labelledby="board-title" className="w-full">
          <h2 id="board-title" className="text-2xl font-bold mb-4">
            Gestión de Pacientes y Camas
          </h2>
          <BedSwapBoard />
        </section>

        {/* Middle: two columns (predictive + alerts) */}
        <section className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <PredictivePanel />
          </div>
          <div>
            <CleaningAlerts />
          </div>
        </section>

        {/* Egress Tracker: full-width single row below the two panels */}
        <section className="w-full">
          <EgressTracker />
        </section>

        {/* Bottom: full-width status table */}
        <section className="w-full">
          <BedStatusBoard />
        </section>
      </div>
    </main>
  );
}
