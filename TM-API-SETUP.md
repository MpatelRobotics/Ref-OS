# Tournament Manager API setup

Ref OS has an experimental, read-only TM API connection in **Command Center → Tournament Manager Sync Center → Connect Tournament Manager**. It syncs teams, qualification rankings, Skills Challenge rankings, and completed match scores. Adding missing scheduled matches is optional. Live field WebSockets share assigned matches and starts/stops in the Matches tab. Existing match fields and team assignments are preserved. Official ranks and scored 0–0 results come from TM; unscored placeholder scores are ignored.

## Developer setup (once)

The API connection currently supports V5 events. IQ keeps its existing CSV workflow; this guide's match examples use two V5 alliances. A venue test with the approved credentials and actual TM server is still required after deployment.

1. In the Supabase dashboard for project `gcibsphjcllspzesqqsw`, open **Edge Functions → Secrets**.
2. Add `TM_CLIENT_ID` and `TM_CLIENT_SECRET` with your approved credentials. These are server secrets, never VITE variables or event settings. There is no need to obtain tokens in Postman.
3. Deploy the token function from the repository folder:

```cmd
npx supabase functions deploy tm-api-token --project-ref gcibsphjcllspzesqqsw --no-verify-jwt
```

The function verifies the signed-in user with Supabase Auth and checks the event's server-side administrator role. OAuth uses the documented client-credentials flow, caches the bearer token until shortly before expiry, and coalesces simultaneous renewals. The gateway JWT check is disabled because the function handles authentication itself, matching the existing VEX function deployment.

4. Publish the web app normally. The build prepares a downloadable, standalone `tm-connector.mjs` automatically. No database migration is needed.

## Event organizer setup

1. Use a laptop on the same network as Tournament Manager. Enable **Tools → Options → Web Publishing → Enable Local TM API** for this event and copy its event API key.
2. Sign into Ref OS as an administrator for the correct event and league session.
3. Open **Tournament Manager Sync Center → Connect Tournament Manager → Connection setup**. Download the connector. Install Node.js 18 or later if needed.
4. Open a terminal in the downloaded file's folder. Run the command displayed inside Ref OS, for example:

```cmd
node tm-connector.mjs --origin https://YOUR-REF-OS-WEBSITE
```

Use exactly your Ref OS website's origin, without a trailing slash. Keep this window open. The connector prints a fresh pairing code. It listens only on this computer at `http://127.0.0.1:8787`.

5. In Ref OS on **that same laptop**, enter the pairing code, TM server address (for example `http://192.168.1.25:8080`), and event TM API key. Allow local-network access if prompted. Other devices read synced data from Ref OS Cloud and do not need the connector.
6. Click **Connect to TM**, choose the division, then **Review TM data**. Check the connected event name/code and counts. If TM returns multiple sessions, select the intended TM session explicitly. TM's numeric session IDs are not Ref OS league session IDs.
7. Optionally select **Add missing matches from TM**. **Listen to live field activity** is enabled by default. Click **Start TM syncing**. Sync continues with the dialog closed, once a minute while the page is visible and online. Field events arrive through TM's WebSockets and are relayed to Ref OS Cloud within approximately a second plus network time. **Stop TM sync** stops this connection independently of VEX sync.

## Behavior and limits

- The connector receives the current user's session token from Ref OS, checks authorization through the token function, signs requests with the local event key, and returns TM data to the app. Database writes use the app's existing authenticated, event/session-scoped API. The connector receives neither the developer client secret nor a Supabase service-role key.
- The event key and pairing code stay in browser memory; reload, sign-out, or leaving the event clears the connection. No key is saved in shared event settings or browser storage.
- Each TM resource is checked at most once per minute. Last-Modified/If-Modified-Since and 304 responses reuse the cached snapshot. Failed imports remain retryable. Repeated unchanged rows do not trigger redundant ranking, skills, or team writes.
- Skills are event-wide, including teams outside the selected division. Qualification standings come from the selected division's QUAL round. Snapshots are saved to the selected Ref OS league session using existing storage rules.
- Empty lists keep existing imported data. Unsupported or ambiguous match identities are skipped and reported. No scheduled match is deleted or reassigned. Scores require matching round, number, and both alliances, and update only completed matches marked SCORED by TM.
- Running VEX and TM scores/rankings against the same event at the same time may alternate between their snapshots. Stop VEX sync for categories where TM should be authoritative.
- The TM server, connector, internet connection, and Ref OS page all need to remain available. Browsers that block HTTPS-to-loopback or local network requests cannot use this connector; use a browser permitting the connection. Actual venue/browser connectivity still needs a live test.
- Live field sets use signed WebSocket handshakes at `/api/fieldsets/{field_set_id}`, with field names loaded from `/api/fieldsets` and `/api/fieldsets/{field_set_id}/fields`. Assignment, active-field, started, and stopped events are listened to; no TM commands are sent. Shared snapshots are limited to the selected division/TM session and stored in the selected Ref OS league session. Browser-to-connector reads occur every second; this reads memory and does not poll TM's REST API faster. Cloud writes occur on changes plus a 30-second heartbeat, and field activity expires after 90 seconds without updates.
- When connecting or reconnecting mid-match, the active match identity cannot be recovered from these event-only endpoints until TM sends an assignment. The panel says when an identity is unknown. Disconnects and stale snapshots are labeled instead of claiming the match is still playing. WebSockets reconnect with backoff; stopping sync disconnects them. The connector expires the connection if the administrator page stops renewing it.
- TM control commands remain disabled: Ref OS does not start/stop matches, change displays, or assign fields. Upcoming matches appear when imported or added; schedule changes to existing matches continue through regular import/edit tools.

Documented resources used: GET /api/event, /api/divisions, /api/teams/{division_id}, /api/matches/{division_id}, /api/rankings/{division_id}/QUAL, /api/skills, /api/fieldsets, /api/fieldsets/{field_set_id}/fields, plus the field-set WebSocket. Based on the TM Public API Guide v1.2 pages supplied for this integration. The downloadable connector bundles its WebSocket dependency so organizers do not install packages separately.
