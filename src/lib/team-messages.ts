// Read-side helpers for team → sitter messages (see team-message-actions.ts).
import { prisma } from "@/lib/prisma";

export const SITTER_INBOX_PATH = "/sitter/inbox";

export const SITTERS = { role: "SITTER", suspended: false } as const;

export async function messageableSitters() {
  return prisma.user.findMany({
    where: SITTERS,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      smsOptOutAt: true,
    },
  });
}

// Inbox for one sitter: broadcasts plus anything addressed to them, newest
// first, with whether they have opened each one.
export async function sitterInbox(userId: string) {
  return prisma.teamMessage.findMany({
    where: { OR: [{ recipientUserId: null }, { recipientUserId: userId }] },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      subject: true,
      body: true,
      createdAt: true,
      recipientUserId: true,
      author: { select: { name: true } },
      reads: { where: { userId }, select: { readAt: true } },
    },
  });
}

export async function unreadTeamMessageCount(userId: string): Promise<number> {
  return prisma.teamMessage.count({
    where: {
      OR: [{ recipientUserId: null }, { recipientUserId: userId }],
      reads: { none: { userId } },
    },
  });
}

export async function markTeamMessagesRead(
  userId: string,
  messageIds: string[],
): Promise<void> {
  if (messageIds.length === 0) return;
  await prisma.teamMessageRead.createMany({
    data: messageIds.map((messageId) => ({ messageId, userId })),
    skipDuplicates: true,
  });
}
