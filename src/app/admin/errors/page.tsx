import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Badge, Card, EmptyState, PageTitle } from "@/components/ui";
import { dt } from "@/lib/format";
import { githubIssuesConfigured } from "@/lib/error-events";

export const dynamic = "force-dynamic";

// What's breaking, and what users are telling us about it. Admins are emailed
// as these arrive; this page is the history behind those alerts.
export default async function AdminErrorsPage() {
  await requireRole("ADMIN");
  const events = await prisma.errorEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <PageTitle
        title="Failures & problem reports"
        subtitle="Every page or action that threw, plus every 'Report a problem' a user sent. Admins are emailed as they happen — repeat failures on the same page are quiet for 30 minutes so a crash loop can't flood the mailbox."
      />

      {!githubIssuesConfigured() && (
        <Card>
          <p className="text-sm text-amber-700">
            <strong>GITHUB_ISSUE_TOKEN isn&apos;t set</strong>, so user reports
            still email you but no GitHub issue is filed. Add a fine-grained
            token with Issues: write on the repo to have them land in the
            backlog automatically.
          </p>
        </Card>
      )}

      {events.length === 0 ? (
        <EmptyState>Nothing has broken yet.</EmptyState>
      ) : (
        <div className="space-y-3">
          {events.map((e) => (
            <Card key={e.id}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge color={e.kind === "SERVER_ERROR" ? "red" : "amber"}>
                  {e.kind === "SERVER_ERROR" ? "Broken function" : "User report"}
                </Badge>
                <span className="font-mono text-sm">{e.ref}</span>
                <span className="text-sm text-slate-600">{e.route}</span>
                <span className="ml-auto text-xs text-slate-500">
                  {dt(e.createdAt)}
                </span>
              </div>
              {e.message && (
                <p className="mt-2 break-words font-mono text-xs text-slate-600">
                  {e.message}
                </p>
              )}
              {e.reporterNote && (
                <p className="mt-2 text-sm text-slate-700">{e.reporterNote}</p>
              )}
              <p className="mt-2 text-xs text-slate-500">
                {e.userEmail ?? "signed-out visitor"}
                {e.userRole ? ` · ${e.userRole}` : ""}
                {e.digest ? ` · digest ${e.digest}` : ""}
                {e.alertedAt ? " · admins alerted" : " · not emailed (repeat)"}
              </p>
              {e.githubIssueUrl && (
                <a
                  href={e.githubIssueUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-sm text-brand-teal underline"
                >
                  GitHub issue #{e.githubIssueNumber}
                </a>
              )}
              {!e.githubIssueUrl && e.kind === "USER_REPORT" && (
                <p className="mt-2 text-xs text-amber-700">
                  No GitHub issue filed ({e.githubError ?? "unknown reason"}).
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
