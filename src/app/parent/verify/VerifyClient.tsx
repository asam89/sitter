"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, buttonClass } from "@/components/ui";
import type { ActionResult } from "@/lib/kyc-actions";
import {
  sendEmailCode,
  verifyEmail,
  sendPhoneCode,
  verifyPhone,
  saveServiceAddress,
  uploadIdDocument,
} from "@/lib/kyc-actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

function WhyBox({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-brand-cream px-3 py-2 text-xs text-brand-teal">
      <span className="font-semibold">Why we ask: </span>
      {children}
    </p>
  );
}

function StepShell({
  n,
  title,
  done,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className={done ? "opacity-80" : undefined}>
      <div className="mb-3 flex items-center gap-2">
        <span
          className={
            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white " +
            (done ? "bg-emerald-500" : "bg-brand-teal")
          }
        >
          {done ? "✓" : n}
        </span>
        <h2 className="font-semibold text-brand-ink">{title}</h2>
      </div>
      {children}
    </Card>
  );
}

function DevCode({ code }: { code?: string }) {
  if (!code) return null;
  return (
    <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
      Dev mode — no SMS/email provider configured. Your code is{" "}
      <span className="font-mono font-bold">{code}</span>.
    </p>
  );
}

// --- Contact: email ---
function EmailStep({ verified, email }: { verified: boolean; email: string }) {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (verified) {
    return (
      <StepShell n={1} title="Verify your email" done>
        <p className="text-sm text-emerald-700">Email verified — {email}.</p>
      </StepShell>
    );
  }

  return (
    <StepShell n={1} title="Verify your email" done={false}>
      <WhyBox>
        A confirmed email is how we send booking receipts and reach you about a
        booking in progress.
      </WhyBox>
      {!sent ? (
        <button
          className={buttonClass() + " mt-3"}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await sendEmailCode();
              setSent(true);
              setDevCode(r.devCode);
            })
          }
        >
          {pending ? "Sending…" : `Send code to ${email}`}
        </button>
      ) : (
        <form
          className="mt-3 space-y-2"
          action={(fd) =>
            start(async () => {
              setError(null);
              const r: ActionResult = await verifyEmail(fd);
              if (!r.ok) setError(r.error ?? "Could not verify.");
              else router.refresh();
            })
          }
        >
          <input
            name="code"
            inputMode="numeric"
            placeholder="6-digit code"
            className={inputClass}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className={buttonClass()} disabled={pending}>
            {pending ? "Verifying…" : "Verify email"}
          </button>
        </form>
      )}
      <DevCode code={devCode} />
    </StepShell>
  );
}

// --- Contact: phone ---
function PhoneStep({ verified, phone }: { verified: boolean; phone: string }) {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (verified) {
    return (
      <StepShell n={2} title="Verify your phone" done>
        <p className="text-sm text-emerald-700">Phone verified — {phone}.</p>
      </StepShell>
    );
  }

  return (
    <StepShell n={2} title="Verify your phone" done={false}>
      <WhyBox>
        A reachable, verified phone line ties this account to a real, traceable
        person — the single most important safety signal for the sitter entering
        your home.
      </WhyBox>
      {!sent ? (
        <form
          className="mt-3 space-y-2"
          action={(fd) =>
            start(async () => {
              setError(null);
              const r = await sendPhoneCode(fd);
              if (!r.ok) setError(r.error ?? "Could not send code.");
              else {
                setSent(true);
                setDevCode(r.devCode);
              }
            })
          }
        >
          <input
            name="phone"
            defaultValue={phone}
            placeholder="Mobile number"
            className={inputClass}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className={buttonClass()} disabled={pending}>
            {pending ? "Sending…" : "Send SMS code"}
          </button>
        </form>
      ) : (
        <form
          className="mt-3 space-y-2"
          action={(fd) =>
            start(async () => {
              setError(null);
              const r = await verifyPhone(fd);
              if (!r.ok) setError(r.error ?? "Could not verify.");
              else router.refresh();
            })
          }
        >
          <input
            name="code"
            inputMode="numeric"
            placeholder="6-digit code"
            className={inputClass}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button className={buttonClass()} disabled={pending}>
              {pending ? "Verifying…" : "Verify phone"}
            </button>
            <button
              type="button"
              className={buttonClass("secondary")}
              onClick={() => setSent(false)}
            >
              Change number
            </button>
          </div>
        </form>
      )}
      <DevCode code={devCode} />
    </StepShell>
  );
}

