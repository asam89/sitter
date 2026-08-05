import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-12 border-t border-brand-teal/15 bg-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 px-4 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/riaya-logo.png"
            alt="Ri'aya Babysitters Inc. logo"
            className="h-14 w-14 rounded-full object-contain"
          />
          <div>
            <p className="font-semibold text-brand-ink">
              Ri&apos;aya Babysitters Inc.
            </p>
            <p className="text-xs text-brand-teal-light">
              Vetted babysitters, booked with peace of mind.
            </p>
          </div>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-4 text-sm text-brand-teal">
          <Link href="/team" className="hover:text-brand-coral">
            Our team
          </Link>
          <Link href="/login" className="hover:text-brand-coral">
            Log in
          </Link>
          <Link href="/signup" className="hover:text-brand-coral">
            Sign up
          </Link>
          <span className="text-brand-teal-light">
            © {new Date().getFullYear()} Ri&apos;aya Babysitters Inc.
          </span>
        </nav>
      </div>
    </footer>
  );
}
