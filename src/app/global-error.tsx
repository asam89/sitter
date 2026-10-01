"use client";

import { ErrorScreen } from "@/components/ErrorScreen";

// Catches failures in the root layout itself, so it must render <html>/<body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <ErrorScreen error={error} reset={reset} />
      </body>
    </html>
  );
}
