"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, buttonClass } from "@/components/ui";

const input =
  "mt-1 w-full rounded-lg border border-brand-teal/25 px-3 py-2 text-sm focus:border-brand-teal focus:outline-none";

export function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <Card>
        <p className="text-sm text-brand-ink">
          This reset link is missing its token. Please request a new one.
        </p>
        <p className="mt-4 text-sm text-brand-teal-light">
          <Link
            href="/forgot-password"
            className="font-medium text-brand-coral"
          >
            Request a reset link
          </Link>
        </p>
      </Card>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not reset your password.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  if (done) {
    return (
      <Card>
        <p className="text-sm text-brand-ink">
          Your password has been reset. Redirecting you to log in…
        </p>
        <p className="mt-4 text-sm text-brand-teal-light">
          <Link href="/login" className="font-medium text-brand-coral">
            Log in now
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm font-medium text-brand-ink">
          New password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={input}
          />
        </label>
        <label className="block text-sm font-medium text-brand-ink">
          Confirm new password
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={input}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className={buttonClass() + " w-full"}
        >
          {loading ? "Saving…" : "Set new password"}
        </button>
      </form>
    </Card>
  );
}
