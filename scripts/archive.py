#!/usr/bin/env python3
"""Portable, deterministic Splunk archives with strict package inventory checks."""

import enum
import gzip
import hashlib
import io
import sys
import tarfile
from pathlib import Path, PurePosixPath


class Action(enum.Enum):
    PACK = "pack"
    VALIDATE = "validate"


FORBIDDEN = {
    ".git",
    ".env",
    ".local",
    ".live",
    "node_modules",
    "__pycache__",
    ".DS_Store",
    "tests",
    "fixtures",
    "local",
}


def pack(stage, destination):
    stage = Path(stage)
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with (
        destination.open("wb") as output,
        gzip.GzipFile(filename="", mode="wb", fileobj=output, mtime=0) as compressed,
        tarfile.open(
            fileobj=compressed, mode="w", format=tarfile.USTAR_FORMAT
        ) as archive,
    ):
        for path in [stage, *sorted(stage.rglob("*"))]:
            if path.is_symlink() or any(
                p in FORBIDDEN or p.startswith("._")
                for p in path.relative_to(stage.parent).parts
            ):
                raise ValueError("Forbidden package entry: " + str(path))
            data = path.read_bytes() if path.is_file() else b""
            info = tarfile.TarInfo(path.relative_to(stage.parent).as_posix())
            info.type = tarfile.DIRTYPE if path.is_dir() else tarfile.REGTYPE
            info.mode = 0o755 if path.is_dir() else 0o644
            info.uid = info.gid = info.mtime = 0
            info.uname = info.gname = ""
            info.size = len(data)
            archive.addfile(info, io.BytesIO(data) if path.is_file() else None)
    digest = hashlib.sha256(destination.read_bytes()).hexdigest()
    destination.with_name(destination.name + ".sha256").write_text(
        digest + "  " + destination.name + "\n"
    )


def validate(path, app_id, version):
    with tarfile.open(path, "r:gz") as archive:
        names = set()
        for entry in archive.getmembers():
            parts = PurePosixPath(entry.name).parts
            if (
                not parts
                or parts[0] != app_id
                or entry.name.startswith("/")
                or ".." in parts
            ):
                raise ValueError("Invalid archive root/path")
            if any(p in FORBIDDEN or p.startswith("._") for p in parts) or not (
                entry.isfile() or entry.isdir()
            ):
                raise ValueError("Forbidden archive entry")
            if len(parts) > 1 and parts[1] not in {"default", "metadata", "appserver"}:
                raise ValueError("Unexpected packaged directory")
            if entry.name in names:
                raise ValueError("Duplicate archive entry")
            names.add(entry.name)
        required = [
            "default/app.conf",
            "metadata/default.meta",
            "default/data/ui/nav/default.xml",
            "default/data/ui/views/clinic.xml",
            "appserver/templates/clinic.html",
        ]
        if any(app_id + "/" + name not in names for name in required):
            raise ValueError("Missing required app file")
        import configparser

        config = configparser.ConfigParser()
        config.read_string(
            archive.extractfile(app_id + "/default/app.conf").read().decode()
        )
        if (
            config["id"]["name"] != app_id
            or config["package"]["id"] != app_id
            or any(config[s]["version"] != version for s in ["id", "launcher"])
        ):
            raise ValueError("Packaged version mismatch")
        import re

        template = (
            archive.extractfile(app_id + "/appserver/templates/clinic.html")
            .read()
            .decode()
        )
        assets = re.findall(r"clinic-([a-f0-9]{12})\.(js|css)", template)
        if {extension for _, extension in assets} != {"js", "css"}:
            raise ValueError("Missing asset references")
        for digest, extension in assets:
            name = app_id + "/appserver/static/clinic-" + digest + "." + extension
            if (
                name not in names
                or hashlib.sha256(archive.extractfile(name).read()).hexdigest()[:12]
                != digest
            ):
                raise ValueError("Asset fingerprint mismatch")
    print("Validated " + str(path))


if __name__ == "__main__":
    action = Action(sys.argv[1])
    if action is Action.PACK:
        pack(sys.argv[2], sys.argv[3])
    elif action is Action.VALIDATE:
        validate(*sys.argv[2:5])
