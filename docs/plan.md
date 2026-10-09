# MVP, safeguards and implementation plan

> Current execution policy (user decision): Splunk alone governs SPL authorization, index access, concurrency quotas, runtime, job retention and permitted time ranges. Caprine Clinic imposes no command allowlist, panel count, concurrency cap, time-window cap or runtime budget. All selected searches are submitted together. Historical relative picker bounds share one server anchor; All Time, open endpoints and real-time expressions retain Splunk semantics. Inline SPL bounds/macros can override picker bounds, so matching picker intervals alone do not establish equivalent effective searches. Earlier proposed app restrictions below are superseded.


This plan defines future work. No task authorizes connecting to a live instance, running SPL or installing an app without a separate user instruction.

## Selected integration environment

The user chose local Docker testing patterned after TA-pushover and Splunk Enterprise 10.4. [Docker testing](docker-testing.md) specifies the reusable harness, verified tags/platforms, package install flow, fixture/reset design and validation gates. Propose digest-pinned 10.4.4, explicit linux/amd64 on ARM64 m2.local. Native ARM64 images are not advertised by the checked tags; local emulation startup is unverified and must not silently trigger a version substitution. Container startup, license acceptance, credentials and fixture ingestion remain separately authorized future work.

## MVP boundary

Include a Splunk Web React view with public Search editor, two initial panels, add/duplicate/remove, shared time with explicit per-panel overrides, run one/all concurrently, cancel one/all, typed progress/errors, immutable run snapshots, baseline selection, observed metrics, bounded final-results table/difference view and on-demand performance properties. Offer native inspector only after verification. Keep state in memory, use signed-in user permissions and private uncached jobs.

Defer repeated sequential benchmarks until core lifecycle and safety policy pass validation; they are designed in comparison.md. Also defer saved comparisons, exports, multi-user sharing, dashboards, real-time searches, SPL2, automatic optimization, alerts/scheduling, post-process SPL, backend services, new capabilities, quota changes and custom search commands. The user subsequently authorized the local MVP and isolated Docker deployment; production deployment remains outside scope.

## Safeguards before execution exists

User-selected policy: default Last 15 minutes, with all other time selections accepted. Splunk configuration alone governs permissions, admission, runtime and retention. No app thresholds or extra execution approval prompts. A result row cap is not a search compute cap. Do not append `head` to arbitrary SPL: it can change output/semantics and does not reliably bound work.

Validate the server's supported job-runtime parameters/role limits during the spike. A client cancellation timer is secondary protection, since tab closure/network failure can prevent it. Surface server auto-finalization and truncation as partial output. Establish a bounded TTL, cleanup policy and owned-job ledger. Do not start execution in an environment where required server safeguards are unverified.

Arbitrary SPL is accepted, including macros, subsearches and custom commands. Splunk's permissions and native safeguards remain authoritative; this frontend is not a security boundary. Never run searches automatically or disable Splunk's risky-command checks. Development validation uses explicitly selected synthetic read-only fixtures.

Preserve server risky-command checks and never auto-bypass them. For unknown semantics, block execution with a clear reason and retain the draft. General arbitrary SPL support requires an agreed trusted policy/enforcement model; frontend controls are not a sandbox. Repeated benchmark mode must refuse side-effectful or unresolved searches because repetition can amplify harm. Cancel cannot undo completed writes/messages.

Quota handling: dispatch Run all together, show Splunk's queueing/rejections and preserve sibling outcomes. No quota changes, client admission cap, automatic creation retries or substitute wave mode.

## Phases and acceptance gates

