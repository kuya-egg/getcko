#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODELS="$ROOT/src-tauri/models"
if ! compgen -G "$MODELS/*.gguf" >/dev/null; then
  echo "No model files found in $MODELS. Run 'bun run models' first." >&2
  exit 1
fi

cpu="$(sysctl -n machdep.cpu.brand_string)"
macos="$(sw_vers -productVersion)"
memory="$(sysctl -n hw.memsize)"
memory_gib="$(awk -v bytes="$memory" 'BEGIN { printf "%.1f GiB", bytes / 1073741824 }')"
machine="${cpu}; macOS ${macos}; ${memory_gib} RAM"
printf 'Benchmark machine: %s\n' "$machine"

fixture_dir="$(mktemp -d)"
trap 'rm -rf "$fixture_dir"' EXIT
# The PRD demo question in English, read twice: by a US voice, and by the Spanish
# (Mexico) voice, whose "Juan" (/hwan/) is how a Filipino speaker says it. macOS has
# no Filipino English voice.
QUESTION="Where do I put Juan's grade in the class record, and how is the final grade computed?"
say -v Samantha -o "$fixture_dir/us.wav" --data-format=LEI16@16000 "$QUESTION"
say -v Paulina -o "$fixture_dir/hwan.wav" --data-format=LEI16@16000 "$QUESTION"

cd "$ROOT/src-tauri"
for clip in ${CLIPS:-hwan us}; do
  echo "## Clip: $clip"
  BENCH_DATE="$(date +%Y-%m-%d)" BENCH_MACHINE="$machine" cargo run --release --example benchmark -- \
    --runs "${RUNS:-10}" --wav "$fixture_dir/$clip.wav"
done
