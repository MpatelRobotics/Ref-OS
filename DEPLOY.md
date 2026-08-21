# Deployment runbook — from zero to a live, tested site

Follow these in order. Budget ~1 hour the first time. Anything marked ⚠️ is a
common place people get stuck.

Legend: 🖥️ = on your computer, 🌐 = in a browser dashboard.

---

## Phase 0 — Before you start
- 🖥️ Install **Node.js 18 or newer**. Check with `node -v`.
- 🖥️ Unzip the project somewhere you can find it (e.g. `~/vex-violation-tracker`).
- 🌐 Create a free **GitHub** account if you don't have one (makes deploying one-click). Optional — there's a no-GitHub path below.
- Have an email inbox handy — you'll sign into the app with a magic link.

---

## Phase 1 — Stand up the Supabase backend
1. 🌐 Go to **supabase.com**, sign up, and click **New project**.
2. Name it, set a **database password** (save it somewhere), pick a **region** close to where your events are, and create it. Wait ~2 minutes for it to finish provisioning.
3. In the left sidebar open **SQL Editor** → **New query**. Open `supabase/schema.sql` from the project, copy **all** of it, paste, and click **Run**. You should see "Success. No rows returned."
4. Verify it worked: open **Table Editor** — you should see `events`, `event_members`, `teams`, `violations`, `profiles`. Open **Storage** — you should see a `robot-photos` bucket.
5. 🌐 Open **Authentication → Providers** and confirm **Email** is enabled (it is by default; magic-link sign-in needs it).
6. 🌐 Open **Project Settings → API** and copy two values — you'll paste them next:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key (a long string; the one labeled *anon* / *public*, NOT the *service_role* key)

⚠️ **Email deliverability:** Supabase's built-in email sender is rate-limited (a handful per hour) and meant for testing. It's fine for you and a couple of test accounts. For a real event where several refs sign in at once, set up a custom SMTP sender (Resend, SendGrid, Postmark, etc.) under **Authentication → Emails / SMTP**, or the magic-link emails may not all arrive. Do this before event day, not during.

---

## Phase 2 — Run it locally and test (do this before deploying)
1. 🖥️ In the project folder, copy the env template:
   ```bash
   cp .env.example .env
   ```
2. 🖥️ Open `.env` and paste your two values:
   ```
   VITE_SUPABASE_URL=https://abcd1234.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
3. 🌐 In Supabase, open **Authentication → URL Configuration**:
   - Set **Site URL** to `http://localhost:5173`
   - Under **Redirect URLs**, add `http://localhost:5173` (and `http://localhost:5173/**`)
   - Save. (This is what lets the magic-link email bring you back to the app.)
