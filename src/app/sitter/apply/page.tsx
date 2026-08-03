import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { submitApplication } from "@/lib/actions";
import { Card, PageTitle, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SitterApplyPage() {
  const user = await requireRole("SITTER");
  const app = await prisma.sitterApplication.findUnique({
    where: { userId: user.id },
  });
  if (app?.status === "VETTED") redirect("/sitter");

  const input =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle
        title="Sitter vetting application"
        subtitle="Tell us about yourself. Our team manually reviews every applicant — the pay rate you enter is a proposal; we set your listed rate when we vet you."
      />
      <Card>
        <form action={submitApplication} className="space-y-4">
          <label className="block text-sm font-medium">
            About you (bio)
            <textarea
              name="bio"
              required
              minLength={10}
              rows={3}
              defaultValue={app?.bio ?? ""}
              className={input}
            />
          </label>
          <label className="block text-sm font-medium">
            Childcare experience
            <textarea
              name="experience"
              required
              minLength={10}
              rows={3}
              defaultValue={app?.experience ?? ""}
              className={input}
            />
          </label>
          <label className="block text-sm font-medium">
            Certifications (one per line or comma-separated)
            <textarea
              name="certifications"
              rows={2}
              placeholder="CPR&#10;First Aid"
              defaultValue={app?.certifications.join("\n") ?? ""}
              className={input}
            />
          </label>
          <label className="block text-sm font-medium">
            Document links — CPR cert, police check, etc. (one URL per line)
            <textarea
              name="documentUrls"
              rows={2}
              placeholder="https://…"
              defaultValue={app?.documentUrls.join("\n") ?? ""}
              className={input}
            />
            <span className="mt-1 block text-xs text-slate-500">
              MVP: paste document URLs. Direct file upload is a later phase.
            </span>
          </label>
          <label className="block text-sm font-medium">
            Target hourly pay rate (CAD) — your proposal
            <input
              type="number"
              name="targetPayRate"
              required
              min={1}
              max={500}
              defaultValue={app?.targetPayRate ?? 20}
              className={input}
            />
          </label>
          <button type="submit" className={buttonClass()}>
            {app ? "Resubmit application" : "Submit application"}
          </button>
        </form>
      </Card>
    </div>
  );
}
