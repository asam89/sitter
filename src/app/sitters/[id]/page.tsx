import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { moneyHr } from "@/lib/format";
import { effectiveRate } from "@/lib/pricing";
import { CHECK_TYPE_LABEL, screeningState } from "@/lib/screening";
import { getBusinessSettings } from "@/lib/settings";
import { supportEmail } from "@/lib/booking-reminders";
import { firstName, isShareable, sitterSharePath } from "@/lib/public-sitter";
import { OG_IMAGE_PATH, SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

// Checks a family may see by type only: never the document, issuer or dates.
const PUBLIC_CHECKS = [
  "VULNERABLE_SECTOR",
  "POLICE_RECORD",
  "CPR",
  "FIRST_AID",
] as const;

const loadSitter = cache(async (id: string) => {
  const sp = await prisma.sitterProfile.findUnique({
    where: { id },
    select: {
      id: true,
      bio: true,
      city: true,
      photoPath: true,
      isListed: true,
      listedPayRate: true,
      baseRate: true,
      vettedAt: true,
      userId: true,
      user: { select: { name: true, suspended: true } },
    },
  });
  return sp && isShareable(sp) ? sp : null;
});

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const sp = await loadSitter(params.id);
  if (!sp) return { robots: { index: false, follow: false } };
  const title = `${sp.user.name}, Ri'aya babysitter`;
  const description =
    sp.bio?.slice(0, 160) ??
    `${firstName(sp.user.name)} is interviewed and vetted by Ri'aya Babysitters.`;
  const image = sp.photoPath ? `/api/sitter/${sp.id}/photo` : OG_IMAGE_PATH;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    alternates: { canonical: sitterSharePath(sp.id) },
    openGraph: {
      type: "profile",
      siteName: SITE_NAME,
      title,
      description,
      url: sitterSharePath(sp.id),
      images: [{ url: image }],
    },
    twitter: {
      card: sp.photoPath ? "summary" : "summary_large_image",
      title,
      description,
    },
  };
}

export default async function SitterPublicProfile({
  params,
}: {
  params: { id: string };
}) {
  const sp = await loadSitter(params.id);
  if (!sp) notFound();

  const now = new Date();
  const [checks, reviews, openSlot, settings] = await Promise.all([
    prisma.sitterScreening.findMany({
      where: {
        sitterUserId: sp.userId,
        status: "VERIFIED",
        checkType: { in: [...PUBLIC_CHECKS] },
      },
      select: { checkType: true, status: true, renewBy: true },
    }),
    prisma.review.findMany({
      where: { subjectId: sp.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        rating: true,
        comment: true,
        author: { select: { name: true } },
      },
    }),
    prisma.availabilitySlot.findFirst({
      where: {
        sitterProfileId: sp.id,
        status: "OPEN",
        startTime: { gte: now },
      },
      select: { id: true },
    }),
    getBusinessSettings(),
  ]);

  const verified = PUBLIC_CHECKS.filter((t) =>
    checks.some((c) => c.checkType === t && screeningState(c, now).current),
  );
  const avg =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : null;
  const first = firstName(sp.user.name);
  const email = supportEmail(settings);
  const since = sp.vettedAt.toLocaleDateString("en-CA", {
    month: "long",
    year: "numeric",
    timeZone: "America/Toronto",
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="text-center">
        {sp.photoPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/sitter/${sp.id}/photo`}
            alt={`${sp.user.name}, Ri'aya babysitter`}
            className="mx-auto h-32 w-32 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-brand-teal text-4xl font-semibold text-white"
          >
            {first.charAt(0).toUpperCase()}
          </span>
        )}
        <h1 className="mt-4 text-2xl font-bold text-brand-ink">
          {sp.user.name}
        </h1>
        <p className="text-sm text-brand-teal-light">
          Ri&apos;aya babysitter{sp.city ? ` · ${sp.city}` : ""} · vetted since{" "}
          {since}
        </p>
        <p className="mt-2 text-lg font-semibold text-brand-ink">
          {moneyHr(effectiveRate(sp))}
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Badge color="green">Interviewed by Ri&apos;aya</Badge>
          {verified.map((t) => (
            <Badge key={t} color="green">
              {CHECK_TYPE_LABEL[t]} verified
            </Badge>
          ))}
          {avg !== null && (
            <Badge color="indigo">
              {avg.toFixed(1)}★ from {reviews.length} famil
              {reviews.length === 1 ? "y" : "ies"}
            </Badge>
          )}
        </div>
      </Card>

      {sp.bio && (
        <Card>
          <h2 className="mb-2 font-semibold">About {first}</h2>
          <p className="whitespace-pre-line text-sm text-slate-700">{sp.bio}</p>
        </Card>
      )}

      {reviews.some((r) => r.comment) && (
        <Card>
          <h2 className="mb-2 font-semibold">What families say</h2>
          <ul className="space-y-3">
            {reviews
              .filter((r) => r.comment)
              .map((r) => (
                <li key={r.id} className="text-sm text-slate-700">
                  <span className="font-medium">{r.rating}★</span> &ldquo;
                  {r.comment}
                  &rdquo;{" "}
                  <span className="text-slate-500">
                    · {firstName(r.author.name)}
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      )}

      <Card className="space-y-3 text-center">
        <p className="text-sm text-slate-700">
          {openSlot
            ? `${first} has open times coming up. Sign in to see them and book.`
            : `${first} has no open times right now. Post a request and we'll find you a sitter.`}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <ButtonLink
            href={openSlot ? "/parent/schedule" : "/parent/requests/new"}
          >
            {openSlot ? `Book ${first}` : "Request a sitter"}
          </ButtonLink>
          <ButtonLink href="/signup" variant="secondary">
            New to Ri&apos;aya? Sign up
          </ButtonLink>
        </div>
        <p className="text-xs text-slate-500">
          Want to meet {first} before booking? Email{" "}
          <a href={`mailto:${email}`} className="font-medium text-brand-coral">
            {email}
          </a>{" "}
          and we&apos;ll set it up.
        </p>
      </Card>
    </div>
  );
}
