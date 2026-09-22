"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Card, buttonClass } from "@/components/ui";
import type { TeamMessageState } from "@/lib/team-message-actions";

type Sitter = {
  id: string;
  name: string | null;
  email: string;
  textable: boolean;
};

export function TeamMessageForm({
  action,
  sitters,
}: {
  action: (state: TeamMessageState, fd: FormData) => Promise<TeamMessageState>;
  sitters: Sitter[];
}) {
  const [state, formAction] = useFormState(action, {});
  const [recipient, setRecipient] = useState("");
  const [notifySms, setNotifySms] = useState(true);
  const input =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
  const targets = recipient
    ? sitters.filter((s) => s.id === recipient)
    : sitters;
  const textable = targets.filter((s) => s.textable).length;

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <label className="block text-sm">
          <span className="font-medium">To</span>
          <select
            name="recipientUserId"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className={input}
          >
            <option value="">All sitters ({sitters.length})</option>
            {sitters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name ?? s.email}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="font-medium">Subject</span>
          <input name="subject" required maxLength={120} className={input} />
        </label>

        <label className="block text-sm">
          <span className="font-medium">Message</span>
          <textarea
            name="body"
            required
            rows={7}
            maxLength={5000}
            className={input}
            placeholder="Shown in the sitter portal only. Nothing but a pointer goes out by text or email."
          />
        </label>

        <div className="space-y-2 text-sm">
          <label className="flex gap-2">
            <input
              type="checkbox"
              name="notifySms"
              checked={notifySms}
              onChange={(e) => setNotifySms(e.target.checked)}
              className="mt-1"
            />
            <span>
              <strong>Text them</strong> — &quot;Ri&apos;aya: you have a new
              message from the team. Log in to read it.&quot; Reaches {textable}{" "}
              of {targets.length} (those with a number who haven&apos;t replied
              STOP).
            </span>
          </label>
          <label className="flex gap-2">
            <input type="checkbox" name="notifyEmail" className="mt-1" />
            <span>
              <strong>Email them</strong> the same pointer.
            </span>
          </label>
        </div>

        {state?.error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {state.error}
          </p>
        )}
        {state?.sent !== undefined && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Posted to {state.sent} sitter{state.sent === 1 ? "" : "s"}
            {state.texted ? `, texted ${state.texted}` : ""}
            {state.emailed ? `, emailed ${state.emailed}` : ""}.
          </p>
        )}

        <button type="submit" className={buttonClass()}>
          Post to {targets.length} sitter{targets.length === 1 ? "" : "s"}
        </button>
      </form>
    </Card>
  );
}
