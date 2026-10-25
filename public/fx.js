/* =====================================================================
   Mira's Grove - game feel (fx.js)
   1. Sound effects: every sound is synthesized live with the Web Audio API,
      so there are no audio files to download or host.
   2. Particles on a canvas over the stage: footstep dust, tile ripples,
      fireflies, falling leaves, mushroom spores, sparkles, confetti.
   3. Hooks that make the existing UI react: buttons, stats, level up,
      journal book, calendar, login screens, toasts.
   Nothing in the design or the backend is changed; this file only listens.
   Loaded last (see index.html). Animations are in fx.css.
   Press M (or use the little speaker button) to mute / unmute.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__groveFx) return;
  window.__groveFx = true;

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const stage = $('#stage');
  if (!stage) return;
  const RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (RM) document.documentElement.classList.add('fx-rm');
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const safe = fn => { try { return fn(); } catch (e) { console.warn('[fx]', e); } };
  const easeOut = k => 1 - Math.pow(1 - k, 3);

  /* The page's own state lives in top-level `let` variables of the main script (visible to this script by name).
     They are read through small accessors so a missing one can never throw. */
  const G = {
    path: () => (typeof path !== 'undefined' && path) || [],
    cur: () => (typeof cur !== 'undefined' ? cur : null),
    pos: () => (typeof pos !== 'undefined' ? pos : null),
    hov: () => (typeof hov !== 'undefined' ? hov : null),
    hist: () => (typeof hist !== 'undefined' && hist) || [],
    me: () => (typeof CUR !== 'undefined' ? CUR : null),
    ci: () => (typeof ci !== 'undefined' ? ci : 0),
    keys: () => (typeof K !== 'undefined' ? K : ['int', 'end', 'str', 'arc', 'wis']),
    quad: (a, b) => cq(a, b),
    center: (a, b) => cc(a, b),
    objs: () => (typeof OBJ !== 'undefined' ? OBJ : []),
    mush: () => (typeof MI !== 'undefined' ? MI : null)
  };

  /* =====================================================================
     1. SOUND  (synth, no files)
     ===================================================================== */
  const SND = (() => {
    let ctx = null, master = null, rev = null, nbuf = null, active = 0, unlocked = false;
    let muted = false;
    try { muted = localStorage.getItem('grove.mute') === '1'; } catch (e) {}
    const N = m => 440 * Math.pow(2, (m - 69) / 12);          /* midi note -> Hz */

    function build() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 18; comp.ratio.value = 5; comp.attack.value = .004; comp.release.value = .18;
      master = ctx.createGain(); master.gain.value = muted ? 0 : .85;
      master.connect(comp); comp.connect(ctx.destination);
      nbuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const len = Math.floor(ctx.sampleRate * 1.5), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const ch = ir.getChannelData(c); for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8); }
      rev = ctx.createConvolver(); rev.buffer = ir;
      const rg = ctx.createGain(); rg.gain.value = .5; rev.connect(rg); rg.connect(master);
      return true;
    }
    function unlock() {
      unlocked = true;
      if (!ctx && !build()) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    }

    const envG = (t, a, h, d, v) => {
      const g = ctx.createGain(), pk = Math.max(.0002, v);
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(pk, t + a);
      if (h > 0) g.gain.setValueAtTime(pk, t + a + h);
      g.gain.exponentialRampToValueAtTime(.0001, t + a + h + d);
      return g;
    };
    /* o: f, to, type, t (delay), a (attack), h (hold), d (decay), v (volume), det, lp, q, pan, wet (reverb send), vib [Hz, depth] */
    function tone(o) {
      const t = ctx.currentTime + (o.t || 0), a = o.a == null ? .004 : o.a, h = o.h || 0, d = o.d == null ? .15 : o.d, v = o.v == null ? .15 : o.v;
      const os = ctx.createOscillator();
      os.type = o.type || 'sine';
      os.frequency.setValueAtTime(o.f, t);
      if (o.to) os.frequency.exponentialRampToValueAtTime(o.to, t + Math.max(.01, o.glide || (a + h + d)));
      if (o.det) os.detune.value = o.det;
      if (o.vib) { const lf = ctx.createOscillator(), lg = ctx.createGain(); lf.frequency.value = o.vib[0]; lg.gain.value = o.vib[1]; lf.connect(lg); lg.connect(os.frequency); lf.start(t); lf.stop(t + a + h + d + .1); }
      const g = envG(t, a, h, d, v);
      let n = os;
      if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.q || .7; n.connect(f); n = f; }
      n.connect(g);
      let out = g;
      if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; g.connect(p); out = p; }
      out.connect(master);
      if (o.wet) { const w = ctx.createGain(); w.gain.value = o.wet; out.connect(w); w.connect(rev); }
      os.start(t); os.stop(t + a + h + d + .08);
      active++; os.onended = () => { active--; };
    }
    /* o: type, f, to, q, t, a, d, v, wet */
    function noise(o) {
      const t = ctx.currentTime + (o.t || 0), a = o.a == null ? .005 : o.a, d = o.d == null ? .1 : o.d, v = o.v == null ? .1 : o.v;
      const s = ctx.createBufferSource(); s.buffer = nbuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass';
      f.frequency.setValueAtTime(o.f || 1000, t);
      if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + a + d);
      f.Q.value = o.q || 1;
      const g = envG(t, a, 0, d, v);
      s.connect(f); f.connect(g); g.connect(master);
      if (o.wet) { const w = ctx.createGain(); w.gain.value = o.wet; g.connect(w); w.connect(rev); }
      s.start(t, Math.random() * 1.5); s.stop(t + a + d + .05);
      active++; s.onended = () => { active--; };
    }

    /* building blocks */
    const bell = (m, t = 0, v = .1, len = .6, wet = .35) => {
      const f = N(m);
      tone({ f, d: len, v, t, wet });
      tone({ f: f * 2.76, d: len * .4, v: v * .25, t, wet });
      tone({ f: f * 5.4, d: len * .15, v: v * .1, t });
    };
    const pl = (m, t = 0, v = .12, d = .18, type = 'triangle', wet = .2) => tone({ f: N(m), type, d, v, t, wet, lp: 3600 });
    const flip = (v = .14, d = .22, t = 0) => {            /* paper rustle */
      noise({ type: 'bandpass', f: 900, to: 4200, q: .8, a: .02, d, v, t });
      noise({ type: 'highpass', f: 5200, a: .01, d: d * .7, v: v * .35, t: t + .04 });
    };
    const whoosh = (v = .12, d = .32) => noise({ type: 'bandpass', f: 260, to: 3200, q: .55, a: .1, d, v, wet: .2 });
    const brass = (m, t, len, v) => [-7, 7].forEach(det => tone({ f: N(m), type: 'sawtooth', lp: 2400, a: .03, h: len, d: .25, v, t, det, wet: .3, vib: [5.5, 3] }));

    const S = {
      hover() { tone({ f: rnd(1500, 1650), to: 1950, d: .035, v: .028 }); },
      click() { const r = rnd(.95, 1.06); tone({ f: 560 * r, to: 250 * r, type: 'triangle', d: .08, v: .17 }); noise({ f: 2600, q: 2, d: .03, v: .06 }); tone({ f: 1120 * r, d: .05, v: .035, t: .004 }); },
      type() { noise({ type: 'bandpass', f: rnd(2200, 3400), q: 3, d: .02, v: .04 }); tone({ f: rnd(300, 380), to: 190, d: .03, v: .028 }); },
      flip() { flip(.13, .2); },
      select() { pl(76, 0, .14, .16); pl(83, .08, .14, .3); bell(88, .1, .05, .5); },
      confirm() { pl(72, 0, .13, .14); pl(76, .07, .13, .14); pl(79, .14, .13, .14); bell(84, .2, .07, .7); flip(.05, .18, .02); },
      back() { tone({ f: 520, to: 330, type: 'triangle', d: .1, v: .13 }); tone({ f: 390, to: 250, type: 'triangle', d: .14, v: .1, t: .07 }); flip(.06, .12); },
      denied() { tone({ f: 150, type: 'square', d: .07, v: .07, lp: 700 }); tone({ f: 112, type: 'square', d: .1, v: .07, lp: 600, t: .09 }); },
      error() { tone({ f: 200, to: 128, type: 'sawtooth', d: .22, v: .1, lp: 900 }); tone({ f: 170, to: 100, type: 'sawtooth', d: .3, v: .09, lp: 700, t: .11 }); noise({ type: 'lowpass', f: 320, d: .12, v: .1 }); },
      pop() { tone({ f: 520, to: 1040, d: .09, v: .11 }); tone({ f: 1560, d: .07, v: .04, t: .05 }); },
      cell() { tone({ f: rnd(640, 700), to: 900, type: 'triangle', d: .07, v: .11 }); noise({ f: 3000, q: 2, d: .02, v: .04 }); },
      whoosh() { whoosh(.12, .34); },
      card() { whoosh(.09, .22); pl(79, .05, .12, .2); pl(86, .12, .1, .3); },
      step(i) { noise({ type: 'lowpass', f: 760, q: .7, d: .06, v: .12 }); noise({ type: 'highpass', f: 3800, a: .012, d: .07, v: .035 }); tone({ f: (i & 1) ? 138 : 164, to: 68, d: .075, v: .11 }); },
      arrive() { bell(88, 0, .07, .7, .45); pl(81, .02, .08, .2); },
      cmd() { tone({ f: 392, to: 660, type: 'triangle', d: .12, v: .12 }); tone({ f: 990, d: .1, v: .05, t: .06 }); },
      undo() { tone({ f: 720, to: 340, type: 'triangle', d: .13, v: .12 }); tone({ f: 540, to: 260, type: 'triangle', d: .14, v: .1, t: .07 }); whoosh(.05, .2); },
      statUp() { [72, 76, 79, 84, 88].forEach((m, i) => pl(m, i * .055, .12, .2, 'triangle', .3)); bell(91, .3, .06, .8); noise({ type: 'highpass', f: 6000, a: .1, d: .3, v: .03, t: .15 }); },
      ping(k) { tone({ f: N(81 + (k % 5) * 2), d: .09, v: .07, wet: .2 }); },
      levelUp() {
        noise({ type: 'bandpass', f: 300, to: 5200, q: .7, a: .45, d: .1, v: .1 });
        brass(67, .35, .1, .06); brass(72, .5, .1, .06); brass(76, .65, .1, .06);
        [72, 76, 79, 84].forEach(m => brass(m, .82, .55, .05));
        tone({ f: N(48), type: 'triangle', h: .5, d: .5, v: .13, t: .82, wet: .3 });
        for (let i = 0; i < 10; i++) bell(pick([84, 86, 88, 91, 93, 96]), .9 + i * .08, .045, .5, .5);
      },
      save() {
        flip(.07, .15);
        [60, 64, 67, 72, 76, 79].forEach((m, i) => pl(m, .03 + i * .065, .13, .22, 'triangle', .3));
        bell(84, .45, .09, 1.0, .5); bell(88, .52, .07, 1.1, .5);
        tone({ f: N(48), type: 'triangle', d: .6, v: .12, t: .45 });
        noise({ type: 'highpass', f: 5500, a: .05, d: .5, v: .04, t: .45 });
      },
      bookOpen() { flip(.16, .3); flip(.1, .22, .18); [48, 55, 60].forEach(m => tone({ f: N(m), a: .18, d: .9, v: .05, wet: .5, t: .1 })); bell(84, .3, .06, .8, .5); bell(91, .42, .05, .8, .5); tone({ f: 90, to: 50, d: .15, v: .14, t: .02 }); },
      bookClose() { flip(.12, .2); tone({ f: 120, to: 55, d: .2, v: .18, t: .12 }); noise({ type: 'lowpass', f: 400, d: .12, v: .14, t: .12 }); },
      calOpen() { flip(.1, .22); bell(88, .1, .05, .5); },
      bell() { bell(76, 0, .13, 1.1, .5); bell(83, .28, .12, 1.3, .5); },
      trophy() { [79, 84, 88, 91].forEach((m, i) => bell(m, i * .09, .09, 1.0, .5)); noise({ type: 'highpass', f: 5500, a: .05, d: .6, v: .045, t: .1 }); pl(67, 0, .1, .5); },
      enter() { whoosh(.1, .5); [60, 64, 67, 72].forEach((m, i) => pl(m, .05 + i * .08, .12, .4, 'triangle', .4)); bell(84, .4, .08, 1.2, .5); },
      titleStart() {                                   /* the start screen: boom, rush of wind, rising chord, sparkles */
        tone({ f: 70, to: 38, type: 'sine', d: .9, v: .34 }); noise({ type: 'lowpass', f: 220, d: .5, v: .2 });
        whoosh(.15, .75); flip(.08, .3, .05);
        [48, 55, 60, 64, 67, 72].forEach((m, i) => tone({ f: N(m), type: 'triangle', a: .06, d: 1.3, v: .07, t: .08 + i * .06, wet: .5 }));
        for (let i = 0; i < 9; i++) bell(pick([84, 88, 91, 93, 96]), .3 + i * .09, .05, .8, .5);
      },
      logout() { [72, 67, 64, 60].forEach((m, i) => pl(m, i * .09, .12, .3, 'triangle', .3)); }
    };
    const LOW = { hover: 1, type: 1, step: 1, ping: 1 };

    function play(name, a) {
      if (muted || !unlocked || !S[name]) return;
      if (!ctx && !build()) return;
      if (ctx.state !== 'running') { ctx.resume && ctx.resume().catch(() => {}); return; }
      if (active > 48 && LOW[name]) return;
      safe(() => S[name](a));
    }

    /* "Analysing..." while the journal is being scored: soft magical bubbling */
    let anaT = null, anaI = 0;
    function analyse(on) {
      if (on && !anaT) {
        anaI = 0;
        anaT = setInterval(() => {
          if (muted || !unlocked || !ctx || ctx.state !== 'running') return;
          safe(() => {
            bell(pick([72, 74, 76, 79, 81, 84, 86]), 0, .035, .35, .5);
            if (anaI % 4 === 0) tone({ f: N(48), d: .3, v: .05, wet: .3 });
            anaI++;
          });
        }, 170);
      } else if (!on && anaT) { clearInterval(anaT); anaT = null; }
    }

    function setMuted(m) {
      muted = !!m;
      try { localStorage.setItem('grove.mute', muted ? '1' : '0'); } catch (e) {}
      if (master) master.gain.setTargetAtTime(muted ? 0 : .85, ctx.currentTime, .03);
      if (muted) analyse(false);
      else { unlock(); play('pop'); }
      paintSound();
    }
    return { play, unlock, analyse, setMuted, isMuted: () => muted };
  })();

  /* first user gesture unlocks audio (browsers require it) */
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, () => SND.unlock(), { capture: true, passive: true }));

  /* =====================================================================
     2. PARTICLES  (canvas over the stage + a second one on the login screen)
     ===================================================================== */
  const fxc = document.createElement('canvas');
  fxc.id = 'fxc'; fxc.width = 2944; fxc.height = 1664;
  stage.appendChild(fxc);
  const g = fxc.getContext('2d');

  const parts = [], partsA = [];
  const addP = (o, list) => { list = list || parts; if (list.length < 700) list.push(Object.assign({ life: 0, max: 1, x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 0, rot: 0, vr: 0 }, o)); };
  const CONF = ['#6fbf5a', '#f2c94c', '#e0604c', '#f7edd6', '#5aa6d6', '#c690e0', '#ff9f5a'];

  function glow(c, x, y, r, rgb, a) {
    const gr = c.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
  }
  function star4(c, x, y, r, rot) {
    c.beginPath();
    for (let i = 0; i < 8; i++) { const a = rot + i * Math.PI / 4, rr = i % 2 ? r * .32 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath(); c.fill();
  }
  function drawParts(c, list, dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life += dt;
      if (p.life >= p.max) { list.splice(i, 1); continue; }
      const k = p.life / p.max;
      p.vx -= p.vx * p.drag * dt; p.vy += p.g * dt - p.vy * p.drag * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      c.globalAlpha = 1;
      switch (p.k) {
        case 'dust':
          c.globalAlpha = (1 - k) * .55; c.fillStyle = '#e3dcb4';
          c.beginPath(); c.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * k, 0, 6.2832); c.fill(); break;
        case 'spark':
          c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - k * k; c.fillStyle = p.col;
          star4(c, p.x, p.y, p.r * (1 - k * .6) * (.75 + .25 * Math.sin(p.life * 40)), p.rot);
          c.globalCompositeOperation = 'source-over'; break;
        case 'conf':
          c.globalAlpha = k > .75 ? (1 - k) * 4 : 1;
          c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.scale(1, Math.abs(Math.sin(p.life * p.fl)) * .9 + .1);
          c.fillStyle = p.col; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); c.restore(); break;
        case 'spore':
          p.x += Math.sin(p.life * 3 + p.rot) * .3;
          c.globalCompositeOperation = 'lighter'; glow(c, p.x, p.y, p.r * 3.2, '255,170,150', (1 - k) * .65);
          c.globalCompositeOperation = 'source-over'; break;
        case 'ring': {
          const r = p.r0 + (p.r1 - p.r0) * easeOut(k);
          c.globalAlpha = 1 - k; c.strokeStyle = p.col; c.lineWidth = p.lw * (1 - k) + 1;
          c.beginPath(); c.ellipse(p.x, p.y, r, r * .5, 0, 0, 6.2832); c.stroke(); break;
        }
        case 'tile': {
          const s = p.s0 + (p.s1 - p.s0) * easeOut(k), q = p.q;
          const mx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, my = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
          c.globalAlpha = (1 - k) * .9; c.beginPath();
          q.forEach((pt, j) => { const x = mx + (pt[0] - mx) * s, y = my + (pt[1] - my) * s; j ? c.lineTo(x, y) : c.moveTo(x, y); });
          c.closePath(); c.fillStyle = 'rgba(255,246,200,' + (.28 * (1 - k)) + ')'; c.fill();
          c.lineWidth = 3; c.strokeStyle = p.col; c.stroke(); break;
        }
        case 'sweep': {
          const x = p.x0 + (p.x1 - p.x0) * easeOut(k), a0 = Math.max(p.x0, x - 44), a1 = Math.min(p.x1, x + 44);
          if (a1 > a0) {
            const gr = c.createLinearGradient(x - 44, 0, x + 44, 0);
            gr.addColorStop(0, 'rgba(255,240,170,0)'); gr.addColorStop(.5, 'rgba(255,240,170,.8)'); gr.addColorStop(1, 'rgba(255,240,170,0)');
            c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - k * .6; c.fillStyle = gr;
            c.fillRect(a0, p.y, a1 - a0, p.h); c.globalCompositeOperation = 'source-over';
          }
          break;
        }
      }
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }

  function sparkBurst(x, y, n, pw, cols, list) {
    cols = cols || ['#fff3b0', '#ffe08a', '#bff5a0', '#ffffff'];
    for (let i = 0; i < n; i++) {
      const a = rnd(0, 6.283), s = rnd(pw * .3, pw);
      addP({ k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, g: 260, drag: 1.4, max: rnd(.5, 1), r: rnd(5, 11), col: pick(cols), rot: rnd(0, 6), vr: rnd(-6, 6) }, list);
    }
  }
  function confetti(x, y, n, spread, up, w, dir) {
    for (let i = 0; i < n; i++)
      addP({ k: 'conf', x: x + rnd(-w, w), y, vx: rnd(-spread, spread) + (dir || 0), vy: -rnd(up * .4, up), g: 380, drag: 1.1, max: rnd(1.6, 2.8), w: rnd(6, 11), h: rnd(10, 16), col: pick(CONF), rot: rnd(0, 6), vr: rnd(-9, 9), fl: rnd(6, 14) });
  }
  function confettiRain(n) {
    for (let i = 0; i < n; i++)
      addP({ k: 'conf', x: rnd(0, 1472), y: rnd(-120, -10), vx: rnd(-40, 40), vy: rnd(60, 170), g: 140, drag: .6, max: rnd(2.6, 3.8), w: rnd(6, 11), h: rnd(10, 16), col: pick(CONF), rot: rnd(0, 6), vr: rnd(-8, 8), fl: rnd(5, 12) });
  }

  /* ambient life: fireflies and falling leaves */
  const mkFlies = (n, x0, x1, y0, y1) => Array.from({ length: n }, () => ({ bx: rnd(x0, x1), by: rnd(y0, y1), ax: rnd(18, 70), ay: rnd(10, 36), sx: rnd(.12, .4), sy: rnd(.18, .5), ph: rnd(0, 6.28), bl: rnd(.5, 1.4), r: rnd(1.3, 2.6) }));
  function drawFlies(c, list, t, a0) {
    c.globalCompositeOperation = 'lighter';
    for (const f of list) {
      const x = f.bx + Math.sin(t * f.sx + f.ph) * f.ax + Math.sin(t * .11 + f.ph * 2) * 18;
      const y = f.by + Math.cos(t * f.sy + f.ph * 1.3) * f.ay;
      const a = (.15 + .85 * Math.pow(.5 + .5 * Math.sin(t * f.bl * 2 + f.ph), 3)) * a0;
      glow(c, x, y, f.r * 7, '230,240,140', a * .55);
      glow(c, x, y, f.r * 2.2, '255,250,200', a);
    }
    c.globalCompositeOperation = 'source-over';
  }
  const LEAF = ['#7fb04c', '#c9a24a', '#d2704a', '#9bc45e'];
  const mkLeaves = (n, x0, x1, y0, y1) => Array.from({ length: n }, () => ({ x: rnd(x0, x1), y: rnd(y0, y1), vx: rnd(-8, 14), vy: rnd(22, 46), rot: rnd(0, 6), vr: rnd(-1.5, 1.5), sw: rnd(.8, 1.8), ph: rnd(0, 6), col: pick(LEAF), s: rnd(4, 7) }));
  function drawLeaves(c, list, dt, t, x0, x1, y0, y1) {
    for (const l of list) {
      l.y += l.vy * dt; l.x += l.vx * dt + Math.sin(t * l.sw + l.ph) * 20 * dt; l.rot += l.vr * dt;
      if (l.y > y1) { l.y = y0 - 10; l.x = rnd(x0, x1); }
      if (l.x > x1 + 20) l.x = x0 - 10; else if (l.x < x0 - 30) l.x = x1 + 10;
      c.save(); c.translate(l.x, l.y); c.rotate(l.rot); c.scale(1, .55 + .45 * Math.abs(Math.sin(t * l.sw * 1.7 + l.ph)));
      c.globalAlpha = .85; c.fillStyle = l.col; c.beginPath(); c.ellipse(0, 0, l.s, l.s * .5, 0, 0, 6.2832); c.fill(); c.restore();
    }
    c.globalAlpha = 1;
  }
  const fliesS = mkFlies(24, 280, 1120, 150, 720), leavesS = mkLeaves(8, 320, 1080, -20, 740);

  /* login screen canvas (viewport pixels, sits behind the panels) */
  const auth = $('#auth');
  const fxa = document.createElement('canvas'); fxa.id = 'fxa';
  if (auth) auth.insertBefore(fxa, auth.firstChild);
  const ga = fxa.getContext('2d');
  let AW = 0, AH = 0, fliesA = [], leavesA = [], authOn = false;
  function resizeA() {
    const d = Math.min(2, window.devicePixelRatio || 1);
    AW = innerWidth; AH = innerHeight; fxa.width = AW * d; fxa.height = AH * d; ga.setTransform(d, 0, 0, d, 0, 0);
    fliesA = mkFlies(Math.round(AW * AH / 22000) + 14, 0, AW, 0, AH); leavesA = mkLeaves(14, 0, AW, -20, AH);
  }
  addEventListener('resize', () => { if (authOn) resizeA(); });

  /* =====================================================================
     3. DOM EFFECTS (floating numbers, banners, shake, flash)
     ===================================================================== */
  const mk = (tag, id) => { const e = document.createElement(tag); if (id) e.id = id; stage.appendChild(e); return e; };
  const flashEl = mk('div', 'fxflash'), lvEl = mk('div', 'fxlv'), svEl = mk('div', 'fxsv');

  function retrig(el, cls, ms) {
    if (!el) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ms || 800);
  }
  function floatText(txt, x, y, cls, delay) {
    const e = document.createElement('div');
    e.className = 'fx-float' + (cls ? ' ' + cls : ''); e.textContent = txt;
    e.style.left = x + 'px'; e.style.top = y + 'px';
    if (delay) e.style.animationDelay = delay + 'ms';
    e.addEventListener('animationend', () => e.remove());
    stage.appendChild(e);
  }
  function flash() { retrig(flashEl, 'on', 600); }
  function shakeEl(el, px, ms, axisX) {
    if (RM || !el.animate) return;
    const f = [0, -1, .85, -.7, .55, -.35, .2, 0].map(m => ({ translate: axisX ? (m * px) + 'px 0' : (m * px) + 'px ' + (m * px * -.5) + 'px' }));
    el.animate(f, { duration: ms, easing: 'linear' });
  }
  const shake = big => shakeEl(stage, big ? 9 : 4, big ? 560 : 300);

  function levelFX(cu) {
    SND.play('levelUp'); flash(); shake(true);
    lvEl.innerHTML = '<div class="rays"></div><div class="t1">LEVEL UP!</div><div class="t2"></div>';
    lvEl.querySelector('.t2').textContent = 'Lv. ' + cu.lv + '  \u2022  ' + cu.t;
    retrig(lvEl, 'on', 3100);
    const pz = G.pos();
    confetti(300, 780, 50, 140, 760, 60, 150); confetti(1170, 780, 50, 140, 760, 60, -150);
    setTimeout(() => confettiRain(70), 500);
    sparkBurst(736, 360, 40, 420);
    if (pz) addP({ k: 'ring', x: pz[0] - 6, y: pz[1] + 8, max: 1.1, r0: 10, r1: 520, lw: 8, col: 'rgba(255,226,140,.95)' });
  }

  let questAt = 0;
  const ST = ['int', 'str', 'end', 'arc', 'wis'], IY = [291, 323, 355, 388, 420], LBL = { int: 'INT', str: 'STR', end: 'END', arc: 'ARC', wis: 'WIS' };
  function questFX(j) {
    questAt = performance.now();
    SND.play('save'); shake(false);
    const pts = j && j.totalPoints;
    svEl.innerHTML = '';
    const a = document.createElement('div'); a.textContent = 'Quest Logged!'; svEl.appendChild(a);
    if (pts > 0) { const s = document.createElement('small'); s.textContent = '+' + pts + ' points earned'; svEl.appendChild(s); }
    retrig(svEl, 'on', 2900);
    confetti(300, 790, 36, 120, 720, 50, 140); confetti(1170, 790, 36, 120, 720, 50, -140);
    const pp = (j && j.points) || {};
    ST.forEach((k, i) => {
      if (pp[k] > 0) {
        floatText('+' + pp[k] + ' ' + LBL[k], 1075, IY[i] + 24, 'g', 300 + i * 150);
        setTimeout(() => sparkBurst(1158, IY[i] + 24, 9, 150), 300 + i * 150);
      }
    });
  }

  /* =====================================================================
     4. STATS PANEL: count-up, bump, level up
     ===================================================================== */
  const lastV = {}, lastLv = {};
  const schedule = fn => { const w = 900 - (performance.now() - questAt); w > 0 ? setTimeout(fn, w) : fn(); };

  function countUp(el, from, to, snd) {
    if (RM) return;
    el.dataset.fxw = '1';
    const dur = Math.min(900, 280 + (to - from) * 70), t0 = performance.now(); let shown = from, ticks = 0;
    el.textContent = '+' + from;
    (function stepAnim(now) {
      const k = Math.min(1, (now - t0) / dur), v = Math.round(from + (to - from) * easeOut(k));
      if (v !== shown) { shown = v; el.textContent = '+' + v; if (snd && ticks++ < 9) SND.play('ping', ticks); }
      if (k < 1) requestAnimationFrame(stepAnim);
      else { el.textContent = '+' + to; setTimeout(() => { delete el.dataset.fxw; }, 0); }
    })(t0);
  }
  function statFX(k, d) {
    const i = G.keys().indexOf(k); if (i < 0) return;
    const y = 70 + 25 * i + 10;
    schedule(() => {
      SND.play('statUp');
      sparkBurst(173, y, 10, 150);
      addP({ k: 'sweep', x0: 160, x1: 376, y: y - 11, h: 22, max: .6 });
      floatText('+' + d, 352, y - 8, 'g');
      retrig($('#v' + k), 'fx-bump'); retrig($$('.em')[i], 'fx-bounce');
    });
  }
  function onStat(el) {
    if (el.dataset.fxw) return;
    const k = el.id.slice(1), val = parseInt((el.textContent || '').replace(/\D/g, ''), 10) || 0;
    const me = G.me(), pid = (me && me.id) || '?', rec = lastV[pid] || (lastV[pid] = {}), prev = rec[k];
    rec[k] = val;
    if (prev === undefined) { if (val > 0) countUp(el, 0, val, false); return; }
    if (val > prev) { countUp(el, prev, val, true); statFX(k, val - prev); }
    else if (val < prev) retrig(el, 'fx-drop', 600);
  }
  {
    const mo = new MutationObserver(ms => {
      const seen = new Set();
      ms.forEach(m => { const n = m.target.nodeType === 1 ? m.target : m.target.parentElement, v = n && n.closest && n.closest('.vl'); if (v) seen.add(v); });
      seen.forEach(onStat);
    });
    $$('.vl').forEach(e => mo.observe(e, { childList: true, characterData: true, subtree: true }));
  }
  function lvlWatch() {
    const me = G.me(); if (!me || !me.id) return;
    const r = lastLv[me.id];
    lastLv[me.id] = me.lv;
    if (r !== undefined && me.lv > r) {          /* wait for the "Quest Logged" ribbon to finish first */
      const w = 1700 - (performance.now() - questAt);
      if (w > 0) setTimeout(() => levelFX(me), w); else levelFX(me);
    }
  }

  /* portrait pops whenever a different character is shown */
  const face = $('#face');
  if (face) {
    face.classList.add('fx-face');
    new MutationObserver(() => retrig(face, 'pop', 900)).observe(face, { attributes: true, attributeFilter: ['src'] });
  }

  /* =====================================================================
     5. MAP: footsteps, tile ripples, destination marker, Mira's glow, spores
     ===================================================================== */
  let lastPh = -1, lastCur = '', lastDest = '', lastHov = '', mark = null, sporeAcc = 0;
  const jOpen = () => { const e = $('#jp'); return !!e && e.style.display === 'block'; };

  function footstep(pz, ph) {
    SND.play('step', ph);
    for (let i = 0; i < 2; i++) addP({ k: 'dust', x: pz[0] - 6 + rnd(-6, 6), y: pz[1] + 10, vx: rnd(-22, 22), vy: rnd(-16, -4), max: .5, r0: 3, r1: 10 });
    if (Math.random() < .5) addP({ k: 'spark', x: pz[0] - 6 + rnd(-8, 8), y: pz[1] + 6, vx: rnd(-18, 18), vy: rnd(-40, -20), g: 30, max: .7, r: rnd(3, 5), col: '#cdf59a', rot: rnd(0, 6), vr: 4 });
  }
  function tileRipple(t, col) { try { addP({ k: 'tile', q: G.quad(t[0], t[1]), max: .65, s0: .5, s1: 1.12, col: col || 'rgba(255,255,255,.95)' }); } catch (e) {} }
  function cmdFX(dst) {
    SND.play('cmd'); tileRipple(dst); mark = { dst };
  }
  function arriveFX(c) {
    SND.play('arrive'); tileRipple(c, 'rgba(255,236,150,.95)');
    const p = G.center(c[0], c[1]); sparkBurst(p[0], p[1], 12, 170);
    for (let i = 0; i < 5; i++) addP({ k: 'dust', x: p[0] + rnd(-10, 10), y: p[1] + 6, vx: rnd(-40, 40), vy: rnd(-20, -6), max: .55, r0: 4, r1: 12 });
  }
  function mapWatch(t) {
    const pz = G.pos(); if (!pz) return;
    const P_ = G.path(), moving = P_.length > 0;
    if (moving) { const ph = Math.floor(t * 14 / Math.PI); if (ph !== lastPh) { lastPh = ph; footstep(pz, ph); } } else lastPh = -1;
    const dest = moving ? P_[P_.length - 1] + '' : '';
    if (dest && dest !== lastDest) cmdFX(P_[P_.length - 1]);
    lastDest = dest;
    const c = G.cur(), cs = c + '';
    if (cs !== lastCur) { if (lastCur && !moving && c) arriveFX(c); lastCur = cs; }
    const h = G.hov(), hs = h ? h + '' : '';
    if (hs !== lastHov) { lastHov = hs; if (hs) SND.play('hover'); }
    if (moving && Math.random() < .35) addP({ k: 'spark', x: pz[0] - 6 + rnd(-10, 10), y: pz[1] + rnd(-30, 8), vx: rnd(-12, 12), vy: rnd(-34, -12), g: 20, max: .8, r: rnd(3, 6), col: '#ffe9a0', rot: rnd(0, 6), vr: 5 });
  }
  function drawMarker(t) {
    if (!mark || !G.path().length) { mark = null; return; }
    const q = G.quad(mark.dst[0], mark.dst[1]), c = G.center(mark.dst[0], mark.dst[1]);
    const k = (t * 1.5) % 1, s = .55 + .5 * k;
    g.globalAlpha = (1 - k) * .85; g.beginPath();
    q.forEach((pt, j) => { const x = c[0] + (pt[0] - c[0]) * s, y = c[1] + (pt[1] - c[1]) * s; j ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.closePath(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke(); g.globalAlpha = 1;
    const b = Math.abs(Math.sin(t * 5)) * 8, x = c[0], y = c[1] - 40 - b;
    g.beginPath(); g.moveTo(x - 11, y - 12); g.lineTo(x + 11, y - 12); g.lineTo(x, y + 4); g.closePath();
    g.fillStyle = '#ffe49a'; g.fill(); g.lineWidth = 2.5; g.lineJoin = 'round'; g.strokeStyle = '#3a2a10'; g.stroke();
  }
  function drawAura(t) {
    const pz = G.pos(); if (!pz) return;
    const x = pz[0] - 6, y = pz[1] + 6, mv = G.path().length > 0, pu = .5 + .5 * Math.sin(t * 2.4);
    g.save(); g.translate(x, y); g.scale(1, .5);
    g.beginPath(); g.arc(0, 0, 34 + pu * 3, .1, Math.PI - .1); g.strokeStyle = 'rgba(190,255,160,' + (.3 + .25 * pu) + ')'; g.lineWidth = 3; g.stroke();
    g.beginPath(); g.arc(0, 0, 22 + pu * 2, .1, Math.PI - .1); g.strokeStyle = 'rgba(255,236,160,' + (.22 + .2 * pu) + ')'; g.lineWidth = 2; g.stroke();
    g.restore();
    if (!mv) {
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const a = t * 1.1 + i * 1.5708, mx = x + Math.cos(a) * 40, my = y - 52 + Math.sin(a * 1.3) * 46 + Math.sin(a) * 8;
        glow(g, mx, my, 9, '255,240,170', .55 + .35 * Math.sin(t * 3 + i)); glow(g, mx, my, 2.4, '255,255,235', .95);
      }
      g.globalCompositeOperation = 'source-over';
    }
  }
  function spores(dt) {
    sporeAcc += dt; if (sporeAcc < .28) return; sporeAcc = 0;
    const mi = G.mush();
    G.objs().forEach(o => { if (o.i === mi && Math.random() < .7) addP({ k: 'spore', x: o.x + o.w * .5 + rnd(-16, 16), y: o.y + 14, vx: rnd(-6, 6), vy: rnd(-26, -14), max: rnd(1.6, 2.6), r: rnd(1.2, 2.2), rot: rnd(0, 6) }); });
  }

  /* =====================================================================
     6. FRAME LOOP
     ===================================================================== */
  let lastMs = 0;
  function loop(ms) {
    requestAnimationFrame(loop);
    const dt = Math.min(.05, Math.max(0, (ms - lastMs) / 1000)) || .016; lastMs = ms;
    if (document.hidden) return;
    const t = ms / 1000;
    safe(() => {
      if (authOn) {
        ga.clearRect(0, 0, AW, AH);
        drawFlies(ga, fliesA, t, .95); drawLeaves(ga, leavesA, dt, t, 0, AW, 0, AH); drawParts(ga, partsA, dt);
      } else {
        mapWatch(t); lvlWatch();
        g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, 1472, 832); g.globalAlpha = 1;
        if (!RM && !jOpen()) { drawFlies(g, fliesS, t, .8); drawLeaves(g, leavesS, dt, t, 320, 1080, -20, 740); spores(dt); drawAura(t); drawMarker(t); }
        drawParts(g, parts, dt);
      }
    });
  }

  /* =====================================================================
     7. BUTTONS: hover lift / press squash on the art, hover + click sounds
     ===================================================================== */
  const boxOf = e => { const cs = getComputedStyle(e), x = parseFloat(cs.left), y = parseFloat(cs.top), w = parseFloat(cs.width), h = parseFloat(cs.height); return [x, y, w, h].some(isNaN) ? null : { x, y, w, h }; };
  const hotCache = new WeakMap();
  function visualsOf(hb) {
    let v = hotCache.get(hb); if (v) return v;
    const r = boxOf(hb); v = [];
    if (r) $$('#stage > img.ui, #stage > #fsi').forEach(e => {
      const q = boxOf(e);
      if (q && q.w <= r.w + 2 && q.h <= r.h + 2 && q.x >= r.x - 2 && q.y >= r.y - 2 && q.x + q.w <= r.x + r.w + 2 && q.y + q.h <= r.y + r.h + 2) v.push(e);
    });
    hotCache.set(hb, v); return v;
  }
  let hotHB = null;
  const setHot = (hb, on) => { if (hb) visualsOf(hb).forEach(v => v.classList.toggle('fx-hot', on)); };
  stage.addEventListener('pointerover', e => {
    const hb = e.target.closest && e.target.closest('.hb');
    if (hb === hotHB) return;
    setHot(hotHB, false); hotHB = hb; setHot(hb, true);
  });
  stage.addEventListener('pointerleave', () => { setHot(hotHB, false); hotHB = null; });
  stage.addEventListener('pointerdown', e => { const hb = e.target.closest && e.target.closest('.hb'); if (hb) visualsOf(hb).forEach(v => v.classList.add('fx-press')); });
  addEventListener('pointerup', () => $$('.fx-press').forEach(v => v.classList.remove('fx-press')), true);
  addEventListener('pointercancel', () => $$('.fx-press').forEach(v => v.classList.remove('fx-press')), true);

  /* idle breathing on the dock icons and the player-card icons; the selected card's frame glows */
  safe(() => {
    $$('#stage .hb').forEach(hb => {
      const lab = hb.getAttribute('aria-label') || '';
      const isDock = /^(Journal|Reminders|Achievements)$/.test(lab), isCard = /^Player \d$/.test(lab);
      if (!isDock && !isCard) return;
      visualsOf(hb).forEach((v, i) => {
        const b = boxOf(v);
        if (b && b.w < 70 && b.h < 70 && v.id !== 'fsi') { v.classList.add('fx-breathe'); v.style.setProperty('--bd', (-(i + Math.random() * 3)).toFixed(2) + 's'); }
      });
    });
    const sel = [...stage.children].find(e => e.tagName === 'DIV' && e.style.width === '121px' && e.style.height === '69px');
    if (sel) sel.classList.add('fx-sel');
  });

  const HOVER_SEL = '.hb,.jnav:not(:disabled),#jcal .cc:not(.fut):not(.out),.ach:not(.tk),.aac,#auth button:not(:disabled),#asw,.jh,#eb,#fxsnd,#fxsnda';
  let lastHoverEl = null, lastHoverT = 0;
  document.addEventListener('mouseover', e => {
    const t = e.target.closest && e.target.closest(HOVER_SEL);
    if (t === lastHoverEl) return;
    lastHoverEl = t;
    if (!t) return;
    const n = performance.now(); if (n - lastHoverT < 50) return; lastHoverT = n;
    SND.play('hover');
  });

  /* grid of the calendar: the cells pop in only when the calendar opens / changes month */
  let gridArm = 0, gridT0 = 0;
  const armGrid = () => { gridArm = performance.now() + 1600; gridT0 = 0; };

  /* click sounds + sparkle */
  let closing = false;
  function closeBook(e) {
    const jb = $('#jback');
    if (closing) { e.stopImmediatePropagation(); e.preventDefault(); return; }
    if (jb.dataset.fxgo) { delete jb.dataset.fxgo; return; }          /* second pass: the real handler closes the book */
    if (RM) { SND.play('bookClose'); return; }
    e.stopImmediatePropagation(); e.preventDefault();
    closing = true; SND.play('bookClose');
    const jp = $('#jp'); jp.classList.remove('fx-opening'); jp.classList.add('fx-closing');
    setTimeout(() => { jp.classList.remove('fx-closing'); jb.dataset.fxgo = '1'; closing = false; jb.click(); }, 230);
  }
  function stagePt(e) {
    const r = stage.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 1472, y = (e.clientY - r.top) / r.height * 832;
    return (x >= 0 && x <= 1472 && y >= 0 && y <= 832) ? [x, y] : null;
  }
  function clickSpark(e) {
    if (!e.isTrusted || e.detail === 0 || RM) return;
    if (authOn) { addP({ k: 'ring', x: e.clientX, y: e.clientY, max: .4, r0: 2, r1: 28, lw: 3, col: 'rgba(255,246,200,.9)' }, partsA); sparkBurst(e.clientX, e.clientY, 6, 120, null, partsA); return; }
    const p = stagePt(e); if (!p) return;
    addP({ k: 'ring', x: p[0], y: p[1], max: .38, r0: 2, r1: 26, lw: 3, col: 'rgba(255,246,200,.9)' });
    sparkBurst(p[0], p[1], 5, 110);
  }
  addEventListener('click', e => safe(() => {
    const t = e.target; if (!t || !t.closest) return;
    const c = s => t.closest(s);
    clickSpark(e);
    if (c('#fxsnd,#fxsnda') || c('.hb')) return;               /* those have their own sounds */
    if (c('#jback')) return closeBook(e);
    if (c('#jsave')) { if ($('#jsave').style.cursor === 'pointer') SND.play('click'); return; }
    if (c('#jprev,#jnext')) { if (!c('button').disabled) SND.play('flip'); return; }
    if (c('#jcalb')) { const open = getComputedStyle($('#jcal')).display !== 'none'; SND.play(open ? 'back' : 'calOpen'); if (!open) armGrid(); return; }
    if (c('#jcx')) return SND.play('back');
    if (c('#jcp') || c('#jcn')) { if (!c('button').disabled) { SND.play('flip'); armGrid(); } return; }
    if (c('#jcal .cc')) { const x = c('#jcal .cc'); if (!x.classList.contains('fut') && !x.classList.contains('out')) SND.play('cell'); return; }
    if (c('#jco')) return SND.play('confirm');
    if (c('#asw')) return SND.play('flip');
    if (c('.ach')) return SND.play(c('.ach').classList.contains('tk') ? 'denied' : 'select');
    if (c('.aac')) return SND.play('select');
    if (c('#auth button')) { if (!c('button').disabled) SND.play('click'); return; }
    if (c('#imgpg,#tabpg')) return SND.play('back');
    if (c('.jnav')) return SND.play('click');
  }), true);

  /* typing ticks + shortcuts */
  let lastKeyT = 0;
  addEventListener('keydown', e => safe(() => {
    const t = e.target, typing = t && t.matches && t.matches('input,textarea');
    if (typing && t.matches('#jta,#an,#ae,#apw,#jdate') && !e.ctrlKey && !e.metaKey && (e.key.length === 1 || e.key === 'Backspace')) {
      const n = performance.now(); if (n - lastKeyT > 40) { lastKeyT = n; SND.play('type'); }
    } else if (!typing && (e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      SND.setMuted(!SND.isMuted());
    } else if (e.key === 'Escape') {
      const vis = s => { const x = $(s); return x && getComputedStyle(x).display !== 'none'; };
      if (vis('#imgpg') || vis('#tabpg')) SND.play('back');
    }
  }), true);

  /* =====================================================================
     8. WRAP THE PAGE'S OWN FUNCTIONS (they are looked up by name at call time)
     ===================================================================== */
  safe(() => {
    const ak = window.act;
    if (ak) window.act = function (k) {
      safe(() => {
        if (k === 'r') SND.play('bell');
        else if (k === 'a') SND.play('trophy');
        else if (k === 'u') SND.play(G.hist().length ? 'undo' : 'denied');
        else if (k === 'e') SND.play('whoosh');
      });
      return ak.apply(this, arguments);
    };
  });
  safe(() => {
    const pk = window.pick;
    if (pk) window.pick = async function (i) {
      const before = G.ci(), r = await pk.apply(this, arguments);
      safe(() => {
        if (i !== before) {
          if (G.ci() === i) {
            SND.play('card');
            addP({ k: 'sweep', x0: 160, x1: 376, y: 60, h: 130, max: .7 });
          } else SND.play('denied');
        } else SND.play('cell');
      });
      return r;
    };
  });
  safe(() => {
    const oj = window.openJ;
    if (oj) window.openJ = function () {
      const r = oj.apply(this, arguments);
      safe(() => {
        const jp = $('#jp');
        $$('#jp img.jx').forEach((e, i) => e.style.setProperty('--k', (i * 70) + 'ms'));
        jp.classList.remove('fx-opening', 'fx-closing'); void jp.offsetWidth; jp.classList.add('fx-opening');
        setTimeout(() => jp.classList.remove('fx-opening'), 1200);
        SND.play('bookOpen'); sparkBurst(736, 430, 14, 260);
      });
      return r;
    };
  });
  safe(() => {
    const gt = window.groveToast;
    if (gt) window.groveToast = function (m) {
      const r = gt.apply(this, arguments);
      safe(() => { const t = $('#toast'); if (t) { t.style.animation = 'none'; void t.offsetWidth; t.style.animation = ''; } SND.play(/saved/i.test(m) ? 'pop' : 'error'); });
      return r;
    };
  });
  safe(() => {
    const lo = window.GroveLogout; let going = false;
    if (lo) window.GroveLogout = function () {
      if (going) return; going = true;
      SND.play('logout'); stage.classList.add('fx-out');
      try { sessionStorage.setItem('grove.skipTitle', '1'); } catch (e) {}      /* the reload goes straight to the login menu */
      const args = arguments, self = this;
      setTimeout(() => lo.apply(self, args), 450);
    };
  });
  safe(() => {
    if (window.GJ && window.GJ.add) {
      const add = window.GJ.add;
      window.GJ.add = function (j) { const r = add.apply(this, arguments); safe(() => questFX(j)); return r; };
    }
  });

  /* =====================================================================
     9. OBSERVERS on the journal / calendar / login screens
     ===================================================================== */
  /* activity-log rows slide in one after another (re-built rows carry on from where the first ones were, no restart) */
  safe(() => {
    const jl = $('#jlist'); if (!jl) return; let t0 = 0;
    new MutationObserver(() => {
      const rs = $$('#jlist .jr'); if (!rs.length) return;
      const now = performance.now(); if (now - t0 > 1000) t0 = now;
      const el = Math.round(now - t0);
      rs.forEach((r, i) => { r.style.setProperty('--n', Math.min(i, 12)); r.style.setProperty('--el', el); r.classList.add('fx-a'); });
    }).observe(jl, { childList: true });
  });
  /* the pie spins in */
  safe(() => {
    const sv = $('#jsvg'), jpie = $('#jpie'); if (!sv || !jpie) return; let t0 = 0;
    new MutationObserver(() => {
      const now = performance.now(); if (now - t0 > 1000) t0 = now;
      sv.style.animation = 'none'; void sv.offsetWidth;
      sv.style.animation = 'fxPie .85s cubic-bezier(.2,1.25,.3,1) ' + (-(now - t0)) + 'ms backwards';
      jpie.classList.remove('fx-pie'); void jpie.offsetWidth; jpie.classList.add('fx-pie');
    }).observe(sv, { childList: true });
  });
  /* journal page: stat numbers pop when they change; "Analysing..." gets a sound + the Save button pulses */
  safe(() => {
    const jp = $('#jp'); if (!jp) return; const lastNum = {}; let lastSv = '';
    new MutationObserver(() => {
      for (let i = 0; i < 5; i++) {
        const e = $('#jsv' + i); if (!e) continue;
        const tx = e.textContent;
        if (lastNum[i] !== undefined && lastNum[i] !== tx && (parseInt(tx.replace(/\D/g, ''), 10) || 0) > 0) retrig(e, 'fx-num', 800);
        lastNum[i] = tx;
      }
      const sv = $('#jx6'), img = jp.children[4];
      if (sv) {
        const tx = sv.textContent;
        if (tx !== lastSv) { lastSv = tx; SND.analyse(/Analysing/i.test(tx)); }
        if (img) {
          img.classList.toggle('fx-saving', /Analysing/i.test(tx));
          img.classList.toggle('fx-saveidle', !/Analysing/i.test(tx) && $('#jsave') && $('#jsave').style.cursor === 'pointer' && img.style.visibility !== 'hidden');
        }
      }
    }).observe(jp, { childList: true, characterData: true, subtree: true });
  });
  /* calendar */
  safe(() => {
    const cg = $('#jcg'); if (cg) new MutationObserver(() => {
      const now = performance.now(); if (now > gridArm) return;
      if (!gridT0) gridT0 = now;
      const el = Math.round(now - gridT0);
      $$('#jcg .cc:not(.out)').forEach((c, i) => { c.style.setProperty('--n', i); c.style.setProperty('--el', el); c.classList.add('fx-a'); });
    }).observe(cg, { childList: true });
    const cs = $('#jcs'); if (cs) new MutationObserver(() => $$('#jcs .ct').forEach((e, i) => e.style.setProperty('--n', Math.min(i, 14)))).observe(cs, { childList: true, subtree: true });
  });
  /* login screens: a wrong password / taken character etc. shakes the panel and plays an error sound */
  ['#aerr', '#aperr', '#aaerr'].forEach(s => safe(() => {
    const e = $(s); if (!e) return;
    new MutationObserver(() => {
      if (!e.textContent.trim()) return;
      SND.play('error'); const ap = e.closest('.ap'); if (ap) shakeEl(ap, 14, 450, true);
    }).observe(e, { childList: true, characterData: true, subtree: true });
  }));

  /* the intro: panels fly in from their edges (after login, or straight away when you were already signed in) */
  let introDone = false;
  const titleOpen = () => !!(window.GroveTitle && !window.GroveTitle.done);   /* the start screen (title.js) is still on top */
  function maybeIntro() { if (introDone || titleOpen()) return; introDone = true; setTimeout(intro, 60); }
  /* the start screen was pressed: play the entrance now that the player can see it */
  function titleDone() {
    if (!authOn && face && face.style.visibility === 'visible') maybeIntro();
    else if (authOn) $$('#auth .ap').forEach(e => { if (getComputedStyle(e).display !== 'none') { e.style.animation = 'none'; void e.offsetWidth; e.style.animation = ''; } });
  }
  function intro() {
    SND.play('whoosh');
    if (RM) return;
    const skip = new Set(['cv', 'tl', 'oc', 'fxc', 'fxflash', 'fxlv', 'fxsv', 'fxsnd', 'jp', 'face']);
    const counts = { l: 0, r: 0, b: 0 };
    [...stage.children].forEach(e => {
      if (skip.has(e.id) || e.classList.contains('hb') || e.classList.contains('fx-float')) return;
      const cs = getComputedStyle(e), x = parseFloat(cs.left), y = parseFloat(cs.top);
      if (isNaN(x) || isNaN(y)) return;
      let d = null;
      if (x < 400 && y < 300) d = 'l'; else if (x < 300 && y >= 600) d = 'l'; else if (x >= 1190 && y < 500) d = 'r'; else if (y >= 700) d = 'b';
      if (!d) return;
      e.style.setProperty('--d', Math.min(counts[d]++ * 30, 420) + 'ms'); e.classList.add('fx-in-' + d);
    });
    stage.classList.add('fx-intro');
    retrig(face, 'pop', 900);
    setTimeout(() => { stage.classList.remove('fx-intro'); $$('.fx-in-l,.fx-in-r,.fx-in-b').forEach(e => e.classList.remove('fx-in-l', 'fx-in-r', 'fx-in-b')); }, 2300);
  }
  function loginDone() { SND.play('enter'); maybeIntro(); }
  function syncAuth() {
    const on = !!auth && auth.style.display === 'flex';
    if (on === authOn) return;
    const was = authOn; authOn = on;
    if (on) resizeA(); else { ga.clearRect(0, 0, AW, AH); if (was) loginDone(); }
  }
  if (auth) { new MutationObserver(syncAuth).observe(auth, { attributes: true, attributeFilter: ['style'] }); syncAuth(); }
  if (face) new MutationObserver(() => { if (!authOn && face.style.visibility === 'visible') maybeIntro(); }).observe(face, { attributes: true, attributeFilter: ['style'] });
  if (!authOn && face && face.style.visibility === 'visible') maybeIntro();

  /* =====================================================================
     10. SOUND ON / OFF BUTTONS (game screen + login screen)
     ===================================================================== */
  const ICON_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/></svg>';
  const ICON_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
  const sndBtns = [];
  function makeSndBtn(id, parent) {
    const b = document.createElement('button'); b.id = id; b.type = 'button'; b.setAttribute('aria-label', 'Sound'); parent.appendChild(b);
    b.addEventListener('click', () => SND.setMuted(!SND.isMuted()));
    sndBtns.push(b); return b;
  }
  function paintSound() {
    const m = SND.isMuted();
    sndBtns.forEach(b => { b.innerHTML = m ? ICON_OFF : ICON_ON; b.title = m ? 'Sound off (M)' : 'Sound on (M)'; b.setAttribute('aria-pressed', m ? 'true' : 'false'); });
  }
  makeSndBtn('fxsnd', stage); makeSndBtn('fxsnda', document.body); paintSound();
  const sa = $('#fxsnda'); const syncSa = () => { sa.style.display = authOn ? 'flex' : 'none'; };
  syncSa(); if (auth) new MutationObserver(syncSa).observe(auth, { attributes: true, attributeFilter: ['style'] });

  window.GroveFX = { titleDone, sound: SND, burst: sparkBurst, confetti, levelUp: levelFX, quest: questFX };
  requestAnimationFrame(loop);
})();
