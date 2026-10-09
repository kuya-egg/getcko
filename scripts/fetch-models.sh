#!/usr/bin/env bash
# Downloads the local models GetCko ships with into src-tauri/models/.
# Run once before `bun run tauri dev` / `bun run tauri:build`. This is the only
# network use in the whole product (BR-1); the app never downloads at runtime.
#
# Works on macOS and on Windows under Git Bash. Re-running skips verified files.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/src-tauri/models"
mkdir -p "$DEST"

# file name | url | sha256 (from the Hugging Face LFS pointer)
MODELS=(
  "gemma-4-E2B-it-Q4_0.gguf|https://huggingface.co/ggml-org/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q4_0.gguf|8e30dff3ac4c8434c49a7036fa15564bdbb6044e42bf04550bf1a096ad7e6a52"
  "embeddinggemma-300M-Q8_0.gguf|https://huggingface.co/ggml-org/embeddinggemma-300M-GGUF/resolve/main/embeddinggemma-300M-Q8_0.gguf|b5ce9d77a3fc4b3b39ccb5643c36777911cc4eb46a66962eadfa3f5f60490d63"
)

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
  else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

for entry in "${MODELS[@]}"; do
  IFS='|' read -r name url sum <<<"$entry"
  path="$DEST/$name"
  if [[ -f "$path" ]] && [[ "$(sha256 "$path")" == "$sum" ]]; then
    echo "ok       $name"
    continue
  fi
  echo "fetching $name"
  curl -fL --retry 3 -C - -o "$path.part" "$url"
  got="$(sha256 "$path.part")"
  if [[ "$got" != "$sum" ]]; then
    echo "checksum mismatch for $name: got $got, want $sum" >&2
    rm -f "$path.part"
    exit 1
  fi
  mv "$path.part" "$path"
  echo "ok       $name"
done
