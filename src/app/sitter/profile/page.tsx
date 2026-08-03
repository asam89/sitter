import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageTitle, Card, buttonClass } from "@/components/ui";
import { updateSitterProfile } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function SitterProfilePage() {
  const user = await requireRole("SITTER");
  const p = await prisma.sitterProfile.findUniqueOrThrow({
    where: { userId: user.id },
  });
  const input =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageTitle title="Your sitter profile" />
      <Card>
        <form action={updateSitterProfile} className="space-y-4">
          <label className="block text-sm font-medium">
            Bio
            <textarea
              name="bio"
              defaultValue={p.bio ?? ""}
              rows={4}
              className={input}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">
              Hourly rate (CAD)
              <input
                type="number"
                name="hourlyRate"
                min={1}
                defaultValue={p.hourlyRate}
                className={input}
              />
            </label>
            <label className="block text-sm font-medium">
              Service radius (km)
              <input
                type="number"
                name="serviceRadiusKm"
                min={1}
                defaultValue={p.serviceRadiusKm}
                className={input}
              />
            </label>
          </div>
          <label className="block text-sm font-medium">
            City
            <input name="city" defaultValue={p.city ?? ""} className={input} />
          </label>
          <label className="block text-sm font-medium">
            Languages (comma-separated)
            <input
              name="languages"
              defaultValue={p.languages.join(", ")}
              className={input}
            />
          </label>
          <label className="block text-sm font-medium">
            Certifications (comma-separated)
            <input
              name="certifications"
              defaultValue={p.certifications.join(", ")}
              className={input}
            />
          </label>
          <button type="submit" className={buttonClass()}>
            Save profile
          </button>
        </form>
      </Card>
    </div>
  );
}
