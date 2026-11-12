/* =====================================================================
   Mira's Grove - game feel, part 2   (fx2.js + fx2.css)

   Animations and sound effects for the screens fx.js does not cover: the World Map, the Creators Museum,
   the Folders and the flip cards, plus a few finishing touches (character cards, fullscreen).

   It adds NO feature. Every effect is triggered by something the player already does; this file only WATCHES the
   existing pages (events and MutationObservers) and never changes data, layout or behaviour. Everything is wrapped
   in try/catch, so a failure here can never break the site. Sounds come from fx.js (GroveFX.sound); the overall
   feel (volume, ambience, particle cap) is tuned with the TUNE constants at the top of fx.js.

   Loaded last (see index.html). Needs fx.js.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__groveFx2) return;
  window.__groveFx2 = true;
  const FX = window.GroveFX;
  if (!FX || !FX.sound) return;

  const SND = FX.sound, de = document.documentElement, TUNE = FX.tune || { particles: 320 };
  const RM = () => de.classList.contains('fx-rm');                                   /* the player asked for reduced motion: sounds stay, big movement goes */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const safe = fn => { try { return fn(); } catch (e) { console.warn('[fx2]', e); } };
  const play = (n, a) => safe(() => SND.play(n, a));
  const quiet = (n, ms) => !SND.since || SND.since(n) > (ms || 160);                 /* true when that sound has not just played (avoids doubling up) */
  const later = (fn, ms) => setTimeout(() => safe(fn), ms || 0);
  const retrig = (el, cls, ms) => { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); later(() => el.classList.remove(cls), ms || 800); };
  const mid = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r]; };

  /* =====================================================================
     1. PARTICLES over the museum and the world map (viewport pixels, drawn only while something is alive)
     ===================================================================== */
  let cv = null, g = null, parts = [], raf = 0, last = 0, dpr = 1;
  const CAP = Math.min(TUNE.particles || 320, 360);
  const CONF = ['#6fbf5a', '#f2c94c', '#e0604c', '#f7edd6', '#5aa6d6', '#c690e0', '#ff9f5a'];
  function size() { if (!cv) return; dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr); }
  function ensure() { if (cv) return; cv = document.createElement('canvas'); cv.id = 'fx2c'; document.body.appendChild(cv); g = cv.getContext('2d'); size(); addEventListener('resize', size); }
  function add(p) {
    if (RM() || parts.length >= CAP) return;
    ensure();
    if (!g) return;
    parts.push(Object.assign({ life: 0, max: 1, x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 0, rot: 0, vr: 0 }, p));
    if (!raf) { last = 0; raf = requestAnimationFrame(tick); }
  }
  function star(c, x, y, r, rot) {
    c.beginPath();
    for (let i = 0; i < 8; i++) { const a = rot + i * Math.PI / 4, rr = i % 2 ? r * .32 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath(); c.fill();
  }
  function tick(ms) {
    raf = 0;
    if (!cv) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, innerWidth, innerHeight);
    if (!parts.length) return;
    const dt = Math.min(.05, last ? (ms - last) / 1000 : .016); last = ms;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      const k = p.life / p.max;
      p.vx -= p.vx * p.drag * dt; p.vy += p.g * dt - p.vy * p.drag * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      g.globalAlpha = 1;
      if (p.k === 'spark') {
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - k * k; g.fillStyle = p.col;
        star(g, p.x, p.y, p.r * (1 - k * .6) * (.75 + .25 * Math.sin(p.life * 40)), p.rot);
        g.globalCompositeOperation = 'source-over';
      } else if (p.k === 'conf') {
        g.globalAlpha = k > .75 ? (1 - k) * 4 : 1;
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, Math.abs(Math.sin(p.life * p.fl)) * .9 + .1);
        g.fillStyle = p.col; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore();
      } else if (p.k === 'ring') {
        const e = 1 - Math.pow(1 - k, 3), r = p.r0 + (p.r1 - p.r0) * e;
        g.globalAlpha = 1 - k; g.strokeStyle = p.col; g.lineWidth = p.lw * (1 - k) + 1;
        g.beginPath(); g.arc(p.x, p.y, r, 0, 6.2832); g.stroke();
      } else if (p.k === 'puff') {
        g.globalAlpha = (1 - k) * .6; g.fillStyle = p.col || '#e9e0bd';
        g.beginPath(); g.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * k, 0, 6.2832); g.fill();
      }
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (parts.length) raf = requestAnimationFrame(tick); else g.clearRect(0, 0, innerWidth, innerHeight);
  }
  function burst(x, y, n, pw, cols) {
    cols = cols || ['#fff3b0', '#ffe08a', '#bff5a0', '#ffffff'];
    for (let i = 0; i < n; i++) { const a = rnd(0, 6.283), s = rnd(pw * .3, pw); add({ k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, g: 260, drag: 1.4, max: rnd(.5, 1), r: rnd(5, 11), col: pick(cols), rot: rnd(0, 6), vr: rnd(-6, 6) }); }
  }
  const ring = (x, y, r1, col, lw) => add({ k: 'ring', x, y, max: .6, r0: 6, r1: r1 || 70, lw: lw || 5, col: col || 'rgba(255,236,150,.95)' });
  function puff(x, y, n) { for (let i = 0; i < n; i++) add({ k: 'puff', x: x + rnd(-14, 14), y: y + rnd(-10, 10), vx: rnd(-60, 60), vy: rnd(-70, -10), drag: 1.6, max: rnd(.35, .6), r0: 6, r1: rnd(18, 30) }); }
  function conf(x, y, n, spread, up, w) {
    for (let i = 0; i < n; i++) add({ k: 'conf', x: x + rnd(-w, w), y, vx: rnd(-spread, spread), vy: -rnd(up * .4, up), g: 380, drag: 1.1, max: rnd(1.6, 2.6), w: rnd(6, 11), h: rnd(10, 16), col: pick(CONF), rot: rnd(0, 6), vr: rnd(-8, 8), fl: rnd(6, 14) });
  }

  /* =====================================================================
     2. THE CREATORS MUSEUM + FOLDERS
     ===================================================================== */
  const onMuOpen = [], onMuClose = [];
  function museum(mu) {
    const body = $('#mu-body', mu), modal = $('#mu-modal', mu), toastEl = $('#mu-toast', mu);
    if (!body || !modal || !toastEl) return;
    const isOpen = () => mu.classList.contains('open');
    let lastScreen = mu.dataset.screen || '', lastSc = '', prevKeys = new Set(), wasFolder = false, lastDrop = null, wasOpen = isOpen();

    /* ---- pages: the cards are dealt in one after another; a card that is added later pops in; the heading drops in ---- */
    const keyOf = (el, i) => el.dataset.v || el.dataset.f || (el.querySelector('[data-v]') || { dataset: {} }).dataset.v || (el.querySelector('[data-b]') || { dataset: {} }).dataset.b || ('i' + i);
    let paintQ = 0;
    function onPaint() {
      paintQ = 0;
      if (!isOpen()) return;
      const sc = (body.dataset.sc || '') + '|' + mu.dataset.screen, cards = $$('.yg > *, .bg > *', body), changed = sc !== lastSc;
      lastSc = sc;
      const keys = new Set(cards.map(keyOf));
      if (RM()) { prevKeys = keys; return; }
      if (changed) {
        prevKeys = keys;
        body.classList.add('fx2-page'); later(() => body.classList.remove('fx2-page'), 1000);
      } else {
        const fresh = cards.filter((el, i) => !prevKeys.has(keyOf(el, i)));
        prevKeys = keys;
        fresh.slice(0, 6).forEach(el => { el.classList.add('fx2-new'); later(() => el.classList.remove('fx2-new'), 700); });
      }
    }
    new MutationObserver(() => { if (!paintQ) paintQ = requestAnimationFrame(() => safe(onPaint)); }).observe(body, { childList: true, attributes: true, attributeFilter: ['data-sc'] });

    /* ---- turning pages: a paper sound (the museum's own sounds are never doubled); leaving a folder closes it ---- */
    new MutationObserver(() => {
      const s = mu.dataset.screen; if (s === lastScreen) return; lastScreen = s;
      if (!isOpen()) return;
      later(() => {
        const inF = !!$('.fo-tt', body);
        if (wasFolder && !inF && s === 'folders') play('closeFolder');
        else if (quiet('flip', 220) && quiet('openFolder', 450) && quiet('select', 180) && quiet('back', 180) && quiet('click', 150)) play('pageTurn');
        wasFolder = inF;
      }, 30);
    }).observe(mu, { attributes: true, attributeFilter: ['data-screen'] });

    /* the museum opening / closing: the world map's ambience gets quieter behind it; bridges to the world-map effects */
    new MutationObserver(() => {
      const o = isOpen(); if (o === wasOpen) return; wasOpen = o;
      safe(() => SND.duck && SND.duck(o ? .3 : 1));
      (o ? onMuOpen : onMuClose).forEach(f => safe(f));
    }).observe(mu, { attributes: true, attributeFilter: ['class'] });

    /* the very first time the museum is opened it is built and opened in one go, before the watchers above exist: catch up */
    if (wasOpen) { safe(() => SND.duck && SND.duck(.3)); later(() => onMuOpen.forEach(f => safe(f)), 0); }

    /* ---- hovering the cards and buttons: a tiny sound (they already lift in CSS) ---- */
    let lastH = null;
    mu.addEventListener('mouseover', e => {
      const t = e.target.closest && e.target.closest('.yc,.rlf,.bk,.fd,.ab,.mu-btn,.fcol,.wk,.rm,.lnk,.sl');
      const o = t && (t.closest('.rlf') || t);
      if (o === lastH) return;
      lastH = o; if (o) play('hoverSoft');
    });

    /* ---- ticking a video as watched: a stamp, a ring, sparkles and a chime that rises with the progress ---- */
    mu.addEventListener('click', e => safe(() => {
      const b = e.target.closest && e.target.closest('.wk'); if (!b) return;
      const key = b.dataset.v || '';
      later(() => {
        const el = b.isConnected ? b : $$('.wk', body).find(x => (x.dataset.v || '') === key);
        if (!el) return;
        if (!el.classList.contains('on')) { play('hoverSoft'); return; }
        const all = $$('.wk', body), done = all.filter(x => x.classList.contains('on')).length, k = all.length ? done / all.length : 0;
        retrig(el, 'fx2-stamp', 600);
        const c = mid(el); ring(c[0], c[1], 46, 'rgba(255,236,150,.95)', 4); burst(c[0], c[1], 9, 150);
        play('stamp'); later(() => play('tickUp', k), 70);
      }, 0);
    }));

    /* ---- finishing a creator's level: the "Level N complete!" message gets a fanfare, confetti and a banner ---- */
    let banner = null;
    function showBanner(t1, t2) {
      if (RM()) return;
      if (!banner) { banner = document.createElement('div'); banner.id = 'fx2lv'; document.body.appendChild(banner); }
      banner.innerHTML = '<div class="rays"></div><div class="t1"></div><div class="t2"></div>';
      banner.querySelector('.t1').textContent = t1; banner.querySelector('.t2').textContent = t2 || '';
      retrig(banner, 'on', 3100);
    }
    function levelComplete(txt) {
      const W = innerWidth, H = innerHeight, m = /level (\d+) complete/i.exec(txt);
      play('fanfare');
      conf(W * .18, H * .96, 40, 130, 760, 50); conf(W * .82, H * .96, 40, 130, 760, 50); burst(W / 2, H * .42, 32, 400);
      showBanner('LEVEL COMPLETE!', m ? 'Level ' + m[1] : '');
    }

    /* ---- dropping / pasting a link: the thing that received it bounces and sparkles; refused drops sound soft and low ---- */
    mu.addEventListener('drop', e => { lastDrop = { x: e.clientX, y: e.clientY, t: performance.now() }; }, true);
    function dropSuccess(t) {
      later(() => {
        const m = /“(.+?)”/.exec(t);
        let el = null, x, y;
        if (m) el = $$('.fd', body).find(f => { const b = f.querySelector('.bt'); return b && b.textContent === m[1]; }) || null;
        if (el) { const c = mid(el); x = c[0]; y = c[1]; retrig(el, 'fx2-bounce', 800); }
        else if (lastDrop && performance.now() - lastDrop.t < 2500) { x = lastDrop.x; y = lastDrop.y; }
        else { x = innerWidth / 2; y = innerHeight * .45; }
        burst(x, y, 12, 200); ring(x, y, 60, 'rgba(255,236,150,.9)', 4);
        play('dropIn'); later(() => play('paperSlip'), 90);
      }, 70);
    }
    let lastToast = '', lastToastAt = -1e9;
    function toastFX() {
      if (!toastEl.classList.contains('on')) return;
      const t = (toastEl.textContent || '').trim(); if (!t) return;
      const now = performance.now(); if (t === lastToast && now - lastToastAt < 450) return;
      lastToast = t; lastToastAt = now;
      if (/level \d+ complete/i.test(t)) return levelComplete(t);
      if (/^added to|videos added to/i.test(t)) return dropSuccess(t);
      if (/does not look like|drop it right|is full|only the first|already have|the most folders|could not|can't|cannot/i.test(t)) return play('denied');
      if (/deleted|removed/i.test(t)) return play('thud');
      if (quiet('confirm', 250) && quiet('pop', 250) && quiet('select', 250) && quiet('dropIn', 300) && quiet('error', 250)) play('ping', 3);
    }
    new MutationObserver(() => safe(toastFX)).observe(toastEl, { attributes: true, attributeFilter: ['class'], childList: true, characterData: true, subtree: true });

    /* ---- removing something (remove mode): the card shrinks away in a puff ---- */
    mu.addEventListener('click', e => safe(() => {
      const b = e.target.closest && e.target.closest('[data-a="rmv"],[data-a="rmb"]'); if (!b || RM()) return;
      const card = b.closest('.rlf,.yc,.bk'); if (!card) return;
      const r = card.getBoundingClientRect(), c = card.cloneNode(true);
      $$('[data-a]', c).forEach(n => n.removeAttribute('data-a')); c.removeAttribute('data-a'); c.classList.add('fx2-ghost');
      Object.assign(c.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', margin: '0', zIndex: '45', pointerEvents: 'none' });
      mu.appendChild(c);
      const done = () => c.remove();
      if (c.animate) c.animate([{ transform: 'scale(1) rotate(0deg)', opacity: 1 }, { transform: 'scale(.15) rotate(-9deg)', opacity: 0 }], { duration: 380, easing: 'cubic-bezier(.5,0,.8,.4)' }).onfinish = done;
      else later(done, 400);
      later(done, 700);
      puff(r.left + r.width / 2, r.top + r.height / 2, 7); play('poof');
    }), true);

    /* ---- the New / Edit folder card: opens with a paper sound; a refused name shakes it ---- */
    new MutationObserver(() => { if (modal.classList.contains('on')) play('paperSlip'); }).observe(modal, { attributes: true, attributeFilter: ['class'] });   /* layers softly under the museum's own click */
    let lastErrAt = -1e9;
    new MutationObserver(() => {
      const err = $('#mu-err', modal); if (!err || !err.textContent.trim()) return;
      const now = performance.now(); if (now - lastErrAt < 400) return; lastErrAt = now;
      const card = $('.paper-card', modal);
      if (card && card.animate && !RM()) card.animate([0, -10, 9, -6, 3, 0].map(v => ({ translate: v + 'px 0' })), { duration: 380, easing: 'linear' });
      play('denied');
    }).observe(modal, { childList: true, characterData: true, subtree: true });

    /* ---- opening a folder: the front tilts open and the pictures rise, THEN the page changes ---- */
    mu.addEventListener('click', e => safe(() => {
      const f = e.target.closest && e.target.closest('.fd[data-f]'); if (!f || RM()) return;
      if (f.dataset.fx2go) { delete f.dataset.fx2go; return; }                  /* second pass: let the real handler open the folder */
      e.stopImmediatePropagation(); e.preventDefault();
      if (f.classList.contains('fx2-open')) return;
      f.classList.add('fx2-open'); play('openFolder');
      later(() => { f.classList.remove('fx2-open'); f.dataset.fx2go = '1'; f.click(); }, 240);
    }), true);

    /* ---- a folder lights up when a link is dragged over it: a soft tick when it changes ---- */
    new MutationObserver(ms => {
      for (const m of ms) if (m.target.classList && m.target.classList.contains('drop') && !/\bdrop\b/.test(m.oldValue || '')) { play('hoverSoft'); break; }
    }).observe(body, { attributes: true, attributeFilter: ['class'], attributeOldValue: true, subtree: true });

    /* ---- the flip card: it lifts while it turns; each side has its own sound ---- */
    mu.addEventListener('dblclick', e => safe(() => {
      const hot = e.target.closest && e.target.closest('.fhot'); if (!hot) return;
      const w = hot.closest('.rlf'); if (!w) return;
      later(() => { play(w.classList.contains('flipped') ? 'card' : 'cardFlipBack'); retrig(w, 'fx2-lift', 950); }, 0);
    }));

    /* ---- writing a note on the back: a very soft pen tick (rate-limited in fx.js) ---- */
    mu.addEventListener('input', e => { if (e.target.classList && e.target.classList.contains('rnote')) play('penTick'); });
  }

  /* =====================================================================
     3. THE WORLD MAP: ambience, medallions, locks, unlocks
     ===================================================================== */
  function worldmap(wm) {
    const lv = $('.wm-lv', wm), tip = $('.wm-tip', wm), cvm = $('canvas', wm);
    if (!lv || !tip || !cvm) return;
    let wasOn = false, armed = false, armT = 0, lastHov = null, lastHovT = -1e9, queue = [], lastRatT = -1e9;
    const mu = () => $('#mu');
    const muOpen = () => { const m = mu(); return !!(m && m.classList.contains('open')); };

    /* opening the map: a soft shimmer and the ambience; closing: the ambience fades away */
    new MutationObserver(() => {
      const on = wm.classList.contains('on') && !wm.classList.contains('out');
      if (on && !wasOn) {
        wasOn = true; armed = false; queue.length = 0; clearTimeout(armT); armT = setTimeout(() => { armed = true; }, 1300);
        safe(() => SND.ambience && SND.ambience(true)); later(() => play('shimmer'), 300);
      } else if (!on && wasOn) {
        wasOn = false; armed = false; queue.length = 0; clearTimeout(armT);
        safe(() => { SND.ambience && SND.ambience(false); SND.duck && SND.duck(1); });
      }
    }).observe(wm, { attributes: true, attributeFilter: ['class'] });

    /* medallions: hover tick; a level that just unlocked or was completed gets its celebration (waits until you are back on the map) */
    function ev(o) { if (muOpen()) queue.push(o); else fire([o]); }
    function fire(list) {
      list.forEach((o, i) => later(() => { if (!o.t.isConnected || !wasOn) return; (o.type === 'unlock' ? unlockFX : doneFX)(o.t); }, i * 750));
    }
    function disc(t) { const c = mid($('.pt', t) || t); return { x: c[0], y: c[1], r: c[2].width / 2 }; }
    function unlockFX(t) {
      const d = disc(t);
      play('unlock'); ring(d.x, d.y, d.r * 1.7, 'rgba(255,236,150,.95)', 6); burst(d.x, d.y, 18, 280); puff(d.x, d.y, 6);
      retrig(t, 'fx2-unlock', 1100);
    }
    function doneFX(t) {
      const d = disc(t);
      play('trophy'); ring(d.x, d.y, d.r * 2.1, 'rgba(255,214,90,.95)', 7); conf(d.x, d.y, 22, 170, 520, 26); burst(d.x, d.y, 16, 240);
      retrig(t, 'fx2-done', 1000);
    }
    new MutationObserver(ms => {
      for (const m of ms) {
        const t = m.target; if (!t.classList || !t.classList.contains('lvn')) continue;
        const old = m.oldValue || '', had = k => new RegExp('(^|\\s)' + k + '(\\s|$)').test(old), has = k => t.classList.contains(k);
        if (has('hov') && !had('hov')) { lastHov = t; lastHovT = performance.now(); play('hoverSoft'); }
        if (armed) {
          if (had('locked') && !has('locked')) ev({ t, type: 'unlock' });
          if (!had('done') && has('done')) ev({ t, type: 'done' });
        }
      }
    }).observe(lv, { attributes: true, attributeFilter: ['class'], attributeOldValue: true, subtree: true });
    onMuClose.push(() => {
      if (!wasOn || !queue.length) return;
      const q = queue.splice(0).sort((a, b) => (a.type === 'done' ? -1 : 1) - (b.type === 'done' ? -1 : 1));
      later(() => fire(q), 450);
    });
    /* clicking a level opens the museum: a ring of light on the medallion */
    onMuOpen.push(() => {
      if (!wasOn || !lastHov || performance.now() - lastHovT > 6000) return;
      const d = disc(lastHov); ring(d.x, d.y, d.r * 1.5, 'rgba(255,236,150,.95)', 5); burst(d.x, d.y, 12, 220); play('ringBurst');
    });

    /* a locked level: it rattles and a dull, soft thud plays (the existing message stays) */
    new MutationObserver(() => {
      if (!tip.classList.contains('msg') || !/locked/i.test(tip.textContent)) return;
      const now = performance.now(); if (now - lastRatT < 800) return; lastRatT = now;
      play('lockRattle');
      if (lastHov && now - lastHovT < 8000) retrig(lastHov, 'fx2-rattle', 650);
    }).observe(tip, { attributes: true, attributeFilter: ['class'] });

    /* pressing a medallion squashes it; zooming gives a soft tick */
    cvm.addEventListener('pointerdown', () => { const h = $('.lvn.hov', lv); if (h) h.classList.add('press'); });
    const release = () => $$('.lvn.press', lv).forEach(x => x.classList.remove('press'));
    addEventListener('pointerup', release, true); addEventListener('pointercancel', release, true);
    cvm.addEventListener('wheel', () => play('hoverSoft'), { passive: true });
  }

  /* =====================================================================
     4. FINISHING TOUCHES
     ===================================================================== */
  /* fullscreen (the box under the stats card): a rising whoosh going in, a soft fall coming out */
  const fsChange = () => play(document.fullscreenElement || document.webkitFullscreenElement ? 'whoosh' : 'back');
  document.addEventListener('fullscreenchange', fsChange); document.addEventListener('webkitfullscreenchange', fsChange);

  /* the character and archetype cards on the login screen lean toward the pointer, and choosing one swishes */
  safe(() => {
    const SEL = '#achars .ach:not(.tk), #aarchs .aac';
    document.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || RM()) return;
      const c = e.target.closest && e.target.closest(SEL); if (!c) return;
      const r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
      c.style.setProperty('--rx', (-py * 10).toFixed(1) + 'deg'); c.style.setProperty('--ry', (px * 12).toFixed(1) + 'deg');
    }, { passive: true });
    document.addEventListener('pointerout', e => { const c = e.target.closest && e.target.closest(SEL); if (c) { c.style.removeProperty('--rx'); c.style.removeProperty('--ry'); } });
    document.addEventListener('click', e => { if (e.target.closest && e.target.closest(SEL)) play('swish'); }, true);
  });

  /* =====================================================================
     5. START: the museum and the map are built the first time they are opened
     ===================================================================== */
  function whenEl(sel, cb) {
    const e = $(sel); if (e) { safe(() => cb(e)); return; }
    const mo = new MutationObserver(() => { const f = $(sel); if (f) { mo.disconnect(); safe(() => cb(f)); } });
    mo.observe(document.body, { childList: true });
  }
  whenEl('#mu', museum);
  whenEl('#wm', worldmap);
})();
