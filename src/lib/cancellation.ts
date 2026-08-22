import type { BusinessSettings, RefundTier, Role } from "@prisma/client";

export type RefundOutcome = {
  tier: RefundTier;
  refundPercent: number;
  refundAmount: number;
  forfeitAmount: number; // what the parent does not get back
  hoursToStart: number;
};

export const REFUND_TIER_LABEL: Record<RefundTier, string> = {
  UNPAID: "No payment had been taken",
  PARENT_EARLY: "Cancelled with plenty of notice",
  PARENT_MID: "Cancelled before the late-cancellation window",
  PARENT_LATE: "Cancelled close to the start time",
  PARENT_AFTER_START: "Cancelled at or after the start time",
  SITTER_CANCELLED: "Sitter cancelled",
  ADMIN_CANCELLED: "Cancelled by Ri'aya",
};

// Plain-language policy shown to parents before they pay and on the booking.
export function refundPolicyLines(settings: BusinessSettings): string[] {
  return [
    `Cancel ${settings.refundFullBeforeHours}h or more before the start time — full refund.`,
    `Cancel between ${settings.lateCancelWindowHours}h and ${settings.refundFullBeforeHours}h before — ${settings.midRefundPercent}% refunded.`,
    `Cancel less than ${settings.lateCancelWindowHours}h before — ${settings.lateRefundPercent}% refunded.`,
    `At or after the start time — ${settings.afterStartRefundPercent}% refunded.`,
    `If the sitter or Ri'aya cancels — ${settings.sitterCancelRefundPercent}% refunded, including our fee.`,
  ];
}

// Resolve the refund for a cancellation. Tiers are keyed on who cancelled and,
// for a parent, how much notice they gave. The percentages themselves live in
// BusinessSettings so policy changes don't need a deploy.
export function computeRefund({
  actorRole,
  paidAmount,
  start,
  settings,
  now = new Date(),
}: {
  actorRole: Role;
  paidAmount: number; // 0 when the booking was never paid
  start: Date;
  settings: BusinessSettings;
  now?: Date;
}): RefundOutcome {
  const hoursToStart = (start.getTime() - now.getTime()) / (3600 * 1000);

  const tier: RefundTier =
    actorRole === "SITTER"
      ? "SITTER_CANCELLED"
      : actorRole === "ADMIN"
        ? "ADMIN_CANCELLED"
        : hoursToStart <= 0
          ? "PARENT_AFTER_START"
          : hoursToStart < settings.lateCancelWindowHours
            ? "PARENT_LATE"
            : hoursToStart < settings.refundFullBeforeHours
              ? "PARENT_MID"
              : "PARENT_EARLY";

  const percentByTier: Record<RefundTier, number> = {
    UNPAID: 0,
    PARENT_EARLY: 100,
    PARENT_MID: settings.midRefundPercent,
    PARENT_LATE: settings.lateRefundPercent,
    PARENT_AFTER_START: settings.afterStartRefundPercent,
    SITTER_CANCELLED: settings.sitterCancelRefundPercent,
    ADMIN_CANCELLED: settings.sitterCancelRefundPercent,
  };

  if (paidAmount <= 0) {
    return {
      tier: "UNPAID",
      refundPercent: 0,
      refundAmount: 0,
      forfeitAmount: 0,
      hoursToStart,
    };
  }

  const refundPercent = Math.min(100, Math.max(0, percentByTier[tier]));
  const refundAmount = Math.round((paidAmount * refundPercent) / 100);
  return {
    tier,
    refundPercent,
    refundAmount,
    forfeitAmount: paidAmount - refundAmount,
    hoursToStart,
  };
}
