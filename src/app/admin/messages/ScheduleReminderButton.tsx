"use client";

import { useState, useTransition } from "react";
import { Card, buttonClass } from "@/components/ui";
import type { ScheduleReminderState } from "@/lib/team-message-actions";

export function ScheduleReminderButton({
  action,
  vettedCount,
  textableCount,
}: {
  action: () => Promise<ScheduleReminderState>;
  vettedCount: number;
  textableCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ScheduleReminderState>({});
  return (
    <Card>
      <h2 className="font-semibold">Schedule reminder</h2>
      <p className="mt-1 text-sm text-slate-600">
        Goes out automatically every Sunday evening. Send it now to all{" "}
        {vettedCount} vetted sitter{vettedCount === 1 ? "" : "s"}: an email with
        their open hours for the week, and a text to the {textableCount} with a
        number who haven&apos;t replied STOP.
      </p>
      <blockquote className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
        {`Salaam {name},

Please take a few minutes to set your schedule for the coming week. Once your hours are in, we can start matching you with families and sending you bookings.

You have {X} open hours in the next 7 days. Update them here:
riaya.ca/sitter/availability`}
      </blockquote>
      <p className="mt-2 text-xs text-slate-500">
        Text: Salaam from Ri&apos;aya! Please set your schedule for this week so
        we can start matching you with families: riaya.ca/sitter/availability
        Reply STOP to opt out.
      </p>
      {state.error && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {state.error}
        </p>
      )}
      {state.reminded !== undefined && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Sent to {state.reminded} sitter{state.reminded === 1 ? "" : "s"},
          texted {state.texted ?? 0}.
        </p>
      )}
      <button
        type="button"
        className={`${buttonClass()} mt-3`}
        disabled={pending || vettedCount === 0}
        onClick={() => {
          if (
            !window.confirm(
              `Send the schedule reminder to ${vettedCount} vetted sitter${vettedCount === 1 ? "" : "s"} now?`,
            )
          )
            return;
          startTransition(async () => {
            setState(await action());
          });
        }}
      >
        {pending ? "Sending…" : "Send schedule reminder now"}
      </button>
    </Card>
  );
}
