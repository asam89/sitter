import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { requireRole, requireUser } from "@/lib/session";
import { submitApplication } from "@/lib/actions";
import { Card, PageTitle, buttonClass } from "@/components/ui";
import { ApplyForm } from "./ApplyForm";

export const dynamic = "force-dynamic";

export default async function SitterApplyPage() {
  // A parent landing here used to be bounced to the home page with no
  // explanation; tell them what to do instead.
  const viewer = await requireUser();
  if (viewer.role !== "SITTER") {
    if (viewer.role === "ADMIN") redirect("/admin/applications");
    return (
      <div className="mx-auto max-w-2xl">
        <PageTitle
          title="Applying as a sitter"
          subtitle="This account is registered as a parent, so it can't hold a sitter application."
        />
        <Card>
          <p className="text-sm text-slate-600">
            Sitter applications live on a sitter account. Sign up as a sitter
            with a different email address and the application form opens right
            after — or email us and we&apos;ll set it up for you.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/signup?role=SITTER" className={buttonClass()}>
              Create a sitter account
            </Link>
            <a
              href="mailto:info@riaya.ca?subject=I%20want%20to%20apply%20as%20a%20sitter"
              className={buttonClass("secondary")}
            >
              Email info@riaya.ca
            </a>
          </div>
        </Card>
      </div>
    );
  }

  const user = await requireRole("SITTER");
  const app = await prisma.sitterApplication.findUnique({
    where: { userId: user.id },
  });
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { phone: true },
  });
  if (app?.status === "VETTED") redirect("/sitter");

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle
        title="Sitter vetting application"
        subtitle="Tell us about yourself. Our team manually reviews every applicant and holds a short interview before vetting — the pay rate you enter is a proposal; we set your listed rate when we vet you."
      />
      <ApplyForm
        action={submitApplication}
        application={app}
        accountPhone={account?.phone ?? null}
        interviewPending={app?.status === "INTERVIEW"}
      />
    </div>
  );
}
