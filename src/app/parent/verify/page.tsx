import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getBusinessSettings } from "@/lib/settings";
import { Card, PageTitle } from "@/components/ui";
import { LEVEL_LABEL, meetsLevel } from "@/lib/verification";
import { VerifyClient } from "./VerifyClient";

export const dynamic = "force-dynamic";

export default async function ParentVerifyPage() {
  const sessionUser = await requireRole("PARENT");
  const [user, settings] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: sessionUser.id },
      include: {
        parentProfile: {
          include: {
            idDocs: {
              where: { reviewStatus: "PENDING" },
              take: 1,
            },
          },
        },
      },
    }),
    getBusinessSettings(),
  ]);

  const profile = user.parentProfile;
  const required = settings.minParentVerificationLevelToBook;
  const canBook = meetsLevel(user.verificationLevel, required);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageTitle
        title="Verify your account"
        subtitle="A few quick checks keep every family and sitter on Ri'aya accountable and safe."
      />

      <Card className="bg-brand-teal text-white">
        <p className="text-sm">
          Your status:{" "}
          <span className="font-semibold">
            {LEVEL_LABEL[user.verificationLevel]}
          </span>
        </p>
        <p className="mt-1 text-sm text-brand-blue-light">
          {canBook
            ? "You're verified and can book sitters."
            : `Reach ${LEVEL_LABEL[required]} to unlock booking.`}
        </p>
      </Card>

      <VerifyClient
        email={user.email}
        emailVerified={Boolean(user.emailVerified)}
        phone={user.phone ?? ""}
        phoneVerified={user.phoneVerified}
        addressOnFile={Boolean(
          profile?.streetAddress && profile?.postalCode && profile?.province,
        )}
        address={{
          streetAddress: profile?.streetAddress ?? "",
          unit: profile?.unit ?? "",
          city: profile?.city ?? "",
          province: profile?.province ?? "",
          postalCode: profile?.postalCode ?? "",
        }}
        identityVerified={Boolean(profile?.identityVerified)}
        idPendingReview={(profile?.idDocs.length ?? 0) > 0}
        requireIdentity={required === "LEVEL_2_IDENTITY"}
      />
    </div>
  );
}
