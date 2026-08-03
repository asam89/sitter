import Link from "next/link";
import { getSession } from "@/lib/session";
import { SignOutButton } from "@/components/SignOutButton";

const ROLE_HOME: Record<string, string> = {
  PARENT: "/parent",
  SITTER: "/sitter",
  COMMUNITY_ADMIN: "/community",
  PLATFORM_ADMIN: "/admin",
};

export async function Navbar() {
  const session = await getSession();
  const role = session?.user?.role;
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="inline-block h-6 w-6 rounded-full bg-indigo-600" />
          CircleCare
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {session?.user ? (
            <>
              <Link
                href={role ? ROLE_HOME[role] : "/"}
                className="font-medium text-slate-700 hover:text-indigo-600"
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
                className="font-medium text-slate-700 hover:text-indigo-600"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 font-semibold text-white hover:bg-indigo-700"
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
