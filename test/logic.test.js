const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../docs/logic.js');

const song = { title: 'Dancing Queen', artist: 'ABBA' };
const entry = (over = {}) => ({ id: 'e1', ts: '2026-10-01T08:30:00.000Z', song, part: '', where: '', thinking: '', feel: ['calm'], before: 6, says: '', other: '', helped: ['sang'], after: 3, ...over });
const db = (entries = [], thoughts = []) => ({ v: 1, entries, thoughts });

test('songKey: itunes id wins, otherwise title and artist, case-insensitive', () => {
  assert.equal(L.songKey({ id: 42, title: 'x' }), 'it42');
  assert.equal(L.songKey({ title: ' Hello ', artist: 'Adele' }), L.songKey({ title: 'hello', artist: 'ADELE' }));
  assert.equal(L.songKey({ title: 'A' }), 'm:a|');
});

test('httpsUrl drops anything but https', () => {
  assert.equal(L.httpsUrl('javascript:alert(1)'), '');
  assert.equal(L.httpsUrl('http://a.example/x'), '');
  assert.equal(L.httpsUrl('data:text/html,hi'), '');
  assert.equal(L.httpsUrl('not a url'), '');
  assert.equal(L.httpsUrl('https://a.example/x.jpg'), 'https://a.example/x.jpg');
});

test('normalizeEntry rejects rows without a song or a valid date', () => {
  assert.equal(L.normalizeEntry(null), null);
  assert.equal(L.normalizeEntry({ ts: '2026-10-01', song: {} }), null);
  assert.equal(L.normalizeEntry({ ts: 'nope', song }), null);
  assert.equal(L.normalizeEntry('x'), null);
});

test('normalizeEntry clamps numbers, trims lists, strips unsafe urls, keeps the sample flag', () => {
  const e = L.normalizeEntry({ id: 7, ts: '2026-10-01T00:00:00Z', song: { ...song, url: 'javascript:1', art: 'https://x.example/a.jpg' }, before: 99, after: -4, feel: ['sad', 5, 'x'.repeat(50)], helped: 'walk', sample: true });
  assert.equal(e.id, '7');
  assert.equal(e.before, 10);
  assert.equal(e.after, 0);
  assert.deepEqual(e.feel, ['sad']);
  assert.deepEqual(e.helped, []);
  assert.equal(e.song.url, undefined);
  assert.equal(e.song.art, 'https://x.example/a.jpg');
  assert.equal(e.sample, true);
});

test('normalizeEntry gives a stable id when none is supplied', () => {
  const a = L.normalizeEntry({ ts: '2026-10-01T00:00:00Z', song }), b = L.normalizeEntry({ ts: '2026-10-01T00:00:00Z', song });
  assert.equal(a.id, b.id);
  assert.ok(a.id.length > 1);
});

test('normalizeDb survives garbage and drops duplicates', () => {
  assert.deepEqual(L.normalizeDb(null), L.emptyDb());
  assert.deepEqual(L.normalizeDb('x'), L.emptyDb());
  assert.deepEqual(L.normalizeDb({ entries: 5, thoughts: {} }), L.emptyDb());
  const d = L.normalizeDb({ entries: [entry(), entry(), { bad: 1 }], thoughts: [{ id: 't', key: 'k', ts: '2026-10-01', text: ' hi ' }, { id: 't2', key: 'k', ts: '2026-10-01', text: '  ' }] });
  assert.equal(d.entries.length, 1);
  assert.equal(d.thoughts.length, 1);
  assert.equal(d.thoughts[0].text, 'hi');
});

test('prototype backups load: no version field, string ids', () => {
  const d = L.normalizeDb({ entries: [{ id: 'abc', ts: '2026-09-30T10:00:00.000Z', song: { id: 5, title: 'T', artist: 'A', art: 'https://x.example/100x100bb.jpg', preview: 'https://x.example/p.m4a', url: 'https://x.example/s' }, part: 'p', feel: [], before: 4, helped: [], after: null }], thoughts: [] });
  assert.equal(d.entries.length, 1);
  assert.equal(d.entries[0].after, null);
});

test('mergeImport adds only what is new and reports bad files', () => {
  const d = db([entry()]);
  const r = L.mergeImport(d, { entries: [entry(), entry({ id: 'e2', ts: '2026-10-02T09:00:00Z' }), { junk: true }], thoughts: [] });
  assert.deepEqual([r.entries, r.thoughts, r.rejected, r.bad], [1, 0, 1, false]);
  assert.equal(d.entries.length, 2);
  assert.equal(L.mergeImport(d, { hello: 'world' }).bad, true);
  assert.equal(L.mergeImport(d, null).bad, true);
  assert.equal(L.mergeImport(d, [1, 2]).bad, true);
  assert.equal(L.mergeImport(d, { entries: [], thoughts: [] }).bad, false);
});

