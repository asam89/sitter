"use client";

import { useTransition } from "react";
import { buttonClass } from "@/components/ui";

// Wraps a bound server action in a button with a pending state.
export function ActionButton({
  action,
  children,
  variant = "primary",
  confirm,
}: {
  action: () => Promise<void> | void;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  confirm?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      className={buttonClass(variant)}
      disabled={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        startTransition(() => {
          void action();
        });
      }}
    >
      {pending ? "…" : children}
    </button>
  );
}
