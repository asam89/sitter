"use client";

import { useState } from "react";
import { editMySlot } from "@/lib/actions";
import { buttonClass } from "@/components/ui";

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function EditSlot({
  slotId,
  startTime,
  endTime,
  isLastMinuteEligible,
}: {
  slotId: string;
  startTime: string;
  endTime: string;
  isLastMinuteEligible: boolean;
}) {
  const [open, setOpen] = useState(false);
  const input =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-brand-coral hover:underline"
      >
        Edit
      </button>
    );

  return (
    <form
      action={async (fd) => {
        await editMySlot(slotId, fd);
        setOpen(false);
      }}
      className="mt-3 w-full space-y-3 border-t border-slate-200 pt-3"
    >
      <div className="flex flex-wrap gap-3">
        <label className="block text-sm font-medium">
          Start
          <input
            type="datetime-local"
            name="startTime"
            required
            defaultValue={toLocalInput(new Date(startTime))}
            className={input}
          />
        </label>
        <label className="block text-sm font-medium">
          End
          <input
            type="datetime-local"
            name="endTime"
            required
            defaultValue={toLocalInput(new Date(endTime))}
            className={input}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isLastMinuteEligible"
          defaultChecked={isLastMinuteEligible}
        />
        Available for last-minute bookings (adds the rush fee)
      </label>
      <div className="flex gap-2">
        <button type="submit" className={buttonClass()}>
          Save
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={buttonClass("secondary")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
