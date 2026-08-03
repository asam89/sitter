import { requireRole } from "@/lib/session";
import { getAllSettings } from "@/lib/settings";
import { PageTitle, Card, buttonClass } from "@/components/ui";
import { updateSettings } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireRole("PLATFORM_ADMIN");
  const settings = await getAllSettings();
  const input =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageTitle
        title="Platform settings"
        subtitle="These values are configurable, not hardcoded."
      />
      <Card>
        <form action={updateSettings} className="space-y-4">
          <label className="block text-sm font-medium">
            Platform fee (%)
            <input
              type="number"
              name="platformFeePct"
              min={0}
              max={100}
              step="0.5"
              defaultValue={settings.platformFeePct}
              className={input}
            />
            <span className="mt-1 block text-xs text-slate-500">
              Added transparently as a line item on every booking.
            </span>
          </label>
          <label className="block text-sm font-medium">
            Dispatch fallback window (seconds)
            <input
              type="number"
              name="dispatchWindowSeconds"
              min={30}
              max={3600}
              defaultValue={settings.dispatchWindowSeconds}
              className={input}
            />
            <span className="mt-1 block text-xs text-slate-500">
              How long community-endorsed sitters get first dibs before
              platform-verified sitters are included.
            </span>
          </label>
          <button type="submit" className={buttonClass()}>
            Save settings
          </button>
        </form>
      </Card>
    </div>
  );
}
