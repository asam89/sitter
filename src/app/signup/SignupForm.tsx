"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, buttonClass } from "@/components/ui";

export function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialRole = params.get("role") === "SITTER" ? "SITTER" : "PARENT";

  const [role, setRole] = useState<"PARENT" | "SITTER">(initialRole);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    city: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, role }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      setLoading(false);
      return;
    }
    await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });
    setLoading(false);
    // Sitters land on their dashboard, which prompts them to apply.
    router.push(role === "SITTER" ? "/sitter" : "/parent");
    router.refresh();
  }

  const input =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(["PARENT", "SITTER"] as const).map((r) => (
            <button
              type="button"
              key={r}
              onClick={() => setRole(r)}
              className={
                "rounded-lg border px-3 py-2 text-sm font-semibold " +
                (role === r
                  ? "border-brand-teal bg-brand-cream text-brand-teal"
                  : "border-slate-300 text-slate-600")
              }
            >
              I&apos;m a {r === "PARENT" ? "Parent" : "Sitter"}
            </button>
          ))}
        </div>

        {role === "SITTER" && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            After signing up you&apos;ll complete a vetting application. The
            Ri&apos;aya team reviews every applicant before you can be listed and
            booked.
          </p>
        )}

        <label className="block text-sm font-medium">
          Full name
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={input}
          />
        </label>
        <label className="block text-sm font-medium">
          Email
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={input}
          />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className={input}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            Phone
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={input}
            />
          </label>
          <label className="block text-sm font-medium">
            City
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className={input}
            />
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className={buttonClass()}>
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
    </Card>
  );
}
