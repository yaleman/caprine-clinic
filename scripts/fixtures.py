"""Generate a separate synthetic corpus for Events layout/pagination checks."""

import datetime as dt
import json
from pathlib import Path


def create_layout(directory, now):
    path = Path(directory) / "layout.jsonl"
    if path.exists():
        return
    with path.open("w") as file:
        for i in range(205):
            record = {
                "timestamp": (now - dt.timedelta(seconds=205 - i)).strftime(
                    "%Y-%m-%dT%H:%M:%SZ"
                ),
                "fixture_id": i,
                "message": "Synthetic layout event "
                + str(i)
                + " "
                + "raw-payload-" * 260,
                "category": "layout",
                "status": "ok",
                "path": "/synthetic/clinic/" + str(i),
                "tags": ["synthetic", "layout"],
                "nested": {"sample": i, "enabled": True},
            }
            file.write(json.dumps(record) + "\n")
