"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Card, buttonClass } from "@/components/ui";
import { ChildMedicalFields } from "@/components/ChildMedicalFields";
import { ServiceAddressFields } from "@/components/ServiceAddressFields";
import type { RequestFormState } from "@/lib/actions";

export function RequestForm({
  action,
  termsVersion,
  termsBody,
  minStartTime,
  minHours,
  addressOnFile,
}: {
  action: (state: RequestFormState, fd: FormData) => Promise<RequestFormState>;
  termsVersion: string;
  termsBody: string;
  minStartTime: string;
  minHours: number;
  addressOnFile: { line: string } | null;
}) {
  const [accepted, setAccepted] = useState(false);
  const [children, setChildren] = useState(1);
  const [state, formAction] = useFormState(action, {});
  const input =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Date &amp; start time
            <input
              type="datetime-local"
              name="startTime"
              required
              min={minStartTime}
              className={input}
            />
          </label>
          <label className="block text-sm font-medium">
            How many hours?
            <input
              type="number"
              name="durationHours"
              required
              min={minHours}
              max={12}
              defaultValue={Math.max(minHours, 3)}
              className={input}
            />
          </label>
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
              value={children}
              onChange={(e) => setChildren(Number(e.target.value) || 1)}
              className={input}
            />
          </label>
        </div>
        <label className="block text-sm font-medium">
          Notes for sitters (optional)
          <textarea name="notes" rows={2} className={input} />
        </label>
        <p className="text-xs text-slate-500">
          Sitters see your city, not your address; the address is released only
          once a sitter picks up your request. Health details below stay
          encrypted until then.
        </p>

        <ServiceAddressFields onFile={addressOnFile} />

        <ChildMedicalFields count={children} />

        {/* Same click-through waiver as a direct booking — a claimed request
            becomes a booking without asking the parent again. */}
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

        {state?.error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {state.error}
          </p>
        )}

        <button type="submit" disabled={!accepted} className={buttonClass()}>
          Post request to sitters
        </button>
      </form>
    </Card>
  );
}
