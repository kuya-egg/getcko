#!/usr/bin/env bash
# Builds GetCko's speech-to-text helper (src-tauri/sidecars/whisper) and puts it where
# Tauri expects a sidecar: src-tauri/binaries/getcko-whisper-<target triple>[.exe].
# whisper.cpp runs in that separate process because its ggml cannot be linked into the
# app next to llama.cpp's. Run once before `bun run tauri dev` / `bun run tauri:build`;
# without it the app falls back to Gemma for speech-to-text.
#
# Works on macOS and on Windows under Git Bash.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TRIPLE="$(rustc -vV | sed -n 's/^host: //p')"
EXT=""
[[ "$TRIPLE" == *windows* ]] && EXT=".exe"

cargo build --release --manifest-path "$ROOT/src-tauri/sidecars/whisper/Cargo.toml"
mkdir -p "$ROOT/src-tauri/binaries"
cp "$ROOT/src-tauri/sidecars/whisper/target/release/getcko-whisper$EXT" \
  "$ROOT/src-tauri/binaries/getcko-whisper-$TRIPLE$EXT"
echo "ok       src-tauri/binaries/getcko-whisper-$TRIPLE$EXT"
