"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Card, buttonClass } from "@/components/ui";
import type { CampaignState } from "@/lib/campaign";

// Compose → preview → send. Preview shows exactly what a parent receives,
// footer and unsubscribe line included.
export function BroadcastForm({
  action,
  footer,
  consented,
  suppressed,
}: {
  action: (state: CampaignState, fd: FormData) => Promise<CampaignState>;
  footer: string;
  consented: number;
  suppressed: number;
}) {
  const [state, formAction] = useFormState(action, {});
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState(false);
  const input =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <Card>
      <form action={formAction} className="space-y-4">
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
              {`Hi [parent's name],\n\n${body}${footer}`}
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
            Sent to {state.sent} consenting parent
            {state.sent === 1 ? "" : "s"}. {state.suppressed} without consent
            were not emailed.
          </p>
        )}

        <button
          type="submit"
          disabled={consented === 0}
          className={buttonClass()}
        >
          Send to {consented} consenting parent{consented === 1 ? "" : "s"}
        </button>
        <p className="text-xs text-slate-500">
          {suppressed} parent{suppressed === 1 ? "" : "s"} have no newsletter
          consent on file and are skipped. They still receive booking and account
          email.
        </p>
      </form>
    </Card>
  );
}
