"use client";

// Where the sitter is actually going. Parents who entered it during
// verification see it read-only; anyone else has to fill it in before the
// booking is created, and it is then saved to their profile.
export function ServiceAddressFields({
  onFile,
}: {
  onFile: { line: string } | null;
}) {
  const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  if (onFile) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-700">
          Where the sitter is going
        </p>
        <p className="mt-1 text-sm text-slate-700">{onFile.line}</p>
        <p className="mt-1 text-xs text-slate-500">
          Shared with your sitter only once they accept. Change it in{" "}
          <a className="underline" href="/parent/verify">
            your verification details
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <fieldset className="space-y-2 rounded-lg border border-slate-200 p-3">
      <legend className="px-1 text-sm font-medium">
        Where the sitter is going
      </legend>
      <p className="text-xs text-slate-500">
        Required. Stored securely and shared with your sitter only once they
        accept — never before.
      </p>
      <input
        name="streetAddress"
        required
        placeholder="Street address"
        className={input}
      />
      <div className="grid grid-cols-2 gap-2">
        <input name="unit" placeholder="Unit (optional)" className={input} />
        <input name="city" required placeholder="City" className={input} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          name="province"
          required
          placeholder="Province"
          className={input}
        />
        <input
          name="postalCode"
          required
          placeholder="Postal code"
          className={input}
        />
      </div>
    </fieldset>
  );
}
