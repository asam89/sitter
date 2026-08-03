"use client";

import { useState, useTransition } from "react";
import { toggleAvailability } from "@/lib/actions";

export function AvailabilityToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [, startTransition] = useTransition();

  function flip() {
    const next = !on;
    setOn(next);
    startTransition(() => {
      void toggleAvailability(next);
    });
  }

  return (
    <button
      onClick={flip}
      role="switch"
      aria-checked={on}
      className={
        "relative inline-flex h-7 w-12 items-center rounded-full transition " +
        (on ? "bg-emerald-500" : "bg-slate-300")
      }
    >
      <span
        className={
          "inline-block h-5 w-5 transform rounded-full bg-white transition " +
          (on ? "translate-x-6" : "translate-x-1")
        }
      />
    </button>
  );
}
