# VEX Events autofill setup

This integration uses https://events.vex.com/api/v2 and its official specification at https://events.vex.com/api/v2/swagger.yml.

1. In Supabase, open your project's Edge Functions secrets. Add `VEX_EVENTS_API_TOKEN` with your VEX API token as its value. Keep this token out of frontend environment variables, Git, and chat.
2. From the Ref OS folder, deploy the function with the commands below. Replace `YOUR_PROJECT_REF` with the project reference shown in Supabase project settings.
3. The function validates the caller's Supabase session itself. Deploy with `--no-verify-jwt` so modern Supabase signing keys are supported; requests without a valid session are still rejected by `auth.getUser()`.
4. Rebuild/deploy the app through the normal Git workflow.
5. On Choose VEX Event, select Create event, enter a full VEX event code, and choose Look up. Review the preview, choose the format, and enter a separate REF-OS Admin access code. Create event saves the metadata and team roster using the existing event Admin permissions.

```bat
cd /d C:\Users\mahar\Downloads\Ref-os
npx supabase login
npx supabase functions deploy vex-event-lookup --project-ref YOUR_PROJECT_REF --no-verify-jwt
```

The API token is read only inside the Edge Function. Only the event's public name, code, dates, location, program, type, and team numbers/names are returned. All team pages must succeed before autofill succeeds. The function uses a fixed upstream host, request timeout, bounded cache, and per-instance request limiter. The limiter is not a distributed quota; monitor provider usage in production.

Supported scope: autofill during new event creation; Tournament and League supported. Dates/location are saved in the `vex_event` event setting, with dates/location shown in the lookup preview. League start date initializes the editable first-session date. Event autofill does not create every League session or change the current event after lookup. Optional VEX API Sync is described below; Tournament Manager imports remain available.

Manual creation remains available if lookup fails. If saving the roster fails after creation, the app keeps the event and directs you to import teams into that existing event, avoiding duplicate events. Existing event access and event creation restrictions remain in place. No database migration is needed.

Live verification is required after adding the secret and deploying: try a real event code, check the complete team count and details, create a test event, and verify its Teams roster. The local automated checks use fixtures; they do not validate your token or account's API access. Never paste your token into test fixtures.

## USA event finder

Create Event now also offers US state/territory and date-range search. Select a state, choose dates (maximum one year), select Find events, then choose an event from the dropdown and Use selected event. The normal code lookup retrieves its details and full team roster. Code lookup remains available for any supported full event code.

Search requests the date window and checks country/state server-side, accepting full state names and abbreviations. It avoids depending on the upstream region filter. Load more events retrieves later API pages and appends matches to the dropdown; a count is the number loaded, not a claim that all events have been retrieved. Date range defaults to today through the next 90 days. Only tournaments and leagues are included. An empty result with more pages available means continue loading pages. No non-US location finder is enabled in this release.

Redeploy `vex-event-lookup` using the deployment command above after publishing these changes. The existing VEX_EVENTS_API_TOKEN secret stays in place. Verify with your live token after deployment.

Event-code lookup supports both RE- and VE- codes. Event search accepts tournament/league labels such as Open Tournament, including object labels. These compatibility cases are covered by fixture tests; live API verification still requires deployment.

## Qualification rankings sync
Open Rankings or the Event Command Center in cloud Admin mode and choose VEX API Sync. Load the event divisions, choose a division and Qualification rankings, review the snapshot and Start syncing. Start syncing enables checks every 15 seconds; closing the dialog keeps monitoring active while Ref OS is open, visible and online. Manage or stop it from the status bar. Switching events/sessions, signing out or reloading stops it.
Qualification rankings and scores use the selected division; Skills sync is event-wide. **Sync everything → Load divisions → Start all syncs** starts all three categories together, with independent checks every 15 seconds while the app is open, visible and online. Confirm the target League session before starting. Empty snapshots retain saved data. API publication may lag scoring. Failed writes can partially succeed; review and retry.
Match schedules still use Tournament Manager imports; scores-only sync updates matching existing matches. Compact status cards offer Manage and Stop, with update messages under Details. Redeploy vex-event-lookup to apply the request allowance needed for three 15-second syncs; the existing API token stays configured.


Quick start: open Rankings or Event Command Center > VEX API Sync. Confirm the event code; divisions load automatically for a saved code and a single division is selected. Review the preview and click Start syncing to import and enable background updates. Import once performs only one import. Manage or Stop sync from the status bar. Skills and matches use Tournament Manager imports.



## Team events
Team details now includes Registered & Past Events using exact team-number lookup and the teams/{id}/events endpoint. Retrieves a bounded past-year to next-year window, with complete pagination required. Upcoming events sort first. Saves successful results on this device for offline viewing; fresh copies are reused for 15 minutes. Refresh events updates manually. The API describes associated/attended events and does not guarantee registration status or every future registration. Ambiguous team numbers fail rather than choosing a different program. Existing VEX token is reused; redeploy the function. No database migration. Live-token verification remains pending. V5 event links follow the official event page code format; other programs show event details without guessed links.
