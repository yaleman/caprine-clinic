import { test } from 'node:test';
import assert from 'node:assert/strict';
import { difference, metricsFromJob, relativeDelta, stateFromJob, RunState, validateSpl, SearchMode, effectiveMode, searchTimeLabel } from '../frontend/model';
test('multiset differences preserve multiplicity and distinguish missing from null', () => {
    const d = difference([{ x: '1' }, { x: '1' }, { x: null }, {}], [{ x: '1' }, { x: 1 }, {}], ['x']);
    assert.equal(d.shared, 2); assert.equal(d.onlyA.length, 2); assert.equal(d.onlyB.length, 1);
});
test('canonical objects ignore field order; arrays remain ordered', () => {
    assert.equal(difference([{ a: { x: 1, y: 2 } }], [{ a: { y: 2, x: 1 } }], ['a']).shared, 1);
    assert.equal(difference([{ a: ['x', 'y'] }], [{ a: ['y', 'x'] }], ['a']).shared, 0);
});
test('missing metrics stay missing and baseline zero has no percentage', () => {
    assert.deepEqual(metricsFromJob({ resultCount: '0', runDuration: '', scanCount: 'NaN' }), { resultCount: 0 });
    assert.equal(relativeDelta(1, 0), undefined); assert.equal(relativeDelta(3, 2), 50);
});
test('finalized and failed jobs cannot be reported as complete', () => {
    assert.equal(stateFromJob({ dispatchState: 'DONE', isFinalized: '1' }), RunState.Partial);
    assert.equal(stateFromJob({ isDone: true, isFailed: '1' }), RunState.Failed);
});
test('SPL policy delegates commands, length, macros and inline time to Splunk', () => {
    assert.throws(() => validateSpl('   '));
    for (const s of ['index=x | outputlookup x', 'index=x `macro`', 'index=x [search x]', 'index=x earliest=-1h', '| makeresults', 'x'.repeat(21000)]) validateSpl(s);
});

test('missing marker cannot collide with an actual object value', () => {
    assert.equal(difference([{}], [{ x: { missing: true } }], ['x']).shared, 0);
});

test('mode inheritance changes without overwriting explicit overrides or run snapshots', () => {
    assert.equal(effectiveMode(undefined, SearchMode.Fast), SearchMode.Fast);
    assert.equal(effectiveMode(SearchMode.Verbose, SearchMode.Fast), SearchMode.Verbose);
    const captured = effectiveMode(undefined, SearchMode.Smart);
    assert.equal(effectiveMode(undefined, SearchMode.Verbose), SearchMode.Verbose);
    assert.equal(captured, SearchMode.Smart);
});
test('time labels preserve All Time, real-time and frozen custom ranges', () => {
    assert.equal(searchTimeLabel({ earliest: '0', latest: '', anchor: '' }), 'All Time');
    assert.equal(searchTimeLabel({ earliest: 'rt-15m', latest: 'rt', anchor: '' }), 'Real time · 15-minute window');
    assert.equal(searchTimeLabel({ earliest: 'rt-1h', latest: 'rt-5m', anchor: '' }), 'Real time · rt-1h to rt-5m');
    assert.match(searchTimeLabel({ earliest: '2026-10-09T01:00:00Z', latest: '2026-10-09T02:00:00Z', anchor: '' }), /Oct 9, 2026.*01:00:00 UTC to.*02:00:00 UTC/);
});
