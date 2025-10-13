"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import { createSwapy, SlotItemMapArray, Swapy, utils } from "swapy";

import { Bed, Room } from "@/types";

interface SlottedItem<T> {
  slotId: string;
  itemId: string | null;
  item: T | null;
}

function formatDate(date: Date | string) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const STATUS: ("Disponible" | "Limpieza" | "Ocupada")[] = [
  "Disponible",
  "Limpieza",
  "Ocupada",
];

export default function BedSwapBoard() {
  const [beds, setBeds] = useState<Bed[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [slotItemMap, setSlotItemMap] = useState<SlotItemMapArray>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const swapyRef = useRef<Swapy | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/beds").then((res) => res.json() as Promise<Bed[]>),
      fetch("/api/rooms").then((res) => res.json() as Promise<Room[]>),
    ])
      .then(([bedsData, roomsData]) => {
        setBeds(bedsData);
        setRooms(roomsData);
        setSlotItemMap(utils.initSlotItemMap(bedsData, "id"));
      })
      .catch(() => {
        setBeds([]);
        setRooms([]);
        setSlotItemMap([]);
      });
  }, []);

  useEffect(() => {
    if (!containerRef.current || beds.length === 0) return;
    const swapyInstance = createSwapy(containerRef.current, {
      manualSwap: true,
    });

    interface SwapySwapEvent {
      newSlotItemMap: { asArray: SlotItemMapArray };
      to?: { slotId: string };
      item?: { id: number };
    }

    swapyInstance.onSwap(async (event: SwapySwapEvent) => {
      setSlotItemMap(event.newSlotItemMap.asArray);
      const slotId = event.to?.slotId;
      const itemId = event.item?.id;
      // Find the new status by checking which column contains the slotId
      let newStatus: "Disponible" | "Limpieza" | "Ocupada" | undefined;
      for (const status of STATUS) {
        if (
          beds.find(
            (b) => `bed-${b.id}` === slotId && b.status === status
          )
        ) {
          newStatus = status;
          break;
        }
      }
      if (newStatus && itemId !== undefined) {
        await fetch(`/api/beds/${itemId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
      }
    });
    swapyRef.current = swapyInstance;
    return () => {
      swapyRef.current?.destroy();
      swapyRef.current = null;
    };
  }, [beds]);

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

  // Compute slotted items
  const slottedItems = useMemo<SlottedItem<Bed>[]>(
    () => utils.toSlottedItems(beds, "id", slotItemMap) as SlottedItem<Bed>[],
    [beds, slotItemMap]
  );

  const getRoomNumber = (room_id: number) =>
    rooms.find((r) => r.id === room_id)?.number ?? room_id;

  // Group slotted items by status for columns
  const statusGroups: Record<string, SlottedItem<Bed>[]> = {
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
      <h3 className="text-xl font-bold mb-4">Mover Camas por Estado</h3>
      <div
        ref={containerRef}
        className="flex flex-col md:flex-row gap-4 w-full"
      >
        {STATUS.map((status) => (
          <div
            key={status}
            className="flex-1 bg-white/10 rounded-lg p-4 min-h-[220px]"
          >
            <h4 className="font-semibold mb-2 text-center">{status}</h4>
            {statusGroups[status].map(({ slotId, itemId, item }) =>
              item ? (
                <div key={slotId} data-swapy-slot={slotId}>
                  <div
                    className="mb-2 bg-white/20 rounded shadow p-2"
                    data-swapy-item={itemId ?? ""}
                  >
                    <div>
                      <span className="font-bold">Cama {item.id}</span> - Hab.{" "}
                      {getRoomNumber(item.room_id)}
                    </div>
                    <div className="text-xs">
                      Última actualización: {formatDate(item.last_update)}
                    </div>
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
