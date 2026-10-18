/* Mira's Grove - game feel: synthesized sound effects (Web Audio, no files to load) + a few light effects.
   Loaded after the glue script. It only listens to the page and wraps a few functions; it never changes game logic.
   Everything is wrapped in try/catch so a missing piece can never break the app. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const safe = (fn) => function () { try { return fn.apply(this, arguments); } catch (e) { /* effects must never break the app */ } };

  /* =============== SOUND ENGINE =============== */
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null, master = null, noiseBuf = null, unlocked = false, lastErr = 0;
  let muted = false;
  try { muted = localStorage.getItem('grove_mute') === '1'; } catch (e) {}

  function ensure() {
    if (!AC) return false;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.32;
      const lp = ctx.createBiquadFilter();           /* soften the harsh edges of the square waves */
      lp.type = 'lowpass'; lp.frequency.value = 5200;
      master.connect(lp); lp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return true;
  }
  const ready = () => !muted && unlocked && ensure() && ctx.state !== 'closed';

  /* one oscillator note: f -> f2 (optional glide), starts t seconds from now */
  function tone(o) {
    const f = o.f, d = o.d || 0.12, v = o.v == null ? 0.18 : o.v, t0 = ctx.currentTime + (o.t || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + d);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + d + 0.03);
  }
  /* filtered noise burst (footsteps, paper) */
  function noise(o) {
    const d = o.d || 0.1, t0 = ctx.currentTime + (o.t || 0);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = o.type || 'bandpass';
    fl.frequency.setValueAtTime(o.fc || 1500, t0);
    if (o.fc2) fl.frequency.exponentialRampToValueAtTime(o.fc2, t0 + d);
    fl.Q.value = o.q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.v == null ? 0.2 : o.v, t0 + (o.a || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    src.connect(fl); fl.connect(g); g.connect(master);
    src.start(t0, Math.random() * 0.2); src.stop(t0 + d + 0.03);
  }
  const N = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5, G6: 1568 };

  const SFX = {
    click() { tone({ f: 640, f2: 900, d: 0.07, type: 'square', v: 0.11 }); },
    hover() { tone({ f: 1250, d: 0.03, type: 'sine', v: 0.035 }); },
    tick() { tone({ f: 900, f2: 1100, d: 0.04, type: 'triangle', v: 0.1 }); },
    key() { tone({ f: 1500 + Math.random() * 300, d: 0.018, type: 'square', v: 0.018 }); },
    back() { tone({ f: 620, f2: 330, d: 0.1, type: 'square', v: 0.1 }); },
    deny() { tone({ f: 190, d: 0.09, type: 'square', v: 0.12 }); tone({ f: 150, d: 0.12, t: 0.08, type: 'square', v: 0.12 }); },
    select() { tone({ f: N.E5, d: 0.07, type: 'square', v: 0.1 }); tone({ f: N.A5, d: 0.12, t: 0.06, type: 'square', v: 0.1 }); },
    confirm() { [N.C5, N.E5, N.G5].forEach((f, i) => tone({ f, d: 0.12, t: i * 0.07, type: 'triangle', v: 0.16 })); },
    open() { tone({ f: 420, f2: 840, d: 0.14, type: 'triangle', v: 0.12 }); },
    cal() { [N.G5, N.C6, N.E6].forEach((f, i) => tone({ f, d: 0.07, t: i * 0.045, type: 'triangle', v: 0.1 })); },
    pop() { tone({ f: 540, f2: 900, d: 0.09, type: 'sine', v: 0.14 }); },
    /* page turn: a swish of noise + a soft low thump */
    flip() { noise({ fc: 700, fc2: 3800, q: 0.9, d: 0.26, v: 0.16, a: 0.05 }); tone({ f: 200, f2: 120, d: 0.12, type: 'sine', v: 0.1 }); },
    /* footstep: low thud + a bit of grit, slightly different every time */
    step() { const p = 0.85 + Math.random() * 0.4; tone({ f: 170 * p, f2: 90 * p, d: 0.07, type: 'sine', v: 0.2 }); noise({ fc: 900 * p, q: 0.8, d: 0.05, v: 0.1 }); },
    coin(i) { const f = 988 * Math.pow(1.122, i || 0); tone({ f, d: 0.07, type: 'square', v: 0.1 }); tone({ f: f * 1.335, d: 0.2, t: 0.07, type: 'square', v: 0.1 }); },
    success() { [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => tone({ f, d: 0.16, t: i * 0.08, type: 'square', v: 0.11 })); tone({ f: N.C6, d: 0.45, t: 0.32, type: 'triangle', v: 0.14 }); },
    levelup() {
      [N.C5, N.E5, N.G5, N.C6, N.E6, N.G6].forEach((f, i) => { tone({ f, d: 0.14, t: i * 0.085, type: 'square', v: 0.1 }); tone({ f: f / 2, d: 0.14, t: i * 0.085, type: 'triangle', v: 0.1 }); });
      [N.C6, N.E6, N.G6].forEach((f) => tone({ f, d: 0.7, t: 0.55, type: 'triangle', v: 0.12 }));
    },
    error() { tone({ f: 260, f2: 200, d: 0.14, type: 'sawtooth', v: 0.11 }); tone({ f: 200, f2: 130, d: 0.22, t: 0.13, type: 'sawtooth', v: 0.11 }); },
    welcome() { [N.G5, N.C6, N.E6, N.G6].forEach((f, i) => tone({ f, d: 0.14, t: i * 0.07, type: 'triangle', v: 0.13 })); },
  };
  const hoverGate = { t: 0 }, keyGate = { t: 0 };
  function play(name, a) {
    try {
      if (!ready()) return;
      const now = performance.now();
      if (name === 'hover') { if (now - hoverGate.t < 70) return; hoverGate.t = now; }
      if (name === 'key') { if (now - keyGate.t < 45) return; keyGate.t = now; }
      if (name === 'error') lastErr = now;
      SFX[name](a);
    } catch (e) {}
  }
  window.GroveSFX = { play };

  /* browsers only allow audio after a click or key press */
  const unlock = () => { unlocked = true; ensure(); };
  ['pointerdown', 'keydown', 'touchstart'].forEach((e) => addEventListener(e, unlock, { once: false, passive: true, capture: true }));

  /* =============== MUTE BUTTON =============== */
  const mb = document.createElement('button');
  mb.id = 'fxmute'; mb.type = 'button';
  const paintMute = () => {
    mb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="on" d="M4 9v6h4l5 4V5L8 9z"/>' +
      (muted ? '<path d="M17 9l5 6M22 9l-5 6"/>' : '<path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>') + '</svg>';
    mb.title = muted ? 'Sound off' : 'Sound on';
    mb.setAttribute('aria-label', mb.title);
  };
  paintMute();
  mb.onclick = () => {
    muted = !muted;
    try { localStorage.setItem('grove_mute', muted ? '1' : '0'); } catch (e) {}
    paintMute();
    unlocked = true;
    if (!muted) play('select');
  };
  document.body.appendChild(mb);

  /* =============== EFFECT LAYERS (inside the stage) =============== */
  const stage = $('#stage');
  const fx = document.createElement('div'); fx.id = 'fx';
  const amb = document.createElement('div'); amb.id = 'fxamb';
  stage.appendChild(amb); stage.appendChild(fx);

  /* fireflies: 9 tiny glowing dots, transform/opacity only */
  if (!REDUCE) {
    for (let i = 0; i < 9; i++) {
      const f = document.createElement('i');
      f.className = 'fx-ff';
      f.style.cssText = 'left:' + (60 + Math.random() * 1250) + 'px;top:' + (60 + Math.random() * 640) + 'px;' +
        '--x:' + (Math.random() * 160 - 80).toFixed(0) + 'px;--y:' + (Math.random() * 120 - 70).toFixed(0) + 'px;' +
        '--t:' + (7 + Math.random() * 6).toFixed(1) + 's;--d:-' + (Math.random() * 8).toFixed(1) + 's';
      amb.appendChild(f);
    }
  }

  function spawn(cls, x, y, css, life) {
    if (REDUCE) return null;
    const e = document.createElement('i');
    e.className = cls; e.style.left = x + 'px'; e.style.top = y + 'px';
    if (css) e.style.cssText += css;
    fx.appendChild(e);
    setTimeout(() => e.remove(), life || 1000);
    return e;
  }
  /* screen position -> stage coordinates (the stage is scaled to fit the window) */
  const toStage = (cx, cy) => { const r = stage.getBoundingClientRect(); return [(cx - r.left) / r.width * 1472, (cy - r.top) / r.height * 832]; };

  function sparkles(x, y, n, spread) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, d = (spread || 120) * (0.5 + Math.random() * 0.7);
      spawn('fx-spark', x, y, '--dx:' + (Math.cos(a) * d).toFixed(0) + 'px;--dy:' + (Math.sin(a) * d - 20).toFixed(0) + 'px;--s:' + (0.7 + Math.random() * 0.6).toFixed(2) + 's;' +
        (Math.random() < 0.3 ? 'background:#fff' : ''), 1400);
    }
  }

  /* =============== CLICKS, HOVERS, TYPING (one delegated listener each) =============== */
  const CLICKABLE = '.hb,.jh,.jnav,#auth button,#asw,.ach,.aac,.cc,#jcx,#jco,#afs';
  document.addEventListener('click', safe((e) => {
    const t = e.target.closest && e.target.closest(CLICKABLE);
    if (!t || t.disabled) return;
    const lab = t.getAttribute('aria-label') || '';
    if (t.id === 'fxmute') return;
    if (/^Player/.test(lab)) return play(t.style.cursor === 'not-allowed' ? 'deny' : 'select');
    if (lab === 'Journal') return;                         /* the journal opening plays its own page-turn */
    if (lab === 'Undo' || t.id === 'jback' || t.id === 'jcx' || t.id === 'eb') return play('back');
    if (t.id === 'jcalb') return play('cal');
    if (t.classList.contains('cc')) return play(t.classList.contains('fut') ? 'deny' : 'tick');
    if (t.classList.contains('ach')) return play(t.classList.contains('tk') ? 'deny' : 'select');
    if (t.classList.contains('aac')) return play('select');
    if (t.id === 'achoose' || t.id === 'aachoose') return play('confirm');
    if (lab === 'Reminders' || lab === 'Achievements') return play('open');
    play('click');
  }), true);

  document.addEventListener('mouseover', safe((e) => {
    const t = e.target.closest && e.target.closest('.hb,.jnav,.cc,.ach,.aac,#auth button,.jh');
    if (!t || t.disabled || (e.relatedTarget && t.contains(e.relatedTarget))) return;
    if (t.classList.contains('out') || t.classList.contains('fut') || t.classList.contains('tk')) return;
    play('hover');
  }));
  document.addEventListener('keydown', safe((e) => {
    const t = e.target;
    if (t && (t.id === 'jta' || (t.closest && t.closest('#auth'))) && e.key.length === 1) play('key');
  }));

  /* =============== HOOKS INTO THE GAME =============== */
  /* open the journal: page turn */
  if (typeof window.openJ === 'function') {
    const o = window.openJ;
    window.openJ = function () { play('flip'); return o.apply(this, arguments); };
  }
  /* toasts get a soft pop (not on top of an error buzz) */
  if (typeof window.groveToast === 'function') {
    const o = window.groveToast;
    window.groveToast = function () { if (performance.now() - lastErr > 350) play('pop'); return o.apply(this, arguments); };
  }

  /* the API: welcome chime on login, coins + fanfare when a journal is saved, buzz on errors */
  let myLevel = null;
  const A = window.GroveAPI;
  if (A) {
    const lvl = (p) => { if (p && typeof p.level === 'number') myLevel = p.level; return p; };
    ['login', 'register', 'me', 'chooseCharacter', 'chooseArchetype'].forEach((k) => {
      const o = A[k]; if (typeof o !== 'function') return;
      A[k] = function () {
        return o.apply(this, arguments).then((p) => { lvl(p); if (k === 'login' || k === 'register') play('welcome'); return p; },
          (err) => { if (k === 'login' || k === 'register') play('error'); throw err; });
      };
    });
    const sub = A.submitJournal;
    if (typeof sub === 'function') {
      A.submitJournal = function () {
        return sub.apply(this, arguments).then((d) => { try { celebrate(d); } catch (e) {} return d; },
          (err) => { play('error'); throw err; });
      };
    }
  }

  const STAT = [['int', 'INT'], ['end', 'END'], ['str', 'STR'], ['arc', 'ARC'], ['wis', 'WIS']];   /* same order as the stat panel rows */
  function celebrate(d) {
    const pts = (d && d.journal && d.journal.points) || (d && d.gained) || {};
    play('success');
    let n = 0;
    STAT.forEach(([k, label], i) => {
      const v = Number(pts[k]) || 0;
      if (v <= 0) return;
      const at = 350 + n * 160;
      setTimeout(() => {
        play('coin', n);
        const fl = spawn('fx-float', 318, 72 + 25 * i, null, 1600); if (fl) fl.textContent = '+' + v + ' ' + label;
        sparkles(300, 82 + 25 * i, 4, 40);
      }, at);
      n++;
    });
    const p = d && d.player;
    if (p && typeof p.level === 'number') {
      const up = myLevel != null && p.level > myLevel;
      myLevel = p.level;
      if (up) setTimeout(levelUp, 350 + n * 160 + 250, p.level);
    }
  }
  function levelUp(level) {
    play('levelup');
    const b = spawn('fx-lvl', 0, 330, null, 2100);
    if (b) { b.style.left = '0'; b.textContent = 'LEVEL UP!  Lv. ' + level; }
    sparkles(736, 380, 26, 340);
    sparkles(100, 110, 14, 110);
  }
  window.GroveFX = { levelUp, celebrate };

  /* =============== STATS PANEL: numbers pop when they change =============== */
  function watchBump(el) {
    if (!el) return;
    let prev = el.textContent;
    new MutationObserver(() => {
      if (el.textContent === prev) return;
      prev = el.textContent;
      el.classList.remove('fx-bump'); void el.offsetWidth; el.classList.add('fx-bump');
    }).observe(el, { childList: true, characterData: true, subtree: true });
  }
  document.querySelectorAll('.vl').forEach(watchBump);

  /* the pie spins in again whenever it is redrawn */
  const jsvg = $('#jsvg');
  if (jsvg && !REDUCE) {
    new MutationObserver(() => { jsvg.classList.remove('fx-pie'); void jsvg.getBoundingClientRect(); jsvg.classList.add('fx-pie'); })
      .observe(jsvg, { childList: true });
  }

  /* the white frame around the selected player card pulses */
  document.querySelectorAll('#stage > div').forEach((el) => {
    if (el.style.cssText.indexOf('border: 2.5px solid') >= 0 || el.style.cssText.indexOf('border:2.5px solid') >= 0) el.classList.add('fx-sel');
  });

  /* =============== THE MAP: tile ripple, footsteps, dust =============== */
  const cvs = $('#cv');
  if (cvs && typeof hit === 'function') {
    cvs.addEventListener('click', safe((e) => {
      const h = hit(e);
      if (!h) return;
      const c = cc(h[0], h[1]);
      spawn('fx-rip', c[0], c[1], null, 650);
      play('click');
    }));
  }
  /* poll Mira's tile a few times a second; every new tile = a footstep + a little dust */
  let lastTile = null;
  setInterval(safe(() => {
    if (document.hidden) return;
    const k = cur + '';
    if (lastTile === null) { lastTile = k; return; }
    if (k !== lastTile) {
      lastTile = k;
      play('step');
      if (!REDUCE) for (let i = 0; i < 3; i++) spawn('fx-dust', pos[0] + (Math.random() * 16 - 8), pos[1] + 12, '--dx:' + ((i - 1) * 14) + 'px', 600);
    }
  }), 70);
})();
