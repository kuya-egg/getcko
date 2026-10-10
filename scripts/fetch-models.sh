#!/usr/bin/env bash
# Downloads models listed in src-tauri/models.json into src-tauri/models/.
# Requires python3 (or python, as on Windows), curl, and sha256sum or shasum. Run
# before building; the app itself never downloads models at runtime.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/src-tauri/models"
mkdir -p "$DEST"

# On Windows `python3` is often only the Microsoft Store placeholder; use one that runs.
PYTHON=python3
"$PYTHON" -c "" >/dev/null 2>&1 || PYTHON=python

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
  else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

while IFS='|' read -r name url sum; do
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
# Windows Python ends its lines with CRLF; the checksums must not keep the CR.
done < <("$PYTHON" -c 'import json,sys; [print(x["file"]+"|"+x["url"]+"|"+x["sha256"]) for x in json.load(open(sys.argv[1]))]' "$ROOT/src-tauri/models.json" | tr -d '\r')
