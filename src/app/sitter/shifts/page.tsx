import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { takeShiftCover } from "@/lib/shift-cover-actions";
import { openShiftCoversFor } from "@/lib/shift-covers";
import { sitterPayout } from "@/lib/pricing";
import { ActionButton } from "@/components/ActionButton";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  PageTitle,
} from "@/components/ui";
import { dt, money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SitterShiftsPage() {
  const user = await requireRole("SITTER");
  const profile = await prisma.sitterProfile.findUnique({
    where: { userId: user.id },
  });

  if (!profile) {
    return (
      <div className="space-y-6">
        <PageTitle
          title="Shifts needing cover"
          subtitle="Booked shifts another sitter can't make."
        />
        <Card>
          <p className="text-sm text-slate-600">
            Shifts are offered to vetted sitters only. Once our team has vetted
            you, they will appear here.
          </p>
          <div className="mt-3">
            <ButtonLink href="/sitter" variant="secondary">
              Back to dashboard
            </ButtonLink>
          </div>
        </Card>
      </div>
    );
  }

  const [covers, myBlocks] = await Promise.all([
    openShiftCoversFor(user.id),
    prisma.availabilitySlot.findMany({
      where: { sitterProfileId: profile.id, status: "BOOKED" },
      select: { startTime: true, endTime: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageTitle
        title="Shifts needing cover"
        subtitle="The booked sitter can't make these. First to take one gets the booking."
      />

      {covers.length === 0 ? (
        <EmptyState>
          No shifts need cover right now. We&apos;ll text and email you when one
          comes up.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {covers.map((c) => {
            const b = c.booking;
            const end = new Date(
              b.dateTime.getTime() + b.durationHours * 3600 * 1000,
            );
            const clash = myBlocks.some(
              (s) => s.startTime < end && s.endTime > b.dateTime,
            );
            const city = b.parent.parentProfile?.city;
            return (
              <Card key={c.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{dt(b.dateTime)}</span>
                      <Badge color="amber">{b.durationHours}h</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {b.numberOfChildren} child
                      {b.numberOfChildren === 1 ? "" : "ren"}, aged{" "}
                      {b.childrenAgeRange}
                      {city ? ` · ${city}` : ""}
                    </p>
                    {c.note && (
                      <p className="mt-1 text-sm text-slate-500">“{c.note}”</p>
                    )}
                    <p className="mt-2 text-xs text-slate-500">
                      You&apos;d earn {money(sitterPayout(b))}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {clash ? (
                      <p className="text-xs text-slate-500">
                        You already have a booking
                        <br />
                        during this shift
                      </p>
                    ) : (
                      <ActionButton
                        action={takeShiftCover.bind(null, c.id)}
                        confirm={`Take ${dt(b.dateTime)} for ${b.durationHours}h? You become the sitter for this booking.`}
                      >
                        I can take this
                      </ActionButton>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-500">
        The family&apos;s address and contact details are released to you once
        you take the shift.
      </p>
    </div>
  );
}
