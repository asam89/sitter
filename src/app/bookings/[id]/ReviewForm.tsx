"use client";

import { useState } from "react";
import { submitReview } from "@/lib/actions";
import { buttonClass } from "@/components/ui";

export function ReviewForm({
  bookingId,
  subjectName,
}: {
  bookingId: string;
  subjectName: string;
}) {
  const [rating, setRating] = useState(5);
  const [done, setDone] = useState(false);

  async function action(fd: FormData) {
    await submitReview(fd);
    setDone(true);
  }

  if (done)
    return (
      <p className="text-sm text-emerald-700">
        Thanks — your review of {subjectName} was saved.
      </p>
    );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="rating" value={rating} />
      <div>
        <p className="text-sm font-medium">Rate {subjectName}</p>
        <div className="mt-1 flex gap-1 text-2xl">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => setRating(n)}
              className={n <= rating ? "text-amber-500" : "text-slate-300"}
            >
              {n <= rating ? "★" : "☆"}
            </button>
          ))}
        </div>
      </div>
      <textarea
        name="comment"
        placeholder={`How was your experience with ${subjectName}? (optional)`}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        rows={3}
      />
      <button type="submit" className={buttonClass()}>
        Submit review
      </button>
    </form>
  );
}
