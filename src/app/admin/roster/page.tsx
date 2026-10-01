import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Badge, Card, EmptyState, PageTitle } from "@/components/ui";
import { d } from "@/lib/format";
import { sitterStage } from "@/lib/sitter-stage";
import { sittersWithCurrentVsc } from "@/lib/screening";

export const dynamic = "force-dynamic";

export default async function SitterRosterPage() {
  await requireRole("ADMIN");
  const sitters = await prisma.user.findMany({
    where: { role: "SITTER" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      suspended: true,
      createdAt: true,
      application: { select: { status: true } },
      sitterProfile: { select: { isListed: true, city: true } },
      _count: { select: { sitterBookings: true } },
    },
  });
  const vsc = await sittersWithCurrentVsc(sitters.map((s) => s.id));

  return (
    <div className="space-y-4">
      <PageTitle
        title="Sitter profiles"
        subtitle="Every sitter account, from first sign-up to listed. Open one to see their application, documents, bookings and payouts."
      />
      {sitters.length === 0 ? (
        <EmptyState>No sitter accounts yet.</EmptyState>
      ) : (
        <div className="space-y-2">
          {sitters.map((s) => {
            const stage = sitterStage(s);
            return (
              <Link key={s.id} href={`/admin/roster/${s.id}`} className="block">
                <Card className="hover:border-brand-coral">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-sm text-slate-500">
                        {s.email}
                        {s.phone ? ` · ${s.phone}` : ""}
                        {s.sitterProfile?.city
                          ? ` · ${s.sitterProfile.city}`
                          : ""}
                      </p>
                      <p className="text-xs text-slate-400">
                        Joined {d(s.createdAt)} · {s._count.sitterBookings}{" "}
                        booking{s._count.sitterBookings === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge color={stage.color}>{stage.label}</Badge>
                      <Badge color={vsc.has(s.id) ? "green" : "red"}>
                        {vsc.has(s.id) ? "VSC on file" : "No current VSC"}
                      </Badge>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
