export function money(n: number): string {
  return `$${n.toFixed(0)}`;
}

export function moneyHr(n: number): string {
  return `${money(n)}/hr`;
}

// Human-quotable booking reference, e.g. RB-000042.
export function bookingRef(bookingNumber: number): string {
  return `RB-${String(bookingNumber).padStart(6, "0")}`;
}

// Human-quotable open-request reference, e.g. RQ-000042.
export function requestRef(requestNumber: number): string {
  return `RQ-${String(requestNumber).padStart(6, "0")}`;
}

const fmt = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function dt(d: Date | string): string {
  return fmt.format(new Date(d));
}

const dateFmt = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" });

// Date with no time of day — issue/renewal dates on documents.
export function d(value: Date | string): string {
  return dateFmt.format(new Date(value));
}

const timeFmt = new Intl.DateTimeFormat("en-CA", { timeStyle: "short" });

export function time(d: Date | string): string {
  return timeFmt.format(new Date(d));
}
