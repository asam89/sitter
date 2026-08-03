import { prisma } from "@/lib/prisma";

// Placeholder waiver copy. The real text must be lawyer-drafted; the app only
// builds the acceptance mechanism (version + timestamp).
export const PLACEHOLDER_TERMS_VERSION = "v0-draft";
export const PLACEHOLDER_TERMS_BODY = `[PENDING LEGAL REVIEW]

Sitbaby Parent Liability Waiver & Terms of Service (DRAFT)

Sitbaby vets and lists babysitters as a scheduling and booking service. Sitters
are independent contractors, not employees or agents of Sitbaby. Vetting and
listing are not a guarantee of a sitter's conduct, and Sitbaby does not
supervise care provided in your home.

By confirming a booking you acknowledge that you engage the sitter at your own
risk, that you are responsible for evaluating the suitability of any sitter for
your family, and that Sitbaby's liability is limited to the fullest extent
permitted by law.

[This placeholder must be replaced with lawyer-drafted language before launch.]`;

// Returns the active terms version, creating the placeholder on first use.
export async function getActiveTerms() {
  const existing = await prisma.termsVersion.findFirst({
    where: { active: true },
  });
  if (existing) return existing;
  return prisma.termsVersion.upsert({
    where: { version: PLACEHOLDER_TERMS_VERSION },
    create: {
      version: PLACEHOLDER_TERMS_VERSION,
      body: PLACEHOLDER_TERMS_BODY,
      active: true,
    },
    update: { active: true },
  });
}
