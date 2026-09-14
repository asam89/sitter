"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Card, buttonClass } from "@/components/ui";
import { ChildMedicalFields } from "@/components/ChildMedicalFields";
import { ServiceAddressFields } from "@/components/ServiceAddressFields";
import type { BookingFormState } from "@/lib/actions";
import { money } from "@/lib/format";

export type StartOption = { iso: string; label: string; maxHours: number };

export type Quote = {
  endLabel: string;
  listedRate: number;
  base: number;
  rushFee: number;
  lateNightFee: number;
  overnightFee: number;
  platformFee: number;
  total: number;
  isLastMinute: boolean;
};

export type FeeLabels = {
  rushLabel: string;
  lateNightLabel: string;
  overnightLabel: string;
  platformLabel: string;
  extraChildFee: number;
  lastMinuteThresholdHours: number;
};

export function BookingForm({
  slotId,
  action,
  termsVersion,
  termsBody,
  addressOnFile,
  starts,
  quotes,
  minHours,
  fees,
}: {
  slotId: string;
  action: (state: BookingFormState, fd: FormData) => Promise<BookingFormState>;
  termsVersion: string;
  termsBody: string;
  addressOnFile: { line: string } | null;
  starts: StartOption[];
  quotes: Record<string, Quote>;
  minHours: number;
  fees: FeeLabels;
}) {
  const [accepted, setAccepted] = useState(false);
  const [children, setChildren] = useState(1);
  const [startIso, setStartIso] = useState(starts[0]?.iso ?? "");
  const [hours, setHours] = useState(minHours);
  const [state, formAction] = useFormState(action, {});
  const input =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  const start = starts.find((o) => o.iso === startIso) ?? starts[0];
  const maxHours = start?.maxHours ?? minHours;
  const chosenHours = Math.min(Math.max(hours, minHours), maxHours);
  const quote = start ? quotes[`${start.iso}|${chosenHours}`] : undefined;
  const extraChildren = Math.max(0, children - 1) * fees.extraChildFee;
  const hourChoices: number[] = [];
  for (let h = minHours; h <= maxHours; h++) hourChoices.push(h);

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="slotId" value={slotId} />
        <input type="hidden" name="startTime" value={start?.iso ?? ""} />
        <input type="hidden" name="durationHours" value={chosenHours} />

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            Start time
            <select
              value={start?.iso ?? ""}
              onChange={(e) => setStartIso(e.target.value)}
              className={input}
            >
              {starts.map((o) => (
                <option key={o.iso} value={o.iso}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            How long
            <select
              value={chosenHours}
              onChange={(e) => setHours(Number(e.target.value))}
              className={input}
            >
              {hourChoices.map((h) => (
                <option key={h} value={h}>
                  {h} hour{h === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </label>
        </div>

        {quote && start && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold">
              {start.label} – {quote.endLabel} · {chosenHours}h
            </p>
            <dl className="mt-2 space-y-1 text-sm">
              <Row
                label={`Sitter's rate — ${money(quote.listedRate)}/hr × ${chosenHours}h`}
                value={money(quote.base)}
              />
              {quote.rushFee > 0 && (
                <Row
                  label={<span className="text-amber-700">{fees.rushLabel}</span>}
                  value={money(quote.rushFee)}
                />
              )}
              {quote.lateNightFee > 0 && (
                <Row label={fees.lateNightLabel} value={money(quote.lateNightFee)} />
              )}
              {quote.overnightFee > 0 && (
                <Row label={fees.overnightLabel} value={money(quote.overnightFee)} />
              )}
              {extraChildren > 0 && (
                <Row
                  label={`Additional children × ${children - 1}`}
                  value={money(extraChildren)}
                />
              )}
              <Row label={fees.platformLabel} value={money(quote.platformFee)} />
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-semibold">
                <span>Total</span>
                <span>{money(quote.total + extraChildren)}</span>
              </div>
            </dl>
            <p className="mt-2 text-xs text-slate-500">
              Once the sitter accepts, you pay in full to confirm the booking.
            </p>
            {quote.isLastMinute && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                This start is within {fees.lastMinuteThresholdHours}h, so a rush
                fee applies.
              </p>
            )}
          </div>
        )}

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
              value={children}
              onChange={(e) => setChildren(Number(e.target.value) || 1)}
              className={input}
            />
          </label>
        </div>
        <label className="block text-sm font-medium">
          Notes for the sitter (optional)
          <textarea name="notes" rows={2} className={input} />
        </label>
        <p className="text-xs text-slate-500">
          A name is only needed if you choose to give one below.
        </p>

        <ServiceAddressFields onFile={addressOnFile} />

        <ChildMedicalFields count={children} />

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

        {state?.error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {state.error}
          </p>
        )}

        <button type="submit" disabled={!accepted} className={buttonClass()}>
          Confirm booking
        </button>
      </form>
    </Card>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-600">{label}</span>
      <span>{value}</span>
    </div>
  );
}
