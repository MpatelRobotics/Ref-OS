# Ref OS Local Venue Server (Phase 1)

The Local Venue Server is **optional**. It lets Ref OS devices on the same venue network keep sharing live event operations data through a small computer at the venue (for example a Tournament in a Box mini PC or a Raspberry Pi) when the internet is slow or down.

Cloud (Supabase) stays the default. Nothing changes for a device until an Admin switches that device to *Local Venue Server*.

---

## What it does and does not do

**Shared through the venue server (Phase 1)**

| Data | Notes |
|---|---|
| Violations | New violations, edits, and deletions of violations made in venue mode. Evidence photos taken in venue mode are stored on the venue server and included in exports, but other devices only see a photo count. |
| Field log | Timeouts, field faults, replays, AWP checks, match status entries, help requests and acknowledgements, announcements, volunteer contact entries. |
| Volunteer roster | The Key Volunteer Status list of names and roles. |
| Presence | Who is online (a heartbeat every 25 seconds; a device counts as online for 75 seconds after its last heartbeat). |

**Still needs Supabase and an internet connection**

- Signing in to an event (access codes are checked by Supabase only).
- Developer sign-in.
- Creating events, Event Settings, Event Management, archive, restore, and deletion.
- Access Management and access codes. Access-code field log entries always go to Supabase and are refused by the venue server.
- Tournament Manager imports, teams, matches, and rules.
- Judging, robot inspection photos, robot photo storage.
- Push notifications (a help request made in venue mode is shown on devices through the venue server, but no push alert is sent).
- Clear Data (it clears Supabase data only).

