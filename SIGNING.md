# signing marka.md for distribution

current state: **unsigned**. macOS gatekeeper warns users on first launch ("apple cannot check it for malicious software"). there are three escalating levels of trust we can add.

## level 0 — unsigned (where we are)

- works for any user willing to right-click → open
- zero cost
- looks scary to non-technical users
- distribution: drop `.dmg` in GitHub Releases

## level 1 — ad-hoc signing (free, partial fix)

Adds a local signature so the binary identity is consistent across rebuilds, but Gatekeeper still warns. Useful for testing only.

```sh
codesign --force --deep -s - src-tauri/target/release/bundle/macos/marka.md.app
```

Tauri can do this via env:
```sh
APPLE_SIGNING_IDENTITY="-" bun run tauri build
```

Still requires right-click → open on the user's side. **Not worth shipping.**

## level 2 — developer id signing ($99/year)

Real Apple-signed app. No more "unidentified developer" warning. Required for distribution outside the Mac App Store.

### one-time setup

1. **enroll in Apple Developer Program** — $99/year — https://developer.apple.com/programs/
2. in Xcode → Settings → Accounts → add your Apple ID → "Manage Certificates" → "+" → **Developer ID Application**
3. verify in terminal:
   ```sh
   security find-identity -v -p codesigning
   # should show: "Developer ID Application: Your Name (TEAMID)"
   ```
4. note the certificate name + your team ID

### tauri config

Set env vars before building:

```sh
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
bun run tauri build
```

Or add to `tauri.conf.json` under `bundle.macOS`:
```json
{
  "bundle": {
    "macOS": {
      "signingIdentity": "Developer ID Application: Your Name (TEAMID)"
    }
  }
}
```

Now the `.app` and `.dmg` are signed. Gatekeeper still wants notarization (next step) before fully trusting.

## level 3 — notarization (recommended for launch)

Apple's automated malware check. Required for a frictionless first-launch experience.

### one-time setup

1. **generate an app-specific password** at https://appleid.apple.com → Sign-In and Security → App-Specific Passwords
2. store as keychain credential (or env var):
   ```sh
   xcrun notarytool store-credentials "marka-notarize" \
     --apple-id "you@example.com" \
     --team-id "TEAMID" \
     --password "xxxx-xxxx-xxxx-xxxx"
   ```

### each build

After `bun run tauri build`:

```sh
DMG=src-tauri/target/release/bundle/dmg/marka.md_0.1.0_aarch64.dmg

# submit for notarization (takes 2-5 min)
xcrun notarytool submit "$DMG" \
  --keychain-profile "marka-notarize" \
  --wait

# staple the notarization ticket to the dmg
xcrun stapler staple "$DMG"

# verify
spctl --assess --type install --verbose "$DMG"
```

Now users can double-click the `.dmg`, drag to Applications, and open with zero warnings.

### or have Tauri do it automatically

Add to env before `tauri build`:
```sh
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # app-specific password
export APPLE_TEAM_ID="TEAMID"
```

Tauri 2 will auto-notarize + staple if these are set together with `APPLE_SIGNING_IDENTITY`.

## CI signing (future — GitHub Actions)

Eventually move builds to GH Actions. Required secrets:

- `APPLE_CERTIFICATE` — base64-encoded `.p12` of the Developer ID Application cert
- `APPLE_CERTIFICATE_PASSWORD` — the password used when exporting the .p12
- `APPLE_SIGNING_IDENTITY` — the cert common name
- `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` — for notarization
- `KEYCHAIN_PASSWORD` — random string used to unlock the runner keychain

Workflow uses [tauri-action](https://github.com/tauri-apps/tauri-action) which handles import + sign + notarize.

## decision for launch tomorrow

**ship unsigned `.dmg` v0.1.0 with the right-click → open note in the README.**

Real talk: notarization buys polish but costs $99 + a few hours of setup. For an OSS launch where the audience is mostly devs comfortable bypassing Gatekeeper, the unsigned route is fine. Defer signing to v0.2.0 once there's real demand.
