import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getBusinessSettings } from "@/lib/settings";
import { adminCreateBooking } from "@/lib/actions";
import { effectiveRate } from "@/lib/pricing";
import { Card, EmptyState, PageTitle } from "@/components/ui";
import { AdminBookingForm } from "./AdminBookingForm";

export const dynamic = "force-dynamic";

// datetime-local wants a local "YYYY-MM-DDTHH:mm"; the app runs in
// America/Toronto so the server's local time is the family's.
function localInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export default async function AdminNewBookingPage() {
  await requireRole("ADMIN");

  const [settings, parents, sitters] = await Promise.all([
    getBusinessSettings(),
    prisma.user.findMany({
      where: { role: "PARENT", suspended: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.sitterProfile.findMany({
      where: { isListed: true, user: { suspended: false } },
      orderBy: { user: { name: "asc" } },
      select: {
        id: true,
        baseRate: true,
        listedPayRate: true,
        user: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle
        title="New booking"
        subtitle="Enter a booking for a family who called or messaged instead of using the app."
      />

      <Card>
        <h2 className="font-semibold">What happens next</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>The sitter is notified and confirms or declines, as usual.</li>
          <li>
            Once confirmed, the parent accepts the waiver and chooses to pay by
            credit card or Interac e-Transfer.
          </li>
          <li>
            For an e-Transfer, mark the booking paid from its page once the money
            lands — that&apos;s what confirms the booking.
          </li>
        </ol>
        <p className="mt-2 text-xs text-slate-500">
          Pricing uses the sitter&apos;s current rate and today&apos;s fee
          settings, same as a parent booking. Health details are collected from
          the parent, not here.
        </p>
      </Card>

      {parents.length === 0 || sitters.length === 0 ? (
        <EmptyState>
          You need at least one active parent account and one listed sitter
          before a booking can be entered.
        </EmptyState>
      ) : (
        <AdminBookingForm
          action={adminCreateBooking}
          parents={parents}
          sitters={sitters.map((s) => ({
            id: s.id,
            name: s.user.name,
            rate: effectiveRate(s),
          }))}
          minStartTime={localInputValue(new Date())}
          minHours={settings.minBookingHours}
        />
      )}
    </div>
  );
}
