import { Geist } from "next/font/google";

import { esMX } from '@clerk/localizations';
import { ClerkProvider } from "@clerk/nextjs";

import Header from "@/components/Header";
import SWRProviderClient from "@/components/SWRProviderClient";
import Toasts from "@/components/Toasts";

import type { Metadata } from "next";

import "@/styles/globals.css";
import "@/styles/patient-modal-tab-btn.css";

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
    // Keep ClerkProvider so auth context is available in sign-in page (and server/client hooks)
    <ClerkProvider localization={esMX} dynamic>
      <html lang="es" className={`${geist.variable}`}>
        <body>
          {/* Header global (se oculta automáticamente en /sign-in) */}
          <Header />

          <SWRProviderClient>
            <Toasts />
            {children}
          </SWRProviderClient>
        </body>
      </html>
    </ClerkProvider>
  );
}
