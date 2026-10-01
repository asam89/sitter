import { differenceInMinutes } from "date-fns";

const HOUR_MS = 3600 * 1000;

export function slotDurationHours(startTime: Date, endTime: Date): number {
  return Math.max(1, Math.round(differenceInMinutes(endTime, startTime) / 60));
}

export type BookingWindow = { start: Date; end: Date; hours: number };

// A parent books part of an open block: any whole-hour start inside the block,
// for any whole number of hours from the minimum up to the block's end. Returns
// null when the window doesn't fit inside the block.
export function resolveWindow(
  slot: { startTime: Date; endTime: Date },
  startIso: string | undefined,
  durationHours: number | undefined,
  minHours: number,
): BookingWindow | null {
  const blockHours = slotDurationHours(slot.startTime, slot.endTime);
  const start = startIso ? new Date(startIso) : slot.startTime;
  const hours = durationHours ?? blockHours;
  if (Number.isNaN(start.getTime())) return null;
  if (!Number.isInteger(hours) || hours < Math.max(1, minHours)) return null;
  const offsetMs = start.getTime() - slot.startTime.getTime();
  if (offsetMs < 0 || offsetMs % HOUR_MS !== 0) return null;
  const end = new Date(start.getTime() + hours * HOUR_MS);
  if (end.getTime() > slot.endTime.getTime()) return null;
  return { start, end, hours };
}

// Every whole-hour start a parent may pick inside a block, given the minimum.
export function windowStarts(
  slot: { startTime: Date; endTime: Date },
  minHours: number,
): Date[] {
  const starts: Date[] = [];
  const last = slot.endTime.getTime() - Math.max(1, minHours) * HOUR_MS;
  for (let t = slot.startTime.getTime(); t <= last; t += HOUR_MS) {
    starts.push(new Date(t));
  }
  return starts;
}

export function maxHoursFrom(
  slot: { startTime: Date; endTime: Date },
  start: Date,
): number {
  return Math.floor((slot.endTime.getTime() - start.getTime()) / HOUR_MS);
}

// The open leftovers when `window` is carved out of `slot`.
export function remainders(
  slot: { startTime: Date; endTime: Date },
  window: BookingWindow,
): { startTime: Date; endTime: Date }[] {
  const out: { startTime: Date; endTime: Date }[] = [];
  if (window.start.getTime() > slot.startTime.getTime()) {
    out.push({ startTime: slot.startTime, endTime: window.start });
  }
  if (window.end.getTime() < slot.endTime.getTime()) {
    out.push({ startTime: window.end, endTime: slot.endTime });
  }
  return out;
}
