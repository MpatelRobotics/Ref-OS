# Developer passkeys

The Developer page supports WebAuthn passkeys. Set up Windows Hello in Windows Settings first. Enter the Developer code on the Ref OS Developer login screen and choose **Set up fingerprint / passkey**. On later visits use **Sign in with passkey**. Windows Hello chooses fingerprint, face, or PIN; Ref OS cannot force fingerprint-only verification or access biometric data.

## Server setup

1. Run `supabase/developer-passkeys.sql` in the Supabase SQL Editor after `refos-2-developer-access.sql`.
2. Set `REFOS_PASSKEY_ORIGIN` to the exact HTTPS website origin, without a trailing slash or path. Set `REFOS_PASSKEY_RP_ID` to that origin's hostname. Example: `https://www.ref-os.fyi` and `www.ref-os.fyi`. Use the stable production domain; passkeys do not transfer to unrelated preview domains.
3. Deploy `refos-developer-passkey`. It verifies the user's Supabase session itself, so deploy with `--no-verify-jwt`, matching the existing anonymous-session authentication model.
4. The function must have the same server-only `REFOS_SUPER_ADMIN_CODE` already used by Developer sign-in. Never include its value in source, commands shared with others, or this document.

```cmd
npx supabase secrets set REFOS_PASSKEY_ORIGIN=https://www.ref-os.fyi REFOS_PASSKEY_RP_ID=www.ref-os.fyi
npx supabase functions deploy refos-developer-passkey --no-verify-jwt
```

Registration needs a fresh Developer code, not an ordinary Admin sign-in. Authentication requires a server-verified signature and user verification. Challenges expire after five minutes, are tied to the current device session and event, and are consumed atomically once. The server checks the configured origin and RP ID. Public keys are stored in service-role-only tables; no fingerprint or private key is stored by Ref OS. Changing the Developer code or service-role signing secret invalidates prior passkeys.

To revoke all registered Developer passkeys, run in the SQL Editor:

```sql
delete from public.developer_passkeys;
delete from public.developer_passkey_challenges;
```

Revocation prevents future passkey sign-ins; it does not revoke previously granted event sessions. Continue using the existing access/session controls for those.

Use the production website in a browser that supports passkeys. Native Android WebView support varies; the Developer code remains available in both connectors. The Windows connector uses the same website, but Windows Hello also requires support from its embedded browser. Use Edge or Chrome if the embedded browser does not offer Windows Hello.

Validation includes a Chromium virtual authenticator with registration, discoverable sign-in, and rejection of incorrect origins/challenges. Physical Windows Hello enrollment and production deployment still need verification on the user's laptop.
