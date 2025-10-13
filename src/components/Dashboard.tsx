import BedStatusBoard from "./BedStatusBoard";
import CleaningAlerts from "./CleaningAlerts";
import EgressTracker from "./EgressTracker";
import PredictivePanel from "./PredictivePanel";

export default function Dashboard() {
  return (
    <div className="container mx-auto py-8 px-4 flex flex-col gap-8">
      <h2 className="text-3xl font-bold mb-2">Tablero en Tiempo Real</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <BedStatusBoard />
        <PredictivePanel />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <CleaningAlerts />
        <EgressTracker />
      </div>
    </div>
  );
}
