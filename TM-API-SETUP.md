# Tournament Manager API setup

Ref OS TM Connect supports Windows and Android for read-only TM integration in V5RC / VEX U events. IQ retains its CSV import workflow. TM is the official competition data source; Ref OS does not send match-control commands.

## Server configuration

An authorized developer must configure the approved OAuth client ID and client secret in the server-side secret store. The secret names are `TM_CLIENT_ID` and `TM_CLIENT_SECRET`; **never place their values in documentation, Git, screenshots, frontend environment variables, event settings or connector builds**. Event staff only enter the event-specific TM API key.

Deploy the token broker to your own Supabase project. Replace the placeholder locally; no project credentials belong in this command:

```cmd
npx supabase functions deploy tm-api-token --project-ref YOUR_PROJECT_REF --no-verify-jwt
```

The function validates Supabase authentication and the event administrator role before issuing a short-lived token. Developer credentials remain server-side. A real venue test is required to confirm connectivity and authorized TM access.

## Event setup

1. Enable **Tools → Options → Web Publishing → Local TM API** in TM.
2. Open the Windows connector, enter your Ref OS HTTPS website address and sign in. On Android, install the connector APK and sign in directly.
3. Select the Ref OS event and league session, if applicable. Enter the TM server IP and event API key.
4. For a single division, connect, select the TM division, review and start.
5. For two divisions on one server, choose **Sync both TM divisions**, enter one IP/key, choose **Load TM divisions**, map both TM divisions to different Ref OS divisions, review each, then **Start both divisions**. Ref OS can initialize an empty division list from TM; existing lists must have the intended destinations available.

Both division requests run sequentially. Each division refreshes every 30 seconds during qualifications or 15 seconds when its elimination schedule exists. A live match start schedules another score refresh after 30 seconds. Skills syncs once for the entire event. Switching the displayed Ref OS division does not stop either sync.

Missing scheduled matches can be added from TM. Existing field and team assignments are preserved. Official rankings and completed scores come from TM; unscored placeholders are ignored. Replay games remain distinct. A 0–0 result alone does not establish a double DQ.

## Live activity and device behavior

Live field WebSockets publish assigned matches, activation and match starts/stops, scoped to each division. Current matches are green and upcoming matches amber. Jumping to the current match requires a button press. Connecting mid-match can leave the identity unknown until an assignment event arrives; Ref OS does not guess.

The connector needs access to TM and the internet. Other users read synced data through Ref OS Cloud. Windows keeps syncing while minimized and can stay in the system tray. Use **Quit and stop syncing** to exit. Android must stay open and awake. Leaving the event, signing out, reloading or stopping sync closes the connection. Keys remain in memory and are never saved in shared settings.

## Build and publish

Windows: `npm run build:tm-desktop` creates `desktop/release/Ref-OS-TM-Connect.exe`. **Build TM desktop download** in GitHub Actions verifies the app and publishes the Windows release after relevant pushes. The current Windows build is unsigned. Website builds do not package Electron or NSIS.

Android: push the app changes, run **Build downloadable Android TM connector**, then install the newly published APK. Signing credentials stay in GitHub Actions secrets; never commit the keystore or password backup. See [Android download instructions](mobile/ANDROID-DOWNLOAD.md).

Both use the shared Ref OS interface. Desktop requests fetch fresh TM data each sync, matching Android's refresh behavior. Empty snapshots retain existing data, and unchanged snapshots avoid redundant writes. Data remains event, session and division scoped.
