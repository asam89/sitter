import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import {
  sendScheduleReminderNow,
  sendTeamMessage,
} from "@/lib/team-message-actions";
import { messageableSitters } from "@/lib/team-messages";
import { Card, EmptyState, PageTitle } from "@/components/ui";
import { dt } from "@/lib/format";
import { TeamMessageForm } from "./TeamMessageForm";
import { ScheduleReminderButton } from "./ScheduleReminderButton";

export const dynamic = "force-dynamic";

export default async function AdminMessagesPage() {
  await requireRole("ADMIN");
  const [sitters, messages, vetted] = await Promise.all([
    messageableSitters(),
    prisma.teamMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        subject: true,
        body: true,
        createdAt: true,
        smsSentCount: true,
        author: { select: { name: true } },
        recipient: { select: { name: true, email: true } },
        reads: {
          select: {
            userId: true,
            readAt: true,
            user: { select: { name: true } },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: {
        role: "SITTER",
        suspended: false,
        sitterProfile: { isNot: null },
      },
      select: { phone: true, smsOptOutAt: true },
    }),
  ]);
  const sitterCount = sitters.length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle
        title="Message sitters"
        subtitle="Post a note to every sitter or one sitter. They read it in their portal; the text or email just tells them to look."
      />

      <TeamMessageForm
        action={sendTeamMessage}
        sitters={sitters.map((s) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          textable: Boolean(s.phone) && !s.smsOptOutAt,
        }))}
      />

      <ScheduleReminderButton
        action={sendScheduleReminderNow}
        vettedCount={vetted.length}
        textableCount={vetted.filter((u) => u.phone && !u.smsOptOutAt).length}
      />

      <div className="space-y-2">
        <h2 className="font-semibold">Posted</h2>
        {messages.length === 0 ? (
          <EmptyState>Nothing posted yet.</EmptyState>
        ) : (
          messages.map((m) => {
            const audience = m.recipient ? 1 : sitterCount;
            const unread = m.recipient
              ? m.reads.length === 0
                ? [m.recipient.name ?? m.recipient.email]
                : []
              : sitters
                  .filter((s) => !m.reads.some((r) => r.userId === s.id))
                  .map((s) => s.name ?? s.email);
            return (
              <Card key={m.id}>
                <p className="font-medium">{m.subject}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {dt(m.createdAt)} · {m.author.name} · to{" "}
                  {m.recipient
                    ? (m.recipient.name ?? m.recipient.email)
                    : "all sitters"}
                  {m.smsSentCount > 0 ? ` · texted ${m.smsSentCount}` : ""} ·
                  read by {m.reads.length}/{audience}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                  {m.body}
                </p>
                {unread.length > 0 && (
                  <p className="mt-2 text-xs text-amber-800">
                    Not yet read: {unread.join(", ")}
                  </p>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
