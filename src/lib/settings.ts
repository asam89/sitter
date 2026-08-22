import type {
  BusinessSettings,
  CompletionConfirmer,
  FeeType,
  VerificationLevel,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SINGLETON = "singleton";

function envFeeType(v: string | undefined, fallback: FeeType): FeeType {
  return v === "FLAT" || v === "PERCENT" ? v : fallback;
}

function envLevel(
  v: string | undefined,
  fallback: VerificationLevel,
): VerificationLevel {
  return v === "LEVEL_0_REGISTERED" ||
    v === "LEVEL_1_CONTACT" ||
    v === "LEVEL_2_IDENTITY"
    ? v
    : fallback;
}

const DEFAULTS = {
  lastMinuteThresholdHours: Number(process.env.LAST_MINUTE_THRESHOLD_HOURS ?? 12),
  rushFeeType: envFeeType(process.env.RUSH_FEE_TYPE, "PERCENT"),
  rushFeeAmount: Number(process.env.RUSH_FEE_AMOUNT ?? 25),
  platformFeeType: envFeeType(process.env.PLATFORM_FEE_TYPE, "PERCENT"),
  platformFeeAmount: Number(process.env.PLATFORM_FEE_AMOUNT ?? 15),
  minParentVerificationLevelToBook: envLevel(
    process.env.MIN_PARENT_VERIFICATION_LEVEL_TO_BOOK,
    "LEVEL_1_CONTACT",
  ),
  minBookingHours: Number(process.env.MIN_BOOKING_HOURS ?? 2),
} as const;

// Loads the single BusinessSettings row, creating it from env defaults on first
// use so the admin dashboard always has a row to edit.
export async function getBusinessSettings(): Promise<BusinessSettings> {
  return prisma.businessSettings.upsert({
    where: { id: SINGLETON },
    create: { id: SINGLETON, ...DEFAULTS },
    update: {},
  });
}

export type BusinessSettingsInput = {
  lastMinuteThresholdHours: number;
  rushFeeType: FeeType;
  rushFeeAmount: number;
  platformFeeType: FeeType;
  platformFeeAmount: number;
  minParentVerificationLevelToBook: VerificationLevel;
  completionConfirmedBy: CompletionConfirmer;
  notifySmsEnabled: boolean;
  notifyWhatsappEnabled: boolean;
  minBookingHours: number;
  extraChildFeeAmount: number;
  lateNightFeeAmount: number;
  lateNightStartHour: number;
  lateNightEndHour: number;
  overnightFeeAmount: number;
  overnightStartHour: number;
  overnightEndHour: number;
  refundFullBeforeHours: number;
  lateCancelWindowHours: number;
  midRefundPercent: number;
  lateRefundPercent: number;
  afterStartRefundPercent: number;
  sitterCancelRefundPercent: number;
};

export async function updateBusinessSettings(
  input: BusinessSettingsInput,
): Promise<BusinessSettings> {
  return prisma.businessSettings.upsert({
    where: { id: SINGLETON },
    create: { id: SINGLETON, ...input },
    update: input,
  });
}
