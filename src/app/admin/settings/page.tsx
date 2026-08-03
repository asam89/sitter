import { requireRole } from "@/lib/session";
import { getBusinessSettings } from "@/lib/settings";
import { updateSettings } from "@/lib/actions";
import { Card, PageTitle, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireRole("ADMIN");
  const s = await getBusinessSettings();

  const input =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
  const feeOptions = (["PERCENT", "FLAT"] as const).map((v) => (
    <option key={v} value={v}>
      {v === "PERCENT" ? "Percent of base" : "Flat amount (CAD)"}
    </option>
  ));

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageTitle
        title="Business rules"
        subtitle="Configure last-minute threshold, rush fee and platform fee. Existing bookings keep their original pricing snapshot."
      />
      <Card>
        <form action={updateSettings} className="space-y-5">
          <label className="block text-sm font-medium">
            Last-minute threshold (hours before start)
            <input
              type="number"
              name="lastMinuteThresholdHours"
              min={0}
              max={168}
              defaultValue={s.lastMinuteThresholdHours}
              className={input}
            />
          </label>

          <fieldset className="rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-sm font-semibold">Rush fee</legend>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">
                Type
                <select
                  name="rushFeeType"
                  defaultValue={s.rushFeeType}
                  className={input}
                >
                  {feeOptions}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Amount
                <input
                  type="number"
                  name="rushFeeAmount"
                  min={0}
                  defaultValue={s.rushFeeAmount}
                  className={input}
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-sm font-semibold">Platform fee</legend>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">
                Type
                <select
                  name="platformFeeType"
                  defaultValue={s.platformFeeType}
                  className={input}
                >
                  {feeOptions}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Amount
                <input
                  type="number"
                  name="platformFeeAmount"
                  min={0}
                  defaultValue={s.platformFeeAmount}
                  className={input}
                />
              </label>
            </div>
          </fieldset>

          <button type="submit" className={buttonClass()}>
            Save business rules
          </button>
        </form>
      </Card>
    </div>
  );
}
