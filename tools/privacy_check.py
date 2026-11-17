#!/usr/bin/env python3
"""Privacy check: inspects exactly what a push would publish, commit data included.

The owner publishes under a handle, and nothing Parallax publishes may lead back to who they
are or where they live. Run this before every push. The pre-push hook in tools/githooks/ runs
it automatically once `git config core.hooksPath tools/githooks` is set in the clone.

Usage
  python3 tools/privacy_check.py                     what `git push origin <current branch>` would publish
  python3 tools/privacy_check.py --push REMOTE BRANCH
  python3 tools/privacy_check.py --hook REMOTE [URL] the pre-push hook form (ref lines on stdin)
  python3 tools/privacy_check.py --tree REF          every file at REF (a full pass; no commit data)
  python3 tools/privacy_check.py --zip FILE          every member of a zip (build zips with `git archive`)
  python3 tools/privacy_check.py --self-test         known-bad samples must fail, clean ones pass

It fails (exit 1) on any of these:
  - an author or committer email that is not a noreply address;
  - a commit time that is not in UTC (offset +0000);
  - a link to a chat, a session or a private page (claude.ai pages, shared chats, Discord message
    links, the harness's session-link line in a commit message);
  - an email address outside the allowlist;
  - the timezone name in the TZ variable (also its city part);
  - a home-folder path (a user folder under /home or /Users, the root user's home, a Windows user folder);
  - camera or location metadata in an image (EXIF make, model or GPS; XMP GPS);
  - a file identical (SHA-256) to one the owner sent;
  - a file named like a private one (BRIEF.md, RULES.md, .privacy.local);
  - any private string listed in .privacy.local or in PRIVACY_STRINGS.

No private value lives in this file. They come from the environment or from the git-ignored file
.privacy.local at the repository root, one per line:
  string: TEXT          a private string (a name, an email, a domain, a place); case-insensitive
  sent_dir: PATH        a folder whose files the owner sent (hashed; default: /mnt/user-data/attachments
                        and /mnt/user-data/uploads when they exist)
  sha256: HEX           the hash of a file the owner sent
  allow_email: ADDRESS  a public address that may appear (for example in a vendored licence)
Environment: TZ, PRIVACY_STRINGS (separated by '|'), PRIVACY_SENT_DIRS (separated by ':').
"""
import hashlib
import io
import os
import pathlib
import re
import subprocess
import sys
import zipfile
import zlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
ZERO = '0' * 40

NOREPLY = re.compile(r'^(?:noreply@anthropic\.com|noreply@github\.com|(?:\d+\+)?[A-Za-z0-9-]+@users\.noreply\.github\.com)$', re.I)
EMAIL = re.compile(r'(?<![\w.%+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}\b')
LINKS = re.compile(
    r'(?:\b[\w-]+\.)?claude\.ai/[^\s)>\]"\'`]*'           # chats, sessions, artifacts, projects
    r'|\bClaude-Session\s*:'                              # the harness's session-link line
    r'|\b(?:chatgpt\.com|chat\.openai\.com)/(?:share|c|g)/[^\s)>\]"\']*'
    r'|\bgemini\.google\.com/(?:share|app)/[^\s)>\]"\']*'
    r'|\bdiscord(?:app)?\.com/channels/\d+[^\s)>\]"\']*'  # links to Discord messages (invites are fine)
    , re.I)
HOME = re.compile(r'(?<![\w.~-])(?:/home/[A-Za-z0-9._-]+/|/root(?=/)|/Users/[A-Za-z0-9._ -]+/|[A-Za-z]:\\{1,2}Users\\{1,2}[^\\\s"\']+)')
PRIVATE_NAMES = {'BRIEF.md', 'RULES.md', '.privacy.local'}
IMAGE_EXT = re.compile(r'\.(png|jpe?g|webp|gif|tiff?|heic|avif)$', re.I)


