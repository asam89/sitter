import type { BusinessSettings } from "@prisma/client";

export type PriceBreakdown = {
  listedRate: number;
  durationHours: number;
  base: number; // listedRate * durationHours
  isLastMinute: boolean;
  rushFee: number; // disclosed as a distinct line item
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

// Rush fee is added on top of the base and paid out to the sitter (compensation
// for short notice); the platform fee is the platform's revenue. The
// target/listed pay spread is a separate internal margin, not charged to the
// parent. See docs/sitbaby-agency-model-notes.md.
export function computePrice(
  listedRate: number,
  durationHours: number,
  lastMinute: boolean,
  settings: BusinessSettings,
): PriceBreakdown {
  const base = listedRate * durationHours;
  const rushFee = lastMinute
    ? applyFee(settings.rushFeeType, settings.rushFeeAmount, base)
    : 0;
  const platformFee = applyFee(
    settings.platformFeeType,
    settings.platformFeeAmount,
    base,
  );
  return {
    listedRate,
    durationHours,
    base,
    isLastMinute: lastMinute,
    rushFee,
    platformFee,
    total: base + rushFee + platformFee,
    sitterPayout: base + rushFee,
  };
}
