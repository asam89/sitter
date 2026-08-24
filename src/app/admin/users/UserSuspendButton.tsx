"use client";

import { ActionButton } from "@/components/ActionButton";
import { setUserSuspendedAudited } from "@/lib/user-admin-actions";

// Suspension from the accounts page, audited so it is attributable later.
export function UserSuspendButton({
  userId,
  suspended,
}: {
  userId: string;
  suspended: boolean;
}) {
  return (
    <ActionButton
      action={setUserSuspendedAudited.bind(null, userId, !suspended)}
      variant="secondary"
      confirm={
        suspended ? undefined : "Suspend this account? They can't sign in."
      }
    >
      {suspended ? "Unsuspend" : "Suspend"}
    </ActionButton>
  );
}
