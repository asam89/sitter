import type { Metadata } from "next";
import { Suspense } from "react";
import { SignupForm } from "./SignupForm";
import { PageTitle } from "@/components/ui";

export const metadata: Metadata = {
  title: "Create an account",
  description:
    "Sign up as a parent to book vetted Ri'aya babysitters, or apply to join our team of sitters.",
  alternates: { canonical: "/signup" },
};

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/riaya-logo.png"
          alt="Ri'aya Babysitters Inc. logo"
          className="h-24 w-24 object-contain"
        />
      </div>
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
