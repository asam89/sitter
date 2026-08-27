"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReportProblem } from "@/components/ReportProblem";

// Shown by the error boundaries. On mount it tells the server the page broke,
// so Admins are alerted the moment a function fails rather than when a user
// gets around to complaining, and shows the reference back to the user.
export function ErrorScreen({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
}) {
  const pathname = usePathname();
  const [ref, setRef] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        route: pathname,
        digest: error.digest ?? null,
        message: error.message ?? null,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ref?: string } | null) => {
        if (!cancelled && data?.ref) setRef(data.ref);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname, error.digest, error.message]);

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-brand-ink">
        Something went wrong on our side
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        This page failed, not you. Our team has been alerted automatically
        {ref ? (
          <>
            {" "}
            — reference <strong>{ref}</strong>
          </>
        ) : null}
        .
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {reset && (
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-brand-teal px-5 py-2 text-sm font-semibold text-white"
          >
            Try again
          </button>
        )}
        <Link
          href="/"
          className="rounded-full border border-brand-teal/30 px-5 py-2 text-sm font-semibold text-brand-teal"
        >
          Back to home
        </Link>
      </div>
      <div className="mt-8 flex justify-center">
        <ReportProblem
          errorRef={ref}
          variant="button"
          label="Report a problem"
        />
      </div>
    </div>
  );
}
