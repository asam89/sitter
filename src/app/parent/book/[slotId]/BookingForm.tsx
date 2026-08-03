"use client";

import { useState } from "react";
import { Card, buttonClass } from "@/components/ui";

export function BookingForm({
  slotId,
  action,
  termsVersion,
  termsBody,
}: {
  slotId: string;
  action: (fd: FormData) => Promise<void>;
  termsVersion: string;
  termsBody: string;
}) {
  const [accepted, setAccepted] = useState(false);
  const input =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <Card>
      <form action={action} className="space-y-4">
        <input type="hidden" name="slotId" value={slotId} />

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            Children&apos;s age range
            <input
              name="childrenAgeRange"
              required
              placeholder="e.g. 2-5"
              className={input}
            />
          </label>
          <label className="block text-sm font-medium">
            Number of children
            <input
              type="number"
              name="numberOfChildren"
              required
              min={1}
              max={10}
              defaultValue={1}
              className={input}
            />
          </label>
        </div>
        <label className="block text-sm font-medium">
          Notes for the sitter (optional)
          <textarea name="notes" rows={2} className={input} />
        </label>
        <p className="text-xs text-slate-500">
          We only collect an age range and count — never a child&apos;s name or
          photo.
        </p>

        {/* Liability waiver click-through — version + timestamp recorded. */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-700">
            Liability waiver &amp; terms ({termsVersion})
          </p>
          <div className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs text-slate-600">
            {termsBody}
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="waiverAccepted"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-1"
          />
          <span>
            I have read and accept the liability waiver and terms of service
            (version {termsVersion}).
          </span>
        </label>

        <button
          type="submit"
          disabled={!accepted}
          className={buttonClass()}
        >
          Confirm booking
        </button>
      </form>
    </Card>
  );
}
