import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
