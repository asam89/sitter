import type { BookingStatus } from "@prisma/client";

type Color = "slate" | "green" | "amber" | "red" | "indigo";

export const BOOKING_STATUS_COLOR: Record<BookingStatus, Color> = {
  PENDING: "amber",
  ACCEPTED: "indigo",
  IN_PROGRESS: "indigo",
  COMPLETED: "green",
  CANCELLED: "slate",
  EXPIRED: "red",
};