test('deleteEntry removes the log and orphaned thoughts, keeps thoughts while logs remain', () => {
  const k = L.songKey(song);
  const d = db([entry({ id: 'a' }), entry({ id: 'b', ts: '2026-10-02T00:00:00Z' })], [{ id: 't', key: k, ts: '2026-10-03T00:00:00Z', text: 'x' }]);
  assert.equal(L.deleteEntry(d, 'a'), true);
  assert.equal(d.thoughts.length, 1);
  assert.equal(L.deleteEntry(d, 'b'), true);
  assert.equal(d.thoughts.length, 0);
  assert.equal(L.deleteEntry(d, 'zzz'), false);
});

test('deleteThought', () => {
  const d = db([], [{ id: 't', key: 'k', ts: '2026-10-03T00:00:00Z', text: 'x' }]);
  assert.equal(L.deleteThought(d, 't'), true);
  assert.equal(L.deleteThought(d, 't'), false);
});

test('songIndex groups by song, newest first, entries oldest first, keeps artwork', () => {
  const other = { title: 'Hotel California', artist: 'Eagles' };
  const d = db([
    entry({ id: 'a', ts: '2026-10-01T08:00:00Z' }),
    entry({ id: 'b', ts: '2026-10-05T08:00:00Z', song: other }),
    entry({ id: 'c', ts: '2026-10-03T08:00:00Z', song: { ...song, art: 'https://x.example/a.jpg' } })
  ]);
  const idx = L.songIndex(d);
  assert.deepEqual(idx.map(g => g.song.title), ['Hotel California', 'Dancing Queen']);
  assert.deepEqual(idx[1].entries.map(e => e.id), ['a', 'c']);
  assert.equal(idx[1].song.art, 'https://x.example/a.jpg');
});

test('songStats: average loudness and fade over logs where something helped', () => {
  const d = db([
    entry({ id: 'a', before: 8, after: 2, helped: ['through'] }),
    entry({ id: 'b', ts: '2026-10-02T00:00:00Z', before: 4, after: 4, helped: [] }),
    entry({ id: 'c', ts: '2026-10-03T00:00:00Z', before: 6, after: 4, helped: ['walk'] })
  ]);
  const s = L.songStats(L.songIndex(d)[0]);
  assert.equal(s.n, 3);
  assert.equal(s.avg, 6);
  assert.equal(s.drop, 4);
  const none = L.songStats(L.songIndex(db([entry({ helped: [] })]))[0]);
  assert.equal(none.drop, null);
});

test('dayCounts: one bucket per local day, oldest first, counts land on the right day', () => {
  const now = new Date(2026, 9, 13, 15, 0).getTime();
  const at = (y, m, d, h) => new Date(y, m, d, h).toISOString();
  const es = [entry({ ts: at(2026, 9, 13, 9) }), entry({ id: 'b', ts: at(2026, 9, 13, 23) }), entry({ id: 'c', ts: at(2026, 9, 11, 1) })];
  const s = L.dayCounts(es, 5, now);
  assert.equal(s.length, 5);
  assert.deepEqual(s.map(x => x.n), [0, 0, 1, 0, 2]);
  assert.equal(s[4].key, '2026-10-13');
  const all = L.dayCounts(es, 0, now);
  assert.equal(all.length, 14);
});

test('filterRange keeps entries inside the window', () => {
  const now = Date.parse('2026-10-13T12:00:00Z');
  const es = [entry({ id: 'a', ts: '2026-10-12T00:00:00Z' }), entry({ id: 'b', ts: '2026-06-01T00:00:00Z' })];
  assert.equal(L.filterRange(es, 30, now).length, 1);
  assert.equal(L.filterRange(es, 0, now).length, 2);
});

test('heatGrid and heatLevel', () => {
  const d = new Date(2026, 9, 13, 8, 15);
  const { grid, max } = L.heatGrid([entry({ ts: d.toISOString() }), entry({ id: 'b', ts: d.toISOString() })]);
  assert.equal(grid[d.getDay()][8], 2);
  assert.equal(max, 2);
  assert.equal(L.heatLevel(0, 2), 0);
  assert.equal(L.heatLevel(2, 2), 5);
  assert.equal(L.heatLevel(1, 100), 1);
  assert.equal(L.heatGrid([]).max, 1);
});

