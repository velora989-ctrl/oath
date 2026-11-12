/* Creators Museum (the "Patch" panel, bottom left): a gallery of the creators you want to study.
   Add a person, pick their hall (self-help, business or productivity), then save their YouTube videos or playlists by pasting a link,
   or by dragging a video from the YouTube website onto the page. Each creator also has a Books shelf: search a book by name (Google Books), pick it, and it stands on the shelf with its cover and total pages.
   Videos look and play like on YouTube (thumbnail, title, length,
   up-next list, timestamps), dressed in the Grove's wood and parchment. Everything is saved per player: localStorage at once, the
   server a moment later (GET / PUT /api/museum). */
(function () {
  'use strict';
  const W = 1671, H = 941;
  const MAX_CREATORS = 40, MAX_VIDEOS = 400, MAX_BOOKS = 100;
  const BID = /^[A-Za-z0-9_-]{1,40}$/, COVER = /^https:\/\/(books\.google\.[a-z.]+|books\.googleusercontent\.com|covers\.openlibrary\.org)\/[^\s"'<>]*$/;
  const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=EB+Garamond:ital,wght@0,400;0,600;1,400&family=IM+Fell+English:ital@0;1&family=IM+Fell+English+SC&display=swap';
  const HALLS = {
    self: { n: 'Self-help', one: 'self-help', c: '#c0552f', ic: '<path d="M12 21s-7.5-4.6-9.2-9.3C1.6 8.1 3.7 5 6.9 5c2 0 3.5 1 5.1 3 1.6-2 3.1-3 5.1-3 3.2 0 5.3 3.100 4.100 6.700C19.500 16.400 12 21 12 21z"/>' },
    biz: { n: 'Business', one: 'business', c: '#2d7d9a', ic: '<rect x="3" y="7.500" width="18" height="12.500" rx="2"/><path d="M8.500 7.500V5.500a1.500 1.500 0 0 1 1.500-1.500h4a1.500 1.500 0 0 1 1.500 1.500v2M3 13h18"/>' },
    prod: { n: 'Productivity', one: 'productivity', c: '#5aa33e', ic: '<circle cx="12" cy="12.500" r="8"/><path d="M12 8v4.800l3 1.700M9 2.500h6"/>' }
  };
  const HALL_KEYS = ['self', 'biz', 'prod'];
  /* the museum map (museum/map.jpg, one still picture): where each portrait stands, in map pixels */
  const MAP_W = 3346, MAP_H = 941;
  const NODES = [[181,94,41],[247,309,39],[368,178,47],[428,625,41],[580,152,41],[781,203,43],[790,447,43],[794,767,43],[1042,710,45],[1057,224,46],[1199,363,45],[1276,619,42],[1337,466,42],[1391,767,43],[1933,706,38],[2027,573,35],[2087,452,43],[2193,364,38],[2387,499,39],[2389,709,38],[2635,409,38],[2725,253,41],[2785,571,38],[2881,389,37],[3086,251,39],[3163,417,35],[3257,97,38]];   /* x, y, medallion radius in map pixels */
  const SLOTS = NODES.length;
  const $ = (s, r) => (r || document).querySelector(s);
  const mk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const snd = n => { try { window.GroveFX && window.GroveFX.sound && window.GroveFX.sound.play(n); } catch (e) {} };
  const uid = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const svg = d => '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
  const IC = {
    back: svg('<path d="M15 5l-7 7 7 7"/>'), plus: svg('<path d="M12 5v14M5 12h14"/>'), folder: svg('<path d="M3 7.500A1.500 1.500 0 0 1 4.500 6h4.200l2 2.500h8.800A1.500 1.500 0 0 1 21 10v8a1.500 1.500 0 0 1-1.500 1.500h-15A1.500 1.500 0 0 1 3 18z"/>'), edit: svg('<path d="M4 20l1-4L16.500 4.500a2.100 2.100 0 0 1 3 3L8 19z"/><path d="M14 7l3 3"/>'),
    link: svg('<path d="M10 14a4.500 4.500 0 0 0 6.400 0l3-3a4.500 4.500 0 0 0-6.400-6.400l-1 1M14 10a4.500 4.500 0 0 0-6.400 0l-3 3a4.500 4.500 0 0 0 6.400 6.400l1-1"/>'),
    play: svg('<path d="M7 4.500v15l13-7.500z" fill="currentColor"/>'), x: svg('<path d="M6 6l12 12M18 6L6 18"/>'), ext: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
    trash: svg('<path d="M4 7h16M9 7V4.500h6V7M6.500 7l.8 12.500h9.400L17.500 7"/>'), clock: svg('<circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/>'),
    reel: svg('<rect x="4" y="3" width="16" height="18" rx="4"/><path d="M4 8.500h16M9.500 3l2 5.500M14.500 3l2 5.500"/><path d="M10.500 12.500l4 2.500-4 2.500z"/>'),
    check: svg('<path d="M5 12.500l4.500 4.500L19 7.500"/>'),
    book: svg('<path d="M5 4.500A1.500 1.500 0 0 1 6.500 3H19v15H6.500A1.500 1.500 0 0 0 5 19.500z"/><path d="M5 19.500A1.500 1.500 0 0 0 6.500 21H19v-3M9 7.500h6"/>'), search: svg('<circle cx="10.500" cy="10.500" r="6"/><path d="M15 15l5 5"/>'),
    list: svg('<path d="M4 6h12M4 11h12M4 16h8"/><path d="M18 13.500v6l4.500-3z" fill="currentColor"/>'), hall: h => svg(HALLS[h].ic)
  };

  /* ------------------------------------------------------------ YouTube links */
  const VID = /^[A-Za-z0-9_-]{11}$/, LST = /^[A-Za-z0-9_-]{10,50}$/;
  function toSeconds(v) {   /* 90, "90s", "1m30s", "1:30" */
    if (!v) return 0; v = String(v).trim();
    if (/^\d+$/.test(v)) return +v;
    let m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i.exec(v); if (m && (m[1] || m[2] || m[3])) return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
    m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(v); if (m) return (+m[1] || 0) * 3600 + +m[2] * 60 + +m[3];
    return 0;
  }
  /* every video / playlist found in some pasted or dropped text (links, ids, or the html of a dragged YouTube thumbnail) */
  function parseLinks(raw) {
    const out = [], seen = new Set();
    const add = o => { const k = o.kind + o.id; if (!seen.has(k)) { seen.add(k); out.push(o); } };
    let s = String(raw || '');
    const hrefs = []; s.replace(/href\s*=\s*["']([^"']+)["']/gi, (_, h) => { hrefs.push(h.replace(/&amp;/g, '&')); return ''; });
    const tokens = hrefs.concat(s.replace(/<[^>]*>/g, ' ').split(/[\s,;|]+/)).filter(Boolean);
    tokens.forEach(tok => {
      let u = null, t = tok.trim().replace(/^["'(<]+|["')>.,]+$/g, '');
      if (/^\/(watch|shorts|playlist|live)/.test(t)) t = 'https://www.youtube.com' + t;
      if (/^(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//i.test(t)) t = 'https://' + t;
      if (/^(www\.)?instagram\.com\//i.test(t)) t = 'https://' + t;
      try { u = new URL(t); } catch (e) {}
      if (u && /(^|\.)instagram\.com$/i.test(u.hostname)) {   /* Instagram reel: instagram.com/reel/CODE, /reels/CODE, /p/CODE, /USER/reel/CODE */
        const m = u.pathname.match(/^\/(?:([A-Za-z0-9._]{1,30})\/)?(?:reel|reels|p|tv)\/([A-Za-z0-9_-]{5,20})/i);
        if (m) add({ kind: 'r', id: m[2], user: m[1] && !/^(reel|reels|p|tv)$/i.test(m[1]) ? m[1] : '' });
        return;
      }
      if (u && /(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/i.test(u.hostname)) {
        const p = u.pathname, v = u.searchParams.get('v'), l = u.searchParams.get('list'), at = toSeconds(u.searchParams.get('t') || u.searchParams.get('start') || (u.hash.match(/t=([^&]+)/) || [])[1]);
        let id = '';
        if (/youtu\.be$/i.test(u.hostname)) id = p.slice(1).split('/')[0];
        else if (/^\/(shorts|embed|live|v)\//.test(p)) id = p.split('/')[2];
        else if (v) id = v;
        if (VID.test(id)) add({ kind: 'v', id, at });
        else if (l && LST.test(l) && !/^RD/.test(l)) add({ kind: 'l', id: l });
        return;
      }
      if (VID.test(t) && /[A-Za-z]/.test(t) && !/^[a-z]+$/.test(t) && tokens.length === 1) add({ kind: 'v', id: t, at: 0 });
      else if (/^(PL|UU|OL|FL|LL)[A-Za-z0-9_-]{8,48}$/.test(t)) add({ kind: 'l', id: t });
    });
    return out;
  }
  const thumb = (id, q) => 'https://i.ytimg.com/vi/' + id + '/' + (q || 'mqdefault') + '.jpg';
  const fmt = s => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
  const ago = ms => { if (!ms) return ''; const d = Math.floor((Date.now() - ms) / 864e5); return d < 1 ? 'added today' : d === 1 ? 'added yesterday' : d < 30 ? 'added ' + d + ' days ago' : d < 365 ? 'added ' + Math.floor(d / 30) + ' mo ago' : 'added ' + Math.floor(d / 365) + ' y ago'; };

  /* ------------------------------------------------------------ the YouTube player (loaded from youtube.com when first needed) */
  let ytP = null;
  function ytReady() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (ytP) return ytP;
    ytP = new Promise((res, rej) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { try { prev && prev(); } catch (e) {} res(window.YT); };
      const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.async = true; s.onerror = () => { ytP = null; rej(new Error('YouTube could not be reached')); };
      document.head.appendChild(s);
      setTimeout(() => { if (!(window.YT && window.YT.Player)) { ytP = null; rej(new Error('YouTube is taking too long')); } }, 12000);
    });
    return ytP;
  }
  /* a playlist without an API key: let YouTube's own player load it and ask it for the video ids */
  async function playlistViaPlayer(listId) {
    await ytReady();
    return new Promise((res, rej) => {
      const host = mk('div'); host.style.cssText = 'position:fixed;left:-9999px;top:0;width:220px;height:130px;overflow:hidden'; const inner = mk('div'); host.appendChild(inner); document.body.appendChild(host);
      let done = false, p = null;
      const fin = (v, e) => { if (done) return; done = true; try { p && p.destroy(); } catch (x) {} host.remove(); e ? rej(e) : res(v); };
      p = new window.YT.Player(inner, { width: 220, height: 130, playerVars: { listType: 'playlist', list: listId }, events: {
        onReady: () => { let n = 0; const t = setInterval(() => { let ids = null; try { ids = p.getPlaylist(); } catch (e) {} if (ids && ids.length) { clearInterval(t); fin(ids); } else if (++n > 50) { clearInterval(t); fin(null, new Error('empty')); } }, 250); },
        onError: () => fin(null, new Error('player error')) } });
      setTimeout(() => fin(null, new Error('timeout')), 20000);
    });
  }

  /* ------------------------------------------------------------ state + saving */
  let root, stage, topEl, hallsEl, bodyEl, modalEl, dropEl, toastEl, statusEl;
  let fromMap = false, mapWatch = false; const listeners = [];
  const notify = () => listeners.forEach(f => { try { f(); } catch (e) {} });
  let folders = [], creators = [], screen = 'lobby', hallF = 'all', curId = '', vKey = '', listF = '', isOpen = false, built = false, scale = 1;
  let rmMode = false, ctab = 'videos', bres = { q: '', items: [], st: 'idle', err: '' }, bseq = 0, bT = 0;
  let saveT = 0, saving = false, again = false, loadSeq = 0;
  const token = () => { try { return localStorage.getItem('grove_token') || ''; } catch (e) { return ''; } };
  const api = () => window.GroveAPI;
  function who() {
    const t = token(); if (!t) return 'guest';
    try { const p = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); if (p && (p.id || p._id || p.sub)) return String(p.id || p._id || p.sub); } catch (e) {}
    return t.slice(-16);
  }
  const lkey = () => 'grove_museum_' + who();
  const vk = v => v.kind + v.id;
  const cur = () => creators.find(c => c.id === curId) || folders.find(c => c.id === curId) || null;
    const inList = c => c.videos;   /* one section: every video of the creator, no playlist tabs */
  function clean(list, max) {
    return (Array.isArray(list) ? list : []).filter(c => c && c.id && HALLS[c.hall] && c.name).slice(0, max || SLOTS).map(c => ({
      id: String(c.id), name: String(c.name).slice(0, 60), hall: c.hall, note: String(c.note || '').slice(0, 300), at: +c.at || 0,
      img: /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(c.img || '') && c.img.length <= 60000 ? c.img : '', slot: Number.isInteger(c.slot) ? c.slot : -1,
      books: cleanBooks(c.books),
      lists: (c.lists || []).filter(l => l && l.id).map(l => ({ id: String(l.id), title: String(l.title || 'Playlist').slice(0, 160) })),
      videos: (c.videos || []).filter(v => v && v.id).slice(0, MAX_VIDEOS).map(v => ({ id: String(v.id), kind: v.kind === 'l' ? 'l' : v.kind === 'r' ? 'r' : v.kind === 'p' ? 'p' : 'v', title: String(v.title || ''), author: String(v.author || ''), thumb: /^(data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+|https:\/\/[^\s"'<>]+)$/.test(v.thumb || '') && String(v.thumb).length <= 60000 ? v.thumb : '', src: v.kind === 'p' && /^[a-f0-9]{24}$/.test(String(v.src || '')) ? String(v.src) : '', w: Math.max(0, Math.min(100000, Math.round(+v.w) || 0)), h: Math.max(0, Math.min(100000, Math.round(+v.h) || 0)), dur: +v.dur || 0, at: +v.at || 0, list: String(v.list || ''), done: v.done === true, note: String(v.note || '').replace(/[<>]/g, '').slice(0, 2000),
        ts: (v.ts || []).filter(x => x && x.t >= 0).map(x => ({ t: +x.t, l: String(x.l || '').slice(0, 80) })).sort((a, b) => a.t - b.t) })) }));
  }
  function cleanBooks(list) {
    const seen = new Set();
    return (Array.isArray(list) ? list : []).filter(b => { if (!b || !BID.test(String(b.id || '')) || !b.title || seen.has(b.id)) return false; seen.add(b.id); return true; }).slice(0, MAX_BOOKS).map(b => ({
      id: String(b.id), title: String(b.title).slice(0, 160), authors: String(b.authors || '').slice(0, 120), cover: typeof b.cover === 'string' && b.cover.length <= 400 && COVER.test(b.cover) ? b.cover : '',
      pages: Math.max(0, Math.min(20000, Math.round(+b.pages) || 0)), at: +b.at || 0 }));
  }
  function placeSlots(list) {   /* every creator gets their own stand on the map */
    const used = new Set();
    list.forEach(c => { if (c.slot < 0 || c.slot >= SLOTS || used.has(c.slot)) c.slot = -1; else used.add(c.slot); });
    list.forEach(c => { if (c.slot < 0) { let i = 0; while (used.has(i) && i < SLOTS) i++; c.slot = i < SLOTS ? i : 0; used.add(c.slot); } });
    return list;
  }
  /* ---- reel & video folders: shaped like a creator (name, videos, lists) so the same link-dropping, cards and ticks work inside them ---- */
  const MAX_FOLDERS = 60;
  const FOLDER_COLS = [
    { n: 'Forest', a: '#86ad54', b: '#3f6a2a', c: '#f1f3cf' }, { n: 'Copper', a: '#dc9f5e', b: '#8f5424', c: '#fcebcb' },
    { n: 'Wine', a: '#c06257', b: '#6e2a2a', c: '#f8e0cf' }, { n: 'River', a: '#5fb0ad', b: '#276a6e', c: '#e2f5ef' },
    { n: 'Plum', a: '#a182b6', b: '#523a6a', c: '#f1e6f5' }, { n: 'Gold', a: '#e4c460', b: '#9a7324', c: '#fff4c8' }
  ];
  const flipSet = new Set();   /* reels (in folders) that are turned over right now */
  let noteT = 0;
  const typing = () => { const a = document.activeElement; return !!(a && a.classList && a.classList.contains('rnote')); };
  let foSync = false;   /* folders are sent to the server only once they were loaded (or made), so an old device can never wipe them */
  function cleanFolders(list) {
    const src = (Array.isArray(list) ? list : []).filter(f => f && f.id && f.name), col = {};
    src.forEach(f => { col[f.id] = clamp(Math.round(+f.col) || 0, 0, FOLDER_COLS.length - 1); });
    return clean(src.map(f => ({ ...f, hall: 'self', slot: -1 })), MAX_FOLDERS).map(c => ({ id: c.id, name: c.name, col: col[c.id] || 0, at: c.at, lists: c.lists, videos: c.videos, hall: 'self', note: '', img: '', slot: -1, books: c.books || [], fo: true }));
  }
  function saveLocal(dirty) { try { localStorage.setItem(lkey(), JSON.stringify({ dirty: !!dirty, creators, folders })); } catch (e) {} }
  const strip = c => ({ id: c.id, name: c.name, hall: c.hall, note: c.note, at: c.at, img: c.img, slot: c.slot, lists: c.lists, books: c.books, videos: c.videos.map(v => ({ id: v.id, kind: v.kind, title: v.title === 'Loading…' ? '' : v.title, author: v.author, dur: v.dur, at: v.at, list: v.list, ts: v.ts, done: !!v.done, thumb: v.thumb || '', src: v.src || '', w: v.w || 0, h: v.h || 0, note: v.note || '' })) });
  const stripF = f => { const s = strip(f); return { id: s.id, name: s.name, col: f.col || 0, at: s.at, lists: s.lists, videos: s.videos, books: s.books }; };
  async function pushServer() {
    clearTimeout(saveT); saveT = 0;
    const A = api(); if (!A || !A.saveMuseum || !token()) { setStatus('Saved on this device'); return; }
    if (saving) { again = true; return; }
    saving = true;
    /* the levels and the folders are saved one after the other, and one failing never stops the other (books live in the folders) */
    let bad = '';
    try { await A.saveMuseum(creators.map(strip)); } catch (e) { bad = (e && e.message) || 'error'; }
    try { if (A.saveFolders && (foSync || folders.length)) await A.saveFolders(folders.map(stripF)); } catch (e) { bad = (e && e.message) || 'error'; }
    if (!bad) { saveLocal(false); setStatus('All saved'); }
    else { setStatus('Saved on this device'); toast('Could not save to the server (' + String(bad).slice(0, 80) + '). Your changes are kept on this device and will be sent again.'); }
    saving = false;
    if (again) { again = false; pushServer(); }
  }
  function changed() { notify(); saveLocal(true); clearTimeout(saveT); saveT = setTimeout(pushServer, 800); setStatus('Saving…'); }
  let stT = 0;
  function setStatus(t) { if (!statusEl) return; statusEl.textContent = t; clearTimeout(stT); if (t) stT = setTimeout(() => { statusEl.textContent = ''; }, 2200); }
  function toast(m) { if (!toastEl) return; toastEl.textContent = m; toastEl.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove('on'), 4200); }
  async function load() {
    const my = ++loadSeq; let local = null;
    try { local = JSON.parse(localStorage.getItem(lkey()) || 'null'); } catch (e) {}
    if (local && Array.isArray(local.creators)) { creators = placeSlots(clean(local.creators)); if (Array.isArray(local.folders)) { folders = cleanFolders(local.folders); foSync = true; } paint(); resumeInfo(); notify(); }
    const A = api(); if (!A || !A.getMuseum || !token()) return;
    try {
      const srv = await A.getMuseum();
      let sf = null; if (A.getFolders) { try { sf = await A.getFolders(); } catch (e) {} }
      if (my !== loadSeq || !(isOpen || mapWatch)) return;
      if (local && local.dirty) { pushServer(); return; }
      creators = placeSlots(clean(srv)); if (Array.isArray(sf)) { folders = cleanFolders(sf); foSync = true; } saveLocal(false); if (screen !== 'folders' && (!curId || !cur())) { screen = 'lobby'; curId = ''; } paint(); resumeInfo(); notify();
    } catch (e) {}
  }

  /* ------------------------------------------------------------ details of videos (title, channel, length, chapters) */
  const queue = []; let running = 0;
  function resolveLater(v) { if (v.kind !== 'v' || v._q) return; v._q = 1; queue.push(v); pump(); }
  function pump() { while (running < 4 && queue.length) { const v = queue.shift(); running++; resolveInfo(v).finally(() => { running--; v._q = 0; pump(); }); } }
  const dq = []; let drun = 0;
  function durLater(v) { if (v.kind !== 'v' || v.dur || v._d || v._df) return; v._d = 1; dq.push(v); dpump(); }
  function dpump() {
    while (drun < 2 && dq.length) {
      const v = dq.shift(); drun++;
      probeDur(v).then(d => {
        if (d > 0) {
          v.dur = Math.round(d); changed();
          const y = isOpen && screen === 'creator' && bodyEl.querySelector('.yc[data-v="' + vk(v) + '"] .yt');
          if (y && !y.querySelector('.dur')) { const e = mk('span', 'dur', fmt(v.dur)); y.appendChild(e); }
        } else v._df = 1;
      }).catch(() => { v._df = 1; }).finally(() => { drun--; v._d = 0; dpump(); });
    }
  }
  async function probeDur(v) {
    await ytReady();
    return new Promise(res => {
      const host = mk('div'); host.style.cssText = 'position:fixed;left:-9999px;top:0;width:200px;height:120px;overflow:hidden'; const inner = mk('div'); host.appendChild(inner); document.body.appendChild(host);
      let done = false, p = null, t = 0;
      const fin = d => { if (done) return; done = true; clearInterval(t); try { p && p.destroy(); } catch (e) {} host.remove(); res(d); };
      p = new window.YT.Player(inner, { width: 200, height: 120, videoId: v.id, playerVars: { controls: 0, mute: 1 }, events: {
        onReady: () => { let n = 0; t = setInterval(() => { let d = 0; try { d = p.getDuration(); } catch (e) {} if (d > 1) fin(d); else if (++n > 28) fin(0); }, 250); },
        onError: () => fin(0) } });
      setTimeout(() => fin(0), 10000);
    });
  }
  function resumeInfo() { creators.concat(folders).forEach(c => c.videos.forEach(durLater));  creators.concat(folders).forEach(c => c.videos.forEach(v => { if (v.kind === 'v' && (!v.title || v.title === 'Loading…')) resolveLater(v); })); }
  async function resolveInfo(v) {
    let info = null; const A = api();
    try { if (A && A.museumInfo && token()) info = await A.museumInfo(v.id); } catch (e) {}
    if (!info) { try { const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + v.id)); if (r.ok) { const j = await r.json(); info = { title: j.title, author: j.author_name, dur: 0, chapters: [] }; } } catch (e) {} }
    if (!info) { if (!v.title || v.title === 'Loading…') v.title = 'YouTube video'; }
    else {
      v.title = String(info.title || v.title || 'YouTube video').slice(0, 160); v.author = String(info.author || v.author || '').slice(0, 80);
      if (info.dur) v.dur = info.dur;
      if (info.chapters && info.chapters.length && !v.ts.length) v.ts = info.chapters.slice(0, 80).map(x => ({ t: +x.t, l: String(x.l || '').slice(0, 80) }));
    }
    changed(); if (isOpen) refreshCards();
  }
  function refreshCards() { if (typing()) return; if (screen === 'creator' && ctab === 'books') return; if (screen === 'creator' || screen === 'folders') paintBody(); else if (screen === 'lobby') paintBody(); }

  /* ------------------------------------------------------------ photos dropped into a folder */
  const MAX_PHOTO_CHARS = 55000;
  function readPhoto(file) {   /* an image file -> a small jpeg data url (keeps its shape, longest side 640px) */
    return new Promise(res => {
      if (!file || !/^image\/(jpeg|png|webp|gif|bmp)/.test(file.type)) { res(''); return; }
      const rd = new FileReader();
      rd.onerror = () => res('');
      rd.onload = () => {
        const im = new Image();
        im.onerror = () => res('');
        im.onload = () => {
          let S = 640, q = .8, out = '';
          for (let k = 0; k < 6; k++) {
            const r = Math.min(1, S / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(im.width * r)); cv.height = Math.max(1, Math.round(im.height * r));
            const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(im, 0, 0, cv.width, cv.height);
            out = cv.toDataURL('image/jpeg', q);
            if (out.length <= MAX_PHOTO_CHARS) break;
            q = Math.max(.45, q - .1); S = Math.round(S * .8);
          }
          res(out.length <= MAX_PHOTO_CHARS ? out : '');
        };
        im.src = rd.result;
      };
      rd.readAsDataURL(file);
    });
  }
  /* a photo keeps its ORIGINAL file (uploaded untouched). Only when nobody is logged in is it kept small on this device, because the browser cannot hold big files. */
  const LOW_PX = 900;   /* a photo whose longest side is shorter than this turns blurry when it is blown up, so it is shown in a small box instead */
  const photoSrc = v => { const A = api(); return v.src ? (A && A.museumPhotoUrl ? A.museumPhotoUrl(v.src) : '/api/museum/photos/' + v.src) : (v.thumb || ''); };
  const photoLow = v => !!(v.w && v.h && Math.max(v.w, v.h) < LOW_PX);
  const photoAR = v => v.w && v.h ? clamp(v.w / v.h, .4, 2.5) : 0;
  function readDims(file) {
    return new Promise(res => {
      const u = URL.createObjectURL(file), im = new Image();
      im.onload = () => { res({ w: im.naturalWidth, h: im.naturalHeight }); URL.revokeObjectURL(u); };
      im.onerror = () => { res(null); URL.revokeObjectURL(u); };
      im.src = u;
    });
  }
  function dimsOfData(url) { return new Promise(res => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => res(null); im.src = url; }); }
  async function addPhotos(files, c) {
    const imgs = Array.from(files || []).filter(f => f && /^image\//.test(f.type));
    if (!imgs.length) { toast('That is not a picture file.'); return 0; }
    const A = api(), online = !!(A && A.uploadMuseumPhoto && token());
    let n = 0, bad = 0, why = '';
    for (const f of imgs.slice(0, 20)) {
      if (c.videos.length >= MAX_VIDEOS) { toast('This folder is full (' + MAX_VIDEOS + ' items).'); break; }
      const v = { id: '', kind: 'p', title: String(f.name || '').replace(/\.[A-Za-z0-9]{2,5}$/, '').replace(/[<>]/g, '').slice(0, 80), author: '', thumb: '', src: '', w: 0, h: 0, dur: 0, at: Date.now(), list: '', ts: [], done: false, note: '' };
      if (online) {
        const dm = await readDims(f);
        if (!dm) { bad++; continue; }
        try { const r = await A.uploadMuseumPhoto(f); v.src = String(r.id); v.id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); v.w = dm.w; v.h = dm.h; }
        catch (e) { bad++; why = e && e.message || ''; continue; }
      } else {
        const data = await readPhoto(f); if (!data) { bad++; continue; }
        const dm = await dimsOfData(data); v.thumb = data; v.w = dm ? dm.w : 0; v.h = dm ? dm.h : 0; v.id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      }
      c.videos.unshift(v); n++;
    }
    if (n) { snd('confirm'); toast((n === 1 ? 'Photo added to “' + c.name + '”.' : n + ' photos added to “' + c.name + '”.') + (online ? '' : ' (Log in to keep photos at full quality.)')); }
    if (bad) toast(why || (bad === 1 ? 'One picture could not be read.' : bad + ' pictures could not be read.'));
    if (n) { changed(); paint(); }
    return n;
  }
  function dropPhotoFile(v) { const A = api(); if (v && v.kind === 'p' && v.src && A && A.deleteMuseumPhoto && token()) A.deleteMuseumPhoto(v.src); }
  /* the big view: a sharp photo fills the screen as it is (nothing cropped); a low-resolution one stays in a small box at its real size */
  function viewPhoto(key) {
    const c = cur(), v = c && c.videos.find(x => vk(x) === key); if (!v) return; const url = photoSrc(v); if (!url) return;
    const el = mk('div', 'ph-view', '<img src="' + esc(url) + '" alt="' + esc(v.title || '') + '" draggable="false">'); if (photoLow(v)) el.classList.add('lo');
    el.addEventListener('click', () => el.remove()); stage.appendChild(el); snd('select');
  }
  /* once a photo has loaded its real shape is known: the box follows it, and a small photo goes into the small box */
  function photoLoaded(img) {
    const bc = img.closest && img.closest('.bk.ph .bc'); if (!bc || !img.naturalWidth) return;
    const c = cur(), key = bc.dataset.v, v = c && c.videos.find(x => vk(x) === key); if (!v) return;
    if (!v.w || !v.h) { v.w = img.naturalWidth; v.h = img.naturalHeight; changed(); }
    const card = bc.closest('.bk'); applyPhotoShape(card, v);
  }
  function applyPhotoShape(card, v) {
    const ar = photoAR(v); if (!card || !ar) return; const bc = card.querySelector('.bc');
    bc.style.setProperty('--ar', ar.toFixed(4)); card.classList.toggle('land', ar > 1.08); card.classList.toggle('sq', ar >= .92 && ar <= 1.08); card.classList.toggle('lo', photoLow(v));
  }

  /* ------------------------------------------------------------ adding creators and videos */
  async function addLinks(text, c) {
    const found = parseLinks(text);
    if (!found.length) { toast('I could not find a YouTube video, playlist or Instagram reel link in that.'); return 0; }
    let added = 0, dup = 0;
    for (const f of found) {
      if (f.kind === 'r') {
        if (c.videos.some(v => v.kind === 'r' && v.id === f.id)) { dup++; continue; }
        if (c.videos.length >= MAX_VIDEOS) { toast((c.fo ? 'This folder' : 'This creator’s wall') + ' is full (' + MAX_VIDEOS + ' videos).'); break; }
        const v = { id: f.id, kind: 'r', title: '', author: '', thumb: '', dur: 0, at: Date.now(), list: '', ts: [] };
        c.videos.unshift(v); added++; reelLater(v);
      } else if (f.kind === 'v') {
        if (c.videos.some(v => v.kind === 'v' && v.id === f.id)) { dup++; continue; }
        if (c.videos.length >= MAX_VIDEOS) { toast((c.fo ? 'This folder' : 'This creator’s wall') + ' is full (' + MAX_VIDEOS + ' videos).'); break; }
        const v = { id: f.id, kind: 'v', title: 'Loading…', author: '', dur: 0, at: Date.now(), list: '', ts: f.at > 0 ? [{ t: f.at, l: 'Saved from the link' }] : [] };
        c.videos.unshift(v); added++; resolveLater(v);
      } else added += await addPlaylist(f.id, c);
    }
    if (added) { snd('confirm'); toast(added === 1 ? 'Added to ' + (c.fo ? '“' + c.name + '”' : c.name + '’s wall') + '.' : added + ' videos added to ' + (c.fo ? '“' + c.name + '”' : c.name + '’s wall') + '.'); }
    else if (dup) toast(dup === 1 ? 'That video is already here.' : 'Those videos are already here.');
    changed(); paint(); return added;
  }
  /* an Instagram reel: the server reads its picture, title and username from the public page; if Instagram says no, the little pen on the reel lets you type them in */
  let reelT = 0;   /* a single click opens the reel after a moment, so a double-click can edit instead */
  const IGLINK = id => 'https://www.instagram.com/reel/' + id + '/';
  async function reelLater(v) {
    if (v._rq) return; v._rq = 1; const A = api(); let ok = false;
    try { if (A && A.museumReel && token()) { const r = await A.museumReel(v.id); if (r && r.thumb) { v.thumb = r.thumb; ok = true; } } } catch (e) {}
    if (!v.thumb) v.thumb = 'https://www.instagram.com/reel/' + v.id + '/media/?size=l';
    changed(); if (isOpen && !typing() && ((screen === 'creator' && ctab === 'videos') || screen === 'folders')) paintBody();
    if (!ok) toast('Instagram did not share the reel’s picture. Double-click the reel to choose one yourself.');
  }
  async function addPlaylist(listId, c) {
    if (c.lists.some(l => l.id === listId)) { toast('That playlist is already here.'); return 0; }
    const A = api(); let items = null, title = '';
    toast('Reading the playlist…');
    try { if (A && A.museumPlaylist && token()) { const r = await A.museumPlaylist(listId); items = r.items; title = r.title || ''; } } catch (e) {}
    if (!items) {
      try { const ids = await playlistViaPlayer(listId); items = ids.map(id => ({ id, title: '', author: '', dur: 0 })); } catch (e) {}
    }
    if (!title) { try { const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/playlist?list=' + listId)); if (r.ok) title = (await r.json()).title || ''; } catch (e) {} }
    title = (title || 'Playlist').slice(0, 160);
    if (!items || !items.length) {   /* the page could not read it: keep it as one playlist that plays inside the museum */
      if (c.videos.some(v => v.kind === 'l' && v.id === listId)) return 0;
      c.videos.unshift({ id: listId, kind: 'l', title, author: '', dur: 0, at: Date.now(), list: '', ts: [] });
      toast('I could not list that playlist’s videos, so it is saved as one playlist you can play here.');
      return 1;
    }
    c.lists.push({ id: listId, title });
    let n = 0; const room = MAX_VIDEOS - c.videos.length;
    items.slice(0, room).forEach(it => {
      if (!VID.test(it.id) || c.videos.some(v => v.kind === 'v' && v.id === it.id)) return;
      const v = { id: it.id, kind: 'v', title: it.title || 'Loading…', author: it.author || '', dur: it.dur || 0, at: Date.now() - n, list: listId, ts: [] };
      c.videos.push(v); n++; if (!it.title || !it.author) resolveLater(v);
    });
    if (items.length > room) toast('Only the first ' + room + ' videos fit on the wall.');
    return n;
  }

  /* ------------------------------------------------------------ build */
  function build() {
    if (!document.getElementById('gb-fonts')) { const l = mk('link'); l.id = 'gb-fonts'; l.rel = 'stylesheet'; l.href = FONT_LINK; document.head.appendChild(l); }
    root = mk('div'); root.id = 'mu'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Creators Museum');
    root.innerHTML = '<div class="mu-blur"></div><div id="mu-stage"><div class="mu-wall"></div>' +
      '<div id="mu-top"></div><div id="mu-halls"></div><div id="mu-body"></div><div id="mu-status" aria-live="polite"></div>' +
      '<div id="mu-drop"><div><b>Drop it here</b><span></span></div></div><div id="mu-modal"></div><div id="mu-toast" role="status"></div></div>';
    document.body.appendChild(root);
    stage = $('#mu-stage', root); topEl = $('#mu-top', root); hallsEl = $('#mu-halls', root); bodyEl = $('#mu-body', root); modalEl = $('#mu-modal', root); dropEl = $('#mu-drop', root); toastEl = $('#mu-toast', root); statusEl = $('#mu-status', root);
    root.addEventListener('click', onClick);
    root.addEventListener('load', ev => { if (ev.target && ev.target.tagName === 'IMG') photoLoaded(ev.target); }, true);
    root.addEventListener('dblclick', e => {
      const hot = e.target.closest && e.target.closest('.fhot'); if (hot) { e.preventDefault(); flipReel(hot.closest('.rlf')); return; }
      const t = e.target.closest && e.target.closest('.bk.rl .bt.rt'); if (t) { editReelTitle(t); return; }
      const cv = e.target.closest && e.target.closest('.bk.rl:not(.ph) .bc'); if (cv) { clearTimeout(reelT); openReelModal(cv.closest('.bk').dataset.v); }
    });
    root.addEventListener('change', ev => { if (ev.target.id === 'mu-photos') { const c = cur(); if (c && c.fo) addPhotos(ev.target.files, c); ev.target.value = ''; return; } if (ev.target.id === 'mu-file') { takeImage(ev.target.files[0]); ev.target.value = ''; } });
    root.addEventListener('input', ev => {
      if (ev.target.id === 'mu-name') paintPic();
      else if (ev.target.classList && ev.target.classList.contains('rnote')) noteInput(ev.target);
      else if (ev.target.id === 'mu-bq') { clearTimeout(bT); const q = ev.target.value.trim(); if (q.length >= 3) bT = setTimeout(doSearch, 700); else if (!q.length) { bseq++; bres = { q: '', items: [], st: 'idle', err: '' }; paintResults(); } }
    });
    root.addEventListener('focusout', ev => { if (ev.target.classList && ev.target.classList.contains('rnote') && noteT) { clearTimeout(noteT); noteT = 0; changed(); } if (ev.target.classList && ev.target.classList.contains('pgin')) setTimeout(() => { if (ev.target.isConnected) savePages(ev.target); }, 0); });
    root.addEventListener('keydown', ev => {
      if (ev.target.id === 'mu-link' && ev.key === 'Enter') { ev.preventDefault(); doAddLink(); }
      else if (ev.target.id === 'mu-bq' && ev.key === 'Enter') { ev.preventDefault(); doSearch(); }
      else if (ev.target.classList && ev.target.classList.contains('pgin') && ev.key === 'Enter') { ev.preventDefault(); ev.target.blur(); }
      else if (ev.target.id === 'mu-name' && ev.key === 'Enter') { ev.preventDefault(); saveCreator(); }
      else if (ev.target.id === 'mu-fname' && ev.key === 'Enter') { ev.preventDefault(); saveFolder(); }
    });
    /* drag a video (or its link) from the YouTube website and drop it anywhere on the museum */
    let depth = 0, hiF = null;
    const hiFolder = ev => { const els = document.elementsFromPoint(ev.clientX, ev.clientY), el = els.map(e => e.closest && e.closest('.fd[data-f]')).find(Boolean) || null; if (el !== hiF) { if (hiF) hiF.classList.remove('drop'); hiF = el; if (el) el.classList.add('drop'); } return el; };
    const clearHi = () => { if (hiF) hiF.classList.remove('drop'); hiF = null; };
    const has = ev => { if (ev.target && ev.target.closest && ev.target.closest('.rnote')) return false; const t = ev.dataTransfer && ev.dataTransfer.types; if (t && Array.from(t).indexOf('Files') >= 0 && (modalEl.classList.contains('on') || screen === 'folders' || (screen === 'creator' && cur() && cur().fo))) return true; return !!t && ['text/uri-list', 'text/plain', 'text/html', 'text/x-moz-url'].some(k => Array.from(t).indexOf(k) >= 0); };
    root.addEventListener('dragenter', ev => { if (!isOpen || !has(ev)) return; depth++; showDrop(true); });
    root.addEventListener('dragover', ev => { if (!isOpen || !has(ev)) return; ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; if (screen === 'folders') hiFolder(ev); });
    root.addEventListener('dragleave', ev => { if (!isOpen || !has(ev)) return; if (--depth <= 0) { depth = 0; showDrop(false); clearHi(); } });
    root.addEventListener('drop', ev => {
      if (!isOpen) return; depth = 0; showDrop(false); clearHi();
      const fl = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (fl && modalEl.classList.contains('on')) { ev.preventDefault(); takeImage(fl); return; }
      if (fl && !modalEl.classList.contains('on')) {   /* photos: onto a folder, or into the folder that is open */
        const files = ev.dataTransfer.files;
        if (screen === 'folders') { ev.preventDefault(); const els = document.elementsFromPoint(ev.clientX, ev.clientY), el = els.map(e => e.closest && e.closest('.fd[data-f]')).find(Boolean), f = el && folders.find(x => x.id === el.dataset.f); if (f) addPhotos(files, f); else toast('Drop the photo right onto a folder.'); return; }
        const oc = cur(); if (screen === 'creator' && oc && oc.fo) { ev.preventDefault(); ctab = 'videos'; addPhotos(files, oc); return; }
      }
      if (!has(ev)) return; ev.preventDefault();
      const dt = ev.dataTransfer, txt = [dt.getData('text/uri-list'), dt.getData('text/x-moz-url'), dt.getData('text/plain'), dt.getData('text/html')].filter(Boolean).join('\n');
      if (screen === 'folders') { const els = document.elementsFromPoint(ev.clientX, ev.clientY), el = els.map(e => e.closest && e.closest('.fd[data-f]')).find(Boolean), f = el && folders.find(x => x.id === el.dataset.f); if (f) { if (!parseLinks(txt).length) { toast('That does not look like a YouTube video or an Instagram reel.'); return; } addLinks(txt, f); } else toast('Drop it right onto a folder, or open a folder and drop it there.'); return; }
      takeText(txt);
    });
    document.addEventListener('paste', ev => {
      if (!isOpen || (ev.target.closest && ev.target.closest('input,textarea'))) return;
      const t = ev.clipboardData && ev.clipboardData.getData('text/plain'); if (t) { ev.preventDefault(); takeText(t); }
    });
    addEventListener('resize', fit);
    addEventListener('keydown', onKey, true);
    addEventListener('pagehide', () => { if (isOpen && saveT) saveLocal(true); });
    built = true;
  }
  function showDrop(on) {
    if (!dropEl) return; const c = cur();
    if (screen === 'folders') { dropEl.classList.remove('on'); return; }   /* on the folders page the folders themselves light up instead of a dark curtain */
    $('span', dropEl).textContent = screen === 'lobby' ? 'to start a new creator with it' : c && c.fo ? 'to add it to “' + c.name + '”' : 'to add it to ' + (c ? c.name : 'this creator');
    dropEl.classList.toggle('on', on);
  }
  function takeText(txt) {
    if (modalEl.classList.contains('on')) { const f = $('#mu-first', modalEl); if (f) { f.value = (f.value ? f.value + '\n' : '') + txt.trim().split(/\n/)[0]; } return; }
    if (!parseLinks(txt).length) { toast('That does not look like a YouTube video, playlist or Instagram reel.'); return; }
    if (screen === 'folders') { toast('Drop it right onto a folder, or open a folder first.'); return; }
    const c = cur();
    if (screen === 'lobby' || !c) { openModal(null, txt.trim().split(/\n/)[0]); toast('Who is this video from? Add the creator first.'); return; }
    ctab = 'videos'; addLinks(txt, c);
  }
  function fit() { scale = Math.min(innerWidth / W, innerHeight / H); if (stage) stage.style.setProperty('--s', scale); }

  /* ------------------------------------------------------------ painting */
  function paint() {
    if (!built) return;
    if (fromMap && screen === 'lobby' && !modalEl.classList.contains('on')) { close(); return; }
    fit();
    const c = cur();
    root.dataset.screen = screen; root.dataset.tab = ctab;
    /* top bar */
    if (screen === 'folders') {
      topEl.innerHTML = '<button type="button" class="ab esc" data-a="lobby"><span class="t">World map</span><kbd>ESC</kbd></button>' +
        '<button type="button" class="ab nf" data-a="newf"><span class="t">' + IC.plus + 'Folder</span></button>';
    } else if (screen === 'lobby') {
      topEl.innerHTML = '<button type="button" class="mu-btn back" data-a="close">' + IC.back + 'Back to the Grove<kbd>ESC</kbd></button>';
    } else {
      const h = HALLS[c ? c.hall : 'self'];
      topEl.innerHTML = '<button type="button" class="ab esc" data-a="' + (c && c.fo ? 'folders' : 'lobby') + '"><span class="t">' + (c && c.fo ? 'Media Log' : fromMap ? 'World map' : 'Museum') + '</span><kbd>ESC</kbd></button>' +
        '<button type="button" class="ab edit" data-a="' + (c && c.fo ? 'editf' : 'editc') + '"><span class="t">Edit</span></button>';
    }
    hallsEl.style.display = 'none';
    paintBody();
  }
  const seal = k => '<i class="seal" style="--hc:' + HALLS[k].c + '" aria-label="' + HALLS[k].n + '">' + IC.hall(k) + '</i>';
  function cover(c) {
    const v = c.videos.find(x => x.kind === 'v');
    return v ? '<img class="pic" src="' + thumb(v.id, 'hqdefault') + '" alt="" loading="lazy" draggable="false" onerror="this.style.display=\'none\'">' : '';
  }
  function paintBody() {
    if (bodyEl.dataset.sc !== screen + curId + vKey) { bodyEl.dataset.sc = screen + curId + vKey; bodyEl.scrollTop = 0; }
    bodyEl.classList.remove('lobby', 'creator', 'watch', 'folders'); bodyEl.classList.add(screen);
    if (screen === 'lobby') {
      paintWorld();
      return;
    }
    if (screen === 'folders') { paintFolders(); return; }
    const c = cur(); if (!c) { screen = 'lobby'; paint(); return; }
    paintCreator(c);
  }
  function reelCard(v) {
    const key = esc(vk(v));
    const front = '<div class="bk rl' + (v.done ? ' seen' : '') + '" data-v="' + key + '"><button type="button" class="wk' + (v.done ? ' on' : '') + '" data-a="done" data-v="' + key + '" aria-pressed="' + !!v.done + '" data-tip="' + (v.done ? 'Watched. Click to undo' : 'Mark as watched') + '" aria-label="Mark as watched">' + IC.check + '</button>' +
      '<span class="bc" data-a="reel" data-v="' + key + '"><span class="bph">' + IC.reel + '</span>' + (v.thumb ? '<img src="' + esc(v.thumb) + '" alt="" loading="lazy" draggable="false" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">' : '') + '</span>' +
      '<div class="bm"><b class="bt rt" data-v="' + key + '">' + esc(v.title && v.title !== 'Instagram reel' ? v.title : '') + '</b>' +
      (rmMode ? '<button type="button" class="rm" data-a="rmv" data-v="' + key + '" aria-label="Remove reel">' + IC.x + '</button>' : '') + '</div></div>';
    const c = cur(); return c && c.fo ? flipWrap(front, key, v, 'bk') : front;
  }
  /* in a folder every reel and YouTube video has two sides: double-click the (invisible) top-right corner of its box to turn it over; the back is a blank page for notes */
  function flipWrap(front, key, v, cls) {
    return '<div class="rlf' + (flipSet.has(vk(v)) ? ' flipped' : '') + '" data-v="' + key + '"><div class="rli">' + front.slice(0, -6) + '<span class="fhot" aria-hidden="true"></span></div>' +
      '<div class="' + cls + ' rb" data-v="' + key + '"><textarea class="rnote" data-v="' + key + '" maxlength="2000" spellcheck="true" aria-label="Your notes">' + esc(v.note || '') + '</textarea><span class="fhot" aria-hidden="true"></span></div></div></div>';
  }
  function flipReel(w) {
    if (!w) return; const k = w.dataset.v, on = !w.classList.contains('flipped'); w.classList.toggle('flipped', on); on ? flipSet.add(k) : flipSet.delete(k); snd('flip');
    const ta = w.querySelector('.rnote'); if (!ta) return;
    if (on) setTimeout(() => { if (w.classList.contains('flipped')) ta.focus({ preventScroll: true }); }, 450); else ta.blur();
  }
  function noteInput(ta) {
    const c = cur(), v = c && c.videos.find(x => vk(x) === ta.dataset.v); if (!v) return;
    v.note = ta.value.slice(0, 2000); clearTimeout(noteT); noteT = setTimeout(() => { noteT = 0; changed(); }, 400);
  }
  /* double-click the empty space under a reel to give it a title; double-click its picture to choose another picture */
  function editReelTitle(el) {
    const c = cur(), v = c && c.videos.find(x => vk(x) === el.dataset.v); if (!v || el.querySelector('input')) return;
    const inp = document.createElement('input'); inp.type = 'text'; inp.className = 'rt-in'; inp.maxLength = 80; inp.value = v.title || ''; inp.setAttribute('aria-label', 'Reel title');
    el.textContent = ''; el.appendChild(inp); inp.focus(); inp.select(); let done = false;
    const end = save => { if (done) return; done = true; if (save) { v.title = inp.value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80); changed(); } paintBody(); };
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') end(true); else if (e.key === 'Escape') end(false); });
    inp.addEventListener('blur', () => end(true));
  }
  function photoCard(v) {
    const key = esc(vk(v)), ar = photoAR(v), src = photoSrc(v);
    const cls = 'bk rl ph' + (v.done ? ' seen' : '') + (ar > 1.08 ? ' land' : ar && ar >= .92 ? ' sq' : '') + (photoLow(v) ? ' lo' : '');
    const front = '<div class="' + cls + '" data-v="' + key + '"><button type="button" class="wk' + (v.done ? ' on' : '') + '" data-a="done" data-v="' + key + '" aria-pressed="' + !!v.done + '" data-tip="' + (v.done ? 'Seen. Click to undo' : 'Mark as seen') + '" aria-label="Mark as seen">' + IC.check + '</button>' +
      '<span class="bc" data-a="photo" data-v="' + key + '"' + (ar ? ' style="--ar:' + ar.toFixed(4) + '"' : '') + '>' + (src ? '<img src="' + esc(src) + '" alt="" loading="lazy" draggable="false">' : '') + '</span>' +
      '<div class="bm"><b class="bt rt" data-v="' + key + '" title="Double-click to rename">' + esc(v.title || '') + '</b>' +
      (rmMode ? '<button type="button" class="rm" data-a="rmv" data-v="' + key + '" aria-label="Remove photo">' + IC.x + '</button>' : '') + '</div></div>';
    const c = cur(); return c && c.fo ? flipWrap(front, key, v, 'bk') : front;
  }
  function card(v, c) {
    if (v.kind === 'p') return photoCard(v);
    if (v.kind === 'r') return reelCard(v);
    const pl = v.kind === 'l';
    const front = '<div class="yc' + (v.done ? ' seen' : '') + '" data-v="' + esc(vk(v)) + '"><button type="button" class="wk' + (v.done ? ' on' : '') + '" data-a="done" data-v="' + esc(vk(v)) + '" aria-pressed="' + !!v.done + '" data-tip="' + (v.done ? 'Watched. Click to undo' : 'Mark as watched') + '" aria-label="Mark as watched">' + IC.check + '</button><button type="button" class="yt" data-a="watch" data-v="' + esc(vk(v)) + '" aria-label="Play ' + esc(v.title || 'video') + '">' +
      (pl ? '<span class="plph">' + IC.list + '</span>' : '<img src="' + thumb(v.id) + '" alt="" loading="lazy" draggable="false" onerror="this.style.visibility=\'hidden\'">') +
      (v.dur ? '<span class="dur">' + fmt(v.dur) + '</span>' : '') + (pl ? '<span class="dur pl">PLAYLIST</span>' : '') + (v.ts.length ? '<span class="nts">' + IC.clock + v.ts.length + '</span>' : '') + '<span class="pp">' + IC.play + '</span></button>' +
      (rmMode ? '<button type="button" class="rm" data-a="rmv" data-v="' + esc(vk(v)) + '" aria-label="Remove video">' + IC.x + '</button>' : '') +
      '<div class="ym"><b class="ytt">' + esc(v.title || 'Loading…') + '</b><span class="yau">' + esc(v.author || (pl ? 'Playlist' : '')) + '</span></div></div>';
    const fc = cur(); return fc && fc.fo ? flipWrap(front, esc(vk(v)), v, 'yc') : front;
  }
  const tabsHTML = c => (c.fo ? folderTitle(c) + '<div class="fo-tabs">' : '') + '<button type="button" class="ab tab vid' + (ctab === 'videos' ? ' on' : '') + '" data-a="tab" data-t="videos"><span class="t">Videos</span><em>' + c.videos.length + '</em></button><button type="button" class="ab tab bk' + (ctab === 'books' ? ' on' : '') + '" data-a="tab" data-t="books"><span class="t">Books</span><em>' + c.books.length + '</em></button>' + (c.fo ? '</div>' : '') + (rmMode && !c.fo ? '<div class="rmbar"><span>' + IC.trash + 'Remove mode: click the red ✕ on anything you want to take away.</span><button type="button" class="rmdone" data-a="rmdone">Done</button></div>' : '');
  const paintTabs = c => { const t = $('.mu-tabs', bodyEl); if (t) t.innerHTML = tabsHTML(c); };

  /* ------------------------------------------------------------ levels: every creator stand is a level; ticking videos lights the stone paths on the world map */
  const TR = window.MUSEUM_TRAIL || { levels: NODES.map((n, i) => i), nodes: [], edges: [] };
  const LV = TR.levels, LVL_OF = {}; LV.forEach((n, k) => { LVL_OF[n] = k + 1; });
  const levelOf = c => (c && LVL_OF[c.slot]) || 0;
  const OPEN_AT_ONCE = 3;                                                     /* levels you may fill at the same time */
  const doneLevels = () => creators.filter(c => c.videos.length && c.videos.every(v => v.done)).length;
  const unlocked = () => Math.min(LV.length, OPEN_AT_ONCE + doneLevels());   /* levels 1..unlocked are open, in order */
  const slotOpen = n => (LVL_OF[n] || 0) <= unlocked();
  const prog = c => { let d = 0; const t = c ? c.videos.length : 0; if (c) c.videos.forEach(v => { if (v.done) d++; }); return { d, t, f: t ? d / t : 0 }; };
  function progHTML(c) {
    const p = prog(c), L = levelOf(c), pc = Math.round(p.f * 100), more = L && L < LV.length;
    return '<div class="mu-prog' + (p.t && p.d >= p.t ? ' done' : '') + '" id="mu-prog"><span class="lv">Level ' + (L || '?') + '</span><div class="bar"><i style="width:' + pc + '%"></i></div><b>' + p.d + ' / ' + p.t + ' watched</b><small>' +
      (!p.t ? 'Add videos, then tick them off as you watch' : p.d >= p.t ? 'Level complete' + (more ? '. The paths onward are lit' : '. You reached the end of the map') : pc + '% · ' + (p.t - p.d) + ' left' + (more ? ' to light the paths onward' : '')) + '</small></div>';
  }
  const paintProg = () => { const e = $('#mu-prog'), c = cur(); if (e && c) e.outerHTML = progHTML(c); };
  function setDone(c, v, on) {
    if (c.fo) {   /* a folder has no level: the tick only marks what you have watched */
      v.done = !!on; changed(); snd(on ? 'confirm' : 'select');
      document.querySelectorAll('[data-a="done"][data-v="' + vk(v) + '"]').forEach(e => { e.classList.toggle('on', !!on); e.setAttribute('aria-pressed', !!on); const y = e.closest('.yc,.bk.rl'); if (y) y.classList.toggle('seen', !!on); e.dataset.tip = on ? 'Watched. Click to undo' : 'Mark as watched'; });
      return;
    }
    const was = prog(c), wasU = unlocked(); v.done = !!on; const p = prog(c); changed(); snd(on ? 'confirm' : 'select');
    document.querySelectorAll('[data-a="done"][data-v="' + vk(v) + '"]').forEach(e => {
      e.classList.toggle('on', !!on); e.setAttribute('aria-pressed', !!on); const y = e.closest('.yc'); if (y) y.classList.toggle('seen', !!on);
      e.dataset.tip = on ? 'Watched. Click to undo' : 'Mark as watched';
    });
    paintProg();
    if (on && p.t && p.d >= p.t && was.d < p.t) { const L = levelOf(c); toast('Level ' + L + ' complete! ' + (unlocked() > wasU ? 'Level ' + unlocked() + ' is open now. ' : '') + (L < LV.length ? 'The paths onward are lit.' : 'You reached the end of the map.')); }
  }
  function paintCreator(c) {
    if (ctab === 'books') { paintBooks(c); return; }
    const vids = inList(c); vids.forEach(durLater);
    bodyEl.innerHTML = '<div class="mu-tabs">' + tabsHTML(c) + '</div><div class="mu-add vids"><label for="mu-link">' + IC.link + '</label><input id="mu-link" type="text" autocomplete="off" spellcheck="false" placeholder="Paste a YouTube or Instagram reel link, or drag a link or photo here…">' + (c.fo ? '<button type="button" class="ab phb" data-a="pickphoto" aria-label="Add photos from this device"><span class="t">Photo</span></button><input type="file" id="mu-photos" accept="image/*" multiple hidden>' : '') +
      '<button type="button" class="ab addb" data-a="addlink"><span class="t">' + IC.plus + 'Add</span></button></div>' +
      (vids.length ? (vids.some(v => v.kind !== 'r' && v.kind !== 'p') ? '<div class="yg">' + vids.filter(v => v.kind !== 'r' && v.kind !== 'p').map(v => card(v, c)).join('') + '</div>' : '') +
        (vids.some(v => v.kind === 'r' || v.kind === 'p') ? '<div class="bg rg">' + vids.filter(v => v.kind === 'r' || v.kind === 'p').map(v => card(v, c)).join('') + '</div>' : '') :
        '<div class="mu-drop-empty"><div><b>No videos yet</b><p>Open YouTube or Instagram in another tab, then <u>drag a video or reel</u> onto this page (or drop a <u>photo</u> from your computer), paste its link above, or paste a <u>playlist</u> link to bring the whole playlist.</p></div></div>');
  }

  /* ------------------------------------------------------------ books: search Google Books, pick one, it stands on the creator's shelf */
  const coverUrl = il => { const u = il && (il.thumbnail || il.smallThumbnail); if (!u) return ''; const x = String(u).replace(/^http:\/\//, 'https://').replace(/&edge=curl/g, ''); return x.length <= 400 && COVER.test(x) ? x : ''; };
  function mapVolumes(items) {   /* Google lists many editions of one book: keep one per title + first author, preferring the one with a cover and a page count */
    const by = new Map();
    (Array.isArray(items) ? items : []).forEach(it => {
      const v = it && it.volumeInfo; if (!v || !v.title || !BID.test(String(it.id || ''))) return;
      const au = (Array.isArray(v.authors) ? v.authors : []).map(a => String(a).slice(0, 60));
      const b = { id: String(it.id), title: String(v.title).slice(0, 160), authors: au.join(', ').slice(0, 120), cover: coverUrl(v.imageLinks), pages: Math.max(0, Math.min(20000, Math.round(+v.pageCount) || 0)) };
      const k = (b.title + '|' + (au[0] || '')).toLowerCase(), o = by.get(k);
      if (!o) by.set(k, b); else if ((!o.cover && b.cover) || (!o.pages && b.pages)) by.set(k, { id: o.cover || !b.cover ? o.id : b.id, title: o.title, authors: o.authors, cover: o.cover || b.cover, pages: o.pages || b.pages });
    });
    return Array.from(by.values()).slice(0, 12);
  }
  async function searchBooks(q) {
    const A = api();
    if (A && A.museumBooks && token()) { try { const r = await A.museumBooks(q); if (r && Array.isArray(r.items)) return cleanBooks(r.items); } catch (e) {} }
    /* guests, or the server could not reach Google: ask Google Books straight from the page, then Open Library (neither needs a key) */
    let items = null;
    try { const r = await fetch('https://www.googleapis.com/books/v1/volumes?q=' + encodeURIComponent(q) + '&maxResults=20&printType=books&fields=items(id,volumeInfo(title,authors,pageCount,imageLinks))'); if (r.ok) items = mapVolumes((await r.json()).items); } catch (e) {}
    if (!items || !items.length) {
      try { const r = await fetch('https://openlibrary.org/search.json?q=' + encodeURIComponent(q) + '&limit=20&fields=key,title,author_name,cover_i,number_of_pages_median'); if (r.ok) { const o = mapOpenLibrary((await r.json()).docs); if (o.length || !items) items = o; } } catch (e) {}
    }
    if (!items) throw new Error('no book source answered');
    return items;
  }
  function mapOpenLibrary(docs) {
    const out = [], seen = new Set();
    (Array.isArray(docs) ? docs : []).forEach(d => {
      const id = String((d && d.key) || '').split('/').pop(), title = String((d && d.title) || '').slice(0, 160), ci = Math.round(+(d && d.cover_i));
      if (!title || !BID.test(id) || seen.has(id) || out.length >= 12) return; seen.add(id);
      out.push({ id, title, authors: (Array.isArray(d.author_name) ? d.author_name : []).slice(0, 3).map(a => String(a).slice(0, 60)).join(', ').slice(0, 120), cover: ci > 0 ? 'https://covers.openlibrary.org/b/id/' + ci + '-M.jpg' : '', pages: Math.max(0, Math.min(20000, Math.round(+d.number_of_pages_median) || 0)) });
    });
    return out;
  }
  /* where a book opens: Google Books for Google ids, Open Library for Open Library works, else a Google Books search */
  const bookUrl = b => /^OL\d+[A-Z]$/.test(b.id) ? 'https://openlibrary.org/works/' + b.id : /^[A-Za-z0-9_-]{12}$/.test(b.id) ? 'https://books.google.com/books?id=' + b.id : 'https://www.google.com/books?q=' + encodeURIComponent(b.title + ' ' + (b.authors || ''));
  const pagesTxt = n => n > 0 ? n.toLocaleString('en-US') + ' pages' : '';
  function bookCover(b) { return '<span class="bc" data-a="openbook" data-b="' + esc(b.id) + '" title="Open this book online"><span class="bph">' + esc(b.title) + '</span>' + (b.cover ? '<img src="' + esc(b.cover) + '" alt="" loading="lazy" draggable="false" onerror="this.style.display=\'none\'">' : '') + '</span>'; }
  function paintBooks(c) {
    bodyEl.innerHTML = '<div class="mu-tabs">' + tabsHTML(c) + '</div><div class="mu-add books"><label for="mu-bq">' + IC.search + '</label><input id="mu-bq" type="text" autocomplete="off" spellcheck="false" maxlength="100" placeholder="Search a book by its name or author…" value="' + esc(bres.q) + '">' +
      '<button type="button" class="ab srch" data-a="bsearch"><span class="t">Search</span></button></div><div id="mu-bres"></div><div id="mu-shelf"></div>';
    paintResults(); paintShelf();
  }
  function paintResults() {
    const el = $('#mu-bres'), c = cur(); if (!el || !c) return;
    if (bres.st === 'idle') { el.innerHTML = ''; return; }
    if (bres.st === 'load') { el.innerHTML = '<div class="bmsg">Searching the library…</div>'; return; }
    if (bres.st === 'err') { el.innerHTML = '<div class="bmsg">' + esc(bres.err) + '</div>'; return; }
    if (!bres.items.length) { el.innerHTML = '<div class="bmsg">No book found for “' + esc(bres.q) + '”. Try the title with the author’s name.</div>'; return; }
    el.innerHTML = '<div class="bh res"><button type="button" class="lnk" data-a="bclose">Clear</button></div><div class="bg res">' + bres.items.map((b, i) => {
      const on = c.books.some(x => x.id === b.id);
      return '<div class="bk">' + bookCover(b) + '<div class="bm"><b class="bt" data-a="openbook" data-b="' + esc(b.id) + '" title="Open this book online">' + esc(b.title) + '</b><span class="ba">' + esc(b.authors || 'Unknown author') + '</span><span class="bpg"><span>' + esc(pagesTxt(b.pages) || 'Page count unknown') + '</span></span></div>' +
        '<button type="button" class="ab shelf' + (on ? ' done' : '') + '" data-a="badd" data-i="' + i + '"' + (on ? ' disabled' : '') + '><span class="t">' + (on ? (c.fo ? 'In this folder' : 'On the shelf') : IC.plus + (c.fo ? 'Add to folder' : 'Add to shelf')) + '</span></button></div>';
    }).join('') + '</div>';
  }
  function paintShelf() {
    const el = $('#mu-shelf'), c = cur(); if (!el || !c) return;
    const tot = c.books.reduce((a, b) => a + (b.pages || 0), 0);
    if (!c.books.length) { el.innerHTML = '<div class="mu-drop-empty"><div><b>No books yet</b><p>Search for a book above and add it. Its cover and total pages are filled in for you.</p></div></div>'; return; }
    el.innerHTML = '<div class="bh"><b>' + IC.book + (c.fo ? 'Books in ' + esc(c.name) : esc(c.name) + '’s shelf') + '</b><span>' + c.books.length + ' book' + (c.books.length === 1 ? '' : 's') + (tot ? ' · ' + tot.toLocaleString('en-US') + ' pages in all' : '') + '</span></div><div class="bg">' + c.books.map(b => {
      return '<div class="bk">' + bookCover(b) +         '<div class="bm"><b class="bt" data-a="openbook" data-b="' + esc(b.id) + '" title="Open this book online">' + esc(b.title) + '</b><span class="ba">' + esc(b.authors || 'Unknown author') + '</span>' +
        '<button type="button" class="bpg ed" data-a="editpg" data-b="' + esc(b.id) + '" title="Click to change the page count"><span>' + esc(pagesTxt(b.pages) || 'Add page count') + '</span></button>' +
        (rmMode ? '<button type="button" class="rm" data-a="rmb" data-b="' + esc(b.id) + '" aria-label="Remove ' + esc(b.title) + ' from the shelf">' + IC.x + '</button>' : '') + '</div></div>';
    }).join('') + '</div>';
  }
  async function doSearch() {
    const i = $('#mu-bq'); clearTimeout(bT);
    const q = (i ? i.value : bres.q).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 100);
    if (q.length < 2) { toast('Type at least two letters of the book’s name.'); return; }
    const my = ++bseq; bres = { q, items: [], st: 'load', err: '' }; paintResults();
    try { const items = await searchBooks(q); if (my !== bseq) return; bres.items = items; bres.st = 'done'; }
    catch (e) { if (my !== bseq) return; bres.st = 'err'; bres.err = 'I could not reach the library just now. Check your connection and try again.'; }
    paintResults();
  }
  function addBook(i) {
    const c = cur(), b = bres.items[i]; if (!c || !b) return;
    if (c.books.some(x => x.id === b.id)) { toast(c.fo ? 'That book is already in this folder.' : 'That book is already on the shelf.'); return; }
    if (c.books.length >= MAX_BOOKS) { toast((c.fo ? 'This folder' : 'This shelf') + ' is full (' + MAX_BOOKS + ' books).'); return; }
    c.books.unshift({ id: b.id, title: b.title, authors: b.authors, cover: b.cover, pages: b.pages, at: Date.now() });
    changed(); snd('confirm'); toast('“' + b.title.slice(0, 60) + '” is ' + (c.fo ? 'in “' + c.name + '”.' : 'on ' + c.name + '’s shelf.')); paintTabs(c); paintShelf(); paintResults();
  }
  function editPages(id) {
    const c = cur(), b = c && c.books.find(x => x.id === id), btn = bodyEl.querySelector('.bpg.ed[data-b="' + id + '"]'); if (!b || !btn) return;
    const inp = mk('input', 'pgin'); inp.type = 'number'; inp.min = 1; inp.max = 20000; inp.value = b.pages || ''; inp.placeholder = 'Total pages'; inp.dataset.b = id; inp.setAttribute('aria-label', 'Total pages');
    btn.replaceWith(inp); inp.focus(); inp.select();
  }
  function savePages(inp) {
    const c = cur(), b = c && c.books.find(x => x.id === inp.dataset.b);
    if (b) { const n = Math.round(+inp.value); if (inp.value.trim() === '') b.pages = 0; else if (n >= 1 && n <= 20000) b.pages = n; else { toast('Write the number of pages between 1 and 20,000.'); paintShelf(); return; } changed(); }
    paintShelf();
  }

  /* a video (or playlist) opens on YouTube in a new tab: there is no player inside the museum */
  function openVideo(key) {
    const c = cur(), v = c && c.videos.find(x => vk(x) === key); if (!v) return;
    snd('select');
    window.open(v.kind === 'l' ? 'https://www.youtube.com/playlist?list=' + v.id : 'https://www.youtube.com/watch?v=' + v.id, '_blank', 'noopener');
  }

  /* ------------------------------------------------------------ the map: one still picture, portraits stand on its path */
  let worldMoved = 0, camX = 0, tgX = 0, vel = 0, drag = null, rafId = 0, lastT = 0, worldEl = null, keys = {};
  const maxX = () => Math.max(0, MAP_W - W);
  const freeSlotNear = () => { const used = new Set(creators.map(c => c.slot)); let best = 0, bd = 1e9; const cx = camX + W / 2; NODES.forEach((n, i) => { if (!used.has(i) && Math.abs(n[0] - cx) < bd) { bd = Math.abs(n[0] - cx); best = i; } }); return best; };
  function paintWorld() {
    bodyEl.innerHTML = '<div class="mw"><div class="mw-world" style="width:' + MAP_W + 'px;height:' + MAP_H + 'px"><img class="mw-map" src="museum/map.jpg" alt="" draggable="false"><div class="mw-sl"></div></div><div class="mw-hint">Hold the left mouse button and drag to explore the map</div></div>';
    worldEl = bodyEl.firstChild; bindWorld(worldEl);
    const by = {}; creators.forEach(c => { by[c.slot] = c; });
    $('.mw-sl', bodyEl).innerHTML = NODES.map((n, i) => {
      const c = by[i], st = 'left:' + n[0] + 'px;top:' + n[1] + 'px;--w:' + Math.round(n[2] * 2.46) + 'px';
      if (!c) return '<button type="button" class="sl empty" data-s="' + i + '" style="' + st + '" aria-label="Add a creator here"><span class="tk"><span class="pt"><img src="museum/unknown.png" alt="" draggable="false"></span><img class="fr" src="museum/frame.png" alt="" draggable="false"><b class="nm">Add</b></span><em>Add a creator</em></button>';
      const nv = c.videos.length;
      return '<button type="button" class="sl full" data-s="' + i + '" style="' + st + '" aria-label="' + esc(c.name) + ', ' + nv + ' videos"><span class="tk">' +
        '<span class="pt">' + (c.img ? '<img src="' + c.img + '" alt="" draggable="false">' : '<b>' + esc(c.name.trim().charAt(0).toUpperCase()) + '</b>') + '</span><img class="fr" src="museum/frame.png" alt="" draggable="false">' +
        '<b class="nm">' + esc(c.name) + '</b></span><em>' + esc(c.name) + ' · ' + nv + ' video' + (nv === 1 ? '' : 's') + (c.books.length ? ' · ' + c.books.length + ' book' + (c.books.length === 1 ? '' : 's') : '') + '</em></button>';
    }).join('');
    applyCam();
  }
  const applyCam = () => { const w = worldEl && $('.mw-world', worldEl); if (w) w.style.transform = 'translate3d(' + (-camX).toFixed(1) + 'px,0,0)'; };
  const sx = ev => { const r = stage.getBoundingClientRect(); return (ev.clientX - r.left) / (r.width / W); };
  function bindWorld(el) {
    el.style.touchAction = 'none'; el.addEventListener('pointerdown', ev => { if (ev.button !== 0) return; drag = { x: sx(ev), cx: camX, lx: sx(ev), lt: performance.now() }; worldMoved = 0; vel = 0; el.classList.add('grab'); });
    el.addEventListener('wheel', ev => { ev.preventDefault(); const k = ev.deltaMode === 1 ? 32 : 1; tgX = clamp(tgX + (Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY) * k * 1.2, 0, maxX()); vel = 0; }, { passive: false });
  }
  if (!window.__muPan) {
    window.__muPan = 1;
    addEventListener('pointermove', ev => {
      if (!drag || !worldEl) return;
      const x = sx(ev), now = performance.now();
      worldMoved = Math.max(worldMoved, Math.abs(x - drag.x));
      const nx = clamp(drag.cx - (x - drag.x), 0, maxX());
      const dt = Math.max(1, now - drag.lt); vel = vel * .6 + ((nx - camX) / dt * 1000) * .4; drag.lt = now;
      camX = tgX = nx; applyCam();
    });
    const panEnd = () => { if (drag) { drag = null; if (worldEl) worldEl.classList.remove('grab'); tgX = clamp(camX + vel * .25, 0, maxX()); vel = 0; setTimeout(() => { worldMoved = 0; }, 0); } };
    addEventListener('pointerup', panEnd); addEventListener('pointercancel', panEnd);
    addEventListener('keydown', ev => { if (isOpen && screen === 'lobby' && !modalEl.classList.contains('on') && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) { keys[ev.key] = 1; ev.preventDefault(); } });
    addEventListener('keyup', ev => { delete keys[ev.key]; });
  }
  function frame(t) {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - (lastT || t)) / 1000); lastT = t;
    if (!isOpen || screen !== 'lobby' || !worldEl || !worldEl.isConnected || drag) return;
    if (keys.ArrowLeft || keys.ArrowRight) tgX = clamp(tgX + ((keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0)) * 1100 * dt, 0, maxX());
    if (Math.abs(tgX - camX) > .05) { camX += (tgX - camX) * (1 - Math.pow(0.0012, dt)); applyCam(); }
  }
  const startLoop = () => { if (!rafId) { lastT = 0; rafId = requestAnimationFrame(frame); } };
  const stopLoop = () => { cancelAnimationFrame(rafId); rafId = 0; };
  const focusSlot = i => { const n = NODES[i]; if (n) tgX = clamp(n[0] - W / 2, 0, maxX()); };

  /* ---- picture for a creator: any image, cropped square and shrunk so it stays small */
  function paintPic() {
    const b = $('#mu-pp'); if (!b) return;
    const nm = ($('#mu-name') && $('#mu-name').value || '').trim();
    b.innerHTML = pickImg ? '<img src="' + pickImg + '" alt="">' : '<span>' + IC.plus + '</span>';
    b.classList.toggle('has', !!pickImg);
  }
  let reelKey = '';   /* set while the reel dialog is open: the picture is then cut portrait (9:16) instead of square */
  function takeImage(file) {
    if (!file || !/^image\//.test(file.type)) { toast('That is not a picture file.'); return; }
    const rd = new FileReader();
    rd.onload = () => {
      const im = new Image();
      im.onload = () => {
        const rl = !!reelKey, S = 240, CW = rl ? 180 : S, CH = rl ? 320 : S, cv = document.createElement('canvas'); cv.width = CW; cv.height = CH; const g = cv.getContext('2d');
        const sw = rl ? Math.min(im.width, im.height * CW / CH) : Math.min(im.width, im.height), sh = rl ? sw * CH / CW : sw;
        g.fillStyle = '#2a1a0d'; g.fillRect(0, 0, CW, CH); g.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, 0, 0, CW, CH);
        let q = .85, out = cv.toDataURL('image/jpeg', q); while (out.length > 50000 && q > .4) { q -= .1; out = cv.toDataURL('image/jpeg', q); }
        pickImg = out; paintPic();
      };
      im.onerror = () => toast('I could not read that picture.'); im.src = rd.result;
    };
    rd.readAsDataURL(file);
  }

  /* ------------------------------------------------------------ the add / edit creator card */
  let editId = '', pickHall = '', pickImg = '', pickSlot = -1;
  function openModal(id, firstLink, slot) {
    editId = id || ''; const c = id ? creators.find(x => x.id === id) : null; pickHall = c ? c.hall : 'self';
    if (!c && creators.length >= SLOTS) { toast('Every place on the map is taken.'); return; }
    pickImg = c ? c.img : ''; pickSlot = c ? c.slot : (slot != null && slot >= 0 ? slot : freeSlotNear());
    modalEl.innerHTML = '<div class="mdl" role="document"><div class="paper-card"><h3><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 3c-6 0-11 3.500-12.500 9.500L6 17l1 1 4.500-1.500C17.500 15 21 10 20 3zM6 18l-2.500 2.500"/><path d="M9.500 14.500L15 9"/></svg>' + (c ? 'Edit a Creator' : 'Add a Creator') + '</h3>' +
      '<label class="fl nm" for="mu-name">Name</label><div class="namebar"><input id="mu-name" type="text" maxlength="60" autocomplete="off" placeholder="e.g. Caleb Ralston" value="' + esc(c ? c.name : '') + '"></div>' +
      '<div class="fl pc">Picture <small>(their YouTube profile photo)</small></div><button type="button" class="pic-prev" id="mu-pp" data-a="pickimg" aria-label="Choose a picture"></button>' +
      '<button type="button" class="ab upl" data-a="pickimg"><span class="t">Upload Picture</span></button><button type="button" class="lnk rmpic" data-a="noimg">Remove picture</button><small class="hint">You can also drop an image file<br>on this window.</small><input type="file" id="mu-file" accept="image/*" hidden>' +
      (c ? '<button type="button" class="rmopen" data-a="rmmode">' + IC.trash + 'Remove</button>' : '') + (c ? '' : '<textarea id="mu-first" hidden>' + esc(firstLink || '') + '</textarea>') + '<div class="err" id="mu-err"></div>' + (c ? '<button type="button" class="lnk dgr" data-a="delc">Delete this creator</button>' : '') +
      '<button type="button" class="ab cnl" data-a="mcancel"><span class="t">Cancel</span></button><button type="button" class="ab sv" data-a="msave"><span class="t">' + (c ? 'Save' : 'Add to the Museum') + '</span></button></div></div>';
    modalEl.classList.add('on'); paintPic(); setTimeout(() => { const n = $('#mu-name'); if (n) { n.focus(); n.select(); } }, 30);
  }
  function openReelModal(key) {
    const c = cur(), v = c && c.videos.find(x => vk(x) === key); if (!v) return;
    reelKey = key; pickImg = v.thumb && /^data:/.test(v.thumb) ? v.thumb : '';
    modalEl.innerHTML = '<div class="mdl" role="document"><div class="paper-card"><h3>' + IC.reel + 'Reel picture</h3>' +
      '<div class="fl pc">Picture</div><button type="button" class="pic-prev reelpic" id="mu-pp" data-a="pickimg" aria-label="Choose a picture"></button>' +
      '<button type="button" class="ab upl" data-a="pickimg"><span class="t">Upload Picture</span></button><button type="button" class="lnk rmpic" data-a="noimg">Remove picture</button><small class="hint">You can also drop an image file<br>on this window.</small><input type="file" id="mu-file" accept="image/*" hidden>' +
      '<div class="err" id="mu-err"></div><button type="button" class="ab cnl" data-a="mcancel"><span class="t">Cancel</span></button><button type="button" class="ab sv" data-a="rsave"><span class="t">Save</span></button></div></div>';
    modalEl.classList.add('on'); paintPic();
  }
  function saveReel() {
    const c = cur(), v = c && c.videos.find(x => vk(x) === reelKey); if (!v) { closeModal(); return; }
    if (pickImg) v.thumb = pickImg; else if (!/^https:/.test(v.thumb || '') || true) v.thumb = pickImg || '';
    closeModal(); reelKey = ''; changed(); snd('confirm'); toast('Saved.'); paint();
  }
  function closeModal() { reelKey = ''; modalEl.classList.remove('on'); modalEl.innerHTML = ''; setTimeout(() => { if (fromMap && isOpen && screen === 'lobby' && !modalEl.classList.contains('on')) close(); }, 0); }
  function saveCreator() {
    const name = $('#mu-name').value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60), err = $('#mu-err'), note = ($('#mu-note') ? $('#mu-note').value : ((creators.find(x => x.id === editId) || {}).note || '')).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!name) { err.textContent = 'Give them a name first.'; $('#mu-name').focus(); return; }
    if (creators.some(c => c.id !== editId && c.name.toLowerCase() === name.toLowerCase())) { err.textContent = 'You already have a creator with that name.'; return; }
    let c = editId ? creators.find(x => x.id === editId) : null;
    if (c) { c.name = name; c.hall = pickHall; c.note = note; c.img = pickImg; }
    else if (!slotOpen(pickSlot)) { err.textContent = 'That level is locked. Finish a level to open the next one.'; return; }
    else { c = { id: uid(), name, hall: pickHall, note, at: Date.now(), img: pickImg, slot: pickSlot, lists: [], videos: [], books: [] }; creators.push(c); placeSlots(creators); }
    const first = $('#mu-first') ? $('#mu-first').value : '';
    closeModal(); changed(); snd('confirm');
    if (!editId) { curId = c.id; screen = 'creator'; listF = ''; ctab = 'videos'; paint(); toast(name + ' joined the museum.'); if (first.trim()) addLinks(first, c); }
    else { toast('Saved.'); paint(); }
  }
  let delArm = 0;
  function deleteCreator(btn) {
    if (!delArm) { btn.textContent = 'Really delete? Click again'; btn.classList.add('arm'); delArm = setTimeout(() => { delArm = 0; if (btn.isConnected) { btn.textContent = 'Delete this creator'; btn.classList.remove('arm'); } }, 3500); return; }
    clearTimeout(delArm); delArm = 0;
    creators = creators.filter(c => c.id !== editId); changed(); closeModal(); curId = ''; screen = 'lobby'; snd('back'); paint(); toast('Removed from the museum.');
  }

  /* ------------------------------------------------------------ folders: the level just outside the castle. Each folder is a box of Instagram reels and YouTube videos */
  const fCol = f => FOLDER_COLS[clamp(+f.col || 0, 0, FOLDER_COLS.length - 1)];
  const thumbOf = v => v.kind === 'p' ? photoSrc(v) : v.kind === 'r' ? (v.thumb || '') : v.kind === 'v' ? thumb(v.id, 'mqdefault') : '';
  const fCount = f => { const r = f.videos.filter(v => v.kind === 'r').length, p = f.videos.filter(v => v.kind === 'p').length, b = (f.books || []).length; return { r, p, v: f.videos.length - r - p, b, n: f.videos.length + b }; };
  const fSub = f => { const k = fCount(f); if (!k.n) return 'Empty'; return [k.r ? k.r + (k.r === 1 ? ' reel' : ' reels') : '', k.p ? k.p + (k.p === 1 ? ' photo' : ' photos') : '', k.v ? k.v + (k.v === 1 ? ' video' : ' videos') : '', k.b ? k.b + (k.b === 1 ? ' book' : ' books') : ''].filter(Boolean).join(' · '); };
  function folderTitle(f) {
    return '<div class="fo-tt"><span class="fo-ic">' + IC.folder + '</span><b>' + esc(f.name) + '</b><em>' + esc(fSub(f)) + '</em></div>' +
      (rmMode ? '<div class="rmbar"><span>' + IC.trash + 'Remove mode: click the red ✕ on anything you want to take away.</span><button type="button" class="rmdone" data-a="rmdone">Done</button></div>' : '');
  }
  /* the folder picture: a back sheet, up to three reel/video pictures peeking out of it, then the stitched front with a count plate */
  function folderArt(f) {
    const k = fCol(f), n = f.videos.length + (f.books || []).length, peeks = f.videos.map(thumbOf).concat((f.books || []).map(b => b.cover || '')).filter(Boolean).slice(0, 3), pos = [['9%', -9], ['31%', -1], ['53%', 8]];
    const th = peeks.map((u, i) => '<img src="' + esc(u) + '" alt="" loading="lazy" draggable="false" referrerpolicy="no-referrer" style="left:' + pos[i][0] + ';transform:rotate(' + pos[i][1] + 'deg)" onerror="this.style.visibility=\'hidden\'">').join('');
    const front = '<path d="M8 62Q8 54 17 54H105Q114 54 114 62V160Q114 172 102 172H18Q8 172 8 160Z" style="fill:var(--fa)" stroke="#20120a" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M14 63H106" stroke="#fff" stroke-opacity=".42" stroke-width="3" stroke-linecap="round" fill="none"/>' +
      '<path d="M17 72Q17 68 21 68H99Q103 68 103 72V157Q103 165 97 165H23Q17 165 17 157Z" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.6" stroke-dasharray="4 3.4"/>' +
      '<g stroke="#20120a" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"><path d="M84 97Q81 84 94 80Q97 93 84 97Z" fill="#eef3c4"/><path d="M84 97Q73 91 75 78Q89 80 84 97Z" fill="#dfe9ae"/><path d="M84 97L89 106" fill="none"/></g>' +
      '<rect x="26" y="122" width="68" height="34" rx="6" style="fill:var(--fc)" stroke="#20120a" stroke-width="2.6"/>' +
      '<g fill="#8a5a24"><circle cx="32" cy="128" r="1.7"/><circle cx="88" cy="128" r="1.7"/><circle cx="32" cy="150" r="1.7"/><circle cx="88" cy="150" r="1.7"/></g>' +
      '<text x="60" y="145.500" text-anchor="middle" font-family="Cinzel,serif" font-weight="700" font-size="19" fill="#3a1f08">' + (n ? n : '·') + '</text>';
    return '<span class="bc fdv" style="--fa:' + k.a + ';--fb:' + k.b + ';--fc:' + k.c + '">' +
      '<svg class="fsv" viewBox="0 0 120 180" aria-hidden="true"><path d="M8 24Q8 14 18 14H46Q53 14 57 20L61 27H104Q114 27 114 37V160Q114 172 102 172H18Q8 172 8 160Z" style="fill:var(--fb)" stroke="#20120a" stroke-width="3" stroke-linejoin="round"/></svg>' +
      '<span class="fth">' + th + '</span><svg class="fsv" viewBox="0 0 120 180" aria-hidden="true">' + front + '</svg></span>';
  }
  const folderCard = f => '<div class="bk fd" data-a="openf" data-f="' + esc(f.id) + '" aria-label="Open folder ' + esc(f.name) + '">' + folderArt(f) + '<div class="bm"><b class="bt">' + esc(f.name) + '</b><span class="fsub">' + esc(fSub(f)) + '</span></div></div>';
  const newFolderCard = () => '<div class="bk fd nw" data-a="newf"><span class="bc fdv add"><span class="plus">' + IC.plus + '</span></span><div class="bm"><b class="bt">New folder</b><span class="fsub">Reels, videos and books</span></div></div>';
  function paintFolders() {
    bodyEl.innerHTML = '<div class="fo-head"><img class="fo-ban-img" src="museum/ui/medialog.png" alt="Media Log" draggable="false"></div>' +
      '<div class="bg fg">' + folders.map(folderCard).join('') + newFolderCard() + '</div>';
  }
  let editFid = '', pickCol = 0;
  function openFolderModal(id) {
    editFid = id || ''; const f = id ? folders.find(x => x.id === id) : null; pickCol = f ? (f.col || 0) : (folders.length % FOLDER_COLS.length);
    if (!f && folders.length >= MAX_FOLDERS) { toast('That is the most folders there is room for (' + MAX_FOLDERS + ').'); return; }
    modalEl.innerHTML = '<div class="mdl" role="document"><div class="paper-card fmodal"><h3>' + IC.folder + (f ? 'Edit folder' : 'New folder') + '</h3>' +
      '<label class="fl nm" for="mu-fname">Name</label><div class="namebar"><input id="mu-fname" type="text" maxlength="60" autocomplete="off" placeholder="e.g. Morning routines" value="' + esc(f ? f.name : '') + '"></div>' +
      '<div class="fl pc">Colour <small>(pick the folder cover)</small></div><div class="fcols">' + FOLDER_COLS.map((k, i) => '<button type="button" class="fcol' + (i === pickCol ? ' on' : '') + '" data-a="fcol" data-k="' + i + '" aria-pressed="' + (i === pickCol) + '" aria-label="' + k.n + '" title="' + k.n + '" style="--fa:' + k.a + ';--fb:' + k.b + '"></button>').join('') + '</div>' +
      '<small class="fhint">Drag reels, videos or photos onto the folder,<br>or open it to paste a link or search a book.</small>' +
      (f ? '<button type="button" class="rmopen" data-a="rmmode">' + IC.trash + 'Remove</button>' : '') + '<div class="err" id="mu-err"></div>' + (f ? '<button type="button" class="lnk dgr" data-a="delf">Delete this folder</button>' : '') +
      '<button type="button" class="ab cnl" data-a="mcancel"><span class="t">Cancel</span></button><button type="button" class="ab sv" data-a="fsave"><span class="t">' + (f ? 'Save' : 'Create folder') + '</span></button></div></div>';
    modalEl.classList.add('on'); setTimeout(() => { const n = $('#mu-fname'); if (n) { n.focus(); n.select(); } }, 30);
  }
  function saveFolder() {
    const inp = $('#mu-fname'), err = $('#mu-err'); if (!inp) return;
    const name = inp.value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!name) { err.textContent = 'Give the folder a name first.'; inp.focus(); return; }
    if (folders.some(f => f.id !== editFid && f.name.toLowerCase() === name.toLowerCase())) { err.textContent = 'You already have a folder with that name.'; return; }
    let f = editFid ? folders.find(x => x.id === editFid) : null;
    if (f) { f.name = name; f.col = pickCol; }
    else { f = { id: uid(), name, col: pickCol, at: Date.now(), lists: [], videos: [], hall: 'self', note: '', img: '', slot: -1, books: [], fo: true }; folders.push(f); }
    const was = editFid; foSync = true; closeModal(); changed(); snd('confirm'); paint();
    toast(was ? 'Saved.' : '“' + name + '” is ready. Drop reels and videos into it.');
  }
  let fdArm = 0;
  function deleteFolder(btn) {
    if (!fdArm) { btn.textContent = 'Really delete? Click again'; btn.classList.add('arm'); fdArm = setTimeout(() => { fdArm = 0; if (btn.isConnected) { btn.textContent = 'Delete this folder'; btn.classList.remove('arm'); } }, 3500); return; }
    clearTimeout(fdArm); fdArm = 0;
    folders.filter(f => f.id === editFid).forEach(f => f.videos.forEach(dropPhotoFile)); folders = folders.filter(f => f.id !== editFid); foSync = true; changed(); closeModal(); curId = ''; screen = 'folders'; rmMode = false; snd('back'); paint(); toast('Folder deleted.');
  }

  /* ------------------------------------------------------------ clicks + keys */
  let rmArm = '', rmT = 0;
  function doAddLink() { const i = $('#mu-link'), c = cur(); if (!i || !c) return; const t = i.value; if (!t.trim()) { i.focus(); return; } i.value = ''; addLinks(t, c); }
  function onClick(ev) {
    const t = ev.target;
    const sl = t.closest('.sl'); if (sl) {
      if (worldMoved > 6) return;
      const c = creators.find(x => x.slot === +sl.dataset.s);
      if (c) { curId = c.id; screen = 'creator'; listF = ''; ctab = 'videos'; bseq++; bres = { q: '', items: [], st: 'idle', err: '' }; snd('flip'); paint(); } else openModal(null, '', +sl.dataset.s);
      return;
    }
    const ht = t.closest('.ht'); if (ht) { hallF = ht.dataset.h; snd('select'); paint(); return; }
    const chp = t.closest('.ch'); if (chp) { listF = chp.dataset.l; paint(); return; }
    const hp = t.closest('.hp'); if (hp) { pickHall = hp.dataset.k; modalEl.querySelectorAll('.hp').forEach(b => { b.classList.toggle('on', b === hp); b.setAttribute('aria-pressed', b === hp); }); $('#mu-err').textContent = ''; snd('select'); return; }
    if (t === modalEl) { closeModal(); return; }
    const b = t.closest('[data-a]'); if (!b) return; const a = b.dataset.a, c = cur();
    switch (a) {
      case 'close': close(); break;
      case 'folders': rmMode = false; screen = 'folders'; curId = ''; snd('back'); paint(); break;
      case 'openf': { const f = folders.find(x => x.id === b.dataset.f); if (f) { curId = f.id; screen = 'creator'; ctab = 'videos'; listF = ''; rmMode = false; snd('flip'); paint(); } break; }
      case 'newf': openFolderModal(''); break;
      case 'editf': openFolderModal(curId); break;
      case 'fcol': pickCol = +b.dataset.k; modalEl.querySelectorAll('.fcol').forEach(x => { const on = +x.dataset.k === pickCol; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); }); snd('select'); break;
      case 'fsave': saveFolder(); break;
      case 'delf': deleteFolder(b); break;
      case 'lobby': rmMode = false; screen = 'lobby'; curId = ''; bseq++; bres = { q: '', items: [], st: 'idle', err: '' }; snd('back'); paint(); break;
      case 'newc': openModal(null); break;
      case 'pickphoto': { const f = $('#mu-photos'); if (f) f.click(); break; }
      case 'pickimg': { const f = $('#mu-file'); if (f) f.click(); break; }
      case 'noimg': pickImg = ''; paintPic(); break;
      case 'editc': openModal(curId); break;
      case 'rmmode': closeModal(); rmMode = true; snd('select'); paint(); break;
      case 'rmdone': rmMode = false; snd('back'); paint(); break;
      case 'mcancel': closeModal(); break;
      case 'msave': saveCreator(); break;
      case 'delc': deleteCreator(b); break;
      case 'addlink': doAddLink(); break;
      case 'tab': if (ctab !== b.dataset.t) { ctab = b.dataset.t; snd('select'); paint(); } break;
      case 'bsearch': doSearch(); break;
      case 'bclose': bseq++; bres = { q: bres.q, items: [], st: 'idle', err: '' }; paintResults(); break;
      case 'openbook': { const all = (c ? c.books : []).concat(bres.items), bk = all.find(x => x.id === b.dataset.b); if (bk) window.open(bookUrl(bk), '_blank', 'noopener'); break; }
      case 'badd': addBook(+b.dataset.i); break;
      case 'editpg': editPages(b.dataset.b); break;
      case 'rmb': {
        const key = 'b' + b.dataset.b;
        if (!rmMode && rmArm !== key) { rmArm = key; b.classList.add('arm'); b.innerHTML = 'Remove?'; clearTimeout(rmT); rmT = setTimeout(() => { rmArm = ''; if (screen === 'creator' && ctab === 'books') paintShelf(); }, 3000); return; }
        clearTimeout(rmT); rmArm = ''; if (!c) return;
        c.books = c.books.filter(x => x.id !== b.dataset.b); changed(); snd('whoosh'); paintTabs(c); paintShelf(); paintResults();
        break;
      }
      case 'done': { const v = c && c.videos.find(x => vk(x) === b.dataset.v); if (v) setDone(c, v, !v.done); break; }
      case 'reel': { const v = c && c.videos.find(x => vk(x) === b.dataset.v); if (v) { clearTimeout(reelT); reelT = setTimeout(() => window.open(IGLINK(v.id), '_blank', 'noopener'), 300); } break; }
      case 'rsave': saveReel(); break;
      case 'photo': viewPhoto(b.dataset.v); break;
      case 'watch': openVideo(b.dataset.v); break;
      case 'rmv': {
        const key = b.dataset.v;
        if (!rmMode && rmArm !== key) { rmArm = key; b.classList.add('arm'); b.dataset.was = b.innerHTML; if (b.classList.contains('rm')) b.innerHTML = 'Remove?'; else b.lastChild.textContent = 'Sure?'; clearTimeout(rmT); rmT = setTimeout(() => { rmArm = ''; paintBody(); }, 3000); return; }
        clearTimeout(rmT); rmArm = ''; if (!c) return;
        c.videos.filter(v => vk(v) === key).forEach(dropPhotoFile); c.videos = c.videos.filter(v => vk(v) !== key); changed(); snd('whoosh');
        paintBody();
        break;
      }
    }
  }
  function onKey(ev) {
    if (!isOpen) return;
    const inInput = !!(ev.target.closest && ev.target.closest('input,textarea'));
    if (ev.key === 'Escape') {
      ev.preventDefault();
      if (modalEl.classList.contains('on')) { closeModal(); return; }
      if (inInput) { ev.target.blur(); return; }
      if (rmMode) { rmMode = false; paint(); }
      else if (screen === 'creator' && cur() && cur().fo) { screen = 'folders'; curId = ''; paint(); }
      else if (screen === 'creator' || screen === 'folders') { screen = 'lobby'; curId = ''; paint(); }
      else close();
    }
  }

  /* ------------------------------------------------------------ open / close */
  function open() {
    if (!built) build();
    isOpen = true; rmMode = false; screen = 'lobby'; curId = ''; vKey = ''; listF = ''; hallF = 'all';
    root.classList.add('open'); paint(); snd('flip'); load(); startLoop();
  }
  function close() {
    if (!isOpen) return;
    closeModal();
    if (saveT) { saveLocal(true); pushServer(); }
    isOpen = false; fromMap = false; rmMode = false; root.classList.remove('open', 'over', 'frommap'); stopLoop(); snd('back'); notify();
  }
  /* The Patch button opens the world map in level mode; the map calls these. */
  function openSlot(i) {
    if (!built) build();
    isOpen = true; fromMap = true; rmMode = false; vKey = ''; listF = ''; hallF = 'all'; ctab = 'videos'; bseq++; bres = { q: '', items: [], st: 'idle', err: '' };
    root.classList.add('open', 'over', 'frommap');
    const c = creators.find(x => x.slot === i);
    if (!c && !slotOpen(i)) { close(); return false; }
    if (c) { curId = c.id; screen = 'creator'; paint(); } else { curId = ''; screen = 'lobby'; openModal(null, '', i); paint(); }
    snd('flip');
  }
  /* the folder level on the world map (just outside the castle) opens the folders page */
  function openFolders() {
    if (!built) build();
    isOpen = true; fromMap = true; rmMode = false; vKey = ''; listF = ''; hallF = 'all'; ctab = 'videos'; curId = ''; screen = 'folders';
    root.classList.add('open', 'over', 'frommap'); paint(); snd('flip');
  }
  const folderInfo = () => ({ n: folders.length, items: folders.reduce((a, f) => a + f.videos.length + f.books.length, 0) });
  function snapshot() {
    const by = {}; creators.forEach(c => { by[c.slot] = c; });
    return LV.map((n, k) => { const c = by[n], p = prog(c); return { level: k + 1, node: n, open: !!c || slotOpen(n), has: !!c, name: c ? c.name : '', img: c ? c.img : '', d: p.d, t: p.t, f: p.f, done: !!(c && p.t && p.d >= p.t) }; });
  }
  function watch(on) { mapWatch = !!on; if (on) { if (!built) build(); load(); } }
  const openLobby = open;
  window.openMuseum = () => (window.openWorldMap ? window.openWorldMap({ levels: true }) : openLobby());
  window.closeMuseum = close;
  window.GroveMuseum = { parseLinks, mapVolumes, mapOpenLibrary, cleanBooks, levelOf: n => LVL_OF[n] || 0, prog,
    openSlot, openFolders, folderInfo, snapshot, watch, onChange: f => { listeners.push(f); return () => { const i = listeners.indexOf(f); if (i >= 0) listeners.splice(i, 1); }; }, isOpen: () => isOpen };   /* handy for tests */
})();
