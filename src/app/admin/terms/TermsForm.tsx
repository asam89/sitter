"use client";

import { useFormState } from "react-dom";
import { Card, buttonClass } from "@/components/ui";
import type { TermsFormState } from "@/lib/terms-actions";

export function TermsForm({
  action,
  suggestedVersion,
  currentBody,
}: {
  action: (state: TermsFormState, fd: FormData) => Promise<TermsFormState>;
  suggestedVersion: string;
  currentBody: string;
}) {
  const [state, formAction] = useFormState(action, {});
  const input =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <label className="block text-sm font-medium sm:max-w-xs">
          New version label
          <input
            name="version"
            required
            maxLength={40}
            defaultValue={suggestedVersion}
            className={input}
          />
        </label>
        <label className="block text-sm font-medium">
          Waiver &amp; terms text
          <textarea
            name="body"
            required
            rows={22}
            defaultValue={currentBody}
            className={`${input} font-mono`}
          />
        </label>

        {state?.error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {state.error}
          </p>
        )}
        {state?.ok && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
            {state.ok}
          </p>
        )}

        <button type="submit" className={buttonClass()}>
          Publish as new version
        </button>
      </form>
    </Card>
  );
}
