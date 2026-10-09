#!/usr/bin/env python3
"""Scoped local test harness; credentials never appear in output or command arguments."""

import base64
import datetime as dt
import enum
import http.client
import json
import os
import secrets
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOCAL = ROOT / ".local"
CONTAINER = "caprine-clinic-test-splunk-1"
BASE = "https://127.0.0.1:28089"


class Action(enum.Enum):
    INIT = "init"
    UP = "up"
    STATUS = "status"
    SMOKE = "smoke"
    CERT = "cert"
    DEPLOY = "deploy"


def credentials():
    return json.loads((LOCAL / "test-account.json").read_text())


def init():
    LOCAL.mkdir(mode=0o700, exist_ok=True)
    path = LOCAL / "test-account.json"
    if not path.exists():
        data = {
            "username": "clinic",
            "password": secrets.token_urlsafe(24),
            "admin_password": secrets.token_urlsafe(24),
        }
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as f:
            json.dump(data, f)
    env = ROOT / ".env"
    if not env.exists():
        fd = os.open(env, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as f:
            f.write("SPLUNK_PASSWORD=" + credentials()["admin_password"] + "\n")
    fixtures = ROOT / "tests/fixtures"
    fixtures.mkdir(parents=True, exist_ok=True)
    if not (fixtures / "events.jsonl").exists():
        now = dt.datetime.now(dt.UTC).replace(microsecond=0)
        rows = []
        for i in range(12):
            timestamp = (now - dt.timedelta(minutes=5, seconds=12 - i)).strftime(
                "%Y-%m-%dT%H:%M:%SZ"
            )
            rows.append(
                {
                    "timestamp": timestamp,
                    "herd": "north" if i < 7 else "south",
                    "goat": "Ada" if i % 2 else "Grace",
                    "value": i % 4,
                    "tags": ["clinic", "synthetic"],
                    "empty": "",
                }
            )
        (fixtures / "events.jsonl").write_text(
            "".join(json.dumps(row) + "\n" for row in rows)
        )
        (fixtures / "manifest.json").write_text(
            json.dumps(
                {
                    "count": 12,
                    "herds": {"north": 7, "south": 5},
                    "earliest": (now - dt.timedelta(minutes=10)).isoformat(),
                    "latest": (now + dt.timedelta(minutes=1)).isoformat(),
                },
                indent=2,
            )
            + "\n"
        )
    from fixtures import create_layout

    create_layout(fixtures, dt.datetime.now(dt.UTC).replace(microsecond=0))
    print(
        "Local credentials generated/stored privately; fixture corpus ready. No secret values displayed."
    )


def certificate():
    LOCAL.mkdir(mode=0o700, exist_ok=True)
    # Only the public certificate is exported; no private key or environment inspection.
    cert = subprocess.check_output(
        [
            "docker",
            "exec",
            "--user",
            "splunk",
            CONTAINER,
            "/opt/splunk/bin/splunk",
            "cmd",
            "openssl",
            "x509",
            "-in",
            "/opt/splunk/etc/auth/server.pem",
            "-outform",
            "PEM",
        ]
    )
    (LOCAL / "server-cert.pem").write_bytes(cert)
    ca = subprocess.check_output(
        [
            "docker",
            "exec",
            "--user",
            "splunk",
            CONTAINER,
            "/opt/splunk/bin/splunk",
            "cmd",
            "openssl",
            "x509",
            "-in",
            "/opt/splunk/etc/auth/cacert.pem",
            "-outform",
            "PEM",
        ]
    )
    (LOCAL / "ca-cert.pem").write_bytes(ca)


def context():
    ctx = ssl.create_default_context(cafile=str(LOCAL / "ca-cert.pem"))
    # The default Splunk certificate lacks a loopback SAN. Trust is pinned to the public
    # certificate exported from this exact owned container; chain verification stays enabled.
    ctx.check_hostname = False
    return ctx


class PinnedConnection(http.client.HTTPSConnection):
    def connect(self):
        super().connect()
        expected = ssl.PEM_cert_to_DER_cert((LOCAL / "server-cert.pem").read_text())
        if self.sock.getpeercert(binary_form=True) != expected:
            self.close()
            raise ssl.SSLError("Local Splunk certificate pin mismatch")


class PinnedHandler(urllib.request.HTTPSHandler):
    def https_open(self, req):
        return self.do_open(
            PinnedConnection, req, context=self._context, check_hostname=False
        )


def api(path, params=None, method="GET", admin=False):
    cfg = credentials()
    password = cfg["admin_password"] if admin else cfg["password"]
    username = "admin" if admin else cfg["username"]
    query = urllib.parse.urlencode(
        {"output_mode": "json", **(params or {})}, doseq=True
    )
    handler = urllib.request.HTTPBasicAuthHandler()
    handler.add_password(realm=None, uri=BASE, user=username, passwd=password)
    opener = urllib.request.build_opener(PinnedHandler(context=context()), handler)
    url = BASE + path
    data = query.encode() if method == "POST" else None
    if method == "GET":
        url += "?" + query
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header(
        "Authorization",
        "Basic " + base64.b64encode((username + ":" + password).encode()).decode(),
    )
    try:
        with opener.open(req, timeout=20) as res:
            return json.load(res)
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        # Responses should not contain credentials; redact known values anyway.
        for value in [cfg["password"], cfg["admin_password"]]:
            detail = detail.replace(value, "[redacted]")
        raise RuntimeError(f"HTTP {e.code}: {detail[:1500]}") from None


def status():
    if not (LOCAL / "ca-cert.pem").exists():
        certificate()
    data = api("/services/server/info", admin=True)["entry"][0]["content"]
    print(
        json.dumps(
            {k: data.get(k) for k in ["version", "build", "os_name", "cpu_arch"]}
        )
    )
    if data.get("version") != "10.4.4":
        raise RuntimeError("Unexpected Splunk version; refusing further setup")


def smoke():
    status()
    users = api("/services/authentication/users", admin=True)
    if not any(e["name"] == "clinic" for e in users["entry"]):
        api(
            "/services/authentication/users",
            {
                "name": "clinic",
                "password": credentials()["password"],
                "roles": "clinic_tester",
                "force-change-pass": "0",
            },
            method="POST",
            admin=True,
        )
        print(
            "Created isolated clinic test user inheriting the standard Splunk user role."
        )
    manifest = json.loads((ROOT / "tests/fixtures/manifest.json").read_text())
    sid = api(
        "/servicesNS/clinic/caprine_clinic/search/jobs",
        {
            "search": "search index=caprine_clinic_test | stats count by herd | sort herd",
            "earliest_time": manifest["earliest"],
            "latest_time": manifest["latest"],
            "exec_mode": "normal",
        },
        "POST",
    )["sid"]
    try:
        job = {}
        for _ in range(25):
            job = api("/services/search/jobs/" + sid)["entry"][0]["content"]
            if job.get("isDone") in [True, "1", 1]:
                break
            time.sleep(1)
        rows = api("/services/search/v2/jobs/" + sid + "/results", {"count": "100"})[
            "results"
        ]
        counts = {row["herd"]: int(row["count"]) for row in rows}
        if counts != manifest["herds"]:
            raise RuntimeError("Fixture mismatch: " + json.dumps(counts))
        available = [
            key
            for key in [
                "runDuration",
                "scanCount",
                "eventCount",
                "resultCount",
                "diskUsage",
                "performance",
            ]
            if key in job
        ]
        report = {
            "version": "10.4.4",
            "fixture_rows": manifest["count"],
            "aggregate_counts": counts,
            "verified": [
                "standard-user search",
                "async job",
                "v2 final results",
                "fixture counts",
            ],
            "returned_metrics": available,
        }
        (ROOT / "research/runtime-smoke.json").write_text(
            json.dumps(report, indent=2) + "\n"
        )
        print(json.dumps(report))
    finally:
        api("/services/search/jobs/" + sid + "/control", {"action": "cancel"}, "POST")
        print("Smoke job cancellation acknowledged.")


def main():
    os.chdir(ROOT)
    action = Action(sys.argv[1])
    if action is Action.INIT:
        init()
    elif action is Action.UP:
        subprocess.run(["docker", "compose", "up", "-d"], check=True)
    elif action is Action.DEPLOY:
        subprocess.run(
            [
                "docker",
                "cp",
                str(ROOT / "output/caprine_clinic") + "/.",
                CONTAINER + ":/opt/splunk/etc/apps/caprine_clinic/",
            ],
            check=True,
        )
        subprocess.run(
            [
                "docker",
                "exec",
                "--user",
                "root",
                CONTAINER,
                "chown",
                "-R",
                "splunk:splunk",
                "/opt/splunk/etc/apps/caprine_clinic",
            ],
            check=True,
        )
        api("/services/server/control/restart_webui", method="POST", admin=True)
        print("Local Clinic assets deployed and Web restart requested.")
    elif action is Action.CERT:
        certificate()
        print("Pinned public server certificate saved.")
    elif action is Action.STATUS:
        status()
    elif action is Action.SMOKE:
        smoke()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        print(str(e), file=sys.stderr)
        raise SystemExit(1)
