import { PageTitle, Card, ButtonLink } from "@/components/ui";

export default function ThanksPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageTitle title="Application received" />
      <Card className="space-y-4">
        <p className="text-slate-700">
          Thanks! Your Community Partner application is pending review by a
          CircleCare Platform Admin. Your admin account has been created — log in
          to access your dashboard once approved.
        </p>
        <ButtonLink href="/login">Log in</ButtonLink>
      </Card>
    </div>
  );
}
