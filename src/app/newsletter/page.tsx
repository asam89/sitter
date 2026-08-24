import { NewsletterSignup } from "@/components/NewsletterSignup";
import { Card, PageTitle } from "@/components/ui";

// Landing page for the subscribe links we put in emails, so the call to action
// always ends in an explicit sign-up rather than an automatic subscription.
export default function NewsletterPage() {
  return (
    <div className="mx-auto max-w-lg">
      <PageTitle
        title="Ri'aya newsletter"
        subtitle="Sitter availability, new-sitter announcements and childcare tips."
      />
      <Card className="space-y-3">
        <NewsletterSignup source="email" />
        <p className="text-xs text-slate-500">
          We&apos;ll email you a confirmation link first, and every issue carries
          an unsubscribe link.
        </p>
      </Card>
    </div>
  );
}
