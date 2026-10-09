#!/usr/bin/env bash
# Screen-tier measurement (architecture: three tiers): 10 scripted questions in each of
# Google Chrome (scripts/fixtures/class-record.html), Finder and TextEdit, in every
# forced tier. Opens only those three apps; needs Accessibility and Screen Recording for
# the terminal. `--app <name>` runs one app, `--survey` asks about controls found on each
# screen, `--dump <app>` lists an app's elements and saves the screenshot the model sees,
# `--heldout` runs the held-out pages in scripts/fixtures/heldout/ instead (never used to
# tune the pipeline), and GETCKO_GROUNDER=qwen3-vl|ui-tars uses a grounding model in tier 3.
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
