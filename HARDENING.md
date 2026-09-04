# Ref OS 1.1 Hardening

This release adds reliability and maintenance work without changing the core event workflow.

## Supabase migration required

Run `supabase/hardening-event-settings.sql` once before using new shared settings.

New shared settings:
* contact_directory
* event_countdown
* role_access_codes

Legacy values stored in `field_log` remain readable as a fallback. New writes use `event_settings`.

## Failed sync recovery

Permanent server rejections are retained in IndexedDB under the failed sync queue. Admins can retry or discard them from Event Command Center.

## Automated browser checks

Run:

```cmd
npm run test:e2e
```

The command uses Playwright and checks desktop Chromium plus mobile WebKit. The initial run may download Playwright.

## App updates

The service worker uses a versioned cache. When a new worker is waiting, Ref OS displays an Update button rather than silently replacing the running app during an event.

## Error recovery

Fatal React rendering errors show a recovery screen with Reload, Clear App Cache, and Copy Diagnostics instead of a blank page.