def git(*args, binary=False, check=True):
    r = subprocess.run(['git', *args], cwd=ROOT, capture_output=True)
    if check and r.returncode != 0:
        raise SystemExit(f'git {" ".join(args)} failed: {r.stderr.decode(errors="replace").strip()}')
    return r.stdout if binary else r.stdout.decode('utf-8', 'replace')


# ---------- private values (never stored in this file) ----------

def load_config():
    cfg = {'strings': [], 'sent_dirs': [], 'sha256': set(), 'allow_email': set()}
    f = ROOT / '.privacy.local'
    if f.exists():
        for line in f.read_text(encoding='utf-8').splitlines():
            if not line.strip() or line.lstrip().startswith('#') or ':' not in line:
                continue
            key, val = line.split(':', 1)
            key, val = key.strip().lower(), val.strip()
            if not val:
                continue
            if key == 'string':
                cfg['strings'].append(val)
            elif key == 'sent_dir':
                cfg['sent_dirs'].append(val)
            elif key == 'sha256':
                cfg['sha256'].add(val.lower())
            elif key == 'allow_email':
                cfg['allow_email'].add(val.lower())
    cfg['strings'] += [s for s in os.environ.get('PRIVACY_STRINGS', '').split('|') if s.strip()]
    cfg['sent_dirs'] += [s for s in os.environ.get('PRIVACY_SENT_DIRS', '').split(':') if s.strip()]
    for d in ('/mnt/user-data/attachments', '/mnt/user-data/uploads'):
        if os.path.isdir(d):
            cfg['sent_dirs'].append(d)
    for d in cfg['sent_dirs']:
        for dirpath, _, files in os.walk(d):
            for name in files:
                try:
                    cfg['sha256'].add(hashlib.sha256(pathlib.Path(dirpath, name).read_bytes()).hexdigest())
                except OSError:
                    pass
    tz = os.environ.get('TZ', '').lstrip(':').strip()
    cfg['tz'] = []
    if tz and tz.upper() not in ('UTC', 'GMT', 'ZULU', 'ETC/UTC', 'ETC/GMT', 'UCT', 'UNIVERSAL'):
        cfg['tz'].append(tz)
        city = tz.split('/')[-1].replace('_', ' ')
        if len(city) >= 4 and city != tz:
            cfg['tz'].append(city)
    return cfg


# ---------- content checks ----------

class Report:
    def __init__(self):
        self.items = []

    def add(self, where, rule, detail):
        self.items.append((where, rule, detail))


def excerpt(text, m):
    a, b = max(0, m.start() - 30), min(len(text), m.end() + 30)
    return text[a:b].replace('\n', ' ')


def check_text(text, where, cfg, rep):
    for m in LINKS.finditer(text):
        rep.add(where, 'link to a chat, session or private page', excerpt(text, m))
    for m in EMAIL.finditer(text):
        addr = m.group(0).lower()
        if NOREPLY.match(addr) or addr in cfg['allow_email']:
            continue
        rep.add(where, 'email address outside the allowlist', m.group(0))
    for m in HOME.finditer(text):
        rep.add(where, 'home-folder path', excerpt(text, m))
    low = text.lower()
    for s in cfg['tz']:
        i = low.find(s.lower())
        if i >= 0:
            rep.add(where, 'timezone name from TZ', text[max(0, i - 30):i + len(s) + 30].replace('\n', ' '))
    for s in cfg['strings']:
        if s.lower() in low:
            rep.add(where, 'private string from .privacy.local or PRIVACY_STRINGS', '(value not shown)')


