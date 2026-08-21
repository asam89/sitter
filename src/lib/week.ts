// Week window helpers for the availability grid. All dates are server-local
// (the app runs in a fixed TZ, see the Dockerfile).

export type WeekWindow = {
  /** First visible day, "YYYY-MM-DD". */
  weekStart: string;
  /** 5 (work week) or 7 (full week). */
  dayCount: number;
  /** Inclusive start of the visible range. */
  start: Date;
  /** Exclusive end of the visible range. */
  end: Date;
  prevWeek: string;
  nextWeek: string;
  thisWeek: string;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function dayString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDay(day: string | undefined): Date | null {
  if (!day?.match(/^\d{4}-\d{2}-\d{2}$/)) return null;
  const [y, m, d] = day.split("-").map(Number);
  const parsed = new Date(y, m - 1, d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// A work week starts Monday; a full week starts Sunday.
function weekStartFor(d: Date, dayCount: number): Date {
  const offset = dayCount === 5 ? (d.getDay() + 6) % 7 : d.getDay();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset);
}

export function weekWindow(params: {
  week?: string;
  days?: string;
}): WeekWindow {
  const dayCount = params.days === "7" ? 7 : 5;
  const anchor = parseDay(params.week) ?? new Date();
  const start = weekStartFor(anchor, dayCount);
  const end = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + dayCount,
  );
  const shift = (n: number) =>
    dayString(
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + n),
    );
  return {
    weekStart: dayString(start),
    dayCount,
    start,
    end,
    prevWeek: shift(-7),
    nextWeek: shift(7),
    thisWeek: dayString(weekStartFor(new Date(), dayCount)),
  };
}

const rangeFmt = new Intl.DateTimeFormat("en-CA", {
  month: "long",
  day: "numeric",
});

export function weekLabel(w: WeekWindow): string {
  const last = new Date(
    w.end.getFullYear(),
    w.end.getMonth(),
    w.end.getDate() - 1,
  );
  return `${rangeFmt.format(w.start)} - ${rangeFmt.format(last)}, ${last.getFullYear()}`;
}
