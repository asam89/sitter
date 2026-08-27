import Link from "next/link";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { ReportProblem } from "@/components/ReportProblem";
import { getBusinessSettings } from "@/lib/settings";
import { supportEmail } from "@/lib/booking-reminders";

export async function Footer() {
  const support = supportEmail(await getBusinessSettings());
  return (
    <footer className="mt-12 border-t border-brand-teal/15 bg-white">
      <div className="mx-auto w-full max-w-5xl border-b border-brand-teal/10 px-4 py-6">
        <p className="text-sm font-semibold text-brand-ink">
          Ri&apos;aya newsletter
        </p>
        <p className="mb-3 text-xs text-brand-teal-light">
          News, sitter availability and childcare tips. Unsubscribe any time.
        </p>
        <div className="max-w-md">
          <NewsletterSignup source="footer" compact />
        </div>
      </div>
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
          <Link href="/policies" className="hover:text-brand-coral">
            Policies &amp; terms
          </Link>
          <Link href="/login" className="hover:text-brand-coral">
            Log in
          </Link>
          <Link href="/signup" className="hover:text-brand-coral">
            Sign up
          </Link>
          <a href={`mailto:${support}`} className="hover:text-brand-coral">
            {support}
          </a>
          <ReportProblem />
          <span className="text-brand-teal-light">
            © {new Date().getFullYear()} Ri&apos;aya Babysitters Inc.
          </span>
        </nav>
      </div>
    </footer>
  );
}
