import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Badge, Card, PageTitle } from "@/components/ui";
import { dt } from "@/lib/format";
import { getActiveTerms } from "@/lib/terms";
import { publishTerms } from "@/lib/terms-actions";
import { TermsForm } from "./TermsForm";

export const dynamic = "force-dynamic";

// Suggests v1, v2, … so labels stay ordered without an Admin having to think
// about it; any label is accepted as long as it hasn't been published before.
function nextVersionLabel(existing: string[]): string {
  const highest = existing.reduce((max, v) => {
    const n = /^v(\d+)$/.exec(v);
    return n ? Math.max(max, Number(n[1])) : max;
  }, 0);
  return `v${highest + 1}`;
}

export default async function AdminTermsPage() {
  await requireRole("ADMIN");
  const active = await getActiveTerms();
  const [versions, accepted] = await Promise.all([
    prisma.termsVersion.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.booking.groupBy({
      by: ["waiverVersion"],
      _count: { _all: true },
    }),
  ]);
  const acceptedBy = new Map(
    accepted.map((a) => [a.waiverVersion, a._count._all]),
  );

  return (
    <div className="space-y-8">
      <PageTitle
        title="Waiver & terms"
        subtitle="The text parents accept before a booking. Editing publishes a new version — earlier versions stay exactly as they were accepted."
      />

      <Card className="space-y-1">
        <p className="text-sm">
          Live version: <strong>{active.version}</strong> · shown on the public{" "}
          <a href="/policies" className="underline">
            policies page
          </a>{" "}
          and in every booking flow.
        </p>
        <p className="text-xs text-slate-500">
          A booking records the version, timestamp, IP and device of the
          acceptance, so publishing new text never changes what someone already
          agreed to. This is not legal advice — have counsel review the text
          before you rely on it.
        </p>
      </Card>

      <TermsForm
        action={publishTerms}
        suggestedVersion={nextVersionLabel(versions.map((v) => v.version))}
        currentBody={active.body}
      />

      <section className="space-y-3">
        <h2 className="font-semibold">Published versions</h2>
        {versions.map((v) => (
          <Card key={v.id} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                {v.version}{" "}
                <span className="text-xs font-normal text-slate-500">
                  published {dt(v.createdAt)} · {acceptedBy.get(v.version) ?? 0}{" "}
                  booking(s) accepted it
                </span>
              </p>
              {v.active && <Badge color="green">LIVE</Badge>}
            </div>
            <details>
              <summary className="cursor-pointer text-sm text-slate-600">
                Read this version
              </summary>
              <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-700">
                {v.body}
              </pre>
            </details>
          </Card>
        ))}
      </section>
    </div>
  );
}
