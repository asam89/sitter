import type { Metadata } from "next";
import Link from "next/link";
import { getBusinessSettings } from "@/lib/settings";
import { getActiveTerms } from "@/lib/terms";
import { refundPolicyLines } from "@/lib/cancellation";
import { money } from "@/lib/format";

export const metadata: Metadata = {
  title: "Booking policies & terms — Ri'aya Babysitters",
  description:
    "How Ri'aya bookings work: minimum session length, pricing and fees, cancellation and refund tiers, the liability waiver, and how to reach us.",
};

export const dynamic = "force-dynamic";

// Public, no login: every rule a family or sitter should be able to read before
// they sign up. The numbers come from BusinessSettings and the waiver from the
// live TermsVersion, so this page can never drift from what the booking flow
// actually charges and asks people to accept.

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-brand-ink">{title}</h2>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
      {items.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

function hourLabel(hour: number): string {
  const h = ((hour + 11) % 12) + 1;
  return `${h}${hour < 12 ? "am" : "pm"}`;
}

export default async function PoliciesPage() {
  const [s, terms] = await Promise.all([
    getBusinessSettings(),
    getActiveTerms(),
  ]);

  const feeLine = (type: "PERCENT" | "FLAT", amount: number) =>
    type === "PERCENT" ? `${amount}%` : money(amount);

  const pricing = [
    `Every sitter's hourly rate is shown before you book, and you pay for a minimum of ${s.minBookingHours} hour(s).`,
    `Ri'aya's service fee is ${feeLine(s.platformFeeType, s.platformFeeAmount)}, added on top of the sitter's rate so the sitter keeps their full rate.`,
    `Bookings starting within ${s.lastMinuteThresholdHours}h carry a short-notice fee of ${feeLine(s.rushFeeType, s.rushFeeAmount)}, which goes to the sitter.`,
  ];
  if (s.extraChildFeeAmount > 0) {
    pricing.push(
      `${money(s.extraChildFeeAmount)} per additional child beyond the first.`,
    );
  }
  if (s.lateNightFeeAmount > 0) {
    pricing.push(
      `${money(s.lateNightFeeAmount)} late-night fee if the session runs between ${hourLabel(s.lateNightStartHour)} and ${hourLabel(s.lateNightEndHour)}.`,
    );
  }
  if (s.overnightFeeAmount > 0) {
    pricing.push(
      `${money(s.overnightFeeAmount)} overnight fee if the session runs between ${hourLabel(s.overnightStartHour)} and ${hourLabel(s.overnightEndHour)}.`,
    );
  }
  pricing.push(
    "Each of these appears as its own line in the itemised total you see before paying — nothing is charged that you haven't seen.",
  );

  return (
    <div className="space-y-10">
      <header className="rounded-2xl bg-brand-teal px-8 py-12 text-white">
        <h1 className="text-3xl font-bold sm:text-4xl">
          Booking policies &amp; terms
        </h1>
        <p className="mt-3 max-w-2xl text-brand-blue-light">
          The rules that apply to every Ri&apos;aya booking — pricing,
          cancellations, and what both families and sitters agree to. These are
          the same values the app charges and enforces.
        </p>
      </header>

      <Section title="How a booking works">
        <Bullets
          items={[
            "A parent creates an account and verifies their contact details — we don't place a sitter with an unverified family.",
            "You book an open time on a vetted sitter's calendar, or post a request for a time nobody has published yet.",
            "The sitter accepts or declines. A posted request becomes a confirmed booking as soon as a sitter picks it up.",
            "You pay to confirm. A booking isn't secured until payment is recorded.",
            "Reminders go to both sides before the session, and the sitter's payout is released once the booking is completed.",
          ]}
        />
      </Section>

      <Section title="Minimum session and pricing">
        <Bullets items={pricing} />
      </Section>

      <Section title="Paying">
        <Bullets
          items={[
            "Credit card, charged in the app when you confirm.",
            s.etransferEmail
              ? `Interac e-Transfer to ${s.etransferEmail} — the booking stays unconfirmed until we've received and marked it paid.`
              : "Interac e-Transfer is offered on some bookings; the booking stays unconfirmed until we've received and marked it paid.",
          ]}
        />
      </Section>

      <Section title="Cancellations and refunds">
        <Bullets items={refundPolicyLines(s)} />
      </Section>

      <Section title="Meeting your sitter first">
        <p className="text-sm text-slate-600">
          You can ask for a short intro call with your sitter before the
          session. It&apos;s optional, and declining it never affects your
          booking.
        </p>
      </Section>

      <Section title="Your child's information">
        <p className="text-sm text-slate-600">
          Allergy and medical notes you add to a booking are stored encrypted,
          are released to the sitter only once the booking is confirmed, and are
          deleted after the session. Nobody else can read them.
        </p>
      </Section>

      <Section title={`Liability waiver & terms (version ${terms.version})`}>
        <p className="text-sm text-slate-600">
          This is the text a parent accepts before each booking. Each acceptance
          is recorded against the version that was live at the time, so it never
          changes retroactively.
        </p>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-brand-teal/10 bg-white p-5 text-xs text-slate-700">
          {terms.body}
        </pre>
      </Section>

      <Section title="Questions">
        <p className="text-sm text-slate-600">
          Email{" "}
          <a
            href={`mailto:${s.supportEmail ?? "info@riaya.ca"}`}
            className="underline"
          >
            {s.supportEmail ?? "info@riaya.ca"}
          </a>{" "}
          and we&apos;ll get back to you. Ready to start?{" "}
          <Link href="/signup" className="underline">
            Create an account
          </Link>{" "}
          or{" "}
          <Link href="/sitter/apply" className="underline">
            apply as a babysitter
          </Link>
          .
        </p>
      </Section>
    </div>
  );
}
