import type { ApplicationStatus } from "@prisma/client";

type Color = "slate" | "green" | "amber" | "red" | "indigo";

// Where a sitter account sits in the pipeline, from sign-up to bookable.
export function sitterStage(u: {
  suspended: boolean;
  application: { status: ApplicationStatus } | null;
  sitterProfile: { isListed: boolean } | null;
}): { label: string; color: Color } {
  if (u.suspended) return { label: "Suspended", color: "red" };
  if (u.sitterProfile?.isListed) return { label: "Listed", color: "green" };
  if (u.sitterProfile) return { label: "Vetted, unlisted", color: "indigo" };
  switch (u.application?.status) {
    case undefined:
      return { label: "No application", color: "slate" };
    case "REJECTED":
      return { label: "Rejected", color: "red" };
    case "INTERVIEW":
      return { label: "Interview", color: "amber" };
    default:
      return { label: "Applied", color: "amber" };
  }
}
