// Broken-function alerting and user problem reports.
//
// Two entry points, both landing in the same ErrorEvent table so Admins have
// one history at /admin/errors:
//
//   recordServerError()  – a page or server action threw. Next hides the real
//                          message from the browser, so the boundary sends the
//                          route + digest and the server logs hold the rest.
//                          Admins get an email, deduplicated per route so a
//                          crash loop can't flood the mailbox.
//   recordUserReport()   – someone pressed "Report a problem". Opens a GitHub
//                          issue in the repo so it lands in the backlog, and
//                          alerts Admins.
//
// Privacy: a GitHub issue is public, so it carries only the route, the short
// reference, the reporter's role and their note — never their email, name,
// address, medical notes or any token. The reporter's email is stored and sent
// to Admins only.
//
// Never throws: alerting or issue creation failing must not turn into a second
// error for the user.

import { prisma } from "@/lib/prisma";
import {
  notifyAdminsOfBrokenFunction,
  notifyAdminsOfProblemReport,
} from "@/lib/admin-notifications";

const MAX_MESSAGE = 500;
const MAX_NOTE = 2000;
// One email per route per window: a page that throws on every render would
// otherwise send an alert per visitor.
const ALERT_DEDUPE_MINUTES = 30;

export type ErrorEventActor = {
  userId?: string | null;
  userRole?: string | null;
  userEmail?: string | null;
};

// Short, unambiguous (no O/0/I/1) and quotable over the phone: RY-7Q2K4M.
function newRef(): string {
  const alphabet = "ACDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `RY-${out}`;
}

function clean(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed.slice(0, max) : null;
}

// Routes come from the browser, so treat them as untrusted: keep the path,
// drop query strings (they can carry tokens) and cap the length.
export function safeRoute(raw: string | null | undefined): string {
  if (!raw) return "unknown";
  const path = raw.split("?")[0].split("#")[0].trim();
  if (!path.startsWith("/")) return "unknown";
  return path.slice(0, 200);
}

function appUrl(path: string): string {
  const base = (process.env.NEXTAUTH_URL || "https://riaya.ca").replace(
    /\/$/,
    "",
  );
  return `${base}${path}`;
}

export async function recordServerError(input: {
  route: string;
  message?: string | null;
  digest?: string | null;
  actor?: ErrorEventActor;
}): Promise<{ ref: string }> {
  const route = safeRoute(input.route);
  const event = await prisma.errorEvent.create({
    data: {
      ref: newRef(),
      kind: "SERVER_ERROR",
      route,
      message: clean(input.message, MAX_MESSAGE),
      digest: clean(input.digest, 200),
      userId: input.actor?.userId ?? null,
      userRole: input.actor?.userRole ?? null,
      userEmail: input.actor?.userEmail ?? null,
    },
  });

  console.error(
    `[error-event] ${event.ref} SERVER_ERROR ${route} digest=${event.digest ?? "—"} ${event.message ?? ""}`,
  );

  const since = new Date(Date.now() - ALERT_DEDUPE_MINUTES * 60_000);
  const alreadyAlerted = await prisma.errorEvent.findFirst({
    where: {
      kind: "SERVER_ERROR",
      route,
      alertedAt: { gte: since },
      id: { not: event.id },
    },
    select: { id: true },
  });
  if (alreadyAlerted) return { ref: event.ref };

  await prisma.errorEvent.update({
    where: { id: event.id },
    data: { alertedAt: new Date() },
  });
  await notifyAdminsOfBrokenFunction({
    ref: event.ref,
    route,
    message: event.message,
    digest: event.digest,
    userRole: event.userRole,
    userEmail: event.userEmail,
    adminUrl: appUrl("/admin/errors"),
  });
  return { ref: event.ref };
}

export async function recordUserReport(input: {
  route: string;
  note: string;
  relatedRef?: string | null;
  actor?: ErrorEventActor;
}): Promise<{ ref: string; issueUrl: string | null }> {
  const route = safeRoute(input.route);
  const note = clean(input.note, MAX_NOTE) ?? "(no description)";
  const relatedRef = clean(input.relatedRef, 40);
  const event = await prisma.errorEvent.create({
    data: {
      ref: newRef(),
      kind: "USER_REPORT",
      route,
      reporterNote: note,
      digest: relatedRef,
      userId: input.actor?.userId ?? null,
      userRole: input.actor?.userRole ?? null,
      userEmail: input.actor?.userEmail ?? null,
    },
  });

  const issue = await createGithubIssue({
    title: `[${event.ref}] Problem reported on ${route}`,
    // Public issue: role and route only, never who reported it.
    body:
      `Reported from the Ri'aya app.\n\n` +
      `- Reference: \`${event.ref}\`\n` +
      `- Route: \`${route}\`\n` +
      `- Reported by: ${event.userRole ?? "signed-out visitor"}\n` +
      (relatedRef ? `- Related error: \`${relatedRef}\`\n` : "") +
      `- When: ${event.createdAt.toISOString()}\n\n` +
      `### What they said\n\n${note}\n`,
  });

  await prisma.errorEvent.update({
    where: { id: event.id },
    data: {
      githubIssueUrl: issue.url,
      githubIssueNumber: issue.number,
      githubError: issue.error,
      alertedAt: new Date(),
    },
  });

  await notifyAdminsOfProblemReport({
    ref: event.ref,
    route,
    note,
    relatedRef,
    userRole: event.userRole,
    userEmail: event.userEmail,
    issueUrl: issue.url,
    issueError: issue.error,
    adminUrl: appUrl("/admin/errors"),
  });

  return { ref: event.ref, issueUrl: issue.url };
}

export function githubIssuesConfigured(): boolean {
  return !!process.env.GITHUB_ISSUE_TOKEN;
}

// Files the issue with a fine-grained PAT that only needs Issues: write on the
// one repo. Unset, reports still reach Admins by email — they just don't land
// in the backlog automatically.
async function createGithubIssue(issue: {
  title: string;
  body: string;
}): Promise<{ url: string | null; number: number | null; error: string | null }> {
  const token = process.env.GITHUB_ISSUE_TOKEN;
  const repo = process.env.GITHUB_ISSUE_REPO || "asam89/sitter";
  if (!token) {
    return { url: null, number: null, error: "GITHUB_ISSUE_TOKEN not set" };
  }
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: issue.title,
        body: issue.body,
        labels: (process.env.GITHUB_ISSUE_LABELS || "user-report")
          .split(",")
          .map((l) => l.trim())
          .filter(Boolean),
      }),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      console.error(`[error-event] GitHub issue failed ${res.status}: ${detail}`);
      return { url: null, number: null, error: `HTTP ${res.status}` };
    }
    const created = (await res.json()) as { html_url?: string; number?: number };
    return {
      url: created.html_url ?? null,
      number: created.number ?? null,
      error: null,
    };
  } catch (e) {
    console.error(`[error-event] GitHub issue failed: ${String(e).slice(0, 200)}`);
    return { url: null, number: null, error: "request failed" };
  }
}
