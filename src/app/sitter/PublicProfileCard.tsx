"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, buttonClass } from "@/components/ui";
import {
  updateSitterPublicProfile,
  uploadSitterPhoto,
  removeSitterPhoto,
} from "@/lib/sitter-profile-actions";

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

export function PublicProfileCard({
  profileId,
  bio,
  publicOptIn,
  hasPhoto,
  showcased,
}: {
  profileId: string;
  bio: string;
  publicOptIn: boolean;
  hasPhoto: boolean;
  showcased: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Cache-bust the photo preview after an upload/removal.
  const [ver, setVer] = useState(0);

  const photoSrc = `/api/sitter/${profileId}/photo?v=${ver}`;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Your public profile</h2>
        {publicOptIn ? (
          showcased ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
              Live on Meet our team
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              Opted in — awaiting Ri&apos;aya approval
            </span>
          )
        ) : (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            Not shown publicly
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Add a friendly photo and short bio. If you opt in, our team may feature
        you on the public{" "}
        <a href="/team" className="font-medium text-brand-coral">
          Meet our team
        </a>{" "}
        page (after a quick review).
      </p>

      {/* Photo */}
      <div className="mt-4 flex items-center gap-4">
        {hasPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoSrc}
            alt="Your profile photo"
            className="h-20 w-20 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-cream text-xs text-brand-teal-light">
            No photo
          </span>
        )}
        <div className="flex flex-col gap-2">
          <input
            ref={fileRef}
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp"
            className="text-sm"
            onChange={() => {
              const f = fileRef.current?.files?.[0];
              if (!f) return;
              start(async () => {
                setErr(null);
                setMsg(null);
                const fd = new FormData();
                fd.set("photo", f);
                const r = await uploadSitterPhoto(fd);
                if (!r.ok) setErr(r.error ?? "Could not upload photo.");
                else {
                  setMsg("Photo updated.");
                  setVer((v) => v + 1);
                  router.refresh();
                }
                if (fileRef.current) fileRef.current.value = "";
              });
            }}
          />
          {hasPhoto && (
            <button
              type="button"
              disabled={pending}
              className={buttonClass("secondary") + " w-fit text-xs"}
              onClick={() =>
                start(async () => {
                  setErr(null);
                  setMsg(null);
                  const r = await removeSitterPhoto();
                  if (!r.ok) setErr(r.error ?? "Could not remove photo.");
                  else {
                    setMsg("Photo removed.");
                    setVer((v) => v + 1);
                    router.refresh();
                  }
                })
              }
            >
              Remove photo
            </button>
          )}
        </div>
      </div>

      {/* Bio + opt-in */}
      <form
        className="mt-4 space-y-3"
        action={(fd) =>
          start(async () => {
            setErr(null);
            setMsg(null);
            const r = await updateSitterPublicProfile(fd);
            if (!r.ok) setErr(r.error ?? "Could not save.");
            else {
              setMsg("Profile saved.");
              router.refresh();
            }
          })
        }
      >
        <label className="block text-sm font-medium">
          Public bio
          <textarea
            name="bio"
            rows={4}
            maxLength={1000}
            defaultValue={bio}
            placeholder="Tell families a little about yourself — experience, what you love about caring for kids, languages you speak…"
            className={inputCls}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="publicOptIn"
            defaultChecked={publicOptIn}
            className="h-4 w-4 rounded border-slate-300"
          />
          Show my photo &amp; bio on the public Meet our team page
        </label>
        {err && <p className="text-sm text-red-600">{err}</p>}
        {msg && <p className="text-sm text-emerald-700">{msg}</p>}
        <button className={buttonClass()} disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </button>
      </form>
    </Card>
  );
}
