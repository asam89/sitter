"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, buttonClass } from "@/components/ui";

const input =
  "mt-1 w-full rounded-lg border border-brand-teal/25 px-3 py-2 text-sm focus:border-brand-teal focus:outline-none";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => {});
    setLoading(false);
    setSent(true);
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-ink">
          Reset your password
        </h1>
        <p className="mt-1 text-sm text-brand-teal-light">
          Enter your account email and we&apos;ll send you a link to set a new
          password.
        </p>
      </div>

      <Card>
        {sent ? (
          <div className="space-y-3">
            <p className="text-sm text-brand-ink">
              If an account exists for <strong>{email}</strong>, a reset link is
              on its way. The link expires in 60 minutes.
            </p>
            <p className="text-sm text-brand-teal-light">
              Didn&apos;t get it? Check your spam folder, or{" "}
              <button
                type="button"
                onClick={() => setSent(false)}
                className="font-medium text-brand-coral"
              >
                try again
              </button>
              .
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block text-sm font-medium text-brand-ink">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={input}
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className={buttonClass() + " w-full"}
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
        <p className="mt-4 text-sm text-brand-teal-light">
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-brand-coral">
            Back to log in
          </Link>
        </p>
      </Card>
    </div>
  );
}
