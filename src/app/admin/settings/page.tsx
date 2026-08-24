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
        subtitle="Pricing, fees, minimum booking length and the cancellation/refund policy. Existing bookings keep their original pricing snapshot."
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
            <label className="mt-3 block text-sm font-medium">
              Minimum booking length (hours)
              <input
                type="number"
                name="minBookingHours"
                min={1}
                max={24}
                defaultValue={s.minBookingHours}
                className={input}
              />
            </label>
            <p className="mt-2 text-xs text-slate-500">
              Shorter requests are rejected, and availability blocks below this
              cannot be booked.
            </p>
          </fieldset>

          <fieldset className="rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-sm font-semibold">Surcharges</legend>
            <p className="mb-2 text-xs text-slate-500">
              Flat amounts in CAD, itemised for the parent before they pay. Each
              applies once when the session qualifies, and they stack.
            </p>
            <label className="block text-sm font-medium">
              Extra child (per child after the first)
              <input
                type="number"
                name="extraChildFeeAmount"
                min={0}
                defaultValue={s.extraChildFeeAmount}
                className={input}
              />
            </label>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <label className="block text-sm font-medium">
                Late-night fee
                <input
                  type="number"
                  name="lateNightFeeAmount"
                  min={0}
                  defaultValue={s.lateNightFeeAmount}
                  className={input}
                />
              </label>
              <label className="block text-sm font-medium">
                From (hour)
                <input
                  type="number"
                  name="lateNightStartHour"
                  min={0}
                  max={23}
                  defaultValue={s.lateNightStartHour}
                  className={input}
                />
              </label>
              <label className="block text-sm font-medium">
                To (hour)
                <input
                  type="number"
                  name="lateNightEndHour"
                  min={0}
                  max={23}
                  defaultValue={s.lateNightEndHour}
                  className={input}
                />
              </label>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <label className="block text-sm font-medium">
                Overnight fee
                <input
                  type="number"
                  name="overnightFeeAmount"
                  min={0}
                  defaultValue={s.overnightFeeAmount}
                  className={input}
                />
              </label>
              <label className="block text-sm font-medium">
                From (hour)
                <input
                  type="number"
                  name="overnightStartHour"
                  min={0}
                  max={23}
                  defaultValue={s.overnightStartHour}
                  className={input}
                />
              </label>
              <label className="block text-sm font-medium">
                To (hour)
                <input
                  type="number"
                  name="overnightEndHour"
                  min={0}
                  max={23}
                  defaultValue={s.overnightEndHour}
                  className={input}
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-sm font-semibold">
              Cancellation &amp; refunds
            </legend>
            <p className="mb-2 text-xs text-slate-500">
              Percentages are of the amount the parent paid. These exact terms
              are shown to the parent before payment and on every booking.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">
                Full refund if cancelled this many hours ahead
                <input
                  type="number"
                  name="refundFullBeforeHours"
                  min={0}
                  max={336}
                  defaultValue={s.refundFullBeforeHours}
                  className={input}
                />
              </label>
              <label className="block text-sm font-medium">
                Late-cancellation window (hours before start)
                <input
                  type="number"
                  name="lateCancelWindowHours"
                  min={0}
                  max={336}
                  defaultValue={s.lateCancelWindowHours}
                  className={input}
                />
              </label>
              <label className="block text-sm font-medium">
                Refund between the two windows (%)
                <input
                  type="number"
                  name="midRefundPercent"
                  min={0}
                  max={100}
                  defaultValue={s.midRefundPercent}
                  className={input}
                />
              </label>
              <label className="block text-sm font-medium">
                Refund inside the late window (%)
                <input
                  type="number"
                  name="lateRefundPercent"
                  min={0}
                  max={100}
                  defaultValue={s.lateRefundPercent}
                  className={input}
                />
              </label>
              <label className="block text-sm font-medium">
                Refund at/after the start time (%)
                <input
                  type="number"
                  name="afterStartRefundPercent"
                  min={0}
                  max={100}
                  defaultValue={s.afterStartRefundPercent}
                  className={input}
                />
              </label>
              <label className="block text-sm font-medium">
                Refund when the sitter or Ri&apos;aya cancels (%)
                <input
                  type="number"
                  name="sitterCancelRefundPercent"
                  min={0}
                  max={100}
                  defaultValue={s.sitterCancelRefundPercent}
                  className={input}
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-amber-800">
              Refund and waiver terms have not been reviewed by a lawyer yet.
            </p>
          </fieldset>

          <fieldset className="rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-sm font-semibold">Payments</legend>
            <label className="block text-sm font-medium">
              Interac e-Transfer address
              <input
                type="email"
                name="etransferEmail"
                defaultValue={s.etransferEmail ?? ""}
                placeholder="payments@riaya.ca"
                className={input}
              />
            </label>
            <p className="mt-2 text-xs text-slate-500">
              Shown to parents who choose to pay by e-Transfer. Leave blank to
              offer card payment only. An e-Transfer booking is confirmed only
              once an Admin marks it paid.
            </p>
          </fieldset>

          <fieldset className="rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-sm font-semibold">
              Support &amp; reminders
            </legend>
            <label className="block text-sm font-medium">
              Support email
              <input
                type="email"
                name="supportEmail"
                defaultValue={s.supportEmail ?? ""}
                placeholder="support@riaya.ca"
                className={input}
              />
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                First reminder (hours before start)
                <input
                  type="number"
                  name="reminderLeadHours"
                  min={0}
                  max={168}
                  defaultValue={s.reminderLeadHours}
                  className={input}
                />
              </label>
              <label className="block text-sm font-medium">
                Final reminder (hours before start)
                <input
                  type="number"
                  name="reminderFinalLeadHours"
                  min={0}
                  max={168}
                  defaultValue={s.reminderFinalLeadHours}
                  className={input}
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Parent and sitter both get a reminder before a confirmed (paid)
              booking starts, with the support address above. Set an interval to
              0 to switch that reminder off.
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
