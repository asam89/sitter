import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Badge, Card, EmptyState, PageTitle } from "@/components/ui";
import { d, dt } from "@/lib/format";
import { CHECK_TYPE_LABEL, screeningState } from "@/lib/screening";
import {
  AdminUploadScreeningForm,
  DestroyScreeningFileForm,
  ReviewScreeningForm,
  type CheckTypeOption,
} from "./ScreeningForms";

export const dynamic = "force-dynamic";

const CHECK_TYPES: CheckTypeOption[] = Object.entries(CHECK_TYPE_LABEL).map(
  ([value, label]) => ({ value, label }),
);

function dateInput(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

export default async function AdminScreeningPage() {
  await requireRole("ADMIN");

  const sitters = await prisma.user.findMany({
    where: { role: "SITTER" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      suspended: true,
      sitterProfile: { select: { isListed: true } },
      screenings: {
        orderBy: { createdAt: "desc" },
        include: {
          verifiedBy: { select: { name: true } },
          accesses: {
            orderBy: { viewedAt: "desc" },
            take: 3,
            include: { admin: { select: { name: true } } },
          },
          _count: { select: { accesses: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <PageTitle
        title="Sitter background checks"
        subtitle="Police vulnerable sector checks and certifications, encrypted at rest. Families only ever see that a sitter has been checked."
      />

      <Card>
        <p className="text-sm text-slate-600">
          Documents are encrypted before they are written to disk and are never
          reachable from the public site. Opening one is recorded against your
          Admin account, along with when. Ask sitters to upload their own at{" "}
          <span className="font-mono text-xs">/sitter/screening</span> rather
          than emailing them.
        </p>
      </Card>

      {sitters.length === 0 ? (
        <EmptyState>No sitter accounts yet.</EmptyState>
      ) : (
        sitters.map((s) => {
          const vsc = s.screenings.find(
            (r) => r.checkType === "VULNERABLE_SECTOR" && screeningState(r).current,
          );
          return (
            <Card key={s.id} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{s.name}</h2>
                  <p className="text-xs text-slate-500">{s.email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {s.suspended && <Badge color="red">SUSPENDED</Badge>}
                  {s.sitterProfile?.isListed && <Badge color="green">LISTED</Badge>}
                  <Badge color={vsc ? "green" : "red"}>
                    {vsc ? "VSC ON FILE" : "NO CURRENT VSC"}
                  </Badge>
                </div>
              </div>

              {s.sitterProfile?.isListed && !vsc && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                  This sitter is bookable by families with no current vulnerable
                  sector check on file.
                </p>
              )}

              {s.screenings.map((r) => {
                const state = screeningState(r);
                return (
                  <div
                    key={r.id}
                    className="space-y-2 rounded-lg border border-slate-200 px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {CHECK_TYPE_LABEL[r.checkType]}
                        {r.issuer ? ` · ${r.issuer}` : ""}
                      </p>
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
                          {state.expired && r.status === "VERIFIED"
                            ? "EXPIRED"
                            : r.status}
                        </Badge>
                        {state.expiringSoon && (
                          <Badge color="amber">
                            renew in {state.daysToRenew}d
                          </Badge>
                        )}
                        {!r.storagePath && <Badge>FILE DESTROYED</Badge>}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      {r.issuedOn ? `Issued ${d(r.issuedOn)}` : "Issue date not recorded"}
                      {r.renewBy ? ` · renew by ${d(r.renewBy)}` : " · no renewal date"}
                      {r.verifiedAt && r.verifiedBy
                        ? ` · verified by ${r.verifiedBy.name} on ${d(r.verifiedAt)}`
                        : ""}
                      {` · opened ${r._count.accesses} time(s)`}
                    </p>
                    {r.accesses.length > 0 && (
                      <p className="text-xs text-slate-400">
                        Last opened:{" "}
                        {r.accesses
                          .map((a) => `${a.admin.name} (${dt(a.viewedAt)})`)
                          .join(", ")}
                      </p>
                    )}
                    <ReviewScreeningForm
                      screeningId={r.id}
                      issuer={r.issuer ?? ""}
                      issuedOn={dateInput(r.issuedOn)}
                      renewBy={dateInput(r.renewBy)}
                      adminNotes={r.adminNotes ?? ""}
                      hasFile={!!r.storagePath}
                    />
                    {r.storagePath && <DestroyScreeningFileForm screeningId={r.id} />}
                  </div>
                );
              })}

              <AdminUploadScreeningForm sitterUserId={s.id} checkTypes={CHECK_TYPES} />
            </Card>
          );
        })
      )}
    </div>
  );
}
