"use client";

import { useTransition } from "react";
import { requestEndorsement } from "@/lib/actions";
import { buttonClass } from "@/components/ui";

export function EndorsementButton({
  communityPartnerId,
  pending,
}: {
  communityPartnerId: string;
  pending: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      disabled={isPending}
      className={buttonClass("secondary")}
      onClick={() =>
        startTransition(() => {
          void requestEndorsement(communityPartnerId);
        })
      }
    >
      {pending ? "Re-request" : "Request endorsement"}
    </button>
  );
}
