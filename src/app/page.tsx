import Link from "next/link";
import { getSession } from "@/lib/session";

const PILLARS = [
  {
    title: "Every sitter is agency-vetted",
    body: "The Sitbaby team manually reviews every applicant and hand-picks who is listed. The trust layer is us — not anonymous reviews or peer endorsements.",
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
      <section className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 px-8 py-14 text-white">
        <h1 className="max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">
          Agency-vetted babysitters, booked in seconds.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-indigo-100">
          Sitbaby vets and lists every sitter. Log in, see who&apos;s available,
          and book directly — with a liability waiver and clear pricing on every
          booking.
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
              className="rounded-lg bg-white px-5 py-2.5 font-semibold text-indigo-700 hover:bg-indigo-50"
            >
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/signup?role=PARENT"
                className="rounded-lg bg-white px-5 py-2.5 font-semibold text-indigo-700 hover:bg-indigo-50"
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
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {PILLARS.map((p) => (
          <div
            key={p.title}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h3 className="text-lg font-semibold">{p.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{p.body}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Sitbaby vets and lists babysitters as a scheduling service. Sitters are
        independent contractors, not Sitbaby employees, and vetting/listing is
        not a guarantee of conduct. We never collect a child&apos;s full legal
        name or photo.
      </section>
    </div>
  );
}
