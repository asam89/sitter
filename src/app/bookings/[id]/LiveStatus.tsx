"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function LiveStatus({
  bookingId,
  initialStatus,
}: {
  bookingId: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [viewing, setViewing] = useState(false);
  const [offers, setOffers] = useState<number | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/bookings/${bookingId}/events`);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.status) setStatus(data.status);
        if (typeof data.viewing === "boolean") setViewing(data.viewing);
        if (typeof data.offers === "number") setOffers(data.offers);
        if (data.status && data.status !== "PENDING") {
          es.close();
          router.refresh();
        }
      } catch {
        // ignore
      }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [bookingId, router]);

  const step = viewing ? "A sitter is viewing your request…" : "Request sent";

  return (
    <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
        {status === "PENDING" ? step : status}
      </div>
      {offers != null && (
        <div className="mt-1 text-xs text-amber-700">
          Dispatched to {offers} trusted sitter(s) nearby.
        </div>
      )}
    </div>
  );
}
