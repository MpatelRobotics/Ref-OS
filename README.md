# Ref OS

**Ref OS by Maharshi Patel**

Ref OS is a referee operations and event coordination platform built specifically for VEX Robotics competitions. It brings referee, field, judging, inspection, event administration, and Tournament Manager related workflows into one shared, event-scoped workspace that runs on phones, tablets, and desktop operations stations.

Ref OS was originally developed for the Highlander Summit Signature Event and has since evolved into a multi-event platform: one deployment can host several independent VEX events, each with its own access codes, data, branding, and lifecycle.

> Ref OS is independently developed. It is not an official product of VEX Robotics, Innovation First International, or the Robotics Education & Competition Foundation.

---

## Contents

- [Ref OS 2.0: multi-event platform](#ref-os-20-multi-event-platform)
- [Event lifecycle](#event-lifecycle)
- [League events](#league-events)
- [VEX IQ events](#vex-iq-events)
- [VEX Events API integration](#vex-events-api-integration)
- [Roles](#roles)
- [Tournament Manager Sync Center](#tournament-manager-sync-center)
- [Referee and field operations](#referee-and-field-operations)
- [Judging](#judging)
- [Event Command Center](#event-command-center)
- [Event Settings](#event-settings)
- [Event Management](#event-management)
- [Robot photos](#robot-photos)
- [Offline and installable app](#offline-and-installable-app)
- [Local Venue Server (optional)](#local-venue-server-optional)
- [Security and event isolation](#security-and-event-isolation)
- [Highlander Summit](#highlander-summit)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Attribution](#attribution)
- [Disclaimer](#disclaimer)

---

## Ref OS 2.0: multi-event platform

Every VEX event in Ref OS is an independent workspace identified by its own UUID. Teams, matches, rankings, violations, judging data, field logs, settings, photos, and access codes all belong to exactly one event.

| Capability | What it means |
|---|---|
| **Multiple independent events** | One deployment hosts many VEX events side by side. |
| **Choose VEX Event** | Devices start by selecting an event. The selection survives a browser refresh; *Choose or configure an event* and *Lock This Device* return to the selector. |
| **Event-specific access codes** | Each event has its own Admin code and role codes. A code for one event does not work in another. |
| **Event-scoped data isolation** | Database access rules are evaluated per event, so a device signed in to one event cannot read another event's data. |
| **Event-specific branding** | Each event can set its display name, short name, logo, and accent color. |
| **Event-specific field names** | Field 1, Field 2, and Field 3 can be renamed per event without changing imported match data. |
| **Event search and autofill** | Find an event using its full RE or VE event code, or filter USA events by state/territory and date range, then select from the results dropdown. Autofill imports event details and teams. |
| **Tournament Manager driven setup** | Import match schedules, scores, alliances, skills, and other competition data from Tournament Manager exports. |
| **Archiving and restoration** | Finished events can be archived out of the active list and restored later with all data intact. |
| **Protected permanent deletion** | Archived events can be permanently deleted only through confirmation-protected workflows. |

---

## League events

Every event is either a **Tournament** (the original format, and the default for every existing event, including Highlander Summit) or a **League**: one event that holds several league sessions, such as *Session 1 … Session 4* and *League Finals*. The format is chosen in **Create VEX Event** and stored on the server.

- **League-wide:** teams (imported once, with per-session attendance), rules, access codes, volunteer profiles, branding, and settings.
- **Per session:** matches, violations, field log, field reset checks, alliances, judging, inspection photos, and imported ranking and skills snapshots.
- **Active session:** devices open straight into the Active session, shown under the event name. With no Active session, the League Overview is shown instead, so records never land in an arbitrary session.
- **Session management:** Admins (and the Developer) create, edit, reorder, start, complete, and delete sessions from the League Overview or **Command Center → League Sessions**.
- **Tournament Manager imports:** the existing CSV imports go into the selected session (**TM Sync Center → Import Into**). Session 1 Q1 and Session 2 Q1 are separate matches, and reimports update only their own session.
- **Converting a Tournament:** an Admin can convert an existing Tournament into a League (**Event Settings → Event Format → Convert to League**). Its data becomes the first session. The conversion is one-way, runs as a single server-side transaction, and is never available for Highlander Summit.
- **History:** team history can show the entire league or one session. Rankings and skills show each session's imported snapshot. Ref OS never invents cumulative standings.

Details, including the full league-wide versus session table, are in [`LEAGUE-EVENTS.md`](LEAGUE-EVENTS.md).

---

## VEX IQ events

During **Create VEX Event**, choose **VEX IQ** or **V5RC / VEX U**, as well as **Tournament** or **League**. Competition program and event format are separate choices. An Admin can also change the program in **Event Setup**. Existing events default to V5RC / VEX U; successful VEX Events autofill identifies the program from the returned event details.

For IQ events, the Rules tab provides:

- **78 searchable rule references** grouped by category, with rule codes and brief descriptions from the Level Up manual's quick-reference list. These summaries help locate a rule; use the full manual for conditions, exceptions, and rulings.
- The bundled **VEX IQ Level Up 2026–2027 Game Manual, version 2.0 (September 3, 2026)**. **Read IQ manual** and **Open PDF** open an in-app viewer with **Back to Ref OS**, including on mobile. **Download manual** saves a separate copy.
- Offline manual access after the updated app finishes downloading its offline files. The bundled edition does not automatically track later official revisions.

IQ workflows now include **two-partner teamwork matches**, **one shared score**, a **Level Up bag-count scoring aid**, **ranked partner finals**, IQ violation rule choices, imported qualification averages/skills, and inspection preparation. IQ Event Setup and match screens omit the V5 elimination bracket, best-of-three finals, AWP, and opposing-alliance timeout controls.

Use **Matches → Import IQ schedule / results** with the official TM export. Supported CSV columns are `Round,Match,Team1,Team2,Field,Score`; blank scores retain saved results. Review before applying. In **Finals**, select the match count and preview ranks 1 + 2, 3 + 4, and so on; the lowest seed plays first. Saved scores update Ref OS only. TM remains the official source for rankings, excluded scores, no-shows, League eligibility, skills attempts and finals tiebreakers.

**Setup:** run [`supabase/iq-competition-program.sql`](supabase/iq-competition-program.sql) in the Supabase SQL Editor after the existing schema and event-settings migration. This read-only function lets Inspection devices identify IQ without exposing other settings. Then publish the frontend. No VEX Edge Function redeployment is needed for these workflows.

The inspection checklist is temporary and does not certify a pass. Photo completion indicates reference photos, not inspection certification. Individual skills attempts and automatic finals tiebreakers are not recorded/calculated in Ref OS. IQ uses individual TM imports; the V5 multi-file package classifier and IQ API rankings sync are not enabled. An IQ-specific Official Q&A link is not implemented. Detailed instructions, export formats and limits are in [`IQ-WORKFLOWS.md`](IQ-WORKFLOWS.md).

---

## VEX Events API integration

Ref OS uses the VEX Events API through the Supabase **`vex-event-lookup`** Edge Function. The API token stays on the server. Tournament Manager remains the source for match schedules, scores, alliances, and skills imports.

### Event autofill and USA event finder

**Two ways to find an event:** search by its full **RE or VE event code**, or **filter USA events by state or territory and date range**, then select the event from the dropdown. Both routes load event details and the team roster for review before creation.

1. Open **Choose VEX Event → Create VEX Event**.
2. Enter the full event code (both `RE-` and `VE-` formats are supported) and choose **Look up**. Alternatively, select a US state or territory and a date range of up to one year, choose **Find events**, select an event from the dropdown, and choose **Use selected event**. **Load more events** retrieves later result pages; the displayed count is the number loaded so far. Location search currently covers the USA only.
3. Review the event name, dates, location, program, and team roster. Choose Tournament or League and enter a separate Ref OS Admin access code.
4. Create the event. Ref OS saves its metadata and roster. For a League, the start date initializes the editable first-session date; autofill does not create every session.

Manual creation remains available if lookup fails. If an event is created but its roster cannot be saved, import teams into that existing event through TM Sync Center rather than creating a duplicate.

### Qualification rankings sync

Available to cloud Admins in V5RC / VEX U events from **Rankings → VEX API Sync** or **Event Command Center → VEX API Sync**:

1. Confirm the saved event code. Divisions load automatically when a saved code is available; a single division is selected automatically. For a multi-division event, choose the division to import.
2. Review the qualification rankings preview and confirm the target event and, for a League, the working session.
3. Choose **Import once** for one update, or **Start syncing** to import and enable checks once a minute. The dialog closes so the rest of the app remains usable.
4. Use **Manage VEX sync** or **Stop sync** in the status bar to manage updates.

The code is retained in the event settings after a successful lookup. Automatic checks continue while Ref OS is open, visible, and online, even with the dialog closed. They stop on errors, switching events or League sessions, signing out, or reloading. This is polling of published API data, so updates may lag scoring; it does not run while the app is closed or suspended. Empty snapshots keep existing data. Failed writes may partially succeed; review and retry the snapshot.

**API sync is limited to qualification rankings.** Matches, scores, alliances, and skills use Tournament Manager imports. Each selected division is imported into the current target; Ref OS does not merge standings across divisions or calculate cumulative League standings.

### Team event history

At the bottom of team history, **Registered & Past Events** retrieves the exact team's associated events in a bounded past-year to next-year window. Upcoming events appear first. Successful results are cached on the device for offline viewing and reused for 15 minutes; **Refresh events** requests an update. The API's associated-event list does not guarantee registration status or include every future registration. Ambiguous team numbers show an error instead of selecting a different program's team.

---

## Event lifecycle

```
Create Event
  → Configure Access
  → Import Tournament Manager Data
  → Configure Event Settings
  → Operate Event
  → Archive
  → Restore  OR  Permanently Delete
```

1. **Create Event.** From *Choose VEX Event*, select *Create VEX Event*, enter an event name (or use VEX Events autofill), choose VEX IQ or V5RC / VEX U and Tournament or League, and set the event's Admin access code. This creates an event with its own UUID; VEX autofill can also populate its metadata and team roster.
2. **Configure Access.** Sign in as Admin and set the Referee, Judge Advisor, Inspection, and Emcee access codes from the Event Command Center.
3. **Import Tournament Manager Data.** Use the TM Sync Center to import teams, schedule, rankings, skills, alliances, and results.
4. **Configure Event Settings.** Set the event name, short name, logo, accent color, and field names.
5. **Operate Event.** Volunteers sign in with their role codes and work from the shared, live workspace.
6. **Archive.** When the event is over, an Admin archives it from *Event Management*. Archiving removes it from the active event list. **It does not delete any event data.**
7. **Restore or Permanently Delete.** An archived event can be restored with its data intact, or permanently deleted through a protected workflow.

---

## Roles

Access is granted by entering an event's role code on that event's login screen. The server validates each code and assigns the corresponding role for that event only.

| Role | Workspace |
|---|---|
| **Admin** | Full event workspace plus the Event Command Center, Rankings, event configuration, access management, imports, exports, and data management. |
| **Referee** | Matches, Teams, Rules, Robots, Alliances, and Judging views; violation logging, field log, AWP checks, field reset checks, and robot photos. |
| **Judge Advisor** | Focused judging workspace: award nominations, finalist selection, nomination exports, and alliance information. |
| **Inspection** | Robots and Rules only: capture the required robot inspection photos for each team. |
| **Emcee** | Event, match, alliance, and judging information for announcing, without referee editing controls or exports. |

Volunteers create a short identity profile on first sign-in (nickname plus first and last name). The nickname is used in the live app; the full name appears on official exports and in the Event Contact Directory.

---

## Tournament Manager Sync Center

Tournament Manager remains the source of truth for competition data. Ref OS imports that data so the event crew can work with it; it does not replace Tournament Manager.

The TM Sync Center (Event Command Center → *TM Sync Center*) supports:

- **TM Driven Event Setup / Import TM Event Package.** Select several Tournament Manager CSV or JSON exports at once. Ref OS identifies each file by its name and contents, reports any unrecognized files or duplicate categories, and imports them in order: teams, matches, rankings, skills, alliances, scores.
- **Individual category imports** for updating a single category during the event without re-importing everything:
  - Teams
  - Match schedule
  - Qualification rankings
  - Skills Challenge rankings
  - Alliance selection (Round of 16 pairings)
  - Match results and scores
- **Change previews before writes.** Every import shows what will be added, changed, or left untouched, and nothing is written until the Admin applies the changes.
- **Event scoping.** Imports only ever write to the currently selected event.

---

## Referee and field operations

**Violation tracking**
- Log **minor**, **major**, and **inspection** violations against a team, citing the rule and match.
- Attach notes and photos; edit or delete entries with the appropriate permissions.
- An eight-second Undo is offered after saving a new violation or robot photo.
- Review violation history by team, match, and rule, with repeated minor violations of the same rule surfaced for escalation review.

**Matches**
- Match schedule with field filters, match and team search, red and blue alliances, and match details.
- Match readiness cards for AWP checks, field reset status, match violations, and replays.
- Replay flags require a reason (field fault, scoring or timer issue, match started incorrectly, safety interruption, external interference, or other).

**Field operations**
- **Field Log** for timeouts, field faults, replays, and other field events.
- **AWP checks** per qualification match, plus AWP History and Analytics for Admins.
- **Field reset quadrant checks** with a shared *Field Ready* status.
- Field comparison analytics for Admins.

**Teams, rankings, and alliances**
- Team roster with violation totals, rankings, watch notes, and team history.
- A camera-based team number scanner (OCR; requires a connection to load its recognition library).
- Alliance selection and elimination bracket information.

**Rules**
- **V5RC / VEX U:** searchable event rule library, initially copied from the V5RC Override 2026–2027 default template. Each event's library is independent and can be imported from CSV. **VEX IQ:** the Rules tab shows the bundled Level Up quick-reference list instead; see [VEX IQ events](#vex-iq-events).
- **Game Manual** for V5 events opens the bundled Override 2.0 manual. IQ events offer the bundled Level Up 2.0 manual with an in-app Back button. Both are available offline after the app's offline files finish downloading.
- **Official Q&A** opens the official VEX Q&A for the season in a new browser tab. It needs an internet connection; offline, Ref OS says so instead of opening it. The link is set per season in `src/officialResources.js`, not in individual components. Ref OS only links to the Q&A; it does not copy or download it.

**Coordination**
- **Request Help** from any role, with a location and category, visible live to the crew; an Admin acknowledgment is shown to everyone.
- **Key volunteer announcements** and a shared **event countdown**.
- **Key Volunteer Status**: who is online, their role, and their assignment (fields, pit, skills, judging, and other locations).
- **Event Contact Directory** built from volunteer profiles, plus Admin-managed leadership and support contacts.
- **Push notifications** for help requests and access-code requests on devices that enable them. On iPhone and iPad, Ref OS must first be added to the Home Screen. Ref OS does not send email notifications.

---

## Judging

The Judging workspace supports the **Sportsmanship** and **Energy** awards:

- Nominate a team for an award, with the nominating volunteer recorded.
- Mark finalists (shortlist) per award.
- Admins can set a ranking order for award candidates.
- Export nominations on the official nomination forms (PDF).
- Violation history is available alongside judging information for context.

Judge Advisors see the judging workspace and alliance information. Emcees can view judging information but cannot export.

---

## Event Command Center

The Event Command Center is the Admin-only hub for event administration. Current tools include:

| Area | Tools |
|---|---|
| **Event configuration** | Event Settings, Event Management, Event setup (competition program, match counts and bracket format), TM Sync Center, VEX API Sync (qualification rankings) |
| **Access** | Volunteer Access Codes, Key Volunteer Status (including granting Admin to an online volunteer), Reset Volunteer Sign Ins |
| **Communication** | Key volunteer announcements, countdown management, Event Contact Directory, event alert counter |
| **Readiness and health** | Pre Event System Test, Two Device Sync Test, offline readiness test, Admin Diagnostics, failed sync items (retry or discard) |
| **Records and exports** | Export violations, Export nominations, Export event report (PDF), Backup all JSON, Activity feed |
| **Analytics** | Rankings, AWP History and Analytics, event activity summary |
| **Data management** | Clear event data (selective categories, including robot photos), protected by confirmation |

---

## Event Settings

Each event can configure its own identity from *Event Command Center → Event Settings*:

- Event name
- Short name (used where space is limited, such as the phone header)
- Logo (image URL, with a live preview)
- Accent color (color picker and hex value)
- Field 1, Field 2, and Field 3 display names

Branding values resolve in this order:

```
saved event setting  →  built-in event profile  →  Ref OS default
```

The accent color is branding only. Violation, warning, and success colors keep their meaning. Field names are display labels: the underlying field identifiers in matches, field logs, and AWP data do not change, so historical records keep working.

The event name, short name, logo, and accent color also appear on *Choose VEX Event* and on the event's login screen. Highlander Summit keeps its built-in branding unless an Admin explicitly overrides it.

---

## Event Management

*Event Command Center → Event Management* shows the event name, event ID, status, creation date, and the signed-in role, and provides the event's lifecycle actions.

- **Active events** appear on *Choose VEX Event*.
- **Archived Events** are listed separately behind an *Archived Events* control, with the event's branding and archive date.
- **Archive.** Requires typed confirmation. Only an Admin of that event can archive it. Archiving changes lifecycle state only; no data is deleted.
- **Restore.** An archived event can be restored from *Archived Events* by that event's Admin. The event returns to the active list with the same UUID and all of its data, settings, branding, and access configuration.
- **Permanent deletion.** Available only for **archived** events, from *Archived Events*. It requires typing the exact event name and entering an authorized code (normally the event's Admin access code), and it removes the event and all of its Ref OS data in a single all-or-nothing operation. A separate, restricted deletion path exists on an event's login screen for event owners who have lost their Admin access; it is authorized separately and is not published.
- **Protected events** (including Highlander Summit) cannot be archived or permanently deleted.

Links to an archived event show an *event archived* screen instead of that event's login. Links to a deleted event return to *Choose VEX Event*.

---

## Robot photos

Robot photos are shared across every device signed in to the same event.

- **Compressed in the browser before upload.** Photos are resized (longest side up to 1440 px), orientation-corrected, re-encoded as WebP where the browser supports it (JPEG otherwise), and stripped of camera metadata. The full-resolution original is never uploaded, and the system rejects photos it can't compress with an error rather than uploading them as-is. Compression substantially reduces storage compared with full-resolution uploads; actual savings vary by photo.
- **Shared cloud copy.** Supabase Storage is the source of truth, so every device at the event sees the same photos.
- **Local device cache.** Each device keeps an IndexedDB cache of photos it has viewed or uploaded, so repeat views don't download again.
- **Offline viewing.** Previously cached photos stay visible offline. A photo the device has never downloaded shows as unavailable while offline.
- **Replacements.** Retaking a required photo (front, back, side, inspection tag, Lexan diagram) replaces the previous one across devices and removes the old cloud copy.
- **Event-scoped storage.** Photo objects are stored under the event's ID, so they are isolated per event and can be identified for cleanup.
- **Deletion cleanup.** Permanently deleting an event removes that event's cached photos from the deleting device and triggers a server-side cleanup of its cloud photo objects.

Violation evidence photos use their own, separate compression settings and are attached to the violation record.

---

## Offline and installable app

Ref OS is built for venues with unreliable Wi-Fi and cellular service.

- **Installable app.** Ref OS can be added to the home screen and works as an installed app, with update notifications when a new version is available.
- **Durable outbox.** New violations and robot photos are saved on the device immediately and upload automatically when the connection returns. The interface shows connection health, pending items, and the last successful sync.
- **Cached reads.** Recently loaded teams, matches, and rules, previously viewed robot photos, and the app shell remain available offline. The bundled Override and IQ Level Up manuals are available offline after the offline files finish downloading.
- **Live updates** arrive through Supabase Realtime when connected.

Offline support protects work created on that device. Seeing new information entered by other volunteers, signing in, imports, exports, and administrative changes all require a connection, unless the event uses the optional Local Venue Server described next.

---

## Local Venue Server (optional)

For venues with poor internet, an event can run the **Ref OS Venue Server** on a computer at the venue, such as a Tournament in a Box mini PC or a Raspberry Pi. Devices on the venue network then keep sharing live operations data through that computer when the internet is down. Cloud (Supabase) remains the default; each device is switched individually by an Admin (Event Command Center → **Sync & Venue Server**), or automatically when it opens Ref OS from the venue server's own address.

- **Shared through the venue server (Phase 1):** violations, field log entries (timeouts, faults, replays, AWP checks, help requests, announcements), the volunteer roster, and who is online.
- **Still needs Supabase and the internet:** signing in, Developer sign-in, event creation and settings, Access Management and access codes, archive, restore, and deletion, Tournament Manager imports, judging, robot and inspection photos, and push notifications.
- **Offline queue:** each device keeps unsent changes and sends them when the venue server is reachable. Nothing is silently discarded.
- **No automatic cloud copy yet.** Venue data is not copied into Supabase in this version. Use **Export Venue Data** after the event.
- **Security:** the venue server never receives access codes, the Developer credential, or Supabase keys. Each event has its own venue sync key, which Supabase issues only to devices signed in to that event.

Setup for Windows and Raspberry Pi, firewall steps, backups, and the API are in [`VENUE-SERVER.md`](VENUE-SERVER.md). The server is in `venue-server/`, needs Node.js 22.13 or newer, and has no npm dependencies.

---

## Security and event isolation

- **Event-scoped architecture.** Each event has its own UUID, and event data is tied to that ID.
- **Server-side access validation.** Access codes are checked by the database, not the browser, and grant a role for one event only. Lifecycle operations that accept a code (restore and permanent deletion) rate-limit repeated incorrect attempts.
- **Role-specific access.** Database row-level security enforces what each role can read and change; hiding a button is never the only protection.
- **Credentials stored as hashes.** Access codes are stored as one-way hashes, never in plain text, and are never sent to the browser.
- **Protected lifecycle operations.** Archive, restore, and permanent deletion are enforced server-side, including Admin authorization, the archived-before-delete rule, and protection for protected events.
- **Privileged keys stay on the server.** Service-role and notification credentials are used only by Supabase Edge Functions and are never included in the frontend.

Share access codes only with volunteers assigned to the corresponding role at that event.

---

## Highlander Summit

Highlander Summit was Ref OS's original production event. It keeps a built-in event profile (name, logo, and branding), its bundled Override 2.0 Game Manual and rules, and its existing historical data.

Highlander Summit is a protected event: it cannot be archived or permanently deleted.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, Tailwind CSS, lucide-react icons |
| Backend | Supabase: PostgreSQL with row-level security, Auth (anonymous device sessions), Realtime, Storage, Edge Functions (Deno) |
| Device storage | IndexedDB (upload outbox and photo cache), localStorage (preferences and cached reads) |
| Installable app | Web app manifest and service worker |
| Documents | pdf-lib (PDF exports and nomination forms), qrcode (access code QR codes) |
| Testing | Playwright (end-to-end) |

---

## Project structure

```
src/
  App.jsx                  Event selector, login flow, and the main event workspace
  api.js                   Supabase data access (events, teams, matches, photos, lifecycle)
  officialResources.js     Per-season official links (Official Q&A)
  iqLevelUpRules.json       Bundled IQ rule codes and quick-reference descriptions
  iq/                      IQ teamwork, shared scoring, ranked finals and inspection aids
  sync/                    Sync mode (Cloud or Local Venue Server) and venue server sync
  league/                  League Overview, session management, and league display helpers
  eventProfiles.js         Built-in event profiles and branding resolution
  outbox.js                Offline write queue (IndexedDB)
  photoCache.js            Local robot photo cache (IndexedDB)
  photoCompression.js      In-browser robot photo compression
  auth/                    Login screen, identity, and access-code management
  components/              Event Command Center and shared components
  components/modals/       Event Settings, Event Management, delete confirmation, and other dialogs
  features/                Field reset checks and team scanner
public/                    Icons, logos, service worker, manifest, manual pages, forms
supabase/                  SQL migrations (run in the Supabase SQL Editor)
supabase/functions/        Edge Functions (including vex-event-lookup for VEX API integration)
scripts/                   Build-time and setup helper scripts
tests/                     Playwright tests
tm-bridge/                 Optional Tournament Manager bridge utility
venue-server/              Optional Local Venue Server (Node.js + SQLite); see VENUE-SERVER.md
```

---

## Attribution

Ref OS was designed and developed by **Maharshi Patel**.

If Ref OS, or substantial portions of its code, architecture, interface design, or workflows, are reused in another project, please credit:

> **Ref OS by Maharshi Patel**

A link back to this repository is appreciated when practical.

This repository does not currently include a software license. Contact the author before reusing the code in another project.

---

## Disclaimer

Ref OS is independently developed and is not an official product of VEX Robotics, Innovation First International, or the Robotics Education & Competition Foundation. Public availability does not imply endorsement or maintenance by any of these organizations.

VEX, VEX Robotics, and related names and marks belong to their respective owners.

### Developer feedback management

In **Features & Help → View Feedback**, a verified Developer can mark submissions **New**, **In progress**, or **Resolved**, search by sender/message, and filter by status. Existing feedback starts as New. Status changes preserve the original message and are shared through Supabase; use **Refresh statuses** to load changes from another Developer device. The list stays scoped to the current event/League session. Status changes require a cloud connection and are not queued offline or synced through Local Venue Server.

Run [`supabase/feedback-management.sql`](supabase/feedback-management.sql) in the Supabase SQL Editor after the base schema and `refos-2-developer-access.sql`. This adds separate status records and database-enforced Developer-only read/write functions. Ordinary Admin access cannot change statuses. No Edge Function redeployment is needed. Until setup succeeds, messages remain readable but status controls are disabled with a setup/connection message.
