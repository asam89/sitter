"use client";

import { useState } from "react";

// Optional per-child health details. One row per child, driven by the number of
// children on the booking form. Kept optional so a parent with nothing to
// declare stores nothing at all.
export function ChildMedicalFields({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  const input =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
  const rows = Array.from({ length: Math.max(1, Math.min(count, 10)) });

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm font-medium text-brand-teal"
      >
        {open ? "Hide" : "Add"} allergies, medications or medical needs
        (optional)
      </button>
      {open && (
        <div className="mt-3 space-y-4">
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Health details are encrypted and shared only with the sitter who
            takes this booking, and only once it is confirmed. Ri&apos;aya staff
            cannot read them. They are deleted 60 days after the session.
            Emergencies are still 911 first.
          </p>
          {rows.map((_, i) => (
            <fieldset key={i} className="space-y-2">
              <legend className="text-sm font-semibold">
                Child {i + 1}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-sm">
                  First name or nickname (optional)
                  <input name={`medical.${i}.label`} className={input} />
                </label>
                <label className="block text-sm">
                  Age (optional)
                  <input
                    type="number"
                    min={0}
                    max={18}
                    name={`medical.${i}.ageYears`}
                    className={input}
                  />
                </label>
              </div>
              <label className="block text-sm">
                Allergies
                <input
                  name={`medical.${i}.allergies`}
                  placeholder="e.g. peanuts — EpiPen in the blue bag"
                  className={input}
                />
              </label>
              <label className="block text-sm">
                Medical conditions
                <input name={`medical.${i}.conditions`} className={input} />
              </label>
              <label className="block text-sm">
                Medications and doses
                <input name={`medical.${i}.medications`} className={input} />
              </label>
              <label className="block text-sm">
                Special needs or routines
                <textarea
                  name={`medical.${i}.specialNeeds`}
                  rows={2}
                  className={input}
                />
              </label>
            </fieldset>
          ))}
        </div>
      )}
    </div>
  );
}
