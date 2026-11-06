"""E2E: the dev harness with the probe View Match (PR-2), through the probe suite of
harness_cubematch.py (run_probe: viewports, themes, keyboard and pointer, show me at normal speed
and with reduced motion, the countdown bar and its pause, the worked example, the sandboxed
srcdoc, console errors). The four pictures are stage3d snapshots: each must be non-blank.
Run:  tests/e2e/pwslot.sh python3 tests/e2e/harness_viewmatch.py
Screenshots: tests/e2e/out/viewmatch/ """
import sys

from harness_cubematch import run_probe

VIEWMATCH = {
    'ex': 'viewmatch', 'stage': '.ex-viewmatch-stage', 'options': 'canvas',
    'runs': [('easy', 'angle:0,objects:0,foils:0', 4), ('hard', 'angle:3,objects:2,foils:2', 3)],
    'normal': ('angle:1,objects:1,foils:1', 2),
}

if __name__ == '__main__':
    sys.exit(run_probe(VIEWMATCH))
