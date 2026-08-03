import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { addMySlot, deleteMySlot } from "@/lib/actions";
import { ActionButton } from "@/components/ActionButton";
import {
  Badge,
  Card,
  EmptyState,
  PageTitle,
  buttonClass,
} from "@/components/ui";
import { dt } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const user = await requireRole("SITTER");
  const profile = await prisma.sitterProfile.findUnique({
    where: { userId: user.id },
    include: { slots: { orderBy: { startTime: "asc" } } },
  });
  if (!profile) redirect("/sitter");

  const input =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle
        title="Your availability"
        subtitle="Add open time blocks. Parents can book these once Sitbaby has you listed."
      />

      <Card>
        <form
          action={addMySlot}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="block text-sm font-medium">
            Start
            <input
              type="datetime-local"
              name="startTime"
              required
              className={input}
            />
          </label>
          <label className="block text-sm font-medium">
            End
            <input
              type="datetime-local"
              name="endTime"
              required
              className={input}
            />
          </label>
          <button type="submit" className={buttonClass()}>
            Add slot
          </button>
        </form>
      </Card>

      {profile.slots.length === 0 ? (
        <EmptyState>No availability yet — add your first slot above.</EmptyState>
      ) : (
        <div className="space-y-2">
          {profile.slots.map((slot) => (
            <Card key={slot.id}>
              <div className="flex items-center justify-between">
                <p className="text-sm">
                  {dt(slot.startTime)} → {dt(slot.endTime)}
                </p>
                <div className="flex items-center gap-3">
                  <Badge color={slot.status === "OPEN" ? "green" : "indigo"}>
                    {slot.status}
                  </Badge>
                  {slot.status === "OPEN" && (
                    <ActionButton
                      action={deleteMySlot.bind(null, slot.id)}
                      variant="secondary"
                      confirm="Remove this availability slot?"
                    >
                      Remove
                    </ActionButton>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
