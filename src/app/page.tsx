import Link from "next/link";
import { getSession } from "@/lib/session";

const PILLARS = [
  {
    title: "Community trust, not cold vetting",
    body: "Sitters are endorsed by a community organization you already share — a mosque, school, or sports league — not just anonymous document review.",
  },
  {
    title: "Fast because trust is pre-established",
    body: "Vetting happens upstream at the community level, so booking is on-demand: request now and the nearest trusted sitter responds.",
  },
  {
    title: "Flat, transparent pricing",
    body: "No subscriptions. No pay-to-message wall. You see the sitter's rate plus a single flat platform fee before you commit — ever.",
  },
];

export default async function Home() {
  const session = await getSession();
  return (
    <div className="space-y-12">
      <section className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 px-8 py-14 text-white">
        <h1 className="max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">
          Trusted childcare from families you already share a community with.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-indigo-100">
          No subscriptions, no cold strangers. CircleCare connects parents with
          sitters endorsed by their own community.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {session?.user ? (
            <Link
              href="/parent"
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
                Become a sitter
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
        CircleCare is a marketplace connecting independent parents and sitters.
        Community endorsement is a trust signal, not a legal guarantee of
        conduct. We never collect a child&apos;s full legal name or photo.
      </section>

      <section className="text-center text-sm text-slate-500">
        Run a mosque, school, or sports league?{" "}
        <Link href="/partner/apply" className="font-medium text-indigo-600">
          Become a Community Partner
        </Link>
        .
      </section>
    </div>
  );
}
