/* Earworm Log: the app. Needs i18n.js (window.EWText) and logic.js (window.EWLogic). */
(() => {
'use strict';
const L = window.EWLogic, { T, fill } = window.EWText;
const { FEEL, HELP } = L;

/* ---------- storage ---------- */
const KEY = 'earworm-log-v1', DRAFT_KEY = 'earworm-draft-v1', LANG_KEY = 'earworm-lang';
const read = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
const drop = k => { try { localStorage.removeItem(k); } catch (e) { /* storage blocked */ } };
const parse = s => { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } };

let db = L.normalizeDb(parse(read(KEY)));
let lang = read(LANG_KEY) || ((navigator.language || '').toLowerCase().startsWith('th') ? 'th' : 'en');
if (!T[lang]) lang = 'en';
const t = (k, vars) => { const v = T[lang][k] ?? T.en[k] ?? k; return typeof v === 'string' && vars ? fill(v, vars) : v; };

function save() {
  const ok = write(KEY, JSON.stringify(db));
  $('#banner').innerHTML = ok ? '' : `<p class="banner">${esc(t('save_fail'))}</p>`;
  if (ok && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  return ok;
}

/* ---------- helpers ---------- */
function $(s, root = document) { return root.querySelector(s); }
function $$(s, root = document) { return [...root.querySelectorAll(s)]; }
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const locale = () => (lang === 'th' ? 'th-TH' : 'en-GB');
const fmtDate = (iso, time = true) => new Date(iso).toLocaleString(locale(), time ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', year: 'numeric' });
const initial = s => (s.title || '?').trim().slice(0, 1).toUpperCase();
const art = (s, big) => s.art
  ? `<img class="art${big ? ' big' : ''}" src="${esc(big ? s.art.replace('100x100', '300x300') : s.art)}" alt="" data-i="${esc(initial(s))}" loading="lazy" width="${big ? 120 : 56}" height="${big ? 120 : 56}">`
  : `<div class="art${big ? ' big' : ''}" aria-hidden="true">${esc(initial(s))}</div>`;
document.addEventListener('error', e => {
  const im = e.target;
  if (im && im.tagName === 'IMG' && im.classList.contains('art')) {
    const d = document.createElement('div'); d.className = im.className; d.setAttribute('aria-hidden', 'true'); d.textContent = im.dataset.i || '?'; im.replaceWith(d);
  }
}, true);
const live = $('#live');
const announce = msg => { live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 30); };
function toast(msg) {
  const d = document.createElement('div'); d.className = 'toast'; d.setAttribute('aria-hidden', 'true'); d.textContent = msg; document.body.appendChild(d);
  announce(msg); setTimeout(() => d.remove(), 2400);
}
/* A button that asks for a second tap before it acts. */
function twoTap(btn, confirmText, action) {
  const label = btn.textContent;
  let timer = null;
  btn.addEventListener('click', () => {
    if (btn.dataset.armed) { clearTimeout(timer); action(); return; }
    btn.dataset.armed = '1'; btn.textContent = confirmText; announce(confirmText);
    timer = setTimeout(() => { delete btn.dataset.armed; btn.textContent = label; }, 4500);
  });
}
const links = s => {
  const q = encodeURIComponent(`${s.title} ${s.artist || ''}`.trim());
  return `<div class="row">
    ${s.url ? `<a class="btn" href="${esc(s.url)}" target="_blank" rel="noopener">${t('whole')}</a>` : ''}
    <a class="btn" href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener">${t('yt')}</a>
    <a class="btn" href="https://genius.com/search?q=${q}" target="_blank" rel="noopener">${t('lyrics')}</a></div>`;
};
const player = s => s.preview ? `<p class="hint" style="margin:10px 0 0" id="pv">${t('preview')}</p><audio controls preload="none" aria-labelledby="pv" src="${esc(s.preview)}"></audio>` : '';

/* ---------- routing ---------- */
let view = 'log', param = null, grab = () => {};
const VIEWS = ['log', 'songs', 'charts', 'data'];
function go(v, p = null) {
  const h = '#/' + v + (p ? '/' + encodeURIComponent(p) : '');
  if (location.hash === h) route(); else location.hash = h;
}
function route() {
  grab();
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  let v = parts[0];
  if (v === 'quick') { if (!draft) startLog(true); history.replaceState(null, '', '#/log'); v = 'log'; }
  if (!VIEWS.includes(v)) v = 'log';
  let p = null;
  if (parts[1]) { try { p = decodeURIComponent(parts.slice(1).join('/')); } catch (e) { p = null; } }
  if (draft === 'done' && v !== 'log') draft = null;
  view = v; param = v === 'songs' ? p : null;
  render();
  window.scrollTo(0, 0);
  $('#main').focus({ preventScroll: true });
}
window.addEventListener('hashchange', route);
$('#skip').onclick = e => { e.preventDefault(); $('#main').focus(); };
$$('#nav [data-view]').forEach(b => { b.onclick = () => go(b.dataset.view); });
$$('#langbox [data-lang]').forEach(b => { b.onclick = () => { grab(); lang = b.dataset.lang; write(LANG_KEY, lang); render(); }; });

function chrome() {
  document.documentElement.lang = lang;
  document.body.classList.toggle('th', lang === 'th');
  $('#brand').innerHTML = `${esc(t('brand'))}<small>${esc(t('tagline'))}</small>`;
  $('#skip').textContent = t('skip_link');
  $('#nav').setAttribute('aria-label', t('nav_label'));
  $('#langbox').setAttribute('aria-label', t('lang_label'));
  $$('#nav [data-view]').forEach(b => {
    b.textContent = t('nav_' + b.dataset.view);
    if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  $$('#langbox [data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  document.title = (view === 'log' ? '' : t('nav_' + view) + ' · ') + t('brand');
}
function render() {
  grab = () => {};
  chrome();
  const m = $('#main');
  if (view === 'log') renderLog(m);
  else if (view === 'songs') param ? renderSong(m, param) : renderSongs(m);
  else if (view === 'charts') renderCharts(m);
  else renderData(m);
}

/* ---------- log (thought record) ---------- */
let draft = null, step = 0, quick = false;
const STEPS = ['song', 'part', 'where', 'thinking', 'feel', 'says', 'other', 'through'];
const QUICK = ['song', 'feel', 'through'];
const saved0 = L.normalizeDraft(parse(read(DRAFT_KEY)));
if (saved0) ({ draft, step, quick } = saved0);
let persistTimer = null;
function persistDraft() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    if (draft && draft !== 'done') write(DRAFT_KEY, JSON.stringify({ draft, step, quick })); else drop(DRAFT_KEY);
  }, 250);
}
function startLog(isQuick, song = null, atStep = 0) { draft = L.blankEntry(); draft.song = song; step = atStep; quick = isQuick; persistDraft(); }
function endDraft() { draft = null; step = 0; persistDraft(); }

let results = [], searchSeq = 0;
function renderLog(m) {
  if (draft === 'done') return renderDone(m);
  if (!draft) {
    m.innerHTML = `<div class="card"><h2>${t('start_h')}</h2><p class="hint">${t('start_p')}</p>
      <div class="row"><button type="button" class="btn primary" id="full">${t('start_full')}</button><button type="button" class="btn" id="quick">${t('start_quick')}</button></div></div>
      ${recent()}`;
    $('#full').onclick = () => { startLog(false); render(); focusStep(); };
    $('#quick').onclick = () => { startLog(true); render(); focusStep(); };
    bindSongButtons(m);
    return;
  }
  const steps = quick ? QUICK : STEPS, s = steps[step], last = step === steps.length - 1;
  let body = '';
  const ta = (k, q, h) => `<label class="q" for="f" id="lq">${t(q)}</label><p class="hint" id="hq">${t(h)}</p><textarea id="f" data-k="${k}" aria-describedby="hq">${esc(draft[k])}</textarea>`;
  if (s === 'song') {
    results = draft.song && draft.song.id ? [draft.song] : [];
    body = `<label class="q" for="sq" id="lq">${t('q1')}</label><p class="hint">${t('q1h')}</p>
      <form id="sf" class="row" role="search"><input id="sq" type="search" autocomplete="off" enterkeyhint="search" style="flex:1;min-width:0"><button type="submit" class="btn primary">${t('search')}</button></form>
      <ul class="results" id="res">${results.map((x, i) => songBtn(x, i, true)).join('')}</ul>
      <p class="hint" style="margin-top:16px" id="ort">${t('or_type')}</p>
      <div class="row" role="group" aria-labelledby="ort"><input type="text" id="mt" aria-label="${esc(t('manual_t'))}" placeholder="${esc(t('manual_t'))}" style="flex:2;min-width:140px" value="${esc(draft.song && !draft.song.id ? draft.song.title : '')}"><input type="text" id="ma" aria-label="${esc(t('manual_a'))}" placeholder="${esc(t('manual_a'))}" style="flex:1;min-width:120px" value="${esc(draft.song && !draft.song.id ? draft.song.artist : '')}"></div>
      <p class="hint" id="need" style="margin:10px 0 0;min-height:1.4em"></p>`;
  }
  if (s === 'part') body = ta('part', 'q2', 'q2h');
  if (s === 'where') body = ta('where', 'q3', 'q3h');
  if (s === 'thinking') body = ta('thinking', 'q4', 'q4h');
  if (s === 'says') body = ta('says', 'q6', 'q6h');
  if (s === 'other') body = ta('other', 'q7', 'q7h');
  if (s === 'feel') body = `${quick ? '' : `<p class="q" id="lq">${t('q5')}</p><p class="hint">${t('q5h')}</p>
      <div class="chips" id="fc" role="group" aria-labelledby="lq">${FEEL.map(f => `<button type="button" class="chip" data-f="${f}" aria-pressed="${draft.feel.includes(f)}">${esc(T[lang].feel[f])}</button>`).join('')}</div><div style="height:22px"></div>`}
      ${slider('before', t('loud'), draft.before)}`;
  if (s === 'through') body = `<p class="q" id="lq">${t('q8')}</p><p class="hint">${t('q8h')}</p>
      ${draft.song ? player(draft.song) + links(draft.song) : ''}
      <div style="height:20px"></div><p class="q" id="lh">${t('helped')}</p>
      <div class="chips" id="hc" role="group" aria-labelledby="lh">${HELP.map(f => `<button type="button" class="chip" data-h="${f}" aria-pressed="${draft.helped.includes(f)}">${esc(T[lang].help[f])}</button>`).join('')}</div>
      <div style="height:22px"></div>${slider('after', t('loud_after'), draft.after ?? draft.before)}`;
  m.innerHTML = `<h2 class="sr">${t('nav_log')}</h2><div class="card"><div class="steps" aria-hidden="true">${steps.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>
    <p class="stepno">${t('step_of', { n: step + 1, m: steps.length })}</p>${body}
    <div class="row" style="margin-top:22px"><button type="button" class="btn ghost" id="bk">${t('back')}</button><span class="spacer"></span>
    ${!last && s !== 'song' ? `<button type="button" class="btn ghost" id="sk">${t('skip')}</button>` : ''}
    <button type="button" class="btn primary" id="nx">${last ? t('save') : t('next')}</button></div></div>`;

  grab = () => {
    const f = $('#f'); if (f) draft[f.dataset.k] = f.value;
    const mt = $('#mt'); if (mt && mt.value.trim()) draft.song = { title: mt.value.trim().slice(0, 300), artist: ($('#ma').value || '').trim().slice(0, 300) };
    $$('input[type=range]').forEach(r => { draft[r.dataset.k] = +r.value; });
    persistDraft();
  };
  $('#bk').onclick = () => { grab(); if (step === 0) endDraft(); else step--; persistDraft(); render(); focusStep(); };
  if ($('#sk')) $('#sk').onclick = () => { grab(); step++; persistDraft(); render(); focusStep(); };
  $('#nx').onclick = () => {
    grab();
    if (s === 'song' && !draft.song) { $('#need').textContent = t('need_song'); announce(t('need_song')); $('#sq').focus(); return; }
    if (last) { finish(); return; }
    step++; persistDraft(); render(); focusStep();
  };
  if ($('#f')) $('#f').addEventListener('input', () => { draft[$('#f').dataset.k] = $('#f').value; persistDraft(); });
  if (s === 'song') {
    $('#sf').onsubmit = e => { e.preventDefault(); search($('#sq').value); };
    $('#mt').oninput = () => { if ($('#mt').value.trim()) { draft.song = null; $$('#res .song').forEach(b => b.setAttribute('aria-pressed', 'false')); } };
    $('#res').onclick = e => {
      const b = e.target.closest('button.song'); if (!b) return;
      draft.song = results[+b.dataset.i];
      $$('#res .song').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      $('#mt').value = ''; $('#ma').value = ''; $('#need').textContent = ''; persistDraft();
      announce(`${t('picked')}: ${draft.song.title}`);
    };
  }
  $$('[data-f]').forEach(b => { b.onclick = () => { toggle(draft.feel, b.dataset.f); b.setAttribute('aria-pressed', String(draft.feel.includes(b.dataset.f))); persistDraft(); }; });
  $$('[data-h]').forEach(b => { b.onclick = () => { toggle(draft.helped, b.dataset.h); b.setAttribute('aria-pressed', String(draft.helped.includes(b.dataset.h))); persistDraft(); }; });
  $$('input[type=range]').forEach(r => {
    r.oninput = () => { r.nextElementSibling.value = r.value; r.setAttribute('aria-valuetext', t('of_ten', { v: r.value })); draft[r.dataset.k] = +r.value; persistDraft(); };
  });
}
/* After a step changes, move focus to the question so a screen reader reads it. */
function focusStep() {
  const el = $('#f') || $('#sq') || $('#lq') || $('.stepno') || $('#full');
  if (!el) return;
  if (!/^(TEXTAREA|INPUT|BUTTON)$/.test(el.tagName)) el.setAttribute('tabindex', '-1');
  el.focus();
}
const toggle = (arr, v) => { const i = arr.indexOf(v); i < 0 ? arr.push(v) : arr.splice(i, 1); };
const slider = (k, label, v) => `<label class="q" for="r-${k}">${label}</label>
  <div class="slider"><input type="range" id="r-${k}" data-k="${k}" min="0" max="10" step="1" value="${v}" aria-valuetext="${esc(t('of_ten', { v }))}" aria-describedby="sc-${k}"><output for="r-${k}" aria-hidden="true">${v}</output></div>
  <div class="scale" id="sc-${k}"><span>0 · ${t('quiet')}</span><span>10 · ${t('loudest')}</span></div>`;
const songBtn = (s, i, on) => `<li><button type="button" class="song" data-i="${i}" aria-pressed="${!!on}">${art(s)}<span><span class="t">${esc(s.title)}</span><br><span class="a">${esc(s.artist || t('unknown'))}</span></span></button></li>`;

async function itunes(q, country) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(L.searchUrl(q, country), { signal: ctl.signal });
    if (!r.ok) throw new Error('http ' + r.status);
    return L.parseSearch(await r.json());
  } finally { clearTimeout(timer); }
}
async function search(q) {
  q = q.trim(); if (!q) return;
  const seq = ++searchSeq, res = $('#res');
  res.innerHTML = `<li class="hint">${t('searching')}</li>`; announce(t('searching'));
  const msg = key => { if (seq === searchSeq && res.isConnected) { res.innerHTML = `<li class="hint">${t(key)}</li>`; announce(t(key)); } };
  try {
    const country = L.regionFor(lang, navigator.language);
    let list = await itunes(q, country);
    if (!list.length && country !== 'US') list = await itunes(q, 'US');
    if (seq !== searchSeq || !res.isConnected) return;
    if (!list.length) return msg('none_found');
    results = list;
    res.innerHTML = list.map((s, i) => songBtn(s, i, draft && draft.song && draft.song.id === s.id)).join('');
    announce(t('n_results', { n: list.length }));
  } catch (e) { msg('search_offline'); }
}
function finish() {
  draft.ts = new Date().toISOString();
  if (draft.after === null || draft.after === undefined) draft.after = draft.before;
  const entry = draft;
  db.entries.push(entry); save();
  lastSaved = entry; draft = 'done'; persistDraft(); render();
  const h = $('#doneh'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
}
let lastSaved = null;
function renderDone(m) {
  m.innerHTML = `<div class="card"><h2 id="doneh">${t('saved')}</h2><p class="hint">${t('saved_p')}</p>
    <div class="row"><button type="button" class="btn primary" id="os">${t('see_song')}</button><button type="button" class="btn" id="la">${t('log_another')}</button></div></div>`;
  $('#os').onclick = () => { const k = L.songKey(lastSaved.song); draft = null; go('songs', k); };
  $('#la').onclick = () => { startLog(false); render(); focusStep(); };
}

/* ---------- songs ---------- */
function recent() {
  const list = L.songIndex(db).slice(0, 4);
  if (!list.length) return '';
  return `<div class="card"><h3>${t('songs_h')}</h3><div class="results">${list.map(songRow).join('')}</div></div>`;
}
const songRow = g => `<button type="button" class="song" data-open="${esc(g.key)}">${art(g.song)}<span><span class="t">${esc(g.song.title)}</span><br><span class="a">${esc(g.song.artist || t('unknown'))}</span></span>
  <span class="n"><b>${g.entries.length}</b>${t('times')} · ${fmtDate(g.last, false)}</span></button>`;
function bindSongButtons(m) { $$('[data-open]', m).forEach(b => { b.onclick = () => { if (draft === 'done') draft = null; go('songs', b.dataset.open); }; }); }
function renderSongs(m) {
  const list = L.songIndex(db);
  m.innerHTML = `<div class="card"><h2>${t('songs_h')}</h2>${list.length ? `<div class="results">${list.map(songRow).join('')}</div>` : `<p class="empty">${t('songs_empty')}</p>`}</div>`;
  bindSongButtons(m);
}
function renderSong(m, key) {
  const g = L.songIndex(db).find(x => x.key === key);
  if (!g) { history.replaceState(null, '', '#/songs'); param = null; return renderSongs(m); }
  const s = g.song, es = g.entries, st = L.songStats(g);
  const thoughts = db.thoughts.filter(x => x.key === key);
  const items = [...es.map(e => ({ ts: e.ts, e })), ...thoughts.map(x => ({ ts: x.ts, th: x }))].sort((a, b) => (a.ts < b.ts ? 1 : -1));
  const row = (k, v) => v && (Array.isArray(v) ? v.length : String(v).trim()) ? `<dt>${t(k)}</dt><dd>${Array.isArray(v) ? v.map(esc).join(', ') : esc(v)}</dd>` : '';
  m.innerHTML = `<button type="button" class="back" id="bk">← ${t('all_songs')}</button>
  <div class="card"><div class="row" style="align-items:flex-start">${art(s, true)}<div style="flex:1;min-width:180px"><h2>${esc(s.title)}</h2><div class="hint">${esc(s.artist || t('unknown'))}</div></div></div>
    ${player(s)}${links(s)}
    <div class="stats"><div class="stat"><b>${st.n}</b><span>${t('s_times')}</span></div><div class="stat"><b>${fmtDate(st.first, false)}</b><span>${t('s_first')}</span></div>
    <div class="stat"><b>${fmtDate(st.last, false)}</b><span>${t('s_last')}</span></div><div class="stat"><b>${st.avg.toFixed(1)}</b><span>${t('s_avg')}</span></div><div class="stat"><b>${st.drop === null ? '–' : st.drop.toFixed(1)}</b><span>${t('s_drop')}</span></div></div>
    <div class="chart" id="songchart"></div>
    <button type="button" class="btn primary" id="again">${t('log_again')}</button></div>
  <div class="card"><label class="q" for="th">${t('add_thought')}</label><p class="hint">${t('add_thought_h')}</p><textarea id="th"></textarea>
    <div class="row" style="margin-top:10px"><button type="button" class="btn primary" id="addth">${t('add')}</button></div></div>
  <div class="card">${items.map(it => it.th
    ? `<div class="entry thought"><div class="when">${fmtDate(it.ts)} · ${t('thought')}</div><p style="margin:6px 0 0;white-space:pre-wrap;overflow-wrap:anywhere">${esc(it.th.text)}</p><button type="button" class="btn ghost del" data-dt="${esc(it.th.id)}">${t('del_thought')}</button></div>`
    : `<div class="entry"><div class="when">${fmtDate(it.ts)} · ${t('e_loud')} ${it.e.before}${it.e.after !== null && it.e.after !== it.e.before ? ' → ' + it.e.after : ''}</div><dl>
        ${row('e_part', it.e.part)}${row('e_where', it.e.where)}${row('e_thinking', it.e.thinking)}${row('e_feel', (it.e.feel || []).map(f => T[lang].feel[f] || f))}
        ${row('e_says', it.e.says)}${row('e_other', it.e.other)}${row('e_helped', (it.e.helped || []).map(h => T[lang].help[h] || h))}</dl><button type="button" class="btn ghost del" data-de="${esc(it.e.id)}">${t('del_log')}</button></div>`).join('')}</div>`;
  $('#bk').onclick = () => go('songs');
  $('#again').onclick = () => { startLog(false, s, 1); go('log'); };
  $('#addth').onclick = () => {
    const v = $('#th').value.trim(); if (!v) return;
    db.thoughts.push({ id: L.uid(), key, ts: new Date().toISOString(), text: v.slice(0, L.MAX_TEXT) }); save(); render();
  };
  $$('[data-de]').forEach(b => twoTap(b, t('del_confirm'), () => { L.deleteEntry(db, b.dataset.de); save(); toast(t('deleted')); render(); }));
  $$('[data-dt]').forEach(b => twoTap(b, t('del_confirm'), () => { L.deleteThought(db, b.dataset.dt); save(); toast(t('deleted')); render(); }));
  drawSongChart();
}
function drawSongChart() {
  const box = $('#songchart'); if (!box || !param) return;
  const g = L.songIndex(db).find(x => x.key === param);
  if (g && g.entries.length > 1) barsByDay(box, g.entries, 90, t('c_day'));
}

/* ---------- charts ---------- */
let range = 90;
const NS = 'http://www.w3.org/2000/svg';
const tip = $('#tip');
function hover(el, html) {
  const show = ev => {
    tip.innerHTML = html; tip.style.opacity = 1; const p = ev.touches ? ev.touches[0] : ev, w = tip.offsetWidth;
    tip.style.left = Math.min(window.innerWidth - w - 8, Math.max(8, p.clientX - w / 2)) + 'px'; tip.style.top = Math.max(8, p.clientY - tip.offsetHeight - 14) + 'px';
  };
  el.addEventListener('mousemove', show); el.addEventListener('touchstart', show, { passive: true });
  el.addEventListener('mouseleave', () => { tip.style.opacity = 0; }); el.addEventListener('touchend', () => setTimeout(() => { tip.style.opacity = 0; }, 1200));
}
const svgEl = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const table = (head, rows) => `<details class="table"><summary>${t('table')}</summary><table><tr>${head.map((h, i) => `<th scope="col" class="${i ? 'num' : ''}">${esc(h)}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${i ? 'num' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</table></details>`;
const roundTop = (x, y, w, h, r = 4) => { r = Math.min(r, h, w / 2); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; };
const roundRight = (x, y, w, h, r = 4) => { r = Math.min(r, w, h / 2); return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`; };
const widthOf = box => {
  const cs = getComputedStyle(box), pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  return Math.max(260, Math.round((box.clientWidth || 700) - pad));
};
const hhmm = h => String(h).padStart(2, '0') + ':00';

function barsByDay(box, entries, days, title) {
  const series = L.dayCounts(entries, days);
  const W = widthOf(box), H = 200, Lm = 28, B = 24, max = Math.max(2, ...series.map(s => s.n));
  const bw = (W - Lm) / series.length, gap = bw > 6 ? 2 : 0;
  box.innerHTML = `<h3>${esc(title)}</h3>`;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': title }, box);
  const ticks = max <= 4 ? [...Array(max + 1).keys()] : [0, Math.round(max / 2), max];
  ticks.forEach(v => { const y = (H - B) - v / max * (H - B - 10); svgEl('line', { x1: Lm, x2: W, y1: y, y2: y, class: 'grid' }, svg); const tx = svgEl('text', { x: Lm - 6, y: y + 4, 'text-anchor': 'end' }, svg); tx.textContent = v; });
  const every = Math.ceil(series.length / Math.max(2, Math.floor((W - Lm) / 90)));
  series.forEach((s, i) => {
    const x = Lm + i * bw, h = s.n / max * (H - B - 10), y = (H - B) - h;
    const g = svgEl('g', { class: 'm' }, svg);
    if (s.n) svgEl('path', { d: roundTop(x + gap / 2, y, Math.max(1, bw - gap), h), class: 'bar' }, g);
    const hit = svgEl('rect', { x, y: 0, width: bw, height: H - B, class: 'hit' }, g);
    hover(hit, `<b>${fmtDate(s.d.toISOString(), false)}</b><br>${s.n} ${t('times')}`);
    if (i % every === 0) { const tx = svgEl('text', { x: Math.min(x + bw / 2, W - 20), y: H - 6, 'text-anchor': 'middle' }, svg); tx.textContent = s.d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' }); }
  });
  box.insertAdjacentHTML('beforeend', table([t('c_day'), t('times')], series.filter(s => s.n).map(s => [fmtDate(s.d.toISOString(), false), s.n])));
}
function heatmap(box, entries) {
  const { grid, max } = L.heatGrid(entries);
  const W = widthOf(box), Lm = 34, T0 = 20, cw = (W - Lm) / 24, ch = 26, H = T0 + 7 * ch + 4;
  box.innerHTML = `<h3>${t('c_heat')}</h3><p class="hint">${t('c_heat_h')}</p>`;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': t('c_heat') }, box);
  [0, 6, 12, 18, 23].forEach(h => { const tx = svgEl('text', { x: Math.min(Math.max(Lm + h * cw + cw / 2, Lm + 14), W - 14), y: 12, 'text-anchor': 'middle' }, svg); tx.textContent = hhmm(h); });
  const days = t('days'), rows = [];
  for (let d = 0; d < 7; d++) {
    const tx = svgEl('text', { x: Lm - 6, y: T0 + d * ch + ch / 2 + 4, 'text-anchor': 'end' }, svg); tx.textContent = days[d];
    for (let h = 0; h < 24; h++) {
      const n = grid[d][h];
      const r = svgEl('rect', { x: Lm + h * cw + 1, y: T0 + d * ch + 1, width: cw - 2, height: ch - 2, rx: 3, style: `fill:var(--q${L.heatLevel(n, max)})` }, svg);
      hover(r, `<b>${days[d]} ${hhmm(h)}</b><br>${n} ${t('times')}`);
      if (n) rows.push([`${days[d]} ${hhmm(h)}`, n]);
    }
  }
  box.insertAdjacentHTML('beforeend', `<div class="legend" aria-hidden="true">${t('fewer')} ${[0, 1, 2, 3, 4, 5].map(i => `<i style="background:var(--q${i})"></i>`).join('')} ${t('more')}</div>` + table([t('c_heat'), t('times')], rows));
}
function hbars(box, title, hint, items, fmt = v => v) {
  box.innerHTML = `<h3>${esc(title)}</h3>${hint ? `<p class="hint">${hint}</p>` : ''}`;
  if (!items.length) { box.insertAdjacentHTML('beforeend', `<p class="empty">${t('c_none')}</p>`); return; }
  const W = widthOf(box), LW = Math.round(Math.min(230, W * 0.42)), rh = 34, H = items.length * rh, max = Math.max(...items.map(i => i.v), 0.001);
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': title }, box);
  items.forEach((it, i) => {
    const y = i * rh, w = Math.max(0, it.v) / max * Math.max(10, W - LW - 80);
    const lab = svgEl('text', { x: LW - 10, y: y + rh / 2 + 4, 'text-anchor': 'end' }, svg); lab.textContent = it.label;
    for (let n = it.label.length; n > 1 && lab.getComputedTextLength() > LW - 14; n--) lab.textContent = it.label.slice(0, n - 1).trimEnd() + '…';
    if (w > 0) svgEl('path', { d: roundRight(LW, y + 5, w, rh - 10), class: 'bar' }, svg);
    const val = svgEl('text', { x: LW + w + 8, y: y + rh / 2 + 4 }, svg); val.textContent = fmt(it.v) + (it.extra || '');
    const hit = svgEl('rect', { x: 0, y, width: W, height: rh, class: 'hit' }, svg);
    hover(hit, `<b>${esc(it.label)}</b><br>${fmt(it.v)}${it.extra || ''}`);
  });
  box.insertAdjacentHTML('beforeend', table([title, ''], items.map(i => [i.label, fmt(i.v) + (i.extra || '')])));
}
let chartEntries = [];
function drawCharts() {
  if (!$('#c1')) return;
  const es = chartEntries;
  barsByDay($('#c1'), es, range, t('c_day'));
  heatmap($('#c2'), es);
  hbars($('#c3'), t('c_top'), '', L.topSongs(es, 10));
  hbars($('#c4'), t('c_help'), t('c_help_h'), L.helpStats(es).map(o => ({ label: T[lang].help[o.key] || o.key, v: o.v, extra: `  (n=${o.n})` })), v => v.toFixed(1));
  hbars($('#c5'), t('c_feel'), '', L.feelCounts(es).map(o => ({ label: T[lang].feel[o.key] || o.key, v: o.v })));
}
function renderCharts(m) {
  const es = L.filterRange(db.entries, range);
  m.innerHTML = `<h2 class="sr">${t('nav_charts')}</h2><div class="filters" role="group" aria-label="${esc(t('range_label'))}">${[30, 90, 365, 0].map(r => `<button type="button" class="chip" data-r="${r}" aria-pressed="${r === range}">${t('range_' + (r || 'all'))}</button>`).join('')}</div>
    ${es.length < 2 ? `<div class="card empty">${t('c_empty')}</div>` : `
    <div class="card chart" id="c1"></div><div class="card chart" id="c2"></div><div class="card chart" id="c3"></div>
    <div class="card chart" id="c4"></div><div class="card chart" id="c5"></div>`}`;
  $$('[data-r]', m).forEach(b => { b.onclick = () => { range = +b.dataset.r; render(); }; });
  chartEntries = es;
  drawCharts();
}
let lastW = window.innerWidth, resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (window.innerWidth === lastW) return;   /* a keyboard opening changes height only */
    lastW = window.innerWidth;
    if (view === 'charts') drawCharts(); else if (view === 'songs' && param) drawSongChart();
  }, 200);
});

