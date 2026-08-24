import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Badge, Card, EmptyState, PageTitle } from "@/components/ui";
import { APPLICATION_STATUS_COLOR } from "@/lib/status";
import { dt, moneyHr } from "@/lib/format";
import { ApplicationReview } from "../AdminControls";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  await requireRole("ADMIN");
  const applications = await prisma.sitterApplication.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: { user: { select: { name: true, email: true } } },
  });

  const pending = applications.filter(
    (a) =>
      a.status === "APPLIED" ||
      a.status === "UNDER_REVIEW" ||
      a.status === "INTERVIEW",
  );

  // datetime-local wants "yyyy-MM-ddThh:mm" in local-ish form.
  const toLocalInput = (d: Date | null) =>
    d ? d.toISOString().slice(0, 16) : "";
  const decided = applications.filter(
    (a) => a.status === "VETTED" || a.status === "REJECTED",
  );

  return (
    <div className="space-y-6">
      <PageTitle
        title="Sitter applications"
        subtitle="Manually vet each applicant. Vetting sets a listed rate; the sitter's proposed (target) rate is preserved separately."
      />

      <section className="space-y-3">
        <h2 className="font-semibold">Awaiting review ({pending.length})</h2>
        {pending.length === 0 ? (
          <EmptyState>No applications awaiting review.</EmptyState>
        ) : (
          pending.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {a.user.name}{" "}
                    <span className="text-sm text-slate-400">
                      {a.user.email}
                    </span>
                  </p>
                  {a.whatsappPhone && (
                    <p className="mt-1 text-sm text-slate-600">
                      <span className="font-medium">Mobile:</span>{" "}
                      {a.whatsappPhone}
                      {a.whatsappReachable ? (
                        <>
                          {" · "}
                          <a
                            href={`https://wa.me/${a.whatsappPhone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-coral"
                          >
                            WhatsApp
                          </a>
                        </>
                      ) : (
                        " · not on WhatsApp"
                      )}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-slate-600">{a.bio}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    <span className="font-medium">Experience:</span>{" "}
                    {a.experience}
                  </p>
                  {a.certifications.length > 0 && (
                    <p className="mt-1 text-sm text-slate-600">
                      <span className="font-medium">Certifications:</span>{" "}
                      {a.certifications.join(", ")}
                    </p>
                  )}
                  {a.documentUrls.length > 0 && (
                    <ul className="mt-1 text-sm text-brand-coral">
                      {a.documentUrls.map((u) => (
                        <li key={u}>
                          <a href={u} target="_blank" rel="noreferrer">
                            {u}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-1 text-sm text-slate-500">
                    Target rate: {moneyHr(a.targetPayRate)} · applied{" "}
                    {dt(a.createdAt)}
                  </p>
                  {a.status === "INTERVIEW" && (
                    <p className="mt-2 rounded-lg bg-brand-cream px-3 py-2 text-sm text-brand-teal">
                      <span className="font-medium">Interview</span>
                      {a.interviewScheduledAt
                        ? ` scheduled for ${dt(a.interviewScheduledAt)}`
                        : " — no time set yet"}
                      {a.interviewNotes ? ` · ${a.interviewNotes}` : ""}
                    </p>
                  )}
                </div>
                <Badge color={APPLICATION_STATUS_COLOR[a.status]}>
                  {a.status.replace("_", " ")}
                </Badge>
              </div>
              <div className="mt-3">
                <ApplicationReview
                  applicationId={a.id}
                  status={a.status}
                  targetPayRate={a.targetPayRate}
                  interviewScheduledAt={toLocalInput(a.interviewScheduledAt)}
                  interviewNotes={a.interviewNotes}
                />
              </div>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Decided ({decided.length})</h2>
        {decided.length === 0 ? (
          <EmptyState>Nothing decided yet.</EmptyState>
        ) : (
          decided.map((a) => (
            <Card key={a.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{a.user.name}</p>
                  <p className="text-sm text-slate-500">
                    Target {moneyHr(a.targetPayRate)}
                    {a.reviewedAt ? ` · reviewed ${dt(a.reviewedAt)}` : ""}
                  </p>
                  {a.adminNotes && (
                    <p className="mt-1 text-sm text-slate-600">
                      Notes: {a.adminNotes}
                    </p>
                  )}
                </div>
                <Badge color={APPLICATION_STATUS_COLOR[a.status]}>
                  {a.status}
                </Badge>
              </div>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
