"""Check publisher orchestration without contacting GitHub."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


class ReleaseTests(unittest.TestCase):
    def run_publisher(self, current=True, existing=False):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            mock = root / 'gh'
            mock.write_text(f'#!{sys.executable}\n' + '''import json, os, sys
args = sys.argv[1:]
with open(os.environ['GH_LOG'], 'a') as log:
    log.write(json.dumps(args) + '\\n')
if args[:1] == ['api'] and '/commits/main' in args[1]:
    print(os.environ['MAIN_SHA'])
elif args[:1] == ['api'] and '/git/ref/tags/' in args[1]:
    sys.exit(0 if os.environ['EXISTING'] == '1' else 1)
elif args[:2] == ['release', 'view']:
    sys.exit(0 if os.environ['EXISTING'] == '1' else 1)
''')
            mock.chmod(0o755)
            archive = root / 'caprine_clinic-0.1.0.tar.gz'
            archive.touch()
            Path(str(archive) + '.sha256').touch()
            log = root / 'commands.jsonl'
            env = dict(os.environ, PATH=str(root) + os.pathsep + os.environ['PATH'],
                       GH_REPO='yaleman/caprine-clinic', GITHUB_SHA='abc123',
                       RELEASE_TAG='v0.1.0', RELEASE_ARCHIVE=str(archive),
                       TMPDIR=str(root), GH_LOG=str(log), MAIN_SHA='abc123' if current else 'newer',
                       EXISTING='1' if existing else '0')
            subprocess.run(['bash', 'scripts/publish_release.sh'], env=env,
                           check=True, capture_output=True)
            return [json.loads(line) for line in log.read_text().splitlines()]

    def test_superseded_build_does_not_mutate(self):
        self.assertEqual(len(self.run_publisher(current=False)), 1)

    def test_new_version_creates_tag_and_release_with_both_assets(self):
        calls = self.run_publisher()
        self.assertTrue(any(call[:3] == ['api', '--method', 'POST'] for call in calls))
        self.assertTrue(any(call[:2] == ['release', 'create'] for call in calls))
        upload = calls[-1]
        self.assertEqual(upload[:3], ['release', 'upload', 'v0.1.0'])
        self.assertTrue(upload[4].endswith('.sha256'))
        self.assertEqual(upload[-1], '--clobber')

    def test_existing_version_moves_tag_and_refreshes_release(self):
        calls = self.run_publisher(existing=True)
        patch = next(call for call in calls if call[:3] == ['api', '--method', 'PATCH'])
        self.assertIn('force=true', patch)
        self.assertTrue(any(call[:2] == ['release', 'edit'] for call in calls))
