"use client";

import { useFormState } from "react-dom";
import { Card, buttonClass } from "@/components/ui";
import type { BookingFormState } from "@/lib/actions";

export type ParentOption = { id: string; name: string; email: string };
export type SitterOption = { id: string; name: string; rate: number };

export function AdminBookingForm({
  action,
  parents,
  sitters,
  minStartTime,
  minHours,
}: {
  action: (
    state: BookingFormState,
    fd: FormData,
  ) => Promise<BookingFormState>;
  parents: ParentOption[];
  sitters: SitterOption[];
  minStartTime: string;
  minHours: number;
}) {
  const [state, formAction] = useFormState(action, {});
  const input =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Parent
            <select name="parentId" required defaultValue="" className={input}>
              <option value="" disabled>
                Choose a parent…
              </option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.email})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Sitter
            <select
              name="sitterProfileId"
              required
              defaultValue=""
              className={input}
            >
              <option value="" disabled>
                Choose a sitter…
              </option>
              {sitters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — ${s.rate}/hr
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Date &amp; start time
            <input
              type="datetime-local"
              name="startTime"
              required
              min={minStartTime}
              className={input}
            />
          </label>
          <label className="block text-sm font-medium">
            How many hours?
            <input
              type="number"
              name="durationHours"
              required
              min={minHours}
              max={12}
              defaultValue={Math.max(minHours, 3)}
              className={input}
            />
          </label>
          <label className="block text-sm font-medium">
            Children&apos;s age range
            <input
              name="childrenAgeRange"
              required
              placeholder="e.g. 2-5"
              className={input}
            />
          </label>
          <label className="block text-sm font-medium">
            Number of children
            <input
              type="number"
              name="numberOfChildren"
              required
              min={1}
              max={10}
              defaultValue={1}
              className={input}
            />
          </label>
        </div>
        <label className="block text-sm font-medium">
          Notes for the sitter (optional)
          <textarea name="notes" rows={2} className={input} />
        </label>

        {state?.error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {state.error}
          </p>
        )}

        <button type="submit" className={buttonClass()}>
          Create booking request
        </button>
      </form>
    </Card>
  );
}
