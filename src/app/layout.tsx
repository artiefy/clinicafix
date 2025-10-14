import { Geist } from "next/font/google";

import SWRProviderClient from "@/components/SWRProviderClient";

import type { Metadata } from "next";

import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "SYO - Gestión Inteligente de Egresos",
  description:
    "Tablero de gestión hospitalaria con IA, analítica y automatización.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${geist.variable}`}>
      <body>
        {/* Header global */}
        <header className="w-full bg-[#2e026d] text-white py-4 px-8 flex items-center justify-between shadow">
          <h1 className="text-2xl font-bold">SYO - Gestión Inteligente de Egresos</h1>
          <span className="text-sm">Clínica DIME</span>
        </header>

        <SWRProviderClient>
          {children}
        </SWRProviderClient>
      </body>
    </html>
  );
}
