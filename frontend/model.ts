export enum RunState {
    Preparing, Dispatching, Queued, Running, Finalizing, Complete, Partial,
    Cancelling, Cancelled, Failed, Unknown,
}
export enum ErrorKind { Validation, Auth, Permission, Quota, Transport, Server, Expired, UnknownDispatch }
export enum DataKind { Results, Events, Preview }
export enum SearchMode { Fast = 'fast', Smart = 'smart', Verbose = 'verbose' }
export enum TimePolicy { Shared, Override }
export enum Completeness { Pending, Complete, Limited, Partial }
export class ClinicError extends Error {
    constructor(public kind: ErrorKind, message: string) { super(message); }
}
export type Row = Record<string, unknown>;
export interface Bounds { earliest: string; latest: string; anchor: string; originalEarliest?: string; originalLatest?: string }
export interface Metrics {
    runDuration?: number; scanCount?: number; eventCount?: number;
    resultCount?: number; diskUsage?: number; doneProgress?: number;
}
export interface Run {
    id: string; batchId: string; spl: string; revision: number; bounds: Bounds; mode: SearchMode;
    sid?: string; state: RunState; metrics: Metrics; raw?: Record<string, unknown>;
    message?: string; rows: Row[]; fields: string[]; completeness: Completeness;
    submittedAt?: number; observedAt?: number;
}
export interface Panel {
    id: string; label: string; spl: string; revision: number; timePolicy: TimePolicy;
    earliest: string; latest: string; modeOverride?: SearchMode; run?: Run;
}
export const isActive = (s?: RunState) => s !== undefined && [RunState.Preparing,
    RunState.Dispatching, RunState.Queued, RunState.Running, RunState.Finalizing,
    RunState.Cancelling, RunState.Unknown].includes(s);
const yes = (x: unknown) => x === true || x === 1 || x === '1';
export function stateFromJob(c: Record<string, unknown>): RunState {
    if (yes(c.isFailed) || c.dispatchState === 'FAILED') return RunState.Failed;
    if (['USER_CANCEL', 'INTERNAL_CANCEL', 'BAD_INPUT_CANCEL', 'QUIT'].includes(String(c.dispatchState))) return RunState.Cancelled;
    if (yes(c.isFinalized)) return RunState.Partial;
    if (yes(c.isDone) || c.dispatchState === 'DONE') return RunState.Complete;
    if (c.dispatchState === 'QUEUED') return RunState.Queued;
    if (c.dispatchState === 'FINALIZING') return RunState.Finalizing;
    return RunState.Running;
}
export function metricsFromJob(c: Record<string, unknown>): Metrics {
    const result: Metrics = {};
    for (const key of ['runDuration', 'scanCount', 'eventCount', 'resultCount', 'diskUsage', 'doneProgress'] as const) {
        const v = c[key];
        if (v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0) result[key] = Number(v);
    }
    return result;
}

// Splunk parses and authorizes SPL. The app only checks for an empty draft.
export function validateSpl(spl: string): void {
    if (!spl.trim()) throw new ClinicError(ErrorKind.Validation, 'Enter a search first.');
}
const canonical = (value: unknown): string => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return `array:[${value.map(canonical).join(',')}]`;
    if (typeof value === 'object') return `object:{${Object.keys(value as Row).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Row)[k])}`).join(',')}}`;
    return `${typeof value}:${JSON.stringify(value)}`;
};
export function difference(a: Row[], b: Row[], fields: string[]): { shared: number; onlyA: Row[]; onlyB: Row[] } {
    const key = (row: Row) => canonical(fields.map(f => Object.hasOwn(row, f) ? [f, true, row[f]] : [f, false]));
    const buckets = new Map<string, Row[]>();
    for (const row of a) { const k = key(row); const bucket = buckets.get(k) ?? []; bucket.push(row); buckets.set(k, bucket); }
    let shared = 0; const onlyB: Row[] = [];
    for (const row of b) { const bucket = buckets.get(key(row)); if (bucket?.length) { bucket.pop(); shared++; } else onlyB.push(row); }
    return { shared, onlyA: [...buckets.values()].flat(), onlyB };
}
export function relativeDelta(candidate?: number, baseline?: number): number | undefined {
    return candidate === undefined || baseline === undefined || baseline === 0 ? undefined : 100 * (candidate - baseline) / baseline;
}

export const effectiveMode = (override: SearchMode | undefined, shared: SearchMode): SearchMode => override ?? shared;
export const modeLabel = (mode: SearchMode) => mode[0].toUpperCase() + mode.slice(1);
export function searchTimeLabel(bounds: Bounds): string {
    const start = bounds.originalEarliest ?? bounds.earliest;
    const end = bounds.originalLatest ?? bounds.latest;
    if ((start === '0' || !start) && (!end || end === 'now')) return 'All Time';
    if (/^rt/i.test(start) || /^rt/i.test(end)) {
        const match = /^rt-(\d+)(s|m|h|d)$/.exec(start);
        const units: Record<string, string> = { s: 'second', m: 'minute', h: 'hour', d: 'day' };
        return match && end === 'rt' ? `Real time · ${match[1]}-${units[match[2]]} window` : `Real time · ${start || 'open start'} to ${end || 'open end'}`;
    }
    const format = (value: string, empty: string) => {
        if (!value || value === '0') return empty;
        const stamp = /^\d+(?:\.\d+)?$/.test(value) ? Number(value) * 1000 : Date.parse(value);
        return Number.isFinite(stamp) ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' }).format(stamp) + ' UTC' : value;
    };
    return `${format(bounds.earliest, 'All earlier data')} to ${format(bounds.latest, 'open end')}`;
}
