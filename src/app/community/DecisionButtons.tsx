"use client";

import { useTransition } from "react";
import { decideAffiliation, decideEndorsement } from "@/lib/actions";
import { buttonClass } from "@/components/ui";

export function DecideAffiliation({ affiliationId }: { affiliationId: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <button
        disabled={pending}
        className={buttonClass()}
        onClick={() => start(() => void decideAffiliation(affiliationId, true))}
      >
        Approve
      </button>
      <button
        disabled={pending}
        className={buttonClass("secondary")}
        onClick={() => start(() => void decideAffiliation(affiliationId, false))}
      >
        Reject
      </button>
    </div>
  );
}

export function DecideEndorsement({ endorsementId }: { endorsementId: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <button
        disabled={pending}
        className={buttonClass()}
        onClick={() => start(() => void decideEndorsement(endorsementId, true))}
      >
        Endorse
      </button>
      <button
        disabled={pending}
        className={buttonClass("secondary")}
        onClick={() => start(() => void decideEndorsement(endorsementId, false))}
      >
        Deny
      </button>
    </div>
  );
}
