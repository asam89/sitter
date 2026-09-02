"use client";

import { useFormState } from "react-dom";
import { buttonClass } from "@/components/ui";
import { uploadMyScreening } from "@/lib/screening-actions";
import type { ScreeningState } from "@/lib/screening-actions";

const input =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
const label = "block text-sm font-medium";

export function UploadScreeningForm({
  checkTypes,
}: {
  checkTypes: { value: string; label: string }[];
}) {
  const [state, action] = useFormState<ScreeningState, FormData>(
    uploadMyScreening,
    {},
  );
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          What is this?
          <select name="checkType" defaultValue="VULNERABLE_SECTOR" className={input}>
            {checkTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          File (PDF or photo, max 12 MB)
          <input
            type="file"
            name="document"
            required
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className={input}
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={label}>
          Issued by
          <input
            name="issuer"
            maxLength={160}
            placeholder="e.g. Peel Regional Police"
            className={input}
          />
        </label>
        <label className={label}>
          Date on the document
          <input type="date" name="issuedOn" className={input} />
        </label>
        <label className={label}>
          Expires / renew by
          <input type="date" name="renewBy" className={input} />
        </label>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.ok && <p className="text-sm text-emerald-700">{state.ok}</p>}
      <button type="submit" className={buttonClass()}>
        Upload securely
      </button>
    </form>
  );
}
