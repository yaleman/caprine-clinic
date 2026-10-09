# Caprine Clinic

Search diagnostics for the herd: a local Splunk app for editing multiple searches, running one or all, and comparing their observed performance and results.

The local MVP is built and installed on Splunk Enterprise **10.4.4** on m2.local. Open [Caprine Clinic](http://127.0.0.1:18000/en-US/app/caprine_clinic/clinic). The isolated `clinic` login is stored in `.local/test-account.json` (mode 0600); credentials are excluded from packages.

Splunk configuration governs permissions, concurrency, runtime and time ranges. Clinic accepts arbitrary SPL, adds no search limits and submits Run all together. Relative historical time expressions use one server anchor; inline SPL bounds/macros and real-time windows require care when interpreting comparisons.

Build: `npm run build`. Check: `TSX_DISABLE_CACHE=1 npm run check`. Test harness: `just init`, `just up`, `just status`, `just smoke`. After rebuilding, `just deploy` copies Clinic assets into the existing test container and restarts Splunk Web. First boot installs the app and a separate synthetic-fixture app. Fixtures are timestamped once; use their absolute interval in `tests/fixtures/manifest.json` or All Time when exploring the twelve indexed fixture events. Default Last 15 minutes can exclude older fixtures.

See [current runtime verification and limitations](docs/runtime.md).
## Packaging

Use Node **26.10.0** (`.node-version`) and Python 3.9+. Run `npm ci --no-audit --no-fund`, then `npm run check`. The installable package is `dist/caprine_clinic-0.1.0.tar.gz`, with a SHA-256 checksum beside it. `caprine-clinic.spl` remains an identical local Compose alias. Generated packages, credentials, fixture data and runtime artifacts are ignored by Git.

The GitHub workflow validates reproducibility and uploads the package/checksum. Successful main builds publish to the `v<package.json version>` GitHub Release, updating that version’s tag and assets on subsequent builds. Pull requests only build and validate. See [packaging conventions and validation](docs/packaging.md) for version bumps and remote setup.

## Read the design

- [Research and package evidence](docs/research.md): verified public components, APIs, constraints and official references.
- [Architecture and data model](docs/architecture.md): modules, typed state, transport mapping and ownership.
- [Interaction design](docs/interactions.md): local text wireframes and execution flows.
- [Comparison methodology](docs/comparison.md): frozen times, statistical interpretation and result differences.
- [Implementation and test plan](docs/plan.md): MVP, safeguards, phases, acceptance criteria and user decisions.
- [Local Docker testing](docs/docker-testing.md): TA-pushover conventions adapted for the selected Splunk Enterprise 10.4 target.
- [Verification record](docs/verification.md): checks performed and validation still requiring a live instance.
- [Package evidence](research/package-evidence.json): exact published versions, peer requirements and source archive integrity identifiers observed during research.

## Proposed direction

Use React 18 and Splunk UI inside Splunk Web. The general `@splunk/react-ui` library supplies familiar controls; the separate `@splunk/react-search` package supplies a search bar, SPL input and time picker integration. Use a small job adapter around public Splunk utilities or SearchJob, keeping REST version choices explicit. Do not copy private Search & Reporting internals.

“Run all” submits independent searches concurrently. It is an observed side-by-side comparison under shared load. A later repeated sequential mode supports more controlled benchmarking. Final results are compared separately from events and previews. Unavailable or truncated data must remain visibly unavailable or incomplete.

## Official starting points

- [Splunk UI packages](https://splunkui.splunk.com/Packages)
- [React Search](https://splunkui.splunk.com/Packages/react-search/)
- [SearchJob](https://splunkui.splunk.com/Packages/search-job/)
- [Search REST reference, Enterprise 10.4](https://help.splunk.com/en/splunk-enterprise/leverage-rest-apis/rest-api-reference/10.4/search-endpoints/search-endpoint-descriptions)
- [Search Job Inspector](https://help.splunk.com/en/?resourceId=Splunk_Search_ViewsearchjobpropertieswiththeJobInspector)
- [Create a Splunk app](https://dev.splunk.com/enterprise/docs/developapps/createapps)

The local target runs the pinned linux/amd64 image under emulation on the ARM64 Mac. This establishes local functional compatibility; timings do not represent native or production performance. Source and packaging automation are maintained in the Git repository.
