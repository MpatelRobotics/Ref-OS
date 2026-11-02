# Google Play publication

Two separate apps:

| Listing | Package | Bundle |
|---|---|---|
| Ref-OS | com.refos.referee | Ref-OS.aab |
| Ref-OS Connect | com.refos.app | Ref-OS-Connect.aab |

Run the **Build Google Play app bundles** GitHub Actions workflow and download the **Ref-OS-Google-Play** artifact. Keep the existing Android upload key; never replace it to fix a build error. Both bundles target Android 16 (API 36). Connect includes TM and venue hosting; Ref-OS opens directly into the event app.

## Listing drafts

### Ref-OS
Short description: Tools for VEX event staff: matches, rules, violations and nominations.

Ref-OS helps staff coordinate VEX robotics events from one shared workspace. View match schedules and team information, record rule violations and watch notes, use robot reference photos, and submit Sportsmanship and Energy Award nominations. Qualification rankings and Skills data support performance tracking.

An event access code is required for event workspaces. Explore the public demonstration using DEMOV5 and fictional sample teams. Ref-OS is an independent tool and is not an official VEX or RECF product.

### Ref-OS Connect
Short description: Connect Tournament Manager and host a local Ref-OS venue server.

Use Ref-OS Connect on an Android device connected to your event network. Connect to Tournament Manager using its server address and event API key, or run a local venue server for supported Ref-OS event records. Other devices connect using the venue address shown in the app.

TM access requires a running Tournament Manager server and its Local TM API. Keep the host device powered and connected to the venue network. First-time sign-in and cloud features require internet access. Local venue records do not automatically copy to the cloud; export a backup before switching modes.

Ref-OS Connect is an independent tool for VEX events and is not an official VEX or RECF product.

## Console setup remaining

- Developer account registration, identity and device verification as requested by Google.
- Create both free app listings, using the correct package and bundle for each.
- Upload icons, feature graphics and actual Android screenshots for each app.
- Supply app access instructions: public demo code DEMOV5. TM/venue testing requires the appropriate local network setup; do not provide private event codes or production API keys.
- Complete privacy policy, Data safety, content rating, target audience and foreground service declarations from actual app behavior. Do not assume that a shared backend or a WebView means no data is collected.
- Review account deletion requirements for account creation flows before submission.
- Start internal testing, then any required closed testing. New personal accounts may require 12 testers opted in continuously for 14 days before applying for production access.
- Submit for production only after real-device verification and the required tests. Publishing a bundle in CI does not publish it to Google Play.

Support: refos.app@gmail.com
