import Link from "next/link";
import { getSession } from "@/lib/session";
import { SignOutButton } from "@/components/SignOutButton";

const ROLE_HOME: Record<string, string> = {
  PARENT: "/parent",
  SITTER: "/sitter",
  ADMIN: "/admin",
};

export async function Navbar() {
  const session = await getSession();
  const role = session?.user?.role;
  return (
    <header className="border-b border-brand-teal/15 bg-white">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold text-brand-ink"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/riaya-logo.png"
            alt="Ri'aya Babysitters Inc. logo"
            className="h-9 w-9 rounded-full object-contain"
          />
          Ri&apos;aya Babysitters
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/team"
            className="hidden font-medium text-brand-teal hover:text-brand-coral sm:inline"
          >
            Our team
          </Link>
          {session?.user ? (
            <>
              <Link
                href={role ? ROLE_HOME[role] : "/"}
                className="font-medium text-brand-teal hover:text-brand-coral"
              >
                Dashboard
              </Link>
              <span className="hidden text-slate-400 sm:inline">
                {session.user.name} · {role}
              </span>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="font-medium text-brand-teal hover:text-brand-coral"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-brand-coral px-3 py-1.5 font-semibold text-white hover:bg-brand-coral-dark"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
