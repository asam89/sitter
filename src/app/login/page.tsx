import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to your Ri'aya Babysitters account.",
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
