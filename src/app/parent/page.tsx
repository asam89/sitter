import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  PageTitle,
} from "@/components/ui";
import { BOOKING_STATUS_COLOR } from "@/lib/status";
import { dt, money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ParentDashboard() {
  const user = await requireRole("PARENT");
  const bookings = await prisma.booking.findMany({
    where: { parentId: user.id },
    orderBy: { dateTime: "desc" },
    include: { sitter: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <PageTitle
        title={`Hi, ${user.name}`}
        subtitle="Book a vetted Sitbaby sitter around your schedule."
      />

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Find & book a sitter</h2>
          <p className="text-sm text-slate-600">
            See real availability from our currently-listed, vetted sitters.
          </p>
        </div>
        <ButtonLink href="/parent/schedule">View availability</ButtonLink>
      </Card>

      <section>
        <h2 className="mb-3 font-semibold">Your bookings</h2>
        {bookings.length === 0 ? (
          <EmptyState>
            No bookings yet.{" "}
            <Link href="/parent/schedule" className="text-indigo-600">
              Browse availability
            </Link>
            .
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => (
              <Card key={b.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {dt(b.dateTime)} · {b.durationHours}h with {b.sitter.name}
                    </p>
                    <p className="text-sm text-slate-600">
                      {b.numberOfChildren} child(ren), ages {b.childrenAgeRange}
                      {b.isLastMinute && (
                        <span className="ml-2 text-amber-700">· last-minute</span>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Total {money(b.totalAmount)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge color={BOOKING_STATUS_COLOR[b.status]}>
                      {b.status}
                    </Badge>
                    <Link
                      href={`/bookings/${b.id}`}
                      className="text-sm font-medium text-indigo-600"
                    >
                      View
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
