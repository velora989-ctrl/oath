/* Holidays tab (the old "Undo" button): the school calendar.
   A parchment month sheet pinned on the wooden board. Holidays are green. Click a day to read what it is for (and what is on at
   school), and to turn a working day into a holiday or a holiday into a working day. The data comes from calendar-data.js (the school's
   planner PDF). Your own changes are kept in localStorage at once and on the server a moment later (GET / PUT /api/calendar). */
(function () {
  'use strict';
  const D = window.GroveCalData;
  if (!D) return;
  const W = 1671, H = 941;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const $ = (s, r) => (r || document).querySelector(s);
  const mk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const snd = n => { try { window.GroveFX && window.GroveFX.sound && window.GroveFX.sound.play(n); } catch (e) {} };
  const pad = n => String(n).padStart(2, '0');
  const key = (y, m, d) => y + '-' + pad(m) + '-' + pad(d);                 /* m is 1-12 */
  const parts = s => s.split('-').map(Number);
  const dow = s => { const [y, m, d] = parts(s); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
  const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const todayKey = () => { const n = new Date(); return key(n.getFullYear(), n.getMonth() + 1, n.getDate()); };
  const monthIdx = s => { const [y, m] = parts(s); return y * 12 + m - 1; };
  const idxMonth = i => { const y = Math.floor(i / 12), m = i % 12; return y + '-' + pad(m + 1); };
  const FIRST = monthIdx(D.first), LAST = monthIdx(D.last);
  const pretty = s => { const [y, m, d] = parts(s); return DAYS[dow(s)] + ', ' + d + ' ' + MONTHS[m - 1] + ' ' + y; };
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function edge(w, h, seed) {   /* a gently torn paper outline */
    const r = rng(seed), j = () => 0.4 + r() * 2.2, st = () => 9 + r() * 14, t = [], rt = [], b = [], l = [];
    for (let x = 0; x < w; x += st()) t.push([x, j()]);
    for (let y = 0; y < h; y += st()) rt.push([w - j(), y]);
    for (let x = w; x > 0; x -= st()) b.push([x, h - j()]);
    for (let y = h; y > 0; y -= st()) l.push([j(), y]);
    return 'polygon(' + [...t, ...rt, ...b, ...l].map(p => clamp(p[0], 0, w).toFixed(1) + 'px ' + clamp(p[1], 0, h).toFixed(1) + 'px').join(',') + ')';
  }

  /* ------------------------------------------------------------ your changes: { 'YYYY-MM-DD': { h: 1 | 0 | 2, n: 'note' } }  (1 holiday, 0 working day, 2 exam day = red) */
  let root, stage, monthsEl, sheetEl, sideEl, todayBtn;
  let ov = {}, nt = {}, view = D.start, sel = null, isOpen = false, scale = 1, built = false, saveT = 0, saving = false, again = false, loaded = 0;
  const token = () => { try { return localStorage.getItem('grove_token') || ''; } catch (e) { return ''; } };
  const api = () => window.GroveAPI;
  function who() {   /* a stable key for this player's changes on this device */
    const t = token(); if (!t) return 'guest';
    try { const p = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); if (p && (p.id || p._id || p.sub)) return String(p.id || p._id || p.sub); } catch (e) {}
    return t.slice(-16);
  }
  const lkey = () => 'grove_cal_' + who();
  const list = () => Object.keys(ov).sort().map(d => ({ d, h: ov[d].h, n: ov[d].n || '' }));
  function fromList(l) { const o = {}; (l || []).forEach(x => { if (x && /^\d{4}-\d{2}-\d{2}$/.test(x.d)) o[x.d] = x.h ? { h: x.h === 2 ? 2 : 1, n: String(x.n || '').slice(0, 60) } : { h: 0 }; }); return o; }
  const noteList = () => Object.keys(nt).sort().map(d => ({ d, n: nt[d].n || '', t: nt[d].t.map(i => ({ x: i.x, d: !!i.d })) }));
  function fromNotes(l) { const o = {}; (l || []).forEach(x => { if (!x || !/^\d{4}-\d{2}-\d{2}$/.test(x.d)) return; const t = (Array.isArray(x.t) ? x.t : []).map(i => ({ x: String(i && i.x || '').slice(0, 120), d: !!(i && i.d) })).filter(i => i.x).slice(0, 40), n = String(x.n || '').slice(0, 1000); if (t.length || n.trim()) o[x.d] = { n, t }; }); return o; }
  const hasNote = d => !!(nt[d] && (nt[d].t.length || (nt[d].n || '').trim()));
  const todoLeft = d => nt[d] ? nt[d].t.filter(i => !i.d).length : 0;
  function saveLocal(dirty) { try { localStorage.setItem(lkey(), JSON.stringify({ dirty: !!dirty, days: list(), notes: noteList() })); } catch (e) {} }
  async function pushServer() {
    clearTimeout(saveT); saveT = 0;
    const A = api(); if (!A || !A.saveHolidays || !token()) return;
    if (saving) { again = true; return; }
    saving = true;
    try { await A.saveHolidays(list()); if (A.saveCalNotes) await A.saveCalNotes(noteList()); saveLocal(false); setNote('Saved'); }
    catch (e) { setNote('Saved on this device'); }
    saving = false;
    if (again) { again = false; pushServer(); }
  }
  function changed() { saveLocal(true); clearTimeout(saveT); saveT = setTimeout(pushServer, 700); setNote('Saving…'); }
  async function load() {
    const my = ++loaded; let local = null;
    try { local = JSON.parse(localStorage.getItem(lkey()) || 'null'); } catch (e) {}
    if (local && Array.isArray(local.days)) { ov = fromList(local.days); nt = fromNotes(local.notes); paint(); }
    const A = api(); if (!A || !A.getHolidays || !token()) return;
    try {
      const srv = await A.getHolidays();
      if (my !== loaded || !isOpen) return;
      if (local && local.dirty) { pushServer(); return; }
      let sn = null; if (A.getCalNotes) { try { sn = await A.getCalNotes(); } catch (e) {} }
      if (my !== loaded || !isOpen) return;
      ov = fromList(srv); if (Array.isArray(sn)) nt = fromNotes(sn); saveLocal(false); if (!typingNote()) paint();
    } catch (e) {}
  }

  /* ------------------------------------------------------------ what a day is */
  const baseOf = d => D.holidays[d] ? 'holiday' : dow(d) === 0 || dow(d) === 6 ? 'off' : 'working';
  const statusOf = d => (ov[d] ? (ov[d].h === 2 ? 'exam' : ov[d].h ? 'holiday' : 'working') : baseOf(d));
  const occasionOf = d => (ov[d] && ov[d].h === 2 ? (ov[d].n || 'Exam time: study day') : ov[d] && ov[d].h ? (ov[d].n || 'A day off you added') : ov[d] ? '' : D.holidays[d] || '');

  /* ------------------------------------------------------------ build */
  function build() {
    root = mk('div'); root.id = 'cal'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'School holidays calendar');
    root.innerHTML = '<div class="cal-blur"></div><div id="cal-stage"><img class="cal-bg" src="ui/board.png" alt="" draggable="false">' +
      '<div id="cal-months" role="tablist" aria-label="Months"></div><div id="cal-sheet"></div><div id="cal-side"></div>' +
      '<button id="cal-back" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>Back to the Grove<kbd>ESC</kbd></button>' +
      '<div id="cal-status"><span class="so">Holidays · ' + esc(D.school) + '</span><span class="sa"></span></div>' +
      '<button id="cal-today" type="button" data-tip="Jump to the month you are in now"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="12" cy="15" r="1.6" fill="currentColor"/></svg><span>Today</span></button></div>';
    document.body.appendChild(root);
    stage = $('#cal-stage', root); monthsEl = $('#cal-months', root); sheetEl = $('#cal-sheet', root); sideEl = $('#cal-side', root); todayBtn = $('#cal-today', root);
    $('#cal-back', root).onclick = close;
    todayBtn.onclick = () => { const t = todayKey(), i = monthIdx(t); view = idxMonth(clamp(i, FIRST, LAST)); sel = (i >= FIRST && i <= LAST) ? t : null; snd('flip'); paint(); };
    monthsEl.addEventListener('click', ev => { const b = ev.target.closest('.mp'); if (b) goMonth(b.dataset.m); });
    sheetEl.addEventListener('click', ev => {
      const nv = ev.target.closest('.nv'); if (nv) { goMonth(idxMonth(clamp(monthIdx(view) + (+nv.dataset.s), FIRST, LAST))); return; }
      const c = ev.target.closest('.cd'); if (c && c.dataset.d) { sel = sel === c.dataset.d ? null : c.dataset.d; snd('select'); paint(); }
    });
    sideEl.addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return; const a = b.dataset.a;
      if (a === 'x') { sel = null; paint(); return; }
      if (a === 'goto') { sel = b.dataset.d; view = sel.slice(0, 7); snd('select'); paint(); return; }
      if (!sel) return;
      if (a === 'tadd') { addTodo(); return; }
      if (a === 'ttog') { const it = nt[sel] && nt[sel].t[+b.dataset.i]; if (it) { it.d = !it.d; noteEdit(); snd(it.d ? 'confirm' : 'select'); paint(); } return; }
      if (a === 'tdel') { if (nt[sel]) { nt[sel].t.splice(+b.dataset.i, 1); noteEdit(); snd('whoosh'); paint(); } return; }
      if (a === 'hol') { const inp = $('.why', sideEl); setDay(sel, inp ? inp.value : ''); }
      else if (a === 'exam') { const inp = $('.why', sideEl); setExam(sel, inp ? inp.value : ''); }
      else if (a === 'work') { if (baseOf(sel) === 'working') delete ov[sel]; else ov[sel] = { h: 0 }; afterEdit('Back to a working day'); }
      else if (a === 'reset') { delete ov[sel]; afterEdit('Back to the school planner'); }
    });
    sideEl.addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target.classList.contains('todo-in')) { ev.preventDefault(); addTodo(); return; } if (ev.key === 'Enter' && ev.target.classList.contains('why')) { ev.preventDefault(); if (sel && ov[sel] && ov[sel].h) ev.target.blur(); else { const b = $('[data-a="hol"]', sideEl); if (b) b.click(); } } });
    sideEl.addEventListener('change', ev => { if (ev.target.classList.contains('why') && sel && ov[sel] && ov[sel].h) { ov[sel].n = ev.target.value.replace(/\s+/g, ' ').trim().slice(0, 60); changed(); paint(); } });
    sideEl.addEventListener('input', ev => {
      if (!ev.target.classList.contains('dnote') || !sel) return;
      const v = ev.target.value.replace(/[<>]/g, '').slice(0, 1000);
      if (!nt[sel]) nt[sel] = { n: '', t: [] };
      nt[sel].n = v; if (!hasNote(sel)) delete nt[sel];
      noteEdit(true);
    });
    sideEl.addEventListener('focusout', ev => { if (ev.target.classList.contains('dnote')) { const c = sheetEl.querySelector('.cd[data-d="' + sel + '"]'); if (c) paintSheet(); } });
    addEventListener('resize', fit);
    addEventListener('keydown', ev => {
      if (!isOpen) return;
      const inInput = !!(ev.target.closest && ev.target.closest('input,textarea'));
      if (ev.key === 'Escape') { ev.preventDefault(); if (inInput) { ev.target.blur(); return; } if (sel) { sel = null; paint(); } else close(); return; }
      if (inInput) return;
      if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') { ev.preventDefault(); goMonth(idxMonth(clamp(monthIdx(view) - 1, FIRST, LAST))); }
      else if (ev.key === 'ArrowRight' || ev.key === 'PageDown') { ev.preventDefault(); goMonth(idxMonth(clamp(monthIdx(view) + 1, FIRST, LAST))); }
    }, true);
    addEventListener('pagehide', () => { if (isOpen && saveT) saveLocal(true); });
    built = true;
  }
  function fit() { scale = Math.min(innerWidth / W, innerHeight / H); if (stage) stage.style.setProperty('--s', scale); }
  let noteT = 0;
  function setNote(t) { if (!root) return; const a = $('#cal-status .sa', root); a.textContent = t; clearTimeout(noteT); if (t) noteT = setTimeout(() => { a.textContent = ''; }, 2200); }
  function goMonth(m) { if (monthIdx(m) < FIRST || monthIdx(m) > LAST) return; if (m !== view) { view = m; if (sel && sel.slice(0, 7) !== m) sel = null; snd('flip'); } paint(); }

  /* ------------------------------------------------------------ to-dos and notes beside a day */
  const typingNote = () => { const a = document.activeElement; return !!(a && a.classList && (a.classList.contains('dnote') || a.classList.contains('todo-in'))); };
  function noteEdit(quiet) { if (sel && nt[sel] && !hasNote(sel)) delete nt[sel]; changed(); if (!quiet) paintSheet(); }
  function addTodo() {
    const inp = $('.todo-in', sideEl); if (!inp || !sel) return;
    const x = inp.value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!x) { inp.focus(); return; }
    if (!nt[sel]) nt[sel] = { n: '', t: [] };
    if (nt[sel].t.length >= 40) { setNote('That day has 40 to-dos already'); return; }
    nt[sel].t.push({ x, d: false }); noteEdit(); snd('confirm'); paint();
    const again = $('.todo-in', sideEl); if (again) again.focus();
  }
  function notesBlock(d) {
    const n = nt[d] || { n: '', t: [] };
    const rows = n.t.map((i, k) => '<li class="td' + (i.d ? ' done' : '') + '"><button type="button" class="tk" data-a="ttog" data-i="' + k + '" aria-pressed="' + !!i.d + '" aria-label="' + (i.d ? 'Mark not done' : 'Mark done') + '">' + (i.d ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.8"/></svg>' : '') + '</button><span>' + esc(i.x) + '</span><button type="button" class="tx" data-a="tdel" data-i="' + k + '" aria-label="Remove">×</button></li>').join('');
    return '<div class="nb"><h4>To do</h4>' + (rows ? '<ul class="tl">' + rows + '</ul>' : '<p class="tnone">Nothing to do yet.</p>') +
      '<div class="tadd"><input class="todo-in" maxlength="120" placeholder="Add something to do…" autocomplete="off" aria-label="New to-do"><button type="button" class="tplus" data-a="tadd" aria-label="Add to-do">+</button></div>' +
      '<h4 class="nh">Notes</h4><textarea class="dnote" maxlength="1000" rows="4" placeholder="Write a note for this day…" aria-label="Notes for this day">' + esc(n.n || '') + '</textarea></div>';
  }
  function monthTodos(m) {   /* open to-dos in the month shown, for the overview */
    return Object.keys(nt).filter(d => d.slice(0, 7) === m && todoLeft(d) > 0).sort();
  }

  /* ------------------------------------------------------------ changing a day */
  function setDay(d, note) {   /* a working day becomes a holiday (a planner holiday that you had switched off just goes back to the planner) */
    if (baseOf(d) !== 'working') delete ov[d];
    else ov[d] = { h: 1, n: String(note || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60) };
    afterEdit('Marked as a holiday');
  }
  function setExam(d, note) {   /* any day (working day, holiday or Sunday) can become an exam day: red, study only */
    ov[d] = { h: 2, n: String(note || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60) };
    afterEdit('Marked as an exam day');
  }
  function afterEdit(msg) { changed(); setNote(msg); snd('confirm'); paint(); }

  /* ------------------------------------------------------------ painting */
  const ICO = {
    flag: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 14V2.5M3.5 3h8l-2 2.6 2 2.6h-8"/></svg>',
    pen: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 13.5l.8-3L11 2.8a1.4 1.4 0 012 2L5.3 12.7zM9.8 4l2.2 2.2"/></svg>',
    star: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8l1.9 4 4.3.5-3.2 3 .9 4.3L8 11.5l-3.9 2.1.9-4.3-3.2-3 4.3-.5z"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>', next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>'
  };
  function stats(m) {
    const [y, mo] = parts(m), n = dim(y, mo); let hol = 0, off = 0, work = 0, exam = 0;
    for (let d = 1; d <= n; d++) { const s = statusOf(key(y, mo, d)); if (s === 'holiday') hol++; else if (s === 'off') off++; else if (s === 'exam') exam++; else work++; }
    return { hol, off, work, exam, n };
  }
  function paint() {
    if (!built) return;
    fit();
    /* month tabs */
    let h = '';
    for (let i = FIRST; i <= LAST; i++) { const m = idxMonth(i), [y, mo] = parts(m); h += '<button type="button" class="mp' + (m === view ? ' on' : '') + '" role="tab" aria-selected="' + (m === view) + '" data-m="' + m + '"><b>' + MS[mo - 1] + '</b><small>' + String(y).slice(2) + '</small></button>'; }
    monthsEl.innerHTML = h;
    todayBtn.classList.toggle('off', monthIdx(todayKey()) < FIRST || monthIdx(todayKey()) > LAST);
    paintSheet(); paintSide();
  }
  function paintSheet() {
    const [y, mo] = parts(view), first = dow(key(y, mo, 1)), n = dim(y, mo), rows = Math.ceil((first + n) / 7), td = todayKey(), info = D.months[view] || {};
    const w = 982, hgt = 500;
    let g = '';
    for (let i = 0; i < first; i++) g += '<i class="cd out"></i>';
    for (let d = 1; d <= n; d++) {
      const k = key(y, mo, d), s = statusOf(k), o = ov[k], mine = !!o, label = DAYS[dow(k)] + ' ' + d + ' ' + MONTHS[mo - 1] + ', ' + (s === 'holiday' ? 'holiday' : s === 'exam' ? 'exam day' : s === 'off' ? 'weekly off' : 'working day') + (D.events[k] ? ', school events' : '') + (hasNote(k) ? ', has notes' : '');
      const cls = ['cd', s, mine ? 'mine' : '', k === td ? 'today' : '', k === sel ? 'sel' : '', D.events[k] ? 'has' : ''].filter(Boolean).join(' ');
      g += '<button type="button" class="' + cls + '" data-d="' + k + '" aria-label="' + esc(label) + '" aria-pressed="' + (k === sel) + '"><span class="n">' + d + '</span>' +
        (s === 'holiday' ? '<span class="ic">' + (mine ? ICO.star : ICO.flag) + '</span>' : s === 'exam' ? '<span class="ic">' + ICO.pen + '</span>' : '') + (s === 'working' && mine ? '<span class="wk">W</span>' : '') + (D.events[k] ? '<em class="dot"></em>' : '') + (hasNote(k) ? '<i class="nt" aria-hidden="true"></i>' : '') + '</button>';
    }
    sheetEl.innerHTML = '<div class="paper ps-notice cs" style="left:0;top:0;width:' + w + 'px;height:' + hgt + 'px;--r:-.25deg"><div class="sheet-wrap"><div class="sheet" style="clip-path:' + edge(w, hgt, monthIdx(view) * 7 + 3) + '"><div class="sheet-border"></div></div></div>' +
      '<div class="deco d-pin" style="left:34px;margin-left:0"></div><div class="deco d-pin red" style="left:auto;right:34px;margin-left:0"></div>' +
      '<div class="cs-head"><button type="button" class="nv" data-s="-1" aria-label="Previous month"' + (monthIdx(view) <= FIRST ? ' disabled' : '') + '>' + ICO.back + '</button>' +
      '<div class="ttl"><h2>' + MONTHS[mo - 1] + ' <span>' + y + '</span></h2>' + (info.theme ? '<p>' + esc(info.theme) + '</p>' : '') + '</div>' +
      '<button type="button" class="nv" data-s="1" aria-label="Next month"' + (monthIdx(view) >= LAST ? ' disabled' : '') + '>' + ICO.next + '</button></div>' +
      '<div class="cs-wd">' + DAYS.map((x, i) => '<span' + (i === 0 || i === 6 ? ' class="sn"' : '') + '>' + x.slice(0, 3) + '</span>').join('') + '</div>' +
      '<div class="cs-grid" style="--rows:' + rows + '">' + g + '</div></div>';
  }
  function paintSide() {
    const d = sel, [y, mo] = parts(view);
    let h = '<div class="paper ps-parch sp" style="left:12px;top:34px;width:272px;height:610px;--r:0deg"><div class="sheet-wrap"><div class="sheet" style="clip-path:' + edge(272, 610, 41) + '"></div></div><div class="deco d-pin gold"></div><div class="sp-in">';
    if (!d) h += overview(y, mo); else h += detail(d);
    const keep = $('.sp-in', sideEl), top = keep && d === paintSide.last ? keep.scrollTop : 0; paintSide.last = d;
    sideEl.innerHTML = '<div class="th">DAY BOOK</div>' + h + '</div></div>';
    if (top) { const n = $('.sp-in', sideEl); if (n) n.scrollTop = top; }
  }
  function monthTodosHTML(m) {
    const ds = monthTodos(m); if (!ds.length) return '';
    return '<div class="mt todos"><h4>Your to-dos this month</h4><ul class="tl sm">' + ds.slice(0, 6).map(d => '<li><button type="button" class="tgo" data-a="goto" data-d="' + d + '"><b>' + parts(d)[2] + ' ' + MS[parts(d)[1] - 1] + '</b> ' + esc(nt[d].t.find(i => !i.d).x) + (todoLeft(d) > 1 ? ' <small>+' + (todoLeft(d) - 1) + ' more</small>' : '') + '</button></li>').join('') + '</ul></div>';
  }
  function overview(y, mo) {
    const m = view, s = stats(m), info = D.months[m] || {}, td = todayKey();
    let nxt = null;   /* the next holiday from today (its name is only shown after you click it) */
    if (td >= D.first + '-01') for (let i = 1; i < 400 && !nxt; i++) { const t = new Date(Date.UTC(...parts(td).map((v, j) => (j === 1 ? v - 1 : v))) + i * 864e5), k = key(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); if (statusOf(k) === 'holiday' && monthIdx(k) <= LAST) nxt = { k, i }; }
    return '<h3>' + MONTHS[mo - 1] + ' at a glance</h3>' +
      '<div class="cnt"><div class="c1"><b>' + s.hol + '</b><span>holiday' + (s.hol === 1 ? '' : 's') + '</span></div><div class="c2"><b>' + s.work + '</b><span>school day' + (s.work === 1 ? '' : 's') + '</span></div><div class="c3"><b>' + s.off + '</b><span>weekend day' + (s.off === 1 ? '' : 's') + '</span></div></div>' +
      '<p class="hint">Tap a day to see what it is for, to change it, and to write your to-dos and notes.</p>' + monthTodosHTML(m) + + (s.exam ? '<p class="exn"><i class="k exam"></i><b>' + s.exam + '</b> exam day' + (s.exam === 1 ? '' : 's') + ' this month</p>' : '') +
      (nxt ? '<div class="nx"><span>Next holiday</span><button type="button" data-a="goto" data-d="' + nxt.k + '"><b>' + (nxt.i === 1 ? 'Tomorrow' : 'In ' + nxt.i + ' days') + '</b> · ' + DAYS[dow(nxt.k)].slice(0, 3) + ' ' + parts(nxt.k)[2] + ' ' + MS[parts(nxt.k)[1] - 1] + '</button></div>' : '') +
      '<div class="key"><h4>How to read it</h4><p><i class="k hol"></i>Holiday</p><p><i class="k off"></i>Saturday and Sunday, the weekly off (green too)</p><p><i class="k exam"></i>Exam day: study only</p><p><i class="k mine"></i>A day you changed</p><p><i class="k ev"></i>Something is on at school</p><p><i class="k tod"></i>Today</p></div>' +
      (info.house ? '<div class="mt"><h4>House on duty</h4><p>' + esc(info.house) + '</p></div>' : '') +
      (info.sub ? '<div class="mt"><h4>Theme</h4><p>' + esc(info.theme) + '<br><em>' + esc(info.sub) + '</em></p></div>' : '') +
      (info.notes && info.notes.length ? '<div class="mt"><h4>Planner notes</h4><ul>' + info.notes.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' : '');
  }
  function detail(d) {
    const [y, mo, dd] = parts(d), s = statusOf(d), o = ov[d], b = baseOf(d), occ = occasionOf(d), evs = D.events[d] || [];
    let chip = s === 'holiday' ? 'HOLIDAY' : s === 'exam' ? 'EXAM DAY' : s === 'off' ? 'WEEKLY OFF' : 'SCHOOL DAY';
    let h = '<button type="button" class="x" data-a="x" aria-label="Close this day">×</button><div class="dh"><div class="wd">' + DAYS[dow(d)] + '</div><div class="bn">' + dd + '</div><div class="my">' + MONTHS[mo - 1] + ' ' + y + '</div></div>' +
      '<div class="chip ' + s + '">' + chip + (o ? ' <small>(your change)</small>' : '') + '</div>';
    if (s === 'exam') h += '<div class="box occ exam"><h4>Exam day</h4><p>' + esc(occ) + '</p><small>Study time: nothing else on this day.</small></div>';
    else if (s === 'holiday') h += '<div class="box occ"><h4>Holiday for</h4><p>' + esc(occ) + '</p></div>';
    else if (s === 'off') h += '<div class="box"><h4>Weekly off</h4><p>Sunday: school is closed.</p></div>';
    else if (o && b === 'holiday') h += '<div class="box"><h4>The planner says</h4><p>Holiday: ' + esc(D.holidays[d]) + '. You marked this day as a working day.</p></div>';
    else if (o && b === 'off') h += '<div class="box"><h4>The planner says</h4><p>' + DAYS[dow(d)] + ', the weekly off. You marked this day as a working day.</p></div>';
    else h += '<div class="box"><h4>A normal school day</h4><p>No holiday in the school planner.</p></div>';
    if (evs.length) h += '<div class="box"><h4>At school</h4><ul>' + evs.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
    h += '<div class="act">';
    if (s === 'exam') {
      h += '<label class="lb" for="cal-why">What is the exam?</label><input id="cal-why" class="why" maxlength="60" value="' + esc(o ? o.n || '' : '') + '" placeholder="e.g. Maths unit test" autocomplete="off">';
      h += '<button type="button" class="cbtn" data-a="work"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="5" width="12" height="8.5" rx="1.5"/><path d="M5.5 5V3.5h5V5"/></svg>Make it a working day</button>';
      h += '<button type="button" class="cbtn go" data-a="hol"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 14V2.5M3.5 3h8l-2 2.6 2 2.6h-8"/></svg>Make it a holiday</button>';
    } else {
      if (s === 'working' && b === 'working') h += '<label class="lb" for="cal-why">What is it for? <small>(optional)</small></label><input id="cal-why" class="why" maxlength="60" placeholder="e.g. Family trip or Maths exam" autocomplete="off"><button type="button" class="cbtn go" data-a="hol"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 14V2.5M3.5 3h8l-2 2.6 2 2.6h-8"/></svg>Make it a holiday</button>';
      else if (s === 'working') h += '<button type="button" class="cbtn go" data-a="hol"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 14V2.5M3.5 3h8l-2 2.6 2 2.6h-8"/></svg>Make it a holiday again</button>';
      else {
        if (o && o.h) h += '<label class="lb" for="cal-why">What is it for?</label><input id="cal-why" class="why" maxlength="60" value="' + esc(o.n || '') + '" placeholder="e.g. Family trip" autocomplete="off">';
        h += '<button type="button" class="cbtn" data-a="work"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="5" width="12" height="8.5" rx="1.5"/><path d="M5.5 5V3.5h5V5"/></svg>Make it a working day</button>';
      }
      h += '<button type="button" class="cbtn exam" data-a="exam">' + ICO.pen + 'Make it an exam day</button>';
    }
    if (o) h += '<button type="button" class="lnk" data-a="reset">Put it back as the school planner has it</button>';
    return h + '</div>' + notesBlock(d);
  }

  /* ------------------------------------------------------------ open / close */
  function open() {
    if (!built) build();
    isOpen = true; sel = null; view = D.start;
    root.classList.add('open'); setNote('');
    paint(); snd('flip'); load();
  }
  function close() {
    if (!isOpen) return;
    if (saveT) { saveLocal(true); pushServer(); }
    isOpen = false; root.classList.remove('open'); snd('back');
  }
  window.openCalendar = open; window.closeCalendar = close;
  setTimeout(() => { const i = new Image(); i.src = 'ui/board.png'; const j = new Image(); j.src = 'ui/tray_wood.jpg'; }, 3000);
})();
