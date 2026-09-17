# All role push alerts and help requests

This update allows Referees, Judge Advisors, Emcees, and Admins to enable push alerts. Help requests are sent to every subscribed event volunteer and can be acknowledged by an Admin.

## Database update

Open the Supabase SQL Editor and run the complete contents of:

```text
supabase/all-role-push-help-requests.sql
```

This replaces the Admin only subscription policies and allows Judge Advisors to create help requests without granting any broader Field Log access.

## Edge Function update

From Windows CMD inside the Ref OS project folder, deploy the updated function:

```cmd
npx supabase functions deploy send-code-request-push
```

The existing VAPID keys and secrets remain valid. Do not generate new keys.

## Device enrollment

Each volunteer who wants notifications must open Settings, find Access, and select Enable push alerts once on that device.

Existing Admin subscriptions continue to work. Other roles must enable alerts after this database update is installed.
