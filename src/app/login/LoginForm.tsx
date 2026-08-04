"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, buttonClass } from "@/components/ui";

type RoleKey = "PARENT" | "SITTER" | "ADMIN";

const ROLES: {
  key: RoleKey;
  label: string;
  tagline: string;
}[] = [
  {
    key: "PARENT",
    label: "Parent",
    tagline: "Book a vetted sitter for your family.",
  },
  {
    key: "SITTER",
    label: "Babysitter",
    tagline: "Manage your availability and bookings.",
  },
  {
    key: "ADMIN",
    label: "Admin",
    tagline: "Vet applicants and oversee the platform.",
  },
];

const PEACE_OF_MIND: Record<RoleKey, string[]> = {
  PARENT: [
    "Every sitter is manually vetted and hand-listed by our team — you only ever see people we've cleared.",
    "A liability waiver and clear, itemised pricing are shown on every single booking before you confirm.",
    "Message your sitter securely in-app once a booking is made — no phone numbers exchanged.",
    "We never collect your child's full legal name or photo. Age range and count only.",
  ],
  SITTER: [
    "Set your own availability — parents can only book the slots you open.",
    "Get paid securely; payouts release after each booking is completed.",
    "Your listing is managed with you by the Ri'aya team.",
  ],
  ADMIN: [
    "Review and vet every babysitter applicant.",
    "Control which vetted sitters are listed and bookable.",
    "Oversee bookings, pricing, and incident reports.",
  ],
};

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialRole = (params.get("role") as RoleKey) || "PARENT";
  const [role, setRole] = useState<RoleKey>(
    ["PARENT", "SITTER", "ADMIN"].includes(initialRole)
      ? initialRole
      : "PARENT",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const active = ROLES.find((r) => r.key === role)!;
  const input =
    "mt-1 w-full rounded-lg border border-brand-teal/25 px-3 py-2 text-sm focus:border-brand-teal focus:outline-none";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-ink">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-brand-teal-light">
          Log in to Ri&apos;aya Babysitters — {active.tagline}
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Choose your account type"
        className="grid grid-cols-3 gap-2 rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-brand-teal/10"
      >
        {ROLES.map((r) => (
          <button
            key={r.key}
            type="button"
            role="tab"
            aria-selected={role === r.key}
            onClick={() => setRole(r.key)}
            className={
              role === r.key
                ? "rounded-lg bg-brand-teal px-3 py-2 text-sm font-semibold text-white"
                : "rounded-lg px-3 py-2 text-sm font-medium text-brand-teal hover:bg-brand-cream"
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      <Card>
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
          <label className="block text-sm font-medium text-brand-ink">
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={input}
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className={buttonClass() + " w-full"}
          >
            {loading ? "Logging in…" : `Log in as ${active.label}`}
          </button>
        </form>
        <p className="mt-4 text-sm text-brand-teal-light">
          New here?{" "}
          <Link
            href={`/signup?role=${role}`}
            className="font-medium text-brand-coral"
          >
            Create an account
          </Link>
        </p>
      </Card>

      <div className="rounded-xl border border-brand-teal/15 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand-coral" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-ink">
            {role === "PARENT" ? "Your peace of mind" : "What you get"}
          </h2>
        </div>
        <ul className="mt-3 space-y-2">
          {PEACE_OF_MIND[role].map((line) => (
            <li key={line} className="flex gap-2 text-sm text-brand-teal-light">
              <span
                aria-hidden
                className="mt-0.5 select-none font-bold text-brand-teal"
              >
                ✓
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
