# Internal Tournament Manager connector

The command-line connector has been replaced by **Ref OS TM Connect**, the Windows desktop app in `desktop/`.

`connector.mjs` provides the private loopback server used by Electron. `protocol.mjs` signs TM requests and caches resources; `live-fields.mjs` listens to signed field WebSockets. These modules do not write directly to Ref OS Cloud or send match-control commands.

See [TM-API-SETUP.md](../TM-API-SETUP.md) for organizer setup, developer credentials, packaging, and venue requirements.
