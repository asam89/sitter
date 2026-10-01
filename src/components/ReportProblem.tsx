"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { buttonClass } from "@/components/ui";

// "Report a problem" — available from the footer on every page and from the
// error screens, where it carries the error reference so the report lands
// against the failure the user actually hit.
export function ReportProblem({
  errorRef,
  variant = "link",
  label = "Report a problem",
}: {
  errorRef?: string | null;
  variant?: "link" | "button";
  label?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ref: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/problem-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route: pathname, note, ref: errorRef ?? null }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ref?: string;
        error?: string;
      };
      if (!res.ok || !data.ref) {
        setError(data.error ?? "We couldn't send that. Email info@riaya.ca.");
        return;
      }
      setResult({ ref: data.ref });
    } catch {
      setError("We couldn't send that. Email info@riaya.ca.");
    } finally {
      setSending(false);
    }
  }

  if (result) {
    return (
      <p className="text-sm text-brand-teal">
        Thanks — logged as <strong>{result.ref}</strong>. Our team has been
        alerted.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === "button"
            ? buttonClass("secondary")
            : "text-sm text-brand-teal underline hover:text-brand-coral"
        }
      >
        {label}
      </button>
    );
  }

  return (
    <div className="w-full max-w-md text-left">
      <label className="block text-sm font-medium">
        What went wrong?
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={2000}
          autoFocus
          placeholder="I clicked Submit application and got an error screen."
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <p className="mt-1 text-xs text-slate-500">
        We log the page you&apos;re on{errorRef ? ` and error ${errorRef}` : ""}.
        Please don&apos;t include passwords or your children&apos;s medical
        details — this goes to our issue tracker.
      </p>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={sending || note.trim().length < 5}
          className={buttonClass()}
        >
          {sending ? "Sending…" : "Send report"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-slate-500 underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
