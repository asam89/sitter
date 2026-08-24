import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Badge, Card, EmptyState, PageTitle } from "@/components/ui";
import { dt } from "@/lib/format";
import { LEVEL_LABEL } from "@/lib/verification";
import { RoleForm } from "./RoleForm";
import { UserSuspendButton } from "./UserSuspendButton";

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
  searchParams: { q?: string; role?: string };
}) {
  const me = await requireRole("ADMIN");
  const q = searchParams.q?.trim() ?? "";
  const roleFilter =
    searchParams.role === "ADMIN" ||
    searchParams.role === "SITTER" ||
    searchParams.role === "PARENT"
      ? searchParams.role
      : undefined;

  const [users, audit] = await Promise.all([
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
                    Joined {dt(u.createdAt)} · {LEVEL_LABEL[u.verificationLevel]}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={ROLE_COLOR[u.role]}>{u.role}</Badge>
                  {u.suspended && <Badge color="red">SUSPENDED</Badge>}
                </div>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <RoleForm userId={u.id} role={u.role} isSelf={u.id === me.id} />
                {u.id !== me.id && (
                  <UserSuspendButton userId={u.id} suspended={u.suspended} />
                )}
              </div>
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
              {dt(a.createdAt)} — {a.actor.name} set{" "}
              <strong>{a.action}</strong> on {a.target.name} ({a.target.email})
            </p>
          ))
        )}
      </section>
    </div>
  );
}
