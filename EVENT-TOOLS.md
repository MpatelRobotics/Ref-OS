# Event operations tools

Run `supabase/event-operations.sql` after the existing League, division and interview-scheduler migrations. This adds a shared operations table with server-enforced role restrictions, session/division validation and optimistic version checks. It also validates interview attendance statuses and buffer overlaps. Then publish the app and let both connector workflows rebuild.

## Where to find the requested additions

| Idea | Feature | Location |
|---|---|---|
| 62 | Division announcements, with a whole-event channel | Matches / Teams → Division announcements & volunteer assignments |
| 63 | Division volunteer assignments, including field/shift details | Same dropdown |
| 64 | Division labels beside team numbers | Teams, after TM roster sync |
| 65 | Explicit confirmation before moving a record between divisions | Operations records → Move to division |
| 66 | Comparison of scored/total matches across divisions | ECC → Event completeness, reports & sanitized backup |
| 67 | Monthly league calendar with selectable session dates | League Overview → League calendar & attendance |
| 68 | Present, absent and unknown attendance per team/session | Same dropdown; Admin records attendance |
| 70 | League-wide PDF with separate session result/attendance summaries | League Overview or ECC → League-wide PDF |
| 104 | Robot modification notes | Robots → Robot changes & inspection follow-ups |
| 105 | Inspection follow-up flags, with open/completed status | Same dropdown |
| 106 | Assigned inspector / owner on follow-up tasks | Same dropdown |
| 111 | Team-to-judge-group assignments | Judging → Judge-group assignments; groups can also be assigned to interviews |
| 113 | Scheduled, completed, missed and rescheduled interview status | Interview Scheduler |
| 115 | Suggested rescheduling windows, requiring confirmation | Each interview → Suggest rescheduling window |
| 116 | Configurable buffer between interviews | Interview Scheduler |
| 117 | Team match-time conflict warnings | Interview Scheduler, when TM scheduled times are available |
| 120 | Interview/group/status handover PDF | Interview Scheduler → Export judging handover PDF |
| 133 | Retry an individual failed upload | Robots / Matches / ECC → Offline roster, schedule & failed uploads |
| 134 | Explicitly saved, read-only offline roster and schedule | Same dropdown; isolated by event, session and division |
| 136 | Browser warning for unsaved operations/interviews, with recoverable local drafts | Operations forms and Interview Scheduler |
| 141 | Complete event PDF across divisions and sessions | ECC → Complete event PDF |
| 146 | Roster, scores, rankings, Skills and interview completeness counts | ECC → Refresh completeness |
| 150 | Sanitized JSON backup and restore conflict preview | ECC → Sanitized backup / Restore preview |

## Scope and limits

Announcements and assignments are shared records in Ref OS, not external messages or push notifications. Select the division or Whole event when creating them. Admins can move records; other writers cannot. Judging assignments are readable only by Admin/Judge roles. Robot changes and follow-ups may be written by Admin, Referee or Inspection roles. These records do not certify inspection or change TM.

Attendance is manual and per session; an unrecorded team is unknown, not absent. Division team labels reflect the latest TM division roster mapping. Reports compare all saved divisions and sessions, even when one division is selected in the workspace.

Interview suggestions use saved panel reservations, buffers and imported TM scheduled times. A ten-minute planning margin is applied around each scheduled match. Suggestions cannot account for unscheduled matches or future event delays, and must be reviewed. Saved interview changes use version checks; a conflicting save preserves the local draft.

Browsers can warn on closing/reloading with unsaved work, but iOS or Android may force-close apps without issuing that event. Operations and interview drafts are therefore also saved locally for explicit recovery. Offline snapshots are read-only and do not overwrite current schedules/results. A snapshot is not a fresh results feed.

Archives include event metadata, roster, matches/results, violations, nominations, field log, league sessions, operations, interviews, watch notes, alliances, finalists, field-reset checks and selected public settings. They exclude access codes, credential fields, hashes, tokens, user identifiers and contact fields. Attachment files are not embedded. Free-text notes may still contain information entered by staff; review before sharing. The restore tool is a preview only: it lists existing identities/conflicts and warns about a different source event; it does not import or overwrite data.

