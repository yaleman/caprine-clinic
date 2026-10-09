import hashlib
import os
from pathlib import Path
import tempfile
import unittest
from scripts.archive import pack, validate

class PackageTests(unittest.TestCase):
    def test_archive_is_stable_across_file_metadata_and_excludes_unsafe_entries(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            stage = root/'caprine_clinic'
            stage.mkdir()
            file = stage/'file.txt'
            file.write_text('portable asset')
            pack(stage, root/'a.tar.gz')
            os.utime(file, (1700000000, 1700000000))
            file.chmod(0o600)
            pack(stage, root/'b.tar.gz')
            self.assertEqual((root/'a.tar.gz').read_bytes(), (root/'b.tar.gz').read_bytes())
            (stage/'.env').write_text('not shipped')
            with self.assertRaises(ValueError): pack(stage, root/'unsafe.tar.gz')

    def test_installed_asset_references_and_version_are_checked(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            stage = root/'caprine_clinic'
            files = {
                'default/app.conf': '[id]\nname=caprine_clinic\nversion=0.1.0\n[package]\nid=caprine_clinic\n[launcher]\nversion=0.1.0\n',
                'metadata/default.meta': '', 'default/data/ui/nav/default.xml': '<nav/>',
                'default/data/ui/views/clinic.xml': '<view/>',
            }
            refs = []
            for extension in ['js', 'css']:
                value = 'asset '+extension
                digest = hashlib.sha256(value.encode()).hexdigest()[:12]
                name = 'clinic-'+digest+'.'+extension
                files['appserver/static/'+name] = value
                refs.append(name)
            files['appserver/templates/clinic.html'] = ' '.join(refs)
            for name, value in files.items():
                path = stage/name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(value)
            archive = root/'app.tar.gz'
            pack(stage, archive)
            validate(archive, 'caprine_clinic', '0.1.0')
            with self.assertRaises(ValueError): validate(archive, 'caprine_clinic', '0.2.0')
            (stage/'appserver/static'/refs[0]).write_text('corrupted asset')
            pack(stage, archive)
            with self.assertRaises(ValueError): validate(archive, 'caprine_clinic', '0.1.0')
            (stage/'linked').symlink_to(root/'outside')
            with self.assertRaises(ValueError): pack(stage, archive)
