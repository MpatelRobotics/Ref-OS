# Ref OS

**Referee Operating System for live VEX Robotics events**

Ref OS is a shared operations app for VEX robotics events. It gives referees, inspectors, Judge Advisors, Emcees, and event administrators one live place to coordinate match activity, record violations, document robots, monitor field readiness, share role information, and respond to event day issues.

Ref OS 1.0.0 began as the Highlander Summit Release created by Maharshi Patel. Highlander retains its bundled Override manual and rules. Other organizers can create a separate event through the Event Configurator, import their own teams, matches, rankings, and rules, and generate volunteer role access codes. Each event has separate server data and device identity. New events do not inherit Highlander's manual or rule index.

## Configure another event

1. Run `supabase/multi-event-configurator.sql` in the Supabase SQL Editor before deploying the multi event interface.
2. From the login screen, choose **Choose or configure an event**. Enter the separate configurator login code provided by the owner.
3. Enter the event name, qualification and practice match counts, elimination bracket, finals format, and an organizer Admin password of at least 12 characters. Save the password securely.
4. After creation, copy the event link and open the new event. In Admin mode, generate the referee, Judge Advisor, and Emcee codes, then share each code with its intended volunteers along with the event link.
5. In the event settings menu, import a rules CSV with `code` and `description` columns, optionally `category`. Use Tournament Manager Sync Center to import teams and the match schedule. Event setup and field names can be changed later from the Command Center.

The new event link contains an event ID; volunteers still need a valid role credential. Event data is isolated by event membership and server rules. Highlander's fixed backup credentials do not apply to new events. The bundled Override manual and its page navigation remain available only in Highlander. The bundled judging export forms and some game specific operational tools should be reviewed for a different game before relying on them. Email help alerts are wired only to Highlander's configured Admin addresses; new events can use event scoped push notifications. Deploy the updated `send-code-request-push` Edge Function to enforce that email separation.

## One live event workspace

Everyone works from the same event record. Updates made by one volunteer appear for the rest of the crew within seconds, helping field and judging teams stay aligned without passing around separate spreadsheets, paper logs, or chat messages.

The interface adapts to phones, tablets, and desktop operations stations. Mobile devices use quick bottom navigation and touch friendly sheets. Desktop devices use a wider operations layout with persistent navigation and event tools.

Each volunteer creates a required identity profile with a nickname plus first and last name. Ref OS uses the nickname throughout the live workflow. The volunteer's full name is used on official violation and judging exports and is shown with their nickname and role in the shared Event Contact Directory. A volunteer may also add an optional phone number to the directory.

New volunteers receive a three screen Quick Start covering assignments, help requests, and offline saving. It appears once per role on each device and can be reopened from Features and Help.

After saving a new violation or inspection picture, volunteers receive an eight second Undo option. Ref OS asks for confirmation before completing the undo. A violation undo cancels any pending upload, removes the cloud record, and synchronizes the removal across every connected device.

## Volunteer roles

### Referee

Referees can review the match schedule, search teams, record violations, document robot concerns, complete field reset checks, review rules, and share the active Referee join code with another referee.

### Inspection

Inspectors can access Rules and Robots. They can capture required robot pictures and the optional Lexan Diagram without seeing the other event tabs.

### Judge Advisor

Judge Advisors receive a focused judging workspace for award nominations, finalist review, alliance information, and Judge Advisor role access. They can share only the Judge Advisor join code.

### Emcee

Emcees receive the event information and match views they need without referee only editing controls. They can share only the Emcee join code.

### Admin

Admins manage event wide tools, volunteer access, announcements, countdowns, data imports, exports, role codes, system checks, field logs, and event cleanup. Admin access is enforced separately from normal volunteer roles.

## Match Center

Match Center places the event schedule, field assignments, team information, and match activity in one view.

Volunteers can:

* Filter matches by field
* Search by match number or team number
* View red and blue alliance teams
* Open individual match details
* Track replays and field faults
* Record match related violations
* Review qualification and elimination activity

When match data is available, Match Center becomes the default event workspace.

