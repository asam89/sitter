import { Suspense } from "react";
import { SignupForm } from "./SignupForm";
import { PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-lg">
      <PageTitle
        title="Create your Ri'aya account"
        subtitle="Parents book instantly. Sitters apply to be vetted and listed."
      />
      <Suspense>
        <SignupForm />
      </Suspense>
    </div>
  );
}
