import { createRESTURL, createURL } from '@splunk/splunk-utils/url';
import { addLeadingSearchCommand } from '@splunk/splunk-utils/search';
import { getDefaultFetchInit } from '@splunk/splunk-utils/fetch';
import { username } from '@splunk/splunk-utils/config';
import { Bounds, ClinicError, DataKind, ErrorKind, Row, SearchMode } from './model';
export const APP = 'caprine_clinic';
type Value = string | string[];
async function request(path: string, params: Record<string, Value> = {}, method = 'GET', signal?: AbortSignal): Promise<any> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ output_mode: 'json', ...params })) {
        for (const v of Array.isArray(value) ? value : [value]) query.append(key, v);
    }
    const base = createRESTURL(path, { app: APP, owner: username });
    const headers = new Headers(getDefaultFetchInit().headers);
    if (method === 'POST') headers.set('Content-Type', 'application/x-www-form-urlencoded');
    let response: Response;
    try { response = await fetch(method === 'GET' ? `${base}?${query}` : base,
        { ...getDefaultFetchInit(), headers, method, body: method === 'POST' ? query.toString() : undefined, signal }); }
    catch (e) { if (signal?.aborted) throw e; throw new ClinicError(ErrorKind.Transport, 'Connection interrupted. The job may still be running; no automatic retry was made.'); }
    if (!response.ok || response.redirected) {
        const kind = response.status === 401 || response.redirected ? ErrorKind.Auth : response.status === 403 ? ErrorKind.Permission : response.status === 404 ? ErrorKind.Expired : ErrorKind.Server;
        let message = `Splunk request failed (${response.status}).`;
        try { const d = await response.json(); message = d.messages?.map((m: any) => m.text).join(' ') || message; } catch {}
        throw new ClinicError(/quota|concurren/i.test(message) ? ErrorKind.Quota : kind, message);
    }
    try { return await response.json(); } catch { throw new ClinicError(ErrorKind.Auth, 'Expected a Splunk JSON response. Reload to restore your session.'); }
}
export async function resolveTimes(pairs: { earliest: string; latest: string }[]): Promise<Bounds[]> {
    const now = await request('search/timeparser', { time: 'now' });
    const anchor = now.now as string;
    if (!anchor) throw new ClinicError(ErrorKind.Validation, 'Splunk did not return a server time anchor.');
    // Freeze relative historical expressions together. All Time, open endpoints and
    // real-time expressions retain Splunk's own semantics rather than being rejected.
    const freeze = (t: string) => !!t.trim() && t !== '0' && !/^rt/i.test(t);
    const times = [...new Set(pairs.flatMap(p => [p.earliest, p.latest]).filter(freeze))];
    const parsed = times.length ? await request('search/timeparser', { time: times, now: anchor }) : {};
    return pairs.map(p => ({
        earliest: freeze(p.earliest) ? String(parsed[p.earliest] ?? p.earliest) : p.earliest,
        latest: freeze(p.latest) ? String(parsed[p.latest] ?? p.latest) : p.latest,
        anchor, originalEarliest: p.earliest, originalLatest: p.latest,
    }));
}
export const parse = (search: string) => request('search/v2/parser', { q: addLeadingSearchCommand(search), parse_only: 'true' }, 'POST');
export const createJob = (search: string, bounds: Bounds, mode: SearchMode) => request('search/jobs', {
    search: addLeadingSearchCommand(search), earliest_time: bounds.earliest, latest_time: bounds.latest,
    exec_mode: 'normal', adhoc_search_level: mode,
    status_buckets: '0', rf: '*',
}, 'POST');
export const status = async (sid: string, signal?: AbortSignal) => {
    const data = await request(`search/jobs/${encodeURIComponent(sid)}`, {}, 'GET', signal);
    if (!data.entry?.[0]?.content) throw new ClinicError(ErrorKind.Expired, 'Job metadata is no longer available.');
    return data.entry[0].content as Record<string, unknown>;
};
export const cancelJob = (sid: string) => request(`search/jobs/${encodeURIComponent(sid)}/control`, { action: 'cancel' }, 'POST');
export async function page(sid: string, kind: DataKind, offset = 0): Promise<{ rows: Row[]; fields: string[]; preview: boolean }> {
    const endpoint = kind === DataKind.Events ? 'events' : kind === DataKind.Preview ? 'results_preview' : 'results';
    const d = await request(`search/v2/jobs/${encodeURIComponent(sid)}/${endpoint}`, { count: '100', offset: String(offset) });
    return { rows: d.results ?? [], fields: (d.fields ?? []).map((f: any) => f.name), preview: !!d.preview };
}
export const inspectorURL = (sid: string) => createURL(`manager/${APP}/job_inspector`, { sid });
export const searchURL = () => createURL('app/search/search');
export const homeURL = () => createURL('app/launcher/home');
