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

export const slotSchema = z
  .object({
    startTime: z.string().min(1),
    endTime: z.string().min(1),
  })
  .refine((v) => new Date(v.endTime) > new Date(v.startTime), {
    message: "End time must be after start time.",
    path: ["endTime"],
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
});

export { linesToArray };
