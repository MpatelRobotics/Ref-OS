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

4. Publish the web app normally. The website build does not package Windows executables. The separate Windows workflow publishes the desktop download. No database migration is needed.

## Event organizer setup

1. On a Windows computer that can reach TM and the internet, enable **Tools → Options → Web Publishing → Enable Local TM API** in TM and copy the event API key.
2. Download **Ref OS TM Connect** from the Ref OS TM connection screen, then double-click `Ref-OS-TM-Connect.exe`. No Node.js installation or terminal commands are needed.
3. Enter your deployed Ref OS HTTPS website address. Sign in as an event administrator and select the correct event/league session. The app remembers only the website address.
4. Enter the TM server address (for example `http://192.168.1.25:8080`) and event API key. Click **Connect to TM**, select the division, and **Review TM data**. Confirm the event and select the TM session if asked.
5. Optionally select **Add missing matches from TM**, then **Start TM syncing**. Closing the window while syncing hides it in the Windows system tray; it continues checking while minimized. Double-click its tray icon to reopen it. **Quit and stop syncing** exits completely.
6. Other Ref OS users can follow the event from anywhere through Ref OS Cloud. They do not need the app, event API key, or access to the venue network.

## Desktop build and distribution

Run `npm run build:tm-desktop` on the developer computer. The portable Windows x64 executable is created in `desktop/release/Ref-OS-TM-Connect.exe` and copied to `public/Ref-OS-TM-Connect.exe`. Website builds only validate the schema and run Vite; Vercel never runs Electron or NSIS. Generated binaries are ignored by Git. The `Build TM desktop download` GitHub Actions workflow runs on Windows after relevant pushes to `main`, tests the packaged app, and publishes the executable to the public `tm-connect` GitHub release. The website download button points to that asset, so it becomes available when the first workflow run completes. The workflow can also be started manually from GitHub Actions. It uses the built-in GitHub token with release write permissions; no TM credentials are passed to the workflow. To use another download host, set `VITE_TM_DESKTOP_DOWNLOAD_URL` to its HTTPS download URL. This build is unsigned; Windows may display an unrecognized-publisher prompt. Configure signing before broad public distribution.

The desktop app loads your hosted Ref OS website and uses its existing sign-in and event permissions. Its isolated preload exposes only TM requests; developer client credentials remain in the Supabase token broker. The internal connector binds a random loopback port with a random private pairing secret. Neither the key nor pairing secret is saved to disk. Changing website from the tray stops the current connection. Reloading, signing out, or leaving the event stops sync. Do not shut down the event computer while sharing live updates.

## Behavior and limits

- The connector receives the current user's session token from Ref OS, checks authorization through the token function, signs requests with the local event key, and returns TM data to the app. Database writes use the app's existing authenticated, event/session-scoped API. The connector receives neither the developer client secret nor a Supabase service-role key.
- The event key stays in desktop renderer memory; reload, sign-out, or leaving the event clears the connection. No key is saved in shared event settings or browser storage.
- Each TM resource is checked at most once per minute. Last-Modified/If-Modified-Since and 304 responses reuse the cached snapshot. Failed imports remain retryable. Repeated unchanged rows do not trigger redundant ranking, skills, or team writes.
- Skills are event-wide, including teams outside the selected division. Qualification standings come from the selected division's QUAL round. Snapshots are saved to the selected Ref OS league session using existing storage rules.
- Empty lists keep existing imported data. Unsupported or ambiguous match identities are skipped and reported. No scheduled match is deleted or reassigned. Scores require matching round, number, and both alliances, and update only completed matches marked SCORED by TM.
- Running VEX and TM scores/rankings against the same event at the same time may alternate between their snapshots. Stop VEX sync for categories where TM should be authoritative.
- The TM server, desktop app, and internet connection need to remain available. Desktop requests use the built-in connector rather than browser local-network permissions. Actual venue connectivity still needs a live test.
- Live field sets use signed WebSocket handshakes at `/api/fieldsets/{field_set_id}`, with field names loaded from `/api/fieldsets` and `/api/fieldsets/{field_set_id}/fields`. Assignment, active-field, started, and stopped events are listened to; no TM commands are sent. Shared snapshots are limited to the selected division/TM session and stored in the selected Ref OS league session. Desktop-to-connector reads occur every second; this reads memory and does not poll TM's REST API faster. Cloud writes occur on changes plus a 30-second heartbeat, and field activity expires after 90 seconds without updates.
- When connecting or reconnecting mid-match, the active match identity cannot be recovered from these event-only endpoints until TM sends an assignment. The panel says when an identity is unknown. Disconnects and stale snapshots are labeled instead of claiming the match is still playing. WebSockets reconnect with backoff; stopping sync disconnects them. The connector expires the connection if the administrator page stops renewing it.
- TM control commands remain disabled: Ref OS does not start/stop matches, change displays, or assign fields. Upcoming matches appear when imported or added; schedule changes to existing matches continue through regular import/edit tools.

Documented resources used: GET /api/event, /api/divisions, /api/teams/{division_id}, /api/matches/{division_id}, /api/rankings/{division_id}/QUAL, /api/skills, /api/fieldsets, /api/fieldsets/{field_set_id}/fields, plus the field-set WebSocket. Based on the TM Public API Guide v1.2 pages supplied for this integration. The desktop download includes its runtime and WebSocket dependency.
