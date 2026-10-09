import React, { useEffect, useRef, useState } from 'react';
import layout from '@splunk/react-page/18';
import { getUserTheme } from '@splunk/splunk-utils/themes';
import Button from '@splunk/react-ui/Button';
import Heading from '@splunk/react-ui/Heading';
import Table from '@splunk/react-ui/Table';
import { Bar } from '@splunk/react-search';
import TimeRangeDropdown from '@splunk/react-time-range/Dropdown';
import TimeRangeConnector from '@splunk/react-time-range/SplunkwebConnector';
import * as api from './api';
import { Bounds, ClinicError, Completeness, DataKind, difference, ErrorKind, isActive, metricsFromJob,
    Panel, relativeDelta, Row, Run, RunState, stateFromJob, TimePolicy, validateSpl, SearchMode, effectiveMode, modeLabel, searchTimeLabel } from './model';
import './style.css';

const fmt = (v?: number, unit = '') => v === undefined ? 'Unavailable' : `${v.toLocaleString(undefined, { maximumFractionDigits: 3 })}${unit}`;
const text = (v: unknown) => v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v);
const seed = (label: string, spl: string): Panel => ({ id: crypto.randomUUID(), label, spl, revision: 0, timePolicy: TimePolicy.Shared, earliest: '-15m', latest: 'now' });
const initial = [seed('Search A', 'search index=caprine_clinic_test | stats count by herd'),
    seed('Search B', 'search index=caprine_clinic_test | stats count by herd | sort herd')];
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function Rows({ rows, fields, events = false }: { rows: Row[]; fields: string[]; events?: boolean }) {
    const columns = events ? [...['_time', '_raw'].filter(f => fields.includes(f)), ...fields.filter(f => f !== '_time' && f !== '_raw')] : fields;
    const width = (f: string) => f === '_raw' ? 640 : f === '_time' ? 220 : f === 'component' ? 400 : 160;
    return <div className="table-scroll" tabIndex={0} aria-label={events ? "Event results" : "Result table"}><Table stripeRows>
        <Table.Head>{columns.map(f => <Table.HeadCell key={f} width={width(f)}><span className="cell-heading" style={{ width: width(f) }}>{f}</span></Table.HeadCell>)}</Table.Head>
        <Table.Body>{rows.map((row, i) => <Table.Row key={i}>{columns.map(f => <Table.Cell key={f}><div className={f === '_raw' ? 'cell-value raw-value' : 'cell-value'} style={{ width: width(f) }}>{text(row[f])}</div></Table.Cell>)}</Table.Row>)}</Table.Body>
    </Table></div>;
}
function Detail({ run }: { run: Run }) {
    const [kind, setKind] = useState(DataKind.Results); const [data, setData] = useState({ rows: run.rows, fields: run.fields });
    const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [offset, setOffset] = useState(0);
    useEffect(() => { setKind(DataKind.Results); setData({ rows: run.rows, fields: run.fields }); setOffset(0); setError(''); }, [run.id]);
    async function load(nextKind: DataKind, nextOffset = 0) {
        if (!run.sid) return; setBusy(true); setError('');
        try { const d = await api.page(run.sid, nextKind, nextOffset); setData(d); setOffset(nextOffset); setKind(nextKind); }
        catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    }
    const cost = (run.raw?.performance ?? {}) as Record<string, Record<string, unknown>>;
    return <div className="detail">
        <Heading level={3}>Results</Heading>
        <p className="muted">SID <code>{run.sid}</code></p>
        <div className="toolbar"><Button disabled={busy} onClick={() => load(DataKind.Results)}>Statistics</Button>
            <Button disabled={busy} onClick={() => load(DataKind.Events)}>Events</Button>
            <Button disabled={busy || !isActive(run.state)} onClick={() => load(DataKind.Preview)}>Preview</Button>
            {run.sid && <a href={api.inspectorURL(run.sid)} target="_blank" rel="noreferrer">Inspect job</a>}
        </div>
        <p className="muted">{DataKind[kind]} · {data.rows.length ? `rows ${offset + 1}–${offset + data.rows.length}` : '0 rows'}</p>
        {error && <p className="error" role="alert">{error}</p>}
        <Rows rows={data.rows} fields={data.fields} events={kind === DataKind.Events} />
        <div className="toolbar"><Button disabled={busy || offset === 0} onClick={() => load(kind, Math.max(0, offset - 100))}>Previous page</Button>
            <Button disabled={busy || data.rows.length < 100} onClick={() => load(kind, offset + 100)}>Next page</Button></div>
        <div className="execution-costs"><Heading level={3}>Execution Costs</Heading></div>

        {Object.keys(cost).length ? <Rows fields={['component', 'duration_secs', 'invocations', 'input_count', 'output_count']}
            rows={Object.entries(cost).map(([component, v]) => ({ component, ...v }))} /> : <p>No component costs returned for this job.</p>}
        <details><summary>Job properties and messages</summary><pre>{JSON.stringify(run.raw, null, 2)}</pre></details>
    </div>;
}
function App() {
    const [panels, setPanels] = useState(initial); const panelsRef = useRef(panels); panelsRef.current = panels;
    const [sharedMode, setSharedMode] = useState(SearchMode.Smart);
    const [earliest, setEarliest] = useState('-15m'); const [latest, setLatest] = useState('now');
    const [baseline, setBaseline] = useState(initial[0].id); const [error, setError] = useState('');
    const [preparing, setPreparing] = useState(false); const preparingRef = useRef(false);
    const [detail, setDetail] = useState<string>(); const [candidate, setCandidate] = useState(initial[1].id);
    const [fieldsText, setFieldsText] = useState(''); const [diff, setDiff] = useState<ReturnType<typeof difference>>();
    const [diffScope, setDiffScope] = useState(''); const [fetching, setFetching] = useState(false);
    const cancellations = useRef(new Set<string>()); const owned = useRef(new Map<string, string>());
    const aborts = useRef(new Map<string, AbortController>());
    const mutation = (id: string, change: Partial<Panel>) => setPanels(prev => prev.map(p => p.id === id ? { ...p, ...change } : p));
    const updateRun = (panelId: string, runId: string, update: Partial<Run>) => setPanels(prev => prev.map(p => p.id === panelId && p.run?.id === runId ? { ...p, run: { ...p.run, ...update } } : p));
    const base = panels.find(p => p.id === baseline)?.run;
    const other = panels.find(p => p.id === candidate)?.run;
    useEffect(() => { setDiff(undefined); }, [baseline, candidate, fieldsText, base?.id, other?.id]);
    async function cancel(panel: Panel) {
        const run = panel.run; if (!run || !isActive(run.state)) return;
        cancellations.current.add(run.id); updateRun(panel.id, run.id, { state: RunState.Cancelling });
        if (run.sid) {
            try { await api.cancelJob(run.sid); aborts.current.get(run.id)?.abort(); owned.current.delete(run.id);
                updateRun(panel.id, run.id, { state: RunState.Cancelled, message: 'Cancellation acknowledged by Splunk.' }); }
            catch (e) { updateRun(panel.id, run.id, { message: `Cancellation failed: ${(e as Error).message}. The server job may still be active.` }); }
        }
    }
    async function execute(panel: Panel, run: Run) {
        const controller = new AbortController(); aborts.current.set(run.id, controller);
        try {
            if (cancellations.current.has(run.id)) { updateRun(panel.id, run.id, { state: RunState.Cancelled }); return; }
            const submittedAt = performance.now(); updateRun(panel.id, run.id, { state: RunState.Dispatching, submittedAt });
            let sid: string;
            try { const d = await api.createJob(run.spl, run.bounds, run.mode); if (!d.sid) throw new Error('No SID returned'); sid = d.sid; }
            catch (e) {
                if (!(e instanceof ClinicError) || e.kind === ErrorKind.Transport) { updateRun(panel.id, run.id, { state: RunState.Unknown, message: 'Dispatch acknowledgement was lost. Inspect your Splunk jobs before retrying; no automatic retry was made.' }); return; }
                throw e;
            }
            owned.current.set(run.id, sid); updateRun(panel.id, run.id, { sid, state: RunState.Queued });
            if (cancellations.current.has(run.id)) { await api.cancelJob(sid); owned.current.delete(run.id); updateRun(panel.id, run.id, { state: RunState.Cancelled }); return; }
            let readFailures = 0;
            while (!controller.signal.aborted) {
                let raw: Record<string, unknown>;
                try { raw = await api.status(sid, controller.signal); readFailures = 0; }
                catch (e) {
                    if (controller.signal.aborted) return;
                    if (++readFailures <= 3 && e instanceof ClinicError && e.kind === ErrorKind.Transport) { updateRun(panel.id, run.id, { message: 'Connection interrupted; job state is unconfirmed.' }); await sleep(1500 * readFailures); continue; }
                    // Keep the SID so cancellation remains possible after a read failure.
                    updateRun(panel.id, run.id, { state: RunState.Unknown, message: (e as Error).message }); return;
                }
                const state = stateFromJob(raw); const metrics = metricsFromJob(raw);
                const messages = raw.messages as { text?: string }[] | undefined;
                updateRun(panel.id, run.id, { state, raw, metrics, message: Array.isArray(messages) ? messages.map(m => m.text).join(' ') : undefined });
                if ([RunState.Complete, RunState.Partial, RunState.Cancelled, RunState.Failed].includes(state)) {
                    owned.current.delete(run.id);
                    if (state === RunState.Complete || state === RunState.Partial) {
                        let d;
                        try { d = await api.page(sid, DataKind.Results); }
                        catch (e) { updateRun(panel.id, run.id, { message: `Results unavailable: ${(e as Error).message}`, completeness: Completeness.Pending }); return; }
                        const complete = state === RunState.Complete && !d.preview && metrics.resultCount !== undefined && d.rows.length === metrics.resultCount;
                        updateRun(panel.id, run.id, { rows: d.rows, fields: d.fields,
                            completeness: state === RunState.Partial ? Completeness.Partial : complete ? Completeness.Complete : Completeness.Limited, observedAt: performance.now() });
                    }
                    return;
                }
                await sleep(document.hidden ? 3000 : 1000);
            }
        } catch (e) { if (!controller.signal.aborted) updateRun(panel.id, run.id, { state: owned.current.has(run.id) ? RunState.Unknown : RunState.Failed, message: (e as Error).message }); }
        finally { aborts.current.delete(run.id); }
    }
    async function launch(selection: Panel[]) {
        if (preparingRef.current) return;
        if (selection.some(p => isActive(p.run?.state))) { setError('Cancel the selected active job before running it again.'); return; }
        preparingRef.current = true; setPreparing(true); setError(''); setDiff(undefined);
        let prepared: { panel: Panel; run: Run }[] = [];
        try {
            selection.forEach(p => validateSpl(p.spl));
            const pairs = selection.map(p => p.timePolicy === TimePolicy.Shared ? { earliest, latest } : { earliest: p.earliest, latest: p.latest });
            const bounds = await api.resolveTimes(pairs);
            await Promise.all(selection.map(p => api.parse(p.spl)));
            const batchId = crypto.randomUUID();
            prepared = selection.map((panel, i) => ({ panel, run: { id: crypto.randomUUID(), batchId, spl: panel.spl,
                revision: panel.revision, bounds: bounds[i], mode: effectiveMode(panel.modeOverride, sharedMode), state: RunState.Preparing, metrics: {}, rows: [], fields: [], completeness: Completeness.Pending } }));
            for (const { panel, run } of prepared) { mutation(panel.id, { run }); }
            // Independent creation requests are submitted together after every search is prepared.
            void Promise.allSettled(prepared.map(({ panel, run }) => execute(panel, run)));
        } catch (e) { setError((e as Error).message); }
        finally { preparingRef.current = false; setPreparing(false); }
    }
    async function fetchAll(run: Run, panelId: string): Promise<Run> {
        if (run.completeness === Completeness.Complete) return run;
        if (!run.sid || run.state !== RunState.Complete) throw new Error('Only completed jobs can enter final-result comparison.');
        let rows: Row[] = []; let fields: string[] = [];
        for (let offset = 0; ; offset += 100) {
            const d = await api.page(run.sid, DataKind.Results, offset);
            if (d.preview) throw new Error('Splunk returned provisional data; comparison stopped.');
            rows.push(...d.rows); fields = d.fields;
            if (d.rows.length < 100 || rows.length === run.metrics.resultCount) break;
        }
        const completeness = run.metrics.resultCount !== undefined && rows.length === run.metrics.resultCount ? Completeness.Complete : Completeness.Limited;
        const updated = { ...run, rows, fields, completeness }; updateRun(panelId, run.id, updated); return updated;
    }
    async function compare() {
        if (!base || !other || baseline === candidate) { setError('Select two different completed runs.'); return; }
        setFetching(true); setError('');
        try {
            const [a, b] = await Promise.all([fetchAll(base, baseline), fetchAll(other, candidate)]);
            const fields = fieldsText.trim() ? fieldsText.split(',').map(s => s.trim()).filter(Boolean) : [...new Set([...a.fields, ...b.fields])].sort();
            setDiff(difference(a.rows, b.rows, fields));
            const complete = a.completeness === Completeness.Complete && b.completeness === Completeness.Complete;
            const sameTime = a.bounds.earliest === b.bounds.earliest && a.bounds.latest === b.bounds.latest;
            setDiffScope(`${complete ? 'Complete final rows' : 'Fetched rows only — full equality is unknown'} · ${sameTime ? 'same interval' : 'different intervals'} · ${fields.length} fields · exact unordered multiset comparison`);
        } catch (e) { setError((e as Error).message); } finally { setFetching(false); }
    }
    return <>
        <main className="clinic-workspace"><div className="title"><div><Heading level={1}>Compare searches</Heading></div></div>
        <div className="workspace-toolbar">
            <div><label>Shared time range</label><TimeRangeConnector presetsTransform={presets => presets}><TimeRangeDropdown earliest={earliest} latest={latest} onChange={(_e: unknown, value: { earliest: string; latest: string }) => { setEarliest(value.earliest); setLatest(value.latest); }} /></TimeRangeConnector></div>
            <div><label htmlFor="shared-mode">Search mode</label><select id="shared-mode" aria-label="Shared search mode" value={sharedMode} onChange={e => setSharedMode(e.target.value as SearchMode)}>{Object.values(SearchMode).map(mode => <option key={mode} value={mode}>{modeLabel(mode)}</option>)}</select></div>
            <span className="toolbar-space" />
            <Button disabled={preparing} onClick={() => setPanels([...panels, seed(`Search ${String.fromCharCode(65 + panels.length)}`, '')])}>Add search</Button>
            <Button appearance="primary" disabled={preparing || panels.some(p => isActive(p.run?.state))} onClick={() => launch(panels)}>{preparing ? 'Preparing…' : `Run all (${panels.length})`}</Button>
            <Button disabled={!panels.some(p => isActive(p.run?.state))} onClick={() => { for (const p of panelsRef.current) void cancel(p); }}>Cancel all</Button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="panels">{panels.map(p => <section className="panel" key={p.id}>
            <div className="panel-heading"><Heading level={2}>{p.label}</Heading>{baseline === p.id && <span className="badge">Baseline</span>}
                <div className="panel-controls">
            <label className="time-policy"><input type="checkbox" checked={p.timePolicy === TimePolicy.Shared} onChange={e => mutation(p.id, { timePolicy: e.target.checked ? TimePolicy.Shared : TimePolicy.Override })} /> Use shared time range</label>
            <label className="mode-policy">Search mode <select aria-label={`${p.label} search mode`} value={p.modeOverride ?? ''} onChange={e => mutation(p.id, { modeOverride: e.target.value ? e.target.value as SearchMode : undefined })}>
                <option value="">Shared ({modeLabel(sharedMode)})</option>{Object.values(SearchMode).map(mode => <option key={mode} value={mode}>{modeLabel(mode)}</option>)}</select></label>
                </div>
                <div className="toolbar"><Button disabled={baseline === p.id} onClick={() => setBaseline(p.id)}>Set baseline</Button>
                <Button disabled={preparing} onClick={() => setPanels([...panels, { ...p, id: crypto.randomUUID(), label: `${p.label} copy`, run: undefined }])}>Duplicate</Button>
                <Button disabled={panels.length <= 1 || isActive(p.run?.state)} onClick={() => { setPanels(panels.filter(x => x.id !== p.id)); if (baseline === p.id) setBaseline(panels.find(x => x.id !== p.id)!.id); }}>Remove</Button></div></div>
            <div aria-label={`${p.label} search editor`}><Bar options={{ search: p.spl, earliest: p.timePolicy === TimePolicy.Shared ? earliest : p.earliest, latest: p.timePolicy === TimePolicy.Shared ? latest : p.latest,
                placeholder: 'Enter an SPL search', minLines: 2, maxLines: 8 }}
                onOptionsChange={o => { if (typeof o.search === 'string') mutation(p.id, { spl: o.search, revision: p.revision + 1 });
                    if (typeof o.earliest === 'string') { if (p.timePolicy === TimePolicy.Shared) { setEarliest(o.earliest); setLatest(String(o.latest)); } else mutation(p.id, { earliest: o.earliest, latest: String(o.latest) }); } }}
                onEventTrigger={e => { if (e === 'submit') void launch([p]); }} /></div>
            <div className="job-line" aria-live="polite"><strong>{p.run ? RunState[p.run.state] : 'Ready'}</strong>
                {p.run && (p.revision !== p.run.revision || effectiveMode(p.modeOverride, sharedMode) !== p.run.mode || (p.timePolicy === TimePolicy.Shared ? earliest : p.earliest) !== p.run.bounds.originalEarliest || (p.timePolicy === TimePolicy.Shared ? latest : p.latest) !== p.run.bounds.originalLatest) && <span className="badge">Edited since run</span>}
                {p.run && <span>Runtime {fmt(p.run.metrics.runDuration, ' s')} · Results {fmt(p.run.metrics.resultCount)} · {modeLabel(p.run.mode)} · {searchTimeLabel(p.run.bounds)}</span>}
                <Button disabled={!isActive(p.run?.state)} onClick={() => cancel(p)}>Cancel</Button>
                <Button disabled={!p.run?.sid} onClick={() => setDetail(detail === p.id ? undefined : p.id)}>{detail === p.id ? 'Hide details' : 'Job details'}</Button></div>
            {p.run?.message && <p className="error">{p.run.message}</p>}
            {detail === p.id && p.run && <Detail run={p.run} />}
        </section>)}</div>
        <section className="comparison"><Heading level={2}>Compare final runs</Heading>
            <div className="table-scroll"><Table stripeRows style={{ minWidth: 1100 }}><Table.Head>{['Search', 'Status', 'Runtime', 'Results', 'Events', 'Scanned', 'Disk', 'Runtime Δ vs baseline'].map(f => <Table.HeadCell key={f}>{f}</Table.HeadCell>)}</Table.Head>
            <Table.Body>{panels.map(p => { const r = p.run; const eligible = r?.state === RunState.Complete && base?.state === RunState.Complete && r.bounds.earliest === base.bounds.earliest && r.bounds.latest === base.bounds.latest && r.batchId === base.batchId;
                const delta = eligible ? relativeDelta(r.metrics.runDuration, base.metrics.runDuration) : undefined;
                return <Table.Row key={p.id}><Table.Cell>{p.label}{p.id === baseline ? ' · baseline' : ''}</Table.Cell><Table.Cell>{r ? RunState[r.state] : 'Ready'}</Table.Cell>
                <Table.Cell>{fmt(r?.metrics.runDuration, ' s')}</Table.Cell><Table.Cell>{fmt(r?.metrics.resultCount)}</Table.Cell><Table.Cell>{fmt(r?.metrics.eventCount)}</Table.Cell>
                <Table.Cell>{fmt(r?.metrics.scanCount)}</Table.Cell><Table.Cell>{fmt(r?.metrics.diskUsage, ' B')}</Table.Cell><Table.Cell>{p.id === baseline ? '—' : delta === undefined ? 'Not comparable' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`}</Table.Cell></Table.Row>; })}</Table.Body></Table></div>
            <div className="toolbar"><label>Candidate <select aria-label="Candidate" value={candidate} onChange={e => setCandidate(e.target.value)}>{panels.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
                <label>Fields <input aria-label="Comparison fields" placeholder="All fields, or comma-separated names" value={fieldsText} onChange={e => setFieldsText(e.target.value)} /></label>
                <Button disabled={fetching || !base || !other || base.state !== RunState.Complete || other.state !== RunState.Complete} onClick={compare}>{fetching ? 'Fetching rows…' : 'Compare results'}</Button></div>
            {diff && <div className="diff"><p>{diffScope}</p><strong>Shared: {diff.shared} · Baseline only: {diff.onlyA.length} · Candidate only: {diff.onlyB.length}</strong>
                {diff.onlyA.length + diff.onlyB.length === 0 && <p>{diffScope.startsWith('Complete') ? 'Equal under the selected field policy.' : 'No difference in fetched rows; full equality is unknown.'}</p>}
                <Rows fields={['side', 'row']} rows={[...diff.onlyA.slice(0, 25).map(row => ({ side: 'Baseline only', row })), ...diff.onlyB.slice(0, 25).map(row => ({ side: 'Candidate only', row }))]} />
                <p className="muted">At most 25 mismatches per side shown. Excluded fields affect equality.</p></div>}
        </section>

        </main>
    </>;
}

getUserTheme().then(theme => layout(<App />, { theme, pageTitle: 'Caprine Clinic', themeFamily: 'enterprise', themeDensity: 'comfortable' })).catch(error => { const message = document.createElement('p'); message.textContent = `Could not load Splunk page: ${error.message}`; document.body.appendChild(message); });
