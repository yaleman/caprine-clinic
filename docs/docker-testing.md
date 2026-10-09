# Local Docker test harness: Splunk Enterprise 10.4

> Current execution policy (user decision): Splunk alone governs SPL authorization, index access, concurrency quotas, runtime, job retention and permitted time ranges. Caprine Clinic imposes no command allowlist, panel count, concurrency cap, time-window cap or runtime budget. All selected searches are submitted together. Historical relative picker bounds share one server anchor; All Time, open endpoints and real-time expressions retain Splunk semantics. Inline SPL bounds/macros can override picker bounds, so matching picker intervals alone do not establish equivalent effective searches. Earlier proposed app restrictions below are superseded.


The user selected local Docker testing, following TA-pushover, and Splunk 10.4 as the first target. This document specifies the future harness; no Compose file, container, credentials or license acceptance has been provisioned.

## Pushover conventions actually found

Read-only inspection of `/Users/yaleman/Projects/TA-pushover` found:

- `docker-compose.yml`: one standalone `splunk` service, image `splunk/splunk:9.3`, explicit `platform: linux/amd64`, `restart: always`, host ports 8000 -> 8000 and 18089 -> 8089. It bind-mounts `./TA-pushover.spl` into `/tmp/TA-pushover.spl` and sets `SPLUNK_APPS_URL` to that container path. It includes a license-acceptance startup argument and a credential-bearing setting; no value is reproduced or reused here.
- `justfile`: `build` invokes `./ucc-build.sh`; `run_splunk` invokes Compose detached startup and follows logs; `check` combines pytest, Ruff, mypy and spelling; optional `test_e2e` invokes `app_test.py --send`.
- `ucc-build.sh`: copies source to a temporary working directory, synchronizes app versions, runs UCC through `uv`, checks built `.conf` files with ksconf, produces `output/TA-pushover/`, and archives `TA-pushover.spl` using `COPYFILE_DISABLE=1` to omit macOS archive metadata. Cleanup is scoped to temporary build/output directories.
- `README.md`: separates fast local tests from an optional container smoke test. `.gitignore` excludes app archives, build/output directories and local environment files.
- `app_test.py`: an optional SDK/HTTP smoke script loads external configuration, supports app installation and runs a Pushover alert search/log inspection. This is an external-message test, not a suitable Clinic test workload. Its configuration file was not opened. The script includes relaxed TLS verification in an installation path; do not carry that into the new harness.

The inspected Compose file does not declare a healthcheck, dedicated persistent volumes, a reset recipe or fixture ingestion. Those are proposed additions below, not claims about Pushover. No Pushover scripts were executed and no project files changed. UCC builds an alert add-on; Clinic's React app does not need UCC solely because this harness pattern came from that project.

## Verified image choice and platform gate

