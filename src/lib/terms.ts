import { prisma } from "@/lib/prisma";

// The waiver text a new install starts with; Admins replace it at /admin/terms,
// which publishes a new version and leaves earlier acceptances untouched.
export const DEFAULT_TERMS_VERSION = "v1";
export const DEFAULT_TERMS_BODY = `Ri'aya Parent Liability Waiver & Terms of Service

Ri'aya vets and lists babysitters as a scheduling and booking service. Sitters
are independent contractors, not employees or agents of Ri'aya. Vetting and
listing are not a guarantee of a sitter's conduct, and Ri'aya does not
supervise care provided in your home.

By confirming a booking you acknowledge that you engage the sitter at your own
risk, that you are responsible for evaluating the suitability of any sitter for
your family, and that Ri'aya's liability is limited to the fullest extent
permitted by law.`;

// Returns the active terms version, creating the default one on first use.
export async function getActiveTerms() {
  const existing = await prisma.termsVersion.findFirst({
    where: { active: true },
  });
  if (existing) return existing;
  return prisma.termsVersion.upsert({
    where: { version: DEFAULT_TERMS_VERSION },
    create: {
      version: DEFAULT_TERMS_VERSION,
      body: DEFAULT_TERMS_BODY,
      active: true,
    },
    update: { active: true },
  });
}
