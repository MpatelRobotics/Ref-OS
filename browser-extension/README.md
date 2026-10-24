# Ref OS TM Connect for Chrome

This extension connects the official Ref OS website to a local Tournament Manager server. It includes teams, matches, scores, rankings, Skills, check-in, both-division sync, and live field assignment, activation, start and stop events. No separate Windows connector is required.

## Install the ZIP
1. Extract `Ref-OS-TM-Extension.zip` into a permanent folder.
2. In desktop Chrome, open `chrome://extensions`.
3. Enable **Developer mode**, select **Load unpacked**, and choose the extracted folder containing `manifest.json`.
4. Pin **Ref OS TM Connect** from the Extensions menu.
5. Open its toolbar icon. Enter the TM computer address, including its port (for example `http://192.168.1.20:8080`), and click **Allow this TM server**. Approve the Chrome request for that server.
6. Open or reload `https://www.ref-os.fyi`, select your event, and sign in with event administrator access.
7. Open **Tournament Manager Sync Center → Connect Tournament Manager**. The page should say **Chrome TM extension connected**.
8. In TM, enable **Tools → Options → Web Publishing → Local TM API**. Copy the event API key.
9. Enter the TM address and event API key in the extension and click **Save TM connection**. Open TM Sync Center in Ref OS; both fields fill in automatically. Connect, select your TM division/session, review the data, and start syncing. Use **Sync both TM divisions** for two divisions on that server.
10. Keep the Ref OS tab open. Closing it or leaving the website disconnects the live stream. Browser tab suspension can pause synchronization. Match timers use TM start/stop events; this extension does not control TM or start matches.

## Troubleshooting
- **Extension not detected:** Reload Ref OS after installation; ensure the extension is enabled and allowed on the official website.
- **Allow this server:** Open the toolbar icon and allow the exact address; use the same port in Ref OS. Chrome grants host permission by hostname; the extension additionally enforces the configured port.
- **Key/signature rejected:** Check the event API key, computer clock, and that the correct TM event is open.
- **Field updates disconnected:** Confirm TM supports its live field API and the network allows WebSocket connections. Snapshot sync can continue; the field connection retries automatically.
- **School-managed Chrome:** IT may need to approve this unpacked extension or deploy it by policy. The extension cannot bypass school network or browser policies.
- Standard Chrome on Android does not install desktop Chrome extensions; use the Ref OS Android app there.

## Privacy and permissions
- Website access is limited to the official `ref-os.fyi` and `www.ref-os.fyi` pages. No browsing history is read.
- TM host access is optional and requested only after you choose its address. Read-only TM API paths are allowed; arbitrary URLs and write requests are rejected.
- Authentication is checked by Ref OS Cloud before each snapshot. The cloud endpoint is pinned to this Ref OS deployment.
- The TM address is saved locally. The TM API key is kept in extension session storage until Chrome closes and is shared only with the official Ref OS page to fill in the connection form. It is not saved to disk or diagnostic logs. Account tokens stay in memory.
- Live WebSocket headers are attached with temporary, exact-URL, extension-initiator-only session rules. Each rule is removed after its handshake, including on failure.
- Removing or changing server access closes existing connections. Idle connections expire. No TLS certificate bypass is included.

## Build and verify
`node scripts/build-tm-extension.mjs` builds a standalone folder and ZIP. The ZIP is also served as `/Ref-OS-TM-Extension.zip` by Ref OS.

`node --test tests/tm-extension-security.test.mjs tests/tm-extension-browser.test.mjs tests/tm-mobile.test.mjs tests/tm-client-pool.test.mjs`

The browser test uses a temporary extension profile, a local signed HTTP/WebSocket TM fixture, and a stubbed cloud token response. It verifies actual Chrome extension messaging, HTTP signatures, signed WebSocket upgrades, live state, permission restrictions and cleanup. Verification with a real TM event and the school's Chrome/network policies is still required before event use.
