"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { buttonClass } from "@/components/ui";

export type SlotView = {
  id: string;
  startTime: string; // ISO
  endTime: string; // ISO
  status: string;
  isLastMinuteEligible: boolean;
  bookingHref?: string | null;
  bookingLabel?: string | null;
};

// 30-minute rows, 24px each — one hour is a 48px box per day column.
const STEP_MIN = 30;
const ROW_PX = 24;
const STEPS_PER_HOUR = 60 / STEP_MIN;

const dayFmt = new Intl.DateTimeFormat("en-CA", {
  weekday: "short",
  day: "numeric",
});

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// "YYYY-MM-DD" → local midnight (no UTC shift).
function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate(),
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function hourLabel(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${hour < 12 ? "AM" : "PM"}`;
}

function clockLabel(d: Date): string {
  const h = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return `${h}:${pad(d.getMinutes())} ${d.getHours() < 12 ? "AM" : "PM"}`;
}

type Draft = { start: Date; end: Date };
type Editing = { slot: SlotView } | { draft: Draft };

export function AvailabilityWeek({
  weekStart,
  dayCount,
  slots,
  createAction,
  editAction,
  deleteAction,
  dayStartHour = 7,
  dayEndHour = 23,
  readOnly = false,
}: {
  weekStart: string; // "YYYY-MM-DD" — first column
  dayCount: number;
  slots: SlotView[];
  createAction: (fd: FormData) => Promise<void>;
  editAction: (slotId: string, fd: FormData) => Promise<void>;
  deleteAction: (slotId: string) => Promise<void>;
  dayStartHour?: number;
  dayEndHour?: number;
  readOnly?: boolean;
}) {
  const firstDay = parseDay(weekStart);
  const days = Array.from({ length: dayCount }, (_, i) => addDays(firstDay, i));
  const hours = Array.from(
    { length: dayEndHour - dayStartHour },
    (_, i) => dayStartHour + i,
  );
  const totalRows = hours.length * STEPS_PER_HOUR;

  const [drag, setDrag] = useState<{
    dayIdx: number;
    from: number;
    to: number;
  } | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dragRef = useRef(drag);
  dragRef.current = drag;

  // A pointer released outside the grid must not leave a dangling selection.
  useEffect(() => {
    function onUp() {
      const d = dragRef.current;
      if (!d) return;
      setDrag(null);
      const [from, to] = d.from <= d.to ? [d.from, d.to] : [d.to, d.from];
      setEditing({
        draft: {
          start: rowTime(days[d.dayIdx], from),
          end: rowTime(days[d.dayIdx], to + 1),
        },
      });
    }
    window.addEventListener("pointerup", onUp);
    return () => window.removeEventListener("pointerup", onUp);
    // days/dayStartHour are stable for a given rendered week.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, dayCount, dayStartHour]);

  function rowTime(day: Date, row: number): Date {
    const minutes = dayStartHour * 60 + row * STEP_MIN;
    return new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      Math.floor(minutes / 60),
      minutes % 60,
    );
  }

  function rowFromEvent(e: React.PointerEvent<HTMLDivElement>): number {
    const rect = e.currentTarget.getBoundingClientRect();
    const row = Math.floor((e.clientY - rect.top) / ROW_PX);
    return Math.min(Math.max(row, 0), totalRows - 1);
  }

  // Blocks are positioned inside their day column, clamped to the visible band.
  function blockBox(slot: SlotView, day: Date) {
    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);
    const dayTop = rowTime(day, 0);
    const dayBottom = rowTime(day, totalRows);
    const from = Math.max(start.getTime(), dayTop.getTime());
    const to = Math.min(end.getTime(), dayBottom.getTime());
    if (to <= from) return null;
    const top = ((from - dayTop.getTime()) / (STEP_MIN * 60_000)) * ROW_PX;
    const height = ((to - from) / (STEP_MIN * 60_000)) * ROW_PX;
    return { top, height: Math.max(height, 18) };
  }

  function sameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        setEditing(null);
      } catch {
        setError("Could not save — check the times and try again.");
      }
    });
  }

  const today = new Date();

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            Click and drag down a day to add availability, or click a block to
            change it. Booked blocks are locked to their booking.
          </p>
          <button
            className={buttonClass("secondary")}
            onClick={() => {
              const start = new Date(
                firstDay.getFullYear(),
                firstDay.getMonth(),
                firstDay.getDate(),
                9,
              );
              setEditing({
                draft: { start, end: new Date(start.getTime() + 3_600_000) },
              });
            }}
          >
            + Add hours
          </button>
        </div>
      )}

      <div className="select-none overflow-x-auto rounded-xl border border-brand-teal/10 bg-white">
        <div className="min-w-[48rem]">
          {/* Day headers */}
          <div
            className="grid border-b border-brand-teal/10"
            style={{
              gridTemplateColumns: `4rem repeat(${dayCount}, minmax(0, 1fr))`,
            }}
          >
            <div className="px-2 py-2 text-[10px] font-semibold uppercase text-slate-400">
              Time
            </div>
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className={`border-l border-brand-teal/10 px-2 py-2 text-center text-xs font-semibold uppercase ${
                  sameDay(day, today) ? "text-brand-coral" : "text-brand-ink"
                }`}
              >
                {dayFmt.format(day)}
              </div>
            ))}
          </div>

          {/* Hour grid */}
          <div
            className="grid"
            style={{
              gridTemplateColumns: `4rem repeat(${dayCount}, minmax(0, 1fr))`,
            }}
          >
            <div>
              {hours.map((h) => (
                <div
                  key={h}
                  style={{ height: ROW_PX * STEPS_PER_HOUR }}
                  className="relative"
                >
                  <span className="absolute -top-2 right-2 text-[11px] text-slate-400">
                    {hourLabel(h)}
                  </span>
                </div>
              ))}
            </div>

            {days.map((day, dayIdx) => (
              <div
                key={day.toISOString()}
                className="relative border-l border-brand-teal/10"
                style={{ height: totalRows * ROW_PX }}
                onPointerDown={(e) => {
                  if (readOnly) return;
                  const row = rowFromEvent(e);
                  setDrag({ dayIdx, from: row, to: row });
                }}
                onPointerMove={(e) => {
                  if (!drag || drag.dayIdx !== dayIdx) return;
                  setDrag({ ...drag, to: rowFromEvent(e) });
                }}
              >
                {/* Hour lines */}
                {hours.map((h, i) => (
                  <div
                    key={h}
                    className={`absolute left-0 right-0 border-t ${
                      i === 0 ? "border-transparent" : "border-brand-teal/10"
                    }`}
                    style={{ top: i * ROW_PX * STEPS_PER_HOUR }}
                  />
                ))}

                {/* Live drag selection */}
                {drag && drag.dayIdx === dayIdx && (
                  <div
                    className="pointer-events-none absolute left-1 right-1 rounded-md border border-brand-coral bg-brand-coral/20"
                    style={{
                      top: Math.min(drag.from, drag.to) * ROW_PX,
                      height:
                        (Math.abs(drag.to - drag.from) + 1) * ROW_PX,
                    }}
                  />
                )}

                {slots.map((slot) => {
                  const box = blockBox(slot, day);
                  if (!box) return null;
                  const booked = slot.status !== "OPEN";
                  const label = `${clockLabel(
                    new Date(slot.startTime),
                  )} - ${clockLabel(new Date(slot.endTime))}`;
                  const cls = `absolute left-1 right-1 overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-[11px] leading-tight ${
                    booked
                      ? "border-brand-blue/60 bg-brand-blue/30 text-brand-ink"
                      : "border-emerald-300 bg-emerald-100 text-emerald-900 hover:bg-emerald-200"
                  }`;
                  return booked && slot.bookingHref ? (
                    <Link
                      key={slot.id}
                      href={slot.bookingHref}
                      style={box}
                      className={cls}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <span className="block truncate font-medium">
                        {label}
                      </span>
                      <span className="block truncate">
                        {slot.bookingLabel ?? "Booked"}
                      </span>
                    </Link>
                  ) : (
                    <button
                      key={slot.id}
                      style={box}
                      className={cls}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => {
                        // Booked blocks are pinned by their booking.
                        if (!readOnly && !booked) setEditing({ slot });
                      }}
                    >
                      <span className="block truncate font-medium">
                        {label}
                      </span>
                      {booked ? (
                        <span className="block truncate">
                          {slot.bookingLabel ?? "Booked"}
                        </span>
                      ) : (
                        slot.isLastMinuteEligible && (
                          <span className="block truncate">Last-minute OK</span>
                        )
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {editing && (
        <SlotDialog
          editing={editing}
          pending={pending}
          error={error}
          onClose={() => {
            setError(null);
            setEditing(null);
          }}
          onSave={(fd) =>
            run(async () => {
              if ("slot" in editing) await editAction(editing.slot.id, fd);
              else await createAction(fd);
            })
          }
          onDelete={
            "slot" in editing
              ? () => run(() => deleteAction(editing.slot.id))
              : undefined
          }
        />
      )}
    </div>
  );
}

function SlotDialog({
  editing,
  pending,
  error,
  onClose,
  onSave,
  onDelete,
}: {
  editing: Editing;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (fd: FormData) => void;
  onDelete?: () => void;
}) {
  const start =
    "slot" in editing ? new Date(editing.slot.startTime) : editing.draft.start;
  const end =
    "slot" in editing ? new Date(editing.slot.endTime) : editing.draft.end;
  const lastMinute =
    "slot" in editing ? editing.slot.isLastMinuteEligible : false;
  const input =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
        <h3 className="font-semibold text-brand-ink">
          {"slot" in editing ? "Edit availability" : "Add availability"}
        </h3>
        <form
          action={onSave}
          className="mt-4 space-y-3"
        >
          <label className="block text-sm font-medium">
            Start
            <input
              type="datetime-local"
              name="startTime"
              required
              defaultValue={toLocalInput(start)}
              className={input}
            />
          </label>
          <label className="block text-sm font-medium">
            End
            <input
              type="datetime-local"
              name="endTime"
              required
              defaultValue={toLocalInput(end)}
              className={input}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isLastMinuteEligible"
              defaultChecked={lastMinute}
            />
            Available for last-minute bookings (adds the rush fee)
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={pending}
              className={buttonClass()}
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={buttonClass("secondary")}
            >
              Cancel
            </button>
            {onDelete && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (confirm("Remove this availability block?")) onDelete();
                }}
                className="ml-auto text-sm font-medium text-red-700 hover:underline"
              >
                Remove
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
