"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { acceptOffer, declineOffer } from "@/lib/actions";
import { buttonClass } from "@/components/ui";

export function OfferActions({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      <button
        disabled={pending}
        className={buttonClass()}
        onClick={() =>
          startTransition(async () => {
            await acceptOffer(bookingId);
            router.push(`/bookings/${bookingId}`);
          })
        }
      >
        Accept
      </button>
      <button
        disabled={pending}
        className={buttonClass("secondary")}
        onClick={() =>
          startTransition(async () => {
            await declineOffer(bookingId);
            router.refresh();
          })
        }
      >
        Decline
      </button>
    </div>
  );
}
