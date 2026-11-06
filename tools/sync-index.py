#!/usr/bin/env python3
r"""Activate files in index.html once they exist.

index.html keeps not-yet-written scripts and stylesheets inside commented PENDING blocks, in their
load order. This moves every line whose file now exists out of its block (just above it, so the
order stays right) and drops blocks that become empty. Run it after adding a file:

    python3 tools/sync-index.py          # rewrite index.html
    python3 tools/sync-index.py --check  # exit 1 if a pending file exists or an active one is missing
    python3 tools/sync-index.py --only 'gen\.js|rotate|stage3d|css/ex\.css'   # activate matching files only
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, 'index.html')
REF = re.compile(r'<(?:script src|link rel="stylesheet" href)="([^"]+)"')


def ref(line):
    m = REF.search(line)
    return m.group(1) if m else None


def exists(rel):
    return os.path.isfile(os.path.join(ROOT, rel))


def main(check_only, only=None):
    with open(INDEX, encoding='utf-8') as f:
        lines = f.read().split('\n')
    out, block, problems = [], None, []
    for line in lines:
        if block is None:
            if line.lstrip().startswith('<!-- PENDING'):
                block = {'head': line, 'pending': [], 'active': []}
                continue
            r = ref(line)
            if r and not exists(r):
                problems.append('active but missing: ' + r)
            out.append(line)
            continue
        if line.strip() == '-->':
            out.extend(block['active'])
            if block['pending']:
                out.append(block['head'])
                out.extend(block['pending'])
                out.append(line)
            block = None
            continue
        r = ref(line)
        if r and exists(r) and (only is None or re.search(only, r)):
            block['active'].append(line)
            problems.append('pending but present: ' + r)
        else:
            block['pending'].append(line)
    if check_only:
        for p in problems:
            print(p)
        return 1 if problems else 0
    with open(INDEX, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out))
    moved = [p for p in problems if p.startswith('pending')]
    missing = [p for p in problems if p.startswith('active')]
    print('activated %d file(s)' % len(moved))
    for p in missing:
        print('WARNING ' + p)
    return 1 if missing else 0


if __name__ == '__main__':
    only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None
    sys.exit(main('--check' in sys.argv, only))
