const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { T, fill } = require('../docs/i18n.js');
const L = require('../docs/logic.js');

const keys = o => Object.keys(o).sort();

test('English and Thai carry the same keys', () => {
  assert.deepEqual(keys(T.th), keys(T.en));
  assert.deepEqual(keys(T.th.feel), keys(T.en.feel));
  assert.deepEqual(keys(T.th.help), keys(T.en.help));
  assert.equal(T.th.days.length, 7);
  assert.equal(T.en.days.length, 7);
});

test('a label exists for every feeling and every help option', () => {
  for (const f of L.FEEL) assert.ok(T.en.feel[f] && T.th.feel[f], f);
  for (const h of L.HELP) assert.ok(T.en.help[h] && T.th.help[h], h);
  assert.deepEqual(keys(T.en.feel), [...L.FEEL].sort());
  assert.deepEqual(keys(T.en.help), [...L.HELP].sort());
});

test('placeholders match between languages', () => {
  const ph = s => (typeof s === 'string' ? (s.match(/\{\w+\}/g) || []).sort().join() : '');
  for (const k of Object.keys(T.en)) assert.equal(ph(T.th[k]), ph(T.en[k]), k);
});

test('fill replaces placeholders and leaves unknown ones', () => {
  assert.equal(fill('Step {n} of {m}', { n: 2, m: 8 }), 'Step 2 of 8');
  assert.equal(fill('{x}', {}), '{x}');
});

test('no empty strings', () => {
  for (const lang of ['en', 'th']) for (const [k, v] of Object.entries(T[lang])) if (typeof v === 'string') assert.ok(v.trim(), `${lang}.${k}`);
});

const docs = path.join(__dirname, '..', 'docs');

test('service worker precaches files that exist', () => {
  const sw = fs.readFileSync(path.join(docs, 'sw.js'), 'utf8');
  const list = /const SHELL = \[([\s\S]*?)\];/.exec(sw)[1].match(/'([^']+)'/g).map(s => s.slice(1, -1));
  assert.ok(list.length > 10);
  for (const f of list) if (f !== './') assert.ok(fs.existsSync(path.join(docs, f)), f);
});

test('manifest icons exist and the page links its scripts and share card', () => {
  const man = JSON.parse(fs.readFileSync(path.join(docs, 'manifest.webmanifest'), 'utf8'));
  for (const i of man.icons) assert.ok(fs.existsSync(path.join(docs, i.src)), i.src);
  assert.equal(man.display, 'standalone');
  const html = fs.readFileSync(path.join(docs, 'index.html'), 'utf8');
  for (const s of ['i18n.js', 'logic.js', 'app.js', 'style.css', 'card.jpg']) { assert.ok(html.includes(s), s); assert.ok(fs.existsSync(path.join(docs, s)), s); }
  for (const m of ['og:title', 'og:image', 'og:description', 'twitter:card', 'twitter:image']) assert.ok(html.includes(m), m);
});
