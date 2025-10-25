import React from "react";

import BedStatusBoard from "@/components/BedStatusBoard";
import BedSwapBoard from "@/components/BedSwapBoard";
import EgressTracker from "@/components/EgressTracker";
import ProtectedDashboard from "@/components/ProtectedDashboard";

export default function HomePage() {
  return (
    <main style={{ background: "linear-gradient(180deg, var(--main-1), var(--main-2), var(--main-3))" }} className="flex min-h-screen flex-col items-center justify-start text-white py-8">
      <div className="w-full max-w-[96vw] mx-auto p-4 flex flex-col gap-8">
        {/* Nuevo: contenido protegido / saludo de usuario */}
        <ProtectedDashboard>
          <section>
            <BedSwapBoard />
          </section>
        </ProtectedDashboard>

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
