"use client";

import { useTransition } from "react";
import { joinCommunity } from "@/lib/actions";
import { buttonClass } from "@/components/ui";

export function JoinButton({ communityPartnerId }: { communityPartnerId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      className={buttonClass()}
      onClick={() =>
        startTransition(() => {
          void joinCommunity(communityPartnerId);
        })
      }
    >
      {pending ? "…" : "Join community"}
    </button>
  );
}
