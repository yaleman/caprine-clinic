# Local runtime record

## Running instance

Splunk Enterprise 10.4.4, build f0f12fcdcaa1; Docker container `caprine-clinic-test-splunk-1`, project `caprine-clinic-test`. Web http://127.0.0.1:18000; management https://127.0.0.1:28089. Pinned image evidence is in `research/container-evidence.json`. Generated local credentials are in `.local/test-account.json`; the app uses the signed-in Splunk Web session and CSRF helpers, with no embedded credentials.

## Implemented

React 18, public Splunk UI controls, React Search Bar, Time Range Dropdown and React Page native navigation. Add/duplicate/remove panels; run independently or concurrently; cancel owned jobs; frozen shared/per-panel historical time; immutable run snapshots; job progress/errors; baseline metrics; final result multiset comparison; paged statistics/events/preview; returned component costs and native inspector link.

Splunk alone governs commands, permissions, runtime, retention and concurrency. There is no app command allowlist, search-length limit, interval cap, panel cap, execution timeout or active-job cap. The test account inherits Splunk's standard user role; the app does not override its search quotas. API job creation omits max_time and timeout. Result retrieval is paged, without a total fetch cap; very large comparisons can consume browser memory. Only 25 mismatch examples per side are rendered, without affecting computed counts. Run all issues all creation requests together; server admission can queue or reject individual jobs.

Historical relative picker endpoints share a server anchor. All Time/open endpoints and real-time expressions pass through with Splunk semantics. Inline time expressions, macros and moving-time functions are accepted; the app cannot establish effective time equivalence from picker values alone. The runtime delta is descriptive, not an isolated benchmark.

## Evidence and limits

Eight model tests, TypeScript check and production build pass. Packaged archives are built from staged app files, excluding credentials and dependencies. REST smoke on synthetic fixtures verified an asynchronous job, v2 final results, north=7/south=5, returned runDuration/scanCount/eventCount/resultCount/diskUsage/performance, and acknowledged cancellation. See `research/runtime-smoke.json`.

Browser testing verified native navigation, search editor, connected Splunk presets, All Time, duplicate panel, Run all with three concurrently submitted jobs, completed metrics, final-result comparison (two shared rows, zero differences), expected north=7/south=5 detail rows and returned component costs. Screenshot: `output/playwright/clinic.png`. Installed asset fingerprints match the final build. Further real-time, side-effect commands, production load, session expiry, difficult cancellation races, large result sets and distributed topology require separate validation. No side-effect SPL is executed as a test. The React Search helper requests a structured-data-service configuration section absent in this 10.4.4 instance (404); editor and verified workflows continue to work, but full completion/assistance coverage remains unverified. The inspector link is rendered; inspector-page behavior remains unverified. No AppInspect or Cloud approval is claimed. Repeated sequential benchmarks and persistence remain planned.

The current view uses the official scaffold's custom Mako template mechanism, which Splunk 10.4 deprecates and administrators may disable. The test instance permits it by its existing settings; the harness does not bypass that control. A supported replacement entry mechanism must be selected before a production release.

Closing the page does not cancel jobs. Splunk's configured lifecycle governs them; explicit Cancel controls target owned jobs. The app does not impose expiry overrides. Default generated certificates are trusted through the owned container's exported CA plus exact leaf certificate pin in the Python harness; no insecure TLS bypass is used.

## Previous test environment removal

At the user's explicit request, `ta-cloudflare-logs-live-splunk-1` was removed. After the separate instruction to remove its volumes, anonymous volumes `28c682e46ea6c91f63f028d35a51e9d1461e0b738c606d7b47e5bd84b4df274a` and `469e135cff48e5476fc7c528cae4eecb77692d04d0550e7178545ddbe2b515d3` were permanently removed. Repository files were untouched.

The development deploy command restores `splunk:splunk` ownership after copying app files. A restart initially exposed root-owned file copies; ownership was corrected, archive installation succeeded, and the container returned to healthy status.

## UI revision verification

Removed the tagline, limits notice, concurrent-run notice, runtime-delta explanation and duplicate final-row status. Shared Fast/Smart/Verbose mode and explicit per-panel overrides now determine the actual `adhoc_search_level` job parameter. `Shared` restores inheritance; changing the shared control preserves explicit overrides. Each immutable run stores its mode and original/frozen time endpoints. Status appears once beneath each panel; SID is in job details. All Time and real-time/custom labels avoid numeric zero-arrow ranges. Results and Execution Costs are level-three headings; costs have 24px top spacing.

Actual browser requests were observed and asserted for Fast/Verbose, repeated Smart/Verbose and an independent inherited Fast run. Changing mode/time controls preserved prior run summaries until rerunning. Historical runs displayed frozen readable UTC bounds; All Time displayed All Time. Unit tests cover real-time/custom labels without executing real-time searches. Final browser assertions verified removed copy, no max_time/timeout parameters, matching detail heading hierarchy, SID access and spacing. Synthetic counts remained north=7/south=5. The final screenshot was visually inspected: `output/playwright/clinic-mode-controls.png`.

Partial/failed mapping is unit-tested; this revision did not force live cancellation races, server finalization, permission failures or result-retrieval failures. Completed-job metadata now remains completed if fetching results fails, with a distinct retrieval error. The public time connector can request an empty All Time endpoint from timeparser (400) when reopening the picker; presets and execution continue to work. The previously recorded optional-helper 404 remains. No new app search restrictions were introduced.

## Panel header and Events layout revision

Both per-panel controls now sit in the heading row, wrapping at narrow widths. The instance/version badge was removed; no remote-target control exists. Execution callbacks, shared defaults, explicit overrides and immutable run snapshots remain unchanged.

The live Events endpoint returned 35 fields. The prior table fitted them into roughly 1,300 pixels, compressing `_raw` to about 48px with break-word wrapping. The revised table puts `_time` and `_raw` first, preserves every returned field, uses 220px time / 640px raw / 160px other columns, wraps long content within each column, and uses Splunk Table's inner horizontal scroll viewport. The surrounding result area contains scrolling. Cell content accounts for padding. Execution-cost components have 400px columns; the comparison table also scrolls within its panel at narrow widths.

A separate `caprine_clinic_layout_test` index contains 205 synthetic events with roughly 3,300-character raw records and multiple fields, sourced from `tests/fixtures/layout.jsonl`. It is configured in the isolated test fixture app. The original fixture index/counts remain unchanged (north=7, south=5), confirmed by REST smoke. No non-synthetic draft was dispatched. The user's existing tab was preserved; validation used a separate tab.

Final build: eight tests, TypeScript and production packaging passed. Browser assertions covered actual Verbose dispatch without max_time/timeout, override and snapshot preservation when shared mode changed, both controls inside the heading, absence of the instance badge, Events pages 1–100 / 101–200 / 201–205, disabled Next on the final page, backward navigation, readable 640px raw columns, contained horizontal scroll and header alignment. CSS viewport widths 1600, 1280, 768 and 390 were tested while respecting the user's existing browser zoom. Desktop and narrow app screenshots were visually inspected. Files: `output/playwright/clinic-events-{width}.png` (full browser) and `output/playwright/clinic-workspace-{width}.png` (app). The native Splunk navigation itself remains desktop-oriented and may exceed a narrow viewport; the Clinic panels remain within it.

Screenshot input limitation: the supplied Library PNG was resolved and attempted through the current supported materialization helper in a private local directory using compatible Python. The download returned HTTP 403; no readable local PNG was produced, so its pixels were not inspected. Diagnosis used measured live event data and freshly generated browser screenshots instead. No alternate or invented URL was used.
