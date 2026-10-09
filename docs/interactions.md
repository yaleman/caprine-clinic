# Interaction design and local wireframes

> Current execution policy (user decision): Splunk alone governs SPL authorization, index access, concurrency quotas, runtime, job retention and permitted time ranges. Caprine Clinic imposes no command allowlist, panel count, concurrency cap, time-window cap or runtime budget. All selected searches are submitted together. Historical relative picker bounds share one server anchor; All Time, open endpoints and real-time expressions retain Splunk semantics. Inline SPL bounds/macros can override picker bounds, so matching picker intervals alone do not establish equivalent effective searches. Earlier proposed app restrictions below are superseded.


These text wireframes describe layout and behavior; no numbers represent measured Splunk performance. Native Splunk navigation/theme surrounds the page. Goat humour stays in the name and optional empty-state copy, while operational labels remain conventional.

## Workspace

```text
Splunk navigation > Caprine Clinic
Compare searches
App context [caprine_clinic v]   Search mode [Smart v]
Shared time [Last 15 minutes v]  [Add search] [Run all (2)] [Cancel all]
Frozen interval: shown after preparation, with timezone and exact bounds

Search A [Baseline]                [Duplicate] [Remove]
Time: [Use shared v]
+---------------------------------------------------+----------+------+
| SPL editor: multiline, highlighted, familiar       | Time     | Run  |
+---------------------------------------------------+----------+------+
Ready / Queued / Running / Completed / Error        [Cancel] [Job v]
Events | Statistics | Performance
Result page / completion counts / on-demand details

Search B                         [Set baseline] [Duplicate] [Remove]
Time: [Use shared v]              (same editor and controls)

Compare final runs
Panel | Status | Server runtime | Results | Events | Scanned | Δ vs A
A     | ...    | ...            | ...     | ...    | ...     | baseline
B     | ...    | ...            | ...     | ...    | ...     | ...
Comparison conditions: matching interval/context/mode, data completeness
[Compare results] [View performance detail]
```

Default two panels, first baseline once it has an eligible completed run. Add creates an empty independent draft, duplicate copies draft/time settings without copying SID/history. A modest initial panel cap (proposed six) keeps the workspace usable; the admitted run cap is separate. Stack panels on smaller screens. Use Splunk UI spacing, neutral panels, Search primary button, standard table typography and normal light/dark themes. Do not rebuild Splunk navigation or imitate it with hand-drawn CSS.

Use `Bar` where its options meet the layout; compose `Input` plus public time controls if an inherited shared picker requires an explicit read-only display. Both paths must keep keyboard execution and accessible labels consistent. Editing never triggers execution. Search mode has a shared default with explicit per-panel Fast/Smart/Verbose overrides. Each run captures its effective mode; changing the default preserves overrides and prior run snapshots.

## Run one

1. Run button/keyboard submit snapshots SPL, revision, effective time, app and mode.
2. Validate syntax through Splunk and resolve relative historical picker bounds once. Accept arbitrary SPL and all Splunk time expressions; let Splunk enforce permissions and resource configuration.
3. Resolve relative time and display the frozen interval. Start one private job; show dispatch/queued/running status, SID and cancellation when known.
4. Keep the draft editable, with “Edited since run” next to results. Results always refer to the snapshot. Do not mix draft SPL with prior run metrics.
5. On terminal completion, retrieve final status and first result page. Statistics shows final rows; Events is separately fetched when requested. Performance shows available properties and opens detail.
6. Comparing this independent run to a baseline with a different frozen interval requires an explicit mismatch acknowledgement and disables benchmark ranking by default. Offer “Rerun together with shared time.”

## Run all

1. Use all nonempty panels in stable order; show eligible count and any invalid/empty panels before submission. Do not silently omit an invalid selected search.
2. Snapshot every selected panel. Shared bounds resolve once; overrides resolve against the same anchor and are labelled different-interval comparisons.
3. Submit every prepared search concurrently when the user selects Run all, preserving Splunk admission and quota responses.
4. Each panel updates independently. Global progress reports jobs completed/failed/cancelled, not an averaged fake completion percentage. A queued job stays queued.
5. Baseline can change without executing searches. The comparison table uses the selected immutable baseline run and run IDs; older standalone results are visibly outside the current batch.
6. Complete siblings remain available when one fails. Cancel all cancels owned active jobs and pending admissions, reports each outcome and never claims cancellation before acknowledgement/reconciliation.

## Detail and differences

```text
Run B vs baseline A                              [Close]
Conditions: same interval/context/mode; final data only
Performance | Results difference | Job properties | Search log

Results difference
Fields [select]  Mode [Unordered rows v]  Keys [optional]
Value comparison [Exact v]  Scope [Fetched rows only]
Rows fetched A: ... / reported ...   B: ... / reported ...
Equal rows ... | A only ... | B only ... | changed keys ...
Mismatch table: side, key/row, field, A value, B value
[Fetch next page] [Inspect A] [Inspect B]
```

No full-data equality badge until every final row is retrieved within limits and both artifacts are complete. A drilldown opens the contributing final row and run snapshot; it does not execute new SPL. Field selection and exclusion are explicit and recorded. Raw result values and logs are escaped text. A native Inspect Job link is enabled only after a target-version route check; expired/access-denied jobs have useful explanations.

## Exceptional and accessible behavior

- Cancel is separate from “stop and keep partial results”; MVP exposes cancel only. Partial server finalization has a warning and no winner badge.
- An empty final result is valid; an unavailable event stream, permission error or truncated page is not “zero events.”
- Failed dispatch shows safe server messages and an explicit retry; failed/unknown creation never retries automatically.
- Removing a baseline chooses another eligible run and announces it. Removing an active panel starts cleanup and retains any cleanup error in workspace status.
- Tab order follows panel order, editors have labels and help text, controls have visible focus, table headers sort accessibly, and status changes use restrained live announcements. Colour never carries the only meaning. Test editor keyboard traps, screen readers, long SPL, narrow windows and both themes.
