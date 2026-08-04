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
        subtitle="Book a vetted Ri'aya sitter around your schedule."
      />

      <div className="rounded-xl bg-brand-teal p-5 text-white shadow-sm">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand-coral" />
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            Your peace of mind
          </h2>
        </div>
        <ul className="mt-3 grid gap-2 text-sm text-brand-blue-light sm:grid-cols-2">
          {[
            "Every sitter is manually vetted & hand-listed by our team.",
            "A liability waiver + itemised pricing on every booking.",
            "Secure in-app messaging — no numbers exchanged.",
            "We never store your child's full name or photo.",
          ].map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden className="font-bold text-white">
                ✓
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/illustrations/spot-outdoors.webp"
            alt="A hijabi babysitter walking with two children"
            className="hidden h-20 w-20 rounded-lg object-cover sm:block"
          />
          <div>
            <h2 className="font-semibold text-brand-ink">Find & book a sitter</h2>
            <p className="text-sm text-brand-teal-light">
              See real availability from our currently-listed, vetted sitters.
            </p>
          </div>
        </div>
        <ButtonLink href="/parent/schedule">View availability</ButtonLink>
      </Card>

      <section>
        <h2 className="mb-3 font-semibold">Your bookings</h2>
        {bookings.length === 0 ? (
          <EmptyState>
            No bookings yet.{" "}
            <Link href="/parent/schedule" className="text-brand-coral">
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
                      className="text-sm font-medium text-brand-coral"
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
