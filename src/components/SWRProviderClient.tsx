"use client";
import React from "react";

import { SWRConfig } from "swr";

const fetcher = (resource: string, init?: RequestInit) =>
  fetch(resource, init).then((r) => r.json());

export default function SWRProviderClient({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        dedupingInterval: 2000,
        // Desactivar polling automático: las mutaciones harán `mutate(...)` explícito.
        refreshInterval: 0,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
      }}
    >
      {children}
    </SWRConfig>
  );
}
