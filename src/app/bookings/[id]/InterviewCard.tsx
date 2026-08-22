import { Badge, Card, buttonClass } from "@/components/ui";
import { ActionButton } from "@/components/ActionButton";
import { dt } from "@/lib/format";
import {
  completeInterview,
  requestInterview,
  respondToInterview,
} from "@/lib/interview-actions";
import type { InterviewStatus } from "@prisma/client";

const STATUS_LABEL: Record<InterviewStatus, string> = {
  NONE: "Not requested",
  REQUESTED: "Waiting on the sitter",
  SCHEDULED: "Scheduled",
  DECLINED: "Sitter couldn't make it",
  COMPLETED: "Done",
};

// Optional intro call before the session. Deliberately non-blocking: the
// booking goes ahead whatever happens here.
export function InterviewCard({
  booking,
  isParent,
  isSitter,
  suggestedAt,
}: {
  booking: {
    id: string;
    interviewStatus: InterviewStatus;
    interviewScheduledAt: Date | null;
    interviewMethod: string | null;
    interviewNote: string | null;
    sitterName: string;
    parentName: string;
  };
  isParent: boolean;
  isSitter: boolean;
  suggestedAt: string;
}) {
  const input =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
  const scheduled = booking.interviewScheduledAt;

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Intro call (optional)</h2>
        <Badge
          color={
            booking.interviewStatus === "SCHEDULED" ||
            booking.interviewStatus === "COMPLETED"
              ? "green"
              : booking.interviewStatus === "REQUESTED"
                ? "amber"
                : "slate"
          }
        >
          {STATUS_LABEL[booking.interviewStatus]}
        </Badge>
      </div>

      {booking.interviewStatus === "NONE" && isParent && (
        <form action={requestInterview} className="space-y-2">
          <input type="hidden" name="bookingId" value={booking.id} />
          <p className="text-sm text-slate-600">
            Want to speak with {booking.sitterName} before the session? Suggest a
            time — most families do this the day before. It never affects your
            booking.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Suggested time
              <input
                type="datetime-local"
                name="proposedAt"
                required
                defaultValue={suggestedAt}
                className={input}
              />
            </label>
            <label className="block text-sm font-medium">
              How
              <select name="method" className={input} defaultValue="Phone call">
                <option>Phone call</option>
                <option>Video call</option>
                <option>In person</option>
              </select>
            </label>
          </div>
          <label className="block text-sm font-medium">
            Anything to mention (optional)
            <input name="note" className={input} />
          </label>
          <button type="submit" className={buttonClass("secondary")}>
            Ask for an intro call
          </button>
        </form>
      )}

      {booking.interviewStatus === "NONE" && isSitter && (
        <p className="text-sm text-slate-600">
          {booking.parentName} hasn&apos;t asked for an intro call. If they do,
          you can accept or decline here.
        </p>
      )}

      {booking.interviewStatus !== "NONE" && (
        <div className="space-y-1 text-sm text-slate-600">
          {scheduled && (
            <p>
              {booking.interviewMethod ?? "Call"} · {dt(scheduled)}
            </p>
          )}
          {booking.interviewNote && <p>&ldquo;{booking.interviewNote}&rdquo;</p>}
        </div>
      )}

      {booking.interviewStatus === "REQUESTED" && isSitter && (
        <div className="flex flex-wrap gap-3">
          <ActionButton action={respondToInterview.bind(null, booking.id, true)}>
            Accept
          </ActionButton>
          <ActionButton
            action={respondToInterview.bind(null, booking.id, false)}
            variant="secondary"
          >
            Can&apos;t make it
          </ActionButton>
        </div>
      )}

      {booking.interviewStatus === "SCHEDULED" && (isParent || isSitter) && (
        <ActionButton
          action={completeInterview.bind(null, booking.id)}
          variant="secondary"
        >
          Mark the call done
        </ActionButton>
      )}

      {booking.interviewStatus === "DECLINED" && isParent && (
        <form action={requestInterview} className="space-y-2">
          <input type="hidden" name="bookingId" value={booking.id} />
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Suggest another time
              <input
                type="datetime-local"
                name="proposedAt"
                required
                defaultValue={suggestedAt}
                className={input}
              />
            </label>
            <label className="block text-sm font-medium">
              How
              <select name="method" className={input} defaultValue="Phone call">
                <option>Phone call</option>
                <option>Video call</option>
                <option>In person</option>
              </select>
            </label>
          </div>
          <button type="submit" className={buttonClass("secondary")}>
            Suggest again
          </button>
        </form>
      )}
    </Card>
  );
}
