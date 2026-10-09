import datetime as dt
import json
from pathlib import Path
import tempfile
import unittest
from scripts.fixtures import create_layout

class FixtureTests(unittest.TestCase):
    def test_layout_corpus_is_synthetic_and_existing_data_is_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            now = dt.datetime(2026, 10, 9, tzinfo=dt.timezone.utc)
            create_layout(directory, now)
            path = Path(directory)/'layout.jsonl'
            content = path.read_bytes()
            records = [json.loads(line) for line in content.splitlines()]
            self.assertEqual(len(records), 205)
            self.assertEqual({r['fixture_id'] for r in records}, set(range(205)))
            self.assertTrue(all(len(r['message']) > 3000 and 'synthetic' in r['tags'] for r in records))
            create_layout(directory, now+dt.timedelta(days=1))
            self.assertEqual(path.read_bytes(), content)
