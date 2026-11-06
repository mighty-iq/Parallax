#!/usr/bin/env bash
# Run a browser test while holding one of N machine-wide slots (default 2: the build machine has
# 2 CPUs, and more than two headless Chromiums at once make every test slow and flaky).
#   tests/e2e/pwslot.sh python3 tests/e2e/harness_fold.py
# Waits until a slot is free, runs the command, passes its exit code through.
set -u
SLOTS="${PW_SLOTS:-2}"
DIR="$(cd "$(dirname "$0")" && pwd)/out/.locks"
mkdir -p "$DIR"
waited=0
while true; do
  for i in $(seq 1 "$SLOTS"); do
    exec 9>"$DIR/slot$i"
    if flock -n 9; then
      [ "$waited" -gt 0 ] && echo "pwslot: got slot $i after ${waited}s" >&2
      "$@"
      rc=$?
      flock -u 9
      exit $rc
    fi
    exec 9>&-
  done
  sleep 3
  waited=$((waited + 3))
done
