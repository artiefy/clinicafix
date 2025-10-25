// Util: conversion entre 24h <-> 12h (AM/PM)

export function to12Hour(input: Date | string | null | undefined): string {
  if (!input) return "";
  let d: Date;
  if (input instanceof Date) {
    d = input;
  } else if (typeof input === "string") {
    const hhmmMatch = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(input);
    if (hhmmMatch) {
      const hh = Number(hhmmMatch[1]);
      const mm = Number(hhmmMatch[2]);
      d = new Date();
      d.setHours(hh, mm, 0, 0);
    } else {
      const parsed = new Date(input);
      if (Number.isNaN(parsed.getTime())) return "";
      d = parsed;
    }
  } else {
    return "";
  }

  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "pm" : "am"; // lowercase as requested
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const mins = String(minutes).padStart(2, "0");
  return `${hours}:${mins} ${ampm}`;
}

export function to12HourWithDate(input: Date | string | null | undefined): string {
  if (!input) return "—";
  let d: Date;
  if (input instanceof Date) {
    d = input;
  } else if (typeof input === "string") {
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) {
      d = parsed;
    } else {
      const hhmmMatch = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(input);
      if (hhmmMatch) {
        const hh = Number(hhmmMatch[1]);
        const mm = Number(hhmmMatch[2]);
        d = new Date();
        d.setHours(hh, mm, 0, 0);
      } else {
        return "—";
      }
    }
  } else {
    return "—";
  }

  // Formato: "ultimo: 6:20 pm oct, 10" (mantener por compatibilidad)
  const time12 = to12Hour(d);
  const monthShort = d.toLocaleString("en-US", { month: "short" }).toLowerCase();
  const day = d.getDate();
  return `ultimo: ${time12} ${monthShort}, ${day}`;
}

/* --- NEW: versión corta (sin prefijo "ultimo:") --- */
export function to12HourWithDateShort(input: Date | string | null | undefined): string {
  if (!input) return "—";
  let d: Date;
  if (input instanceof Date) {
    d = input;
  } else if (typeof input === "string") {
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) {
      d = parsed;
    } else {
      const hhmmMatch = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(input);
      if (hhmmMatch) {
        const hh = Number(hhmmMatch[1]);
        const mm = Number(hhmmMatch[2]);
        d = new Date();
        d.setHours(hh, mm, 0, 0);
      } else {
        return "—";
      }
    }
  } else {
    return "—";
  }

  // Formato solicitado sin el prefijo: "6:20 pm oct, 10"
  const time12 = to12Hour(d);
  const monthShort = d.toLocaleString("en-US", { month: "short" }).toLowerCase();
  const day = d.getDate();
  return `${time12} ${monthShort}, ${day}`;
}