Marking a match for replay requires a reason. Volunteers can select Field fault, Scoring or timer issue, Match started incorrectly, Safety interruption, External interference, or Other, with additional details when needed. The reason appears in match readiness, the replay queue, and the Field Log.

The Match Readiness cards are interactive. Selecting AWP opens the AWP check, Field Reset opens the quadrant check, Violations jumps to the match violation history, and Replay opens the reason selector or removes an existing replay flag after confirmation.

AWP History and Analytics is kept inside Event Command Center so the field filter row stays focused on match locations. The AWP check remains available inside every qualification match.

## Violation tracking

When a violation is opened from a team page, the match selector only shows scheduled matches containing that team. The general Log Violation action continues to provide the complete event schedule.

Referees can record minor, major, and inspection violations against a team while citing the applicable rule and match. Notes and supporting robot photos can be attached when additional context is needed.

The violation form shows robot pictures on file in a compact horizontal row of bordered cards labeled Front, Back, Side, Highlander Inspection Tag, or Lexan Diagram. The row scrolls horizontally on small screens. Required views have an amber border and a Required label; older unlabeled pictures appear as Other view.

Violation history is available by team, match, rule, and event activity. Repeated minor violations of the same rule are surfaced to help the referee crew identify escalation patterns.

## Teams and robot documentation

The Teams workspace combines the event roster with violation totals, rankings, watch information, and quick access to team history.

In this Highlander Summit release, the Robots workspace requires four labeled inspection pictures for every team: Front, Back, Side, and the Highlander Inspection Tag attached to the robot after it passes inspection. Each team card shows picture completion, and the team view provides a dedicated capture slot for every required picture. An additional optional Lexan Diagram slot stores a picture of the team's Lexan or plastic diagram without changing the four picture completion count. Earlier unlabeled pictures remain available for reference.

Admin Clear Data includes Robot pictures to remove all team inspection pictures while keeping the roster and violation attachments. Pictures queued for upload on the Admin's current device are canceled too.
The reset also invalidates pictures queued on other devices before the reset, so they cannot reappear when those devices reconnect. Clearing Teams removes the inspection pictures first. Storage cleanup can be retried by running the robot picture reset again if the network interrupts it.

Take pictures in order opens a separate picture sequence dialog that walks through Front, Back, Side, and Tag, then offers the optional Lexan Diagram. The dialog has a prominent red camera button naming each picture. After each required picture is saved, the app opens the camera for the next one when the browser allows it. After the Tag, Finish without Lexan ends the sequence with all four required pictures saved. Individual capture and retake buttons remain available on the team page.

Images are compressed on the device before upload to reduce transfer time and storage use. Pictures captured without a connection are saved in the device outbox, shown immediately as queued, and uploaded automatically after connectivity returns.

## Field operations

Ref OS includes shared tools for event floor coordination:

* Field reset quadrant checks
* Field Ready status
* AWP checks and history
* Match replay records
* Field fault records
* Timeout tracking
* Match anomaly documentation
* Field comparison for administrators

Updates are shared across devices so the event crew can see current field status without relying on verbal relays alone.

Quadrant field reset screens keep the Verify control above the checklist so it remains visible on phones. Each quadrant records who verified it and contributes to the shared Field Ready status.

## Judging and alliance selection

The judging workspace supports award nominations and finalist review. Alliance selection information can be viewed by key volunteers, while editing permissions remain limited to the appropriate roles.

The alliance tools support captain and pick assignments, elimination bracket preparation, and match progression information.

## Event Command Center

The Event Command Center centralizes administrator tools and event health information. It includes access to operational summaries, AWP History and Analytics, event settings, announcements, countdown management, field name configuration, data controls, volunteer information, exports, and readiness checks. Admins can replace Field 1, Field 2, and Field 3 with the actual competition field names without changing imported match assignments. The shared names update across devices in match filters, match details, volunteer assignments, help locations, field logs, and field analytics.

Reset Volunteer Sign Ins signs every event member out, clears the volunteer roster, contact profiles, and stale assignments, then requires a fresh nickname, first name, and last name on the next login. It preserves teams, matches, violations, pictures, judging, and other event records.