| Phase | Tasks | Exit evidence |
| --- | --- | --- |
| 0 — Decisions and target | Record chosen 10.4 standalone local Docker target; verify engine/emulation and pinned 10.4.4 manifest; choose execution context/SPL policy/budgets; obtain explicit startup/license/credential authorization | Written compatibility/policy target; no secrets in project |
| 1 — UI and packaging spike | Inspect current Create scaffold; pin Node 22/React 18 and Splunk peer graph; design/build archive plus isolated Compose/just harness per docker-testing.md; initially mock transport; after startup authorization validate Bar/Input/time picker and theme on 10.4 | Editor renders, accessible submit/time callbacks work; local build and package inventory; no unsupported private imports |
| 2 — Adapter validation | With explicit authorization, bootstrap/import isolated synthetic fixtures and least-privilege users on the pinned 10.4 instance; verify readiness/version, timeparser, parser, async SID, v2 retrieval, cancellation/TTL, session/context/permissions and scoped reset | Redacted response fixtures and version matrix; wire paths and terminal/partial states confirmed |
| 3 — Workspace lifecycle | Build panel reducer, immutable snapshots, coordinator/admission, polling, errors, cancellation and owned-job cleanup | Deterministic mock scenarios and authorized integration cases pass; no duplicate/unknown-request retries |
| 4 — Comparison MVP | Implement optional metrics, baseline table, bounded pagination, exact multiset/keyed diffs and detail drawer | Fixture diffs correct; incomplete/unavailable states prevent false equality and rankings |
| 5 — Package candidate | Produce app archive separately from source; exclude development/secret files; run current local AppInspect and deployment-specific checks | AppInspect report and reviewed compatibility evidence; user separately authorizes installation/deployment |
| 6 — Controlled benchmark | Add reviewed repeated sequential workflow, budgets, fixed interval, recorded ordering, summaries | Warm-up/order/failure handling verified; methodology labels and resource controls reviewed |

Implementation layout proposal: `frontend/` for TypeScript/React modules, `splunk-app/` for app configuration/view assets, `tests/fixtures/` for synthetic/redacted API responses and `dist/` for ignored staged archives. Do not create these empty implementation folders or install a scaffold until phase 1 starts. Prefer one frontend package over a monorepo unless the chosen scaffold makes an actual requirement clear.

## Test strategy

Design-only verification is documented separately. Future meaningful tests:

- Unit/property tests for reducer races, immutable revision/run associations, terminal/partial/unknown mappings, optional metric decoding, zero-baseline deltas, canonical multiset multiplicity, duplicate-key detection, hash collisions, missing/null/multi-value fields, cap boundaries and schema mismatch.
- Fake clock/transport tests for run-all snapshot-before-dispatch, shared anchor across midnight/DST, cancellation during creation, quota denial, mixed sibling outcomes, late responses, lost POST acknowledgement, session expiration, poll backoff and cleanup failure. Accept inline time/macros unchanged and mark effective time equivalence as unverified.
- Adapter contract fixtures for job metadata/messages/performance with missing fields, JSON booleans/numeric strings, v2 result pagination, previews replacing generations, events absent, artifact 404 and server-finalized partial data. Fixture presence does not prove server support.
- UI tests for add/duplicate/remove/baseline, Enter/escape behavior, search controls, edited-since-run indicators, mismatch badges, cancellation acknowledgement, incomplete diffs, keyboard focus and safe text rendering of hostile results/log messages. Use accessible queries and realistic lifecycle scenarios.
- Authorized integration tests on nominated Enterprise/Cloud builds for namespace macro/lookup resolution, least-privilege roles, restricted indexes, job ownership, SSO/CSRF, locale/root proxy paths, v2-only endpoint configuration, metric availability, runtime caps/TTL and native inspector routes.
- Resource checks using reviewed synthetic fixtures: concurrent overlap/denial, delayed polls, large cells/pages, tab close and orphan expiry. Avoid production load experiments. No test search may write data or send messages unless separately explicitly authorized for an isolated test.
- Packaging/AppInspect, CSP/assets, light/dark mode, supported browser and accessibility review before an install candidate. Cloud vetting and cluster deployment procedure need separate verification.

## Genuine decisions for the user

Resolved: first target is Splunk Enterprise 10.4, standalone local Docker on m2.local following TA-pushover; propose verified 10.4.4 patch and explicit AMD64 emulation. Startup, licensing and credentials still require authorization when that phase begins.

Remaining decisions:

1. Should all searches use `caprine_clinic` context, or a selected existing app context so its macros/lookups resolve? Default proposal: one visible context shared across the batch.
2. Which additional Splunk versions/topologies should be validated after local 10.4.4?
3. Is complete unordered multiset equality sufficient, or are row keys/numeric tolerances needed for a later comparison mode? Search limits were resolved: use Splunk configuration alone.
4. Which result comparison is most useful first: unordered complete rows or explicit unique keys? Proposal: exact unordered multisets with optional unique keys, and no tolerance by default.

Everything else can use the defaults described here without another design approval round. Persistence/export and repeated benchmarks can be decided when those phases are authorized.
