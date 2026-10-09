#!/usr/bin/env bash
# Screen-tier measurement (architecture: three tiers): 10 scripted questions in each of
# Safari (scripts/fixtures/class-record.html), Finder and Calculator, in every forced
# tier. Brings those apps to the front while it runs; needs Accessibility and Screen
# Recording for the terminal. Pass `--app <name>` for one app, `--dump <app>` to list
# an app's elements and save the screenshot the model sees.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODELS="$ROOT/src-tauri/models"
if ! compgen -G "$MODELS/*.gguf" >/dev/null; then
  echo "No model files found in $MODELS. Run 'bun run models' first." >&2
  exit 1
fi

printf 'Machine: %s; macOS %s; %s\n' "$(sysctl -n machdep.cpu.brand_string)" \
  "$(sw_vers -productVersion)" "$(date +%Y-%m-%d)"
cd "$ROOT/src-tauri"
cargo run --release --example tier_eval -- "$@"
