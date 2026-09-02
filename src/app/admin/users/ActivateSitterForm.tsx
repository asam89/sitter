"use client";

import { useFormState } from "react-dom";
import { buttonClass } from "@/components/ui";
import { activateSitter, type UserAdminState } from "@/lib/user-admin-actions";

// Inline on a sitter account that has no sitter profile: sets the rate the
// profile can't exist without, and optionally lists them in the same step.
export function ActivateSitterForm({
  userId,
  city,
  rate,
  isListed,
  hasProfile,
}: {
  userId: string;
  city: string | null;
  rate: number | null;
  isListed: boolean;
  hasProfile: boolean;
}) {
  const [state, formAction] = useFormState<UserAdminState, FormData>(
    activateSitter,
    {},
  );
  const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <form
      action={formAction}
      className="w-full space-y-3 rounded-lg bg-amber-50 px-3 py-3"
    >
      <input type="hidden" name="userId" value={userId} />
      <p className="text-sm font-medium text-amber-900">
        {hasProfile
          ? "Sitter details"
          : "Not an active sitter yet — no sitter profile"}
      </p>
      {!hasProfile && (
        <p className="text-xs text-amber-900">
          They can&apos;t publish availability or be booked until you activate
          them. Only do this for someone you have already vetted.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm font-medium">
          Hourly rate (CAD)
          <input
            type="number"
            name="listedPayRate"
            min={1}
            max={500}
            defaultValue={rate ?? 20}
            required
            className={input}
          />
        </label>
        <label className="block text-sm font-medium">
          City (optional)
          <input
            name="city"
            maxLength={120}
            defaultValue={city ?? ""}
            className={input}
          />
        </label>
        <label className="flex items-end gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="list"
            defaultChecked={isListed}
            className="mb-3 h-4 w-4"
          />
          <span className="mb-2">List them (bookable)</span>
        </label>
      </div>
      {state.error && (
        <p role="alert" className="text-xs text-red-700">
          {state.error}
        </p>
      )}
      {state.ok && <p className="text-xs text-emerald-700">{state.ok}</p>}
      <button type="submit" className={buttonClass("secondary")}>
        {hasProfile ? "Save sitter details" : "Activate as a sitter"}
      </button>
    </form>
  );
}
