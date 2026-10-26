/* ===== Vintage looks for pinned pictures (used by board.js) =====
   GroveVintage.bake(src, fx, seed, alpha, unit) -> canvas
     src   a canvas holding the picture (already cropped, already sized for the board)
     fx    2 = old photograph (sepia toning, film grain, vignette, dust, scratches, creases, foxing, a worn cream border)
           3 = ink sketch (pen outlines + cross-hatching on aged paper, with stains and wear)
     seed  the picture's own seed: the same picture always gets the same "damage"
     alpha true when the picture has transparent pixels: the cut-out shape is kept and no border is added
     unit  bitmap pixels per pixel on the board, so grain and hatch lines stay the same real size
   The effects are drawn into the pixels (not a CSS filter), so they look like real wear and can be saved as a normal image. */
(function () {
  'use strict';
  if (window.GroveVintage) return;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function rng(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  /* smooth value noise (cell = size of one blob in px) and a 3-octave version of it */
  function noise(w, h, cell, r) {
    const gw = Math.ceil(w / cell) + 3, gh = Math.ceil(h / cell) + 3, g = new Float32Array(gw * gh);
    for (let i = 0; i < g.length; i++) g[i] = r();
    return (x, y) => {
      const fx = x / cell, fy = y / cell, ix = fx | 0, iy = fy | 0; let tx = fx - ix, ty = fy - iy;
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
      const top = a + (b - a) * tx, bot = c + (d - c) * tx; return top + (bot - top) * ty;
    };
  }
  function fbm(w, h, cell, r) {
    const n1 = noise(w, h, cell, r), n2 = noise(w, h, cell / 2.3, r), n3 = noise(w, h, cell / 5.5, r);
    return (x, y) => n1(x, y) * 0.55 + n2(x, y) * 0.3 + n3(x, y) * 0.15;
  }
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  /* ---- marks drawn on top of the finished pixels (they only touch pixels that already exist: source-atop) ---- */
  function foxing(ctx, w, h, r, n, u, strong) {
    for (let i = 0; i < n; i++) {
      const x = r() * w, y = r() * h, rad = (3 + r() * r() * 16) * u, a = (strong ? 0.12 : 0.07) + r() * (strong ? 0.28 : 0.2);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(118,66,22,' + a + ')'); g.addColorStop(0.55, 'rgba(140,86,34,' + a * 0.55 + ')'); g.addColorStop(1, 'rgba(140,86,34,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.283); ctx.fill();
    }
  }
  function coffeeRing(ctx, w, h, r, u) {
    const x = (0.2 + r() * 0.6) * w, y = (0.2 + r() * 0.6) * h, rad = (34 + r() * 46) * u, a0 = r() * 6.283, span = 4.2 + r() * 2;
    ctx.save(); ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {   /* a ring that is darker at its rim, a little broken, drawn a few times so it looks watery */
      ctx.strokeStyle = 'rgba(98,56,18,' + (0.13 - k * 0.03) + ')'; ctx.lineWidth = (3.2 - k) * u;
      ctx.beginPath(); ctx.arc(x + (r() - 0.5) * 2 * u, y + (r() - 0.5) * 2 * u, rad + k * 1.6 * u, a0, a0 + span); ctx.stroke();
    }
    const g = ctx.createRadialGradient(x, y, rad * 0.3, x, y, rad); g.addColorStop(0, 'rgba(150,100,45,0)'); g.addColorStop(1, 'rgba(150,100,45,.07)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.283); ctx.fill(); ctx.restore();
  }
  function crease(ctx, w, h, r, u) {   /* a fold: a light line with a dark line beside it, broken in places */
    const horiz = r() < 0.5, p0 = (0.25 + r() * 0.5), tilt = (r() - 0.5) * 0.18;
    const pts = []; const N = 14;
    for (let i = 0; i <= N; i++) {
      const t = i / N, jit = (r() - 0.5) * 1.6 * u;
      pts.push(horiz ? [t * w, (p0 + tilt * (t - 0.5)) * h + jit] : [(p0 + tilt * (t - 0.5)) * w + jit, t * h]);
    }
    ctx.save(); ctx.lineCap = 'round';
    for (const [col, off, lw] of [['rgba(255,247,224,.5)', -1.3 * u, 1.3 * u], ['rgba(45,28,12,.5)', 1.0 * u, 1.5 * u], ['rgba(45,28,12,.18)', 3.2 * u, 3 * u]]) {
      for (let i = 0; i < N; i++) {
        if (r() < 0.16) continue;   /* gaps */
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
        ctx.moveTo(pts[i][0] + (horiz ? 0 : off), pts[i][1] + (horiz ? off : 0)); ctx.lineTo(pts[i + 1][0] + (horiz ? 0 : off), pts[i + 1][1] + (horiz ? off : 0)); ctx.stroke();
      }
    }
    ctx.restore();
  }
  function scratchesAndDust(ctx, w, h, r, u, many) {
    ctx.save(); ctx.lineCap = 'round';
    const ns = many ? 9 : 4;
    for (let i = 0; i < ns; i++) {   /* long thin scratches, mostly top to bottom */
      const x = r() * w, y = r() * h * 0.6, len = (0.18 + r() * 0.55) * h, dx = (r() - 0.5) * 0.12 * len, light = r() < 0.7;
      ctx.strokeStyle = light ? 'rgba(255,250,232,' + (0.18 + r() * 0.3) + ')' : 'rgba(30,18,8,' + (0.15 + r() * 0.25) + ')';
      ctx.lineWidth = (0.5 + r() * 0.9) * u; ctx.beginPath(); ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + dx * 0.3 + (r() - 0.5) * 3 * u, y + len * 0.3, x + dx * 0.8 + (r() - 0.5) * 3 * u, y + len * 0.7, x + dx, y + len); ctx.stroke();
    }
    const nd = Math.round(w * h / (many ? 7000 : 16000) / (u * u));
    for (let i = 0; i < nd; i++) {   /* specks of dust */
      const x = r() * w, y = r() * h, rad = (0.5 + r() * r() * 2.2) * u;
      ctx.fillStyle = r() < 0.55 ? 'rgba(255,248,226,' + (0.35 + r() * 0.4) + ')' : 'rgba(28,16,6,' + (0.3 + r() * 0.4) + ')';
      ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.283); ctx.fill();
    }
    for (let i = 0; i < 2; i++) {   /* a hair or a fibre lying on the picture */
      const x = r() * w, y = r() * h, L = (30 + r() * 70) * u; ctx.strokeStyle = 'rgba(30,18,8,' + (0.25 + r() * 0.2) + ')'; ctx.lineWidth = 0.8 * u;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + L * 0.3, y - L * 0.4 * (r() - 0.3), x + L * 0.6, y + L * 0.5 * (r() - 0.5), x + L, y + (r() - 0.5) * L * 0.5); ctx.stroke();
    }
    ctx.restore();
  }
  /* the outer edge of a photograph is not perfectly straight: tiny bites and worn corners are erased from the alpha */
  function wornEdge(ctx, w, h, r, u, corner) {
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000';
    const bite = (x, y, rad) => { ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.283); ctx.fill(); };
    const step = 5 * u;
    for (let x = 0; x < w; x += step * (0.6 + r())) { if (r() < 0.55) { const d = r() * 1.6 * u; bite(x, -0.4 * u + d * 0.2, (0.7 + r() * 1.2) * u); bite(x, h + 0.4 * u - d * 0.2, (0.7 + r() * 1.2) * u); } }
    for (let y = 0; y < h; y += step * (0.6 + r())) { if (r() < 0.55) { bite(-0.4 * u, y, (0.7 + r() * 1.2) * u); bite(w + 0.4 * u, y, (0.7 + r() * 1.2) * u); } }
    if (corner) {
      [[0, 0, 1, 1], [w, 0, -1, 1], [0, h, 1, -1], [w, h, -1, -1]].forEach(([cx, cy, sx, sy]) => {
        const s = (4 + r() * 12) * u * (r() < 0.35 ? 2.2 : 1);   /* a little triangle worn off, ragged */
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + sx * s, cy); ctx.lineTo(cx + sx * s * 0.55, cy + sy * s * 0.35); ctx.lineTo(cx + sx * s * 0.3, cy + sy * s * 0.7); ctx.lineTo(cx, cy + sy * s); ctx.closePath(); ctx.fill();
      });
    }
    ctx.restore();
  }

  /* ================================================================== old photograph */
  function photo(src, seed, alpha, u) {
    /* the output has exactly the size of the input, so the picture keeps its shape on the board; the cream border is drawn INSIDE it */
    const W = src.width, H = src.height, r = rng(seed * 31 + 7);
    const pad = alpha ? 0 : Math.round(clamp(Math.min(W, H) * 0.06, 9 * u, 40 * u));
    const sw = W - pad * 2, sh = H - pad * 2, out = mkCanvas(W, H), ctx = out.getContext('2d', { willReadFrequently: true });
    const inner = mkCanvas(sw, sh); inner.getContext('2d').drawImage(src, 0, 0, sw, sh);
    const sd = inner.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, sw, sh), d = sd.data;
    const blot = fbm(sw, sh, 70 * u, r), leak = fbm(sw, sh, 260 * u, r), dark = [30, 19, 10], mid = [148, 108, 66], lite = [238, 224, 186];
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const i = (y * sw + x) * 4, a = d[i + 3]; if (!a) continue;
        const R = d[i], G = d[i + 1], B = d[i + 2];
        let L = (0.299 * R + 0.587 * G + 0.114 * B) / 255;
        L = L * L * (3 - 2 * L) * 0.5 + L * 0.5;   /* a soft S-curve: deep shadows, bright highlights */
        L = 0.07 + L * 0.84;   /* faded: blacks are never black, whites are never white */
        L += (r() - 0.5) * 0.12 + (r() - 0.5) * 0.05;   /* film grain */
        L *= 0.78 + 0.4 * blot(x, y);   /* uneven fading */
        const dx = (x / sw - 0.5) * 2, dy = (y / sh - 0.5) * 2;
        if (!alpha) L *= 1 - 0.5 * smooth(0.22, 1.9, dx * dx + dy * dy);   /* dark corners (the lens, the age) */
        L *= 1 + 0.16 * (leak(x, y) - 0.5);   /* a faint light leak */
        L = clamp(L, 0, 1);
        let cr, cg, cb;
        if (L < 0.5) { const t = L * 2; cr = dark[0] + (mid[0] - dark[0]) * t; cg = dark[1] + (mid[1] - dark[1]) * t; cb = dark[2] + (mid[2] - dark[2]) * t; }
        else { const t = (L - 0.5) * 2; cr = mid[0] + (lite[0] - mid[0]) * t; cg = mid[1] + (lite[1] - mid[1]) * t; cb = mid[2] + (lite[2] - mid[2]) * t; }
        d[i] = cr * 0.9 + R * 0.1 * L; d[i + 1] = cg * 0.9 + G * 0.1 * L; d[i + 2] = cb * 0.9 + B * 0.1 * L;
      }
    }
    if (pad) {   /* the cream paper border with its own grain, a darker worn rim and soft stains */
      const bn = fbm(W, H, 55 * u, r);
      const bd = ctx.createImageData(W, H), b = bd.data;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (x >= pad && x < pad + sw && y >= pad && y < pad + sh) continue;
          const i = (y * W + x) * 4, e = Math.min(x, y, W - 1 - x, H - 1 - y), rim = 1 - smooth(0, pad * 0.9, e) * 0.9;
          const g = 0.93 + r() * 0.07, st = 0.86 + 0.2 * bn(x, y), k = g * st * (1 - rim * 0.3);
          b[i] = 236 * k; b[i + 1] = 226 * k * (1 - rim * 0.05); b[i + 2] = 196 * k * (1 - rim * 0.18); b[i + 3] = 255;
        }
      }
      ctx.putImageData(bd, 0, 0);
    }
    const tmp = mkCanvas(sw, sh); tmp.getContext('2d').putImageData(sd, 0, 0);
    ctx.drawImage(tmp, pad, pad);
    ctx.globalCompositeOperation = 'source-atop';
    if (pad) {   /* where the photo meets the paper: a thin dark edge and a tiny shadow */
      ctx.strokeStyle = 'rgba(40,24,10,.55)'; ctx.lineWidth = 1.4 * u; ctx.strokeRect(pad - 0.4 * u, pad - 0.4 * u, sw + 0.8 * u, sh + 0.8 * u);
      const g = ctx.createLinearGradient(0, pad, 0, pad + 6 * u); g.addColorStop(0, 'rgba(20,10,0,.28)'); g.addColorStop(1, 'rgba(20,10,0,0)'); ctx.fillStyle = g; ctx.fillRect(pad, pad, sw, 6 * u);
    }
    foxing(ctx, W, H, r, Math.round(W * H / 26000 / (u * u)) + 6, u, true);
    if (r() < 0.55) coffeeRing(ctx, W, H, r, u);
    crease(ctx, W, H, r, u); if (r() < 0.6) crease(ctx, W, H, r, u);
    scratchesAndDust(ctx, W, H, r, u, true);
    ctx.globalCompositeOperation = 'source-over';
    if (!alpha) wornEdge(ctx, W, H, r, u, true);
    return out;
  }

  /* ================================================================== ink sketch */
  function ink(src, seed, alpha, u) {
    const w = src.width, h = src.height, r = rng(seed * 17 + 3), out = mkCanvas(w, h), ctx = out.getContext('2d', { willReadFrequently: true });
    const sd = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h), d = sd.data, n = w * h;
    /* brightness, slightly softened so that grain and noise in the picture do not turn into scribbles */
    const L0 = new Float32Array(n), L = new Float32Array(n);
    for (let i = 0; i < n; i++) L0[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
    const bw = Math.max(1, Math.round(u * 0.9));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, c = 0;
      for (let yy = Math.max(0, y - bw); yy <= Math.min(h - 1, y + bw); yy++) for (let xx = Math.max(0, x - bw); xx <= Math.min(w - 1, x + bw); xx++) { s += L0[yy * w + xx]; c++; }
      L[y * w + x] = s / c;
    }
    /* outlines: Sobel edge strength, scaled to the strongest edges of this picture */
    const E = new Float32Array(n); let maxE = 0.0001;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -L[i - w - 1] - 2 * L[i - 1] - L[i + w - 1] + L[i - w + 1] + 2 * L[i + 1] + L[i + w + 1];
      const gy = -L[i - w - 1] - 2 * L[i - w] - L[i - w + 1] + L[i + w - 1] + 2 * L[i + w] + L[i + w + 1];
      const m = Math.sqrt(gx * gx + gy * gy); E[i] = m; if (m > maxE) maxE = m;
    }
    const wob = noise(w, h, 22 * u, r), wob2 = noise(w, h, 15 * u, r), paperN = fbm(w, h, 80 * u, r), inkN = noise(w, h, 3 * u, r);
    const P = Math.max(3.2, 4.6 * u), lw0 = 0.42 * u;   /* spacing and thickness of the pen strokes */
    const lineCov = (t, wd) => { const m = ((t % P) + P) % P, dist = Math.min(m, P - m); return clamp(wd - dist + 0.5, 0, 1); };
    const paper = [233, 215, 168], inkC = [43, 26, 13];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x, o = i * 4, a = d[o + 3]; if (!a) { d[o + 3] = 0; continue; }
        const D = clamp((0.95 - L[i]) / 0.85, 0, 1);   /* darkness 0 (white) .. 1 (black) */
        const ee = clamp((E[i] / maxE - 0.07) / 0.3, 0, 1), edge = ee * ee * (3 - 2 * ee);
        const j = wob(x, y) * 4.2 * u, j2 = wob2(x, y) * 3.2 * u;
        const h1 = lineCov(x + y + j, lw0 + D * 0.5 * u) * smooth(0.2, 0.32, D);                 /* first set of strokes: shadows */
        const h2 = lineCov(x - y + j2 * 1.3, lw0 + D * 0.45 * u) * smooth(0.46, 0.58, D);        /* cross strokes: deeper shadows */
        const h3 = lineCov(y + j * 0.6, lw0 + D * 0.4 * u) * smooth(0.7, 0.8, D);                /* a third set: the darkest places */
        let k = Math.max(edge * 0.96, h1 * 0.8, h2 * 0.85, h3 * 0.9);
        k *= 0.8 + 0.2 * r() + 0.15 * (inkN(x, y) - 0.5);   /* ink bleeds and skips a little */
        k = clamp(k, 0, 1);
        const pn = 0.9 + 0.2 * paperN(x, y), grain = 0.96 + r() * 0.06;
        /* the paper, faintly tinted by the original colours (an old hand-coloured print) */
        const wash = 0.2 * smooth(0.08, 0.5, D);
        const pr = (paper[0] * (1 - wash) + d[o] * wash) * pn * grain, pg = (paper[1] * (1 - wash) + d[o + 1] * wash) * pn * grain, pb = (paper[2] * (1 - wash) + d[o + 2] * wash * 0.8) * pn * grain;
        d[o] = pr * (1 - k) + inkC[0] * k; d[o + 1] = pg * (1 - k) + inkC[1] * k; d[o + 2] = pb * (1 - k) + inkC[2] * k;
      }
    }
    ctx.putImageData(sd, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    if (!alpha) {   /* the edges of the page are darker and browner */
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.55);
      g.addColorStop(0, 'rgba(90,50,14,0)'); g.addColorStop(1, 'rgba(90,50,14,.5)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(70,38,10,.35)'; ctx.lineWidth = 5 * u; ctx.strokeRect(0, 0, w, h);
    }
    for (let i = 0; i < Math.round(w * h / 9000 / (u * u)); i++) {   /* paper fibres */
      const x = r() * w, y = r() * h, L2 = (4 + r() * 12) * u, an = r() * 6.283;
      ctx.strokeStyle = r() < 0.5 ? 'rgba(255,248,225,.28)' : 'rgba(110,70,30,.22)'; ctx.lineWidth = 0.6 * u; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(an) * L2, y + Math.sin(an) * L2); ctx.stroke();
    }
    foxing(ctx, w, h, r, Math.round(w * h / 38000 / (u * u)) + 4, u, false);
    if (r() < 0.5) coffeeRing(ctx, w, h, r, u);
    if (r() < 0.6) crease(ctx, w, h, r, u);
    for (let i = 0; i < 5; i++) {   /* a few ink blots and flicks of the pen */
      const x = r() * w, y = r() * h, rad = (0.8 + r() * r() * 3) * u; ctx.fillStyle = 'rgba(40,24,12,' + (0.45 + r() * 0.4) + ')';
      ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.283); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    return out;
  }

  window.GroveVintage = {
    bake(src, fx, seed, alpha, unit) {
      const u = clamp(unit || 1.5, 0.7, 3);
      if (fx === 2) return photo(src, seed | 0, !!alpha, u);
      if (fx === 3) return ink(src, seed | 0, !!alpha, u);
      return src;
    }
  };
})();
