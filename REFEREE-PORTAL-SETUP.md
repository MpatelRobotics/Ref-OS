# Referee portal setup

1. Run `supabase/referee-portal.sql` in the linked project's Supabase SQL Editor after the base schema.
2. In Supabase Authentication, enable the Email provider. Keep email confirmation enabled for verified accounts and configure production SMTP for account and password-reset emails.
3. In Authentication > URL Configuration, set the site URL to https://www.ref-os.fyi and allow https://www.ref-os.fyi/** as a redirect URL (also add explicitly approved development origins as needed).
4. Publish the app. Referee portal is on Choose VEX Event; Sign in with referee account is on each event login screen.

Accounts use Supabase Auth email/password sessions. Profiles and event plans use owner-only RLS and exclude anonymous sessions. Profile contact email is separate from the sign-in email. No contact directory or public profile is exposed.

Event attendance is self-reported, not an official assignment. Selecting an event never creates an event membership. Enter the event's crew access code on the first visit; subsequent visits reuse membership after server verification. Existing event code, role, archive, and revocation rules still apply. Signing out of the account leaves the saved profile and event plans intact.

Password reset links return to the referee portal with a new-password form. Email verification links return to the account portal. Mobile users can complete email verification/reset in their browser and then sign into the installed app using the same account.
