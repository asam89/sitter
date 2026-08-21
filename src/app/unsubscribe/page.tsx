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
  const user = token
    ? await prisma.user.findUnique({
        where: { unsubscribeToken: token },
        select: {
          email: true,
          newsletterOptIn: true,
          newsletterOptOutAt: true,
        },
      })
    : null;

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
        ) : !user.newsletterOptIn ? (
          <>
            <p className="text-sm text-slate-700">
              <strong>{user.email}</strong> is not subscribed to the Ri&apos;aya
              newsletter
              {user.newsletterOptOutAt
                ? ` (unsubscribed ${dt(user.newsletterOptOutAt)})`
                : ""}
              .
            </p>
            <p className="text-xs text-slate-500">
              You&apos;ll still get emails about your own account and bookings —
              those aren&apos;t marketing.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-700">
              <strong>{user.email}</strong> is subscribed to Ri&apos;aya news and
              updates.
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
