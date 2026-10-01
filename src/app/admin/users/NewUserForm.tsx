"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Card, buttonClass } from "@/components/ui";
import type { UserAdminState } from "@/lib/user-admin-actions";

export function NewUserForm({
  action,
}: {
  action: (state: UserAdminState, fd: FormData) => Promise<UserAdminState>;
}) {
  const [state, formAction] = useFormState(action, {});
  const [role, setRole] = useState<"PARENT" | "SITTER">("PARENT");
  const input =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Account type
            <select
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as "PARENT" | "SITTER")}
              className={input}
            >
              <option value="PARENT">Parent</option>
              <option value="SITTER">Sitter (already vetted)</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            Full name
            <input name="name" required maxLength={120} className={input} />
          </label>
          <label className="block text-sm font-medium">
            Email
            <input
              type="email"
              name="email"
              required
              className={input}
              placeholder="them@example.com"
            />
          </label>
          <label className="block text-sm font-medium">
            Mobile (optional)
            <input name="phone" maxLength={40} className={input} />
          </label>
          <label className="block text-sm font-medium">
            City (optional)
            <input name="city" maxLength={120} className={input} />
          </label>
          {role === "SITTER" && (
            <label className="block text-sm font-medium">
              Hourly rate (CAD)
              <input
                type="number"
                name="listedPayRate"
                min={1}
                max={500}
                defaultValue={20}
                required
                className={input}
              />
            </label>
          )}
        </div>

        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {role === "SITTER"
            ? "Creates a vetted sitter profile without the application form — " +
              "use it only for someone you've already vetted. They stay " +
              "unlisted (not bookable) until you list them."
            : "Creates a parent account. They'll still need to verify their " +
              "contact details before they can book."}{" "}
          We email them a link to set their own password; no password is set for
          them, so the account can&apos;t be used until they do.
        </p>

        {state?.error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {state.error}
          </p>
        )}

        <button type="submit" className={buttonClass()}>
          Create account &amp; send invite
        </button>
      </form>
    </Card>
  );
}
