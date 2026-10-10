# Ref OS TM connector

The Windows desktop app uses this local, read-only transport to connect the hosted Ref OS interface to Tournament Manager. Android uses native HTTP and signed WebSockets with the same shared UI and field-event handling.

One TM server can supply two divisions. Each division keeps its own live connection and Ref OS data destination; snapshots run sequentially. Switching the displayed division keeps sync running. Desktop snapshot requests fetch fresh scores, rankings, teams and Skills without the old one-minute resource cache.

Developer OAuth credential values belong only in the server-side secret store. Event API keys and temporary tokens stay in memory. Never include credential values in documentation, examples, logs or releases. The Windows transport requires its private origin/pairing checks and listens only on loopback.

See [TM API setup](../TM-API-SETUP.md) for current setup, refresh intervals, device requirements and distribution instructions.
