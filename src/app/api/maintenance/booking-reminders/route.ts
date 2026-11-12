import { sendDueBookingReminders } from "@/lib/booking-reminders";
import {
  completeFinishedBookings,
  sendFeedbackRequests,
} from "@/lib/booking-completion";
import { runMaintenanceJob } from "@/lib/automations";

// Hourly booking job: pre-session reminders, auto-completing paid bookings
// whose session has ended, and the parent feedback request. Call it hourly (the final reminder can only be as
// punctual as the cron interval):
//   curl -fsS -H "x-maintenance-token: $MAINTENANCE_TOKEN" \
//     https://riaya.ca/api/maintenance/booking-reminders
// Token check and run tracking (/admin/automations) live in runMaintenanceJob.
export async function POST(req: Request) {
  return runMaintenanceJob(req, "booking-reminders", async () => {
    const reminders = await sendDueBookingReminders();
    const completed = await completeFinishedBookings();
    const feedback = await sendFeedbackRequests();
    return { ...reminders, completed, feedback };
  });
}

export async function GET(req: Request) {
  return POST(req);
}
