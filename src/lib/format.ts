export function money(n: number): string {
  return `$${n.toFixed(0)}`;
}

export function moneyHr(n: number): string {
  return `${money(n)}/hr`;
}

const fmt = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function dt(d: Date | string): string {
  return fmt.format(new Date(d));
}
