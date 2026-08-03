import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageTitle, Card, Badge, buttonClass } from "@/components/ui";
import { addVerificationDocument } from "@/lib/actions";

export const dynamic = "force-dynamic";

const DOC_LABEL: Record<string, string> = {
  ID: "Government ID",
  BACKGROUND_CHECK: "Background check",
  CERTIFICATION: "Certification (e.g. First Aid)",
};

export default async function VerificationPage() {
  const user = await requireRole("SITTER");
  const profile = await prisma.sitterProfile.findUniqueOrThrow({
    where: { userId: user.id },
    include: { documents: { orderBy: { createdAt: "desc" } } },
  });
  const input =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageTitle
        title="Verification documents"
        subtitle="Uploaded documents are manually reviewed by a Platform Admin. Approval marks you Platform Verified (community endorsement ranks higher)."
      />
      <Card>
        <div className="mb-3 text-sm">
          Status:{" "}
          <Badge
            color={
              profile.verificationStatus === "PLATFORM_VERIFIED"
                ? "green"
                : "amber"
            }
          >
            {profile.verificationStatus}
          </Badge>
        </div>
        <form action={addVerificationDocument} className="space-y-3">
          <label className="block text-sm font-medium">
            Document type
            <select name="type" className={input}>
              {Object.entries(DOC_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Document URL
            <input
              name="fileUrl"
              required
              placeholder="https://…"
              className={input}
            />
            <span className="mt-1 block text-xs text-slate-500">
              MVP: paste a link to your document (file upload storage is a later
              phase).
            </span>
          </label>
          <button type="submit" className={buttonClass()}>
            Submit document
          </button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Submitted documents</h2>
        {profile.documents.length === 0 ? (
          <p className="text-sm text-slate-500">None yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {profile.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between">
                <span>{DOC_LABEL[d.type]}</span>
                <Badge
                  color={
                    d.reviewStatus === "APPROVED"
                      ? "green"
                      : d.reviewStatus === "REJECTED"
                        ? "red"
                        : "amber"
                  }
                >
                  {d.reviewStatus}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
