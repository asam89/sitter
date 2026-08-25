"use client";

import { ActionButton } from "@/components/ActionButton";
import { resendAccountInvite } from "@/lib/user-admin-actions";

// Re-sends the set-password link, for an invite that was lost or expired.
export function InviteButton({ userId }: { userId: string }) {
  return (
    <ActionButton
      action={resendAccountInvite.bind(null, userId)}
      variant="secondary"
    >
      Resend set-password email
    </ActionButton>
  );
}