Back navigation uses the same plain left chevron and Back label throughout desktop and mobile views. Back controls stay in the normal page header flow so they do not cover titles or close controls. Closing, saving, or selecting Back from an Event Command Center tool returns the Admin to Event Command Center instead of the main workspace.

## Key Volunteer Status

The live volunteer view shows who is online, who has previously joined, their role, device presence, last seen status, and current event assignment. Administrators can assign volunteers to Field 1, Field 2, Field 3, Pit Floor, Competition Floor, Skills, or Judging. They can also promote an eligible online volunteer to Admin without sharing the Admin password.

Each volunteer receives a synchronized assignment card in their workspace. Assignment changes appear automatically without requiring the volunteer to close or restart Ref OS.

On phones, the header uses a compact online volunteer count. Tapping it opens the complete scrollable status list.

## Admin email alerts

Ref OS can email two configured Admin addresses whenever a volunteer requests help or asks for a replacement role code. Email delivery runs securely from the existing Supabase Edge Function through Resend. The Resend credential, sender, and Admin addresses are stored as Supabase secrets and are never included in browser code, the repository, exports, or the event contact directory. Each request is claimed once so reopening or refreshing Ref OS does not send duplicate emails. Web push continues to operate if Resend is unavailable or has not been configured.

Configure these Supabase secrets before deploying the function:

* `RESEND_API_KEY`
* `RESEND_FROM_EMAIL` as a sender on a verified Resend domain
* `ADMIN_ALERT_EMAILS` as two email addresses separated by a comma

After saving the secrets, deploy `send-code-request-push` again.

Administrators can open **Access → Alert delivery** and select **Push only**, **Email only**, or **Both**. This event wide preference syncs across devices and defaults to Both until an Admin changes it.

The Event Command Center includes an **Event alert counter** under Admin tools. It reports the event wide number of requests and total alerts delivered across all devices. Admins can reset the counter after testing without deleting the underlying help requests or other event data. Run `supabase/alert-counter.sql` in the Supabase SQL Editor before using or resetting the counter.

## Volunteer access and join codes

Ref OS uses separate join codes for Referees, Judge Advisors, and Emcees.

Signed in volunteers can view and share only the code for their own role. Administrators can manage all role codes, generate replacements, disable codes, print login cards, and open QR codes.

If a volunteer needs a replacement code, they can request regeneration from inside the app. The request appears for administrators in real time.

## Push notifications

Referees, Judge Advisors, Emcees, and Administrators can enable device push alerts from the Access section of Settings. When a volunteer requests a new role code or sends a help request, subscribed phones, tablets, and computers receive a notification even when Ref OS is not open.

Tapping the notification opens Ref OS directly to role code management. The normal live in app request remains available as a fallback.

On iPhone and iPad, Ref OS must be installed through Add to Home Screen before push notifications can be enabled.

The per device push subscription remains separate from the event wide delivery choice. A device must have push alerts enabled before it can receive alerts when Push only or Both is selected.

## Request Help and acknowledgment

Every role can send a help request for an Admin, field issue, rules question, medical assistance, or volunteer replacement. Each request identifies Field 1, Field 2, Field 3, Pit Floor, Competition Floor, Skills, Judging, or another location. The request appears live across the event workspace and is delivered to every subscribed volunteer device.

An Admin can acknowledge the request once. Everyone then sees who acknowledged it, preventing multiple volunteers from responding to the same issue unnecessarily.

## Announcements and event countdown

Admins can publish key volunteer announcements that appear across connected devices. An event countdown can also be configured for the next major event milestone and remains synchronized for every role.

## Event contact directory

The shared contact directory keeps important event contacts available inside Ref OS. Every volunteer profile contributes the person's full name, nickname, and current role. Volunteers may optionally add a phone number so event staff can contact them quickly. Administrators can also add event leadership and support contacts, include email, location, and notes, and arrange the directory order.

The nickname is used throughout the live app. Required first and last names identify the volunteer in the Event Contact Directory and on official violation and judging exports.

## Rules and Game Manual

The Rules workspace provides searchable Override rule summaries for quick event day access. The complete Override 2.0 Game Manual is stored with Ref OS for offline use.

