# Ref-OS ↔ Tournament Manager bridge (optional)

This is a **standalone, optional** helper. It is **not** part of the Ref-OS web app and
is never deployed with it.

> **If you don't run this — or you're denied a TM API key — Ref-OS works exactly as it
> does today.** Matches still come from the manual `Matches.csv` import (regenerated into
> `seed_matches.sql`) and the admin **Add elimination match** / **Alliance selection**
> flows. The bridge only *adds* automatic sync when you have credentials; it changes
> nothing about the app.

## What it does
Runs on a laptop on the **same local network** as the Tournament Manager machine, reads
the match schedule/results from TM's Public API (read-only), and upserts them into the
same Supabase your app already reads from. Your referees' phones keep reading from
Supabase — they never talk to TM directly.

It does **not** write to or control TM, and does not touch scores, timers, or displays.

## What you need first
1. **Approved TM API credentials** → gives you `TM_CLIENT_ID` and `TM_CLIENT_SECRET`.
   (Apply via the RECF "TM Public API" credentials request.)
2. An **Event Partner** who enables the local API in Tournament Manager
   (Tools → Settings/Options → Web Publishing) and gives you the generated **API key**
   (`TM_API_KEY`).
3. Your Supabase URL + a key that can insert/update the `matches` table, and your Ref-OS
   `EVENT_ID`.

Until you have 1 and 2, there's nothing to run against — and that's fine; keep using the
CSV/manual flow.

## Setup
```bash
cd tm-bridge
npm install
cp .env.example .env      # then fill in .env
```

## Try it safely first (no writes)
```bash
DRY_RUN=1 node bridge.mjs
```
This authenticates, polls TM, and **prints what it would sync** without writing anything.
Good for confirming the token + signature work and that `TM_DIVISION_ID` is right before
it touches Supabase.

The resource paths and response shape are set from the API Guide v1.2:
- Matches: `GET /api/matches/{division_id}` (default division `1`; override with `TM_DIVISION_ID`)
- Teams: `GET /api/teams` · Rankings: `GET /api/rankings/{division_id}/{match_round}`
- The mapper reads `matchInfo.matchTuple.round` (QUAL / R16 / QF / SF / FINAL) and
  `matchInfo.alliances[0|1].teams[].number` (alliance 0 = red, 1 = blue).

## Run for real
```bash
node bridge.mjs
```
Leave it running on the venue laptop all day. It polls about once a minute, uses
`If-Modified-Since` so it only pulls changes, caches the OAuth token until it expires,
and keeps running through brief TM/network hiccups.

## How auth works (implemented per TM Public API Guide v1.2)
- **OAuth 2.0 client-credentials** → POST `client_id`/`client_secret`/`grant_type` to
  `https://auth.vextm.dwabtech.com/oauth2/token`, cache the bearer token until `expires_in`.
- **Per-request HMAC-SHA256 signature** over
  `VERB\nPATH+QUERY\ntoken:{bearer}\nhost:{host}\nx-tm-date:{date}\n`, sent as
  `x-tm-signature`, alongside `Authorization: Bearer …`, `x-tm-date`, and `Host` headers.

## Security
All secrets live in `.env` (git-ignored) — nothing is hardcoded. Don't share the API
secret or commit `.env`; the credentials can be revoked if the secret leaks or is used
outside what you described in your API request.

## Winners / bracket (important)
By default the bridge does **not** sync match winners, so your app's **Alliances / bracket**
manager stays in control — admins pick winners there and the bridge never overwrites them.
TM does report a winner (`winningAlliance`), so if you'd rather let TM drive winners too,
set `SYNC_WINNERS=1`. Leave it off if you're running the bracket manually in the app.

Either way, the bridge upsert is keyed on `(event_id, phase, num)`, so it updates the
schedule/alliances in place without creating duplicates.
