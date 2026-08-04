import Link from "next/link";
import { getSession } from "@/lib/session";

const PILLARS = [
  {
    title: "Every sitter is agency-vetted",
    body: "The Ri'aya team manually reviews every applicant and hand-picks who is listed. The trust layer is us — not anonymous reviews or peer endorsements.",
  },
  {
    title: "A scheduling tool, not a marketplace",
    body: "Log in, see real availability from currently-listed sitters, and book the slot you want directly. No browsing feeds, no back-and-forth messaging to get started.",
  },
  {
    title: "Transparent pricing, rush fees disclosed",
    body: "You see the listed rate before you book. Last-minute bookings carry a clearly-itemised rush fee — never folded silently into the total.",
  },
];

export default async function Home() {
  const session = await getSession();
  return (
    <div className="space-y-12">
      <section className="relative grid overflow-hidden rounded-2xl bg-brand-teal text-white md:grid-cols-2">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-25 md:w-1/2"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg,#8598B5 0 28px,transparent 28px 64px)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-6 top-6 h-14 w-14 bg-brand-coral md:left-auto md:right-1/2 md:mr-6"
          style={{
            clipPath:
              "polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)",
          }}
        />
        <div className="relative px-8 py-14">
          <h1 className="max-w-md text-4xl font-bold leading-tight sm:text-5xl">
            Vetted babysitters, booked with peace of mind.
          </h1>
          <p className="mt-4 max-w-md text-lg text-brand-blue-light">
            Ri&apos;aya Babysitters vets and lists every sitter. Log in, see
            who&apos;s available, and book directly — with a liability waiver and
            clear pricing on every booking.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {session?.user ? (
              <Link
                href={
                  session.user.role === "ADMIN"
                    ? "/admin"
                    : session.user.role === "SITTER"
                      ? "/sitter"
                      : "/parent"
                }
                className="rounded-lg bg-brand-coral px-5 py-2.5 font-semibold text-white hover:bg-brand-coral-dark"
              >
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/signup?role=PARENT"
                  className="rounded-lg bg-brand-coral px-5 py-2.5 font-semibold text-white hover:bg-brand-coral-dark"
                >
                  Find a sitter
                </Link>
                <Link
                  href="/signup?role=SITTER"
                  className="rounded-lg border border-white/60 px-5 py-2.5 font-semibold text-white hover:bg-white/10"
                >
                  Apply to sit
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="relative flex items-end justify-center bg-brand-cream">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/illustrations/hero-babysitter.webp"
            alt="A hijabi babysitter reading a book to young children while another plays with blocks"
            className="h-full w-full object-cover"
          />
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {PILLARS.map((p) => (
          <div
            key={p.title}
            className="rounded-xl border border-brand-teal/10 bg-white p-6 shadow-sm"
          >
            <h3 className="text-lg font-semibold text-brand-ink">{p.title}</h3>
            <p className="mt-2 text-sm text-brand-teal-light">{p.body}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col items-start justify-between gap-4 rounded-xl border border-brand-teal/10 bg-white p-6 md:flex-row md:items-center">
        <div>
          <h3 className="text-lg font-semibold text-brand-ink">
            The people behind the vetting
          </h3>
          <p className="mt-1 max-w-xl text-sm text-brand-teal-light">
            Every applicant is reviewed and interviewed by our team of ECEs,
            OCT-certified teachers, and trusted community members before they
            can be listed.
          </p>
        </div>
        <Link
          href="/team"
          className="shrink-0 rounded-lg border border-brand-teal/40 px-5 py-2.5 font-semibold text-brand-teal hover:bg-brand-teal hover:text-white"
        >
          Meet our team
        </Link>
      </section>

      <section className="rounded-xl border border-brand-teal/10 bg-white p-6 text-sm text-brand-teal-light">
        Ri&apos;aya Babysitters vets and lists babysitters as a scheduling
        service. Sitters are independent contractors, not Ri&apos;aya employees,
        and vetting/listing is not a guarantee of conduct. We never collect a
        child&apos;s full legal name or photo.
      </section>
    </div>
  );
}
