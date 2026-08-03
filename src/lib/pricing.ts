export interface PriceBreakdown {
  hourlyRate: number;
  platformFeePct: number;
  platformFeePerHour: number;
  hourlyTotal: number;
  durationHours: number;
  sitterEarnings: number;
  platformFeeAmount: number;
  totalAmount: number;
}

// All amounts are in whole currency units (CAD). Fee is a transparent,
// per-hour line item shown before the parent commits to a request.
export function computePrice(
  hourlyRate: number,
  platformFeePct: number,
  durationHours: number,
): PriceBreakdown {
  const platformFeePerHour = Math.round((hourlyRate * platformFeePct) / 100);
  const hourlyTotal = hourlyRate + platformFeePerHour;
  return {
    hourlyRate,
    platformFeePct,
    platformFeePerHour,
    hourlyTotal,
    durationHours,
    sitterEarnings: hourlyRate * durationHours,
    platformFeeAmount: platformFeePerHour * durationHours,
    totalAmount: hourlyTotal * durationHours,
  };
}
