# Architecture and contracts

> Current execution policy (user decision): Splunk alone governs SPL authorization, index access, concurrency quotas, runtime, job retention and permitted time ranges. Caprine Clinic imposes no command allowlist, panel count, concurrency cap, time-window cap or runtime budget. All selected searches are submitted together. Historical relative picker bounds share one server anchor; All Time, open endpoints and real-time expressions retain Splunk semantics. Inline SPL bounds/macros can override picker bounds, so matching picker intervals alone do not establish equivalent effective searches. Earlier proposed app restrictions below are superseded.


All types and interfaces here are proposed design contracts, not implemented code. Internal states/errors must be enums or dedicated types, following `/Users/yaleman/AGENTS.md`; strings belong at REST and storage boundaries.

## Module boundaries

```text
Splunk Web app shell + session/theme/context
  ClinicWorkspace (shared time, panels, baseline, comparison table)
    SearchPanel (public Search Bar/Input, job controls, tabs)
    RunCoordinator (snapshot, safety review, frozen times, admission)
      TimeResolver -> Splunk timeparser
      JobAdapter -> Splunk Web REST proxy
    ComparisonEngine (pure typed rows/metrics, bounded memory)
    DetailDrawer (properties, component costs, results, event/log access)
```

The first integration target is a standalone Splunk Enterprise 10.4 Docker instance on m2.local; the proposed pinned patch is 10.4.4 with linux/amd64 emulation. Package-install and optional staged-directory iteration profiles are specified in [Docker testing](docker-testing.md). This harness changes no production architecture assumptions and does not establish cluster/Cloud support.

Use React context/reducer for workspace and per-run state; no global state dependency until justified. Keep transport, clocks, polling and IDs injectable. One coordinator owns every SID, subscription, abort controller and cleanup obligation. A panel displays a draft and immutable run snapshot separately. Optional in-memory history is bounded; reload loses content unless the user explicitly chooses persistence in a later phase.

## State and data model

| Entity | Proposed fields |
| --- | --- |
| Workspace | workspaceId, ordered PanelIds, sharedTime, dispatchApp, searchMode, baselineRunId, comparisonPolicy, currentBatchId |
| SearchPanel | panelId, label, draftSpl, revision, timePolicy enum (Shared/Override), overrideTime, latestRunId, dirtySinceRun |
| TimeExpression | earliestExpression, latestExpression, displayedTimezone; Splunk time expression semantics |
| ResolvedTime | earliestEpoch, latestEpoch, canonical absolute strings, anchor, original expressions, resolver version/context |
| Batch | batchId, mode enum (Concurrent/SequentialBenchmark), immutable member snapshots, preparation state, fixed time sets, requested concurrency, actual dispatch order |
| SearchRun | runId, panelId/revision, batchId, exactSpl, effectiveTime, app/owner, mode, preview policy, SID optional, state enum, serverStateRaw, timestamps, terminalReason, metrics, warnings |
| JobMetrics | optional runDurationSeconds, scanCount, eventCount, eventAvailableCount, resultCount, diskUsageBytes, progress; availability for each value |
| ComponentCost | server component name, optional durationSeconds, invocations, inputCount, outputCount, source provenance |
| ResultPage | runId, SID, kind enum (FinalResults/Events/Preview), offset, limit, fields, rows, previewGeneration optional, completeness enum |
| Comparison | baselineRunId, candidateRunId, eligibility/reasons, metric deltas, selected fields/keys, ordering/value policies, scope completeness, mismatch samples |
| Failure | typed kind (Validation/Auth/Permission/Quota/Transport/Server/Expired/UnknownDispatch/Cleanup), retryability, safe message, optional HTTP code/server messages |

Represent missing as an availability enum plus optional value, never zero. Preserve raw server states in an explicit boundary field; map known values into typed internal state and unknown values into Unknown. Decode numeric/string booleans and validate finite nonnegative counts/durations. Preserve unknown response fields only in bounded on-demand detail, not the main model.

Proposed states: Draft -> Preparing -> AwaitingReview (when needed) -> Dispatching -> Queued/Running/Finalizing -> Completed. Branches include Failed, Cancelling -> Cancelled, Expired and DispatchOutcomeUnknown. Poll failure is a connection condition, not proof the job failed. A server-finalized partial result is distinct from a fully completed run. Cancellation does not undo SPL side effects.

## REST mapping

