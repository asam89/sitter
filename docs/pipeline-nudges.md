# Pipeline nudges (daily sweep)

`POST /api/maintenance/pipeline-nudges` (header `x-maintenance-token`, guarded
by `MAINTENANCE_TOKEN`). Run once a day, in the morning local time:

```
5 9 * * * . /home/ubuntu/sitbaby/.env.prod; curl -fsS -X POST -H "x-maintenance-token: $MAINTENANCE_TOKEN" http://127.0.0.1:3003/api/maintenance/pipeline-nudges >/dev/null
```

What it does (`src/lib/pipeline-nudges.ts`):

| Who | Condition | Email |
| --- | --- | --- |
| Listed sitter | no `OPEN` slot in the next 14 days | "Your calendar is empty — parents can't book you" → `/sitter/availability` |
| Applicant | status Applied / Under review / Interview, untouched for 3+ days, no future interview time set | "Reply with interview times" |
| Sitter account | role SITTER, no application, no profile, created 3+ days ago | "Finish your application" → `/sitter/apply` |
| Admins | anything pending | one digest: applications to review, interviews to hold/vet, vetted-not-listed, empty calendars, unfinished accounts |

Each sitter/applicant nudge is recorded in `PipelineNudge`, and the same
person is not chased about the same thing again for 7 days. The admin digest
is sent on every run that finds something pending, so keep the schedule daily.
Suspended accounts are skipped everywhere.

## Weekly schedule reminder

`POST /api/maintenance/weekly-schedule-reminders` (same token). Run once a
week; the host clock is UTC, so Sunday 22:00 UTC is 6pm Toronto in summer
(5pm in winter):

```
0 22 * * 0 . /home/ubuntu/sitbaby/.env.prod; curl -fsS -X POST -H "x-maintenance-token: $MAINTENANCE_TOKEN" http://127.0.0.1:3003/api/maintenance/weekly-schedule-reminders >/dev/null
```

Every listed, non-suspended sitter gets "Please check your Ri'aya schedule for
the week" with the number of open hours they have in the next 7 days and a
link to `/sitter/availability`. Logged as `SITTER_WEEKLY_SCHEDULE`; a sitter is
skipped if they got this reminder in the last 6 days or the empty-calendar
nudge in the last 24 hours.