Run checks:

```cmd
node --test tests/event-operations-sql.test.mjs tests/interview-scheduler.test.mjs tests/tm-api.test.mjs
npx playwright test tests/event-tools.spec.js tests/event-operations-ui.spec.js tests/interview-scheduler.spec.js --project=chromium
npm run mobile:sync
```

## Interview optimizer

In Judging, open the separate **Interview Optimizer** dropdown. It has its own team selection, first interview time, length, buffer, panel/location, end time and panel count. The Interview Scheduler can stay closed. Multiple panels use the panel/location name as a numbered prefix.

**Use lunch block** enables lunch start/end times. With **Interview during lunch only** off, interviews and their buffers avoid lunch. With it on, new interviews and buffers must fit completely within lunch. Existing interviews are preserved and are not automatically moved.

The heuristic selects the earliest feasible interview, giving priority to teams whose next known match leaves less room. It respects existing panel reservations and imported match times with the existing ten-minute margin. Without match times, it falls back to team-number order. It is not a guarantee of the globally best schedule. Unplaced teams are listed; extend the window or add panels to fit more teams.

Review the proposal, then **Apply proposal to draft** and **Save optimized schedule**. Changing inputs invalidates the proposal. **Export optimizer schedule PDF** exports the generated/applied proposal separately, including lunch settings and unplaced teams. Later manual edits belong in the existing judging handover export. No additional database migration is required for the optimizer. These settings are local planning inputs, not shared event lunch rules.

Optimizer PDFs list teams under judge-group headings (or Unassigned judge group), with interviews sorted by time inside each group. Each team has After match / Before match references based on its nearest known scheduled matches. References are not live completion promises; missing times are marked unknown.

TM scheduled match times are also displayed in the match list and match details, using the event timezone. Times appear only when the imported match identity and team assignments agree. Scheduled times are not actual start times.

Navigation: **Nominations** contains award nominations and finalists. **Judging** contains judge-group assignments, Interview Scheduler and the separate Interview Optimizer dropdown. Judging retains Admin/Judge Advisor access.

The optimizer now asks for **Number of judge groups** and displays all group-name fields together. Selected unscheduled teams are split in numeric team order across those groups with a count difference of at most one. Each group gets its own numbered panel; match and lunch constraints are applied within each group. Teams that cannot fit remain assigned to their group and are listed as not fitted rather than silently reassigned. Existing interviews are preserved. Group assignments appear in the preview and PDF.

## Judge-group access and interview timer

Run `supabase/judge-groups.sql` after the existing interview and operations migrations. Save the optimized schedule first, then open **Judging → Judge-group logins** to create a separate code for each named group. Codes are shown only at creation; replacing or disabling a code revokes existing group sessions. Give a group its own code. It uses **Judge-group login** on the event sign-in page.

This separate read-only portal shows the group's saved interview assignments, including assigned teams without a fitted interview, their imported match schedules, and live TM field activity. It does not grant Judge Advisor access or access to nominations. It refreshes every 15 seconds while open, and requires the TM connector to publish live activity. Stale or unavailable activity is labeled; judges should confirm actual team availability. Group sessions last 12 hours. The code is event-scoped and covers that named group's saved league-session assignments.

Display and PDF times use 12-hour AM/PM formatting; native date/time entry controls follow the device's locale. **Show interview timer** opens a screen-wide countdown using that interview's duration, with Start/resume, Pause, Reset and Close. Device fullscreen is offered where supported. Timer state stays on the judge's device; closing it or reloading does not mark the interview complete. Assigned teams without an interview use the schedule's default duration.

The manual Interview Scheduler dropdown has been removed. Judging now offers Interview Optimizer, Saved group interviews for review/removal and draft recovery, and Judge-group logins. Optimized interviews still save to the same shared schedules used by judges.

Judge-group assignments now shows optimizer assignments from the shared interview schedule as well as manual records. Draft assignments are labeled unsaved until the optimized schedule is saved. Optimizer assignments cover the selected event/session across divisions; manual records retain their division scope. Refresh records also reloads saved optimizer assignments, with confirmation before discarding a draft.