Paths below are service-relative; construct the actual same-origin, locale/root-aware proxy URL through public Splunk utilities. Encode owner/app/SID as path segments. Use authenticated user context for creation. Verify returned job links/ACLs rather than assuming every subresource is namespaced identically. These API names are documented in the [search reference](https://help.splunk.com/en/splunk-enterprise/leverage-rest-apis/rest-api-reference/10.4/search-endpoints/search-endpoint-descriptions).

| App operation | Method and path | Planned handling |
| --- | --- | --- |
| Resolve bounds | GET `search/timeparser` | Repeated `time`, one fixed `now`, explicit JSON format; do not use separate rolling-now resolutions. |
| Parse SPL | POST `search/v2/parser` | Validate in dispatch context; messages are not execution authorization. |
| Create private async job | POST `search/jobs` | exact search, absolute earliest/latest, `exec_mode=normal`, agreed search mode and bounds; retain SID immediately. |
| Poll | GET `search/jobs/{sid}` | job properties/messages, terminal flags and optional performance map |
| Final rows | GET `search/v2/jobs/{sid}/results` | `output_mode=json`, bounded `count`/`offset`; only eligible final snapshots enter equality comparison. |
| Events | GET `search/v2/jobs/{sid}/events` | separate page/source semantics; never substitute events for final rows. |
| Preview | GET `search/v2/jobs/{sid}/results_preview` | optional display; replace generation, not append blindly. |
| Cancel | POST `search/jobs/{sid}/control` | `action=cancel`; await acknowledgement then reconcile state. |
| Partial stop (later) | POST same control | `action=finalize`; clearly partial and benchmark-ineligible. |
| Artifact lifetime (if needed) | POST same control | bounded `touch`/`setttl`; no indefinite keepalive. |
| Forget owned artifact | DELETE `search/jobs/{sid}` | explicit release policy; never delete an external/reused SID. |
| Inspect log | GET `search/jobs/{sid}/search.log` | on-demand text, redaction/size limit, no automatic parsing contract |

No export/oneshot endpoint for MVP: retaining a controllable SID is central. No post-process search in the result-difference UI: compare downloaded bounded rows locally. A later post-process feature requires separate safety review and POST-compatible v2 handling. No gratuitous extra searches for diagnostics.

Metrics mapping: normalize returned `runDuration`, `scanCount`, `eventCount`, `eventAvailableCount`, `resultCount`, `diskUsage`, `doneProgress`, terminal flags and messages. Component detail maps returned `performance` entries such as `duration_secs`, `invocations`, `input_count`, `output_count`. Labels and units must match observed version documentation; missing fields remain unavailable. Never infer total CPU, peak memory, network bytes, per-indexer work or queue duration from these fields. Browser dispatch/acknowledgement/first-preview/terminal-observation durations are separate client measurements, including transport and polling delay.

## Job adapter and scheduling

Proposed adapter methods: prepareTime, parse, create, readStatus, readPage, control, readLog, release. Use public utilities directly or SearchJob behind this contract; pick one after the spike. If SearchJob is selected, pin its resolved utils 3.4.0-compatible dependency, use `cache:false`, manage subscriptions explicitly and disable accidental duplicate polling. Do not patch its private methods to use utils 4.x.

Poll status with a single bounded scheduler: initially about once per second, back off when queued/hidden, stop on terminal state and cap retry duration. This is an application polling choice, not a Splunk latency promise. Abort obsolete reads; use runId/revision to prevent a late response from overwriting a new run. Preview only on user request and at a lower rate. Always retrieve final status once before settling a run.

Run all prepares every member before dispatch. Submit members without awaiting prior search completion, subject to the configured admission cap. Record submission skew and actual overlap; there is no atomic multi-job start API in the proposed design. If the member count exceeds the cap, offer an explicit wave plan or reduce selection; do not silently call sequential execution “simultaneous.” A failed member does not cancel successful siblings unless the user chooses Cancel all.

## Ownership, errors and cleanup

Maintain a ledger of owned SIDs and bounded artifact expiry. Only Clinic-created jobs are cancelled/released. Stop active polling, send cancellation, reconcile, then stop keepalive. Removal of an active panel requires a cancel/dispose flow; retain cleanup status after the panel disappears. Rerun cancels the old active job before creating a replacement by default. Preserve completed artifact long enough for detail inspection, bounded by TTL and memory budget.

On page exit, best-effort cancellation is not reliable. Use Splunk's configured server lifecycle; surface cleanup failure and Jobs/inspector guidance on reconnect. Do not save jobs indefinitely. If the create request times out after being sent, do not automatically retry: the server may have created a job. Enter DispatchOutcomeUnknown, reconcile using a validated request ID/owner ledger mechanism if supported, otherwise ask the user to inspect their jobs before retrying. The design does not assume idempotent creation.

401/login redirect pauses dispatch and offers reauthentication without capturing credentials; 403 preserves permission context; quota rejection pauses further admissions and offers explicit retry after capacity returns; 404 may indicate expiration but needs response context. Escape response text and log content. No SPL/results in analytics, URLs or console logs by default. Splunk's configured permissions and safeguards govern arbitrary SPL; this frontend is not an authorization layer.
