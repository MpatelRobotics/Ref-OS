# Ref OS Tournament Manager connector

This local connector is controlled from the Ref OS **Tournament Manager Sync Center**. It reads TM's API and returns snapshots to the app; the app performs authenticated cloud writes. Event organizers do not need the developer's client ID/secret or a Supabase service key.

Read [TM-API-SETUP.md](../TM-API-SETUP.md) for developer deployment and event setup.

From the repository folder:

```cmd
node tm-bridge/bridge.mjs --origin https://YOUR-REF-OS-WEBSITE
```

Or download the standalone connector from Connection setup inside Ref OS and run the command shown there. Node.js 18 or later is required. The download bundles its WebSocket library; no package installation is needed by event organizers. For source development, install the repository dependencies first. Keep the connector window open and use Ref OS on the same computer. Other users receive results through Ref OS Cloud.

The previous unattended .env bridge has been replaced. Credentials and the target event are entered in Ref OS, with a per-start pairing code. The connector listens on 127.0.0.1:8787, only allows the configured website origin, and never writes directly to Supabase or sends TM control commands. It opens signed read-only field WebSockets, reconnects with backoff, and reports assignments, active fields, and match starts/stops.

Optional environment settings: REFOS_ORIGIN (instead of --origin), REFOS_CONNECTOR_PORT (local testing/custom deployments), SUPABASE_URL (custom Ref OS backend). The app uses port 8787. Never put TM_CLIENT_SECRET or a service-role key here.