4. 🖥️ Install and run:
   ```bash
   npm install
   npm run dev
   ```
   Open the printed URL (usually http://localhost:5173).
5. **Smoke test locally:**
   - Enter your email → check inbox → click the sign-in link (opens the app signed in).
   - Set your ref name → **Create event** (name it, top-16 / best of 3, etc.).
   - Tap **Log violation**: pick/type a team, pick a match, choose a type, cite a rule, add a photo, Save. It should appear instantly.
   - Confirm the data really landed: in Supabase, **Table Editor → violations** shows the row; **Storage → robot-photos** shows the image.
6. **Test offline durability (important):**
   - Open browser DevTools → **Network** tab → set throttling to **Offline**.
   - Log a violation. It appears with a **Saving** marker and an **offline** pill shows in the header.
   - Reload the page while still offline — the entry is still there (it's saved on the device).
   - Set the network back to **Online** — within a few seconds the marker clears and it syncs. Confirm the row now appears in Supabase.

If all of that works locally, deploying is just repeating the config on a host.

---

## Phase 3 — Build the production version
1. 🖥️
   ```bash
   npm run build
   ```
   This creates a `dist/` folder (the static site).
2. 🖥️ Optional sanity check of the built version:
   ```bash
   npm run preview
   ```

---

## Phase 4 — Deploy (pick ONE host)
All three below have free tiers and work identically well. Vercel via GitHub is
the smoothest.

### Option A — Vercel with GitHub (recommended)

**Part A — Get the project onto GitHub**
1. 🖥️ In the project folder (the one with `package.json`):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```
2. 🌐 On **github.com**, click **+** (top-right) → **New repository**.
3. Name it `vex-violation-tracker`, choose **Private**. ⚠️ Do **not** check "Add a README", ".gitignore", or "license" — the project already has them and adding them here creates a conflicting commit. Click **Create repository**.
4. 🖥️ GitHub shows a page with **"…or push an existing repository from the command line."** Run those three lines (your username is filled in):
   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/vex-violation-tracker.git
   git branch -M main
   git push -u origin main
   ```
5. ⚠️ **First-push auth:** GitHub won't accept your login password here. When prompted for a password, paste a **Personal Access Token** (github.com → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate, tick the `repo` scope). *Simpler:* use **GitHub Desktop** (sign in once, **Add Existing Repository**, **Publish**) — no token needed.
6. 🌐 Refresh the repo page — you should see all the files, and `.env` should **not** be there (it's gitignored, which is correct).

**Part B — Import into Vercel**
7. 🌐 Go to **vercel.com**, sign in with **Continue with GitHub**, and authorize access to your repos (you can grant just this one).
8. Dashboard → **Add New… → Project** → find `vex-violation-tracker` → **Import**.
9. On **Configure Project**:
   - **Framework Preset**: should auto-detect **Vite** (pick it if not).
   - **Root Directory**: leave `./`.
   - **Build and Output Settings**: leave defaults (`npm run build`, output `dist`).
   - Expand **Environment Variables** and add two (Name, Value, **Add** each):
     - `VITE_SUPABASE_URL` → your Supabase Project URL
     - `VITE_SUPABASE_ANON_KEY` → your anon public key
10. Click **Deploy** and wait ~1–2 min.
11. You'll get a URL like `vex-violation-tracker.vercel.app`. Click **Visit** — it should load to the sign-in screen. If you see **"Not configured yet"**, the env vars didn't take: **Settings → Environment Variables**, fix, then **Deployments → ⋯ → Redeploy**.

**Part C — Updating the site later**
12. 🖥️ Vercel auto-deploys on every push to `main`:
   ```bash
   git add .
   git commit -m "what changed"
   git push
   ```
   ⚠️ Changing an **env var** in Vercel only applies on the next deploy — hit **Redeploy** or push a commit.

### Option A2 — Vercel without GitHub (CLI)
```bash
npm i -g vercel
vercel            # follow prompts; accept Vite defaults
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel --prod     # deploy to production
```

### Option B — Netlify
Drag-and-drop the `dist/` folder at app.netlify.com, **or** connect the GitHub repo with build `npm run build` and publish directory `dist`. Add the two env vars under **Site configuration → Environment variables**, then trigger a redeploy.

### Option C — Cloudflare Pages
Create a Pages project from the repo, framework preset **Vite**, build `npm run build`, output `dist`, add the two env vars, deploy.

---

## Phase 5 — Point auth at the deployed URL
⚠️ This is the #1 thing people forget — skip it and sign-in links bounce to localhost.

🌐 Supabase → **Authentication → URL Configuration**:
- Set **Site URL** to your deployed URL (e.g. `https://your-project.vercel.app`).
- Add it to **Redirect URLs** too (`https://your-project.vercel.app` and `https://your-project.vercel.app/**`).
- Keep the localhost entries if you still want to develop locally.
- Save.

Now test the deployed URL: open it, sign in, confirm the magic link returns you to the live site.

---

## Phase 6 — Buy and connect your domain
1. 🌐 Buy a domain at any registrar (Porkbun, Cloudflare, Namecheap, Dynadot…). Prices for `.fyi` vary by registrar and year — you'll see the exact figure at checkout.
2. Decide the address:
   - A **subdomain** like `tracker.yourname.fyi` (easiest DNS), or
   - The **root/apex** like `yourname.fyi`.
3. 🌐 In your host (Vercel example): **Project → Settings → Domains → Add** → type your domain.
4. The host will show you the **exact DNS record(s)** to create. Use the values it displays (they can differ by host and can change over time):
   - Subdomain → usually a **CNAME** pointing to a host-provided target (e.g. `cname.vercel-dns.com`).
   - Apex/root → usually an **A record** to a host-provided IP (Vercel currently shows `76.76.21.21`), or the option to use the host's nameservers.
5. 🌐 Go to your registrar's **DNS settings** and add exactly those records.
6. Wait for DNS to propagate (minutes to a couple of hours). The host auto-issues an HTTPS certificate — once it shows "valid/active", the domain works with `https://`.
7. ⚠️ Go **back to Supabase → URL Configuration** and add your custom domain to **Site URL** and **Redirect URLs** (`https://yourname.fyi` and `/**`). Otherwise logins on the custom domain fail.

---

## Phase 7 — Full end-to-end test on the real domain
Do these on the actual domain, ideally on a phone over cellular (not your home WiFi):

1. **Sign in** on your phone at `https://yourname.fyi` — magic link returns you to the site. ✅
2. **Second account/device:** on a laptop (or a friend's phone), sign in with a different email, tap **Join with a code**, enter the event's 6-char code. ✅
3. **Realtime:** log a violation on one device — it appears on the other within a few seconds. ✅
4. **Photos:** log one with a robot photo — confirm the photo shows on the *other* device (proves storage + signed URLs + permissions all work). ✅
5. **Offline:** put the phone in airplane mode, log a violation (appears with **Saving**), turn WiFi/cell back on, watch it sync. ✅
6. **Export:** open the menu → **Export CSV** — a file downloads with your rows. ✅
7. **Invite flow:** menu → **Invite other refs** → the site URL and event code copy correctly. ✅

If all seven pass, you're production-ready.

---

## Quick troubleshooting
- **"Not configured yet" screen** → env vars missing/typo'd on the host, or you changed them without redeploying. Re-check and redeploy.
- **Magic-link email never arrives** → free-tier rate limit; wait a few minutes or set up custom SMTP (Phase 1 ⚠️). Also check spam.
- **Sign-in link sends me to localhost / an error page** → the URL isn't in Supabase **Redirect URLs**, or **Site URL** is still localhost (Phase 5 / 6.7).
- **Photos don't show on another device** → make sure you ran the *entire* `schema.sql` (it creates the storage bucket and its access rules).
- **App loads but no data / can't create event** → schema not fully run, or you're using the wrong key (use *anon public*, not service_role).
- **Domain shows "not secure" or 404 for a while** → DNS still propagating / certificate still issuing; give it up to a couple hours, confirm the DNS records exactly match what the host showed.
- **Everything was working, now it's slow/asleep after a week** → free Supabase projects pause when idle; open the Supabase dashboard to wake it before an event.

---

## One-time vs. every-event
- **One-time:** Phases 0–6. After that the site just stays up.
- **Before each event:** open the Supabase dashboard once to make sure the project is awake; confirm custom SMTP is set if many refs will sign in; create the event and share the join code.
