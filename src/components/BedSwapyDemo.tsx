"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { createSwapy, SlotItemMapArray, Swapy, utils } from "swapy";

import { Bed } from "@/types";

const initialBeds: Bed[] = [
  { id: 1, room_id: 101, status: "Disponible", last_update: new Date() },
  { id: 2, room_id: 102, status: "Limpieza", last_update: new Date() },
  { id: 3, room_id: 103, status: "Ocupada", last_update: new Date() },
];

export default function BedSwapyDemo() {
  const [beds, setBeds] = useState<Bed[]>(initialBeds);
  const [slotItemMap, setSlotItemMap] = useState<SlotItemMapArray>(
    utils.initSlotItemMap(initialBeds, "id")
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const swapyRef = useRef<Swapy | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    swapyRef.current = createSwapy(containerRef.current, { manualSwap: true });
    swapyRef.current.onSwap((event) => {
      setSlotItemMap(event.newSlotItemMap.asArray);
      // Optionally update bed status in your state/db here
    });
    return () => {
      swapyRef.current?.destroy();
      swapyRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (swapyRef.current) {
      utils.dynamicSwapy(
        swapyRef.current,
        beds,
        "id",
        slotItemMap,
        setSlotItemMap
      );
    }
  }, [beds, slotItemMap]);

  const slottedItems = useMemo(
    () => utils.toSlottedItems(beds, "id", slotItemMap) as {
      slotId: string;
      itemId: string | null;
      item: Bed | null;
    }[],
    [beds, slotItemMap]
  );

  // Group by status
  const statusGroups: Record<string, typeof slottedItems> = {
    Disponible: [],
    Limpieza: [],
    Ocupada: [],
  };
  slottedItems.forEach((item) => {
    if (item.item && statusGroups[item.item.status]) {
      statusGroups[item.item.status].push(item);
    }
  });

  return (
    <div>
      <h3 className="text-xl font-bold mb-4">Mover Camas por Estado (Demo)</h3>
      <div ref={containerRef} className="flex gap-4">
        {Object.keys(statusGroups).map((status) => (
          <div
            key={status}
            className="flex-1 bg-white/10 rounded-lg p-4 min-h-[150px]"
            data-swapy-slot={status}
          >
            <h4 className="font-semibold mb-2">{status}</h4>
            {statusGroups[status].map(({ slotId, itemId, item }) =>
              item ? (
                <div
                  key={itemId ?? slotId}
                  className="mb-2 bg-white/20 rounded shadow p-2"
                  data-swapy-item={itemId ?? ""}
                >
                  <div>
                    <span className="font-bold">Cama {item.id}</span> - Hab. {item.room_id}
                  </div>
                  <div className="text-xs">
                    Última actualización: {item.last_update.toString()}
                  </div>
                </div>
              ) : null
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
