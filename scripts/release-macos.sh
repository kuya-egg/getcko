#!/usr/bin/env bash
# Builds the downloadable macOS DMG signed with a Developer ID, notarises it with Apple,
# and staples the ticket, so it opens on any Mac without a Gatekeeper warning.
#
# One-time setup (see README "Signed release"):
#   - a "Developer ID Application" certificate in the login keychain
#   - notarisation credentials saved with
#       xcrun notarytool store-credentials getcko --apple-id <email> --team-id <TEAMID>
#
# Usage:
#   APPLE_SIGNING_IDENTITY="Developer ID Application: Name (TEAMID)" bash scripts/release-macos.sh
# NOTARY_PROFILE overrides the keychain profile name (default: getcko).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE="${NOTARY_PROFILE:-getcko}"

if [[ -z "${APPLE_SIGNING_IDENTITY:-}" ]]; then
  echo "Set APPLE_SIGNING_IDENTITY to your Developer ID Application identity:" >&2
  security find-identity -v -p codesigning | grep "Developer ID Application" >&2 || true
  exit 1
fi
if ! xcrun notarytool history --keychain-profile "$PROFILE" >/dev/null 2>&1; then
  echo "No notarisation credentials in the keychain profile '$PROFILE'. Run:" >&2
  echo "  xcrun notarytool store-credentials $PROFILE --apple-id <email> --team-id <TEAMID>" >&2
  exit 1
fi

cd "$ROOT"
bash scripts/build-whisper.sh
# Tauri signs the app and the speech helper with APPLE_SIGNING_IDENTITY, the hardened
# runtime and src-tauri/Entitlements.plist, then signs the DMG.
export APPLE_SIGNING_IDENTITY
bun run tauri:release

DMG="$(ls -t "$ROOT"/src-tauri/target/release/bundle/dmg/*.dmg | head -1)"
echo "Notarising $DMG (usually a few minutes)"
xcrun notarytool submit "$DMG" --keychain-profile "$PROFILE" --wait
xcrun stapler staple "$DMG"

# The check Gatekeeper runs on a downloaded copy.
xcrun stapler validate "$DMG"
spctl --assess --type open --context context:primary-signature -v "$DMG"
MOUNT="$(hdiutil attach -nobrowse -readonly "$DMG" | awk -F'\t' '/Volumes/{print $NF}')"
spctl --assess --type execute -v "$MOUNT/GetCko.app"
hdiutil detach -quiet "$MOUNT"
shasum -a 256 "$DMG"
