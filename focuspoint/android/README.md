# Focus Point — Android app (APK / AAB)

A **Trusted Web Activity**: the app opens the deployed Focus Point web app full screen in Chrome, so everything the
web app can do (offline mode, Web Push notifications, the floor plan, Sham Cash flow) works identically in the app, and
every update to the website reaches the app instantly with no store release.

- Package `com.focuspoint.app`, name «فوكس بوينت», adaptive icon from the brand mark, brand splash and status bar.
- Falls back to a Custom Tab / WebView on phones without Chrome.
- Notifications from the site appear as the app's own notifications (`DelegationService`).
- `assetlinks.json` carries the release key's SHA-256; the Worker must serve it at `/.well-known/assetlinks.json`
  (copy it to `web/public/.well-known/`) so Android hides the browser UI and trusts deep links.

## Build (release, signed)
```bash
./build.sh https://app.focuspoint.example 1 1.0.0
# → out/FocusPoint-1.0.0.apk  (hand out / install directly)
# → out/FocusPoint-1.0.0.aab  (upload to Google Play; Play requires the bundle)
```
The URL is baked into the app, so rebuild when the domain changes. `versionCode` must increase on every store upload.

## Signing key
`keystore/focuspoint-release.jks` + `keystore/README-PRIVATE.txt` (password) are **not in git**. Keep two backups: an app
published with this key can only ever be updated with this key. For Google Play, enrol in Play App Signing and upload
this key as the upload key.
