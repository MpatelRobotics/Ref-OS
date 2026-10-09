# Ref OS TM Connect for Android

The Android app bundles Ref OS and connects to TM using native HTTP and signed WebSockets. One event administrator's device uploads the data to Ref OS Cloud. Other devices use the existing Ref OS website or PWA.

## Publish the download

The repository's Android signing secrets and public Supabase build variables have been configured. The private signing backup is stored outside this repository at `C:\Users\mahar\Documents\Ref OS Android Signing`. Keep both the `.p12` file and `signing-backup.json` in a secure backup: future APK updates need the same signing key. Never commit or publish them.

After pushing the Android changes, open GitHub Actions and manually run **Build downloadable Android TM connector** on the branch containing these changes. It builds a signed release APK, verifies its signature, and publishes `Ref-OS-TM-Connect.apk` and its SHA-256 checksum under the `tm-connect-android` release. Nothing is published until that workflow succeeds.

Push these files from CMD (leaves unrelated Windows signing and iOS work out):

```cmd
cd /d C:\Users\mahar\Downloads\Ref-os
git add .gitignore .env.example package.json package-lock.json capacitor.config.json android mobile/tm-sockets/package.json mobile/tm-sockets/android mobile/ANDROID-DOWNLOAD.md src/api.js src/main.jsx src/components/TmApiSync.jsx src/tmMobile.js src/tmMobileClient.js src/tmFieldEvent.js scripts/sync-mobile.mjs scripts/configure-android-build.mjs tests/tm-mobile.test.mjs .github/workflows/tm-android-release.yml
git diff --cached --stat
git commit -m "Add downloadable Android TM connector"
git push
```

Once the release exists, set this public website environment variable and redeploy Ref OS:

```
VITE_TM_ANDROID_DOWNLOAD_URL=https://github.com/MpatelRobotics/Ref-OS/releases/download/tm-connect-android/Ref-OS-TM-Connect.apk
```

Android browsers will then see **Download Ref OS TM Connect for Android** in TM setup. Before this URL is configured, the app displays that the download is being prepared.

## Event staff

1. Download the APK on an Android device (Android 7 or later).
2. Open the downloaded file and, if prompted, allow that browser to install this app.
3. Connect to Wi-Fi that can reach both TM and the internet.
4. Open **Ref OS TM Connect**, sign in, select the event and division, then open Tournament Manager API.
5. Enter the TM server IP and event API key, review the data, and start syncing.

Keep the app open and the device awake while syncing. Switching apps or locking the device can pause live updates. This release does not add an Android foreground service. Developer TM credentials stay in Supabase; the event API key stays in app memory.

## Verification status

Website build, Capacitor Android synchronization, and automated native-transport tests have passed. A signed APK has not yet been compiled locally: this machine has no Android SDK or Java. GitHub must successfully compile the release, and a physical Android device should be tested with a live TM event before event use.
