/* ===== Notice board (the "Reminders" tab) =====
   Everybody can LOOK at a player's board. Only its owner can press "Edit board"; then a paper tray and a labelled toolbar
   appear and every paper / picture can be dragged, resized from 8 handles, rotated, restyled, duplicated or removed.
   Pictures (any type, transparent PNGs too) are shrunk in the browser, uploaded (/api/board/images) and can be switched to a
   "vintage" parchment look with one button. Saved per player: localStorage at once, and to the server a moment later.
   Opened with window.openBoard({ id, name, mine }); closed with Back or Esc. */
(function () {
  'use strict';
  if (window.openBoard) return;

  const W = 1671, H = 941;
  const BOARD = { x: 238, y: 232, w: 1022, h: 522 };   /* the wood the papers sit on (stage px) */
  const TRAY = { x: 1346, y: 122, w: 296, h: 656 };
  const MAX_ITEMS = 60, MAX_W = 1000, MAX_H = 1000, MAX_IMG_SIDE = 1600, MAX_IMG_BYTES = 4.5 * 1024 * 1024;
  const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=EB+Garamond:ital,wght@0,400;0,600;1,400&family=IM+Fell+English:ital@0;1&family=IM+Fell+English+SC&family=Uncial+Antiqua&family=MedievalSharp&family=Pirata+One&family=Almendra:ital,wght@0,400;0,700;1,400&family=Caveat:wght@500;700&family=Kalam&family=Special+Elite&display=swap';

  const FONTS = [
    { n: 'Cinzel', f: "'Cinzel','Trajan Pro',Georgia,serif" },
    { n: 'IM Fell English', f: "'IM Fell English','Palatino Linotype',Georgia,serif" },
    { n: 'IM Fell Small Caps', f: "'IM Fell English SC','IM Fell English',Georgia,serif" },
    { n: 'EB Garamond', f: "'EB Garamond',Garamond,Georgia,serif" },
    { n: 'Uncial Antiqua', f: "'Uncial Antiqua','Papyrus',fantasy" },
    { n: 'MedievalSharp', f: "'MedievalSharp','Papyrus',fantasy" },
    { n: 'Pirata One', f: "'Pirata One','UnifrakturCook',fantasy" },
    { n: 'Almendra', f: "'Almendra',Georgia,serif" },
    { n: 'Special Elite', f: "'Special Elite','Courier New',monospace" },
    { n: 'Caveat', f: "'Caveat','Segoe Script','Bradley Hand',cursive" },
    { n: 'Kalam', f: "'Kalam','Segoe Print',cursive" }
  ];
  const SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 60];
  const COLORS = [['Ink', '#2b1b0e'], ['Sepia', '#6b3d1a'], ['Blood red', '#8b1a1a'], ['Forest', '#2f5a2a'], ['Navy', '#1f3a5f'], ['Gold', '#a8741a'], ['Faded', '#7a7466']];
  const PRESETS = [
    { k: 'title', n: 'Title', cls: 'b-title', f: 0, st: 'font-weight:700;letter-spacing:.04em' },
    { k: 'head', n: 'Heading', cls: 'b-head', f: 0, st: 'font-weight:700' },
    { k: 'sub', n: 'Subheading', cls: 'b-sub', f: 1, st: 'font-style:italic' },
    { k: 'body', n: 'Body', cls: 'b-body', f: 3, st: '' },
    { k: 'fine', n: 'Fine print', cls: 'b-fine', f: 2, st: '' },
    { k: 'hand', n: 'Handwritten', cls: 'b-hand', f: 9, st: '' }
  ];
  const ENTER_NEXT = { 'b-title': 'b-body', 'b-head': 'b-body', 'b-sub': 'b-body' };
  const CLASSES = new Set(['b-title', 'b-head', 'b-sub', 'b-body', 'b-fine', 'b-hand', 'b-orn']);
  /* the papers in the tray: [key, name, width, height, deco] */
  const STYLES = {
    parch: { n: 'Parchment', w: 300, h: 370, deco: 'pin' },
    notice: { n: 'Notice', w: 390, h: 280, deco: 'pin red' },
    tea: { n: 'Tea-stained', w: 290, h: 330, deco: 'tape' },
    ledger: { n: 'Lined page', w: 290, h: 384, deco: 'clip' },
    slip: { n: 'Grey slip', w: 175, h: 400, deco: 'pin gold' },
    scrap: { n: 'Scrap', w: 210, h: 160, deco: 'tape l' },
    letter: { n: 'Sealed letter', w: 310, h: 380, deco: 'seal' },
    map: { n: 'Old map', w: 370, h: 280, deco: 'pin' }
  };
  const ORDER = ['parch', 'notice', 'tea', 'ledger', 'slip', 'scrap', 'letter', 'map'];
  /* the looks a picture can be switched to (fx 0 = the picture as it is) */
  const LOOKS = [{ k: 1, n: 'Parchment', tip: 'Warm parchment paper with a burnt, stained edge' }, { k: 2, n: 'Old photo', tip: 'Faded sepia photograph with a cream border' }, { k: 3, n: 'Ink sketch', tip: 'Brown ink drawing on old paper' }];
  /* resize handles: [x direction, y direction] */
  const DIRS = { nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0] };
  const HANDLE_ANGLE = { n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315 };

  const $ = (s, r) => (r || document).querySelector(s);
  const mk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const snd = n => { try { window.GroveFX && window.GroveFX.sound && window.GroveFX.sound.play(n); } catch (e) {} };
  const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const isImg = p => !!p && p.style === 'image';
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------------------------------------------------------------- sanitizing (what is allowed inside a paper) */
  const TAGS = new Set(['div', 'span', 'b', 'strong', 'i', 'em', 'u']);
  const fontFirst = f => String(f || '').split(',')[0].replace(/["']/g, '').trim().toLowerCase();
  const FONT_OK = new Set(FONTS.map(x => fontFirst(x.f)));
  function cleanStyle(raw) {
    if (!raw) return '';
    const t = document.createElement('span'); t.style.cssText = String(raw).slice(0, 600);
    const s = t.style, out = [];
    if (s.fontFamily && FONT_OK.has(fontFirst(s.fontFamily))) out.push('font-family:' + s.fontFamily);
    const fs = parseFloat(s.fontSize); if (/px$/.test(s.fontSize) && fs >= 8 && fs <= 80) out.push('font-size:' + Math.round(fs * 10) / 10 + 'px');
    if (/^(rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|#[0-9a-f]{3,8})$/i.test(s.color)) out.push('color:' + s.color);
    if (/^(left|center|right|justify)$/.test(s.textAlign)) out.push('text-align:' + s.textAlign);
    if (/^(normal|bold|[1-9]00)$/.test(s.fontWeight)) out.push('font-weight:' + s.fontWeight);
    if (/^(normal|italic)$/.test(s.fontStyle)) out.push('font-style:' + s.fontStyle);
    if (/underline/.test(s.textDecorationLine || s.textDecoration)) out.push('text-decoration:underline');
    return out.join(';');
  }
  function cleanInto(src, dst) {
    for (const c of Array.from(src.childNodes)) {
      if (c.nodeType === 3) { dst.appendChild(document.createTextNode(c.nodeValue)); continue; }
      if (c.nodeType !== 1) continue;
      const t = c.tagName.toLowerCase();
      if (t === 'br') { dst.appendChild(document.createElement('br')); continue; }
      if (t === 'script' || t === 'style') continue;
      if (!TAGS.has(t)) { cleanInto(c, dst); continue; }   /* unknown tag: keep only its text */
      const n = document.createElement(t);
      const cls = (c.getAttribute('class') || '').split(/\s+/).filter(x => CLASSES.has(x)); if (cls.length) n.className = cls.join(' ');
      const o = c.getAttribute('data-o'); if (/^[1-4]$/.test(o || '')) n.setAttribute('data-o', o);
      const st = cleanStyle(c.getAttribute('style')); if (st) n.setAttribute('style', st);
      cleanInto(c, n); dst.appendChild(n);
    }
  }
  function clean(html) {
    const d = new DOMParser().parseFromString('<body>' + String(html || '').slice(0, 40000) + '</body>', 'text/html');
    const box = document.createElement('div'); cleanInto(d.body, box);
    /* loose text / inline nodes at the top level become their own line */
    const out = document.createElement('div'); let line = null;
    for (const n of Array.from(box.childNodes)) {
      if (n.nodeType === 1 && n.tagName === 'DIV') { line = null; out.appendChild(n); }
      else { if (!line) { line = document.createElement('div'); line.className = 'b-body'; out.appendChild(line); } line.appendChild(n); }
    }
    out.querySelectorAll('div').forEach(d2 => { if (!d2.childNodes.length && !d2.classList.contains('b-orn')) d2.appendChild(document.createElement('br')); });
    return out.innerHTML;
  }
  const isBlank = html => { const d = document.createElement('div'); d.innerHTML = html; return !d.textContent.trim() && !d.querySelector('.b-orn'); };

  /* ---------------------------------------------------------------- state */
  let root, stage, boardEl, ghost, trayEl, barEl, hintEl, statusEl, selEl, fileEl, editBtn, menuEl = null;
  let scale = 1, isOpen = false, built = false;
  let owner = { id: null, name: '', mine: false }, editing = false;
  let items = [];             /* {id,style,x,y,w,h,rot,z,seed,html, img,fx,flip,alpha, el} */
  let selId = null, zTop = 10, touched = false, loadSeq = 0;
  let undoStack = [], redoStack = [], lastSnap = '[]', textT = 0, nudgeT = 0;
  const lastRange = new Map();

  const byId = id => items.find(p => p.id === id) || null;
  const cur = () => byId(selId);
  const edOf = p => (p && p.el ? p.el.querySelector('.txt') : null);

  function token() { try { return localStorage.getItem('grove_token') || ''; } catch (e) { return ''; } }
  const userKey = () => 'grove_board_' + (owner.id || 'guest');
  const api = () => window.GroveAPI;
  const imgUrl = p => p.src || (api() && api().boardImageUrl ? api().boardImageUrl(p.img) : '/api/board/images/' + p.img);

  /* ---------------------------------------------------------------- paper / picture rendering */
  function edgePolygon(w, h, seed) {
    const r = rng(seed), j = () => (0.4 + r() * 2.6) * (r() < 0.07 ? 2.2 : 1), step = () => 7 + r() * 11;
    const top = [], right = [], bot = [], left = [];
    for (let x = 0; x < w; x += step()) top.push([x, j()]);
    for (let y = 0; y < h; y += step()) right.push([w - j(), y]);
    for (let x = w; x > 0; x -= step()) bot.push([x, h - j()]);
    for (let y = h; y > 0; y -= step()) left.push([j(), y]);
    /* torn corners: top-left and/or bottom-right lose a small triangle */
    const q = rng(seed + 99), tl = q() < 0.5, br = q() < 0.45, t1 = 9 + q() * 14, t2 = 9 + q() * 14;
    let pts;
    if (tl) { const l2 = left.filter(p => p[1] > t1 * 1.4), t3 = top.filter(p => p[0] > t1); pts = [...t3, ...right, ...bot, ...left.length ? l2 : []]; pts.unshift([0, t1 * 1.4], [t1, 0]); pts = [...pts.slice(0, 2), ...pts.slice(2)]; }
    else pts = [...top, ...right, ...bot, ...left];
    if (br) { pts = pts.filter(p => !(p[0] > w - t2 * 1.2 && p[1] > h - t2 * 1.4)); const i = pts.findIndex(p => p[1] > h - 6 && p[0] < w - t2 * 1.2); if (i >= 0) pts.splice(i, 0, [w, h - t2 * 1.4], [w - t2 * 1.2, h]); }
    return 'polygon(' + pts.map(p => clamp(p[0], 0, w).toFixed(1) + 'px ' + clamp(p[1], 0, h).toFixed(1) + 'px').join(',') + ')';
  }
  function buildPaper(p, preview) {
    if (isImg(p)) return buildImage(p);
    const S = STYLES[p.style] || STYLES.parch;
    const e = mk('div', 'paper ps-' + (STYLES[p.style] ? p.style : 'parch'));
    e.dataset.id = p.id;
    e.innerHTML = '<div class="sheet-wrap"><div class="sheet"><div class="sheet-border"></div></div></div><div class="deco"></div>';
    const dp = S.deco.split(' '); e.querySelector('.deco').className = 'deco d-' + dp[0] + (dp[1] ? ' ' + dp[1] : '');
    if (!preview) {
      const t = mk('div', 'txt'); t.contentEditable = editing ? 'true' : 'false'; t.spellcheck = false; t.setAttribute('role', 'textbox'); t.setAttribute('aria-label', 'Note text');
      e.appendChild(t);
    }
    p.el = e; layout(p);
    return e;
  }
  function buildImage(p) {
    const e = mk('div', 'paper pi'); e.dataset.id = p.id;
    e.innerHTML = '<div class="sh"><div class="im"><img alt="" draggable="false"></div></div><div class="deco"></div>';
    p.el = e; setImgSrc(p); layout(p);
    return e;
  }
  function setImgSrc(p) {
    const u = imgUrl(p), im = $('.im', p.el);
    $('img', im).src = u; im.style.setProperty('--src', 'url("' + u + '")');
  }
  function layout(p) {
    const e = p.el; if (!e) return;
    e.style.left = p.x + 'px'; e.style.top = p.y + 'px'; e.style.width = p.w + 'px'; e.style.height = p.h + 'px';
    e.style.setProperty('--r', p.rot + 'deg'); e.style.zIndex = p.z;
    if (isImg(p)) {
      e.classList.remove('fx-1', 'fx-2', 'fx-3'); if (p.fx) e.classList.add('fx-' + p.fx);
      e.classList.toggle('alpha', !!p.alpha);
      e.style.setProperty('--fl', p.flip ? -1 : 1);
      const im = $('.im', e), torn = p.fx && p.fx !== 2 && !p.alpha;
      im.style.clipPath = torn ? edgePolygon(p.w, p.h, p.seed) : '';
      $('.deco', e).className = 'deco ' + (p.fx && !p.alpha ? 'd-tape' : 'd-none');
    } else {
      const sh = e.querySelector('.sheet'); if (sh) sh.style.clipPath = edgePolygon(p.w, p.h, p.seed);
    }
    if (p.id === selId) layoutSel(p);
  }
  function fillText(p, html) {
    const ed = edOf(p), fresh = isBlank(html || '');
    ed.innerHTML = fresh ? defaultHtml(p.style) : clean(html);
    ed.querySelectorAll('.b-orn').forEach(o => o.contentEditable = 'false');
    refreshEmpty(p);
  }
  function defaultHtml(style) {
    if (style === 'ledger' || style === 'scrap') return '<div class="b-body" data-ph="Write here…"><br></div>';
    if (style === 'slip') return '<div class="b-head" data-ph="Heading"><br></div><div class="b-body"><br></div>';
    return '<div class="b-title" data-ph="Title"><br></div><div class="b-body"><br></div>';
  }
  function refreshEmpty(p) {
    const ed = edOf(p); if (!ed) return;
    const empty = !ed.textContent.trim() && !ed.querySelector('.b-orn');
    p.el.classList.toggle('empty', empty);
    const f = ed.firstElementChild; if (f && !f.getAttribute('data-ph')) f.setAttribute('data-ph', f.classList.contains('b-title') ? 'Title' : f.classList.contains('b-head') ? 'Heading' : 'Write here…');
  }
  function wire(p) {
    const e = p.el;
    if (!isImg(p)) {
      const ed = edOf(p);
      ed.addEventListener('input', ev => { if (!editing) return; touched = true; enterFix(ed, ev); refreshEmpty(p); grow(p); changed(); scheduleTextCommit(); });
      ed.addEventListener('paste', ev => {
        ev.preventDefault(); if (!editing) return;
        const cd = ev.clipboardData || window.clipboardData, files = cd && cd.files && Array.from(cd.files).filter(f => /^image\//.test(f.type));
        if (files && files.length) { addImageFiles(files); return; }
        const t = cd.getData('text/plain');
        if (t) document.execCommand('insertText', false, t);
      });
      ed.addEventListener('drop', ev => ev.preventDefault());
      ed.addEventListener('focus', () => { if (editing) select(p.id); });
      ed.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Escape') ed.blur(); });
    }
    e.addEventListener('pointerdown', ev => itemDown(ev, p));
  }
  /* after Enter at the end of a title / heading / subheading, the next line is plain body text */
  function enterFix(ed, ev) {
    if (!ev || ev.inputType !== 'insertParagraph') return;
    const s = getSelection(); if (!s.rangeCount) return;
    let b = s.anchorNode; while (b && b.parentNode !== ed) b = b.parentNode;
    if (!b || b.nodeType !== 1) return;
    const prev = b.previousElementSibling;
    if (prev && !b.textContent && ENTER_NEXT[b.className] && prev.className === b.className) { b.className = ENTER_NEXT[b.className]; b.removeAttribute('style'); b.removeAttribute('data-ph'); }
    if (b.classList.contains('b-orn')) b.className = 'b-body';
  }
  /* a paper grows when the text no longer fits */
  function grow(p) {
    const ed = edOf(p); if (!ed) return;
    const over = ed.scrollHeight - ed.clientHeight;
    if (over > 1 && p.h < MAX_H) { p.h = Math.min(MAX_H, Math.ceil(p.h + over + 2)); layout(p); }
  }

  /* ---------------------------------------------------------------- selection (the Canva-style frame with handles) */
  function select(id, quiet) {
    if (!editing) return;
    if (selId === id) { updateBar(); return; }
    const old = byId(selId); if (old && old.el) old.el.classList.remove('sel');
    selId = id; const p = byId(id);
    if (p) { p.el.classList.add('sel'); if (!quiet) front(p); layoutSel(p); }
    updateBar();
  }
  function deselect() {
    if (!selId) return; const o = byId(selId); if (o && o.el) o.el.classList.remove('sel');
    selId = null; layoutSel(null); updateBar();
  }
  function front(p) { if (p.z < zTop || items.some(q => q !== p && q.z === p.z)) { p.z = ++zTop; p.el.style.zIndex = p.z; changed(); } }
  function layoutSel(p) {
    if (!selEl) return;
    if (!p || !editing || !p.el) { selEl.classList.remove('on'); return; }
    placeSel(BOARD.x + p.x, BOARD.y + p.y, p);
  }
  function placeSel(x, y, p) {   /* x, y = the top-left corner of the item in stage px */
    selEl.classList.add('on'); selEl.classList.toggle('img', isImg(p)); selEl.classList.toggle('small', p.w < 110 || p.h < 80);
    selEl.style.left = x + 'px'; selEl.style.top = y + 'px'; selEl.style.width = p.w + 'px'; selEl.style.height = p.h + 'px';
    selEl.style.transform = 'rotate(' + p.rot + 'deg)'; selEl.style.setProperty('--rn', p.rot);
    selEl.querySelectorAll('.hd').forEach(h => {
      const a = (((HANDLE_ANGLE[h.dataset.h] + p.rot) % 180) + 180) % 180, k = Math.round(a / 45) % 4;
      h.style.cursor = ['ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize'][k];
    });
  }
  function badge(txt) { const z = $('.hz', selEl); z.textContent = txt; z.classList.add('on'); }
  function hideBadge() { $('.hz', selEl).classList.remove('on'); }

  /* ---------------------------------------------------------------- pointer maths */
  function toStage(ev) { const r = stage.getBoundingClientRect(); return { x: (ev.clientX - r.left) / scale, y: (ev.clientY - r.top) / scale }; }
  const inRect = (pt, R) => pt.x >= R.x && pt.x <= R.x + R.w && pt.y >= R.y && pt.y <= R.y + R.h;
  function track(move, up) {
    const mv = e => { e.preventDefault(); move(e); };
    const fin = e => { window.removeEventListener('pointermove', mv, true); window.removeEventListener('pointerup', fin, true); window.removeEventListener('pointercancel', fin, true); up(e); };
    window.addEventListener('pointermove', mv, true); window.addEventListener('pointerup', fin, true); window.addEventListener('pointercancel', fin, true);
  }
  function itemDown(ev, p) {
    if (!editing) return;
    if (ev.button !== 0 && ev.pointerType === 'mouse') return;
    const inText = !isImg(p) && !!ev.target.closest('.txt');
    if (inText && document.activeElement === edOf(p)) { select(p.id); return; }   /* already writing: normal caret and text selection */
    select(p.id); ev.preventDefault();
    startMove(ev, p, inText);   /* a click without dragging puts the cursor in the text */
  }
  function focusAt(p, x, y) {
    const ed = edOf(p); if (!ed) return;
    ed.focus({ preventScroll: true });
    let r = null;
    if (document.caretRangeFromPoint) r = document.caretRangeFromPoint(x, y);
    else if (document.caretPositionFromPoint) { const c = document.caretPositionFromPoint(x, y); if (c) { r = document.createRange(); r.setStart(c.offsetNode, c.offset); r.collapse(true); } }
    const s = getSelection();
    if (r && ed.contains(r.startContainer)) { s.removeAllRanges(); s.addRange(r); }
    else { const e2 = document.createRange(); e2.selectNodeContents(ed); e2.collapse(false); s.removeAllRanges(); s.addRange(e2); }
  }

  /* ---- move (the item is lifted into the ghost layer so it is never clipped; dropping on the tray throws it away) */
  function startMove(ev, p, clickEdit) {
    ev.preventDefault();
    const e = p.el, pt0 = toStage(ev);
    const sx = BOARD.x + p.x, sy = BOARD.y + p.y, dx = pt0.x - sx, dy = pt0.y - sy;
    let moved = false, ax = sx, ay = sy;
    const lift = () => { if (moved) return; moved = true; ghost.appendChild(e); e.style.left = sx + 'px'; e.style.top = sy + 'px'; e.classList.add('lift'); const a = document.activeElement; if (a && a.blur) a.blur(); snd('flip'); };
    track(m => {
      const pt = toStage(m);
      if (!moved && Math.hypot(pt.x - pt0.x, pt.y - pt0.y) < 4) return;
      lift(); ax = pt.x - dx; ay = pt.y - dy; e.style.left = ax + 'px'; e.style.top = ay + 'px';
      placeSel(ax, ay, p);
      trayEl.classList.toggle('drop', inRect(pt, TRAY));
    }, u => {
      trayEl.classList.remove('drop');
      if (!moved) { if (clickEdit && editing) focusAt(p, u.clientX, u.clientY); return; }
      const pt = toStage(u);
      e.classList.remove('lift');
      if (inRect(pt, TRAY)) { removeItem(p, true); return; }
      const cx = clamp(ax + p.w / 2, BOARD.x + 30, BOARD.x + BOARD.w - 30), cy = clamp(ay + p.h / 2, BOARD.y + 30, BOARD.y + BOARD.h - 30);
      p.x = Math.round(cx - p.w / 2 - BOARD.x); p.y = Math.round(cy - p.h / 2 - BOARD.y);
      boardEl.appendChild(e); layout(p); snd('cell'); commit(); changed();
    });
  }
  /* ---- rotate around the centre; snaps to straight and to quarter / eighth turns (hold Alt for free turning) */
  function startRotate(ev, p) {
    ev.preventDefault(); const e = p.el;
    const c = { x: BOARD.x + p.x + p.w / 2, y: BOARD.y + p.y + p.h / 2 }, pt0 = toStage(ev);
    const a0 = Math.atan2(pt0.y - c.y, pt0.x - c.x), r0 = p.rot;
    e.classList.add('rotating');
    track(m => {
      const pt = toStage(m), a = Math.atan2(pt.y - c.y, pt.x - c.x);
      let r = r0 + (a - a0) * 180 / Math.PI;
      r = ((r + 540) % 360) - 180;
      if (!m.altKey) { const q = Math.round(r / 45) * 45; if (Math.abs(r - q) < 3.5) r = q; else r = Math.round(r * 2) / 2; }
      p.rot = clamp(r, -180, 180); layout(p); badge(Math.round(p.rot) + '°');
    }, () => { e.classList.remove('rotating'); hideBadge(); commit(); changed(); });
  }
  /* ---- resize from any of the 8 handles, measured along the item's own axes; the opposite side stays where it is.
        Corners keep a picture's shape (and a paper's, while Shift is held). */
  function startResize(ev, p, hk) {
    ev.preventDefault(); const e = p.el, d = DIRS[hk], sx = d[0], sy = d[1];
    const th = p.rot * Math.PI / 180, co = Math.cos(th), si = Math.sin(th);
    const w0 = p.w, h0 = p.h, c0 = { x: BOARD.x + p.x + w0 / 2, y: BOARD.y + p.y + h0 / 2 };
    const toW = (x, y) => ({ x: x * co - y * si, y: x * si + y * co }), toL = (x, y) => ({ x: x * co + y * si, y: -x * si + y * co });
    const a = toW(-sx * w0 / 2, -sy * h0 / 2), anchor = { x: c0.x + a.x, y: c0.y + a.y };
    const img = isImg(p), minW = img ? 24 : 110, minH = img ? 24 : 80, maxW = img ? 2000 : MAX_W, maxH = img ? 2000 : MAX_H;
    e.classList.add('resizing');
    track(m => {
      const pt = toStage(m), v = toL(pt.x - anchor.x, pt.y - anchor.y);
      let w = sx ? sx * v.x : w0, h = sy ? sy * v.y : h0;
      if (sx && sy && (img || m.shiftKey)) {
        const s = clamp(Math.max(w / w0, h / h0), Math.max(minW / w0, minH / h0), Math.min(maxW / w0, maxH / h0));
        w = w0 * s; h = h0 * s;
      } else { w = clamp(w, minW, maxW); h = clamp(h, minH, maxH); }
      const o = toW(sx * w / 2, sy * h / 2), c = { x: anchor.x + o.x, y: anchor.y + o.y };
      p.w = Math.round(w); p.h = Math.round(h); p.x = Math.round(c.x - BOARD.x - p.w / 2); p.y = Math.round(c.y - BOARD.y - p.h / 2);
      layout(p); badge(p.w + ' × ' + p.h);
    }, () => { e.classList.remove('resizing'); hideBadge(); grow(p); commit(); changed(); });
  }

  /* ---------------------------------------------------------------- adding / removing / duplicating */
  function newPaper(style) {
    const S = STYLES[style];
    return { id: uid(), style, x: 0, y: 0, w: S.w, h: S.h, rot: Math.round((Math.random() * 5 - 2.5) * 2) / 2, z: ++zTop, seed: (Math.random() * 1e9) | 0, html: '' };
  }
  function mount(p, html, into) {
    buildPaper(p, false); if (!isImg(p)) fillText(p, html); wire(p); (into || boardEl).appendChild(p.el);
  }
  function addPaperAt(style, cx, cy) {   /* cx, cy = centre in stage px */
    if (items.length >= MAX_ITEMS) { toast('The board is full. Take a paper down first.'); return null; }
    const p = newPaper(style);
    p.x = Math.round(clamp(cx - p.w / 2, BOARD.x + 30 - p.w, BOARD.x + BOARD.w - 30) - BOARD.x);
    p.y = Math.round(clamp(cy - p.h / 2, BOARD.y + 30 - p.h, BOARD.y + BOARD.h - 30) - BOARD.y);
    return p;
  }
  function commitNew(p, focus) {
    touched = true; items.push(p); mount(p, '');
    p.el.classList.add('pop'); setTimeout(() => p.el.classList && p.el.classList.remove('pop'), 320);
    select(p.id); updateHint(); commit(); changed();
    if (focus) setTimeout(() => { const ed = edOf(p); if (ed) { ed.focus({ preventScroll: true }); const s = getSelection(), r = document.createRange(); r.selectNodeContents(ed.firstElementChild || ed); r.collapse(true); s.removeAllRanges(); s.addRange(r); } }, 30);
    snd('pop');
  }
  let unT = 0;
  function removeItem(p) {
    if (!p) return; touched = true; const i = items.indexOf(p); if (i < 0) return;
    items.splice(i, 1); if (selId === p.id) { selId = null; layoutSel(null); updateBar(); }
    const e = p.el; e.classList.add('poof'); e.style.pointerEvents = 'none'; setTimeout(() => e.remove(), 300);
    snd('whoosh'); updateHint(); commit(); changed();
    setUndo((isImg(p) ? 'Picture' : 'Paper') + ' removed &nbsp;<button type="button" id="gb-undo">Undo</button>', 9000);
    const u = $('#gb-undo'); if (u) u.onclick = () => { undo(); setUndo(''); };
  }
  function duplicate(p) {
    if (!p) return;
    if (items.length >= MAX_ITEMS) return toast('The board is full. Take a paper down first.');
    if (isImg(p) && !p.img) return toast('Wait a moment, the picture is still being uploaded.');
    const d = serializeOne(p), q = hydrate(Object.assign({}, d, { id: uid(), x: p.x + 28, y: p.y + 28, seed: (Math.random() * 1e9) | 0 }));
    q.z = ++zTop; touched = true; items.push(q); mount(q, d.html); q.el.classList.add('pop'); setTimeout(() => q.el.classList && q.el.classList.remove('pop'), 320);
    select(q.id); updateHint(); commit(); changed(); snd('pop');
  }
  function hydrate(d) {
    const img = d.style === 'image';
    const o = { id: String(d.id || uid()).slice(0, 40), style: img ? 'image' : (STYLES[d.style] ? d.style : 'parch'), x: +d.x || 0, y: +d.y || 0,
      w: img ? clamp(+d.w || 300, 20, 2000) : clamp(+d.w || 300, 100, MAX_W), h: img ? clamp(+d.h || 300, 20, 2000) : clamp(+d.h || 300, 80, MAX_H),
      rot: clamp(+d.rot || 0, -180, 180), z: +d.z || 1, seed: (+d.seed || 1) | 0, html: String(d.html || '') };
    if (img) { o.img = /^[a-f0-9]{24}$/.test(String(d.img || '')) ? String(d.img) : ''; o.fx = clamp(Math.round(+d.fx || 0), 0, 3); o.flip = d.flip ? 1 : 0; o.alpha = d.alpha ? 1 : 0; }
    return o;
  }
  function updateHint() { hintEl.classList.toggle('off', items.length > 0); }

  /* ---------------------------------------------------------------- pictures: shrink in the browser, upload, pin */
  const hasFiles = ev => { const t = ev.dataTransfer && ev.dataTransfer.types; return !!t && Array.from(t).indexOf('Files') >= 0; };
  const toBlob = (cv, type, q) => new Promise(res => { try { cv.toBlob(b => res(b), type, q); } catch (e) { res(null); } });
  function loadImgEl(file) {
    return new Promise((res, rej) => {
      const u = URL.createObjectURL(file), im = new Image();
      im.onload = () => { URL.revokeObjectURL(u); res(im); };
      im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Your browser cannot open this picture type. Try a PNG, JPG, GIF or WebP.')); };
      im.src = u;
    });
  }
  function hasAlpha(src, w, h) {
    try {
      const k = Math.min(1, 128 / Math.max(w, h)), cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
      const c = document.createElement('canvas'); c.width = cw; c.height = ch; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0, cw, ch);
      const d = x.getImageData(0, 0, cw, ch).data; for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
    } catch (e) {}
    return false;
  }
  async function prepareImage(file) {
    let src, w, h;
    try { src = await createImageBitmap(file); w = src.width; h = src.height; }
    catch (e) { src = await loadImgEl(file); w = src.naturalWidth || 1000; h = src.naturalHeight || 750; }
    if (!w || !h) throw new Error('That picture could not be opened.');
    const alpha = hasAlpha(src, w, h), k0 = Math.min(1, MAX_IMG_SIDE / Math.max(w, h));
    if (file.type === 'image/gif' && file.size <= MAX_IMG_BYTES) return { blob: file, w: Math.round(w * k0), h: Math.round(h * k0), alpha };   /* keeps an animated GIF moving */
    let side = k0, blob = null, cw = w, ch = h;
    for (let i = 0; i < 7; i++) {
      cw = Math.max(1, Math.round(w * side)); ch = Math.max(1, Math.round(h * side));
      const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; cv.getContext('2d').drawImage(src, 0, 0, cw, ch);
      blob = await toBlob(cv, 'image/webp', 0.92);
      if (!blob || blob.type !== 'image/webp') blob = alpha ? await toBlob(cv, 'image/png') : await toBlob(cv, 'image/jpeg', 0.9);
      if (blob && blob.size <= MAX_IMG_BYTES) break;
      side *= 0.75;
    }
    if (src.close) try { src.close(); } catch (e) {}
    if (!blob || blob.size > 5 * 1024 * 1024) throw new Error('That picture is too big to pin.');
    return { blob, w: cw, h: ch, alpha };
  }
  async function addImageFiles(files, cx, cy) {
    if (!editing) return;
    const list = Array.from(files || []).filter(f => /^image\//.test(f.type) || /\.(png|jpe?g|gif|webp|bmp|avif|svg|ico)$/i.test(f.name || '')).slice(0, 10);
    if (!list.length) { toast('Please choose a picture (PNG, JPG, GIF, WebP, SVG…).'); return; }
    if (!token()) { toast('Please log in again to pin pictures.'); return; }
    let n = 0;
    for (const f of list) {
      if (items.length >= MAX_ITEMS) { toast('The board is full. Take a paper down first.'); break; }
      try { placeImage(await prepareImage(f), cx, cy, n++); } catch (e) { toast(e.message || 'That picture could not be opened.'); }
    }
  }
  function placeImage(pr, cx, cy, n) {
    const k = Math.min(1, 420 / pr.w, 330 / pr.h), w = Math.max(30, Math.round(pr.w * k)), h = Math.max(30, Math.round(pr.h * k));
    const mx = (cx == null ? BOARD.x + BOARD.w / 2 : cx) + n * 28, my = (cy == null ? BOARD.y + BOARD.h / 2 : cy) + n * 28;
    const p = { id: uid(), style: 'image', x: Math.round(clamp(mx - w / 2, BOARD.x + 30 - w, BOARD.x + BOARD.w - 30) - BOARD.x), y: Math.round(clamp(my - h / 2, BOARD.y + 30 - h, BOARD.y + BOARD.h - 30) - BOARD.y),
      w, h, rot: 0, z: ++zTop, seed: (Math.random() * 1e9) | 0, html: '', img: '', fx: 0, flip: 0, alpha: pr.alpha ? 1 : 0, src: URL.createObjectURL(pr.blob) };
    touched = true; items.push(p); mount(p, ''); p.el.classList.add('pop'); setTimeout(() => p.el.classList && p.el.classList.remove('pop'), 320);
    select(p.id); updateHint(); snd('pop'); setStatus('Uploading picture…');
    const A = api();
    (A && A.uploadBoardImage ? A.uploadBoardImage(pr.blob) : Promise.reject(new Error('Pictures cannot be saved right now.'))).then(d => {
      if (items.indexOf(p) < 0) return;
      p.img = d.id; commit(); changed(); setStatus('Picture pinned', 1800);
    }).catch(e => {
      const i = items.indexOf(p); if (i >= 0) { items.splice(i, 1); p.el.remove(); if (selId === p.id) { selId = null; layoutSel(null); updateBar(); } updateHint(); }
      toast(e.message || 'The picture could not be uploaded.'); setStatus('');
    });
  }

  /* ---------------------------------------------------------------- the tray */
  function buildTray() {
    trayEl.innerHTML = '<div class="th">PAPER STOCK</div><div class="grid"></div><div class="tf">drag a sheet onto the board</div><div class="tv"></div>';
    const grid = $('.grid', trayEl);
    ORDER.forEach((k, i) => {
      const S = STYLES[k], b = mk('button', 'ti'); b.type = 'button'; b.title = S.n + ' (drag onto the board, or click)'; b.setAttribute('aria-label', 'Add ' + S.n + ' paper');
      const pv = mk('div', 'pv'), k0 = Math.min(118 / S.w, 108 / S.h);
      const pp = { id: 'pv' + k, style: k, x: -S.w / 2, y: -S.h / 2, w: S.w, h: S.h, rot: [-3, 2, -2, 3, -1.5, 2.5, -2.5, 1.5][i], z: 1, seed: 1000 + i * 37, html: '' };
      const pe = buildPaper(pp, true); pe.style.setProperty('--r', pp.rot + 'deg'); pe.style.transform = 'rotate(var(--r)) scale(' + k0 + ')';
      pv.appendChild(pe); b.appendChild(pv); b.appendChild(mk('em', '', S.n)); grid.appendChild(b);
      b.dataset.k0 = k0; b.dataset.k = k; b.dataset.r = pp.rot;
      b.addEventListener('pointerdown', ev => trayDown(ev, b));
      b.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); spawnAuto(k); } });
    });
    [['ui/tray_vine_top.png', 1346, 84, 314], ['ui/tray_vine_bot.png', 1330, 700, 150]].forEach(a => { const im = new Image(); im.className = 'gb-vine'; im.draggable = false; im.alt = ''; im.src = a[0]; im.style.cssText = 'left:' + a[1] + 'px;top:' + a[2] + 'px;width:' + a[3] + 'px;z-index:3'; stage.appendChild(im); });
  }
  function spawnAuto(k) {
    if (!editing) return;
    const n = items.length, x = BOARD.x + 200 + ((n * 61) % 560), y = BOARD.y + 150 + ((n * 47) % 200);
    const p = addPaperAt(k, x, y); if (p) commitNew(p, true);
  }
  function trayDown(ev, btn) {
    if (!editing) return;
    if (ev.button !== 0 && ev.pointerType === 'mouse') return;
    ev.preventDefault();
    const k = btn.dataset.k, pt0 = toStage(ev), S = STYLES[k], k0 = +btn.dataset.k0, r0 = +btn.dataset.r;
    let p = null, e = null;
    const begin = pt => {
      if (items.length >= MAX_ITEMS) { toast('The board is full. Take a paper down first.'); return false; }
      p = newPaper(k); p.rot = r0; buildPaper(p, false); fillText(p, ''); e = p.el; e.classList.add('lift');
      ghost.appendChild(e); e.style.left = (pt.x - S.w / 2) + 'px'; e.style.top = (pt.y - S.h / 2) + 'px';
      e.style.transform = 'rotate(var(--r)) scale(' + k0 + ')'; e.style.transition = 'transform .2s cubic-bezier(.2,1.2,.4,1)';
      requestAnimationFrame(() => { e.style.transform = 'rotate(var(--r)) scale(1)'; setTimeout(() => { e.style.transition = ''; e.style.transform = ''; }, 230); });
      snd('flip'); return true;
    };
    track(m => {
      const pt = toStage(m);
      if (!p) { if (Math.hypot(pt.x - pt0.x, pt.y - pt0.y) < 6) return; if (!begin(pt)) return; }
      if (!e) return;
      e.style.left = (pt.x - S.w / 2) + 'px'; e.style.top = (pt.y - S.h / 2) + 'px';
    }, u => {
      if (!p) { spawnAuto(k); return; }   /* a plain click puts the paper on the board for you */
      const pt = toStage(u); e.classList.remove('lift');
      if (!inRect(pt, BOARD)) { e.classList.add('poof'); setTimeout(() => e.remove(), 300); return; }
      p.x = Math.round(clamp(pt.x - S.w / 2, BOARD.x + 30 - S.w, BOARD.x + BOARD.w - 30) - BOARD.x);
      p.y = Math.round(clamp(pt.y - S.h / 2, BOARD.y + 30 - S.h, BOARD.y + BOARD.h - 30) - BOARD.y);
      e.remove(); p.el = null; commitNew(p, true);
    });
  }

  /* ---------------------------------------------------------------- text editing helpers */
  const inEd = (ed, n) => !!n && ed.contains(n.nodeType === 3 ? n.parentNode : n);
  function curRange(ed) { const s = getSelection(); if (s.rangeCount && inEd(ed, s.anchorNode) && inEd(ed, s.focusNode)) return s.getRangeAt(0); return null; }
  /* make sure the cursor is inside the selected paper before a toolbar command runs */
  function withEd(fn) {
    const p = cur(); if (!p || isImg(p)) return; const ed = edOf(p);
    if (!curRange(ed)) {
      ed.focus({ preventScroll: true });
      const s = getSelection(), saved = lastRange.get(p.id);
      if (saved && inEd(ed, saved.startContainer)) { s.removeAllRanges(); s.addRange(saved); }
      else { const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); s.removeAllRanges(); s.addRange(r); }
    }
    fn(ed, p); touched = true; refreshEmpty(p); grow(p); commit(); changed(); updateBar();
  }
  function blocksIn(ed) {
    const s = getSelection(); if (!s.rangeCount) return [];
    const r = s.getRangeAt(0), out = [];
    for (const c of Array.from(ed.children)) {
      if (!r.intersectsNode(c)) continue;
      if (!r.collapsed) { const t = document.createRange(); t.selectNodeContents(c); t.setEnd(r.endContainer, r.endOffset); if (!t.toString().length && c !== ed.firstElementChild && r.startContainer !== c) { if (!inEd(c, r.startContainer)) continue; } }
      out.push(c);
    }
    return out.length ? out : (ed.lastElementChild ? [ed.lastElementChild] : []);
  }
  function setPreset(ed, key) {
    const P = PRESETS.find(x => x.k === key);
    blocksIn(ed).forEach(b => {
      if (b.classList.contains('b-orn')) return;
      b.className = P.cls; b.removeAttribute('style'); b.removeAttribute('data-ph');
      b.querySelectorAll('[style]').forEach(s => { s.style.removeProperty('font-size'); s.style.removeProperty('font-family'); s.style.removeProperty('font-weight'); s.style.removeProperty('font-style'); if (!s.getAttribute('style')) s.removeAttribute('style'); });
    });
  }
  /* style the selection (or the whole line when nothing is selected). The browser's own "fontSize" command marks the
     selection with <font size=7>; those marks are then turned into spans carrying exactly the style we want. */
  function applyInline(ed, css) {
    const s = getSelection(); if (!s.rangeCount) return; const r = s.getRangeAt(0);
    if (r.collapsed) { blocksIn(ed).forEach(b => { if (b.classList.contains('b-orn')) return; Object.assign(b.style, css); b.querySelectorAll('span[style]').forEach(sp => { for (const k in css) sp.style[k] = ''; if (!sp.getAttribute('style')) sp.removeAttribute('style'); }); }); return; }
    document.execCommand('styleWithCSS', false, false);
    document.execCommand('fontSize', false, '7');
    const news = [];
    ed.querySelectorAll('font').forEach(f => {
      const sp = document.createElement('span'); Object.assign(sp.style, css);
      while (f.firstChild) sp.appendChild(f.firstChild);
      sp.querySelectorAll('span').forEach(ch => { for (const k in css) ch.style[k] = ''; if (!ch.getAttribute('style')) ch.removeAttribute('style'); });
      f.replaceWith(sp); news.push(sp);
    });
    if (news.length) { const nr = document.createRange(); nr.setStartBefore(news[0]); nr.setEndAfter(news[news.length - 1]); s.removeAllRanges(); s.addRange(nr); }
  }
  function curStyle(ed) {
    const s = getSelection(); if (!s.rangeCount || !inEd(ed, s.anchorNode)) return null;
    let n = s.anchorNode; if (n.nodeType === 3) n = n.parentNode;
    return n.nodeType === 1 ? getComputedStyle(n) : null;
  }
  function stepSize(ed, dir) {
    const cs = curStyle(ed); const now = cs ? parseFloat(cs.fontSize) : 16;
    let nx; if (dir > 0) nx = SIZES.find(v => v > now + 0.5) || SIZES[SIZES.length - 1]; else nx = [...SIZES].reverse().find(v => v < now - 0.5) || SIZES[0];
    applyInline(ed, { fontSize: nx + 'px' });
  }
  function insertOrn(ed, o) {
    const b = mk('div', 'b-orn'); b.setAttribute('data-o', o); b.contentEditable = 'false';
    const s = getSelection(); let line = s.anchorNode; while (line && line.parentNode !== ed) line = line.parentNode;
    const after = mk('div', 'b-body', '<br>');
    if (line && line.nodeType === 1) { line.after(b); b.after(after); } else { ed.appendChild(b); ed.appendChild(after); }
    const r = document.createRange(); r.setStart(after, 0); r.collapse(true); s.removeAllRanges(); s.addRange(r);
  }

  /* ---------------------------------------------------------------- undo / redo (snapshots of the whole board) */
  const snap = () => JSON.stringify(serialize());
  function commit() {
    if (!editing) return;
    const s = snap(); if (s === lastSnap) return;
    undoStack.push(lastSnap); if (undoStack.length > 60) undoStack.shift();
    redoStack = []; lastSnap = s; updateBar();
  }
  function scheduleTextCommit() { clearTimeout(textT); textT = setTimeout(() => { textT = 0; commit(); }, 700); }
  function flushText() { if (textT) { clearTimeout(textT); textT = 0; commit(); } }
  function restore(s) {
    const keep = selId; selId = null; layoutSel(null);
    setItems(JSON.parse(s)); touched = true;
    if (keep && byId(keep)) select(keep, true);
    changed(); updateBar();
  }
  function undo() {
    if (!editing) return; flushText();
    if (!undoStack.length) { toast('Nothing to undo'); return; }
    redoStack.push(snap()); lastSnap = undoStack.pop(); restore(lastSnap); snd('back');
  }
  function redo() {
    if (!editing) return; flushText();
    if (!redoStack.length) { toast('Nothing to redo'); return; }
    undoStack.push(snap()); lastSnap = redoStack.pop(); restore(lastSnap); snd('flip');
  }

  /* ---------------------------------------------------------------- toolbar */
  const SV = d => '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
  const ICON = {
    l: '<svg viewBox="0 0 16 16"><path d="M2 3h12M2 7h8M2 11h12M2 15h8" transform="translate(0 -1)"/></svg>',
    c: '<svg viewBox="0 0 16 16"><path d="M2 3h12M4 7h8M2 11h12M4 15h8" transform="translate(0 -1)"/></svg>',
    r: '<svg viewBox="0 0 16 16"><path d="M2 3h12M6 7h8M2 11h12M6 15h8" transform="translate(0 -1)"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    dup: '<svg viewBox="0 0 16 16"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"/></svg>',
    del: '<svg viewBox="0 0 16 16"><path d="M3 4.5h10M6 4.5V3h4v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5"/></svg>',
    orn: '<svg viewBox="0 0 16 16"><path d="M1 8h4.5M10.5 8H15"/><path d="M8 4.5L11 8 8 11.5 5 8z" fill="#3a2412"/></svg>',
    img: SV('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.7"/><path d="M3 17l5-5 4 4 3-3 6 6"/>'),
    spark: SV('<path d="M11 2l1.9 6.1L19 10l-6.1 1.9L11 18l-1.9-6.1L3 10l6.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
    undo: SV('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
    redo: SV('<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>'),
    rotr: SV('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),
    rotl: SV('<path d="M4 11a8 8 0 1 1 2.3 5.7"/><path d="M4 4v7h7"/>'),
    flip: SV('<path d="M12 3v18" stroke-dasharray="2 3"/><path d="M9 7L3 12l6 5z"/><path d="M15 7l6 5-6 5z"/>'),
    front: SV('<rect x="3" y="3" width="12" height="12" rx="1.5"/><rect x="9" y="9" width="12" height="12" rx="1.5" fill="#f2e3ba"/>'),
    toback: SV('<rect x="9" y="9" width="12" height="12" rx="1.5"/><rect x="3" y="3" width="12" height="12" rx="1.5" fill="#f2e3ba"/>'),
    straight: SV('<path d="M4 12h16"/><path d="M8 8l-4 4 4 4M16 8l4 4-4 4"/>'),
    pencil: SV('<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="M14 7l3 3"/>'),
    check: SV('<path d="M5 12.5l4.5 4.5L19 7"/>'),
    move: '<svg viewBox="0 0 16 16"><path d="M8 1v14M1 8h14M8 1L5.5 3.5M8 1l2.5 2.5M8 15l-2.5-2.5M8 15l2.5-2.5M1 8l2.5-2.5M1 8l2.5 2.5M15 8l-2.5-2.5M15 8l-2.5 2.5"/></svg>',
    rot: '<svg viewBox="0 0 16 16"><path d="M13 8a5 5 0 1 1-1.8-3.8M13 2v3.4h-3.4"/></svg>'
  };
  const tb = (cls, a, tip, inner) => '<button type="button" class="tb ' + cls + '" ' + a + ' data-tip="' + esc(tip) + '" aria-label="' + esc(tip) + '">' + inner + '</button>';
  function buildBar() {
    const sw = COLORS.map(c => '<button type="button" class="sw" data-c="' + c[1] + '" data-tip="Text colour: ' + c[0] + '" aria-label="Text colour ' + c[0] + '" style="background:' + c[1] + '"></button>').join('');
    const pre = PRESETS.map(p => '<button type="button" class="tb pstyle" data-p="' + p.k + '" data-tip="Make this line a ' + p.n.toLowerCase() + '" style="font-family:' + FONTS[p.f].f + ';' + p.st + '">' + p.n + '</button>').join('');
    const looks = LOOKS.map(l => tb('look', 'data-look="' + l.k + '"', l.tip, l.n)).join('');
    barEl.dataset.m = 'none';
    barEl.innerHTML =
      '<div class="gb-row r-none"><span class="gb-lab">TIP</span><span class="gb-tip">Click a <b>paper</b> or a <b>picture</b> on the board to edit it. Drag its <b>corner dots</b> to resize and the <b>round arrow</b> above it to turn it. Drag a paper out of the tray, or press <b>Add image</b>.</span></div>' +
      '<div class="gb-row r-paper"><span class="gb-lab">TEXT</span>' + pre +
      '<span class="gb-sep"></span><button type="button" class="tb fnt" data-a="font" data-tip="Change the font of the selected text"><span class="fn">Font</span></button>' +
      tb('sm', 'data-a="smaller"', 'Smaller text', '<span class="aa">A−</span>') + tb('szn', 'data-a="size"', 'Pick a text size', '<span class="sn">16</span>') + tb('sm', 'data-a="bigger"', 'Bigger text', '<span class="aa big">A+</span>') +
      '<span class="gb-sep"></span>' + tb('sm', 'data-a="bold"', 'Bold (Ctrl+B)', '<b>B</b>') + tb('sm', 'data-a="italic"', 'Italic (Ctrl+I)', '<i>I</i>') + tb('sm', 'data-a="underline"', 'Underline (Ctrl+U)', '<u>U</u>') +
      '<span class="gb-sep"></span>' + sw +
      '<span class="gb-sep"></span>' + tb('sm', 'data-al="left"', 'Align left', ICON.l) + tb('sm', 'data-al="center"', 'Centre', ICON.c) + tb('sm', 'data-al="right"', 'Align right', ICON.r) +
      tb('sm', 'data-a="orn"', 'Insert a decorative divider line', ICON.orn) + '</div>' +
      '<div class="gb-row r-image"><span class="gb-lab">PICTURE</span>' +
      tb('pri vin', 'data-a="vint"', 'Turn this picture into an old, parchment-style picture. Press again to get the normal picture back.', ICON.spark + '<span>Vintage style</span><i class="oo">OFF</i>') +
      '<span class="gb-sep"></span><span class="gb-mini">LOOK</span>' + looks +
      '<span class="gb-sep"></span>' + tb('', 'data-a="flip"', 'Mirror the picture left to right', ICON.flip + 'Flip') + '</div>' +
      '<div class="gb-row papc"><span class="gb-lab">BOARD</span>' +
      tb('pri', 'data-a="img"', 'Pin a picture from your device (PNG, JPG, GIF, WebP, SVG; transparent pictures work). You can also drop a file on the board or paste one.', ICON.img + 'Add image') +
      '<span class="gb-sep"></span>' + tb('', 'data-a="undo"', 'Undo the last change (Ctrl+Z)', ICON.undo + 'Undo') + tb('', 'data-a="redo"', 'Redo (Ctrl+Shift+Z)', ICON.redo + 'Redo') +
      '<span class="gb-sep"></span>' + tb('nsel', 'data-a="rotl"', 'Turn left a little', ICON.rotl + 'Turn') + tb('nsel', 'data-a="rotr"', 'Turn right a little', ICON.rotr + 'Turn') + tb('nsel', 'data-a="straight"', 'Make it straight again', ICON.straight + 'Straighten') +
      '<span class="gb-sep"></span>' + tb('nsel', 'data-a="front"', 'Bring in front of the others', ICON.front + 'To front') + tb('nsel', 'data-a="back"', 'Send behind the others', ICON.toback + 'To back') + tb('nsel', 'data-a="dup"', 'Make a copy (Ctrl+D)', ICON.dup + 'Duplicate') +
      '<span class="gb-sep"></span>' + tb('dgr nsel', 'data-a="del"', 'Take it off the board (Delete key)', ICON.del + 'Remove') + tb('dgr', 'data-a="clear"', 'Remove everything from the board', 'Clear board') + '</div>';
    barEl.addEventListener('pointerdown', ev => { if (ev.target.closest('button')) ev.preventDefault(); });   /* the cursor stays in the paper */
    barEl.addEventListener('click', onBar);
  }
  let clearArm = 0;
  function onBar(ev) {
    const b = ev.target.closest('button'); if (!b || !editing) return; closeMenu();
    const a = b.dataset.a;
    if (a === 'img') { fileEl.value = ''; fileEl.click(); return; }
    if (a === 'undo') return undo();
    if (a === 'redo') return redo();
    if (a === 'clear') {
      if (!items.length) return;
      if (!clearArm) { b.classList.add('arm'); b.textContent = 'Really clear all?'; clearArm = setTimeout(() => { clearArm = 0; b.classList.remove('arm'); b.textContent = 'Clear board'; }, 3500); return; }
      clearTimeout(clearArm); clearArm = 0; b.classList.remove('arm'); b.textContent = 'Clear board';
      touched = true; items.slice().forEach(q => { q.el.classList.add('poof'); const e = q.el; setTimeout(() => e.remove(), 300); });
      items = []; selId = null; layoutSel(null); snd('whoosh'); updateHint(); updateBar(); commit(); changed();
      setUndo('Board cleared &nbsp;<button type="button" id="gb-undo">Undo</button>', 9000); const u = $('#gb-undo'); if (u) u.onclick = () => { undo(); setUndo(''); };
      return;
    }
    const p = cur(); if (!p) return;
    if (isImg(p)) {
      if (a === 'vint') { if (p.fx) { p.lastFx = p.fx; p.fx = 0; } else p.fx = p.lastFx || 1; snd('select'); return afterImg(p); }
      if (b.dataset.look) { p.fx = +b.dataset.look; snd('select'); return afterImg(p); }
      if (a === 'flip') { p.flip = p.flip ? 0 : 1; return afterImg(p); }
    } else {
      if (b.dataset.p) return withEd(ed => setPreset(ed, b.dataset.p));
      if (b.dataset.c) return withEd(ed => applyInline(ed, { color: b.dataset.c }));
      if (b.dataset.al) return withEd(ed => blocksIn(ed).forEach(x => { if (!x.classList.contains('b-orn')) x.style.textAlign = b.dataset.al; }));
      switch (a) {
        case 'font': return openMenu(b, 'font');
        case 'size': return openMenu(b, 'sz');
        case 'orn': return withEd(() => {}), openMenu(b, 'orn');
        case 'smaller': return withEd(ed => stepSize(ed, -1));
        case 'bigger': return withEd(ed => stepSize(ed, 1));
        case 'bold': case 'italic': case 'underline': return withEd(() => document.execCommand(a));
      }
    }
    switch (a) {
      case 'rotl': case 'rotr': p.rot = clamp(Math.round((p.rot + (a === 'rotl' ? -5 : 5)) * 2) / 2, -180, 180); p.el.classList.add('grow'); layout(p); setTimeout(() => p.el.classList.remove('grow'), 200); touched = true; commit(); return changed();
      case 'straight': p.rot = 0; p.el.classList.add('grow'); layout(p); setTimeout(() => p.el.classList.remove('grow'), 200); touched = true; commit(); return changed();
      case 'front': p.z = ++zTop; layout(p); touched = true; commit(); return changed();
      case 'back': { const mn = Math.min(...items.map(q => q.z)); p.z = mn - 1; layout(p); touched = true; commit(); return changed(); }
      case 'dup': return duplicate(p);
      case 'del': return removeItem(p);
    }
  }
  function afterImg(p) { touched = true; layout(p); updateBar(); commit(); changed(); }
  function openMenu(btn, kind) {
    const p = cur(); if (!p || isImg(p)) return;
    const rb = btn.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    const m = mk('div', 'gb-menu' + (kind === 'orn' ? ' orn' : kind === 'sz' ? ' sz' : ''));
    m.addEventListener('pointerdown', e => e.preventDefault());
    const ed = edOf(p), cs = curStyle(ed), curF = cs ? fontFirst(cs.fontFamily) : '', curS = cs ? Math.round(parseFloat(cs.fontSize)) : 0;
    if (kind === 'font') FONTS.forEach(f => { const b = mk('button', fontFirst(f.f) === curF ? 'cur' : '', f.n); b.style.fontFamily = f.f; b.onclick = () => { closeMenu(); withEd(e2 => applyInline(e2, { fontFamily: f.f })); }; m.appendChild(b); });
    if (kind === 'sz') SIZES.forEach(v => { const b = mk('button', v === curS ? 'cur' : '', String(v)); b.onclick = () => { closeMenu(); withEd(e2 => applyInline(e2, { fontSize: v + 'px' })); }; m.appendChild(b); });
    if (kind === 'orn') [1, 2, 3, 4].forEach(o => { const b = mk('button', ''); b.innerHTML = '<span class="b-orn" data-o="' + o + '" style="display:block;height:14px;margin:6px auto;max-width:170px;background:var(--o) center/contain no-repeat"></span>'; b.onclick = () => { closeMenu(); withEd(e2 => insertOrn(e2, o)); }; m.appendChild(b); });
    stage.appendChild(m); menuEl = m;
    const x = (rb.left - sr.left) / scale, bottom = (rb.top - sr.top) / scale;
    m.style.left = Math.min(x, W - 230) + 'px'; m.style.bottom = (H - bottom + 6) + 'px';
    const cu = $('.cur', m); if (cu) m.scrollTop = Math.max(0, cu.offsetTop - m.clientHeight / 2 + cu.offsetHeight / 2);
  }
  function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }

  /* keep the buttons in step with whatever is selected */
  function updateBar() {
    if (!barEl) return;
    const p = cur(); barEl.dataset.m = !p ? 'none' : isImg(p) ? 'image' : 'paper';
    const un = barEl.querySelector('[data-a="undo"]'), re = barEl.querySelector('[data-a="redo"]');
    if (un) un.classList.toggle('off', !undoStack.length); if (re) re.classList.toggle('off', !redoStack.length);
    if (!p) return;
    if (isImg(p)) {
      const v = $('.vin', barEl); v.classList.toggle('on', !!p.fx); $('.oo', v).textContent = p.fx ? 'ON' : 'OFF';
      barEl.querySelectorAll('[data-look]').forEach(x => x.classList.toggle('on', +x.dataset.look === p.fx));
      return;
    }
    const ed = edOf(p), has = !!curRange(ed);
    const bl = has ? blocksIn(ed) : [], b0 = bl[0];
    barEl.querySelectorAll('[data-p]').forEach(x => { const P = PRESETS.find(y => y.k === x.dataset.p); x.classList.toggle('on', !!b0 && b0.classList.contains(P.cls)); });
    const cs = has ? curStyle(ed) : null;
    $('.fn', barEl).textContent = cs ? ((FONTS.find(f => fontFirst(f.f) === fontFirst(cs.fontFamily)) || { n: 'Font' }).n) : 'Font';
    $('.sn', barEl).textContent = cs ? Math.round(parseFloat(cs.fontSize)) : '–';
    ['bold', 'italic', 'underline'].forEach(c => { let v = false; try { v = has && document.queryCommandState(c); } catch (e) {} const x = barEl.querySelector('[data-a="' + c + '"]'); if (x) x.classList.toggle('on', !!v); });
    const al = b0 ? (b0.style.textAlign || (b0.classList.contains('b-title') ? 'center' : 'left')) : '';
    barEl.querySelectorAll('[data-al]').forEach(x => x.classList.toggle('on', x.dataset.al === al));
  }
  document.addEventListener('selectionchange', () => {
    if (!isOpen || !editing) return;
    const s = getSelection(); if (!s.rangeCount) return;
    const n = s.anchorNode && (s.anchorNode.nodeType === 3 ? s.anchorNode.parentNode : s.anchorNode);
    const ed = n && n.closest && n.closest('#gb .txt'); if (!ed) return;
    const paper = ed.closest('.paper'), p = paper && byId(paper.dataset.id);
    if (p) { lastRange.set(p.id, s.getRangeAt(0).cloneRange()); if (selId !== p.id) select(p.id); else updateBar(); }
  });

  /* ---------------------------------------------------------------- saving (only the owner, only while editing) */
  function serializeOne(p) {
    if (isImg(p)) return p.img ? { id: p.id, style: 'image', x: Math.round(p.x), y: Math.round(p.y), w: Math.round(p.w), h: Math.round(p.h), rot: p.rot, z: p.z, seed: p.seed, html: '', img: p.img, fx: p.fx || 0, flip: p.flip ? 1 : 0, alpha: p.alpha ? 1 : 0 } : null;
    const ed = edOf(p);
    return { id: p.id, style: p.style, x: Math.round(p.x), y: Math.round(p.y), w: Math.round(p.w), h: Math.round(p.h), rot: p.rot, z: p.z, seed: p.seed, html: ed ? clean(ed.innerHTML) : p.html };
  }
  const serialize = () => items.slice().sort((a, b) => a.z - b.z).map(serializeOne).filter(Boolean);
  let saveT = 0, saving = false, again = false;
  function changed() { if (!editing || !owner.mine) return; saveLocal(true); clearTimeout(saveT); saveT = setTimeout(pushServer, 900); setStatus('Saving…'); }
  function saveLocal(dirty, updatedAt) {
    if (!owner.mine) return;
    try { localStorage.setItem(userKey(), JSON.stringify({ updatedAt: updatedAt || new Date().toISOString(), dirty: !!dirty, papers: serialize() })); } catch (e) {}
  }
  async function pushServer() {
    clearTimeout(saveT); saveT = 0;
    const A = api();
    if (!owner.mine) return;
    if (!A || !A.saveBoard || !token()) { setStatus('Saved on this device', 2500); return; }
    if (saving) { again = true; return; }
    saving = true;
    try {
      const r = await A.saveBoard(serialize());
      saveLocal(false, r && r.updatedAt);
      setStatus('All saved', 2200);
    } catch (e) { setStatus('Saved on this device (' + esc(e && e.message ? e.message : 'the server could not be reached') + ')', 6000); }
    saving = false;
    if (again) { again = false; pushServer(); }
  }
  let stT = 0;
  function setStatus(html, ms) { if (!statusEl) return; const a = $('.sa', statusEl); a.innerHTML = html; clearTimeout(stT); if (ms) stT = setTimeout(() => { a.innerHTML = ''; }, ms); }
  function setUndo(html, ms) { if (!statusEl) return; const b = $('.sb', statusEl); b.innerHTML = html; clearTimeout(unT); if (ms) unT = setTimeout(() => { b.innerHTML = ''; }, ms); }
  function toast(m) { if (window.groveToast) window.groveToast(m); else setStatus(esc(m), 3500); }

  function setItems(list) {
    items.forEach(p => p.el && p.el.remove()); items = []; selId = null; lastRange.clear(); layoutSel(null);
    (list || []).slice(0, MAX_ITEMS).forEach(d => {
      const p = hydrate(d); if (isImg(p) && !p.img) return;
      mount(p, d.html); items.push(p); zTop = Math.max(zTop, p.z);
    });
    updateHint(); updateBar();
  }
  /* a board that was changed on this device but never reached the server is sent up quietly */
  async function pushQuiet() { const A = api(); if (!A || !A.saveBoard || !token()) return; try { const r = await A.saveBoard(serialize()); saveLocal(false, r && r.updatedAt); } catch (e) {} }
  async function loadBoard() {
    const seq = ++loadSeq, A = api(), id = owner.id;
    if (!owner.mine) {
      if (!A || !A.getBoard) return;
      try { const srv = await A.getBoard(id); if (seq !== loadSeq || !isOpen) return; setItems(srv.papers); }
      catch (e) { if (seq === loadSeq) setStatus('Could not load this board right now', 4000); }
      return;
    }
    let local = null;
    try { local = JSON.parse(localStorage.getItem(userKey()) || 'null'); } catch (e) {}
    if (local && Array.isArray(local.papers)) setItems(local.papers);
    if (!A || !A.getBoard || !token()) return;
    try {
      const srv = await A.getBoard();
      if (seq !== loadSeq || !isOpen) return;
      const st = Date.parse(srv.updatedAt || 0) || 0, lt = local ? Date.parse(local.updatedAt || 0) || 0 : 0;
      if (touched || (local && local.dirty && lt > st) || (!srv.updatedAt && local && local.papers && local.papers.length)) { if (editing && touched) pushServer(); else pushQuiet(); return; }
      if (srv.updatedAt) { setItems(srv.papers); saveLocal(false, srv.updatedAt); }
    } catch (e) { setStatus('Offline: your notes are kept on this device', 4000); }
  }

  /* ---------------------------------------------------------------- edit mode, owner label, hints */
  function paintTop() {
    const nm = owner.name || 'Player';
    $('.so', statusEl).textContent = owner.mine ? (editing ? 'Editing your board' : 'Your notice board') : nm + '’s notice board · view only';
    root.classList.toggle('mine', !!owner.mine);
    editBtn.innerHTML = (editing ? ICON.check : ICON.pencil) + '<span>' + (editing ? 'Done editing' : 'Edit board') + '</span>';
    editBtn.classList.toggle('go', editing);
    editBtn.setAttribute('data-tip', editing ? 'Finish editing and lock the board' : 'Unlock the board to move papers, write and add pictures');
    $('.tv', trayEl).innerHTML = '<b>NOTICE BOARD</b><em>' + esc(owner.mine ? 'Yours' : nm) + '</em><span>' + (owner.mine ? 'Press <u>Edit board</u> to pin papers, write on them and add pictures.' : 'Only <u>' + esc(nm) + '</u> can pin, move or write on these papers.') + '</span>';
    paintHint();
  }
  function paintHint() {
    const arrow = '<svg viewBox="0 0 130 46" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color:rgba(255,232,185,.6)"><path d="M6 24C40 6 80 6 118 24M104 12l15 12-17 8"/></svg>';
    hintEl.innerHTML = editing ? 'Pin your first note<small>Drag a blank paper from the tray, or press Add image</small>' + arrow
      : owner.mine ? 'Your board is empty<small>Press “Edit board” to start pinning</small>'
      : 'Nothing is pinned here yet<small>' + esc(owner.name || 'This player') + ' has not pinned anything</small>';
    updateHint();
  }
  function setEditing(on) {
    if (on && !owner.mine) return;
    if (editing === on) return;
    if (!on) {
      flushText(); deselect(); closeMenu();
      const a = document.activeElement; if (a && a.blur) a.blur();
      if (touched || saveT) { saveLocal(true); pushServer(); }
    }
    editing = on; root.classList.toggle('editing', on); root.classList.toggle('viewing', !on);
    items.forEach(p => { const ed = edOf(p); if (ed) ed.contentEditable = on ? 'true' : 'false'; });
    if (on) { undoStack = []; redoStack = []; lastSnap = snap(); }
    paintTop(); updateBar(); snd(on ? 'select' : 'confirm');
    if (on) setStatus('You can edit now. Click a paper or picture.', 3500);
  }

  /* ---------------------------------------------------------------- build + open / close */
  function fit() { scale = Math.min(innerWidth / W, innerHeight / H); if (stage) stage.style.setProperty('--s', scale); }
  function buildSel() {
    selEl = mk('div'); selEl.id = 'gb-sel';
    selEl.innerHTML = '<i class="bar t"></i><i class="bar r"></i><i class="bar b"></i><i class="bar l"></i>' +
      Object.keys(DIRS).map(k => '<b class="hd h-' + k + '" data-h="' + k + '"></b>').join('') +
      '<span class="stem"></span><b class="hr" data-tip="Drag to turn">' + ICON.rot + '</b><b class="hm" data-tip="Drag to move">' + ICON.move + '</b><em class="hz"></em>';
    stage.appendChild(selEl);
    selEl.addEventListener('pointerdown', ev => {
      const p = cur(); if (!p || !editing) return;
      if (ev.button !== 0 && ev.pointerType === 'mouse') return;
      const t = ev.target;
      if (t.closest('.hd')) { ev.stopPropagation(); startResize(ev, p, t.closest('.hd').dataset.h); }
      else if (t.closest('.hr')) { ev.stopPropagation(); startRotate(ev, p); }
      else if (t.closest('.hm') || t.closest('.bar')) { ev.stopPropagation(); startMove(ev, p, false); }
    });
  }
  function build() {
    if (!document.getElementById('gb-fonts')) { const l = mk('link'); l.id = 'gb-fonts'; l.rel = 'stylesheet'; l.href = FONT_LINK; document.head.appendChild(l); }
    root = mk('div'); root.id = 'gb'; root.className = 'viewing'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Notice board');
    root.innerHTML = '<div class="gb-blur"></div><div id="gb-stage"><img class="gb-bg" src="ui/board.png" alt="" draggable="false"><div id="gb-hint"></div><div id="gb-board"></div><div id="gb-tray"></div><div id="gb-ghost"></div><div id="gb-bar"></div>' +
      '<button id="gb-back" type="button">' + ICON.back + 'Back to the Grove<kbd>ESC</kbd></button>' +
      '<div id="gb-status" aria-live="polite"><span class="so"></span><span class="sa"></span><span class="sb"></span></div>' +
      '<button id="gb-edit" type="button"></button><div id="gb-drop"><div>Drop a picture to pin it</div></div>' +
      '<input id="gb-file" type="file" accept="image/*,.svg,.avif" multiple hidden></div>';
    document.body.appendChild(root);
    stage = $('#gb-stage', root); boardEl = $('#gb-board', root); ghost = $('#gb-ghost', root); trayEl = $('#gb-tray', root); barEl = $('#gb-bar', root); hintEl = $('#gb-hint', root); statusEl = $('#gb-status', root); fileEl = $('#gb-file', root); editBtn = $('#gb-edit', root);
    buildTray(); buildBar(); buildSel();
    $('#gb-back', root).onclick = closeBoard;
    editBtn.onclick = () => setEditing(!editing);
    fileEl.addEventListener('change', () => { const f = Array.from(fileEl.files || []); fileEl.value = ''; if (f.length) addImageFiles(f); });
    boardEl.addEventListener('pointerdown', ev => { if (editing && ev.target === boardEl) { deselect(); const a = document.activeElement; if (a && a.blur) a.blur(); closeMenu(); } });
    stage.addEventListener('pointerdown', ev => { if (menuEl && !ev.target.closest('.gb-menu') && !ev.target.closest('#gb-bar')) closeMenu(); });
    /* pictures dropped from the desktop */
    let dragDepth = 0;
    stage.addEventListener('dragenter', ev => { if (editing && hasFiles(ev)) { dragDepth++; root.classList.add('dropping'); } });
    stage.addEventListener('dragover', ev => { if (editing && hasFiles(ev)) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; } });
    stage.addEventListener('dragleave', ev => { if (editing && hasFiles(ev) && --dragDepth <= 0) { dragDepth = 0; root.classList.remove('dropping'); } });
    stage.addEventListener('drop', ev => {
      dragDepth = 0; root.classList.remove('dropping');
      if (!editing) { if (hasFiles(ev)) ev.preventDefault(); return; }
      const fs = ev.dataTransfer && ev.dataTransfer.files;
      if (fs && fs.length) { ev.preventDefault(); const pt = toStage(ev); addImageFiles(fs, pt.x, pt.y); }
    });
    document.addEventListener('paste', ev => {
      if (!isOpen || !editing || (ev.target.closest && ev.target.closest('.txt'))) return;
      const fs = ev.clipboardData && Array.from(ev.clipboardData.files || []).filter(f => /^image\//.test(f.type));
      if (fs && fs.length) { ev.preventDefault(); addImageFiles(fs); }
    });
    addEventListener('resize', fit);
    root.addEventListener('contextmenu', ev => { if (!ev.target.closest('.txt')) ev.preventDefault(); });
    addEventListener('keydown', ev => {
      if (!isOpen) return;
      const ae = document.activeElement, inTxt = !!(ae && ae.closest && ae.closest('.txt')), inInput = !!(ev.target.closest && ev.target.closest('input,textarea'));
      if (ev.key === 'Escape') {
        if (menuEl) { closeMenu(); return; }
        if (inTxt) { ae.blur(); return; }
        if (selId) { deselect(); return; }
        if (editing) { setEditing(false); return; }
        closeBoard(); return;
      }
      if (!editing || inTxt || inInput) return;
      const mod = ev.ctrlKey || ev.metaKey, k = ev.key.toLowerCase();
      if (mod && k === 'z') { ev.preventDefault(); ev.shiftKey ? redo() : undo(); return; }
      if (mod && k === 'y') { ev.preventDefault(); redo(); return; }
      const p = cur(); if (!p) return;
      if (mod && k === 'd') { ev.preventDefault(); duplicate(p); return; }
      if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); removeItem(p); return; }
      const step = ev.shiftKey ? 10 : 1, mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[ev.key];
      if (mv) { ev.preventDefault(); p.x += mv[0]; p.y += mv[1]; layout(p); touched = true; changed(); clearTimeout(nudgeT); nudgeT = setTimeout(commit, 500); }
    }, true);
    addEventListener('pagehide', () => { if (isOpen && owner.mine && touched) saveLocal(true); });
    built = true;
  }
  function openBoard(o) {
    o = o || {};
    if (!o.id) { toast('Nobody has pinned a board in this spot yet.'); return; }
    if (!built) build();
    owner = { id: String(o.id), name: String(o.name || ''), mine: !!o.mine };
    fit(); isOpen = true; editing = false; touched = false; clearTimeout(saveT); saveT = 0;
    undoStack = []; redoStack = []; lastSnap = '[]';
    root.classList.remove('editing'); root.classList.add('viewing', 'open');
    setItems([]); setStatus(''); setUndo(''); paintTop(); snd('flip'); loadBoard(); updateBar();
  }
  function closeBoard() {
    if (!isOpen) return;
    setEditing(false); closeMenu(); deselect(); const a = document.activeElement; if (a && a.blur) a.blur();
    if (owner.mine && (touched || saveT)) { saveLocal(true); pushServer(); }
    isOpen = false; root.classList.remove('open'); snd('back');
  }
  window.openBoard = openBoard; window.closeBoard = closeBoard;
  /* warm the cache so the board appears instantly */
  setTimeout(() => { const i = new Image(); i.src = 'ui/board.png'; const j = new Image(); j.src = 'ui/tray_wood.jpg'; }, 2500);
})();
