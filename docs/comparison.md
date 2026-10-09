# Fairness and comparison semantics

> Current execution policy (user decision): Splunk alone governs SPL authorization, index access, concurrency quotas, runtime, job retention and permitted time ranges. Caprine Clinic imposes no command allowlist, panel count, concurrency cap, time-window cap or runtime budget. All selected searches are submitted together. Historical relative picker bounds share one server anchor; All Time, open endpoints and real-time expressions retain Splunk semantics. Inline SPL bounds/macros can override picker bounds, so matching picker intervals alone do not establish equivalent effective searches. Earlier proposed app restrictions below are superseded.


This is the proposed methodology, not a claim that experiments have been performed. The selected local Splunk 10.4 Docker harness requires linux/amd64 emulation on ARM64 m2.local. Use it for functional checks; record engine/translation/resource settings and do not generalize its timings to native production. Even sequential measurements there remain emulation-conditioned observations. See [Docker testing](docker-testing.md).

## Freeze the same interval

At batch preparation, choose one anchor from Splunk server time. A proposed approach is resolving `now` once via timeparser, then sending that absolute timestamp as `now` in one request containing repeated time arguments for every distinct bound. Confirm on the target release that the returned values and user timezone semantics behave as expected. Do not use the client's clock as an unlabelled server clock substitute. Do not call `getISO('-15m')` and `getISO('now')` independently for every panel.

The [timeparser contract](https://help.splunk.com/en/splunk-enterprise/leverage-rest-apis/rest-api-reference/10.4/search-endpoints/search-endpoint-descriptions#search/timeparser) supports repeated `time` values and a supplied `now` anchor. Send the resolved absolute bounds to every job, record them in the immutable batch, and preserve the original expressions for display. For shared time, every member receives identical bounds. For overrides, use the same anchor but flag different intervals. Repeated benchmark rounds reuse the same frozen interval; “Refresh interval” creates a new batch.

Do not rewrite SPL automatically. Inline earliest/latest, subsearch time modifiers, macros, `now()`/relative-time expressions inside SPL and generated data can defeat shared dispatch bounds or alter results. Warn when such constructs are detected; only a context-aware parser/expanded-search check can establish effective semantics. Display returned effective search bounds when available and mark disagreements. Restrict controlled benchmark mode to reviewed queries without hidden moving-time behavior. Even identical event-time bounds do not freeze ingestion, late-arriving events, lookups, accelerations or knowledge objects.

## Performance observations

Display server `runDuration` separately from client timings. Client dispatch-to-terminal-observation includes queueing/network/polling and is not precise server execution duration. Differences in start acknowledgement are not reliable queue-duration measurements. Display scan/result/event counts with their server definitions; transformed result count is not raw matched event count. Different search modes, fields, sampling, preview policy, time bounds or app context make comparisons conditional.

Concurrent execution is the requested primary mode. Each search competes for search head, indexers, I/O, memory, workload pools and concurrency capacity; submitting them together does not isolate their intrinsic performance. Record submission skew, terminal observations, overlap, mode, context and known limits. No “fastest query” conclusion from one concurrent batch; label it “observed runtime in this batch.” Queueing and quota refusal remain visible, not silently removed from the story. Do not change workload priority or quotas to make runs start together.

Fresh SIDs and `cache:false` avoid reusing the same job artifact, but do not flush filesystem/OS/indexer caches, acceleration data or other caches. First-run warm-up and search order can change timing. There is no proposed supported cache flush feature. Never describe a run as “cold cache” without evidence from a controlled environment.

Preview and frequent fetching add work. Controlled mode disables previews for all members, retrieves bulk result data after timing, and uses identical polling policy. The normal interactive mode can enable previews explicitly; its timing is labelled with that policy. Details should be loaded after completion to avoid uneven instrumentation overhead.

## Repeated sequential benchmark mode: later phase

Offer this alongside concurrent mode, preserving the requested simultaneous workflow. Propose one unmeasured warm-up per search, then five measured rounds in balanced/randomized order with a recorded seed, one active Clinic job at a time. These defaults are proposed policy, not Splunk limits. Require an explicit resource budget and user start action; never repeat an arbitrary submitted search automatically.

For each search, show sample count, all observations, median, minimum/maximum and interquartile range. Small samples do not justify a significance claim; avoid p-values or confidence claims until a defensible statistical design is specified. Pair candidate/baseline within rounds where possible. Record failures, quota delays, partial finalizations and outliers; do not silently discard them. Report exclusions and incomplete rounds. One active Clinic job cannot eliminate unrelated production load. If later adding confidence intervals, specify estimator, assumptions, sample count and resampling scheme.

Metric delta is candidate minus baseline, with units. Relative delta is `100 * (candidate - baseline) / baseline`; baseline zero gives “not defined,” not infinity. Missing values disable that delta. A lower runtime is favorable only when the intended result semantics are also preserved; count equality alone does not establish that. Avoid one composite “performance score.”

## Final-result difference

MVP compares bounded final rows downloaded from existing jobs; it executes no comparison SPL. Propose a 10,000-row and 10 MiB per-run comparison budget, pages of 100 rows and limited visible mismatch samples. These are product defaults to confirm, not server guarantees. Count limits do not bound bytes; enforce both, decode incrementally where feasible and stop without crashing on a large single field. A cap hit changes completeness to Limited. Data beyond the cap stays unknown.

The default is unordered **multiset** equality over explicitly selected fields, preserving duplicate multiplicity. Stable canonical serialization uses sorted field names and type-tagged values. Keep missing, null, empty string and numeric-looking string distinct. Splunk JSON may deliver numeric-looking values as strings; do not invent stronger original types. Multi-value arrays preserve their order by default; an optional set policy requires explicit selection and is recorded. Do not discard `_time` or `_raw` automatically. User-excluded volatile fields are prominently listed.

Comparison modes:

- Unordered rows: show shared row multiplicities and A-only/B-only rows. Hashes accelerate lookup but canonical values resolve hash collisions before declaring equality.
- Keyed rows: user selects keys and compare remaining fields. Detect duplicate keys on either side and show ambiguity; do not overwrite duplicate rows in a map. MVP may refuse changed-field matching until keys are unique.
- Ordered rows: compare position only when the user selects order-sensitive semantics; paging order is not guaranteed to be a meaningful business order. Nondeterministic searches require a warning even with explicit ordering.
- Numeric tolerance: deferred; later define absolute/relative tolerance, parse policy, NaN/infinity and units per field. MVP exact equality avoids silently accepting different results.

Compare field schemas first, normalize only explicit policies, then rows. Empty complete A/B sets can be equal. A/B previews, cancelled jobs, early-finalized output or missing/truncated artifacts never qualify for complete equality. A partial comparison may show observed differences, but “no difference in fetched rows” is the strongest possible conclusion without full retrieval. Results can change between runs through ingest, lookup mutation or nondeterminism; record those limits next to the verdict.

## Detail interpretation

Component costs are a diagnostic table, not an additive timing pie chart. Display only returned cost entries and supported units. Do not fabricate per-indexer breakdowns, CPU or memory from scan counts or search.log fragments. The [native inspector](https://help.splunk.com/en/?resourceId=Splunk_Search_ViewsearchjobpropertieswiththeJobInspector) is useful for expert investigation while an artifact remains accessible; preserve its provenance and availability limits.