def image_meta(data, where, rep):
    try:
        from PIL import Image
    except ImportError:
        if b'Exif\x00\x00' in data or b'GPS' in data[:65536]:
            rep.add(where, 'image metadata (install Pillow to inspect it)', 'EXIF or GPS marker present')
        return
    try:
        im = Image.open(io.BytesIO(data))
    except Exception:
        return
    try:
        ex = im.getexif()
    except Exception:
        ex = {}
    bad = [name for tag, name in ((0x010F, 'camera make'), (0x0110, 'camera model'), (0x8825, 'GPS')) if tag in ex]
    if bad:
        rep.add(where, 'camera or location metadata in an image', ', '.join(bad))
    for key, val in (im.info or {}).items():
        sval = val.decode('latin-1', 'replace') if isinstance(val, bytes) else str(val)
        if re.search(r'GPS|Latitude|Longitude|\bLocation\b|\bMake\b|\bModel\b', f'{key} {sval}', re.I) and key not in ('dpi', 'icc_profile'):
            rep.add(where, 'camera or location metadata in an image', f'{key}')


def pdf_text(data):
    parts = [data]
    for m in re.finditer(rb'stream\r?\n(.*?)\r?\nendstream', data, re.S):
        try:
            parts.append(zlib.decompress(m.group(1)))
        except Exception:
            pass
    return b'\n'.join(parts).decode('latin-1', 'replace')


def check_blob(data, path, where, cfg, rep, seen=None):
    name = path.rsplit('/', 1)[-1]
    if name in PRIVATE_NAMES:
        rep.add(where, 'file named like a private one', name)
    digest = hashlib.sha256(data).hexdigest()
    if digest in cfg['sha256']:
        rep.add(where, 'file identical to one the owner sent', digest[:16])
    if IMAGE_EXT.search(path):
        image_meta(data, where, rep)
        return
    if path.lower().endswith('.pdf') or data[:5] == b'%PDF-':
        check_text(pdf_text(data), where, cfg, rep)
        return
    if path.lower().endswith('.zip') or data[:4] == b'PK\x03\x04':
        try:
            z = zipfile.ZipFile(io.BytesIO(data))
        except zipfile.BadZipFile:
            return
        for n in z.namelist():
            if not n.endswith('/'):
                check_blob(z.read(n), n, f'{where} > {n}', cfg, rep)
        return
    if b'\x00' in data[:8000]:
        return  # other binary files (fonts): hash and name checks only
    check_text(data.decode('utf-8', 'replace'), where, cfg, rep)


# ---------- what a push publishes ----------

def commits_to_push(local_sha, remote_sha, remote):
    if local_sha == ZERO:
        return []  # a branch deletion publishes nothing
    known = remote_sha and remote_sha != ZERO and subprocess.run(
        ['git', 'cat-file', '-e', remote_sha], cwd=ROOT, capture_output=True).returncode == 0
    if known:
        return git('rev-list', '--reverse', local_sha, f'^{remote_sha}').split()
    return git('rev-list', '--reverse', local_sha, '--not', f'--remotes={remote}').split()


def check_commits(commits, cfg, rep):
    seen = set()
    for c in commits:
        short = c[:7]
        meta = git('show', '-s', '--format=%an%x00%ae%x00%cn%x00%ce%x00%ai%x00%ci%x00%B', c).split('\x00')
        an, ae, cn, ce, ad, cd, body = (meta + [''] * 7)[:7]
        for role, email in (('author', ae), ('committer', ce)):
            if not NOREPLY.match(email.strip()):
                rep.add(f'commit {short}', f'{role} email is not a noreply address', email)
        for role, date in (('author', ad), ('committer', cd)):
            if not date.strip().endswith('+0000'):
                rep.add(f'commit {short}', f'{role} time is not in UTC', date.strip())
        check_text(f'{an}\n{cn}\n{body}', f'commit {short} message', cfg, rep)
        for line in git('diff-tree', '-r', '--root', '--no-commit-id', '-M', '--diff-filter=ACMRT', '--raw', c).splitlines():
            if not line.startswith(':') or '\t' not in line:
                continue
            fields, paths = line.split('\t', 1)
            sha = fields.split()[3]
            path = paths.split('\t')[-1]
            if sha in seen:
                continue
            seen.add(sha)
            check_blob(git('cat-file', 'blob', sha, binary=True), path, f'commit {short}: {path}', cfg, rep)


