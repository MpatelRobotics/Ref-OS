# Ref OS Hardening Status

Ref OS 1.2 adds server enforced event roles, expanded browser testing, further App.jsx decomposition, and fully local QR generation and decoding.

See `SECURITY-HARDENING.md` for the required Supabase migration and password migration steps.

Previous Ref OS 1.1 protections remain:
* React fatal error recovery instead of white screen failures.
* Failed offline writes retained for Admin retry/discard.
* Pending team reconciliation.
* Typed event settings.
* Versioned service worker update flow.