/* ---------- data ---------- */
function download(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (view === 'data') render(); });
window.addEventListener('appinstalled', () => { installEvt = null; toast(t('installed')); if (view === 'data') render(); });
const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function renderData(m) {
  const showInstall = !standalone() && (installEvt || isIos());
  m.innerHTML = `<div class="card"><h2>${t('data_h')}</h2><p class="hint">${t('data_p')}</p>
    <div class="col">
      <button type="button" class="btn" id="ec">${t('exp_csv')}</button><button type="button" class="btn" id="ej">${t('exp_json')}</button>
      <button type="button" class="btn" id="imp">${t('imp_json')}</button><input type="file" id="ij" accept="application/json,.json" class="hidden" tabindex="-1" aria-hidden="true">
      <button type="button" class="btn" id="sd">${L.hasSamples(db) ? t('sample_off') : t('sample')}</button>
      <button type="button" class="btn erase" id="er">${t('erase')}</button></div>
    <p class="fine">${t('data_search')}</p></div>
    ${showInstall ? `<div class="card">${installEvt ? `<button type="button" class="btn" id="inst">${t('install')}</button>` : `<p class="hint" style="margin:0">${t('install_ios')}</p>`}</div>` : ''}
    <p class="fine"><a href="https://github.com/NaNoBotCo/earworm" target="_blank" rel="noopener">${t('source')}</a></p>`;
  const stamp = new Date().toISOString().slice(0, 10);
  $('#ec').onclick = () => download(`earworm-log-${stamp}.csv`, '﻿' + L.csv(db), 'text/csv');
  $('#ej').onclick = () => download(`earworm-log-${stamp}.json`, JSON.stringify(db, null, 1), 'application/json');
  $('#imp').onclick = () => $('#ij').click();
  $('#ij').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    let raw = null;
    try { if (f.size < 25e6) raw = JSON.parse(await f.text()); } catch (err) { raw = null; }
    const r = L.mergeImport(db, raw);
    if (r.bad) { toast(t('import_bad')); return; }
    save();
    let msg = r.entries || r.thoughts ? t('imported_n', { n: r.entries, m: r.thoughts }) : t('imported_none');
    if (r.rejected) msg += ' ' + t('import_skipped', { n: r.rejected });
    toast(msg); render();
  };
  $('#sd').onclick = () => {
    if (L.hasSamples(db)) { L.removeSamples(db); save(); toast(t('sample_gone')); render(); return; }
    db.entries.push(...L.sampleEntries()); save(); toast(t('sample_done')); go('charts');
  };
  twoTap($('#er'), t('erase_q'), () => { db = L.emptyDb(); draft = null; save(); persistDraft(); toast(t('erased')); render(); });
  if ($('#inst')) $('#inst').onclick = async () => { const e = installEvt; installEvt = null; e.prompt(); try { await e.userChoice; } catch (err) { /* dismissed */ } render(); };
}

/* ---------- start ---------- */
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
if (!read(KEY) && !write(KEY, JSON.stringify(db))) $('#banner').innerHTML = `<p class="banner">${esc(t('save_fail'))}</p>`;
if (!location.hash) history.replaceState(null, '', '#/log');
{
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  view = VIEWS.includes(parts[0]) ? parts[0] : 'log';
  if (parts[0] === 'quick') { if (!draft) startLog(true); history.replaceState(null, '', '#/log'); view = 'log'; }
  if (parts[1] && view === 'songs') { try { param = decodeURIComponent(parts.slice(1).join('/')); } catch (e) { param = null; } }
  render();
}
})();
