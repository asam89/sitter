"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import type { CampaignAudienceKind } from "@prisma/client";
import { Card, buttonClass } from "@/components/ui";
import {
  MAX_SMS_BODY,
  SMS_OPT_OUT_LINE,
  type SmsCampaignState,
} from "@/lib/sms-campaign";

// Compose → pick audience → see the exact text (opt-out line included) → send.
export function SmsBroadcastForm({
  action,
  newsletterCount,
  registeredCount,
  reachableCount,
  impliedMonths,
}: {
  action: (
    state: SmsCampaignState,
    fd: FormData,
  ) => Promise<SmsCampaignState>;
  newsletterCount: number;
  registeredCount: number;
  reachableCount: number;
  impliedMonths: number;
}) {
  const [state, formAction] = useFormState(action, {});
  const [audience, setAudience] = useState<CampaignAudienceKind>("NEWSLETTER");
  const [body, setBody] = useState("");
  const count = audience === "NEWSLETTER" ? newsletterCount : registeredCount;
  const full = body.trim() ? `${body.trim()} ${SMS_OPT_OUT_LINE}` : "";
  const remaining = MAX_SMS_BODY - body.trim().length;

  return (
    <Card>
      <h2 className="font-semibold">Text parents and sitters</h2>
      <p className="mt-1 text-sm text-slate-600">
        A broadcast text is commercial messaging under CASL just like email, so
        the same consent rules apply and every message carries an opt-out.
        Replying STOP stops texts only — booking codes, reminders and email are
        unaffected.
      </p>
      <form action={formAction} className="mt-4 space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Who gets this</legend>
          <label className="flex gap-2 text-sm">
            <input
              type="radio"
              name="audience"
              value="NEWSLETTER"
              checked={audience === "NEWSLETTER"}
              onChange={() => setAudience("NEWSLETTER")}
              className="mt-1"
            />
            <span>
              <strong>Express consent</strong> — {newsletterCount} parent
              {newsletterCount === 1 ? "" : "s"} and sitter
              {newsletterCount === 1 ? "" : "s"} with a phone number who ticked
              the consent box.
            </span>
          </label>
          <label className="flex gap-2 text-sm">
            <input
              type="radio"
              name="audience"
              value="REGISTERED"
              checked={audience === "REGISTERED"}
              onChange={() => setAudience("REGISTERED")}
              className="mt-1"
            />
            <span>
              <strong>Everyone registered</strong> — {registeredCount} who
              signed up or had a booking in the last {impliedMonths} months
              (CASL implied consent). Use for a service announcement, not
              ongoing marketing.
            </span>
          </label>
        </fieldset>

        <label className="block text-sm font-medium">
          Message
          <textarea
            name="body"
            required
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <p
          className={`text-xs ${remaining < 0 ? "text-red-700" : "text-slate-500"}`}
        >
          {remaining} characters left. The opt-out line is added for you.
        </p>

        {full && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
            <p className="font-semibold">They receive:</p>
            <p className="mt-1 text-slate-700">{full}</p>
          </div>
        )}

        {state?.error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {state.error}
          </p>
        )}
        {state?.sent !== undefined && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Texted {state.sent} recipient{state.sent === 1 ? "" : "s"}.{" "}
            {state.skipped} with a phone number fell outside this audience.
          </p>
        )}

        <button
          type="submit"
          disabled={count === 0 || remaining < 0}
          className={buttonClass()}
        >
          Text {count} recipient{count === 1 ? "" : "s"}
        </button>
        <p className="text-xs text-slate-500">
          {reachableCount - count} of the {reachableCount} accounts with a phone
          number are skipped. Anyone who replied STOP is never included.
        </p>
      </form>
    </Card>
  );
}
