import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Badge, Card, EmptyState, PageTitle } from "@/components/ui";
import { dt } from "@/lib/format";
import { LEVEL_LABEL } from "@/lib/verification";
import { adminAlertRecipients } from "@/lib/admin-notifications";
import { adminCreateUser } from "@/lib/user-admin-actions";
import { RoleForm } from "./RoleForm";
import { UserSuspendButton } from "./UserSuspendButton";
import { NewUserForm } from "./NewUserForm";
import { InviteButton } from "./InviteButton";
import { ActivateSitterForm } from "./ActivateSitterForm";

export const dynamic = "force-dynamic";

const ROLE_COLOR = {
  ADMIN: "green",
  SITTER: "amber",
  PARENT: "slate",
} as const;

// Account administration: every account in one place, with role changes and
// suspension. Any Admin can promote another Admin, so this page is also the
// audit trail of who did that.
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    role?: string;
    invited?: string;
    resent?: string;
  };
}) {
  const me = await requireRole("ADMIN");
  const q = searchParams.q?.trim() ?? "";
  const roleFilter =
    searchParams.role === "ADMIN" ||
    searchParams.role === "SITTER" ||
    searchParams.role === "PARENT"
      ? searchParams.role
      : undefined;

  const [alerts, users, audit] = await Promise.all([
    adminAlertRecipients(),
    prisma.user.findMany({
      where: {
        ...(roleFilter ? { role: roleFilter } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { email: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
      take: 200,
      include: {
        sitterProfile: {
          select: { isListed: true, listedPayRate: true, city: true },
        },
      },
    }),
    prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      include: {
        actor: { select: { name: true } },
        target: { select: { name: true, email: true } },
      },
    }),
  ]);

  const link = "rounded-lg border border-slate-300 px-3 py-1.5 text-sm";

  return (
    <div className="space-y-8">
      <PageTitle
        title="User accounts"
        subtitle="See every account, change roles, and grant or remove Admin access."
      />

      {searchParams.invited === "1" && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          Account created. We emailed them a link to set their own password —
          they can&apos;t sign in until they use it.
        </p>
      )}
      {searchParams.resent === "1" && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          Set-password email sent. Any earlier link they were sent no longer
          works.
        </p>
      )}

      <details>
        <summary className="cursor-pointer text-sm font-medium">
          Add a parent or sitter account
        </summary>
        <div className="mt-3">
          <NewUserForm action={adminCreateUser} />
        </div>
      </details>

      <Card className="space-y-1">
        <p className="text-sm font-medium">
          Email alerts (new sign-ups, sitter applications, bookings) go to
        </p>
        <p className="text-sm text-slate-600">
          {alerts.emails.length > 0 ? alerts.emails.join(", ") : "nobody"}
        </p>
        <p className="text-xs text-slate-500">
          {alerts.source === "ADMIN_ACCOUNTS"
            ? "Every active Admin account receives them — promote someone to Admin below and they are added automatically."
            : "Set explicitly by ADMIN_ALERT_EMAILS, which overrides the Admin accounts below."}
        </p>
        {alerts.extras.length > 0 && (
          <p className="text-xs text-slate-500">
            Plus {alerts.extras.join(", ")} from ADMIN_ALERT_EXTRA_EMAILS —
            shared inboxes with no account here.
          </p>
        )}
      </Card>

      <Card>
        <form className="flex flex-wrap items-end gap-2">
          <label className="text-sm font-medium">
            Search
            <input
              name="q"
              defaultValue={q}
              placeholder="Name or email"
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium">
            Role
            <select
              name="role"
              defaultValue={roleFilter ?? ""}
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="PARENT">Parents</option>
              <option value="SITTER">Sitters</option>
              <option value="ADMIN">Admins</option>
            </select>
          </label>
          <button type="submit" className={link}>
            Apply
          </button>
          <Link href="/admin/users" className={link}>
            Clear
          </Link>
        </form>
      </Card>

      {users.length === 0 ? (
        <EmptyState>No account matches that search.</EmptyState>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <Card key={u.id} className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {u.name}{" "}
                    {u.id === me.id && (
                      <span className="text-xs text-slate-500">(you)</span>
                    )}
                  </p>
                  <p className="text-sm text-slate-600">{u.email}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Joined {dt(u.createdAt)} ·{" "}
                    {LEVEL_LABEL[u.verificationLevel]}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={ROLE_COLOR[u.role]}>{u.role}</Badge>
                  {u.role === "SITTER" && !u.sitterProfile && (
                    <Badge color="amber">NOT ACTIVE</Badge>
                  )}
                  {u.sitterProfile?.isListed && (
                    <Badge color="green">LISTED</Badge>
                  )}
                  {u.suspended && <Badge color="red">SUSPENDED</Badge>}
                </div>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <RoleForm userId={u.id} role={u.role} isSelf={u.id === me.id} />
                <div className="flex flex-wrap items-center gap-2">
                  {u.role !== "ADMIN" && <InviteButton userId={u.id} />}
                  {u.id !== me.id && (
                    <UserSuspendButton userId={u.id} suspended={u.suspended} />
                  )}
                </div>
              </div>
              {u.role === "SITTER" && (
                <ActivateSitterForm
                  userId={u.id}
                  hasProfile={!!u.sitterProfile}
                  rate={u.sitterProfile?.listedPayRate ?? null}
                  city={u.sitterProfile?.city ?? null}
                  isListed={u.sitterProfile?.isListed ?? false}
                />
              )}
            </Card>
          ))}
        </div>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">Recent privilege changes</h2>
        {audit.length === 0 ? (
          <EmptyState>No role or suspension changes yet.</EmptyState>
        ) : (
          audit.map((a) => (
            <p key={a.id} className="text-xs text-slate-600">
              {dt(a.createdAt)} — {a.actor.name} set <strong>{a.action}</strong>{" "}
              on {a.target.name} ({a.target.email})
            </p>
          ))
        )}
      </section>
    </div>
  );
}
