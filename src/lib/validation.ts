import { z } from "zod";

export const registerSchema = z
  .object({
    name: z.string().min(2).max(120),
    email: z.string().email(),
    password: z.string().min(8).max(200),
    role: z.enum(["PARENT", "SITTER"]),
    phone: z.string().max(40).optional().or(z.literal("")),
    city: z.string().max(120).optional().or(z.literal("")),
    // Community affiliations selected at signup (partner ids). Optional so
    // parents "outside the network" can still join.
    communityPartnerIds: z.array(z.string()).optional().default([]),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;

export const bookingSchema = z.object({
  requestType: z.enum(["NOW", "SCHEDULED"]),
  dateTime: z.string().optional(), // ISO; required for SCHEDULED
  durationHours: z.coerce.number().int().min(1).max(12),
  childrenAgeRange: z.string().min(1).max(40),
  numberOfChildren: z.coerce.number().int().min(1).max(10),
  sitterId: z.string().optional(), // set when booking a specific sitter (advance)
  communityOnly: z.coerce.boolean().optional().default(false),
});

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().max(2000).optional().or(z.literal("")),
});

export const reportSchema = z.object({
  targetType: z.enum(["USER", "BOOKING", "MESSAGE_THREAD"]),
  targetId: z.string().min(1),
  reason: z.string().min(3).max(2000),
});

export const messageSchema = z.object({
  content: z.string().min(1).max(2000),
});
