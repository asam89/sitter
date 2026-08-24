"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import type { CampaignAudienceKind } from "@prisma/client";
import { Card, buttonClass } from "@/components/ui";
import type { CampaignState } from "@/lib/campaign";

// Compose → pick audience → preview → send. Preview shows exactly what a parent
// receives, footer and unsubscribe line included.
export function BroadcastForm({
  action,
  footerFor,
  newsletterCount,
  registeredCount,
  parentCount,
  impliedMonths,
}: {
  action: (state: CampaignState, fd: FormData) => Promise<CampaignState>;
  footerFor: Record<CampaignAudienceKind, string>;
  newsletterCount: number;
  registeredCount: number;
  parentCount: number;
  impliedMonths: number;
}) {
  const [state, formAction] = useFormState(action, {});
  const [audience, setAudience] = useState<CampaignAudienceKind>("NEWSLETTER");
  const count = audience === "NEWSLETTER" ? newsletterCount : registeredCount;
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState(false);
  const input =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <Card>
      <form action={formAction} className="space-y-4">
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
              <strong>Newsletter subscribers</strong> — {newsletterCount} parent
              {newsletterCount === 1 ? "" : "s"} who ticked the box (express
              consent).
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
              <strong>All registered parents</strong> — {registeredCount} parent
              {registeredCount === 1 ? "" : "s"} who signed up or booked in the
              last {impliedMonths} months (CASL implied consent). Use this for a
              reminder about the service, not for ongoing marketing.
            </span>
          </label>
        </fieldset>

        <label className="block text-sm font-medium">
          Subject
          <input
            name="subject"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={input}
          />
        </label>
        <label className="block text-sm font-medium">
          Message
          <textarea
            name="body"
            required
            rows={10}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={input}
          />
        </label>

        <button
          type="button"
          onClick={() => setPreview((v) => !v)}
          className="text-sm font-medium text-brand-teal"
        >
          {preview ? "Hide preview" : "Preview what parents receive"}
        </button>
        {preview && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
            <p className="font-semibold">
              Subject: {subject || "(no subject)"}
            </p>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-slate-700">
              {`Hi [parent's name],\n\n${body}${footerFor[audience]}`}
            </pre>
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
            Sent to {state.sent} parent{state.sent === 1 ? "" : "s"}.{" "}
            {state.suppressed} outside this audience were not emailed.
          </p>
        )}

        <button type="submit" disabled={count === 0} className={buttonClass()}>
          Send to {count} parent{count === 1 ? "" : "s"}
        </button>
        <p className="text-xs text-slate-500">
          {parentCount - count} of your {parentCount} active parent
          {parentCount === 1 ? "" : "s"} fall outside this audience and are
          skipped. Anyone who unsubscribed is never included, and everyone keeps
          receiving booking and account email either way.
        </p>
      </form>
    </Card>
  );
}
