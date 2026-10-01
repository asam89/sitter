import type {
  ApplicationStatus,
  BookingRequestStatus,
  BookingStatus,
  ReportStatus,
} from "@prisma/client";

export type Color = "slate" | "green" | "amber" | "red" | "indigo";

export const BOOKING_STATUS_COLOR: Record<BookingStatus, Color> = {
  REQUESTED: "amber",
  APPROVED: "indigo",
  DECLINED: "red",
  IN_PROGRESS: "indigo",
  COMPLETED: "green",
  CANCELLED: "slate",
};

export const REQUEST_STATUS_COLOR: Record<BookingRequestStatus, Color> = {
  OPEN: "amber",
  CLAIMED: "green",
  CANCELLED: "slate",
};

export const APPLICATION_STATUS_COLOR: Record<ApplicationStatus, Color> = {
  APPLIED: "amber",
  UNDER_REVIEW: "indigo",
  INTERVIEW: "indigo",
  VETTED: "green",
  REJECTED: "red",
};

export const REPORT_STATUS_COLOR: Record<ReportStatus, Color> = {
  OPEN: "amber",
  INVESTIGATING: "indigo",
  RESOLVED: "green",
  DISMISSED: "slate",
};

// Where a booking stands, in the words admins and parents use. APPROVED splits
// three ways: the parent still has to accept the waiver and choose how to pay,
// the money hasn't arrived yet (e-Transfer), or it's paid and confirmed.
export function bookingStage(b: {
  status: BookingStatus;
  paidAt: Date | null;
  waiverAcceptedAt: Date | null;
}): { label: string; color: Color } {
  switch (b.status) {
    case "REQUESTED":
      return { label: "Waiting on sitter", color: "amber" };
    case "APPROVED":
      if (b.paidAt) return { label: "Confirmed", color: "indigo" };
      return b.waiverAcceptedAt
        ? { label: "Waiting on payment", color: "amber" }
        : { label: "Waiting on parent", color: "amber" };
    case "IN_PROGRESS":
      return { label: "In progress", color: "indigo" };
    case "COMPLETED":
      return { label: "Completed", color: "green" };
    case "DECLINED":
      return { label: "Declined", color: "red" };
    case "CANCELLED":
      return { label: "Cancelled", color: "slate" };
  }
}
