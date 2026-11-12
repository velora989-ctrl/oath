/* =====================================================================
   World Map (worldmap.js)
   A big picture (public/map/, cut into tiles by tools/make_map_tiles.py) that you drag around in every direction.
   - Opens from the little map button next to the sound button (bottom right).
   - Drag with the mouse or a finger, or use W A S D / arrow keys. Mouse wheel, pinch or + / - zoom. 0 or Home = back to the start view.
   - The view stops exactly at the edge of the picture (with a soft bounce), so you never see empty space.
   - It opens at the same size as the Creators Museum map, a little zoomed out (OPEN_ZOOM).
   - LEVEL MODE: the Patch button opens this same map with the 27 level medallions (circular frames) on top, at the same places and size as on the
     Creators Museum map. Finish a level and every stone path leaving it glows (a level that joins two others lights both paths).
   - Only the tiles on screen are loaded, so the big picture opens fast and stays sharp. Nothing here touches the rest of the game.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__worldMap) return;
  window.__worldMap = true;
  const stage = document.getElementById('stage');
  if (!stage) return;

  const BASE_W = 1671, BASE_H = 941;       /* the Creators Museum's map window: "the size it opens at now" */
  const OPEN_ZOOM = 0.85;                  /* opens this much of that size = a little zoomed out */
  const MAX_ZOOM = 1.2, MIN_ZOOM = 0.2;    /* MIN is raised automatically so the picture always covers the screen */
  const LOAD_AT_ONCE = 6, CACHE_LIMIT = 110;
  const KEY = 'oath.worldmap.pos';
  const LV_ZOOM = 0.4438;                  /* level mode: 1 museum-map pixel = 1 game pixel, exactly the size the circles have on the Creators Museum map */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const snd = (n, a) => { try { window.GroveFX && window.GroveFX.sound && window.GroveFX.sound.play(n, a); } catch (e) {} };
  const ICON_MAP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5z"/><path d="M9 4v13.500M15 6.500V20"/></svg>';
  const ICON_BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';

  /* ---------------- tiles ---------------- */
  let meta = null, metaP = null;
  const loadMeta = () => metaP || (metaP = fetch('map/meta.json').then(r => r.json()).then(m => { meta = m; return m; }).catch(e => { metaP = null; throw e; }));
  const tileUrl = (l, x, y) => 'map/' + l + '/' + x + '_' + y + '.' + meta.ext + '?v=' + meta.v;
  const cache = new Map(), loading = new Set(), failed = new Map();
  let queue = [], active = 0, frameNo = 0;
  const pinned = l => l >= meta.levels - 2;                       /* the two smallest levels stay in memory: they are the blurry stand-in while sharp tiles load */
  function request(l, x, y) {
    const key = l + '/' + x + '/' + y;
    if (cache.has(key) || loading.has(key) || (failed.get(key) || 0) > performance.now()) return;
    loading.add(key); active++;
    const im = new Image(); im.decoding = 'async';
    const done = ok => {
      active--; loading.delete(key);
      if (ok) { cache.set(key, { im, t: frameNo }); dirty = true; evict(); } else failed.set(key, performance.now() + 6000);
      pump();
    };
    im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => done(true));
    im.onerror = () => done(false);
    im.src = tileUrl(l, x, y);
  }
  function pump() { while (active < LOAD_AT_ONCE && queue.length) { const q = queue.shift(); request(q[0], q[1], q[2]); } }
  function evict() {
    if (cache.size <= CACHE_LIMIT) return;
    const old = [...cache.entries()].filter(e => !pinned(+e[0].split('/')[0])).sort((a, b) => a[1].t - b[1].t);
    for (const e of old) { if (cache.size <= CACHE_LIMIT * 0.85) break; cache.delete(e[0]); }
  }
  const getTile = (l, x, y) => { const e = cache.get(l + '/' + x + '/' + y); if (e) { e.t = frameNo; return e.im; } return null; };

  /* ---------------- view ---------------- */
  let root = null, cv = null, g = null, built = false, isOpen = false, dirty = true, raf = 0, lastT = 0;
  let cx = 0, cy = 0, tx = 0, ty = 0, k = OPEN_ZOOM, tk = OPEN_ZOOM, anchor = null, vx = 0, vy = 0, dpr = 1, vw = 0, vh = 0;
  const keys = {}, pointers = new Map();
  let drag = null, pinch = null, lastPlan = 0;
  let mode = 'map', fxCv = null, fx = null, lvEl = null, tipEl = null, downPt = null, hovNode = -1, autoCenter = false, offChange = null, snap = [];
  const TR = window.MUSEUM_TRAIL || null;
  const fit = () => Math.min(innerWidth / BASE_W, innerHeight / BASE_H);
  const scale = () => fit() * k;                                    /* screen pixels per map pixel */
  const minZoom = () => meta ? Math.max(MIN_ZOOM, innerWidth / (meta.w * fit()), innerHeight / (meta.h * fit())) : MIN_ZOOM;
  function bounds() {
    const sc = scale(), hw = vw / (2 * sc), hh = vh / (2 * sc);
    return { x0: Math.min(hw, meta.w / 2), x1: Math.max(meta.w - hw, meta.w / 2), y0: Math.min(hh, meta.h / 2), y1: Math.max(meta.h - hh, meta.h / 2) };
  }
  const hard = (v, a, b) => clamp(v, a, b);
  const soft = (v, a, b) => (v < a ? a - (a - v) * 0.32 : v > b ? b + (v - b) * 0.32 : v);   /* rubber band while dragging past the edge */
  function clampAll() { const b = bounds(); cx = hard(cx, b.x0, b.x1); cy = hard(cy, b.y0, b.y1); tx = hard(tx, b.x0, b.x1); ty = hard(ty, b.y0, b.y1); }
  const toMap = (px, py) => { const sc = scale(); return [cx + (px - vw / 2) / sc, cy + (py - vh / 2) / sc]; };
  function setAnchor(px, py) { const m = toMap(px, py); anchor = { px, py, mx: m[0], my: m[1] }; }
  function zoomTo(nk, px, py) { tk = clamp(nk, minZoom(), MAX_ZOOM); setAnchor(px == null ? vw / 2 : px, py == null ? vh / 2 : py); vx = vy = 0; }
  function home() { tk = clamp(mode === 'levels' ? LV_ZOOM : OPEN_ZOOM, minZoom(), MAX_ZOOM); anchor = null; const p = startPos(); tx = p[0]; ty = p[1]; vx = vy = 0; }
  function startPos() {
    if (mode === 'levels') return lvStart();
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.x >= 0 && s.x <= meta.w && s.y >= 0 && s.y <= meta.h) return [s.x, s.y]; } catch (e) {}
    return [meta.w * 0.5, meta.h * 0.5];
  }
  const savePos = () => { if (mode !== 'map') return; try { localStorage.setItem(KEY, JSON.stringify({ x: Math.round(cx), y: Math.round(cy) })); } catch (e) {} };

  function resize() {
    if (!cv) return;
    dpr = Math.min(2, window.devicePixelRatio || 1); vw = innerWidth; vh = innerHeight;
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr); if (fxCv) { fxCv.width = cv.width; fxCv.height = cv.height; }
    if (meta) { tk = clamp(tk, minZoom(), MAX_ZOOM); k = clamp(k, minZoom(), MAX_ZOOM); clampAll(); }
    dirty = true;
  }

  /* which level (0 = sharpest) matches what the screen needs */
  const pickLevel = need => clamp(Math.floor(Math.log2(1 / Math.max(need, 1e-4)) + 1e-6), 0, meta.levels - 1);
  function visible(l, margin) {
    const sc = scale(), ts = meta.tile * (1 << l), cols = Math.ceil(meta.w / ts), rows = Math.ceil(meta.h / ts);
    const x0 = cx - vw / (2 * sc), x1 = cx + vw / (2 * sc), y0 = cy - vh / (2 * sc), y1 = cy + vh / (2 * sc);
    return { ts, cols, rows, ax: Math.max(0, Math.floor(x0 / ts) - margin), bx: Math.min(cols - 1, Math.floor(x1 / ts) + margin), ay: Math.max(0, Math.floor(y0 / ts) - margin), by: Math.min(rows - 1, Math.floor(y1 / ts) + margin) };
  }
  /* decide which tiles to fetch next: the ones on screen first (nearest the middle), then one ring around, then the next sharper/smoother level */
  function plan() {
    const L = pickLevel(scale() * dpr), list = [];
    const add = (l, margin, pri) => {
      const v = visible(l, margin);
      for (let y = v.ay; y <= v.by; y++) for (let x = v.ax; x <= v.bx; x++) {
        if (cache.has(l + '/' + x + '/' + y)) continue;
        const dx = (x + .5) * v.ts - cx, dy = (y + .5) * v.ts - cy;
        list.push([l, x, y, pri + Math.hypot(dx, dy) / meta.w]);
      }
    };
    add(meta.levels - 1, 99, -1);                                   /* the smallest level, whole: always first (it is tiny) */
    add(L, 0, 0); add(L, 1, 1);
    if (L + 1 < meta.levels) add(L + 1, 0, 0.5);
    add(Math.max(0, meta.levels - 2), 99, 2);                      /* the next smallest, whole */
    queue = list.sort((a, b) => a[3] - b[3]).slice(0, 60);
    pump();
  }

  /* ---------------- level mode: medallions + glowing stone paths ---------------- */
  const PL = TR ? TR.place : null;
  const ROT_C = PL ? Math.cos(PL.rot) : 1, ROT_S = PL ? Math.sin(PL.rot) : 0;
  const toWorld = (mx, my) => [PL.s * (ROT_C * mx - ROT_S * my) + PL.tx, PL.s * (ROT_S * mx + ROT_C * my) + PL.ty];
  const lvOf = {}; if (TR) TR.levels.forEach((n, i) => { lvOf[n] = i + 1; });
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function lvStart() {                                          /* the level you are on now (first one not finished), else level 1 */
    let k = 0;
    if (snap.length) { k = snap.findIndex(l => l.has && !l.done); if (k < 0) k = snap.every(l => l.has) ? snap.length - 1 : snap.findIndex(l => !l.has); if (k < 0) k = 0; }
    const n = TR.nodes[TR.levels[k]], w = toWorld(n[0], n[1]);
    return [clamp(w[0], 0, meta.w), clamp(w[1], 0, meta.h)];
  }
  /* the folder level: one extra medallion, just outside the castle gate (museum-map pixels, same size as every level) */
  const FOLDER_XY = [50.7, -871.3], FOLDER_W = 92;
  function buildLv() {
    if (!TR || lvEl.dataset.built) return; lvEl.dataset.built = 1;
    lvEl.innerHTML = TR.nodes.map((n, i) => {
      const W = Math.round(n[2] * 2.2);
      return '<div class="lvn empty" data-s="' + i + '" style="left:' + n[0] + 'px;top:' + n[1] + 'px;--w:' + W + 'px"><span class="tk"><span class="pt"><img src="museum/unknown.png" alt="" draggable="false"></span>' +
        '<img class="fr" src="museum/frame.png" alt="" draggable="false"><b class="nm">' + (lvOf[i] || '') + '</b></span></div>';
    }).join('') +
      '<div class="lvn empty fld" data-s="' + TR.nodes.length + '" data-tip="Media Log" style="left:' + FOLDER_XY[0] + 'px;top:' + FOLDER_XY[1] + 'px;--w:' + FOLDER_W + 'px"><span class="tk"><span class="pt"><img src="museum/folders.png" alt="" draggable="false"></span>' +
      '<img class="fr" src="museum/frame.png" alt="" draggable="false"><b class="nm">+</b></span></div>';
  }
  function refreshLv() {
    if (!TR || mode !== 'levels') return;
    const G = window.GroveMuseum; snap = G && G.snapshot ? G.snapshot() : [];
    const cur = snap.findIndex(l => l.has && !l.done);
    snap.forEach((l, k) => {
      const e = lvEl.querySelector('.lvn[data-s="' + l.node + '"]'); if (!e) return;
      e.classList.toggle('empty', !l.has); e.classList.toggle('full', l.has); e.classList.toggle('locked', !l.open); e.classList.toggle('done', l.done); e.classList.toggle('cur', k === cur);
      const im = e.querySelector('.pt img'), want = l.has && l.img ? l.img : 'museum/unknown.png';
      if (im.getAttribute('src') !== want) im.setAttribute('src', want);
      e.dataset.tip = l.has ? l.name + (l.t ? ' · ' + l.d + '/' + l.t : '') : (l.open ? 'Add to museum' : 'Locked');
    });
    const fe = lvEl.querySelector('.lvn.fld');                                  /* the folder level: how many folders and items are inside */
    if (fe) {
      const fi = G && G.folderInfo ? G.folderInfo() : { n: 0, items: 0 };
      fe.dataset.tip = 'Media Log';
      fe.querySelector('.nm').textContent = fi.n || '+';
    }
    if (autoCenter && snap.length) { const p = lvStart(); tx = p[0]; ty = p[1]; }
    dirty = true;
  }
  /* museum-map pixels -> screen pixels (one matrix for the whole medallion layer) */
  function layoutLv() {
    const sc = scale(), a = sc * PL.s * ROT_C, b = sc * PL.s * ROT_S;
    lvEl.style.transform = 'matrix(' + a + ',' + b + ',' + (-b) + ',' + a + ',' + (sc * (PL.tx - cx) + vw / 2) + ',' + (sc * (PL.ty - cy) + vh / 2) + ')';
  }
  const litF = {}; let litT = 0, tickN = 0;      /* how far each level's stone path is lit on screen (it catches up with the real progress, one stone after another) */
  function drawFx(t) {
    if (!fx) return;
    const dtS = litT ? Math.min(.1, Math.max(0, (t - litT) / 1000)) : 0; litT = t;
    const d = dpr; fx.setTransform(d, 0, 0, d, 0, 0); fx.clearRect(0, 0, vw, vh);
    if (!snap.length) return;
    const sc = scale(), m = sc * PL.s, a = m * ROT_C, b = m * ROT_S, ox = sc * (PL.tx - cx) + vw / 2, oy = sc * (PL.ty - cy) + vh / 2;
    const pulse = 0.82 + 0.18 * Math.sin(t / 3800 * Math.PI * 2);
    /* The pebbles are the ones painted on the map: nothing is drawn over them. Each lit pebble only gets a soft yellow glow around it and a thin golden outline. */
    const lit = [];
    for (const lv of snap) {
      if (!lv.t) continue;
      const tgt = lv.done ? 1 : lv.f; let f = litF[lv.node];
      if (f === undefined || document.documentElement.classList.contains('fx-rm')) f = litF[lv.node] = tgt;
      else if (f !== tgt) {                                              /* the stones light up one after another (and go dark quickly again on an undo) */
        const before = f, step = (tgt > f ? .75 : 2.2) * dtS;
        f = litF[lv.node] = tgt > f ? Math.min(tgt, f + step) : Math.max(tgt, f - step);
        if (f > before && Math.floor(f * 14) !== Math.floor(before * 14)) snd('trailLight', tickN++);
      }
      if (f <= 0) continue;
      for (const e of TR.edges) {
        if (e.a !== lv.node) continue;
        const n = e.s.length, cnt = f * n;
        for (let i = 0; i < n && i < cnt + 1e-9; i++) {
          const st = e.s[i], X = a * st[0] - b * st[1] + ox, Y = b * st[0] + a * st[1] + oy;
          if (X < -80 || Y < -80 || X > vw + 80 || Y > vh + 80) continue;
          lit.push([X, Y, st[2] * m, st[3] * m, (st[4] * Math.PI / 180) + PL.rot, Math.min(1, cnt - i)]);
        }
      }
    }
    if (!lit.length) return;
    const H = [[3.4, .13], [2.7, .22], [2.1, .36], [1.65, .56], [1.3, .8], [1.14, .95]];
    for (const s of lit) for (const q of H) {                                   /* 1. the glow */
      fx.fillStyle = 'rgba(255,218,40,' + (q[1] * s[5] * pulse) + ')'; fx.beginPath(); fx.ellipse(s[0], s[1], s[2] * q[0] + 1.5, s[3] * q[0] + 1.5, s[4], 0, 6.2832); fx.fill();
    }
    fx.globalCompositeOperation = 'destination-out'; fx.fillStyle = '#000';     /* 2. keep the real pebble untouched */
    for (const s of lit) { fx.beginPath(); fx.ellipse(s[0], s[1], s[2] * .99, s[3] * .99, s[4], 0, 6.2832); fx.fill(); }
    fx.globalCompositeOperation = 'source-over'; fx.lineWidth = Math.max(1.6, m * 1.8);
    for (const s of lit) { fx.strokeStyle = 'rgba(255,238,120,' + (.95 * s[5]) + ')'; fx.beginPath(); fx.ellipse(s[0], s[1], s[2] * 1.03, s[3] * 1.03, s[4], 0, 6.2832); fx.stroke(); }   /* 3. thin golden edge */
  }
  let flashT = 0;
  function flash(msg) { tipEl.textContent = msg; tipEl.classList.add('on', 'msg'); clearTimeout(flashT); flashT = setTimeout(() => { tipEl.classList.remove('on', 'msg'); }, 2200); }
  function hitLv(px, py) {
    if (mode !== 'levels') return -1;
    const els = lvEl.children;
    for (let i = els.length - 1; i >= 0; i--) {
      const r = els[i].firstChild.getBoundingClientRect();
      if (px >= r.left && px <= r.right && py >= r.top && py <= r.bottom) return +els[i].dataset.s;
    }
    return -1;
  }
  function hoverLv(px, py) {
    const n = drag ? -1 : hitLv(px, py);
    if (n !== hovNode) {
      if (hovNode >= 0) { const o = lvEl.querySelector('.lvn[data-s="' + hovNode + '"]'); if (o) o.classList.remove('hov'); }
      hovNode = n; const e = n >= 0 ? lvEl.querySelector('.lvn[data-s="' + n + '"]') : null;
      if (e) e.classList.add('hov');
      cv.classList.toggle('pick', !!e); tipEl.classList.toggle('on', !!e); if (e) tipEl.textContent = e.dataset.tip || '';
    }
    if (n >= 0) {   /* the label hangs centred right under the medallion (below its number plate), so it never covers the picture */
      const r = lvEl.querySelector('.lvn[data-s="' + n + '"]').firstChild.getBoundingClientRect(), box = root.getBoundingClientRect();
      tipEl.style.left = (r.left + r.width / 2 - box.left) + 'px'; tipEl.style.top = (r.bottom - box.top + 8) + 'px';
    }
  }

  function draw() {
    dirty = false; frameNo++;
    const sc = scale(), L = pickLevel(sc * dpr), d = dpr, snap = v => Math.round(v * d) / d;
    g.setTransform(d, 0, 0, d, 0, 0);
    g.fillStyle = '#0f2410'; g.fillRect(0, 0, vw, vh);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    for (let l = meta.levels - 1; l >= L; l--) {                    /* smooth levels first, sharp ones paint over them */
      const v = visible(l, 0), f = 1 << l;
      for (let y = v.ay; y <= v.by; y++) for (let x = v.ax; x <= v.bx; x++) {
        const im = getTile(l, x, y); if (!im) continue;
        const mx = x * v.ts, my = y * v.ts;
        const sx0 = snap((mx - cx) * sc + vw / 2), sy0 = snap((my - cy) * sc + vh / 2);
        const sx1 = snap((mx + im.naturalWidth * f - cx) * sc + vw / 2), sy1 = snap((my + im.naturalHeight * f - cy) * sc + vh / 2);
        g.drawImage(im, sx0, sy0, Math.max(1 / d, sx1 - sx0), Math.max(1 / d, sy1 - sy0));
      }
    }
    if (mode === 'levels') layoutLv();
    if (loadEl && !loadEl.classList.contains('off')) {
      let ready = true; const l = meta.levels - 1, v = visible(l, 99);
      for (let y = v.ay; y <= v.by; y++) for (let x = v.ax; x <= v.bx; x++) if (!cache.has(l + '/' + x + '/' + y)) ready = false;
      if (ready || performance.now() - openedAt > 4000) loadEl.classList.add('off');
    }
  }

  function frame(t) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.05, (t - (lastT || t)) / 1000); lastT = t;
    if (!isOpen || !meta) return;
    const sc = scale();
    /* keyboard */
    const kx = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0), ky = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);
    if ((kx || ky) && !drag) { anchor = null; const sp = 1100 / sc * dt; tx += kx * sp; ty += ky * sp; const b = bounds(); tx = hard(tx, b.x0, b.x1); ty = hard(ty, b.y0, b.y1); }
    if (keys['+'] || keys['=']) zoomTo(tk * (1 + 1.6 * dt));
    if (keys['-'] || keys['_']) zoomTo(tk / (1 + 1.6 * dt));
    /* zoom glides toward its target, keeping the point under the mouse still */
    if (Math.abs(tk - k) > 1e-4) {
      k += (tk - k) * (1 - Math.pow(0.0004, dt));
      if (Math.abs(tk - k) < 1e-4) k = tk;
      if (anchor) { const s2 = scale(); cx = anchor.mx - (anchor.px - vw / 2) / s2; cy = anchor.my - (anchor.py - vh / 2) / s2; tx = cx; ty = cy; }
      clampAll(); dirty = true;
    } else if (anchor) anchor = null;
    /* pan glides toward its target (this also pulls it back from the soft edge) */
    if (!drag && (Math.abs(tx - cx) > .02 || Math.abs(ty - cy) > .02)) {
      const f = 1 - Math.pow(0.0012, dt); cx += (tx - cx) * f; cy += (ty - cy) * f; dirty = true;
    }
    if (t - lastPlan > 120) { lastPlan = t; plan(); }
    if (dirty) draw();
    if (mode === 'levels') drawFx(t);
  }

  /* ---------------- input ---------------- */
  const hintOff = () => { const h = root && root.querySelector('.wm-hint'); if (h) h.classList.add('off'); };
  function bindInput() {
    cv.addEventListener('pointerdown', ev => {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      cv.setPointerCapture(ev.pointerId); pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); hintOff(); autoCenter = false;
      downPt = pointers.size === 1 ? { x: ev.clientX, y: ev.clientY } : null;
      if (pointers.size === 1) { anchor = null; drag = { x: ev.clientX, y: ev.clientY, cx: cx, cy: cy, lt: performance.now() }; vx = vy = 0; tx = cx; ty = cy; cv.classList.add('grab'); }
      else if (pointers.size === 2) {
        drag = null; const p = [...pointers.values()];
        pinch = { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1, k: k };
        const mx = (p[0].x + p[1].x) / 2, my = (p[0].y + p[1].y) / 2; setAnchor(mx, my);
      }
    });
    cv.addEventListener('pointermove', ev => {
      if (mode === 'levels') hoverLv(ev.clientX, ev.clientY);
      if (!pointers.has(ev.pointerId)) return;
      pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pointers.size >= 2 && pinch) {
        const p = [...pointers.values()], d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1, mx = (p[0].x + p[1].x) / 2, my = (p[0].y + p[1].y) / 2;
        k = tk = clamp(pinch.k * d / pinch.d, minZoom(), MAX_ZOOM);
        const s2 = scale(); cx = anchor.mx - (mx - vw / 2) / s2; cy = anchor.my - (my - vh / 2) / s2; clampAll(); dirty = true; return;
      }
      if (drag) {
        const sc = scale(), b = bounds(), now = performance.now();
        const nx = soft(drag.cx - (ev.clientX - drag.x) / sc, b.x0, b.x1), ny = soft(drag.cy - (ev.clientY - drag.y) / sc, b.y0, b.y1);
        const dt = Math.max(1, now - drag.lt); vx = vx * .6 + ((nx - cx) / dt * 1000) * .4; vy = vy * .6 + ((ny - cy) / dt * 1000) * .4; drag.lt = now;
        cx = tx = nx; cy = ty = ny; dirty = true;
      }
    });
    const up = ev => {
      if (!pointers.has(ev.pointerId)) return;
      pointers.delete(ev.pointerId);
      if (mode === 'levels' && downPt && ev.type === 'pointerup' && Math.hypot(ev.clientX - downPt.x, ev.clientY - downPt.y) < 7) {
        const n = hitLv(ev.clientX, ev.clientY);
        const lk = n >= 0 && snap.some(l => l.node === n && !l.open);
        if (lk) { flash('This level is locked. Finish a level to open the next one.'); }
        else if (n >= 0 && TR && n === TR.nodes.length && window.GroveMuseum && GroveMuseum.openFolders) { downPt = null; snd('click'); tipEl.classList.remove('on'); const o = lvEl.querySelector('.lvn.hov'); if (o) o.classList.remove('hov'); hovNode = -1; cv.classList.remove('pick'); GroveMuseum.openFolders(); }
        else if (n >= 0 && window.GroveMuseum && GroveMuseum.openSlot) { downPt = null; snd('click'); tipEl.classList.remove('on'); const o = lvEl.querySelector('.lvn.hov'); if (o) o.classList.remove('hov'); hovNode = -1; cv.classList.remove('pick'); GroveMuseum.openSlot(n); }
      }
      downPt = null;
      if (pointers.size < 2) pinch = null;
      if (drag && pointers.size === 0) {
        const lt = drag.lt; drag = null; cv.classList.remove('grab'); const b = bounds();
        if (performance.now() - lt > 90) { vx = vy = 0; }           /* held still before letting go: no glide */
        tx = hard(cx + vx * .28, b.x0, b.x1); ty = hard(cy + vy * .28, b.y0, b.y1); vx = vy = 0; savePos();
      } else if (pointers.size === 1) {          /* one finger left after a pinch: carry on dragging with it */
        const r = [...pointers.values()][0]; drag = { x: r.x, y: r.y, cx: cx, cy: cy, lt: performance.now() }; tx = cx; ty = cy;
      }
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', ev => {
      ev.preventDefault(); hintOff();
      const dy = ev.deltaMode === 1 ? ev.deltaY * 0.05 : ev.deltaY * 0.0016;
      zoomTo(tk * Math.exp(-clamp(dy, -.5, .5) * (ev.ctrlKey ? 2.2 : 1)), ev.clientX, ev.clientY);
    }, { passive: false });
    cv.addEventListener('dblclick', ev => zoomTo(tk * 1.6, ev.clientX, ev.clientY));
    addEventListener('resize', () => { if (isOpen) resize(); });
    /* while the map is open, keys belong to the map only (the game's own letter shortcuts must not fire) */
    addEventListener('keydown', ev => {
      if (!isOpen || (window.GroveMuseum && GroveMuseum.isOpen && GroveMuseum.isOpen())) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey || /^F\d+$/.test(ev.key)) return;
      const key = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
      if (key === 'Escape') { close(); } else if (key === '0' || key === 'Home') { home(); }
      else if ('wasd+=-_'.includes(key) || key.startsWith('Arrow')) { keys[key] = 1; hintOff(); autoCenter = false; }
      ev.preventDefault(); ev.stopImmediatePropagation();
    }, true);
    addEventListener('keyup', ev => { const key = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key; delete keys[key]; if (key === '=' ) delete keys['+']; if (key === '+') delete keys['=']; }, true);
    addEventListener('blur', () => { for (const x in keys) delete keys[x]; });
  }

  /* ---------------- window ---------------- */
  let loadEl = null, openedAt = 0;
  function build() {
    if (built) return; built = true;
    root = document.createElement('div'); root.className = 'wm'; root.id = 'wm'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'World map');
    root.innerHTML = '<canvas></canvas><canvas class="wm-fx"></canvas><div class="wm-lv"></div><div class="wm-tip"></div><div class="wm-vig"></div>' +
      '<button type="button" class="wm-btn wm-back">' + ICON_BACK + 'Back</button>' +
      '<div class="wm-zoom"><button type="button" class="wm-btn" data-z="in" aria-label="Zoom in"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>' +
      '<button type="button" class="wm-btn" data-z="out" aria-label="Zoom out"><svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg></button>' +
      '<button type="button" class="wm-btn" data-z="home" aria-label="Back to the start view"><svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7M6.500 9.500V20h11V9.500"/></svg></button></div>' +
      '<div class="wm-hint">Drag to explore &middot; scroll or pinch to zoom &middot; W A S D or arrow keys to move</div>' +
      '<div class="wm-load"><i></i>Loading the map&hellip;</div>';
    document.body.appendChild(root);
    cv = root.querySelector('canvas'); g = cv.getContext('2d'); fxCv = root.querySelector('.wm-fx'); fx = fxCv.getContext('2d'); lvEl = root.querySelector('.wm-lv'); tipEl = root.querySelector('.wm-tip'); loadEl = root.querySelector('.wm-load');
    root.querySelector('.wm-back').onclick = () => close();
    root.querySelector('.wm-zoom').addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return; snd('click'); hintOff();
      if (b.dataset.z === 'in') zoomTo(tk * 1.45); else if (b.dataset.z === 'out') zoomTo(tk / 1.45); else home();
    });
    bindInput();
  }
  async function open(opts) {
    if (isOpen) return;
    build();
    mode = opts && opts.levels && TR ? 'levels' : 'map';
    root.classList.toggle('lv', mode === 'levels');
    root.querySelector('.wm-hint').innerHTML = mode === 'levels' ? 'Drag to explore &middot; scroll or pinch to zoom &middot; click a level to open it' : 'Drag to explore &middot; scroll or pinch to zoom &middot; W A S D or arrow keys to move';
    try { await loadMeta(); } catch (e) { alert('The map pictures are missing (public/map). Run tools/make_map_tiles.py first.'); return; }
    isOpen = true; openedAt = performance.now();
    snd('whoosh');
    root.classList.remove('out'); root.classList.add('on'); loadEl.classList.remove('off');
    const h = root.querySelector('.wm-hint'); h.classList.remove('off'); h.style.animation = 'none'; void h.offsetWidth; h.style.animation = '';
    resize();
    if (mode === 'levels') {
      buildLv(); snap = []; hovNode = -1; autoCenter = true; for (const k in litF) delete litF[k]; litT = 0;
      const G = window.GroveMuseum; if (G && G.watch) { G.watch(true); offChange = G.onChange(refreshLv); }
      refreshLv();
      setTimeout(() => { autoCenter = false; }, 2500);
    }
    k = tk = clamp(mode === 'levels' ? LV_ZOOM : OPEN_ZOOM, minZoom(), MAX_ZOOM); anchor = null;
    const p = startPos(); cx = tx = p[0]; cy = ty = p[1]; clampAll(); vx = vy = 0; dirty = true; lastT = 0;
    plan(); if (!raf) raf = requestAnimationFrame(frame);
    setTimeout(hintOff, 7000);
  }
  function close() {
    if (!isOpen) return; savePos(); snd('back');
    if (mode === 'levels') { if (offChange) { offChange(); offChange = null; } if (window.GroveMuseum && GroveMuseum.watch) GroveMuseum.watch(false); tipEl.classList.remove('on'); }
    root.classList.add('out');
    setTimeout(() => { root.classList.remove('on', 'out'); isOpen = false; cancelAnimationFrame(raf); raf = 0; for (const x in keys) delete keys[x]; pointers.clear(); drag = pinch = null; }, 300);
  }

  /* ---------------- the button in the game ---------------- */
  const btn = document.createElement('button');
  btn.id = 'wmbtn'; btn.type = 'button'; btn.title = 'World map'; btn.setAttribute('aria-label', 'World map'); btn.innerHTML = ICON_MAP;
  btn.addEventListener('click', () => open());
  /* no map button on the stage any more: the world map opens from the Achievements (trophy) button (openWorldMap / openMuseum) */
  window.openWorldMap = open; window.closeWorldMap = close;

  /* warm up while the start screen is showing, so the map opens without waiting: the small levels and the tiles around the start view */
  function warm() {
    loadMeta().then(() => {
      const prevVw = vw, prevVh = vh; vw = vw || innerWidth; vh = vh || innerHeight; dpr = Math.min(2, window.devicePixelRatio || 1);
      const p = startPos(); cx = p[0]; cy = p[1]; k = OPEN_ZOOM;
      plan(); vw = prevVw; vh = prevVh;
    }).catch(() => {});
  }
  if (document.readyState === 'complete') setTimeout(warm, 1500); else addEventListener('load', () => setTimeout(warm, 1500));
})();
