import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getBusinessSettings } from "@/lib/settings";
import { isLastMinute } from "@/lib/pricing";
import { Badge, Card, EmptyState, PageTitle } from "@/components/ui";
import { dt, moneyHr } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  await requireRole("PARENT");
  const settings = await getBusinessSettings();

  // Only listed sitters (and only their non-suspended accounts) with future
  // open slots appear. Listing is the sole parent-facing gate.
  const sitters = await prisma.sitterProfile.findMany({
    where: {
      isListed: true,
      user: { suspended: false },
      slots: { some: { status: "OPEN", startTime: { gte: new Date() } } },
    },
    include: {
      user: { select: { name: true } },
      slots: {
        where: { status: "OPEN", startTime: { gte: new Date() } },
        orderBy: { startTime: "asc" },
      },
    },
    orderBy: { listedPayRate: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageTitle
        title="Available sitters"
        subtitle="Every sitter here is vetted and listed by Sitbaby. Pick a time to book."
      />
      {sitters.length === 0 ? (
        <EmptyState>No open availability right now — check back soon.</EmptyState>
      ) : (
        <div className="space-y-4">
          {sitters.map((sp) => (
            <Card key={sp.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{sp.user.name}</h2>
                  {sp.bio && (
                    <p className="mt-1 text-sm text-slate-600">{sp.bio}</p>
                  )}
                </div>
                <Badge color="indigo">{moneyHr(sp.listedPayRate)}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {sp.slots.map((slot) => {
                  const rush = isLastMinute(
                    slot.startTime,
                    settings.lastMinuteThresholdHours,
                  );
                  return (
                    <Link
                      key={slot.id}
                      href={`/parent/book/${slot.id}`}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:border-indigo-500 hover:bg-indigo-50"
                    >
                      {dt(slot.startTime)}
                      {rush && (
                        <span className="ml-1 text-xs text-amber-700">
                          (last-minute)
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
