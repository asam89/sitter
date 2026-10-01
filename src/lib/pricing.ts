import type { Booking, BusinessSettings, SitterProfile } from "@prisma/client";

export type PriceBreakdown = {
  listedRate: number;
  durationHours: number;
  base: number; // listedRate * durationHours
  isLastMinute: boolean;
  rushFee: number; // disclosed as a distinct line item
  extraChildFee: number;
  lateNightFee: number;
  overnightFee: number;
  platformFee: number;
  total: number; // what the parent is charged
  sitterPayout: number; // released to the sitter on completion
};

function applyFee(
  type: BusinessSettings["rushFeeType"],
  amount: number,
  base: number,
): number {
  if (type === "FLAT") return Math.max(0, Math.round(amount));
  return Math.max(0, Math.round((base * amount) / 100));
}

// Is a booking starting at `start` inside the configurable last-minute window?
export function isLastMinute(
  start: Date,
  thresholdHours: number,
  now: Date = new Date(),
): boolean {
  const leadMs = start.getTime() - now.getTime();
  return leadMs < thresholdHours * 3600 * 1000;
}

// Sitters price their own time; the Admin-set listedPayRate is the fallback for
// sitters who haven't set a rate (and the rate every existing sitter keeps).
export function effectiveRate(
  profile: Pick<SitterProfile, "baseRate" | "listedPayRate">,
): number {
  return profile.baseRate ?? profile.listedPayRate;
}

// Does a session touch an hour-of-day window? Windows may wrap midnight
// (e.g. 22:00–06:00), so membership is tested per hour rather than by range
// comparison. The app runs in America/Toronto, so local hours are the
// customer's hours.
function overlapsHourWindow(
  start: Date,
  durationHours: number,
  startHour: number,
  endHour: number,
): boolean {
  if (startHour === endHour) return false;
  const inWindow = (hour: number) =>
    startHour < endHour
      ? hour >= startHour && hour < endHour
      : hour >= startHour || hour < endHour;
  for (let i = 0; i < durationHours; i++) {
    const at = new Date(start.getTime() + i * 3600 * 1000);
    if (inWindow(at.getHours())) return true;
  }
  return false;
}

// Rush fee is added on top of the base and paid out to the sitter (compensation
// for short notice); the platform fee is Ri'aya's cut, added to the parent's
// total so the sitter keeps their full rate. Surcharges (extra child, late
// night, overnight) are flat, stack, and are each disclosed as their own line.
// See docs/sitbaby-agency-model-notes.md.
export function computePrice(
  hourlyRate: number,
  durationHours: number,
  lastMinute: boolean,
  settings: BusinessSettings,
  start?: Date,
  numberOfChildren: number = 1,
): PriceBreakdown {
  const base = hourlyRate * durationHours;
  const rushFee = lastMinute
    ? applyFee(settings.rushFeeType, settings.rushFeeAmount, base)
    : 0;
  const extraChildFee =
    settings.extraChildFeeAmount * Math.max(0, numberOfChildren - 1);
  const lateNightFee =
    start &&
    overlapsHourWindow(
      start,
      durationHours,
      settings.lateNightStartHour,
      settings.lateNightEndHour,
    )
      ? settings.lateNightFeeAmount
      : 0;
  const overnightFee =
    start &&
    overlapsHourWindow(
      start,
      durationHours,
      settings.overnightStartHour,
      settings.overnightEndHour,
    )
      ? settings.overnightFeeAmount
      : 0;
  const platformFee = applyFee(
    settings.platformFeeType,
    settings.platformFeeAmount,
    base,
  );
  const surcharges = extraChildFee + lateNightFee + overnightFee;
  return {
    listedRate: hourlyRate,
    durationHours,
    base,
    isLastMinute: lastMinute,
    rushFee,
    extraChildFee,
    lateNightFee,
    overnightFee,
    platformFee,
    total: base + rushFee + surcharges + platformFee,
    sitterPayout: base + rushFee + surcharges,
  };
}

// What the sitter keeps on a stored booking: everything except Ri'aya's fee,
// which is added on top of the sitter's rate for the family.
export function sitterPayout(
  booking: Pick<Booking, "totalAmount" | "platformFeeAmount">,
): number {
  return booking.totalAmount - booking.platformFeeAmount;
}
