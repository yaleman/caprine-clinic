# Caprine Clinic project guidance

## Scope and source

Caprine Clinic is a React app embedded in Splunk Web for concurrent search comparison. Keep README.md focused on installation and human usage. Put contributor/agent instructions here, detailed evidence and design in docs/, and generated artifacts outside Git.

- Edit frontend/ and splunk-app/ source. Do not edit generated output/, dist/, archives or fingerprinted bundles.
- Use enums or dedicated types for machine-readable status, errors and search modes.
- Use React 18 and public Splunk packages: @splunk/react-page for native chrome, @splunk/react-search for the editor/search bar, @splunk/react-time-range for time controls, and @splunk/react-ui for controls and tables. Do not copy private Search & Reporting internals or assume the general UI library supplies every search feature.
- The REST adapter in frontend/api.ts uses the same-origin Splunk Web session and CSRF helpers. Keep API version choices explicit. Preserve submitted SPL, time bounds, mode and job identity independently of later panel edits.
- Concurrent execution and exact unordered multiset result comparison are implemented. Repeated sequential benchmarking is a future design item; do not describe it as available.
- Report unavailable metrics and partial results honestly. Events, final statistics and previews are separate API products.

## Search behavior and authorization

- Splunk governs search permissions, time ranges, concurrency and runtime. Do not add app execution limits, command allowlists or automatic job cancellation on page close.
- Resolve relative historical ranges with one server anchor per launch. Preserve All Time/open endpoints and real-time semantics. Inline SPL bounds/macros can override comparison assumptions.
- Local live validation uses only authorized synthetic searches on the existing Clinic container. Preserve data and user drafts; do not change other Splunk apps. Do not connect to another live instance or run user searches without authorization.
- Keep credentials, local instance state, generated fixtures, screenshots, caches and build artifacts ignored. Never print credentials or put them in command arguments, source, docs or release assets.
- Publishing, pushing, repository creation or expanded CI permissions require explicit authorization. The user authorized versioned main-build publication to yaleman/caprine-clinic; only the publication job grants contents-write permission.

## Build and checks

Use Node **26.10.0** from .node-version and Python **3.11+** for the current local harness/tests (datetime.UTC is used). Install locked dependencies and run checks before committing app or packaging changes:

```sh
npm ci --no-audit --no-fund
TSX_DISABLE_CACHE=1 PYTHONDONTWRITEBYTECODE=1 npm run check
npm run package:metadata
```

`check` runs eight TypeScript model tests, six Python archive/fixture/publication tests, TypeScript checking and the production build. Publication tests mock GitHub; they must not create external releases. If the system python3 is too old, select the installed Homebrew interpreter through PATH. The cache flags avoid writing outside the workspace in sandboxed sessions.

Production outputs are dist/caprine_clinic-<version>.tar.gz and its adjacent .sha256. caprine-clinic.spl is an identical alias for Compose first boot. output/clinic-test-fixtures.spl is a separate local-only app and must never be published. The archive writer normalizes ordering, ownership, modes and timestamps; validate inventory/fingerprints and byte-identical repeat builds when changing packaging. Archives contain only production app configuration and assets, never local/, fixtures, credentials or node_modules.

## Versioned publication

package.json supplies splunk.appId and version. package-lock.json and both [launcher]/[id] versions in splunk-app/default/app.conf must agree. Run `npm version <version> --no-git-tag-version`, update app.conf, then check and commit the changes.

.github/workflows/package.yml builds main pushes, pull requests and manual runs. It validates reproducibility and uploads a commit-specific artifact. Successful main push/manual builds publish `v<package.json version>` using scripts/publish_release.sh. Rebuilds with the same version move that tag and replace the archive/checksum assets. Version bumps create a new version release; there is no rolling `latest` tag. No manually pushed tag is required. Superseded queued builds skip publication, and publication jobs are serialized.

Pull requests and other branches cannot publish. The build job has contents-read permission; the separate publication job has contents-write permission, downloads the checked artifact and verifies its checksum. Keep action references pinned and checkout credential persistence disabled. Hosted CI uses no live Splunk instance, credentials, Docker or synthetic searches. See docs/packaging.md for detailed conventions and official action/CLI references.

## Local test instance

The owned Compose project is caprine-clinic-test; its Splunk container is caprine-clinic-test-splunk-1. It runs Splunk Enterprise **10.4.4** using a pinned linux/amd64 image under emulation on the ARM64 Mac. Functional results do not establish native or production performance.

- Web: http://127.0.0.1:18000/en-US/app/caprine_clinic/clinic
- REST: https://127.0.0.1:28089
- Private test-account details: .local/test-account.json (mode 0600); never expose its contents.
- Harness: `just init`, `just up`, `just status`, `just smoke`. Initial provisioning installs the app and separate synthetic-fixture app. Preserve existing credentials/data when initializing.
- Edit loop: `just deploy` rebuilds, copies assets into the owned container and restarts Splunk Web. Avoid a full container restart for asset-only changes.
- Fixtures are timestamped once. Use their absolute interval in tests/fixtures/manifest.json or All Time; Last 15 minutes can exclude older fixtures. The original corpus contains twelve events (north=7, south=5); layout/pagination fixtures use a separate index.
- Browser tests must preserve user drafts and other tabs. Restore viewport emulation and native window rendering size after responsive testing; a fixed test viewport can leave blank strips in the visible browser. Do not reload user tabs to reset layout.

## Evidence and design references

- docs/research.md: public packages/APIs, constraints and official sources.
- docs/architecture.md: modules, typed state, API mapping and job ownership.
- docs/interactions.md: interaction flows and wireframes.
- docs/comparison.md: frozen time ranges, performance interpretation and result differences.
- docs/plan.md: implementation phases, acceptance criteria and pending decisions.
- docs/docker-testing.md: original local harness design and provisioning references.
- docs/runtime.md: current live verification and limitations; consult this before claiming feature support.
- docs/verification.md: investigation-stage checks and live-validation requirements.
- research/package-evidence.json: researched package versions, peers and archive integrity.
- docs/packaging.md: archive/release conventions and hosted publication evidence.

Some design documents describe earlier proposals; inspect current source and runtime evidence before using them as implementation facts. Tested local installation and hosted publication are not AppInspect or Splunk Cloud certification. Real-time behavior, production load, session expiry/cancellation races and side-effect SPL need separate validation. The native Job Inspector link is not a confirmed compatibility guarantee.

Official starting points: [Splunk UI packages](https://splunkui.splunk.com/Packages), [React Search](https://splunkui.splunk.com/Packages/react-search/), [SearchJob](https://splunkui.splunk.com/Packages/search-job/), [Enterprise 10.4 search REST reference](https://help.splunk.com/en/splunk-enterprise/leverage-rest-apis/rest-api-reference/10.4/search-endpoints/search-endpoint-descriptions), [Job Inspector](https://help.splunk.com/en/?resourceId=Splunk_Search_ViewsearchjobpropertieswiththeJobInspector), [app creation](https://dev.splunk.com/enterprise/docs/developapps/createapps). Recheck official current documentation/source when changing package or API assumptions.
