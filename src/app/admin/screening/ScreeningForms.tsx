"use client";

import { useFormState } from "react-dom";
import { buttonClass } from "@/components/ui";
import {
  adminUploadScreening,
  destroyScreeningFile,
  reviewScreening,
  type ScreeningState,
} from "@/lib/screening-actions";

const input =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
const label = "block text-sm font-medium";

export type CheckTypeOption = { value: string; label: string };

function Message({ state }: { state: ScreeningState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-xs text-red-700">
        {state.error}
      </p>
    );
  }
  if (state.ok) return <p className="text-xs text-emerald-700">{state.ok}</p>;
  return null;
}

function DateFields({
  issuer,
  issuedOn,
  renewBy,
}: {
  issuer: string;
  issuedOn: string;
  renewBy: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className={label}>
        Issuing police service / body
        <input
          name="issuer"
          maxLength={160}
          defaultValue={issuer}
          placeholder="e.g. Peel Regional Police"
          className={input}
        />
      </label>
      <label className={label}>
        Issued on
        <input type="date" name="issuedOn" defaultValue={issuedOn} className={input} />
      </label>
      <label className={label}>
        Renew by
        <input type="date" name="renewBy" defaultValue={renewBy} className={input} />
      </label>
    </div>
  );
}

// Admin recording a document they already hold (emailed, handed over in
// person). It lands verified, because they have just read it.
export function AdminUploadScreeningForm({
  sitterUserId,
  checkTypes,
}: {
  sitterUserId: string;
  checkTypes: CheckTypeOption[];
}) {
  const [state, action] = useFormState<ScreeningState, FormData>(
    adminUploadScreening,
    {},
  );
  return (
    <form action={action} className="space-y-3 rounded-lg bg-slate-50 px-3 py-3">
      <input type="hidden" name="sitterUserId" value={sitterUserId} />
      <p className="text-sm font-medium">Add a document</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          Document
          <select name="checkType" className={input} defaultValue="VULNERABLE_SECTOR">
            {checkTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          File (PDF or image, max 12 MB)
          <input
            type="file"
            name="document"
            required
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className={input}
          />
        </label>
      </div>
      <DateFields issuer="" issuedOn="" renewBy="" />
      <label className={label}>
        Internal notes (never shown to the sitter or parents)
        <textarea name="adminNotes" rows={2} maxLength={2000} className={input} />
      </label>
      <Message state={state} />
      <button type="submit" className={buttonClass("secondary")}>
        Save as verified
      </button>
      <p className="text-xs text-slate-500">
        Stored encrypted. Every time anyone opens it, that is recorded against
        their Admin account.
      </p>
    </form>
  );
}

// Admin opening a sitter-uploaded document, correcting what it actually says,
// then vouching for it or rejecting it.
export function ReviewScreeningForm({
  screeningId,
  issuer,
  issuedOn,
  renewBy,
  adminNotes,
  hasFile,
}: {
  screeningId: string;
  issuer: string;
  issuedOn: string;
  renewBy: string;
  adminNotes: string;
  hasFile: boolean;
}) {
  const [state, action] = useFormState<ScreeningState, FormData>(
    reviewScreening,
    {},
  );
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="screeningId" value={screeningId} />
      {hasFile && (
        <a
          href={`/admin/screening/doc/${screeningId}`}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-sm font-medium text-brand-teal underline"
        >
          Open the document (logged)
        </a>
      )}
      <DateFields issuer={issuer} issuedOn={issuedOn} renewBy={renewBy} />
      <label className={label}>
        Internal notes
        <textarea
          name="adminNotes"
          rows={2}
          maxLength={2000}
          defaultValue={adminNotes}
          className={input}
        />
      </label>
      <Message state={state} />
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="decision"
          value="VERIFIED"
          className={buttonClass()}
        >
          Verify
        </button>
        <button
          type="submit"
          name="decision"
          value="REJECTED"
          className={buttonClass("secondary")}
        >
          Not acceptable
        </button>
      </div>
    </form>
  );
}

// Destroys the encrypted file and keeps the verification record.
export function DestroyScreeningFileForm({
  screeningId,
}: {
  screeningId: string;
}) {
  const [state, action] = useFormState<ScreeningState, FormData>(
    destroyScreeningFile,
    {},
  );
  return (
    <form action={action} className="mt-2 space-y-1">
      <input type="hidden" name="screeningId" value={screeningId} />
      <button type="submit" className="text-xs text-red-700 underline">
        Destroy the stored file (keeps the record that it was checked)
      </button>
      <Message state={state} />
    </form>
  );
}
