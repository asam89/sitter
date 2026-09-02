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
    // Express, opt-in newsletter consent (CASL). Absent/false means no consent.
    newsletterOptIn: z.boolean().optional().default(false),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;

// An Admin creating an account for someone who signed up by phone or in person.
// No password field: the invitee sets their own through the emailed link.
export const adminCreateUserSchema = z.object({
  name: z.string().trim().min(2, "Enter their name.").max(120),
  email: z.string().trim().email("Enter a valid email address."),
  role: z.enum(["PARENT", "SITTER"]),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  // Sitters only: the Admin-set hourly rate the profile starts on.
  listedPayRate: z.coerce
    .number()
    .int()
    .min(1, "Set the sitter's hourly rate.")
    .max(500, "That rate looks too high — check it.")
    .optional(),
});

// Publishing waiver/terms text. The version label is how acceptances are
// traced, so it has to be short, unique and human-readable.
export const termsPublishSchema = z.object({
  version: z
    .string()
    .trim()
    .min(1, "Give the version a label, e.g. v1.")
    .max(40)
    .regex(
      /^[A-Za-z0-9._-]+$/,
      "Use letters, numbers, dots, dashes or underscores only.",
    ),
  body: z
    .string()
    .trim()
    .min(50, "The waiver text looks too short — paste the full text.")
    .max(40000),
});

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

// HTML checkboxes post "on" when ticked and nothing at all when not.
const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal(""), z.boolean()])
  .optional()
  .transform((v) => v === "on" || v === "true" || v === true);

export const applicationSchema = z.object({
  bio: z.string().min(10).max(2000),
  experience: z.string().min(10).max(2000),
  certifications: z.string().max(1000).optional().default(""),
  documentUrls: z.string().max(2000).optional().default(""),
  targetPayRate: z.coerce.number().int().min(1).max(500),
  whatsappPhone: z
    .string()
    .trim()
    .min(7, "Enter a valid mobile number.")
    .max(40),
  whatsappReachable: checkbox,
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
  // The real floor is BusinessSettings.minBookingHours, enforced in the action;
  // this is only a sanity bound.
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

// Admin entering a booking on a parent's behalf. No waiver field: the parent
// accepts the waiver themselves before paying.
export const adminBookingSchema = z.object({
  parentId: z.string().min(1, "Choose the parent."),
  sitterProfileId: z.string().min(1, "Choose the sitter."),
  startTime: z.string().min(1, "Choose a date and start time."),
  durationHours: z.coerce
    .number()
    .int()
    .min(1, "Bookings are at least 1 hour.")
    .max(12, "Bookings can be up to 12 hours."),
  childrenAgeRange: z.string().trim().min(1).max(40),
  numberOfChildren: z.coerce.number().int().min(1).max(10),
  notes: z.string().max(1000).optional().or(z.literal("")),
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
  minBookingHours: z.coerce.number().int().min(1).max(24),
  extraChildFeeAmount: z.coerce.number().int().min(0).max(100000),
  lateNightFeeAmount: z.coerce.number().int().min(0).max(100000),
  lateNightStartHour: z.coerce.number().int().min(0).max(23),
  lateNightEndHour: z.coerce.number().int().min(0).max(23),
  overnightFeeAmount: z.coerce.number().int().min(0).max(100000),
  overnightStartHour: z.coerce.number().int().min(0).max(23),
  overnightEndHour: z.coerce.number().int().min(0).max(23),
  refundFullBeforeHours: z.coerce.number().int().min(0).max(336),
  lateCancelWindowHours: z.coerce.number().int().min(0).max(336),
  midRefundPercent: z.coerce.number().int().min(0).max(100),
  lateRefundPercent: z.coerce.number().int().min(0).max(100),
  afterStartRefundPercent: z.coerce.number().int().min(0).max(100),
  sitterCancelRefundPercent: z.coerce.number().int().min(0).max(100),
  etransferEmail: z
    .string()
    .trim()
    .email("Enter a valid e-Transfer email, or leave it blank.")
    .or(z.literal("")),
  supportEmail: z
    .string()
    .trim()
    .email("Enter a valid support email, or leave it blank.")
    .or(z.literal("")),
  // 0 disables that reminder.
  reminderLeadHours: z.coerce.number().int().min(0).max(168),
  reminderFinalLeadHours: z.coerce.number().int().min(0).max(168),
});

// A sitter pricing their own time. The Admin-set rate stays as the fallback.
export const sitterRateSchema = z.object({
  baseRate: z.coerce
    .number()
    .int()
    .min(1, "Enter an hourly rate.")
    .max(500, "That rate looks too high — talk to us first."),
});

// A parent asking the sitter for a short intro call before the session.
export const interviewRequestSchema = z.object({
  bookingId: z.string().min(1),
  proposedAt: z.string().min(1, "Choose a time that suits you."),
  method: z.enum(["Phone call", "Video call", "In person"]),
  note: z.string().max(500).optional().or(z.literal("")),
});

// An Admin broadcast to parents who have newsletter consent on file.
export const campaignSchema = z.object({
  subject: z.string().trim().min(3, "Give the email a subject.").max(200),
  body: z.string().trim().min(20, "Write the message.").max(20000),
});

export const newsletterSignupSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  source: z.string().trim().max(40).optional().default(""),
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

// --- Sitter background checks ---

// Dates come from <input type="date"> so they arrive as "" or "YYYY-MM-DD".
// An empty renewBy is allowed (a CPR card with no printed expiry), but it then
// never counts as expiring, which is why Admin is nudged to fill it in.
const optionalDate = z
  .string()
  .trim()
  .max(10)
  .optional()
  .transform((v) => (v ? new Date(`${v}T12:00:00`) : null))
  .refine((v) => v === null || !Number.isNaN(v.getTime()), "Enter a valid date.");

export const screeningDetailsSchema = z.object({
  issuer: z.string().trim().max(160).optional().or(z.literal("")),
  issuedOn: optionalDate,
  renewBy: optionalDate,
  adminNotes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export { linesToArray };
