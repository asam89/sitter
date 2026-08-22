import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { claimBookingRequest } from "@/lib/actions";
import { getBusinessSettings } from "@/lib/settings";
import { computePrice, effectiveRate, isLastMinute } from "@/lib/pricing";
import { ActionButton } from "@/components/ActionButton";
import { Badge, ButtonLink, Card, EmptyState, PageTitle } from "@/components/ui";
import { dt, money, requestRef } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SitterRequestsPage() {
  const user = await requireRole("SITTER");
  const profile = await prisma.sitterProfile.findUnique({
    where: { userId: user.id },
  });

  if (!profile?.isListed) {
    return (
      <div className="space-y-6">
        <PageTitle
          title="Open requests"
          subtitle="Families looking for a sitter at a time nobody has posted."
        />
        <Card>
          <p className="text-sm text-slate-600">
            Open requests are shown to listed sitters only. Once our team has
            vetted you and switched you live, requests will appear here.
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

  const [requests, settings, mySlots] = await Promise.all([
    prisma.bookingRequest.findMany({
      where: { status: "OPEN", startTime: { gt: new Date() } },
      orderBy: { startTime: "asc" },
      include: {
        parent: { select: { parentProfile: { select: { city: true } } } },
      },
    }),
    getBusinessSettings(),
    prisma.availabilitySlot.findMany({
      where: { sitterProfileId: profile.id },
      select: { startTime: true, endTime: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageTitle
        title="Open requests"
        subtitle="A family needs a sitter at a time nobody has posted. First to pick it up gets the booking."
      />

      {requests.length === 0 ? (
        <EmptyState>
          No open requests right now — you&apos;ll get an email when a family
          posts one.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const end = new Date(
              r.startTime.getTime() + r.durationHours * 3600 * 1000,
            );
            const lastMinute = isLastMinute(
              r.startTime,
              settings.lastMinuteThresholdHours,
            );
            const price = computePrice(
              effectiveRate(profile),
              r.durationHours,
              lastMinute,
              settings,
              r.startTime,
              r.numberOfChildren,
            );
            // Claiming would create a booked block, so an overlap with anything
            // already on the sitter's calendar blocks it.
            const clash = mySlots.some(
              (s) => s.startTime < end && s.endTime > r.startTime,
            );
            return (
              <Card key={r.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{dt(r.startTime)}</span>
                      <Badge color="amber">{r.durationHours}h</Badge>
                      {lastMinute && <Badge color="red">Last minute</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {r.numberOfChildren} child
                      {r.numberOfChildren === 1 ? "" : "ren"}, aged{" "}
                      {r.childrenAgeRange}
                      {r.parent.parentProfile?.city
                        ? ` · ${r.parent.parentProfile.city}`
                        : ""}
                    </p>
                    {r.notes && (
                      <p className="mt-1 text-sm text-slate-500">
                        “{r.notes}”
                      </p>
                    )}
                    <p className="mt-2 text-xs text-slate-500">
                      {requestRef(r.requestNumber)} · you&apos;d earn{" "}
                      {money(price.sitterPayout)} at your listed rate
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {clash ? (
                      <p className="text-xs text-slate-500">
                        Overlaps a block already
                        <br />
                        on your calendar
                      </p>
                    ) : (
                      <ActionButton
                        action={claimBookingRequest.bind(null, r.id)}
                        confirm={`Take ${dt(r.startTime)} for ${r.durationHours}h? This confirms the booking with the family.`}
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
        The family&apos;s address is released to you only once you pick a request
        up. Rates are set by Ri&apos;aya, never negotiated on a request.
      </p>
    </div>
  );
}
