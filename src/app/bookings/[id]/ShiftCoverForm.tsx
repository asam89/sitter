"use client";

import { useFormState } from "react-dom";
import { buttonClass } from "@/components/ui";
import type { ShiftCoverState } from "@/lib/shift-cover-actions";

export function ShiftCoverForm({
  action,
  bookingId,
  sitterName,
  poolSize,
  textable,
}: {
  action: (state: ShiftCoverState, fd: FormData) => Promise<ShiftCoverState>;
  bookingId: string;
  sitterName: string;
  poolSize: number;
  textable: number;
}) {
  const [state, formAction] = useFormState(action, {});
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <p className="text-sm text-slate-600">
        If {sitterName} can&apos;t make this shift, offer it to the other{" "}
        {poolSize} vetted sitter{poolSize === 1 ? "" : "s"}. The first to take
        it becomes the sitter on this booking; the price, waiver and payment
        stay the same. They see the time, the city and what they&apos;d earn,
        not the address.
      </p>
      <label className="block text-sm">
        <span className="font-medium">Note to sitters (optional)</span>
        <input
          name="note"
          maxLength={500}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="e.g. Two quiet kids, bedtime at 8"
        />
      </label>
      <div className="space-y-1 text-sm">
        <label className="flex gap-2">
          <input type="checkbox" name="notifySms" defaultChecked />
          <span>
            Text them ({textable} of {poolSize} have a number and haven&apos;t
            replied STOP)
          </span>
        </label>
        <label className="flex gap-2">
          <input type="checkbox" name="notifyEmail" defaultChecked />
          <span>Email them</span>
        </label>
      </div>
      {state?.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {state.error}
        </p>
      )}
      {state?.offered !== undefined && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Offered to {state.offered} sitter{state.offered === 1 ? "" : "s"}:
          texted {state.texted ?? 0}, emailed {state.emailed ?? 0}.
        </p>
      )}
      <button
        type="submit"
        className={buttonClass("secondary")}
        disabled={poolSize === 0}
        onClick={(e) => {
          if (
            !window.confirm(
              `Offer this shift to ${poolSize} sitter${poolSize === 1 ? "" : "s"}? They'll be notified right away.`,
            )
          )
            e.preventDefault();
        }}
      >
        Offer to the sitter pool
      </button>
    </form>
  );
}
