# Investigation verification record (historical)

The following records the original design phase. Implementation and local startup were subsequently authorized; see [current runtime evidence](runtime.md).

## Completed in this phase

- Confirmed shell host is `m2.local` and initial destination `/Users/yaleman/Projects/caprine-clinic` was absent. No unrelated project was replaced or read as application source.
- Checked ancestor guidance: `/Users/yaleman/AGENTS.md` applies and requires typed internal status/error categories. No `/Users/yaleman/Projects/AGENTS.md` was found. Project `.agents` inventory contains Kanidm guidance only, not relevant Splunk instructions. Unrelated repositories' guidance was not adopted.
- Read the installed Splunk query skill to check local operating guidance. Its live-query/credential workflow was not invoked: this request explicitly prohibits live-instance access. No Keychain helper, Splunk CLI, credentials or user data were accessed.
- Researched official Splunk UI, developer documentation, REST reference, Job Inspector, security and concurrency documentation. Some developer/UI pages are JavaScript-rendered and returned little readable text through browsing. Public Splunk npm metadata and published source were inspected to verify packages and exported APIs instead of inferring capabilities.
- Inspected published Search 8.0.0, SearchJob 3.1.0, splunk-utils 4.1.0 and SearchJob's currently resolving utils 3.4.0 source under temporary research storage. Captured exact registry metadata/source archive URLs and integrity identifiers in `research/package-evidence.json`. No packages were installed or executed. Integrity strings are recorded provenance; this phase did not perform an independent tarball integrity verification.
- Checked package peer requirements and Node engines, search bar callback contracts, SearchJob cancellation/cache guidance, utils v2 routing, URL/CSRF helpers and time parsing limitations. These are source-level observations.
- Produced only Markdown design documents and a JSON evidence snapshot. Local wireframes are contained in `docs/interactions.md`; no mock application/server was created.

## Validation requiring an authorized live Splunk instance

| Question | Required check |
| --- | --- |
| Supported app view entry | Current scaffold/view mount, app chrome, CSP, asset routing and target release/Cloud vetting |
| Editor fidelity | SPL syntax/completion, multiline, keyboard shortcuts, assistance endpoint permissions, time picker/theme in real Splunk context |
| Frozen time correctness | Server anchor, repeated bounds, timezone/DST/snap behavior, effective dispatched bounds and inline/macro overrides |
| API compatibility | Exact create/status/control/v2 retrieval/parser paths, payloads, context and proxy configuration |
| Metrics | Returned fields/units, performance map structure, search-mode/topology differences, missing properties and finalization behavior |
| Results | Event availability, previews, pagination/server truncation, large fields and artifact expiry |
| Security | Least-privilege command/index policies, risky-command coverage, macros/custom commands, app ACL, CSRF/SSO/session expiry |
| Resources | User/role/cluster quotas, admission rules, runtime/TTL bounds, actual concurrent overlap and cancellation/orphan cleanup |
| Native inspector | Context-aware route, permissions, expired artifacts and target-version behavior |

The user subsequently selected Splunk Enterprise 10.4 in a local standalone Docker instance on m2.local, following TA-pushover. Relevant Pushover harness/build/test files were inspected read-only with credential-bearing lines suppressed; its external configuration was not opened or copied. Official Docker Hub metadata verified five 10.4-family tags and their linux/amd64 image entries, preserved in `research/container-evidence.json`. Native ARM64 is not advertised by those tags, while the host reports arm64. Emulated startup remains untested. See [Docker testing](docker-testing.md).

There are still no runtime measurements, package build claims, AppInspect reports, performance conclusions or compatibility guarantees. Startup, license acceptance, new local test credentials, app install and synthetic fixture ingestion require future authorization. No Docker daemon inspection, image pull or container start occurred in this update.

## Scope record

No Git repository initialization, commits, GitHub creation, push, external account setup, deployment or changes to existing Splunk apps. The project has no lockfile or implementation manifest because dependencies have not yet been chosen through a build spike. Temporary public-source downloads remain outside the project under `/tmp/caprine-research`; only the compact evidence record is a deliverable.
