import Link from "next/link";
import { requireRole } from "@/lib/session";
import { getSitterCards, getApprovedCommunityIds } from "@/lib/queries";
import {
  PageTitle,
  Card,
  TrustBadge,
  Badge,
  EmptyState,
  ButtonLink,
} from "@/components/ui";
import { moneyHr } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SittersPage({
  searchParams,
}: {
  searchParams: { communityOnly?: string };
}) {
  const user = await requireRole("PARENT");
  const communityOnly = searchParams.communityOnly === "1";
  const communityPartnerIds = await getApprovedCommunityIds(user.id);
  const sitters = await getSitterCards({ communityOnly, communityPartnerIds });

  return (
    <div className="space-y-6">
      <PageTitle
        title="Find a sitter"
        subtitle="Ranked by community endorsement first, then reviews."
      />

      <div className="flex gap-2">
        <Link
          href="/sitters"
          className={
            "rounded-lg px-3 py-1.5 text-sm font-semibold " +
            (!communityOnly
              ? "bg-indigo-600 text-white"
              : "border border-slate-300 text-slate-600")
          }
        >
          All trusted sitters
        </Link>
        <Link
          href="/sitters?communityOnly=1"
          className={
            "rounded-lg px-3 py-1.5 text-sm font-semibold " +
            (communityOnly
              ? "bg-indigo-600 text-white"
              : "border border-slate-300 text-slate-600")
          }
        >
          Only my community
        </Link>
      </div>

      {communityOnly && communityPartnerIds.length === 0 && (
        <EmptyState>
          You have no approved community affiliations yet, so no
          community-endorsed sitters can be shown.{" "}
          <Link href="/communities" className="font-medium text-indigo-600">
            Join a community
          </Link>
          .
        </EmptyState>
      )}

      {sitters.length === 0 ? (
        <EmptyState>No sitters match yet.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sitters.map((s) => (
            <Card key={s.userId} className="space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-sm text-slate-500">{s.city}</div>
                </div>
                <TrustBadge tier={s.tier} />
              </div>
              {s.bio && <p className="text-sm text-slate-600">{s.bio}</p>}
              <div className="flex flex-wrap gap-1">
                {s.endorsedBy.map((name) => (
                  <Badge key={name} color="green">
                    Endorsed · {name}
                  </Badge>
                ))}
                {s.languages.map((l) => (
                  <Badge key={l}>{l}</Badge>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 text-sm">
                <span className="font-semibold">{moneyHr(s.hourlyRate)}</span>
                <span className="text-slate-500">
                  {s.reviewCount > 0
                    ? `★ ${s.avgRating} (${s.reviewCount})`
                    : "No reviews yet"}
                  {s.isAvailableNow && " · Available now"}
                </span>
              </div>
              <ButtonLink href={`/parent/request?sitterId=${s.userId}`}>
                Book this sitter
              </ButtonLink>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
