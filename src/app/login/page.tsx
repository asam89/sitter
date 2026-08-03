import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { PageTitle } from "@/components/ui";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md">
      <PageTitle title="Log in" />
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
