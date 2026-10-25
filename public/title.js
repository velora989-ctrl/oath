/* =====================================================================
   Oath - start screen (title.js)
   Shows the cover picture + "Press Any Button". While it is on screen the game
   page loads in the background (fonts, every image decoded, character pictures,
   your sign-in), for 2-3 seconds at least. "Press Any Button" only appears when
   everything is ready, so the menu opens without any lag.
   Press = any key, click, tap or gamepad button.
   ===================================================================== */
(function () {
  'use strict';
  const T = document.getElementById('title');
  if (!T) return;
  const state = window.GroveTitle = { done: false, ready: false };
  /* Fullscreen: browsers only allow it straight from a key press / click, so it is requested the moment the player presses */
  const enterFS = () => {
    try {
      const d = document, el = d.documentElement;
      if (d.fullscreenElement || d.webkitFullscreenElement) return;
      const rq = el.requestFullscreen || el.webkitRequestFullscreen;
      if (rq) {
        const r = rq.call(el, { navigationUI: 'hide' });
        /* touch screens only count a tap when the finger lifts: if the browser said no, try again on the next lift / key / click */
        if (r && r.catch) r.catch(() => {
          const evs = ['pointerup', 'touchend', 'click', 'keydown'];
          const once = () => { evs.forEach(e => window.removeEventListener(e, once, true)); enterFS(); };
          evs.forEach(e => window.addEventListener(e, once, true));
        });
      }
    } catch (e) {}
  };
  const fail = () => { state.done = true; try { T.remove(); } catch (e) {} };

  try {
    /* after "Log out" the page reloads straight to the login menu, not the title again */
    let skip = false;
    try { skip = sessionStorage.getItem('grove.skipTitle') === '1'; sessionStorage.removeItem('grove.skipTitle'); } catch (e) {}
    if (skip) {                                          /* a reload leaves fullscreen: the first press on the menu brings it back */
      T.classList.add('off'); state.done = true;
      const again = () => { enterFS(); ['pointerdown', 'keydown'].forEach(ev => window.removeEventListener(ev, again, true)); };
      ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, again, true));
      return;
    }

    const RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const MIN = 2600, MAX = 7500;                       /* ms: shortest and longest time on the loading phase */
    const t0 = performance.now();
    const $ = s => T.querySelector(s);
    const bar = $('.tbar i'), cv = $('canvas'), bg = $('.tbg'), par = $('.tpar');
    const g = cv.getContext('2d');
    document.documentElement.style.overflow = 'hidden';

    /* ---------------- picture fades in as soon as it has loaded ---------------- */
    const needs = { img: 0, load: 0, fonts: 0, data: 0, decode: 0, game: 0 };
    const W = { img: .2, load: .25, fonts: .1, data: .15, decode: .15, game: .15 };
    const shown = () => T.classList.add('in');
    if (bg.complete && bg.naturalWidth) { needs.img = 1; shown(); }
    else { bg.addEventListener('load', () => { needs.img = 1; shown(); }); bg.addEventListener('error', () => { needs.img = 1; shown(); }); }

    /* ---------------- background loading ---------------- */
    const loaded = () => {
      needs.load = 1;
      const imgs = Array.from(document.querySelectorAll('#stage img'));
      Promise.all(imgs.map(i => (i.decode ? i.decode().catch(() => {}) : 0))).then(() => { needs.decode = 1; });
    };
    if (document.readyState === 'complete') loaded(); else window.addEventListener('load', loaded);
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => { needs.fonts = 1; }, () => { needs.fonts = 1; });
    /* the character pictures for the pick screen / player cards, fetched now so they pop in instantly later */
    fetch('/api/characters').then(r => r.json()).then(d => {
      const list = (d && (d.characters || d)) || [];
      return Promise.all(list.flatMap(c => [c.face, c.icon]).filter(Boolean).map(u => new Promise(res => { const im = new Image(); im.onload = im.onerror = res; im.src = u; })));
    }).catch(() => {}).then(() => { needs.data = 1; });
    /* signed-in players: wait until their game screen has been built; others: until the login panel is up */
    const gameReady = () => {
      const a = document.getElementById('auth'), f = document.getElementById('face');
      return (a && a.style.display === 'flex') || (f && f.style.visibility === 'visible');
    };
    const gameTimer = setInterval(() => { if (gameReady()) { needs.game = 1; clearInterval(gameTimer); } }, 80);

    const real = () => Object.keys(W).reduce((s, k) => s + W[k] * needs[k], 0);
    let prog = 0, queued = false, starting = false;

    /* ---------------- press any button ---------------- */
    function launch() {
      if (starting) return; starting = true;
      const FX = window.GroveFX;
      try { FX && FX.sound.unlock(); FX && FX.sound.play('titleStart'); } catch (e) {}
      T.classList.remove('queued'); T.classList.add('go');
      burst(innerWidth / 2, innerHeight * .46, 90, 520);
      setTimeout(() => { state.done = true; document.documentElement.style.overflow = ''; try { FX && FX.titleDone && FX.titleDone(); } catch (e) {} }, 420);
      setTimeout(() => { T.classList.add('off'); cancelAnimationFrame(raf); T.remove(); }, 1500);
    }
    function press() {
      if (state.done || starting) return;
      enterFS();                                         /* inside the key press / click, so the browser allows it */
      if (state.ready) launch();
      else { queued = true; T.classList.add('queued'); }     /* pressed early: starts the moment loading is finished */
    }
    const onKey = e => {
      if (state.done) return;
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key) || /^F\d+$/.test(e.key) || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault(); e.stopImmediatePropagation(); press();
    };
    const onPtr = e => { if (state.done) return; e.preventDefault(); e.stopImmediatePropagation(); press(); };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onPtr, true);
    window.addEventListener('click', e => { if (!state.done) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
    window.addEventListener('touchstart', e => { if (!state.done) press(); }, { capture: true, passive: true });
    let padDown = false;
    const pollPad = () => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      let any = false;
      for (const p of pads) if (p && p.buttons.some(b => b.pressed)) any = true;
      if (any && !padDown) press();
      padDown = any;
    };

    /* ---------------- particles: fireflies, pollen, drifting leaves, and a burst when you press ---------------- */
    const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
    let CW = 0, CH = 0, DPR = 1;
    const resize = () => { DPR = Math.min(2, window.devicePixelRatio || 1); CW = innerWidth; CH = innerHeight; cv.width = CW * DPR; cv.height = CH * DPR; g.setTransform(DPR, 0, 0, DPR, 0, 0); };
    resize(); addEventListener('resize', resize);
    const flies = Array.from({ length: RM ? 0 : 46 }, () => ({ bx: rnd(0, 1), by: rnd(.25, 1), ax: rnd(20, 90), ay: rnd(10, 50), sx: rnd(.1, .35), sy: rnd(.15, .4), ph: rnd(0, 6.28), bl: rnd(.5, 1.3), r: rnd(1.3, 2.8) }));
    const pollen = Array.from({ length: RM ? 0 : 70 }, () => ({ x: rnd(0, 1), y: rnd(0, 1), vx: rnd(.004, .016), vy: rnd(-.004, .004), r: rnd(.7, 1.8), ph: rnd(0, 6.28), a: rnd(.25, .8) }));
    const LEAF = ['#7fb04c', '#c9a24a', '#d2704a', '#9bc45e'];
    const leaves = Array.from({ length: RM ? 0 : 12 }, () => ({ x: rnd(0, 1), y: rnd(-.1, 1), vx: rnd(.004, .02), vy: rnd(.02, .045), rot: rnd(0, 6), vr: rnd(-1.5, 1.5), sw: rnd(.8, 1.8), ph: rnd(0, 6), col: pick(LEAF), s: rnd(4, 8) }));
    const sparks = [];
    function glow(x, y, r, rgb, a) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + rgb + ',0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill(); }
    function star(x, y, r, rot) { g.beginPath(); for (let i = 0; i < 8; i++) { const a = rot + i * Math.PI / 4, rr = i % 2 ? r * .32 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); }
    function burst(x, y, n, pw) {
      for (let i = 0; i < n; i++) { const a = rnd(0, 6.283), s = rnd(pw * .25, pw); sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: rnd(.7, 1.5), r: rnd(5, 13), col: pick(['#fff3b0', '#ffe08a', '#ffffff', '#bff5a0']), rot: rnd(0, 6), vr: rnd(-6, 6) }); }
    }

    /* mouse parallax: the picture drifts a little the other way */
    let mx = 0, my = 0, cx = 0, cy = 0;
    if (!RM) window.addEventListener('mousemove', e => { mx = (e.clientX / innerWidth - .5) * -26; my = (e.clientY / innerHeight - .5) * -16; });

    let last = performance.now(), raf = 0, readyAt = 0;
    function frame(ms) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(.05, (ms - last) / 1000) || .016; last = ms; const t = ms / 1000, el = ms - t0;
      /* progress bar: real progress, but never faster than the minimum time allows */
      const target = Math.min(real(), Math.min(1, el / MIN));
      prog += (target - prog) * Math.min(1, dt * 6);
      bar.parentNode.style.setProperty('--p', prog.toFixed(3)); bar.style.setProperty('--p', prog.toFixed(3));
      if (!state.ready && ((real() >= .999 && el >= MIN) || el >= MAX)) {
        state.ready = true; readyAt = ms; T.classList.add('ready');
        bar.style.setProperty('--p', 1);
        if (queued) setTimeout(launch, 350);
      }
      pollPad();
      cx += (mx - cx) * Math.min(1, dt * 3); cy += (my - cy) * Math.min(1, dt * 3);
      par.style.translate = cx.toFixed(1) + 'px ' + cy.toFixed(1) + 'px';

      g.clearRect(0, 0, CW, CH);
      g.globalCompositeOperation = 'lighter';
      for (const f of flies) {
        const x = f.bx * CW + Math.sin(t * f.sx + f.ph) * f.ax + Math.sin(t * .11 + f.ph * 2) * 24, y = f.by * CH + Math.cos(t * f.sy + f.ph * 1.3) * f.ay;
        const a = (.15 + .85 * Math.pow(.5 + .5 * Math.sin(t * f.bl * 2 + f.ph), 3)) * Math.min(1, Math.max(0, (el - 900) / 1500));
        glow(x, y, f.r * 7, '240,238,140', a * .5); glow(x, y, f.r * 2.2, '255,250,205', a);
      }
      for (const p of pollen) {
        p.x += p.vx * dt; p.y += p.vy * dt + Math.sin(t + p.ph) * .0004; if (p.x > 1.02) { p.x = -.02; p.y = rnd(0, 1); }
        g.fillStyle = 'rgba(255,248,220,' + (p.a * (.5 + .5 * Math.sin(t * 1.4 + p.ph))) + ')'; g.beginPath(); g.arc(p.x * CW, p.y * CH, p.r, 0, 6.2832); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      for (const l of leaves) {
        l.y += l.vy * dt; l.x += l.vx * dt + Math.sin(t * l.sw + l.ph) * .0014; l.rot += l.vr * dt;
        if (l.y > 1.05) { l.y = -.05; l.x = rnd(0, 1); } if (l.x > 1.05) l.x = -.05;
        g.save(); g.translate(l.x * CW, l.y * CH); g.rotate(l.rot); g.scale(1, .55 + .45 * Math.abs(Math.sin(t * l.sw * 1.7 + l.ph)));
        g.globalAlpha = .8; g.fillStyle = l.col; g.beginPath(); g.ellipse(0, 0, l.s, l.s * .5, 0, 0, 6.2832); g.fill(); g.restore();
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'lighter';
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]; s.life += dt; if (s.life >= s.max) { sparks.splice(i, 1); continue; }
        const k = s.life / s.max; s.vx -= s.vx * 1.6 * dt; s.vy += (260 * dt) - s.vy * 1.6 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt;
        g.globalAlpha = 1 - k * k; g.fillStyle = s.col; star(s.x, s.y, s.r * (1 - k * .6), s.rot);
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    raf = requestAnimationFrame(frame);
    state.start = press;
  } catch (e) { console.warn('[title]', e); fail(); }
})();
