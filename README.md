# VEX Violation Tracker

A shared, multi-referee violation log for VEX robotics events. Refs sign in,
join an event, and log **minor / major / inspection** violations against teams —
citing the rule, attaching robot photos, and tagging the match. Everyone on the
crew sees each other's entries live.

Built with **Vite + React + Tailwind**, backed by **Supabase** (Postgres +
Auth + Storage + Realtime).

---

## What you need
- A free [Supabase](https://supabase.com) account
- [Node.js](https://nodejs.org) 18+ installed
- A host for the built site (Vercel, Netlify, or Cloudflare Pages — all free tiers)
- Optional: a domain (e.g. a `.fyi`) to point at the host

---

## 1. Set up Supabase (one time)
1. Create a new project at supabase.com. Set a database password and pick a region near your events.
2. Open **SQL Editor**, paste the entire contents of `supabase/schema.sql`, and click **Run**. This creates the tables, security rules, the photo storage bucket, and realtime.
3. In the SQL Editor, paste `supabase/seed.sql` and **Run** it too. This creates the single locked event (The Highlander Summit Signature Event) and preloads your teams.
4. (Optional) Paste `supabase/seed_rules.sql` and **Run** it to preload the game rulebook. Then the **Rule cited** box autocompletes every rule code and auto-fills its description.
5. (Optional, once the schedule exists) Paste `supabase/seed_matches.sql` and **Run** it to load the qualification match schedule. Then, when logging, picking a qual match shows that match's 4 teams as red/blue tap-chips so refs tap the offender instead of scrolling the full roster. Re-run any time the schedule changes.
3. Open **Authentication → Providers → Email** and make sure **Email** is enabled (magic-link / OTP sign-in is on by default).
4. Under **Authentication → URL Configuration**, set **Site URL** to where the app will live. For local testing use `http://localhost:5173`; add your real domain once deployed.
5. Open **Project Settings → API** and copy the **Project URL** and the **anon public** key.

## 2. Configure the app
```bash
cp .env.example .env
```
Edit `.env` and paste your two values:
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_SITE_PASSWORD=Highlander2026
```
`VITE_SITE_PASSWORD` is the single shared password refs type to open the site — change it to whatever you want to give your crew, and set the same value in your host's environment variables when you deploy. Note: this password gates the app UI, not the database itself (the anon key ships in the browser), so it's practical "keep strangers out" protection rather than hardened security — fine for a private ref crew on an obscure URL.
The anon key is safe to expose in the browser — the database is protected by
row-level security, so only members of an event can read or write its data.

## 3. Run it locally
```bash
npm install
npm run dev
```
Open the printed URL (usually http://localhost:5173). Sign in with your email,
create an event, and you're logging.

## 4. Build for production
```bash
npm run build
```
Produces a static site in `dist/`.

## 5. Deploy
Any static host works:

- **Vercel / Netlify** — connect the repo (or drag-and-drop the project). Build
  command `npm run build`, output directory `dist`. Add the two environment
  variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in the host dashboard.
- **Cloudflare Pages** — framework preset "Vite", build `npm run build`, output
  `dist`, add the same two env vars.

After deploying, return to Supabase → Authentication → URL Configuration and add
your live URL to **Site URL** and **Redirect URLs** so magic-link emails return
people to the right place.

## 6. Point your domain
Buy a domain from any registrar (Dynadot, Porkbun, Namecheap, Cloudflare…). In
your host's project settings, add the custom domain and follow its DNS
instructions (usually a `CNAME`, or switch nameservers to the host). SSL is
issued automatically.

---

## How refs use it
- **Sign in** with email (one-tap link, no password).
- **Open the site** by entering the shared crew password, then set a ref name. The app is locked to the one Highlander Summit event.
- **Everyone in** has the same tools from the menu: event setup (match counts), invite (share the link), export CSV, lock the device, and clear-event.
- **Invite crew** — menu → *Invite other refs* → share the site link and the 6-character event code.
- **Log a violation** — pick the team (or type a new one), pick the match from the dropdown, choose minor/major/inspection, cite the rule, snap robot photos, add notes.
- **Review** — per-team rule breakdowns, plus a global *By Rule* view showing which teams broke what and how often.
- **Export CSV** anytime from the menu.

## Works through network dropouts
Referee tables often sit in venue dead zones. When you log a violation, it's
saved to the device immediately (in the browser's IndexedDB) and shown in the
log right away with a **Saving** marker — no spinner, no lost call. It uploads to
Supabase automatically when the connection returns (on reconnect, on focus, and
on a periodic retry). The header shows an **offline** pill and a **pending**
count so refs can see nothing is lost, and photos display from the device until
they finish uploading. Because each violation gets its own ID before it's saved,
two refs logging offline never collide. (This is write durability, not full
offline browsing — reading brand-new data from other refs still needs a
connection.)

## Notes & limits
- Photos are compressed in the browser and stored in the private `robot-photos`
  bucket, served via short-lived signed URLs. While offline, queued photos live
  on the device until they sync, so avoid piling up hundreds of un-synced photos.
- On Supabase's free tier a project **pauses after ~1 week of inactivity** — open
  the Supabase dashboard to wake it before an event.
- Anyone with an event's join code can add and delete that event's data, so share
  codes only with your officiating crew.
- Change match structure (e.g. a different bracket) any time in *Event setup* — it
  updates the dropdowns for everyone.

## Project layout
```
index.html            app shell
src/
  main.jsx            entry
  App.jsx             all UI (auth gate, event picker, tracker)
  api.js              Supabase data layer (auth, events, teams, violations, photos, realtime)
  supabaseClient.js   Supabase client from env vars
  index.css           Tailwind
supabase/schema.sql   run once in the Supabase SQL editor
.env.example          copy to .env and fill in
```
