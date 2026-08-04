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

          <fieldset className="rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-sm font-semibold">
              Parent verification gate
            </legend>
            <label className="block text-sm font-medium">
              Minimum level required to book
              <select
                name="minParentVerificationLevelToBook"
                defaultValue={s.minParentVerificationLevelToBook}
                className={input}
              >
                <option value="LEVEL_0_REGISTERED">
                  Level 0 — Registered (no verification)
                </option>
                <option value="LEVEL_1_CONTACT">
                  Level 1 — Contact verified (email + phone)
                </option>
                <option value="LEVEL_2_IDENTITY">
                  Level 2 — Identity verified (government ID + address)
                </option>
              </select>
            </label>
            <p className="mt-2 text-xs text-slate-500">
              Parents below this level can browse but cannot create a booking.
            </p>
          </fieldset>

          <fieldset className="rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-sm font-semibold">
              Booking lifecycle
            </legend>
            <label className="block text-sm font-medium">
              Who confirms completion
              <select
                name="completionConfirmedBy"
                defaultValue={s.completionConfirmedBy}
                className={input}
              >
                <option value="PARENT">Parent confirms (Admin can too)</option>
                <option value="ADMIN">Admin confirms</option>
              </select>
            </label>
            <p className="mt-2 text-xs text-slate-500">
              Completion releases the sitter payout and unlocks two-way reviews.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">
                Cancellation window (hours)
                <input
                  type="number"
                  name="cancellationWindowHours"
                  min={0}
                  max={336}
                  defaultValue={s.cancellationWindowHours}
                  className={input}
                />
              </label>
              <label className="block text-sm font-medium">
                Late-cancel charge (% of base)
                <input
                  type="number"
                  name="cancellationChargePercent"
                  min={0}
                  max={100}
                  defaultValue={s.cancellationChargePercent}
                  className={input}
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              A paid booking cancelled within this window incurs the charge.
              Default 0% = no penalty.
            </p>
          </fieldset>

          <fieldset className="rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-sm font-semibold">
              Sitter notification channels
            </legend>
            <p className="mb-2 text-xs text-slate-500">
              Email is always sent. Toggle extra channels on once the provider
              (e.g. Twilio) is configured — otherwise they run as dev stubs.
            </p>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="notifySmsEnabled"
                defaultChecked={s.notifySmsEnabled}
              />
              SMS
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="notifyWhatsappEnabled"
                defaultChecked={s.notifyWhatsappEnabled}
              />
              WhatsApp
            </label>
          </fieldset>

          <button type="submit" className={buttonClass()}>
            Save business rules
          </button>
        </form>
      </Card>
    </div>
  );
}
