"use client";

import { useFormState, useFormStatus } from "react-dom";
import { subscribeToNewsletter } from "@/lib/newsletter-actions";
import { NEWSLETTER_CONSENT_TEXT } from "@/lib/consent";
import { buttonClass } from "@/components/ui";
import type { SubscribeState } from "@/lib/newsletter";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass()}>
      {pending ? "Sending…" : "Sign me up"}
    </button>
  );
}

// Public newsletter sign-up. Double opt-in, so the success copy talks about the
// confirmation email rather than claiming the address is subscribed.
export function NewsletterSignup({
  source,
  compact = false,
}: {
  source: string;
  compact?: boolean;
}) {
  const [state, action] = useFormState<SubscribeState, FormData>(
    subscribeToNewsletter,
    {},
  );

  if (state.pending) {
    return (
      <p className="text-sm text-brand-teal">
        Check your inbox — we sent a confirmation link. You&apos;ll start
        receiving Ri&apos;aya updates once you click it.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="source" value={source} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`newsletter-email-${source}`}>
          Email address
        </label>
        <input
          id={`newsletter-email-${source}`}
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <SubmitButton />
      </div>
      {!compact && (
        <p className="text-xs text-slate-500">{NEWSLETTER_CONSENT_TEXT}</p>
      )}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
