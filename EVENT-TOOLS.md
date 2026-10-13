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
