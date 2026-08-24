import { confirmNewsletterSubscription } from "@/lib/newsletter-actions";
import { Card, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

// Landing page for the double opt-in link. Opening the link is the consent
// event, so the confirmation happens here rather than behind another button.
export default async function NewsletterConfirmPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token?.trim();
  const email = token ? await confirmNewsletterSubscription(token) : null;

  return (
    <div className="mx-auto max-w-lg">
      <PageTitle
        title="Newsletter"
        subtitle="Ri'aya Babysitters news and availability updates"
      />
      <Card className="space-y-2">
        {email ? (
          <>
            <p className="text-sm text-slate-700">
              <strong>{email}</strong> is subscribed. Thanks — we&apos;ll email
              you news, availability and childcare tips.
            </p>
            <p className="text-xs text-slate-500">
              Every email carries an unsubscribe link, so you can stop them at
              any time.
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-600">
            This confirmation link isn&apos;t valid — it may already have been
            used. Sign up again from the bottom of any page and we&apos;ll send a
            fresh link.
          </p>
        )}
      </Card>
    </div>
  );
}