The full screen manual viewer includes Back, Jump to Table of Contents, and Jump to Quick Reference Guide controls on desktop and mobile devices. The mobile viewer renders manual pages directly so page jumps work consistently without relying on the phone's embedded PDF controls. Rule links inside the Quick Reference Guide remain clickable, while the Ref OS Rules list remains a reference list. Rules with referee guidance include a separate Notes control. Rule notes open at the top of a full screen phone view, so volunteers do not need to scroll down the Rules list to read them.

## Offline resilience

Ref OS is designed for competition venues where WiFi and cellular service may be inconsistent.

New violation entries and required inspection pictures are saved on the device immediately and queued for upload when a connection is unavailable. Pending entries synchronize automatically after connectivity returns. The interface shows connection health, pending activity, and the most recent successful synchronization.

Offline support protects new entries created on that device. Viewing brand new information entered by other volunteers still requires a connection.

## Realtime synchronization

Connected devices receive event changes through the shared cloud workspace. Important role code updates also use a short polling fallback so mobile devices can recover when realtime delivery is interrupted.

## Reports and exports

Administrators can export event information for review and record keeping, including violation data, field activity, judging information, match anomalies, and event summaries. Official violation and judging exports use the volunteer's required first and last name, while normal app screens continue to use their nickname.

## Features and Help

The in app Features and Help guide documents role access, volunteer profiles, push alerts, help requests, offline behavior, violation Undo, match readiness, guided robot picture capture, the offline Game Manual, Event Command Center tools, Tournament Manager imports, exports, and device settings. It distinguishes the current Highlander Summit setup from the wider goal of supporting other VEX events. It displays the installed Ref OS version so event staff can confirm that every device is using the Highlander Summit Release.

## Event day safety

Ref OS includes safeguards intended to reduce accidental event disruption:

* Admin protected destructive controls
* Selective Clear Data options
* Confirmation before permanent deletion
* Server enforced event roles
* Role limited join code visibility
* Offline write queues
* Live synchronization indicators
* Pre Event System Test
* Diagnostic reporting
* Service worker update notifications

## Privacy and access

This release is intended for authorized Highlander Summit volunteers. Join codes and Admin credentials should be shared only with people assigned to the corresponding event role.

Volunteer names, event records, device subscriptions, and operational data are stored only for running the shared event workspace. Push notification private keys remain on the server and are never exposed to the browser.

## Release

**Ref OS 1.0.0 Highlander Summit Release**

Created by Maharshi Patel for Highlander Summit event operations.

## Required Supabase update

Before deploying this version, run `supabase/reset-robot-pictures-safely.sql` once in the project's Supabase SQL Editor. It makes the robot picture reset atomic with the team picture references and rejects uploads from before the reset. Deploying the app before this SQL is applied will prevent new robot picture uploads and picture resets.

## Generic Ref OS deployment prep (2026-09-27)

- Added a generic Ref OS logo at `public/refos-logo.svg` for non-Highlander events and the Event Configurator.
- Generic event login/configurator branding uses neutral slate and blue styling rather than Highlander red branding.
- Existing Highlander event detection and legacy logo path remain intact so the current event identity is not migrated by this UI change.
- Highlander retains its existing configured Admin email alerts in `send-code-request-push`. Generic configured events are push only and cannot send to Highlander Admin email addresses.
- Generic events do not expose email delivery controls; Highlander continues to honor its existing `notification_delivery` setting.
- Before multi-event production deployment, run `supabase/multi-event-configurator.sql`, then deploy the included `send-code-request-push` Edge Function update.

## External event readiness additions

The Event Configurator now uses a five step setup wizard for event details, match format, branding, access, and review. Generic events can store a custom accent color, date, venue, and small event logo. The configurator generates Referee, Judge Advisor, Emcee, and Inspection codes and writes their hashes to the event credential table. The completion screen provides the shareable event link, role codes, copy controls, and a copyable setup sheet.

The Highlander production event (`11111111-1111-4111-8111-111111111111`) is explicitly marked as configurator protected. This protection is intentionally scoped to the generic configurator so existing Highlander Admin/event day workflows are not disabled.

Features & Help now includes explicit release and support information. Highlander retains push plus email notification delivery. Generic configured events remain push only.
