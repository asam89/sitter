"use client";

import { useState } from "react";
import { createBooking } from "@/lib/actions";
import { buttonClass } from "@/components/ui";

type Sitter = { userId: string; name: string; hourlyRate: number };

export function RequestForm({
  feePct,
  windowSeconds,
  hasCommunities,
  sitter,
}: {
  feePct: number;
  windowSeconds: number;
  hasCommunities: boolean;
  sitter: Sitter | null;
}) {
  const [requestType, setRequestType] = useState<"NOW" | "SCHEDULED">(
    sitter ? "SCHEDULED" : "NOW",
  );
  const [duration, setDuration] = useState(3);

  const rate = sitter?.hourlyRate ?? null;
  const feePerHour = rate != null ? Math.round((rate * feePct) / 100) : null;
  const perHour = rate != null && feePerHour != null ? rate + feePerHour : null;
  const total = perHour != null ? perHour * duration : null;

  const input =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <form action={createBooking} className="space-y-4">
      {sitter && <input type="hidden" name="sitterId" value={sitter.userId} />}

      {!sitter && (
        <div className="grid grid-cols-2 gap-2">
          {(["NOW", "SCHEDULED"] as const).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setRequestType(t)}
              className={
                "rounded-lg border px-3 py-2 text-sm font-semibold " +
                (requestType === t
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                  : "border-slate-300 text-slate-600")
              }
            >
              {t === "NOW" ? "Request now" : "Schedule ahead"}
            </button>
          ))}
        </div>
      )}
      <input type="hidden" name="requestType" value={requestType} />

      {requestType === "SCHEDULED" && (
        <label className="block text-sm font-medium">
          Date &amp; time
          <input
            type="datetime-local"
            name="dateTime"
            required
            className={input}
          />
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">
          Children (ages)
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
            min={1}
            max={10}
            defaultValue={1}
            className={input}
          />
        </label>
      </div>

      <label className="block text-sm font-medium">
        Duration (hours): {duration}
        <input
          type="range"
          name="durationHours"
          min={1}
          max={12}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="mt-1 w-full"
        />
      </label>

      {!sitter && hasCommunities && (
        <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <input type="checkbox" name="communityOnly" />
          <span>
            Only sitters endorsed within my community (no fallback to
            platform-verified-only)
          </span>
        </label>
      )}

      <div className="rounded-lg bg-indigo-50 p-4 text-sm">
        {rate != null ? (
          <>
            <div className="flex justify-between">
              <span>Sitter rate</span>
              <span>${rate}/hr</span>
            </div>
            <div className="flex justify-between">
              <span>Platform fee ({feePct}%)</span>
              <span>${feePerHour}/hr</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-indigo-200 pt-1 font-semibold">
              <span>Total ({duration}h)</span>
              <span>
                ${perHour}/hr = ${total}
              </span>
            </div>
          </>
        ) : (
          <p>
            You&apos;ll pay the sitter&apos;s hourly rate plus a transparent{" "}
            <strong>{feePct}% platform fee</strong>, shown as a single line item
            before you pay. On-demand requests dispatch to community-endorsed
            sitters first, expanding to platform-verified sitters after{" "}
            {Math.round(windowSeconds / 60)} min if none respond.
          </p>
        )}
      </div>

      <button type="submit" className={buttonClass()}>
        {sitter
          ? "Confirm booking"
          : requestType === "NOW"
            ? "Request now"
            : "Schedule request"}
      </button>
      <p className="text-xs text-slate-500">
        CircleCare is a marketplace. Community endorsement is a trust signal, not
        a guarantee of conduct.
      </p>
    </form>
  );
}
