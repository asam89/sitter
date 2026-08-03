"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, buttonClass } from "@/components/ui";

type Partner = { id: string; name: string; type: string };

export function SignupForm({ partners }: { partners: Partner[] }) {
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
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggle(id: string) {
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, role, communityPartnerIds: selected }),
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
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                  : "border-slate-300 text-slate-600")
              }
            >
              I&apos;m a {r === "PARENT" ? "Parent" : "Sitter"}
            </button>
          ))}
        </div>

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

        <fieldset>
          <legend className="text-sm font-medium">
            Community affiliation{role === "SITTER" ? " (supports endorsement)" : ""}
          </legend>
          <p className="mb-2 text-xs text-slate-500">
            Optional — you can join without a community affiliation.
          </p>
          <div className="space-y-2">
            {partners.length === 0 && (
              <p className="text-xs text-slate-500">
                No community partners onboarded yet.
              </p>
            )}
            {partners.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={() => toggle(p.id)}
                />
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-slate-400">{p.type}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className={buttonClass()}>
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
    </Card>
  );
}
