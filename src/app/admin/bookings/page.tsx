import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Badge, Card, EmptyState, PageTitle } from "@/components/ui";
import { BOOKING_STATUS_COLOR } from "@/lib/status";
import { bookingRef, dt, money, time } from "@/lib/format";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const monthFmt = new Intl.DateTimeFormat("en-CA", {
  month: "long",
  year: "numeric",
});

// Bubble tint per lifecycle state — mirrors the status badge colours.
const BUBBLE_STYLE: Record<string, string> = {
  REQUESTED: "bg-amber-100 text-amber-900 hover:bg-amber-200",
  APPROVED: "bg-brand-blue/30 text-brand-ink hover:bg-brand-blue/50",
  IN_PROGRESS: "bg-brand-blue/30 text-brand-ink hover:bg-brand-blue/50",
  COMPLETED: "bg-emerald-100 text-emerald-900 hover:bg-emerald-200",
  DECLINED: "bg-red-100 text-red-900 hover:bg-red-200",
  CANCELLED: "bg-slate-100 text-slate-500 line-through hover:bg-slate-200",
};

// "YYYY-MM" → first of that month in server-local time; invalid/absent = now.
function monthStart(param?: string): Date {
  const m = param?.match(/^(\d{4})-(\d{2})$/);
  const now = new Date();
  if (!m) return new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(Number(m[1]), Number(m[2]) - 1, 1);
}

function monthParam(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default async function AdminBookingsCalendar({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  await requireRole("ADMIN");

  const start = monthStart(searchParams.month);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const prev = new Date(start.getFullYear(), start.getMonth() - 1, 1);
  const next = end;

  const bookings = await prisma.booking.findMany({
    where: { dateTime: { gte: start, lt: end } },
    orderBy: { dateTime: "asc" },
    include: {
      parent: { select: { name: true } },
      sitter: { select: { name: true } },
    },
  });

  // Bucket by calendar day so each cell renders its own bubbles.
  const byDay = new Map<string, typeof bookings>();
  for (const b of bookings) {
    const key = dayKey(new Date(b.dateTime));
    const list = byDay.get(key);
    if (list) list.push(b);
    else byDay.set(key, [b]);
  }

  // Leading blanks so the 1st lands under its weekday, then a full grid.
  const cells: (Date | null)[] = [];
  for (let i = 0; i < start.getDay(); i++) cells.push(null);
  for (
    let d = new Date(start);
    d < end;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  ) {
    cells.push(new Date(d));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = dayKey(new Date());
  const grossValue = bookings.reduce((sum, b) => sum + b.totalAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle
          title="Bookings"
          subtitle={`${bookings.length} booking(s) this month · ${money(grossValue)} booked value`}
        />
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/bookings?month=${monthParam(prev)}`}
            className="rounded-lg border border-brand-teal/30 bg-white px-3 py-2 text-sm font-semibold text-brand-teal hover:bg-brand-cream"
          >
            ←
          </Link>
          <span className="min-w-[10rem] text-center text-sm font-semibold text-brand-ink">
            {monthFmt.format(start)}
          </span>
          <Link
            href={`/admin/bookings?month=${monthParam(next)}`}
            className="rounded-lg border border-brand-teal/30 bg-white px-3 py-2 text-sm font-semibold text-brand-teal hover:bg-brand-cream"
          >
            →
          </Link>
          <Link
            href="/admin/bookings"
            className="ml-2 text-sm font-medium text-brand-coral hover:underline"
          >
            Today
          </Link>
        </div>
      </div>

      <Card className="overflow-x-auto p-3">
        <div className="min-w-[52rem]">
          <div className="grid grid-cols-7 gap-1 pb-1">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-brand-teal-light"
              >
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (!day)
                return (
                  <div
                    key={`blank-${i}`}
                    className="min-h-[7rem] rounded-lg bg-brand-cream/40"
                  />
                );
              const key = dayKey(day);
              const dayBookings = byDay.get(key) ?? [];
              const isToday = key === todayKey;
              return (
                <div
                  key={key}
                  className={`min-h-[7rem] rounded-lg border p-1.5 ${
                    isToday
                      ? "border-brand-coral bg-brand-coral/5"
                      : "border-brand-teal/10 bg-white"
                  }`}
                >
                  <p
                    className={`px-1 text-xs font-semibold ${
                      isToday ? "text-brand-coral" : "text-slate-400"
                    }`}
                  >
                    {day.getDate()}
                  </p>
                  <div className="mt-1 space-y-1">
                    {dayBookings.map((b) => (
                      <Link
                        key={b.id}
                        href={`/bookings/${b.id}`}
                        title={`${bookingRef(b.bookingNumber)} · ${b.parent.name} → ${b.sitter.name} · ${b.durationHours}h · ${b.status}`}
                        className={`block truncate rounded-full px-2 py-1 text-[11px] font-medium transition ${
                          BUBBLE_STYLE[b.status] ?? "bg-slate-100"
                        }`}
                      >
                        {time(b.dateTime)} · {b.sitter.name} ({b.durationHours}
                        h)
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <section>
        <h2 className="mb-3 font-semibold">
          {monthFmt.format(start)} — booking details
        </h2>
        {bookings.length === 0 ? (
          <EmptyState>No bookings this month.</EmptyState>
        ) : (
          <div className="space-y-2">
            {bookings.map((b) => (
              <Card key={b.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      <span className="font-mono text-xs text-slate-400">
                        {bookingRef(b.bookingNumber)}
                      </span>{" "}
                      {b.parent.name} → {b.sitter.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {dt(b.dateTime)} · {b.durationHours}h ·{" "}
                      {money(b.totalAmount)}
                      {b.isLastMinute && (
                        <span className="ml-1 text-amber-700">· rush</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color={BOOKING_STATUS_COLOR[b.status]}>
                      {b.status}
                    </Badge>
                    {b.paidAt && b.status !== "CANCELLED" && (
                      <Badge color="green">PAID</Badge>
                    )}
                    <Link
                      href={`/bookings/${b.id}`}
                      className="text-sm font-medium text-brand-coral"
                    >
                      Open
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
