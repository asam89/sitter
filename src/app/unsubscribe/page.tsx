import { prisma } from "@/lib/prisma";
import { unsubscribeFromNewsletter } from "@/lib/consent-actions";
import { ActionButton } from "@/components/ActionButton";
import { Card, PageTitle } from "@/components/ui";
import { dt } from "@/lib/format";

export const dynamic = "force-dynamic";

// One-click-style opt-out reachable from any marketing email. The token is
// opaque and per-user, so no login is needed; the opt-out itself is a POST
// (server action) so link scanners can't unsubscribe someone by prefetching.
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token?.trim();
  // The token belongs either to an account or to a public subscriber who never
  // registered; both are presented the same way.
  const [account, subscriber] = token
    ? await Promise.all([
        prisma.user.findUnique({
          where: { unsubscribeToken: token },
          select: {
            email: true,
            newsletterOptIn: true,
            newsletterOptOutAt: true,
          },
        }),
        prisma.newsletterSubscriber.findUnique({
          where: { unsubscribeToken: token },
          select: { email: true, unsubscribedAt: true },
        }),
      ])
    : [null, null];
  const user =
    account ??
    (subscriber
      ? {
          email: subscriber.email,
          newsletterOptIn: true,
          newsletterOptOutAt: subscriber.unsubscribedAt,
        }
      : null);

  return (
    <div className="mx-auto max-w-lg">
      <PageTitle
        title="Email preferences"
        subtitle="Ri'aya Babysitters newsletter"
      />
      <Card className="space-y-3">
        {!user ? (
          <p className="text-sm text-slate-600">
            This unsubscribe link isn&apos;t valid. It may have already been
            used, or the address was removed. Reply to any Ri&apos;aya email and
            we&apos;ll take you off the list.
          </p>
        ) : user.newsletterOptOutAt ? (
          <>
            <p className="text-sm text-slate-700">
              <strong>{user.email}</strong> is unsubscribed from Ri&apos;aya
              marketing email (as of {dt(user.newsletterOptOutAt)}).
            </p>
            <p className="text-xs text-slate-500">
              You&apos;ll still get emails about your own account and bookings —
              those aren&apos;t marketing.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-700">
              <strong>{user.email}</strong> can currently receive Ri&apos;aya news
              and updates
              {user.newsletterOptIn
                ? " — you asked us to email you these"
                : " — because you have an account with us"}
              .
            </p>
            <ActionButton
              action={unsubscribeFromNewsletter.bind(null, token as string)}
            >
              Unsubscribe me
            </ActionButton>
            <p className="text-xs text-slate-500">
              Emails about your own account and bookings will keep coming —
              those aren&apos;t marketing.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
