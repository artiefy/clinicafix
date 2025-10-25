"use client";
import React, { useEffect, useState } from "react";

import { subscribeToast } from "./toastService";

interface ToastItem { id: number; title: string; description?: string; type?: "info" | "success" | "warning" | "error"; ttl?: number }

export default function Toasts() {
    const [list, setList] = useState<ToastItem[]>([]);

    useEffect(() => {
        const unsub = subscribeToast((t) => {
            setList((s) => [t, ...s]);
            // auto remove after ttl
            setTimeout(() => {
                setList((s) => s.filter((x) => x.id !== t.id));
            }, t.ttl ?? 6000);
        });
        return unsub;
    }, []);

    const colorFor = (type?: string) =>
        type === "success" ? "bg-green-600" : type === "warning" ? "bg-amber-500" : type === "error" ? "bg-red-600" : "bg-sky-600";

    return (
        <div aria-live="polite" className="fixed top-4 right-4 z-50 flex flex-col gap-3">
            {list.map((t) => (
                <div key={t.id} className={`max-w-sm w-full rounded-lg overflow-hidden ${colorFor(t.type)} ring-1 ring-black/20 card-item`}>
                    <div className="px-4 py-3">
                        <div className="font-semibold">{t.title}</div>
                        {t.description ? <div className="text-sm mt-1 opacity-90">{t.description}</div> : null}
                    </div>
                </div>
            ))}
        </div>
    );
}
