# Referee portal setup

1. Run `supabase/referee-portal.sql` in the linked project's Supabase SQL Editor after the base schema.
2. In Supabase Authentication, enable the Email provider. Keep email confirmation enabled for verified accounts and configure production SMTP for account and password-reset emails.
3. In Authentication > URL Configuration, set the site URL to https://www.ref-os.fyi and allow https://www.ref-os.fyi/** as a redirect URL (also add explicitly approved development origins as needed).
4. Publish the app. Referee portal is on Choose VEX Event; Sign in with referee account is on each event login screen.

Accounts use Supabase Auth email/password sessions. Profiles and event plans use owner-only RLS and exclude anonymous sessions. Profile contact email is separate from the sign-in email. No contact directory or public profile is exposed.

Event attendance is self-reported, not an official assignment. After installing the personal-passcode migration below, selecting attended or going makes that event eligible for personal Referee access. Open event creates or verifies Referee membership without requiring an event Admin code. Existing event code login remains available. Signing out of the account leaves the saved profile and event plans intact.

Password reset links return to the referee portal with a new-password form. Email verification links return to the account portal. Mobile users can complete email verification/reset in their browser and then sign into the installed app using the same account.


## Personal passcodes and event search

Run `supabase/referee-portal-passcodes.sql` after the original portal migration, lifecycle, Developer access, and security migrations. This adds private passcodes, external VEX event plans, public event-code/location lookup, and scoped Referee claims. No new Edge Function is needed: state/date/code search reuses the deployed `vex-event-lookup` function and its VEX_EVENTS_API_TOKEN.

Accounts can create or replace an 8–16 character letters-and-numbers passcode. It is case insensitive, hashed with pgcrypto, never returned to the browser, and grants Referee access only to events that account selected as attended or going. Wrong attempts use the shared per-device/event lockout and persist on failure. Disabling/replacing a passcode prevents future claims with the old code; it does not sign out existing event sessions.

The event login screen has Use personal referee passcode, usable without first signing into the portal on that device. A signed-in account may only use its own personal passcode. An account can also open its own selected events from the portal without typing the passcode again. Existing roles on that same account are preserved; passcode use on another device grants only Referee access.

No event Admin code is required to open a selected event. If a looked-up VEX event does not yet exist in Ref OS, Open event creates a workspace with no Admin credential and Referee membership only. Repeated opens reuse the exact VEX code, and existing archived workspaces are never reopened or duplicated. A Developer can later configure Admin access. This implements self-service Referee access based on self-reported attendance/plans. New workspaces still require roster and schedule import through the normal event tools.

## Community map and portal feedback

Run `supabase/referee-community.sql` after the portal and Universal Feedback migrations. The portal section dropdown separates Profile, Events, and the USA community map. Country and US state selection use dropdowns; contact details and passcode settings are collapsible. Event search supports state/date or event-code modes and saved-event attendance filters.

Map sharing defaults to on for new profiles after referee-map-default-on.sql is applied. Existing saved preferences are preserved. A referee selects the United States and a supported state and saves; the map display name defaults to their profile name and can be edited. The sharing checkbox can be turned off at any time. Only map display name and state are returned by the authenticated community RPC. Phone, email, city, user ID, and full profile are not exposed. Turning sharing off removes the profile from subsequent map reads. Map geometry comes from us-atlas 3.0.1 using US Census boundaries; its ISC license is kept in src/data/us-atlas-LICENSE.txt.

The Send feedback button is available to signed-in portal accounts without an event membership. Messages are private to the Developer's Universal Feedback inbox and include account name/email for follow-up. Submission retries are idempotent; accounts are limited to ten messages per hour. The standard Developer status controls apply to portal feedback. This sends in-app feedback, not an email or Discord message.
