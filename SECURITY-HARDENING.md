# Ref OS 1.2 Security and Reliability Hardening

## Required one time Supabase setup

1. Open Supabase Authentication settings and enable Anonymous Sign-Ins.
2. Run `supabase/security-hardening.sql` in the Supabase SQL Editor.
3. The migration automatically creates the permanent keypad Admin credential `1A23`.
4. Existing generated volunteer role code hashes from `event_settings` are migrated automatically when available.

## Keep existing normal passwords

Normal Referee, Judge Advisor, Emcee, and Admin password login is now verified by Supabase instead of browser JavaScript.

The old VITE password values are no longer referenced by the browser bundle.

Put the passwords in local `.env` using:

```
REFOS_SITE_PASSWORD=...
REFOS_ADMIN_PASSWORD=...
REFOS_JUDGE_PASSWORD=...
REFOS_EMCEE_PASSWORD=...
```

Then run:

```
npm run security:access-sql
```

This creates `supabase/access-passwords-generated.sql` containing only SHA-256 hashes. Review it, then run that generated SQL once in the Supabase SQL Editor.

You can also migrate an older `.env` that still uses VITE_SITE_PASSWORD, VITE_ADMIN_PASSWORD, VITE_JUDGE_PASSWORD, and VITE_EMCEE_PASSWORD. The generator accepts both formats, but new deployments should use the REFOS names.

## What the server now enforces

A browser must first have an authenticated Supabase anonymous session and an `event_members` role created by `claim_event_access`.

Database policies enforce:
* Referee writes for teams, violations, watch notes, and field operations.
* Judge Advisor writes for judging records.
* Emcee writes only where the current event workflow needs it.
* Admin writes for event settings, alliance selection, rules, and Admin operations.
* All event data reads require event membership.
* Volunteer access credential hashes are not directly readable from the browser.
* Robot photo reads use signed URLs and reads, uploads, and deletes require an allowed event role.

The fixed keypad Admin code is stored server side as a hash. Disabling a volunteer code blocks future logins but does not kick out already logged in volunteers.

## QR behavior

QR generation uses the bundled `qrcode` package.
QR decoding uses the bundled `jsqr` package on browsers without native BarcodeDetector support.

No Ref OS login code is sent to an external QR service or QR CDN.

## Automated browser tests

Run:

```
npm run test:e2e
```

The suite covers desktop Chromium and mobile WebKit and includes startup, role login, split name entry, Admin keypad login, team creation, violation logging, offline queue recovery, failed sync retention, service worker versioning, and the PWA manifest.

On a new development machine install Playwright browser engines once:

```
npx playwright install
```
