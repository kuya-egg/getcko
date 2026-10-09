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
  "bge-small-en-v1.5-q8_0.gguf|https://huggingface.co/CompendiumLabs/bge-small-en-v1.5-gguf/resolve/main/bge-small-en-v1.5-q8_0.gguf|ec38e8da142596baa913124ae50550de284b6916bf59577ef2f0cb9660c2f514"
  "mmproj-gemma-4-E2B-it-Q8_0.gguf|https://huggingface.co/ggml-org/gemma-4-E2B-it-GGUF/resolve/main/mmproj-gemma-4-E2B-it-Q8_0.gguf|9406f99c16d68cda4f1f0552192dcc99021ea1fc6d2fd50b1dc3ccf30d04b292"
  "Qwen3VL-2B-Instruct-Q4_K_M.gguf|https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct-GGUF/resolve/main/Qwen3VL-2B-Instruct-Q4_K_M.gguf|089d75c52f4b7ffc56ba998ffc50aae89fcafc755f9e7208aacca281dca6c2ae"
  "mmproj-Qwen3VL-2B-Instruct-Q8_0.gguf|https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct-GGUF/resolve/main/mmproj-Qwen3VL-2B-Instruct-Q8_0.gguf|f9a68fabba69c3b81e153367b2c7521030b0fa8bb0de400c9599c8e6725f9c82"
  "ggml-small.en.bin|https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin|c6138d6d58ecc8322097e0f987c32f1be8bb0a18532a3f88f734d1bbf9c41e5d"
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