def check_tree(ref, cfg, rep):
    for line in git('ls-tree', '-r', ref).splitlines():
        meta, path = line.split('\t', 1)
        kind, sha = meta.split()[1:3]
        if kind == 'blob':
            check_blob(git('cat-file', 'blob', sha, binary=True), path, f'{ref}:{path}', cfg, rep)


def self_test():
    """Known-bad samples must fail and clean ones pass. The samples are assembled at run time so
    that this file never contains them whole (it is checked like any other file)."""
    cfg = {'strings': ['priv' + 'atevalue'], 'sha256': set(), 'allow_email': set(), 'tz': ['Mars/' + 'Olympus', 'Olym' + 'pus']}
    bad = ['https://claude' + '.ai/chat/abc', 'Claude' + '-Session: x', 'mail someone' + '@' + 'example.org',
           '/ho' + 'me/alice/notes', '/ro' + 'ot/.config', 'C:' + '\\Users\\Bob\\x', '/Us' + 'ers/Carol/x',
           'zone Mars/' + 'Olympus', 'a privatevalue'.replace('privatevalue', 'priv' + 'atevalue'),
           'https://discord' + '.com/channels/1/2/3']
    good = ['https://discord.gg/chmr', 'Co-Authored-By: Claude <noreply' + '@anthropic.com>',
            'https://docs.claude.com/en/docs', 'home/away', 'tests/e2e/out/x.png', '12345+someone' + '@users.noreply.github.com']
    ok = True
    for s in bad:
        rep = Report(); check_text(s, 'sample', cfg, rep)
        if not rep.items:
            ok = False; print('self-test: not caught:', s)
    for s in good:
        rep = Report(); check_text(s, 'sample', cfg, rep)
        if rep.items:
            ok = False; print('self-test: false alarm:', s, rep.items)
    print('privacy check self-test:', 'ok' if ok else 'FAILED')
    return 0 if ok else 1


def main(argv):
    if argv[:1] == ['--self-test']:
        return self_test()
    cfg = load_config()
    rep = Report()
    if argv[:1] == ['--tree'] and len(argv) == 2:
        check_tree(argv[1], cfg, rep)
        scope = f'every file at {argv[1]}'
    elif argv[:1] == ['--zip'] and len(argv) == 2:
        check_blob(pathlib.Path(argv[1]).read_bytes(), argv[1], argv[1], cfg, rep)
        scope = f'every member of {argv[1]}'
    elif argv[:1] == ['--hook']:
        remote = argv[1] if len(argv) > 1 else 'origin'
        commits = []
        for line in sys.stdin.read().splitlines():
            parts = line.split()
            if len(parts) == 4:
                commits += [c for c in commits_to_push(parts[1], parts[3], remote) if c not in commits]
        check_commits(commits, cfg, rep)
        scope = f'{len(commits)} commit(s) to push to {remote}'
    else:
        if argv[:1] == ['--push'] and len(argv) == 3:
            remote, branch = argv[1], argv[2]
        elif not argv:
            remote, branch = 'origin', git('rev-parse', '--abbrev-ref', 'HEAD').strip()
        else:
            print(__doc__)
            return 2
        local = git('rev-parse', f'refs/heads/{branch}').strip()
        r = subprocess.run(['git', 'rev-parse', '--verify', '-q', f'refs/remotes/{remote}/{branch}'], cwd=ROOT, capture_output=True, text=True)
        commits = commits_to_push(local, r.stdout.strip() or ZERO, remote)
        check_commits(commits, cfg, rep)
        scope = f'{len(commits)} commit(s) to push to {remote}/{branch}'
    for where, rule, detail in rep.items:
        print(f'FAIL {where}: {rule}: {detail}')
    print(f'privacy check: {scope}: {"FAILED, " + str(len(rep.items)) + " finding(s)" if rep.items else "clean"}')
    return 1 if rep.items else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
