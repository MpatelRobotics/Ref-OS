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

## Matches, rankings and Skills sync
Cloud administrators can open VEX API Sync from Matches or Rankings. Enter the full event code, load divisions, select a division and category, check for updates, review the snapshot, and Apply snapshot. Then optionally enable once-a-minute checks for that category while the dialog is open, visible and online. Closing, changing the source/category, or an error stops automatic updates. Only one category is monitored at a time.
Matches use the selected division. Scored ties clear the winner; unscored rows preserve saved scores. Imports update matching rows without deleting other matches. Qualification rankings include official rank and available W/L/T and points. Skills cover the whole upstream event and combine best Driver and Autonomous scores per team; combined official ranks/tie-breaks are unavailable and displayed as a dash. For leagues, confirm the selected session before import, especially because Skills cover the whole upstream event.
Empty snapshots retain existing data. Multi-game quarterfinal/semifinal/round-of-16 formats are rejected rather than collapsed; use TM imports for unsupported divisions. Database writes are sequential and can partially succeed on failure; retry the reviewed snapshot. API publishing delay is unknown and this is polling, not guaranteed live scoring. Live-token verification has not been performed.
Redeploy the existing vex-event-lookup function after these changes; keep the existing secret.


