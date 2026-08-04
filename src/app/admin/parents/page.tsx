import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getBusinessSettings } from "@/lib/settings";
import {
  Badge,
  Card,
  EmptyState,
  PageTitle,
} from "@/components/ui";
import { SuspendButton } from "../AdminControls";
import { LEVEL_LABEL } from "@/lib/verification";
import { dt } from "@/lib/format";
import { ReviewControls } from "./ReviewControls";

export const dynamic = "force-dynamic";

const LEVEL_COLOR = {
  LEVEL_0_REGISTERED: "slate",
  LEVEL_1_CONTACT: "amber",
  LEVEL_2_IDENTITY: "green",
} as const;

export default async function AdminParentsPage() {
  await requireRole("ADMIN");

  const [parents, pendingDocs, settings] = await Promise.all([
    prisma.user.findMany({
      where: { role: "PARENT" },
      orderBy: { createdAt: "desc" },
      include: { parentProfile: true },
    }),
    prisma.idVerificationDocument.findMany({
      where: { reviewStatus: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: {
        parentProfile: { include: { user: { select: { name: true } } } },
      },
    }),
    getBusinessSettings(),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <PageTitle
          title="Parents & verification"
          subtitle={`Booking requires ${LEVEL_LABEL[settings.minParentVerificationLevelToBook]}.`}
        />
      </div>

      {/* ID review queue */}
      <section>
        <h2 className="mb-3 font-semibold">
          ID review queue{" "}
          {pendingDocs.length > 0 && `(${pendingDocs.length})`}
        </h2>
        {pendingDocs.length === 0 ? (
          <EmptyState>No IDs awaiting review.</EmptyState>
        ) : (
          <div className="space-y-3">
            {pendingDocs.map((doc) => (
              <Card key={doc.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {doc.parentProfile.user.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      Submitted {dt(doc.createdAt)}
                    </p>
                  </div>
                  <Link
                    href={`/admin/parents/id-doc/${doc.id}`}
                    target="_blank"
                    className="text-sm font-medium text-brand-coral"
                  >
                    View document
                  </Link>
                </div>
                <ReviewControls
                  documentId={doc.id}
                  suggestedName={doc.parentProfile.user.name}
                />
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* All parents */}
      <section>
        <h2 className="mb-3 font-semibold">Parents ({parents.length})</h2>
        {parents.length === 0 ? (
          <EmptyState>No parent accounts yet.</EmptyState>
        ) : (
          <div className="space-y-2">
            {parents.map((p) => (
              <Card key={p.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {p.name}{" "}
                      <span className="text-sm text-slate-400">{p.email}</span>
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge color={LEVEL_COLOR[p.verificationLevel]}>
                        {LEVEL_LABEL[p.verificationLevel]}
                      </Badge>
                      <Badge color={p.emailVerified ? "green" : "slate"}>
                        Email {p.emailVerified ? "✓" : "—"}
                      </Badge>
                      <Badge color={p.phoneVerified ? "green" : "slate"}>
                        Phone {p.phoneVerified ? "✓" : "—"}
                      </Badge>
                      <Badge
                        color={
                          p.parentProfile?.identityVerified ? "green" : "slate"
                        }
                      >
                        ID {p.parentProfile?.identityVerified ? "✓" : "—"}
                      </Badge>
                      {p.suspended && <Badge color="red">Suspended</Badge>}
                    </div>
                  </div>
                  <SuspendButton userId={p.id} suspended={p.suspended} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
