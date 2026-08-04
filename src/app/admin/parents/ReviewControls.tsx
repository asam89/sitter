"use client";

import { useState, useTransition } from "react";
import { buttonClass } from "@/components/ui";
import { approveIdDocument, rejectIdDocument } from "@/lib/kyc-actions";

export function ReviewControls({
  documentId,
  suggestedName,
}: {
  documentId: string;
  suggestedName: string;
}) {
  const [verifiedName, setVerifiedName] = useState(suggestedName);
  const [pending, start] = useTransition();

  return (
    <div className="mt-3 space-y-2">
      <label className="block text-sm font-medium">
        Verified name (as shown on ID)
        <input
          value={verifiedName}
          onChange={(e) => setVerifiedName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <div className="flex gap-2">
        <button
          className={buttonClass()}
          disabled={pending}
          onClick={() =>
            start(async () => {
              await approveIdDocument(documentId, verifiedName);
            })
          }
        >
          {pending ? "…" : "Approve identity"}
        </button>
        <button
          className={buttonClass("secondary")}
          disabled={pending}
          onClick={() =>
            start(async () => {
              if (!window.confirm("Reject this ID document?")) return;
              await rejectIdDocument(documentId);
            })
          }
        >
          Reject
        </button>
      </div>
    </div>
  );
}
