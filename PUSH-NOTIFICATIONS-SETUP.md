# Ref OS admin push notification setup

Push alerts require one Supabase database migration, one Edge Function, VAPID secrets, and the public VAPID key in Vercel.

## 1. Generate the keys

From Windows CMD in the Ref OS project folder:

```cmd
npm run push:vapid-keys
```

Keep the printed private key secret. Do not place it in `.env` or commit it to GitHub.

## 2. Create the database tables

Open the Supabase SQL Editor and run the complete contents of:

```text
supabase/push-notifications.sql
```

## 3. Deploy the Edge Function

Install and authenticate the Supabase CLI if it is not already available, then run:

```cmd
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy send-code-request-push
```

## 4. Store the Edge Function secrets

Use the values produced in step 1:

```cmd
npx supabase secrets set VAPID_PUBLIC_KEY="YOUR_PUBLIC_KEY" VAPID_PRIVATE_KEY="YOUR_PRIVATE_KEY" VAPID_SUBJECT="mailto:YOUR_EMAIL_ADDRESS"
```

Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to the function automatically.

## 5. Add the public key to Vercel

In Vercel, open Project Settings, Environment Variables, and add:

```text
VITE_VAPID_PUBLIC_KEY=YOUR_PUBLIC_KEY
```

Use the same public key from step 1 and redeploy Ref OS.

## 6. Enable alerts on each volunteer device

Sign in as a Referee, Judge Advisor, Emcee, or Admin, open Settings, and tap **Enable push alerts**. Accept the device notification prompt.

On iPhone or iPad, Ref OS must first be installed with Safari's **Add to Home Screen** action. Open the installed Ref OS app and enable push alerts there.

Each phone, tablet, or computer must enable alerts once. All subscribed event roles receive code and help request alerts so nearby volunteers can notify an Admin if needed.
