import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { adminAddSlot, adminDeleteSlot } from "@/lib/actions";
import { ActionButton } from "@/components/ActionButton";
import {
  Badge,
  Card,
  EmptyState,
  PageTitle,
  buttonClass,
} from "@/components/ui";
import { dt, moneyHr } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminSitterAvailability({
  params,
}: {
  params: { id: string };
}) {
  await requireRole("ADMIN");
  const sp = await prisma.sitterProfile.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { name: true } },
      slots: { orderBy: { startTime: "asc" } },
    },
  });
  if (!sp) notFound();

  const addSlot = adminAddSlot.bind(null, sp.id);
  const input =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle
        title={`${sp.user.name} — availability`}
        subtitle={`Oversight view · listed rate ${moneyHr(sp.listedPayRate)} · ${sp.isListed ? "listed" : "unlisted"}`}
      />

      <Card>
        <form action={addSlot} className="flex flex-wrap items-end gap-3">
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

      {sp.slots.length === 0 ? (
        <EmptyState>No availability set.</EmptyState>
      ) : (
        <div className="space-y-2">
          {sp.slots.map((slot) => (
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
                      action={adminDeleteSlot.bind(null, slot.id)}
                      variant="secondary"
                      confirm="Remove this slot?"
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
