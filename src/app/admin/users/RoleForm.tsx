"use client";

import { useFormState } from "react-dom";
import type { Role } from "@prisma/client";
import { buttonClass } from "@/components/ui";
import { setUserRole, type UserAdminState } from "@/lib/user-admin-actions";

// Role change for one account. Kept as a form (not a one-click button) so
// granting Admin is a deliberate two-step action.
export function RoleForm({
  userId,
  role,
  isSelf,
}: {
  userId: string;
  role: Role;
  isSelf: boolean;
}) {
  const [state, formAction] = useFormState<UserAdminState, FormData>(
    setUserRole,
    {},
  );

  if (isSelf) {
    return (
      <p className="text-xs text-slate-500">
        Your own account — another Admin must change your role.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex items-end gap-2">
        <select
          name="role"
          defaultValue={role}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="PARENT">Parent</option>
          <option value="SITTER">Sitter</option>
          <option value="ADMIN">Admin</option>
        </select>
        <button type="submit" className={buttonClass("secondary")}>
          Change role
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-xs text-red-700">
          {state.error}
        </p>
      )}
      {state.ok && <p className="text-xs text-emerald-700">{state.ok}</p>}
    </form>
  );
}
