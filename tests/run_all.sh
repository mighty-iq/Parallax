#!/usr/bin/env bash
# The whole Parallax test suite (PLAN.md §12).
#   tests/run_all.sh
# 1. node tests/node/run.mjs (alone: it is CPU-bound);
# 2. every tests/e2e/*.py test (the helper modules common.py and shell_common.py are left out),
#    each through tests/e2e/pwslot.sh, at most two at a time (pwslot also caps the machine at two
#    headless Chromiums, so other agents' tests queue with ours);
# 3. tests/e2e/out/run_all.json: per file { passed, failed, seconds, exit, failures[≤10] } and totals;
#    full logs in tests/e2e/out/run_all/<file>.log.
# Exit code: 0 when every file passed, 1 otherwise.
# Environment knobs:
#   RUN_ALL_ONLY=regex   run only the e2e files whose name matches (the node suite still runs)
#   RUN_ALL_SKIP=regex   leave out the e2e files whose name matches (e.g. 'longrun')
#   RUN_ALL_NODE=0       leave out the node suite
#   RUN_ALL_JOBS=1|2     parallel e2e files (default 2, never more)
set -u
cd "$(dirname "$0")/.." || exit 2
ROOT=$(pwd)
OUT="$ROOT/tests/e2e/out"
LOGS="$OUT/run_all"
mkdir -p "$LOGS"
rm -f "$LOGS"/*.res "$LOGS"/*.log
JOBS=${RUN_ALL_JOBS:-2}
case "$JOBS" in 1|2) ;; *) JOBS=2 ;; esac
T0=$(date +%s.%N)

run_one() {  # run_one <name> <command…>: log to $LOGS/<name>.log, result line to $LOGS/<name>.res
  local name=$1; shift
  local t0 t1 rc
  t0=$(date +%s.%N)
  "$@" > "$LOGS/$name.log" 2>&1
  rc=$?
  t1=$(date +%s.%N)
  printf '%s %s %s\n' "$name" "$rc" "$(echo "$t1 - $t0" | bc)" > "$LOGS/$name.res"
  printf '%-24s exit %-3s %7.1f s\n' "$name" "$rc" "$(echo "$t1 - $t0" | bc)"
}

# 1. node
if [ "${RUN_ALL_NODE:-1}" != "0" ]; then
  echo "== node tests/node/run.mjs"
  run_one node node tests/node/run.mjs
fi

# 2. e2e files: the long ones first so the two slots finish close together
FILES=()
for f in tests/e2e/*.py; do
  b=$(basename "$f" .py)
  case "$b" in common|shell_common) continue ;; esac
  if [ -n "${RUN_ALL_ONLY:-}" ] && ! [[ "$b" =~ ${RUN_ALL_ONLY} ]]; then continue; fi
  if [ -n "${RUN_ALL_SKIP:-}" ] && [[ "$b" =~ ${RUN_ALL_SKIP} ]]; then continue; fi
  FILES+=("$b")
done
ORDERED=()
for first in longrun perf_track screens harness_track flows play; do
  for b in "${FILES[@]}"; do [ "$b" = "$first" ] && ORDERED+=("$b"); done
done
for b in "${FILES[@]}"; do
  case " ${ORDERED[*]} " in *" $b "*) ;; *) ORDERED+=("$b") ;; esac
done
echo "== ${#ORDERED[@]} browser test files, $JOBS at a time (through tests/e2e/pwslot.sh)"
running=0
for b in "${ORDERED[@]}"; do
  if [ "$running" -ge "$JOBS" ]; then
    wait -n
    running=$((running - 1))
  fi
  run_one "$b" tests/e2e/pwslot.sh python3 "tests/e2e/$b.py" &
  running=$((running + 1))
  sleep 1
done
wait

# 3. the report
T1=$(date +%s.%N)
python3 - "$LOGS" "$OUT/run_all.json" "$(echo "$T1 - $T0" | bc)" <<'PY'
import json, pathlib, re, sys
logs, dest, total = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), float(sys.argv[3])
files, bad = {}, []
for res in sorted(logs.glob('*.res')):
    name, rc, secs = res.read_text().split()
    rc, secs = int(rc), round(float(secs), 1)
    text = (logs / f'{name}.log').read_text(errors='replace')
    passed = failed = None
    if name == 'node':
        m = re.search(r'All (\d+) checks passed', text)
        if m:
            passed, failed = int(m.group(1)), 0
        m = re.search(r'FAILED: (\d+) of (\d+) checks', text)
        if m:
            failed, passed = int(m.group(1)), int(m.group(2)) - int(m.group(1))
        fails = [l.strip() for l in text.splitlines() if l.strip().startswith('✗')]
    else:
        m = re.findall(r'(\d+) passed, (\d+) failed', text)
        if m:
            passed, failed = int(m[-1][0]), int(m[-1][1])
        fails = [l.strip() for l in text.splitlines() if re.match(r'\s*FAIL\b', l)]
    if passed is None:
        passed, failed = 0, 0
    if rc != 0 and failed == 0:
        failed = 1  # crashed before its summary, or exited non-zero without a count
        tail = [l for l in text.splitlines() if l.strip()][-3:]
        fails = fails or [f'exit {rc}: ' + ' | '.join(tail)[:300]]
    files[name] = {'passed': passed, 'failed': failed, 'seconds': secs, 'exit': rc, 'failures': fails[:10]}
    if failed or rc:
        bad.append(name)
report = {
    'files': files,
    'totals': {'files': len(files), 'failedFiles': len(bad), 'passed': sum(f['passed'] for f in files.values()),
               'failed': sum(f['failed'] for f in files.values()), 'seconds': round(total, 1)},
    'failedFiles': bad,
}
dest.write_text(json.dumps(report, indent=1, ensure_ascii=False))
t = report['totals']
print(f"\n{t['files']} files: {t['passed']} checks passed, {t['failed']} failed in {len(bad)} file(s); {t['seconds']} s")
for n in bad:
    print(f'  FAILED {n}: ' + '; '.join(files[n]['failures'][:3])[:400])
print(f'report: {dest}')
sys.exit(1 if bad else 0)
PY
exit $?
