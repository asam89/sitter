"use client";

import { useFormState } from "react-dom";
import { Card, buttonClass } from "@/components/ui";
import type { ApplicationFormState } from "@/lib/actions";

// Mirrors the Zod bounds in applicationSchema, so an over-long or too-short
// answer is caught in the browser instead of coming back as a server error.
const LIMITS = {
  bio: { min: 10, max: 2000 },
  experience: { min: 10, max: 2000 },
  certifications: { max: 1000 },
  documentUrls: { max: 2000 },
  phone: { min: 7, max: 40 },
};

export function ApplyForm({
  action,
  application,
  accountPhone,
  interviewPending,
}: {
  action: (
    state: ApplicationFormState,
    fd: FormData,
  ) => Promise<ApplicationFormState>;
  application: {
    bio: string;
    experience: string;
    certifications: string[];
    documentUrls: string[];
    targetPayRate: number;
    whatsappPhone: string | null;
    whatsappReachable: boolean;
  } | null;
  accountPhone: string | null;
  interviewPending: boolean;
}) {
  const [state, formAction] = useFormState(action, {});
  const input =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        {interviewPending && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Your interview is already booked — editing your answers here keeps
            that interview, so you don&apos;t go back to the end of the queue.
          </p>
        )}

        <label className="block text-sm font-medium">
          About you (bio)
          <textarea
            name="bio"
            required
            minLength={LIMITS.bio.min}
            maxLength={LIMITS.bio.max}
            rows={3}
            defaultValue={application?.bio ?? ""}
            className={input}
          />
        </label>
        <label className="block text-sm font-medium">
          Childcare experience
          <textarea
            name="experience"
            required
            minLength={LIMITS.experience.min}
            maxLength={LIMITS.experience.max}
            rows={3}
            defaultValue={application?.experience ?? ""}
            className={input}
          />
        </label>
        <label className="block text-sm font-medium">
          Mobile number
          <input
            type="tel"
            name="whatsappPhone"
            required
            inputMode="tel"
            minLength={LIMITS.phone.min}
            maxLength={LIMITS.phone.max}
            placeholder="+1 416 555 0134"
            defaultValue={application?.whatsappPhone ?? accountPhone ?? ""}
            className={input}
          />
          <span className="mt-1 block text-xs text-slate-500">
            Our team uses this to reach you about your application, the
            interview, and bookings.
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="whatsappReachable"
            defaultChecked={application?.whatsappReachable ?? true}
            className="mt-1"
          />
          <span>
            This number is on WhatsApp — you can message me there
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Leave it unticked and we&rsquo;ll stick to calls, texts and email.
            </span>
          </span>
        </label>
        <label className="block text-sm font-medium">
          Certifications (one per line or comma-separated)
          <textarea
            name="certifications"
            rows={2}
            maxLength={LIMITS.certifications.max}
            placeholder="CPR&#10;First Aid"
            defaultValue={application?.certifications.join("\n") ?? ""}
            className={input}
          />
        </label>
        <label className="block text-sm font-medium">
          Document links — CPR cert, police check, etc. (one URL per line)
          <textarea
            name="documentUrls"
            rows={2}
            maxLength={LIMITS.documentUrls.max}
            placeholder="https://…"
            defaultValue={application?.documentUrls.join("\n") ?? ""}
            className={input}
          />
          <span className="mt-1 block text-xs text-slate-500">
            MVP: paste document URLs. Direct file upload is a later phase.
          </span>
        </label>
        <label className="block text-sm font-medium">
          Target hourly pay rate (CAD) — your proposal
          <input
            type="number"
            name="targetPayRate"
            required
            min={1}
            max={500}
            step={1}
            defaultValue={application?.targetPayRate ?? 20}
            className={input}
          />
        </label>

        {state.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}

        <button type="submit" className={buttonClass()}>
          {application ? "Resubmit application" : "Submit application"}
        </button>
      </form>
    </Card>
  );
}
