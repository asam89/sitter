"use client";

import { useState } from "react";
import { submitReport } from "@/lib/actions";
import { buttonClass } from "@/components/ui";

export function ReportForm({
  targetType,
  targetId,
  label,
}: {
  targetType: "USER" | "BOOKING" | "MESSAGE_THREAD";
  targetId: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  async function action(fd: FormData) {
    await submitReport(fd);
    setDone(true);
    setOpen(false);
  }

  if (done)
    return (
      <p className="text-sm text-emerald-700">
        Report submitted. Our safety team will review it.
      </p>
    );

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-red-600 hover:underline"
      >
        {label}
      </button>
    );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <textarea
        name="reason"
        required
        minLength={3}
        placeholder="Describe the issue"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        rows={3}
      />
      <div className="flex gap-2">
        <button type="submit" className={buttonClass()}>
          Submit report
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={buttonClass("secondary")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
