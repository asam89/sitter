import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { SignupForm } from "./SignupForm";
import { PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const partners = await prisma.communityPartner.findMany({
    where: { status: "APPROVED" },
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" },
  });
  return (
    <div className="mx-auto max-w-lg">
      <PageTitle
        title="Create your CircleCare account"
        subtitle="Join through a community you already belong to."
      />
      <Suspense>
        <SignupForm partners={partners} />
      </Suspense>
    </div>
  );
}
