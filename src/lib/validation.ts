import { z } from "zod";

// Only PARENT and SITTER can self-register. Admins are seeded.
export const registerSchema = z
  .object({
    name: z.string().min(2).max(120),
    email: z.string().email(),
    password: z.string().min(8).max(200),
    role: z.enum(["PARENT", "SITTER"]),
    phone: z.string().max(40).optional().or(z.literal("")),
    city: z.string().max(120).optional().or(z.literal("")),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;

export const passwordResetRequestSchema = z
  .object({
    email: z.string().email(),
  })
  .strict();

export const passwordResetConfirmSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(8).max(200),
  })
  .strict();

const linesToArray = (v: string) =>
  v
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

export const applicationSchema = z.object({
  bio: z.string().min(10).max(2000),
  experience: z.string().min(10).max(2000),
  certifications: z.string().max(1000).optional().default(""),
  documentUrls: z.string().max(2000).optional().default(""),
  targetPayRate: z.coerce.number().int().min(1).max(500),
});

export const vetSchema = z.object({
  applicationId: z.string().min(1),
  listedPayRate: z.coerce.number().int().min(1).max(500),
  adminNotes: z.string().max(2000).optional().or(z.literal("")),
});

const lastMinuteEligible = z
  .union([z.literal("on"), z.literal("true"), z.literal(""), z.boolean()])
  .optional()
  .transform((v) => v === "on" || v === "true" || v === true);

export const slotSchema = z
  .object({
    startTime: z.string().min(1),
    endTime: z.string().min(1),
    isLastMinuteEligible: lastMinuteEligible,
  })
  .refine((v) => new Date(v.endTime) > new Date(v.startTime), {
    message: "End time must be after start time.",
    path: ["endTime"],
  });

export const interviewSchema = z.object({
  applicationId: z.string().min(1),
  interviewScheduledAt: z.string().optional().or(z.literal("")),
  interviewNotes: z.string().max(4000).optional().or(z.literal("")),
});

export const reviewSchema = z.object({
  bookingId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().or(z.literal("")),
});

export const bookingSchema = z.object({
  slotId: z.string().min(1),
  childrenAgeRange: z.string().min(1).max(40),
  numberOfChildren: z.coerce.number().int().min(1).max(10),
  notes: z.string().max(1000).optional().or(z.literal("")),
  waiverAccepted: z
    .union([z.literal("on"), z.literal("true"), z.boolean()])
    .refine((v) => v === "on" || v === "true" || v === true, {
      message: "You must accept the waiver to book.",
    }),
});

// A parent asking for a time nobody has published availability for. There is no
// slot to reference, so the window is entered directly.
export const bookingRequestSchema = z.object({
  startTime: z.string().min(1, "Choose a date and start time."),
  durationHours: z.coerce
    .number()
    .int()
    .min(1, "Bookings are at least 1 hour.")
    .max(12, "Requests can be up to 12 hours."),
  childrenAgeRange: z.string().trim().min(1).max(40),
  numberOfChildren: z.coerce.number().int().min(1).max(10),
  notes: z.string().max(1000).optional().or(z.literal("")),
  waiverAccepted: z
    .union([z.literal("on"), z.literal("true"), z.boolean()])
    .refine((v) => v === "on" || v === "true" || v === true, {
      message: "You must accept the waiver to request a sitter.",
    }),
});

export const reportSchema = z.object({
  bookingId: z.string().min(1),
  reason: z.string().min(3).max(2000),
});

export const messageSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const settingsSchema = z.object({
  lastMinuteThresholdHours: z.coerce.number().int().min(0).max(168),
  rushFeeType: z.enum(["FLAT", "PERCENT"]),
  rushFeeAmount: z.coerce.number().int().min(0).max(100000),
  platformFeeType: z.enum(["FLAT", "PERCENT"]),
  platformFeeAmount: z.coerce.number().int().min(0).max(100000),
  minParentVerificationLevelToBook: z.enum([
    "LEVEL_0_REGISTERED",
    "LEVEL_1_CONTACT",
    "LEVEL_2_IDENTITY",
  ]),
  completionConfirmedBy: z.enum(["PARENT", "ADMIN"]),
  notifySmsEnabled: z
    .union([z.literal("on"), z.literal("true"), z.literal(""), z.boolean()])
    .optional()
    .transform((v) => v === "on" || v === "true" || v === true),
  notifyWhatsappEnabled: z
    .union([z.literal("on"), z.literal("true"), z.literal(""), z.boolean()])
    .optional()
    .transform((v) => v === "on" || v === "true" || v === true),
  cancellationWindowHours: z.coerce.number().int().min(0).max(336),
  cancellationChargePercent: z.coerce.number().int().min(0).max(100),
});

// --- Parent KYC ---

export const verifyCodeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

// Phone can be (re)set at the contact-verification step.
export const phoneSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number.")
    .max(40),
});

export const serviceAddressSchema = z.object({
  streetAddress: z.string().trim().min(3, "Enter your street address.").max(200),
  unit: z.string().trim().max(40).optional().or(z.literal("")),
  city: z.string().trim().min(2, "Enter your city.").max(120),
  province: z.string().trim().min(2, "Enter your province.").max(60),
  postalCode: z.string().trim().min(3, "Enter your postal code.").max(12),
});

export { linesToArray };
