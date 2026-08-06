"use client";

import { useState } from "react";
import {
  moveApplicationToInterview,
  moveApplicationUnderReview,
  rejectApplication,
  setListed,
  setUserSuspended,
  updateReportStatus,
  vetApplication,
} from "@/lib/actions";
import { setSitterShowcased } from "@/lib/sitter-profile-actions";
import { ActionButton } from "@/components/ActionButton";
import { buttonClass } from "@/components/ui";

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

// The prominent, fast listing toggle used across the Admin dashboard.
export function ListingToggle({
  sitterProfileId,
  isListed,
}: {
  sitterProfileId: string;
  isListed: boolean;
}) {
  return (
    <ActionButton
      action={setListed.bind(null, sitterProfileId, !isListed)}
      variant={isListed ? "secondary" : "primary"}
    >
      {isListed ? "Un-list" : "List"}
    </ActionButton>
  );
}

// Admin approval to feature a sitter on the public "Meet our team" page. Only
// meaningful once the sitter has opted in; the button hints when they haven't.
export function ShowcaseToggle({
  sitterProfileId,
  showcased,
  optedIn,
}: {
  sitterProfileId: string;
  showcased: boolean;
  optedIn: boolean;
}) {
  if (!optedIn && !showcased) {
    return (
      <span className="text-xs text-slate-400">Not opted in</span>
    );
  }
  return (
    <ActionButton
      action={setSitterShowcased.bind(null, sitterProfileId, !showcased)}
      variant={showcased ? "secondary" : "primary"}
    >
      {showcased ? "Remove from team page" : "Feature on team page"}
    </ActionButton>
  );
}

export function SuspendButton({
  userId,
  suspended,
}: {
  userId: string;
  suspended: boolean;
}) {
  return (
    <ActionButton
      action={setUserSuspended.bind(null, userId, !suspended)}
      variant="secondary"
      confirm={suspended ? undefined : "Suspend this user pending review?"}
    >
      {suspended ? "Unsuspend" : "Suspend"}
    </ActionButton>
  );
}

export function ReportControls({ reportId }: { reportId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(["INVESTIGATING", "RESOLVED", "DISMISSED"] as const).map((st) => (
        <ActionButton
          key={st}
          action={updateReportStatus.bind(null, reportId, st)}
          variant="secondary"
        >
          {st.charAt(0) + st.slice(1).toLowerCase()}
        </ActionButton>
      ))}
    </div>
  );
}

export function ApplicationReview({
  applicationId,
  status,
  targetPayRate,
  interviewScheduledAt,
  interviewNotes,
}: {
  applicationId: string;
  status: "APPLIED" | "UNDER_REVIEW" | "INTERVIEW" | "VETTED" | "REJECTED";
  targetPayRate: number;
  interviewScheduledAt?: string | null;
  interviewNotes?: string | null;
}) {
  const [mode, setMode] = useState<"none" | "vet" | "reject" | "interview">(
    "none",
  );

  if (mode === "interview")
    return (
      <form action={moveApplicationToInterview} className="space-y-2">
        <input type="hidden" name="applicationId" value={applicationId} />
        <label className="block text-sm font-medium">
          Interview time (optional — shown to the applicant)
          <input
            type="datetime-local"
            name="interviewScheduledAt"
            defaultValue={interviewScheduledAt ?? ""}
            className={inputCls}
          />
        </label>
        <textarea
          name="interviewNotes"
          placeholder="Internal interview notes (optional)"
          rows={2}
          defaultValue={interviewNotes ?? ""}
          className={inputCls}
        />
        <div className="flex gap-2">
          <button type="submit" className={buttonClass()}>
            Move to interview
          </button>
          <button
            type="button"
            onClick={() => setMode("none")}
            className={buttonClass("secondary")}
          >
            Cancel
          </button>
        </div>
      </form>
    );

  if (mode === "vet")
    return (
      <form action={vetApplication} className="space-y-2">
        <input type="hidden" name="applicationId" value={applicationId} />
        <label className="block text-sm font-medium">
          Listed pay rate (CAD/hr) — sitter proposed {targetPayRate}
          <input
            type="number"
            name="listedPayRate"
            required
            min={1}
            max={500}
            defaultValue={targetPayRate}
            className={inputCls}
          />
        </label>
        <input
          name="adminNotes"
          placeholder="Notes (optional)"
          className={inputCls}
        />
        <div className="flex gap-2">
          <button type="submit" className={buttonClass()}>
            Confirm vet &amp; set rate
          </button>
          <button
            type="button"
            onClick={() => setMode("none")}
            className={buttonClass("secondary")}
          >
            Cancel
          </button>
        </div>
      </form>
    );

  if (mode === "reject")
    return (
      <form action={rejectApplication} className="space-y-2">
        <input type="hidden" name="applicationId" value={applicationId} />
        <textarea
          name="adminNotes"
          placeholder="Reason (shown to applicant)"
          rows={2}
          className={inputCls}
        />
        <div className="flex gap-2">
          <button type="submit" className={buttonClass()}>
            Confirm rejection
          </button>
          <button
            type="button"
            onClick={() => setMode("none")}
            className={buttonClass("secondary")}
          >
            Cancel
          </button>
        </div>
      </form>
    );

  return (
    <div className="flex flex-wrap gap-2">
      {status === "APPLIED" && (
        <ActionButton
          action={moveApplicationUnderReview.bind(null, applicationId)}
          variant="secondary"
        >
          Start review
        </ActionButton>
      )}
      {status !== "INTERVIEW" && (
        <button
          onClick={() => setMode("interview")}
          className={buttonClass("secondary")}
        >
          Schedule interview
        </button>
      )}
      {status === "INTERVIEW" && (
        <button
          onClick={() => setMode("interview")}
          className={buttonClass("secondary")}
        >
          Update interview
        </button>
      )}
      <button onClick={() => setMode("vet")} className={buttonClass()}>
        Vet &amp; list rate
      </button>
      <button
        onClick={() => setMode("reject")}
        className={buttonClass("secondary")}
      >
        Reject
      </button>
    </div>
  );
}
