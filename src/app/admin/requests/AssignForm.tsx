"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui";

// Admin fallback for an open request no sitter has picked up: assign it
// directly. Same server path as a sitter claim, so the race guard still applies.
export function AssignForm({
  requestId,
  sitters,
  action,
}: {
  requestId: string;
  sitters: { id: string; label: string }[];
  action: (fd: FormData) => Promise<void>;
}) {
  const [sitterProfileId, setSitterProfileId] = useState("");

  if (sitters.length === 0) {
    return (
      <p className="text-xs text-slate-500">No listed sitters to assign.</p>
    );
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <select
        name="sitterProfileId"
        value={sitterProfileId}
        onChange={(e) => setSitterProfileId(e.target.value)}
        className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
      >
        <option value="">Assign a sitter…</option>
        {sitters.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={!sitterProfileId}
        className={buttonClass("secondary")}
      >
        Assign
      </button>
    </form>
  );
}
