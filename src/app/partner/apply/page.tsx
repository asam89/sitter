import { PageTitle, Card, buttonClass } from "@/components/ui";
import { applyAsPartner } from "@/lib/actions";

export default function PartnerApplyPage() {
  const input =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageTitle
        title="Become a Community Partner"
        subtitle="Any organization — a mosque, school, or sports league — can vouch for its members. Applications are reviewed by CircleCare."
      />
      <Card>
        <form action={applyAsPartner} className="space-y-4">
          <label className="block text-sm font-medium">
            Organization name
            <input name="name" required className={input} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">
              Type
              <select name="type" className={input}>
                <option value="SPORTS_LEAGUE">Sports league</option>
                <option value="MOSQUE">Mosque</option>
                <option value="SCHOOL">School</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label className="block text-sm font-medium">
              City
              <input name="city" className={input} />
            </label>
          </div>
          <label className="block text-sm font-medium">
            Description
            <textarea name="description" rows={3} className={input} />
          </label>

          <hr className="border-slate-200" />
          <p className="text-sm font-medium text-slate-700">
            Admin account (you)
          </p>
          <label className="block text-sm font-medium">
            Your name
            <input name="adminName" required className={input} />
          </label>
          <label className="block text-sm font-medium">
            Email
            <input type="email" name="email" required className={input} />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              type="password"
              name="password"
              required
              minLength={8}
              className={input}
            />
          </label>
          <button type="submit" className={buttonClass()}>
            Submit application
          </button>
        </form>
      </Card>
    </div>
  );
}
