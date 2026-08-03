import type {
  ApplicationStatus,
  BookingStatus,
  ReportStatus,
} from "@prisma/client";

type Color = "slate" | "green" | "amber" | "red" | "indigo";

export const BOOKING_STATUS_COLOR: Record<BookingStatus, Color> = {
  REQUESTED: "amber",
  CONFIRMED: "indigo",
  COMPLETED: "green",
  CANCELLED: "slate",
};

export const APPLICATION_STATUS_COLOR: Record<ApplicationStatus, Color> = {
  APPLIED: "amber",
  UNDER_REVIEW: "indigo",
  VETTED: "green",
  REJECTED: "red",
};

export const REPORT_STATUS_COLOR: Record<ReportStatus, Color> = {
  OPEN: "amber",
  INVESTIGATING: "indigo",
  RESOLVED: "green",
  DISMISSED: "slate",
};
