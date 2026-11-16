# Encounters iOS validation — 2026-09-28

## Result
Live iPhone 16 Pro / iOS 18.5 Simulator verification: OTP login succeeded, Keychain persistence succeeded, Discoverable nearby and Location Sharing were both visibly ON with no error banner. Real two-device BLE matching and the complete Icebreaker flow remain untested.

## Changes
- Use native community geolocation instead of removed navigator.geolocation; activate tracking only after a position, show denial/provider errors, and clean up watches/timers.
- Validate Discoverable response envelopes and display rejected-login errors. Do not overwrite saved interests when toggling.
- Authenticate link-hevolve with the current Hevolve Bearer token and verified account email, only to the configured HTTPS cloud, with a 10-second timeout.
- Deduplicate social-token refresh, reject stale-account results, and preserve the separate HARTOS Keychain slot. Await login persistence, clear the previous social token, and remove credential debug output.
- Add Resend code with a 30-second cooldown on signup/re-login verification screens.
- Add simulator-only application identifier and app-scoped Keychain access group in Simulator.entitlements, wired through project.yml.

## Validation
- Final Jest run: all 37 tests in 6 suites passed.
- TypeScript and shared-file manifest checks passed; git diff --check passed.
- CocoaPods installation, production JS bundle, and signed Debug simulator Xcode build succeeded.
- Final JavaScript-only resend changes were bundled into the existing native app, ad-hoc re-signed, installed, and visually verified without repeating the native build.
- Shared cloud rejects anonymous Discoverable GET with HTTP 401.

## Runtime fixes and build notes
The first simulator build used CODE_SIGNING_ALLOWED=NO, which caused SecItemAdd -34018 after successful OTP verification. Use CODE_SIGNING_ALLOWED=YES and CODE_SIGN_IDENTITY=- for simulator login testing. Limit native compilation to -jobs 2 on this Mac.

A saved simulator AsyncStorage hevolve_api_base override pointed to http://127.0.0.1:5000. Native logs confirmed connection refused. Removed only that obsolete runtime setting, preserving account data, and relaunched with the normal configured HTTPS endpoint. This setting correction is local simulator state, not a repository source change.

Read-only email investigation found that the deployed login service does not check the mail HTTP response and the mail service responds before its send callback. No email-server changes were made; a reported OTP send is not proof of inbox delivery. The user completed OTP through the updated screen.

## Device constraint
Run only one emulator/simulator at a time: simultaneous Android and iOS devices overload this Mac. Android is stopped; the iOS simulator remains available. Simulator location is a test position, not evidence of real-world BLE proximity.
