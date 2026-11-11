# Scheduled jobs (automations)

The production host's crontab calls these routes with the header
`x-maintenance-token: $MAINTENANCE_TOKEN`. Every call is recorded in the
`JobRun` table, so a job that stops running shows up instead of going quiet.

| Job | Route | Intended schedule | Overdue after |
| --- | --- | --- | --- |
| Booking reminders, auto-complete, feedback | `/api/maintenance/booking-reminders` | hourly | 3h |
| Pipeline nudges + Admin digest | `/api/maintenance/pipeline-nudges` | daily 09:05 UTC | 28h |
| Background-check expiry | `/api/maintenance/screening-expiry` | daily | 28h |
| Medical-notes purge (60-day retention) | `/api/maintenance/purge-medical` | daily | 28h |
| Weekly schedule reminder to sitters | `/api/maintenance/weekly-schedule-reminders` | Sunday 22:00 UTC | 8 days |
| Parent availability newsletter | `/api/maintenance/parent-newsletter` | weekly (sends every 13 days) | 8 days |

The registry lives in `src/lib/automations.ts` (`AUTOMATIONS`). A new
maintenance route should use `runMaintenanceJob()` and get an entry there.

## Reference crontab

The app listens on `127.0.0.1:3003` on the host and reads `.env.prod` (see
`docs/pipeline-nudges.md`). The host clock is UTC.

```
5 * * * *  . /home/ubuntu/sitbaby/.env.prod; curl -fsS -X POST -H "x-maintenance-token: $MAINTENANCE_TOKEN" http://127.0.0.1:3003/api/maintenance/booking-reminders >/dev/null
5 9 * * *  . /home/ubuntu/sitbaby/.env.prod; curl -fsS -X POST -H "x-maintenance-token: $MAINTENANCE_TOKEN" http://127.0.0.1:3003/api/maintenance/pipeline-nudges >/dev/null
15 9 * * * . /home/ubuntu/sitbaby/.env.prod; curl -fsS -X POST -H "x-maintenance-token: $MAINTENANCE_TOKEN" http://127.0.0.1:3003/api/maintenance/screening-expiry >/dev/null
25 9 * * * . /home/ubuntu/sitbaby/.env.prod; curl -fsS -X POST -H "x-maintenance-token: $MAINTENANCE_TOKEN" http://127.0.0.1:3003/api/maintenance/purge-medical >/dev/null
0 22 * * 0 . /home/ubuntu/sitbaby/.env.prod; curl -fsS -X POST -H "x-maintenance-token: $MAINTENANCE_TOKEN" http://127.0.0.1:3003/api/maintenance/weekly-schedule-reminders >/dev/null
0 14 * * 1 . /home/ubuntu/sitbaby/.env.prod; curl -fsS -X POST -H "x-maintenance-token: $MAINTENANCE_TOKEN" http://127.0.0.1:3003/api/maintenance/parent-newsletter >/dev/null
```

Compare this against `crontab -l` on the host; the times other than pipeline
nudges and the weekly reminder are suggestions, since those two are the only
ones previously documented.

## How problems surface

- **`/admin/automations`**: each job's state (Running, Ran with delivery
  failures, Last run failed, Overdue, No runs recorded yet), last run, last
  success and the counts it returned. The Admin dashboard shows a red banner
  when anything needs attention.
- **Email to Admins**: a run that throws returns HTTP 500 (so `curl -f` in cron
  fails too) and alerts Admins. An overdue job alerts when the health check is
  polled. Both alert at most once per job per 12 hours, and both are listed on
  `/admin/errors` under the route `/automations/<job>`.
- **`GET /api/health/automations`** (public, no personal data): 200 when
  healthy, 503 when anything is overdue or failing.
- **GitHub Actions watchdog** (`.github/workflows/automation-watchdog.yml`)
  polls that endpoint hourly from outside, so a dead host or a missing crontab
  still produces a failed workflow and a GitHub notification.

"No runs recorded yet" is not an alarm until tracking has existed for longer
than the job's overdue window, so a fresh deploy doesn't alert before the first
scheduled run.
