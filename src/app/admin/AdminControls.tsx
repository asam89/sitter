"use client";

import { useTransition } from "react";
import {
  decidePartner,
  decideDocument,
  updateReportStatus,
  setUserSuspended,
} from "@/lib/actions";
import { buttonClass } from "@/components/ui";

export function DecidePartner({ partnerId }: { partnerId: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <button
        disabled={pending}
        className={buttonClass()}
        onClick={() => start(() => void decidePartner(partnerId, true))}
      >
        Approve
      </button>
      <button
        disabled={pending}
        className={buttonClass("secondary")}
        onClick={() => start(() => void decidePartner(partnerId, false))}
      >
        Reject
      </button>
    </div>
  );
}

export function DecideDocument({ documentId }: { documentId: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <button
        disabled={pending}
        className={buttonClass()}
        onClick={() => start(() => void decideDocument(documentId, true))}
      >
        Approve
      </button>
      <button
        disabled={pending}
        className={buttonClass("secondary")}
        onClick={() => start(() => void decideDocument(documentId, false))}
      >
        Reject
      </button>
    </div>
  );
}

export function ReportStatusControl({
  reportId,
  targetType,
  targetId,
}: {
  reportId: string;
  targetType: string;
  targetId: string;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      {(["INVESTIGATING", "RESOLVED", "DISMISSED"] as const).map((st) => (
        <button
          key={st}
          disabled={pending}
          className={buttonClass("secondary")}
          onClick={() => start(() => void updateReportStatus(reportId, st))}
        >
          {st}
        </button>
      ))}
      {targetType === "USER" && (
        <button
          disabled={pending}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
          onClick={() => start(() => void setUserSuspended(targetId, true))}
        >
          Soft-suspend user
        </button>
      )}
    </div>
  );
}
