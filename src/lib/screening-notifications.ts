// Emails for sitter background checks: nudging a sitter whose police check is
// running out, and telling Admin which checks need re-doing.
//
// A vulnerable sector check that has quietly expired is worse than no check at
// all, because everyone assumes it is still good — so expiry is pushed, not
// waited on. Delivery goes through the swappable EmailProvider and never
// throws; a failed nudge must not fail the sweep.

import { prisma } from "@/lib/prisma";
import { getEmailProvider } from "@/lib/notifications";
import { CHECK_TYPE_LABEL, EXPIRY_WARNING_DAYS } from "@/lib/screening";
import { adminAlertRecipients } from "@/lib/admin-notifications";
import { d } from "@/lib/format";

function appUrl(path: string): string {
  const base = (process.env.NEXTAUTH_URL || "https://riaya.ca").replace(
    /\/$/,
    "",
  );
  return `${base}${path}`;
}

async function send(
  to: string | null,
  subject: string,
  body: string,
): Promise<void> {
  if (!to) return;
  try {
    await getEmailProvider().sendMessage(to, {
      subject,
      body: `${body}\n\n— Ri'aya Babysitters Inc.`,
    });
  } catch (e) {
    console.error(
      `[screening-notify] failed to email ${to}: ${String(e).slice(0, 200)}`,
    );
  }
}

export type ExpirySweep = {
  expiring: number;
  expired: number;
  sittersEmailed: number;
};

// Finds verified checks that are within the warning window or already past it,
// emails each affected sitter once and sends Admin a single digest.
// Idempotent enough to run daily: sitters get one mail per sweep per check, so
// keep the schedule to once a day.
export async function sweepScreeningExpiry(): Promise<ExpirySweep> {
  const now = new Date();
  const horizon = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 86_400_000);

  const rows = await prisma.sitterScreening.findMany({
    where: {
      status: "VERIFIED",
      renewBy: { not: null, lte: horizon },
      sitter: { suspended: false },
    },
    orderBy: { renewBy: "asc" },
    include: { sitter: { select: { name: true, email: true } } },
  });
  if (rows.length === 0) return { expiring: 0, expired: 0, sittersEmailed: 0 };

  const expired = rows.filter((r) => r.renewBy! < now);

  for (const row of rows) {
    const label = CHECK_TYPE_LABEL[row.checkType];
    const gone = row.renewBy! < now;
    await send(
      row.sitter.email,
      gone
        ? `Your ${label.toLowerCase()} has expired`
        : `Your ${label.toLowerCase()} needs renewing`,
      `${row.sitter.name ? `Hi ${row.sitter.name},` : "Hi,"}\n\n` +
        `Ri'aya has your ${label.toLowerCase()} on file` +
        `${row.issuer ? ` from ${row.issuer}` : ""}, and it ` +
        `${gone ? "expired on" : "is due for renewal by"} ${d(row.renewBy!)}.\n\n` +
        `Please get an up-to-date one and upload it here: ` +
        `${appUrl("/sitter/screening")}\n\n` +
        `We keep it encrypted and only our administrators can open it. ` +
        `Families never see the document — only that you have been checked.`,
    );
  }

  const digest = rows
    .map(
      (r) =>
        `• ${r.sitter.name ?? r.sitter.email} — ${CHECK_TYPE_LABEL[r.checkType]}: ` +
        `${r.renewBy! < now ? "EXPIRED" : "due"} ${d(r.renewBy!)}`,
    )
    .join("\n");

  const { emails } = await adminAlertRecipients();
  for (const to of emails) {
    await send(
      to,
      `${expired.length} expired / ${rows.length - expired.length} expiring sitter checks`,
      `These sitter background checks need attention:\n\n${digest}\n\n` +
        `Each sitter has been emailed to upload a new one. ` +
        `Review them here: ${appUrl("/admin/screening")}`,
    );
  }

  return {
    expiring: rows.length - expired.length,
    expired: expired.length,
    sittersEmailed: rows.length,
  };
}

// A sitter uploaded a check and it needs a human to open it and vouch for it.
export async function notifyAdminsOfScreeningUpload(s: {
  sitterName: string | null;
  sitterEmail: string;
  checkLabel: string;
}): Promise<void> {
  const { emails } = await adminAlertRecipients();
  for (const to of emails) {
    await send(
      to,
      `New sitter document to verify: ${s.sitterName ?? s.sitterEmail}`,
      `${s.sitterName ?? s.sitterEmail} uploaded a ${s.checkLabel.toLowerCase()} ` +
        `for review.\n\nOpen it (this is logged) and record the issuing service ` +
        `and renewal date here: ${appUrl("/admin/screening")}`,
    );
  }
}

// Their check has been read and accepted.
export async function notifySitterScreeningVerified(
  to: string | null,
  name: string | null,
  checkLabel: string,
): Promise<void> {
  await send(
    to,
    `Your ${checkLabel.toLowerCase()} is verified`,
    `${name ? `Hi ${name},` : "Hi,"}\n\n` +
      `Thank you — our team has verified your ${checkLabel.toLowerCase()}. ` +
      `Families booking you will see that you have been screened, never the ` +
      `document itself.`,
  );
}
