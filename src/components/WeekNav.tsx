import Link from "next/link";
import { weekLabel, type WeekWindow } from "@/lib/week";

const navClass =
  "rounded-lg border border-brand-teal/30 bg-white px-3 py-2 text-sm font-semibold text-brand-teal hover:bg-brand-cream";

// Week range header + prev/next/today and work-week vs full-week toggle.
export function WeekNav({
  basePath,
  week,
}: {
  basePath: string;
  week: WeekWindow;
}) {
  const href = (weekStart: string, days: number) =>
    `${basePath}?week=${weekStart}&days=${days}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm font-semibold text-brand-ink">{weekLabel(week)}</p>
      <div className="flex items-center gap-2">
        <Link
          href={href(week.prevWeek, week.dayCount)}
          className={navClass}
          aria-label="Previous week"
        >
          ←
        </Link>
        <Link href={href(week.thisWeek, week.dayCount)} className={navClass}>
          Today
        </Link>
        <Link
          href={href(week.nextWeek, week.dayCount)}
          className={navClass}
          aria-label="Next week"
        >
          →
        </Link>
        <Link
          href={href(week.weekStart, week.dayCount === 5 ? 7 : 5)}
          className={navClass}
        >
          {week.dayCount === 5 ? "Full week" : "Work week"}
        </Link>
      </div>
    </div>
  );
}
