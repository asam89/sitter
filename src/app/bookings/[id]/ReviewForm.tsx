"use client";

import { useState } from "react";
import { submitReview } from "@/lib/actions";
import { buttonClass } from "@/components/ui";

export function ReviewForm({ bookingId }: { bookingId: string }) {
  const [rating, setRating] = useState(5);
  const action = submitReview.bind(null, bookingId);
  return (
    <form action={action} className="space-y-3">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button"
            key={n}
            onClick={() => setRating(n)}
            className={
              "text-2xl " + (n <= rating ? "text-amber-400" : "text-slate-300")
            }
            aria-label={`${n} stars`}
          >
            ★
          </button>
        ))}
      </div>
      <input type="hidden" name="rating" value={rating} />
      <textarea
        name="text"
        placeholder="Share your experience (optional)"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        rows={3}
      />
      <button type="submit" className={buttonClass()}>
        Post review
      </button>
    </form>
  );
}