Public Docker Hub tag metadata was fetched without pulling images. The observed official `splunk/splunk` tags `10.4.0`, `10.4.3`, `10.4.4`, `10.4` and `10.4.4-rhel9` each list `linux/amd64` only. The exact timestamp, tag/index digest and child image platform/digest are in [container evidence](../research/container-evidence.json). No ARM64 image entry is advertised by those checked tags. [Official tags](https://hub.docker.com/r/splunk/splunk/tags) and [Splunk 10.4 container installation guidance](https://help.splunk.com/en/splunk-enterprise/administer/install-and-upgrade/10.4/install-splunk-enterprise-in-virtual-and-containerized-environments) are the primary references.

Proposed first patch target: **Splunk Enterprise 10.4.4**, within the selected 10.4 family. Pin `splunk/splunk:10.4.4` with observed index digest `sha256:4f18abfb106b29dc6af68868fb2e5c5ae68aa8e9ac6bfb28b7bec12ede2079aa`, and set `platform: linux/amd64`. Revalidate the manifest/digest at implementation time and verify the running product reports 10.4.4/build. Do not use floating `10.4` or `latest`. If specifically testing initial 10.4.0 is required, that exact tag also exists and its digest is recorded; do not conflate it with 10.4.4. The RHEL9 variant is a separate observed image, not an automatic fallback.

`m2.local` reports `arm64`. Thus the local approach needs Docker's AMD64 emulation/translation, as Pushover's explicit platform also requests. Native ARM64 availability is a concrete blocker for a native test run. Emulated execution has not been tested here; if the image or Splunk processes fail under the chosen Docker engine, stop and report that 10.4/platform blocker. Do not switch to 9.3, 10.6, a Universal Forwarder or a custom ARM build. A separately authorized AMD64 Docker host would preserve the Splunk target, but is not the selected local environment.

This environment is for functional integration testing. Record emulation/engine version, allocated CPU/memory and host architecture; do not treat its search timings as representative of native production Splunk. A successful local startup is not a claim of vendor-supported emulation. No Docker daemon, installed engine, virtualization settings or allocated resources were inspected during this phase.

## Future reusable harness structure

```text
docker-compose.yml                 standalone packaged-app test service
justfile                           explicit build/check/up/logs/smoke/down/reset tasks
scripts/build-app.*                 stage frontend/config, validate and archive
scripts/test-local.*                bounded local-only API/UI validation
tests/fixtures/                     synthetic versioned inputs and expected outputs
tests/splunk-fixture-app/           separate test-only config/index definitions
docker/defaults.yml                 optional nonsecret provisioning config
output/caprine_clinic/              ignored staged app
caprine-clinic.spl                  ignored installable archive
.env.example                       names/placeholders only; never real secrets
```

This is a proposed layout, not an instruction to create these files now. Keep test fixtures/config separate from the release archive. Follow the existing build-then-package-then-Compose pattern, without copying its image version, credentials, service names or external alert behavior.

Use a dedicated Compose project name such as `caprine-clinic-test`, its own network and scoped storage. Propose loopback bindings `127.0.0.1:18000:8000` and `127.0.0.1:28089:8089`, after checking availability, so TA-pushover's ports are not reused. No privileged mode, Docker socket mount, production network/configuration or host Splunk directories. Disable automatic restarts for this disposable harness. Specify a conservative CPU/memory budget during implementation and record it; adequacy under emulation is a validation question.

Credentials are newly supplied local test credentials through an ignored local mechanism chosen at implementation, never copied from TA-pushover or embedded in source/logs. License acceptance requires an explicit user decision before startup. Do not ship a working default password or an auto-accept startup task in this design phase. The [official setup guide](https://splunk.github.io/docker-splunk/SETUP.html) describes these required startup inputs.

## Build, install and iteration flow

1. Build React assets and app configuration into a clean temporary staging tree; package one `caprine_clinic` top-level directory, validate the archive inventory and exclude `local/`, fixtures, node_modules, secrets and macOS metadata. UCC is unnecessary unless a later app feature independently requires it.
2. After separate startup authorization, mount the built archive read-only into `/tmp/caprine-clinic.spl`, and set `SPLUNK_APPS_URL` to that path for first boot. This matches Pushover and the official [filesystem archive installation flow](https://splunk.github.io/docker-splunk/advanced/APP_INSTALL.html).
3. Wait for documented image health/readiness and authenticated Web/REST readiness; inspect startup errors, product version and installed app version before loading the UI. Port-open alone is insufficient. A future status task must redact logs/credentials.
4. Verify UI via Splunk Web on the loopback port; the app browser uses Splunk Web session/proxy, while a test driver may use the loopback management endpoint with proper TLS trust. Do not inherit relaxed TLS verification.
5. Rebuild/repackage and recreate the disposable instance for deterministic package-install checks. If adding a faster edit loop, mount only a staged app directory at `/opt/splunk/etc/apps/caprine_clinic` as a separate profile, then validate reload/ownership behavior. Never enable directory mounting and archive installation for the same app concurrently. Keep package-install tests as the release gate.

## Test data, isolation and reset

Use a small deterministic synthetic JSON/CSV fixture corpus with explicit timestamps and a manifest of expected counts. Include duplicates, multivalue fields, missing/empty values, known aggregate outputs and boundary-time events. Ingest into a dedicated `caprine_clinic_test` index through a reviewed test-only mechanism, after authorization. No production exports, Pushover account config or outbound alert commands. Generating fixture events with read-only commands can supplement editor/lifecycle checks, but does not replace indexed data for time-bound validation.

Use fixed absolute fixture intervals and a documented timezone. Bootstrap may use the isolated test administrator; normal search/UI tests use a separate least-privilege role limited to the fixture index. Test permission denial with another explicitly scoped role. Poll/cancel/expiry tests use reviewed bounded workloads; deterministic mocks cover failures that would otherwise need unsafe resource stress.

Prefer disposable state for clean runs; if named volumes are introduced, scope them to this Compose project and define exactly which state is retained. A future `down` preserves data, while explicit `reset` removes only this harness's containers/project volumes and reimports fixtures. Reset must not run global Docker prune, delete unrelated volumes or touch TA-pushover. Before reset, identify owned resources and retain only redacted reports explicitly needed for evidence. New instances get a fresh fixture import, jobs and auth sessions; no reuse of production sessions.

## Validation gates and remaining prerequisites

- Before startup: confirm Docker engine/Compose availability, AMD64 emulation capability, ports, allocated resources and image manifest; obtain explicit license acceptance and local test credential provisioning authorization.
- Before app integration: build the future app, validate archive, boot the pinned 10.4 image, verify actual version/build and install readiness. Record startup failure as an exact version/platform blocker.
- Functional checks: native-looking editor/theme, session/CSRF/proxy, app context/ACL, frozen server time, parser and v2 results/events/previews, missing metrics, cancellation/TTL/cleanup and complete versus partial differences.
- Repeatability checks: reset/reimport expected fixture counts, verify no external traffic/actions, app rebuild/install, stale job behavior and browser logout/relogin. Record the exact image digest and emulation settings in reports.
- Remaining product decisions: dispatch context, command safety policy, resource budgets and result-diff semantics. The first release/environment question is now answered; no need to ask it again.

No container was pulled or started, no searches ran, no license terms were accepted, and no credentials were provisioned. Local 10.4 functionality remains unverified until those prerequisites are explicitly authorized and completed.