test('topSongs, helpStats, feelCounts', () => {
  const es = [
    entry({ id: 'a', before: 8, after: 2, helped: ['through'], feel: ['sad', 'calm'] }),
    entry({ id: 'b', before: 6, after: 4, helped: ['through', 'walk'], feel: ['sad'] }),
    entry({ id: 'c', song: { title: 'Z', artist: '' }, before: 5, after: null, helped: ['walk'], feel: [] })
  ];
  const top = L.topSongs(es);
  assert.equal(top[0].v, 2);
  assert.equal(top[0].label, 'Dancing Queen · ABBA');
  assert.equal(top[1].label, 'Z');
  const h = L.helpStats(es);
  assert.deepEqual(h.find(x => x.key === 'through'), { key: 'through', v: 4, n: 2 });
  assert.deepEqual(h.find(x => x.key === 'walk'), { key: 'walk', v: 1, n: 2 });
  assert.deepEqual(L.feelCounts(es)[0], { key: 'sad', v: 2 });
});

test('csvCell quotes, doubles quotes and defuses formulas', () => {
  assert.equal(L.csvCell('a"b'), '"a""b"');
  assert.equal(L.csvCell('=SUM(A1)'), '"\'=SUM(A1)"');
  assert.equal(L.csvCell('+1'), '"\'+1"');
  assert.equal(L.csvCell('-2'), '"\'-2"');
  assert.equal(L.csvCell('@x'), '"\'@x"');
  assert.equal(L.csvCell(null), '""');
  assert.equal(L.csvCell(5), '"5"');
});

test('csv: header, one row per log, thoughts carry the song title, commas and newlines stay inside quotes', () => {
  const k = L.songKey(song);
  const d = db([entry({ part: 'line, with comma\nand newline' })], [{ id: 't', key: k, ts: '2026-10-03T00:00:00Z', text: 'later' }]);
  const out = L.csv(d);
  const lines = out.split('\r\n');
  assert.ok(lines[0].startsWith('date,title,artist'));
  assert.equal(lines.length, 3);
  assert.ok(out.includes('"line, with comma\nand newline"'));
  assert.ok(out.includes('"thought: later"'));
  assert.ok(out.includes('"Dancing Queen"'));
});

test('sampleEntries is repeatable with a seed, flagged, and valid', () => {
  const now = Date.parse('2026-10-13T12:00:00Z');
  const a = L.sampleEntries(L.mulberry32(7), now), b = L.sampleEntries(L.mulberry32(7), now);
  assert.deepEqual(a, b);
  assert.equal(a.length, 70);
  assert.ok(a.every(e => e.sample === true));
  assert.equal(new Set(a.map(e => e.id)).size, 70);
  const d = L.normalizeDb({ entries: a });
  assert.equal(d.entries.length, 70);
  assert.ok(d.entries.every(e => e.after <= e.before && e.after >= 0));
});

test('removeSamples and hasSamples leave real logs alone', () => {
  const d = db([entry({ id: 'real' }), ...L.sampleEntries(L.mulberry32(1)).slice(0, 5)]);
  assert.equal(L.hasSamples(d), true);
  assert.equal(L.removeSamples(d), 5);
  assert.equal(d.entries.length, 1);
  assert.equal(L.hasSamples(d), false);
});

test('regionFor', () => {
  assert.equal(L.regionFor('th', 'en-US'), 'TH');
  assert.equal(L.regionFor('en', 'en-GB'), 'GB');
  assert.equal(L.regionFor('en', 'en'), 'US');
  assert.equal(L.regionFor('en', undefined), 'US');
});

test('searchUrl encodes the term; parseSearch drops results without a title and unsafe links', () => {
  assert.ok(L.searchUrl('a b&c', 'TH').includes('term=a%20b%26c'));
  assert.ok(L.searchUrl('x', 'TH').includes('country=TH'));
  const out = L.parseSearch({ results: [
    { trackId: 1, trackName: 'T', artistName: 'A', artworkUrl100: 'https://x.example/100x100bb.jpg', previewUrl: 'http://x.example/p.m4a', trackViewUrl: 'https://x.example/s' },
    { trackId: 2, artistName: 'nobody' }
  ] });
  assert.equal(out.length, 1);
  assert.equal(out[0].preview, undefined);
  assert.equal(out[0].url, 'https://x.example/s');
  assert.deepEqual(L.parseSearch(null), []);
});

test('normalizeDraft restores a half-written log and clamps the step', () => {
  const r = L.normalizeDraft({ draft: { id: 'd1', song, part: 'la la', feel: ['sad', 3], before: 12, after: null }, step: 40, quick: false });
  assert.equal(r.draft.part, 'la la');
  assert.deepEqual(r.draft.feel, ['sad']);
  assert.equal(r.draft.before, 10);
  assert.equal(r.step, 7);
  assert.equal(L.normalizeDraft({ draft: {}, step: 9, quick: true }).step, 2);
  assert.equal(L.normalizeDraft(null), null);
  assert.equal(L.normalizeDraft({ draft: 'x' }), null);
  assert.equal(L.normalizeDraft({ draft: { song: 'bad' }, step: -3 }).step, 0);
});