**Cloud reconciliation is not implemented.** Data entered in venue mode stays on the venue server and on the devices. It is **not** copied into Supabase automatically. After the event, use **Export Venue Data** to keep a JSON copy (see [Backup and export](#backup-and-export)).

---

## How it works

```
 Ref OS devices (phones, tablets, laptops)
   │  open  http://<venue-ip>:8080   (the venue server also serves the Ref OS app)
   │
   ├── sign-in, event setup, imports ───────► Supabase (internet)
   │
   └── violations / field log / roster ─────► Ref OS Venue Server (Node.js + SQLite)
         queued on the device while offline        venue-server/data/refos-venue.sqlite
```

- The server is a single Node.js program with **no npm dependencies**. It uses the SQLite database built into Node.js 22.13 and newer.
- Devices send changes and fetch other devices' changes every 3 seconds. When the server cannot be reached, retries slow to every 10 seconds.
- Every change carries a unique id, so a change sent twice is stored once.
- Each device keeps its unsent changes in the browser's storage (IndexedDB). They survive refreshes and are sent when the server is reachable again. They are never silently discarded. If the server refuses a change as invalid, the change is kept on the device, counted as *Rejected* in the Sync panel, and included in Export Venue Data.

### Why devices open the venue server's own address

Browsers block a page loaded over `https://` (for example the Vercel site) from talking to an `http://` address on the local network. The venue server therefore also serves the Ref OS app itself. Devices open `http://<venue-ip>:8080`. A page opened from a venue server's address switches that device to Local Venue Server mode automatically, unless an Admin chose a mode on that device.

### Event security

- The venue server never receives access codes, the Developer credential, or any Supabase key.
- Each event has a random **venue sync key**. Supabase issues it only to devices signed in to that event (any role). The venue server stores only a SHA-256 hash of the key.
- The first device that syncs an event pairs the event with the server. After that, the server accepts that event's data only from devices that present the same key. One event's key cannot read or write another event's data.
- The server accepts only the record types and fields listed above, rejects anything else, limits request sizes (8 MB per request, 200 changes per request), and throttles repeated wrong keys from one address.
- Cross-origin requests are refused unless the origin is listed in `REFOS_ALLOWED_ORIGINS`.
- The server trusts any device that holds the event's key to change that event's venue data. It does not know which role a device has, so it does not enforce Admin-only actions. Those actions still go through Supabase.

---

## Requirements

- **Node.js 22.13 or newer** (22 LTS or 24 LTS). No `npm install` is needed for the venue server.
- The venue computer and all devices on the **same network** (the venue router or access point).
- A **Ref OS production build** (`dist` folder), so the server can serve the app to devices. Build it once from the Ref OS folder while you have internet:

  ```bat
  cd /d C:\Users\mahar\Downloads\Ref-os
  npm install
  npm run build
  ```

  The build uses the same `.env` values (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) as the cloud site. Rebuild whenever Ref OS is updated.
- In Supabase, run `supabase/refos-2-venue-sync.sql` once (SQL Editor).

---

## Windows (Tournament in a Box mini PC)

### 1. Install Node.js

Download **Node.js 22 LTS or 24 LTS** (Windows Installer, `.msi`) from https://nodejs.org and install with the defaults. Check it in Command Prompt:

```bat
node --version
```

It must print `v22.13.0` or newer.

### 2. Start the server

Double-click `venue-server\start-venue-server.cmd`, or in Command Prompt:

```bat
cd /d C:\Users\mahar\Downloads\Ref-os\venue-server
node --no-warnings server.mjs
```

(`npm start` in the same folder does the same.) The window prints the database location, whether the Ref OS app is being served, and the addresses devices can use, for example:

```
Ref OS Venue Server 0.1.0 (API v1) listening on 0.0.0.0:8080
Data: C:\Users\mahar\Downloads\Ref-os\venue-server\data\refos-venue.sqlite
Serving Ref OS app from C:\Users\mahar\Downloads\Ref-os\dist
Connect Ref OS devices to one of:
  http://tm-mini.local:8080  (only if this network resolves .local names)
  http://192.168.1.50:8080  (Wi-Fi)
```

Keep the window open while the event runs.

### 3. Find the LAN IP address

The server prints it at startup. You can also run:

```bat
ipconfig
```

Use the **IPv4 Address** of the adapter connected to the venue network (Wi-Fi or Ethernet), for example `192.168.1.50`. To keep the address from changing during the event, ask the venue network owner for a DHCP reservation, or set a static IP.

### 4. Windows Firewall (required)

Windows blocks incoming connections by default.

- The first time the server starts, Windows may show **"Windows Defender Firewall has blocked some features of this app"** for Node.js. Tick **Private networks** and click **Allow access**.
- Or add the rule yourself. Open **Command Prompt as administrator** and run:

  ```bat
  netsh advfirewall firewall add rule name="Ref OS Venue Server" dir=in action=allow protocol=TCP localport=8080 profile=private
  ```

The rule applies when Windows treats the venue network as **Private**. Check under Settings → Network & internet → (your network) → Network profile type → **Private network**. To remove the rule later:

```bat
netsh advfirewall firewall delete rule name="Ref OS Venue Server"
```

If you change `PORT`, use the same port number in the rule.

### 5. Stop and restart

- **Stop:** press `Ctrl+C` in the server window (or close the window).
- **Restart:** run `start-venue-server.cmd` again. All data is kept in the SQLite file.

### Optional settings

Set these before starting (they can also be set in `start-venue-server.cmd`):

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | Port to listen on |
| `HOST` | `0.0.0.0` | Network interface (all interfaces by default) |
| `REFOS_VENUE_DATA` | `venue-server\data` | Folder for the SQLite database |
| `REFOS_WEB_ROOT` | `..\dist` (if it exists) | Ref OS build to serve to devices |
| `REFOS_ALLOWED_ORIGINS` | *(none)* | Extra origins allowed to call the API (comma separated). Not normally needed. |

Example:

```bat
set PORT=8090
set REFOS_VENUE_DATA=D:\RefOS-Venue\data
node --no-warnings server.mjs
```

---

## Raspberry Pi / Linux

Tested requirements: Raspberry Pi OS (64-bit, Bookworm) or another Debian or Ubuntu system, and Node.js 22.13 or newer.

### 1. Install Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
```

### 2. Copy Ref OS to the Pi

Copy the `venue-server` folder and the built `dist` folder, keeping them side by side (for example `/home/pi/Ref-os/venue-server` and `/home/pi/Ref-os/dist`). You can build `dist` on your Windows computer and copy it over, for example with a USB drive or with:

```bash
scp -r dist venue-server pi@<pi-ip>:/home/pi/Ref-os/
```

### 3. Start the server

```bash
cd /home/pi/Ref-os/venue-server
node --no-warnings server.mjs
```

Stop it with `Ctrl+C`.

### 4. Run it automatically at boot (systemd)

```bash
sudo cp /home/pi/Ref-os/venue-server/refos-venue.service /etc/systemd/system/
# Edit User= and the paths in the file if your user or folder is different:
sudo nano /etc/systemd/system/refos-venue.service
sudo systemctl daemon-reload
sudo systemctl enable --now refos-venue
```

| Action | Command |
|---|---|
| Status | `sudo systemctl status refos-venue` |
| Stop | `sudo systemctl stop refos-venue` |
| Start | `sudo systemctl start refos-venue` |
| Restart | `sudo systemctl restart refos-venue` |
| Logs | `journalctl -u refos-venue -f` |

### 5. Find the IP address and (optionally) use refos.local

```bash
hostname -I
```

To make `http://refos.local:8080` work for devices that support `.local` names, name the Pi `refos` and make sure Avahi is running (it is installed by default on Raspberry Pi OS):

```bash
sudo hostnamectl set-hostname refos
sudo apt-get install -y avahi-daemon
sudo systemctl restart avahi-daemon
```

### 6. Firewall

Raspberry Pi OS does not enable a firewall by default. If you use `ufw`:

```bash
sudo ufw allow 8080/tcp
```

---

## Connecting devices

1. **With internet, before the event:** open `http://<venue-ip>:8080` on each device (for example `http://192.168.1.50:8080`). Choose the event and sign in with the access code as usual. Sign-in always goes through Supabase, so this step needs the internet.
   - The device switches to **Local Venue Server** mode automatically because the page came from the venue server. A small **Venue** badge appears in the header.
   - The device receives the event's venue sync key from Supabase. The first device pairs the event with the server.
   - Sign-ins are stored per address. A device that was signed in on the Vercel site must sign in again at the venue address.
2. **During the event:** violations, field log entries, AWP checks, help requests, announcements, and volunteer status are shared through the venue server, even with no internet. A device that refreshes during an internet outage keeps its previously verified sign-in for up to 18 hours (venue mode only).
3. **Admins:** Event Command Center → **Sync & Venue Server** shows Mode, Server, Connection, Latency, Sync status, Pending changes, and Last successful sync, with **Test Connection**, **Sync Now**, and **Export Venue Data**. The panel also switches this device between Cloud and Local Venue Server, and accepts a manual server address (for example `192.168.1.50` or `192.168.1.50:8080`).
4. **Referees and other roles** see only the small Venue badge (Venue, Venue offline, or Venue error, plus a count of changes waiting to send).

### About refos.local

The suggested address `http://refos.local:8080` depends on the network and the device resolving **mDNS** (`.local`) names. The venue server does not advertise itself. `.local` works only when the venue computer's own operating system advertises its name: Avahi on Linux or Raspberry Pi, or Windows' built-in responder, where the name is the computer name. Apple devices usually resolve `.local` names. Many Android devices and some Windows setups do not. **The IP address always works**, so use it whenever `.local` does not.

---

## Backup and export

- **Export Venue Data** (Admin, in the Sync & Venue Server panel) downloads a JSON file for the event. It contains:
  - All venue violations, field log entries, and roster entries, including deletion markers.
  - This device's unsent and rejected changes.
  - `reconciledToCloud: false`.
  - No keys or credentials.

  If the server cannot be reached, the file contains this device's copy instead.
- **Database file:** `venue-server/data/refos-venue.sqlite` (plus `-wal` and `-shm` files while running), or the folder set in `REFOS_VENUE_DATA`. To back it up, stop the server and copy the whole `data` folder.
- **Keep an export after every event.** Venue data is not copied to Supabase automatically in this version.

## Maintenance commands

```bat
node --no-warnings server.mjs --list-events
node --no-warnings server.mjs --forget-event <event-id>
node --no-warnings server.mjs --forget-event <event-id> --purge
```

- `--list-events` lists the events paired with this server.
- `--forget-event` unpairs an event but keeps its data. Use it if the event was paired with the wrong key or after rotating the key.
- `--purge` also deletes that event's venue data. Export first.

To rotate an event's venue sync key (for example after a device with the key is lost):

1. In the Supabase SQL Editor, run:

   ```sql
   update public.refos_venue_sync_keys
   set sync_key = encode(extensions.gen_random_bytes(32), 'hex'), rotated_at = now()
   where event_id = '<event-id>';
   ```

   (`public.rotate_venue_sync_key('<event-id>')` does the same for a signed-in Admin from an app session. It refuses in the SQL Editor because no Admin is signed in there.)
2. With the internet available, wait about a minute. Online devices pick up the new key; until step 3 they show a Venue error.
3. On the venue computer run `node --no-warnings server.mjs --forget-event <event-id>`. The next device to sync pairs the event with the new key. Devices that missed the new key refresh it the next time they have internet.

## API (for reference)

All endpoints are under `/api/v1`. Event endpoints require `Authorization: Bearer <venue sync key>`; sending changes also requires an `X-Refos-Device` header (the device id).

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/health` | Service name, version, API version, status, server time. No secrets. |
| POST | `/api/v1/events/<id>/register` | Pair an event (first use) or confirm pairing |
| POST | `/api/v1/events/<id>/changes` | Send changes (idempotent by change id) |
| GET | `/api/v1/events/<id>/changes?since=<seq>` | Changes after a sequence number |
| GET | `/api/v1/events/<id>/export` | Export the event's venue data |
| GET | `/api/v1/events/<id>/status` | Record counts, latest sequence number, and number of known devices |

**Conflicts:** each record has a version number. If two devices edit the same record from the same starting version, the later change wins and is marked `applied_conflict` in the change log. An edit that arrives after the record was deleted does not bring it back.
