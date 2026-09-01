"use client";

import { useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { buttonClass } from "@/components/ui";
import { ServiceAddressFields } from "@/components/ServiceAddressFields";
import type { PaymentFormState } from "@/lib/actions";
import { CardPaymentFields } from "./CardPaymentFields";

function SubmitButton({
  method,
  disabled,
  amount,
}: {
  method: "CARD" | "ETRANSFER";
  disabled: boolean;
  amount: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={buttonClass()}
    >
      {method === "CARD"
        ? `Pay ${amount} by card`
        : `I'll send ${amount} by e-Transfer`}
    </button>
  );
}

// The parent picks how to settle an approved booking. Card is charged here;
// e-Transfer only records the intent — Ri'aya marks it paid once the money
// arrives, so the booking stays unconfirmed until then.
export function PaymentChoice({
  action,
  startCard,
  finalizeCard,
  publishableKey,
  bookingId,
  amount,
  etransferEmail,
  bookingRef,
  termsVersion,
  termsBody,
  waiverOutstanding,
  addressOnFile,
}: {
  action: (state: PaymentFormState, fd: FormData) => Promise<PaymentFormState>;
  startCard: (fd: FormData) => Promise<{ error?: string; clientSecret?: string }>;
  finalizeCard: (bookingId: string) => Promise<{ error?: string }>;
  publishableKey: string | null;
  bookingId: string;
  amount: string;
  etransferEmail: string | null;
  bookingRef: string;
  termsVersion: string;
  termsBody: string;
  waiverOutstanding: boolean;
  addressOnFile: { line: string } | null;
}) {
  const [state, formAction] = useFormState(action, {});
  const [method, setMethod] = useState<"CARD" | "ETRANSFER">("CARD");
  const [accepted, setAccepted] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Real card payments: the waiver/address are validated and a PaymentIntent is
  // opened first, then Stripe's card fields appear for that exact amount.
  const cardEntry = Boolean(publishableKey);
  async function beginCardPayment() {
    const form = formRef.current;
    if (!form) return;
    setStarting(true);
    setCardError(null);
    const started = await startCard(new FormData(form));
    setStarting(false);
    if (started.error || !started.clientSecret) {
      setCardError(started.error ?? "Could not start the payment.");
      return;
    }
    setClientSecret(started.clientSecret);
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="method" value={method} />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          How would you like to pay?
        </legend>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            checked={method === "CARD"}
            onChange={() => setMethod("CARD")}
            className="mt-1"
          />
          <span>
            <strong>Credit card</strong> — paid now, confirms the booking
            immediately.
          </span>
        </label>
        {etransferEmail && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              checked={method === "ETRANSFER"}
              onChange={() => setMethod("ETRANSFER")}
              className="mt-1"
            />
            <span>
              <strong>Interac e-Transfer</strong> — send {amount} to{" "}
              <span className="font-mono">{etransferEmail}</span> with{" "}
              <span className="font-mono">{bookingRef}</span> in the message.
              Our team confirms the booking once it lands.
            </span>
          </label>
        )}
      </fieldset>

      {/* Only when it is still missing — an app-created booking already took it. */}
      {!addressOnFile && <ServiceAddressFields onFile={null} />}

      {waiverOutstanding && (
        <div className="space-y-2">
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

      {cardError && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {cardError}
        </p>
      )}

      {cardEntry && method === "CARD" ? (
        clientSecret && publishableKey ? (
          <CardPaymentFields
            publishableKey={publishableKey}
            clientSecret={clientSecret}
            bookingId={bookingId}
            amount={amount}
            onPaid={finalizeCard}
          />
        ) : (
          <button
            type="button"
            onClick={beginCardPayment}
            disabled={(waiverOutstanding && !accepted) || starting}
            className={buttonClass()}
          >
            {starting ? "Preparing…" : `Pay ${amount} by card`}
          </button>
        )
      ) : (
        <SubmitButton
          method={method}
          amount={amount}
          disabled={waiverOutstanding && !accepted}
        />
      )}
    </form>
  );
}
