"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui";
import { SitterAboutFields } from "@/components/SitterAboutFields";
import { adminUpdateSitterAbout } from "@/lib/sitter-profile-actions";
import { runAction } from "@/lib/run-action";
import type { SitterAbout } from "@/lib/sitter-about";

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

export function AboutForm({
  profileId,
  bio,
  about,
}: {
  profileId: string;
  bio: string;
  about: SitterAbout;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      action={(fd) =>
        start(async () => {
          setErr(null);
          setMsg(null);
          const r = await runAction(() => adminUpdateSitterAbout(profileId, fd));
          if (!r.ok) setErr(r.error ?? "Could not save.");
          else {
            setMsg("Saved. Parents see this on her profile now.");
            router.refresh();
          }
        })
      }
    >
      <label className="block text-sm font-medium">
        Bio
        <textarea
          name="bio"
          rows={4}
          maxLength={1000}
          defaultValue={bio}
          className={inputCls}
        />
      </label>
      <SitterAboutFields about={about} />
      {err && <p className="text-sm text-red-600">{err}</p>}
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      <button className={buttonClass()} disabled={pending}>
        {pending ? "Saving…" : "Save profile details"}
      </button>
    </form>
  );
}
