"use client";

import { useFormState, useFormStatus } from "react-dom";
import { buttonClass } from "@/components/ui";
import type { NewsletterNowState } from "@/lib/campaign-actions";

function SubmitButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || count === 0}
      className={buttonClass("secondary")}
      onClick={(e) => {
        if (!confirm(`Email this availability update to ${count} parents now?`)) {
          e.preventDefault();
        }
      }}
    >
      {pending ? "Sending…" : `Send it now to ${count} parents`}
    </button>
  );
}

export function NewsletterSendNow({
  action,
  count,
}: {
  action: () => Promise<NewsletterNowState>;
  count: number;
}) {
  const [state, formAction] = useFormState<NewsletterNowState>(action, {});
  return (
    <form action={formAction} className="space-y-2">
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.sent !== undefined && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Sent to {state.sent} parent{state.sent === 1 ? "" : "s"}.
        </p>
      )}
      <SubmitButton count={count} />
    </form>
  );
}