// --- Address ---
function AddressStep({
  done,
  initial,
}: {
  done: boolean;
  initial: {
    streetAddress: string;
    unit: string;
    city: string;
    province: string;
    postalCode: string;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  return (
    <StepShell n={3} title="Your home address" done={done}>
      <WhyBox>
        This is where the sitter will actually be going. It is stored securely
        and is only shared with a sitter <strong>after</strong> you confirm a
        booking with them — never before, and never in a link.
      </WhyBox>
      <form
        className="mt-3 space-y-2"
        action={(fd) =>
          start(async () => {
            setError(null);
            const r = await saveServiceAddress(fd);
            if (!r.ok) setError(r.error ?? "Could not save.");
            else {
              setSaved(true);
              router.refresh();
            }
          })
        }
      >
        <input
          name="streetAddress"
          defaultValue={initial.streetAddress}
          placeholder="Street address"
          className={inputClass}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            name="unit"
            defaultValue={initial.unit}
            placeholder="Unit (optional)"
            className={inputClass}
          />
          <input
            name="city"
            defaultValue={initial.city}
            placeholder="City"
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            name="province"
            defaultValue={initial.province}
            placeholder="Province"
            className={inputClass}
          />
          <input
            name="postalCode"
            defaultValue={initial.postalCode}
            placeholder="Postal code"
            className={inputClass}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && !error && (
          <p className="text-sm text-emerald-700">Address saved.</p>
        )}
        <button className={buttonClass()} disabled={pending}>
          {pending ? "Saving…" : done ? "Update address" : "Save address"}
        </button>
      </form>
    </StepShell>
  );
}

// --- ID upload ---
function IdStep({
  identityVerified,
  pendingReview,
}: {
  identityVerified: boolean;
  pendingReview: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (identityVerified) {
    return (
      <StepShell n={4} title="Verify your identity" done>
        <p className="text-sm text-emerald-700">
          Identity verified. Thank you — your document was deleted after review.
        </p>
      </StepShell>
    );
  }

  return (
    <StepShell n={4} title="Verify your identity" done={false}>
      <WhyBox>
        A government photo ID confirms a real, identifiable adult is behind this
        account. We review it, then <strong>delete the image</strong> — we store
        only the pass/fail result and your verified name, never the scan.
      </WhyBox>
      {pendingReview ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Your ID was submitted and is awaiting review by our team.
        </p>
      ) : (
        <form
          className="mt-3 space-y-2"
          action={(fd) =>
            start(async () => {
              setError(null);
              const r = await uploadIdDocument(fd);
              if (!r.ok) setError(r.error ?? "Could not upload.");
              else router.refresh();
            })
          }
        >
          <input
            type="file"
            name="document"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className={inputClass}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className={buttonClass()} disabled={pending}>
            {pending ? "Uploading…" : "Upload ID for review"}
          </button>
        </form>
      )}
    </StepShell>
  );
}

export type VerifyState = {
  email: string;
  emailVerified: boolean;
  phone: string;
  phoneVerified: boolean;
  addressOnFile: boolean;
  address: {
    streetAddress: string;
    unit: string;
    city: string;
    province: string;
    postalCode: string;
  };
  identityVerified: boolean;
  idPendingReview: boolean;
  requireIdentity: boolean; // whether Level 2 is needed to book
};

export function VerifyClient(props: VerifyState) {
  return (
    <div className="space-y-4">
      <EmailStep verified={props.emailVerified} email={props.email} />
      <PhoneStep verified={props.phoneVerified} phone={props.phone} />
      {props.requireIdentity && (
        <>
          <AddressStep done={props.addressOnFile} initial={props.address} />
          <IdStep
            identityVerified={props.identityVerified}
            pendingReview={props.idPendingReview}
          />
        </>
      )}
    </div>
  );
}
