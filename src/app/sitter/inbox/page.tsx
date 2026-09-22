import { requireRole } from "@/lib/session";
import { markTeamMessagesRead, sitterInbox } from "@/lib/team-messages";
import { Badge, Card, EmptyState, PageTitle } from "@/components/ui";
import { dt } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SitterInboxPage() {
  const user = await requireRole("SITTER");
  const messages = await sitterInbox(user.id);
  const unread = messages.filter((m) => m.reads.length === 0);
  await markTeamMessagesRead(
    user.id,
    unread.map((m) => m.id),
  );
  const unreadIds = new Set(unread.map((m) => m.id));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle
        title="Messages from the Ri'aya team"
        subtitle="Announcements and notes for you. Reply by email to info@riaya.ca."
      />
      {messages.length === 0 ? (
        <EmptyState>No messages yet.</EmptyState>
      ) : (
        messages.map((m) => (
          <Card key={m.id}>
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold">{m.subject}</p>
              {unreadIds.has(m.id) && <Badge color="indigo">New</Badge>}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {dt(m.createdAt)} · {m.author.name ?? "Ri'aya team"}
              {m.recipientUserId ? " · just for you" : ""}
            </p>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
              {m.body}
            </p>
          </Card>
        ))
      )}
    </div>
  );
}
