"""E2E: the dev harness with the probe Level (PR-5), through the probe suite of
harness_cubematch.py (run_probe: viewports, themes, keyboard and pointer, show me at normal speed
and with reduced motion, the countdown bar and its pause, the worked example, the sandboxed
srcdoc, console errors). Both tasks: water lines and plumb lines.
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_level.py
Screenshots: tests/e2e/out/level/ """
import sys

from harness_cubematch import run_probe

LEVEL = {
    'ex': 'level', 'stage': '.ex-level-stage', 'options': 'svg',
    'runs': [('water', 'tilt:2,task:0,gap:1', 5), ('plumb', 'tilt:3,task:1,gap:2', 5)],
    'normal': ('tilt:1,task:0,gap:2', 2),
}

if __name__ == '__main__':
    sys.exit(run_probe(LEVEL))
