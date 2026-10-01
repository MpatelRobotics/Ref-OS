# League Events

Ref OS supports two event formats:

| Format | What it is |
|---|---|
| **Tournament** | One event: one schedule, one set of rankings. This is how every existing event works, including Highlander Summit, and it is unchanged. |
| **League** | One event that holds several **league sessions**, for example *Session 1, Session 2, Session 3, Session 4, League Finals*. Teams, rules, access codes, and volunteer profiles belong to the whole league. What happens during a session belongs to that session. |

The format is chosen when the event is created (**Create VEX Event → Event Format**). It is stored on the server (`events.event_format`). It cannot be changed afterwards, because changing it would mix or orphan session data. Events created before this feature have no stored format and are Tournaments.

Setup: run `supabase/refos-2-league-events.sql` once in the Supabase SQL Editor (see the README's SQL table). Run it and deploy the matching build together: see [Deploying](#deploying).

---

## Sessions

Each session has a name, an order, a date, optional start and end times, a type (**League Session** or **League Finals**), and a status (**Upcoming**, **Active**, **Completed**).

- **Only one session is Active at a time.** The database enforces this. Starting a session marks the previously Active one Completed.
- **Admins and the Developer** can **Create**, **Edit**, **Reorder** (up and down arrows), **Start**, **Complete**, **Mark Upcoming**, and **Delete** sessions. Every change goes through a server function that checks for the Admin role, so a Referee cannot change sessions even by calling the database directly.
- **Deleting a session:**
  - A session that holds any records (matches, violations, field log entries, nominations, alliances, attendance, robot photos, or imported snapshots), or that was ever started, is deleted only after the Admin types the session's exact name.
  - The confirmation lists what will be removed.
  - An empty Upcoming session (a typo, say) deletes without confirmation.
  - The Active session cannot be deleted.
- Creating a League offers **Create First Session** (name and date). It is optional: later sessions are added any time from the League Overview.

### League Overview

The League Overview shows:

- the league name
- the Active session and the next session
- the number of teams, sessions, and completed sessions
- every session in order, with its status, date, time, and attendance count

Admins also get the session management controls here.

It opens from:

- the session name under the event name in the header (all roles)
- **Event Command Center → League Sessions** (Admin)

### Active session (which session a device works in)

- A device opening a League goes straight into the **Active** session. Nobody chooses a session each time.
- The session name is shown under the event name in the header.
- **If no session is Active**, the League Overview is shown instead of the workspace. Nothing can be recorded until an Admin starts a session, so records never land in an arbitrary session.
- When a device is in a session that is no longer Active (for example, an Admin started the next session), a banner says so and offers **Go to <Active session>**. Switching takes one tap. The device does not jump on its own mid-entry.
- An **Admin** can work in any session, for example to fix a completed session or import into it. The workspace then shows a banner saying the session is not the Active one. This choice lasts for that browser tab only; a new tab or device follows the Active session again.
- Referees, Judge Advisors, Emcees, and Inspection always work in the Active session.

---

## What belongs to the league and what belongs to a session

| Data | Scope | Notes |
|---|---|---|
| Teams (`teams`) | **League** | Imported once. Never duplicated per session. |
| Rules (`rules`) | **League** | One rule set per league, seeded from the default template once at creation. The Official Q&A link is the event's ruleset link. |
| Access codes and roles (`event_access_credentials`, `event_members`) | **League** | One set of codes works in every session. Developer Super Admin works unchanged. |
| Volunteer profiles (name, phone, Event Contact Directory) | **League** | Kept per event on the device and in league-wide `volunteer_contact` field log entries. |
| Branding, field names, countdown, volunteer assignments, contact directory (`event_settings`) | **League** | |
| Watchlist notes (`watch_notes`) | **League** | Context about a team that carries between sessions. |
| Key volunteer roster (`ref_roster`) | **League** | |
| Matches (`matches`) | **Session** | |
| Violations (`violations`) | **Session** | |
| Field log (`field_log`): timeouts, field faults, replays, AWP checks, help requests and acknowledgements, announcements | **Session** | |
| Field log: volunteer profiles, access-code requests and updates, sync and system tests | **League** | These kinds are never session-stamped. |
| Field reset checks (`field_reset_checks`) | **Session** | |
| Alliances (`alliances`) | **Session** | Normally only League Finals uses them. |
| Award nominations and finalists (`nominations`, `shortlist`) | **Session** | |
| Attendance (`league_session_attendance`) | **Session** | Present or Absent for a league team in one session. |
| Robot inspection photos | **Session** | Stored in a session folder on the same team record (see below). |
| Imported qualification rankings, W-L-T records, skills, and the judging rank order | **Session** | Kept as each session's own snapshot (see below). |
| Who is online (presence) | **Session** | Key Volunteer Status shows who is online in the current session. |

Session-scoped tables have a `session_id` column. It is NULL for every Tournament row, which includes all existing data. A foreign key on (`event_id`, `session_id`) means a record can only belong to a session of its own event.

---

## Tournament Manager imports (no TM API)

The existing CSV import system is used unchanged. In a League:

- **TM Sync Center** shows **League: <name>** and **Import Into: [Session ▼]**, preselected to the session the device is working in (normally the Active session).
- Choosing another session (Admins only) switches the device to that session and reopens the Sync Center, so every file is imported into the session shown.
- Every import preview starts with **Into <Session>**, so the target is confirmed before anything is written.
- Matches, rankings, skills, alliances, and results go only into that session. Teams found in the files are added to the league roster.

**Reimports** keep the existing duplicate-safe behaviour. A match's identity in a League is **event + session + phase + match number**, so reimporting Session 3's `Match.csv` updates Session 3's matches. It never creates duplicates and never touches Session 2 or Session 4.

### Match number collisions

Every session can have Qualification 1, 2, 3, and so on.

- **Database:** the primary key of `matches` is now (`event_id`, `session_key`, `phase`, `num`). `session_key` is a generated column: the session id, or an all-zero UUID for Tournaments, so Tournament match identity is exactly what it was. The same applies to `field_reset_checks` (match id + quadrant), `alliances` (seed), and `shortlist` (award + team).
- **App:** a device loads only its working session's matches, violations, field log, reset checks, nominations, and alliances. Inside one session, match numbers are unique again, so every screen that keys data by match number (schedule, match detail, AWP, replays, field reset, violation match references) works as it does in a Tournament.
- **Offline caches and queued writes are per session.** A violation or robot photo queued while offline keeps the session it was recorded in, even if the device moves to another session before it uploads.
- **Older builds:** a session-scoped row written without a session (for example by a device still running an older build) is placed in the league's Active session by a database trigger, or refused if no session is Active.

---

## Rankings and skills history

Ranking (`rank.csv`), W-L-T, and Robot Skills files imported into a session are stored as **that session's imported snapshot**. They are kept in event settings under `<key>@<session id>`. Earlier snapshots are never overwritten.

**Rankings** (Admin) has a **Session** selector: the current session or any previous session. Each snapshot is labelled *"Imported Tournament Manager snapshot from Session N"*.

Ref OS does **not** calculate cumulative league standings. If Tournament Manager exports cumulative league rankings at a session, they appear exactly as imported, labelled as that session's snapshot.

---

## Violations and team history

- A League violation records the event, session, match, team, rule, severity (Minor, Major, or Inspection, unchanged), referee, and time. Every violation card shows its session, for example *Session 3 · Q17*.
- **Team detail** shows the current session's log. **League history** lets you choose *Entire League* or a single session. Entire League lists every session's violations in session order.
- History is context only. Repeat-violation and escalation views use the current session's violations only. A Session 1 violation never counts as a Session 3 violation.

---

## Inspection across sessions

- Robot and team identity stay league-wide.
- Inspection photos taken in a league session are stored as `<event>/team/<TEAM>/s-<session id>/<angle>-<id>.webp`. The existing compression, local cache, cloud bucket, upload queue, and storage permissions are unchanged; the session is one more folder under the team's existing photo folder.
- Each session starts with no inspection photos. Retaking a photo replaces only the same angle **in the same session**. Session 1 evidence is never overwritten by Session 3.
- **Robot detail** shows the current session's photos, plus an **Other sessions** section with earlier sessions' photos (read only).
- **Clear Data → Robot pictures** in a League clears only the current session's pictures.

## Judging

Judging stays available in every session but is not required in any. Nominations, finalists, and the judging rank order belong to the session they were made in. No judging data is created for sessions that do not use judging.

## League Finals

League Finals is a session with the type **League Finals**, inside the same league. It is not a separate event. It can have qualification matches, alliance selection, elimination matches, skills, judging, inspection, and violations. The existing alliance selection and elimination bracket work against the Finals session's own alliances and matches. Bracket size and best-of settings are the event's existing setup values.

---

## Event Command Center

For Leagues only, the Command Center shows:

- the league name
- the session being worked in, with its status and date
- a note when that session is not the Active one

The counts on the page are for that session. **League Sessions** opens the session management. Tournaments show none of this.

## Choose VEX Event

League events show **League • <Session> Active** (or **League • No session active**). Tournaments show **Tournament**. Archived leagues show the number of sessions.

## Archive, restore, and permanent deletion

- **Archive** applies to the whole league. Sessions are not archived separately. While archived, sessions cannot be changed.
- **Restore** brings back the whole league with every session, its status, and its data.
- **Permanent deletion** removes the league, every session, and all session-scoped records, using the existing protected deletion. Cloud photo cleanup is queued as before.
- Highlander Summit protections are unchanged, and Highlander can never become a League.

## Local Venue Server

Venue-synced violations, field log entries, and presence carry `session_id` in their data. The venue server validates it as a UUID.

A device shows only its working session's venue records (plus league-wide field log kinds). A venue server running Session 3 therefore never mixes its data with Session 1.

Venue exports keep each record's `session_id`. Cloud remains the default. Cloud reconciliation is still not implemented.

---

## Deploying

1. In the Supabase SQL Editor, run `supabase/refos-2-league-events.sql`. It is safe to re-run.
2. Deploy the new build right away.

Between steps 1 and 2, devices still running the old build cannot save match schedules, alliances, field reset checks, or award finalists. Those tables' keys now include the session. Devices pick up the new build when they refresh.

A new build deployed **before** the SQL is run keeps working for Tournaments, using the old keys automatically. Creating a League then explains that the SQL file must be run first.

## Known limitations

- Cumulative league standings are not calculated by design. Only imported snapshots are shown.
- Bracket size, best-of, and match-count setup values are league-wide, not per session.
- Watchlist notes, the event countdown, and volunteer assignments are league-wide.
- Admins choose a non-Active session per browser tab. Other roles always follow the Active session.
- PDF and CSV exports cover the session being worked in.
- League Overview polling: devices check for session changes every 30 seconds, on focus, and through realtime while in a session. A referee waiting on the overview may take up to 30 seconds to enter a newly started session.
