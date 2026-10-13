/* Earworm Log: data logic. No DOM. Loads in the browser as window.EWLogic and in Node through require(). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EWLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DAY = 864e5;
  const FEEL = ['anxious', 'sad', 'angry', 'restless', 'tired', 'lonely', 'guilty', 'numb', 'calm', 'happy', 'hopeful', 'excited'];
  const HELP = ['through', 'sang', 'wrote', 'gum', 'puzzle', 'other', 'walk', 'talk', 'sleep', 'nothing'];
  const MAX_TEXT = 4000;

  /* ---------- small helpers ---------- */
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const str = (v, max = MAX_TEXT) => (typeof v === 'string' ? v.slice(0, max) : '');
  const clamp10 = v => {
    if (v === null || v === undefined || v === '') return null;
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(10, Math.max(0, n)) : null;
  };
  const httpsUrl = v => {
    if (typeof v !== 'string' || v.length > 2000) return '';
    try { const u = new URL(v); return u.protocol === 'https:' ? u.href : ''; } catch (e) { return ''; }
  };
  const isoOrNull = v => {
    if (typeof v !== 'string' && typeof v !== 'number') return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };
  const strList = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.length <= 40).slice(0, 30) : []);
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const uid = (rng = Math.random, now = Date.now()) => now.toString(36) + Math.floor(rng() * 36 ** 5).toString(36).padStart(5, '0');
  const dayKey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

  /* ---------- songs ---------- */
  function normalizeSong(s) {
    if (!isObj(s)) return null;
    const title = str(s.title, 300).trim();
    if (!title) return null;
    const out = { title, artist: str(s.artist, 300).trim() };
    const id = Number(s.id);
    if (Number.isFinite(id) && id > 0) out.id = id;
    const art = httpsUrl(s.art), preview = httpsUrl(s.preview), url = httpsUrl(s.url);
    if (art) out.art = art;
    if (preview) out.preview = preview;
    if (url) out.url = url;
    return out;
  }
  const songKey = s => (s.id ? 'it' + s.id : 'm:' + String(s.title).trim().toLowerCase() + '|' + String(s.artist || '').trim().toLowerCase());

  /* ---------- entries and thoughts ---------- */
  function blankEntry(id) {
    return { id: id || uid(), ts: null, song: null, part: '', where: '', thinking: '', feel: [], before: 5, says: '', other: '', helped: [], after: null };
  }
  function normalizeEntry(x) {
    if (!isObj(x)) return null;
    const song = normalizeSong(x.song);
    const ts = isoOrNull(x.ts);
    if (!song || !ts) return null;
    const before = clamp10(x.before);
    const e = {
      id: x.id !== undefined && x.id !== null && String(x.id) ? String(x.id).slice(0, 60) : 'i' + hash(ts + song.title + (song.artist || '')),
      ts, song,
      part: str(x.part), where: str(x.where), thinking: str(x.thinking),
      feel: strList(x.feel), before: before === null ? 5 : before,
      says: str(x.says), other: str(x.other), helped: strList(x.helped),
      after: clamp10(x.after)
    };
    if (x.sample === true) e.sample = true;
    return e;
  }
  function normalizeThought(x) {
    if (!isObj(x)) return null;
    const ts = isoOrNull(x.ts), text = str(x.text).trim(), key = str(x.key, 400);
    if (!ts || !text || !key) return null;
    return { id: x.id !== undefined && x.id !== null && String(x.id) ? String(x.id).slice(0, 60) : 't' + hash(ts + key + text), key, ts, text };
  }
  const emptyDb = () => ({ v: 1, entries: [], thoughts: [] });
  function normalizeDb(raw) {
    const db = emptyDb();
    if (!isObj(raw)) return db;
    const seenE = new Set(), seenT = new Set();
    for (const x of Array.isArray(raw.entries) ? raw.entries : []) { const e = normalizeEntry(x); if (e && !seenE.has(e.id)) { seenE.add(e.id); db.entries.push(e); } }
    for (const x of Array.isArray(raw.thoughts) ? raw.thoughts : []) { const t = normalizeThought(x); if (t && !seenT.has(t.id)) { seenT.add(t.id); db.thoughts.push(t); } }
    return db;
  }
  /* Add what a backup file holds that the log lacks. Returns counts; `bad` is true when the file is not a backup. */
  function mergeImport(db, raw) {
    const isBackup = isObj(raw) && (Array.isArray(raw.entries) || Array.isArray(raw.thoughts));
    if (!isBackup) return { entries: 0, thoughts: 0, rejected: 0, bad: true };
    const inc = normalizeDb(raw);
    const rawCount = (Array.isArray(raw.entries) ? raw.entries.length : 0) + (Array.isArray(raw.thoughts) ? raw.thoughts.length : 0);
    const ids = new Set(db.entries.map(e => e.id)), tids = new Set(db.thoughts.map(t => t.id));
    let entries = 0, thoughts = 0;
    for (const e of inc.entries) if (!ids.has(e.id)) { db.entries.push(e); ids.add(e.id); entries++; }
    for (const t of inc.thoughts) if (!tids.has(t.id)) { db.thoughts.push(t); tids.add(t.id); thoughts++; }
    return { entries, thoughts, rejected: rawCount - inc.entries.length - inc.thoughts.length, bad: false };
  }
  function deleteEntry(db, id) {
    const e = db.entries.find(x => x.id === id);
    if (!e) return false;
    const key = songKey(e.song);
    db.entries = db.entries.filter(x => x.id !== id);
    if (!db.entries.some(x => songKey(x.song) === key)) db.thoughts = db.thoughts.filter(t => t.key !== key);
    return true;
  }
  function deleteThought(db, id) {
    const n = db.thoughts.length;
    db.thoughts = db.thoughts.filter(t => t.id !== id);
    return db.thoughts.length !== n;
  }
  const removeSamples = db => { const n = db.entries.length; db.entries = db.entries.filter(e => !e.sample); const keys = new Set(db.entries.map(e => songKey(e.song))); db.thoughts = db.thoughts.filter(t => keys.has(t.key)); return n - db.entries.length; };
  const hasSamples = db => db.entries.some(e => e.sample);

  /* A half-written log kept between visits. Returns null when what is stored is not a draft. */
  function normalizeDraft(raw) {
    if (!isObj(raw) || !isObj(raw.draft)) return null;
    const d = raw.draft, b = blankEntry(str(d.id, 60) || undefined), quick = raw.quick === true;
    b.song = normalizeSong(d.song);
    b.part = str(d.part); b.where = str(d.where); b.thinking = str(d.thinking); b.says = str(d.says); b.other = str(d.other);
    b.feel = strList(d.feel); b.helped = strList(d.helped);
    const before = clamp10(d.before); b.before = before === null ? 5 : before;
    b.after = clamp10(d.after);
    let step = Math.floor(Number(raw.step));
    if (!(step >= 0)) step = 0;
    return { draft: b, step: Math.min(step, (quick ? 3 : 8) - 1), quick };
  }

  /* ---------- reading the log ---------- */
  function songIndex(db) {
    const map = new Map();
    for (const e of db.entries) {
      const k = songKey(e.song);
      if (!map.has(k)) map.set(k, { key: k, song: e.song, entries: [] });
      const g = map.get(k); g.entries.push(e);
      if (e.song.art && !g.song.art) g.song = e.song;
    }
    for (const g of map.values()) { g.entries.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0)); g.last = g.entries[g.entries.length - 1].ts; }
    return [...map.values()].sort((a, b) => (a.last < b.last ? 1 : a.last > b.last ? -1 : 0));
  }
  function songStats(g) {
    const es = g.entries;
    const avg = es.reduce((a, e) => a + (e.before || 0), 0) / es.length;
    const dropped = es.filter(e => e.after !== null && e.after !== undefined && e.helped && e.helped.length);
    const drop = dropped.length ? dropped.reduce((a, e) => a + (e.before - e.after), 0) / dropped.length : null;
    return { n: es.length, first: es[0].ts, last: g.last, avg, drop };
  }
  const filterRange = (entries, days, now = Date.now()) => (days ? entries.filter(e => new Date(e.ts).getTime() >= now - days * DAY) : entries.slice());
  /* One bucket per local day, oldest first. days = 0 spans from the first entry. */
  function dayCounts(entries, days, now = Date.now()) {
    const end = new Date(now); end.setHours(0, 0, 0, 0);
    if (!days) {
      const first = entries.reduce((a, e) => Math.min(a, new Date(e.ts).getTime()), now);
      days = Math.max(14, Math.ceil((end.getTime() - first) / DAY) + 1);
    }
    const counts = new Map();
    entries.forEach(e => { const k = dayKey(new Date(e.ts)); counts.set(k, (counts.get(k) || 0) + 1); });
    const series = [];
    for (let i = days - 1; i >= 0; i--) { const d = new Date(end); d.setDate(d.getDate() - i); series.push({ d, key: dayKey(d), n: counts.get(dayKey(d)) || 0 }); }
    return series;
  }
  function heatGrid(entries) {
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
    entries.forEach(e => { const d = new Date(e.ts); grid[d.getDay()][d.getHours()]++; });
    const max = Math.max(1, ...grid.flat());
    return { grid, max };
  }
  const heatLevel = (n, max) => (n ? Math.min(5, 1 + Math.floor((n / max) * 4.999)) : 0);
  function topSongs(entries, limit = 10) {
    const m = new Map();
    entries.forEach(e => { const k = songKey(e.song); const o = m.get(k) || { key: k, label: e.song.title + (e.song.artist ? ' · ' + e.song.artist : ''), v: 0 }; o.v++; m.set(k, o); });
    return [...m.values()].sort((a, b) => b.v - a.v).slice(0, limit);
  }
  function helpStats(entries) {
    const m = new Map();
    entries.forEach(e => (e.helped || []).forEach(h => { const o = m.get(h) || { key: h, sum: 0, n: 0 }; o.sum += e.before - (e.after ?? e.before); o.n++; m.set(h, o); }));
    return [...m.values()].map(o => ({ key: o.key, v: o.sum / o.n, n: o.n })).sort((a, b) => b.v - a.v);
  }
  function feelCounts(entries) {
    const m = new Map();
    entries.forEach(e => (e.feel || []).forEach(f => m.set(f, (m.get(f) || 0) + 1)));
    return [...m.entries()].map(([key, v]) => ({ key, v })).sort((a, b) => b.v - a.v);
  }

  /* ---------- export ---------- */
  /* A cell that opens with = + - @ would run as a formula in a spreadsheet; a leading apostrophe stops that. */
  function csvCell(v) {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function csv(db) {
    const cols = ['date', 'title', 'artist', 'part', 'where', 'thinking', 'feelings', 'loud_before', 'says', 'another_reading', 'helped', 'loud_after'];
    const rows = db.entries.slice().sort((a, b) => (a.ts < b.ts ? -1 : 1)).map(e =>
      [e.ts, e.song.title, e.song.artist, e.part, e.where, e.thinking, (e.feel || []).join('; '), e.before, e.says, e.other, (e.helped || []).join('; '), e.after].map(csvCell).join(','));
    const titles = new Map(songIndex(db).map(g => [g.key, g.song.title]));
    const th = db.thoughts.slice().sort((a, b) => (a.ts < b.ts ? -1 : 1)).map(x =>
      [x.ts, titles.get(x.key) || '', '', '', '', '', '', '', '', 'thought: ' + x.text, '', ''].map(csvCell).join(','));
    return [cols.join(','), ...rows, ...th].join('\r\n');
  }

  /* ---------- example data ---------- */
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function sampleEntries(rng = Math.random, now = Date.now()) {
    const songs = [
      { title: 'Dancing Queen', artist: 'ABBA' }, { title: 'Bohemian Rhapsody', artist: 'Queen' }, { title: 'Bad Romance', artist: 'Lady Gaga' },
      { title: 'Take On Me', artist: 'a-ha' }, { title: 'Hotel California', artist: 'Eagles' }, { title: 'Shake It Off', artist: 'Taylor Swift' }];
    const weights = [6, 4, 3, 3, 2, 2], total = weights.reduce((a, b) => a + b, 0);
    const hours = [8, 9, 13, 17, 22, 23], says = ['Let go of the plan for today.', 'Someone is waiting on an answer from me.', 'Slow down.', 'It is about the move.'];
    const fade = { through: 4, sang: 3, puzzle: 3, gum: 2, walk: 2, sleep: 3, talk: 2, wrote: 2, other: 1 };
    const out = [];
    for (let i = 0; i < 70; i++) {
      let r = rng() * total, si = 0;
      while (si < weights.length - 1 && r > weights[si]) { r -= weights[si]; si++; }
      const d = new Date(now - rng() * 80 * DAY); d.setHours(hours[Math.floor(rng() * hours.length)], Math.floor(rng() * 60), 0, 0);
      const before = 3 + Math.floor(rng() * 7);
      const helped = [HELP[Math.floor(rng() * 9)]];
      out.push({
        id: 'x' + i + uid(rng, d.getTime()), ts: d.toISOString(), song: { ...songs[si] }, part: '', where: '', thinking: '',
        feel: [FEEL[Math.floor(rng() * FEEL.length)]], before, says: rng() < 0.3 ? says[Math.floor(rng() * says.length)] : '', other: '',
        helped, after: Math.max(0, before - (fade[helped[0]] || 0) - Math.floor(rng() * 2)), sample: true
      });
    }
    return out;
  }

  /* ---------- song search ---------- */
  function regionFor(uiLang, navLang) {
    if (uiLang === 'th') return 'TH';
    const m = /-([A-Za-z]{2})$/.exec(navLang || '');
    return m ? m[1].toUpperCase() : 'US';
  }
  function searchUrl(q, country) {
    return 'https://itunes.apple.com/search?entity=song&limit=8&country=' + encodeURIComponent(country) + '&term=' + encodeURIComponent(q);
  }
  function parseSearch(j) {
    return ((j && j.results) || []).map(x => normalizeSong({ id: x.trackId, title: x.trackName, artist: x.artistName, art: x.artworkUrl100, preview: x.previewUrl, url: x.trackViewUrl })).filter(Boolean);
  }

  return {
    FEEL, HELP, DAY, MAX_TEXT, uid, dayKey, hash, clamp10, httpsUrl,
    normalizeSong, songKey, blankEntry, normalizeEntry, normalizeThought, normalizeDraft, normalizeDb, emptyDb, mergeImport, deleteEntry, deleteThought, removeSamples, hasSamples,
    songIndex, songStats, filterRange, dayCounts, heatGrid, heatLevel, topSongs, helpStats, feelCounts,
    csvCell, csv, mulberry32, sampleEntries, regionFor, searchUrl, parseSearch
  };
});
