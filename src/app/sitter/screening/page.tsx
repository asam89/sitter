import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Badge, Card, EmptyState, PageTitle } from "@/components/ui";
import { d } from "@/lib/format";
import { CHECK_TYPE_LABEL, screeningState } from "@/lib/screening";
import { UploadScreeningForm } from "./UploadScreeningForm";

export const dynamic = "force-dynamic";

const CHECK_TYPES = Object.entries(CHECK_TYPE_LABEL).map(([value, label]) => ({
  value,
  label,
}));

export default async function SitterScreeningPage() {
  const user = await requireRole("SITTER");
  const screenings = await prisma.sitterScreening.findMany({
    where: { sitterUserId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageTitle
        title="Your checks and certifications"
        subtitle="Your police vulnerable sector check, CPR and first aid — held securely for Ri'aya's records."
      />

      <Card>
        <h2 className="font-semibold">How your documents are handled</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>
            Encrypted the moment they are uploaded — they are never readable
            from the site, a link, or a copy of our database.
          </li>
          <li>
            Only Ri&apos;aya administrators can open them, and every time one
            does, it is recorded against their name.
          </li>
          <li>
            Families never see the document or what is on it — only that
            Ri&apos;aya has checked you.
          </li>
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold">Upload a document</h2>
        <p className="mb-3 mt-1 text-sm text-slate-600">
          Please don&apos;t email these — email isn&apos;t encrypted and copies
          sit in both mailboxes.
        </p>
        <UploadScreeningForm checkTypes={CHECK_TYPES} />
      </Card>

      <Card>
        <h2 className="font-semibold">On file</h2>
        {screenings.length === 0 ? (
          <div className="mt-3">
            <EmptyState>Nothing on file yet.</EmptyState>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {screenings.map((r) => {
              const state = screeningState(r);
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {CHECK_TYPE_LABEL[r.checkType]}
                      {r.issuer ? ` · ${r.issuer}` : ""}
                    </p>
                    <p className="text-xs text-slate-500">
                      {r.issuedOn ? `Issued ${d(r.issuedOn)}` : "No issue date"}
                      {r.renewBy ? ` · renew by ${d(r.renewBy)}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      color={
                        r.status === "VERIFIED"
                          ? state.expired
                            ? "red"
                            : "green"
                          : r.status === "REJECTED"
                            ? "red"
                            : "amber"
                      }
                    >
                      {r.status === "VERIFIED" && state.expired
                        ? "EXPIRED"
                        : r.status === "PENDING"
                          ? "AWAITING REVIEW"
                          : r.status}
                    </Badge>
                    {state.expiringSoon && (
                      <Badge color="amber">renew in {state.daysToRenew}d</Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
