# Ref OS

**Referee Operating System for live VEX Robotics events**

Ref OS is a shared event operations workspace built for the Highlander Summit Signature Event. It gives referees, Judge Advisors, Emcees, and event administrators one live place to coordinate match activity, record violations, monitor field readiness, share role information, and respond to event day issues.

Ref OS 1.2.0 is a private beta created by Maharshi Patel.

## One live event workspace

Everyone works from the same event record. Updates made by one volunteer appear for the rest of the crew within seconds, helping field and judging teams stay aligned without passing around separate spreadsheets, paper logs, or chat messages.

The interface adapts to phones, tablets, and desktop operations stations. Mobile devices use quick bottom navigation and touch friendly sheets. Desktop devices use a wider operations layout with persistent navigation and event tools.

New volunteers receive a three screen Quick Start covering assignments, help requests, and offline saving. It appears once per role on each device and can be reopened from Features and Help.

After saving a new violation or inspection picture, volunteers receive an eight second Undo option. Ref OS asks for confirmation before completing the undo.

## Volunteer roles

### Referee

Referees can review the match schedule, search teams, record violations, document robot concerns, complete field reset checks, review rules, and share the active Referee join code with another referee.

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

## Violation tracking

Referees can record minor, major, and inspection violations against a team while citing the applicable rule and match. Notes and supporting robot photos can be attached when additional context is needed.

Violation history is available by team, match, rule, and event activity. Repeated minor violations of the same rule are surfaced to help the referee crew identify escalation patterns.

## Teams and robot documentation

The Teams workspace combines the event roster with violation totals, rankings, watch information, and quick access to team history.

The Robots workspace requires three labeled inspection pictures for every team: Front, Back, and Side. Each team card shows picture completion, and the team view provides a dedicated capture slot for every required angle. Earlier unlabeled pictures remain available for reference.

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

## Judging and alliance selection

The judging workspace supports award nominations and finalist review. Alliance selection information can be viewed by key volunteers, while editing permissions remain limited to the appropriate roles.

The alliance tools support captain and pick assignments, elimination bracket preparation, and match progression information.

## Event Command Center

The Event Command Center centralizes administrator tools and event health information. It includes access to operational summaries, event settings, announcements, countdown management, data controls, volunteer information, exports, and readiness checks.

Tools opened from the Event Command Center include a persistent Back to Command Center button. Closing or saving a Command Center tool returns the Admin to the Command Center instead of the main workspace.

## Key Volunteer Status

The live volunteer view shows who is online, who has previously joined, their role, device presence, last seen status, and current event assignment. Administrators can assign volunteers to Field 1, Field 2, Field 3, Pit Floor, Competition Floor, Skills, or Judging. They can also promote an eligible online volunteer to Admin without sharing the Admin password.

Each volunteer receives a synchronized assignment card in their workspace. Assignment changes appear automatically without requiring the volunteer to close or restart Ref OS.

On phones, the header uses a compact online volunteer count. Tapping it opens the complete scrollable status list.

## Volunteer access and join codes

Ref OS uses separate join codes for Referees, Judge Advisors, and Emcees.

Signed in volunteers can view and share only the code for their own role. Administrators can manage all role codes, generate replacements, disable codes, print login cards, and open QR codes.

If a volunteer needs a replacement code, they can request regeneration from inside the app. The request appears for administrators in real time.

## Push notifications

Referees, Judge Advisors, Emcees, and Administrators can enable device push alerts from the Access section of Settings. When a volunteer requests a new role code or sends a help request, subscribed phones, tablets, and computers receive a notification even when Ref OS is not open.

Tapping the notification opens Ref OS directly to role code management. The normal live in app request remains available as a fallback.

On iPhone and iPad, Ref OS must be installed through Add to Home Screen before push notifications can be enabled.

## Request Help and acknowledgment

Every role can send a help request for an Admin, field issue, rules question, medical assistance, or volunteer replacement. Each request identifies Field 1, Field 2, Field 3, Pit Floor, Competition Floor, Skills, Judging, or another location. The request appears live across the event workspace and is delivered to every subscribed volunteer device.

An Admin can acknowledge the request once. Everyone then sees who acknowledged it, preventing multiple volunteers from responding to the same issue unnecessarily.

## Announcements and event countdown

Admins can publish key volunteer announcements that appear across connected devices. An event countdown can also be configured for the next major event milestone and remains synchronized for every role.

## Event contact directory

The shared contact directory keeps important event contacts available inside Ref OS. This reduces the need to search through separate messages when a volunteer needs operational help quickly.

## Rules and reference material

The Rules workspace provides searchable rule information and favorites for quick event day access. Ref OS also includes offline friendly access to the game manual and Quick Reference Guide with navigation controls for important sections.

## Offline resilience

Ref OS is designed for competition venues where WiFi and cellular service may be inconsistent.

New violation entries and required inspection pictures are saved on the device immediately and queued for upload when a connection is unavailable. Pending entries synchronize automatically after connectivity returns. The interface shows connection health, pending activity, and the most recent successful synchronization.

Offline support protects new entries created on that device. Viewing brand new information entered by other volunteers still requires a connection.

## Realtime synchronization

Connected devices receive event changes through the shared cloud workspace. Important role code updates also use a short polling fallback so mobile devices can recover when realtime delivery is interrupted.

## Reports and exports

Administrators can export event information for review and record keeping, including violation data, field activity, judging information, match anomalies, and event summaries.

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

Ref OS is intended for authorized Highlander Summit volunteers. Join codes and Admin credentials should be shared only with people assigned to the corresponding event role.

Volunteer names, event records, device subscriptions, and operational data are stored only for running the shared event workspace. Push notification private keys remain on the server and are never exposed to the browser.

## Release

**Ref OS 1.2.0 Highlander Release**

Private Beta

Created by Maharshi Patel for Highlander Summit event operations.
