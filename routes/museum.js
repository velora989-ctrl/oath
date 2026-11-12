const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const Museum = require('../models/Museum');
const MuseumPhoto = require('../models/MuseumPhoto');

const router = express.Router();

const MAX_CREATORS = 40;
const MAX_VIDEOS = 400;
const MAX_TS = 80;
const MAX_BOOKS = 100;
const BID = /^[A-Za-z0-9_-]{1,40}$/;
const COVER = /^https:\/\/(books\.google\.[a-z.]+|books\.googleusercontent\.com|covers\.openlibrary\.org)\/[^\s"'<>]*$/;
const VID = /^[A-Za-z0-9_-]{11}$/;
const LIST = /^[A-Za-z0-9_-]{10,50}$/;
const CID = /^[A-Za-z0-9_-]{1,40}$/;
const HALLS = new Set(['self', 'biz', 'prod']);

const text = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const num = (v, min, max, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def;
};

const IGC = /^[A-Za-z0-9_-]{5,20}$/;
const PHOTO_ID = /^[a-f0-9]{24}$/;
const PHOTO = /^p[a-z0-9]{6,30}$/;   // a photo dropped into a folder   // Instagram reel code
const THUMB = /^(data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+|https:\/\/[^\s"'<>]+)$/;
function cleanVideo(v) {
  if (!v) return null;
  const kind = v.kind === 'l' ? 'l' : v.kind === 'r' ? 'r' : v.kind === 'p' ? 'p' : 'v';
  const id = String(v.id || '');
  if (!(kind === 'l' ? LIST : kind === 'r' ? IGC : kind === 'p' ? PHOTO : VID).test(id)) return null;
  const ts = (Array.isArray(v.ts) ? v.ts : [])
    .slice(0, MAX_TS)
    .map((x) => ({ t: num(x && x.t, 0, 86400 * 2, -1), l: text(x && x.l, 80) }))
    .filter((x) => x.t >= 0)
    .sort((a, b) => a.t - b.t);
  const list = String(v.list || '');
  const thumb = (kind === 'r' || kind === 'p') && THUMB.test(String(v.thumb || '')) && String(v.thumb).length <= 60000 ? String(v.thumb) : '';
  const src = kind === 'p' && PHOTO_ID.test(String(v.src || '')) ? String(v.src) : '';   // the original file kept on the server
  const note = String(v.note == null ? '' : v.note).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/g, '').slice(0, 2000);   // notes keep their line breaks
  return { id, kind, title: text(v.title, 160), author: text(v.author, 80), thumb: src ? '' : thumb, src, w: src ? num(v.w, 0, 100000, 0) : 0, h: src ? num(v.h, 0, 100000, 0) : 0, dur: num(v.dur, 0, 86400 * 2, 0), at: num(v.at, 0, 4e12, 0), list: LIST.test(list) ? list : '', done: v.done === true, note, ts };
}
function cleanBook(b) {
  if (!b || !BID.test(String(b.id || ''))) return null;
  const title = text(b.title, 160);
  if (!title) return null;
  const cover = typeof b.cover === 'string' && b.cover.length <= 400 && COVER.test(b.cover) ? b.cover : '';
  return { id: String(b.id), title, authors: text(b.authors, 120), cover, pages: num(b.pages, 0, 20000, 0), at: num(b.at, 0, 4e12, 0) };
}
function cleanCreator(c) {
  if (!c || !HALLS.has(c.hall)) return null;
  const name = text(c.name, 60);
  if (!name || !CID.test(String(c.id || ''))) return null;
  const seen = new Set();
  const videos = [];
  for (const v of Array.isArray(c.videos) ? c.videos : []) {
    const x = cleanVideo(v);
    if (!x || seen.has(x.kind + x.id)) continue;
    seen.add(x.kind + x.id);
    videos.push(x);
    if (videos.length >= MAX_VIDEOS) break;
  }
  const bseen = new Set();
  const books = [];
  for (const b of Array.isArray(c.books) ? c.books : []) {
    const x = cleanBook(b);
    if (!x || bseen.has(x.id)) continue;
    bseen.add(x.id);
    books.push(x);
    if (books.length >= MAX_BOOKS) break;
  }
  const lists = (Array.isArray(c.lists) ? c.lists : []).filter((l) => l && LIST.test(String(l.id || ''))).slice(0, 40).map((l) => ({ id: String(l.id), title: text(l.title, 160) }));
  const img = typeof c.img === 'string' && c.img.length <= 60000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(c.img) ? c.img : '';
  const slot = Number.isInteger(c.slot) && c.slot >= 0 && c.slot < 64 ? c.slot : -1;
  return { id: String(c.id), name, hall: c.hall, note: text(c.note, 300), at: num(c.at, 0, 4e12, 0), img, slot, lists, videos, books };
}
const cleanCreators = (list) => list.slice(0, MAX_CREATORS).map(cleanCreator).filter(Boolean);

// ---- reel & video folders ----------------------------------------------------------------------------------------------
const MAX_FOLDERS = 60;
function cleanFolder(f) {
  if (!f) return null;
  const name = text(f.name, 60);
  if (!name || !CID.test(String(f.id || ''))) return null;
  const seen = new Set();
  const videos = [];
  for (const v of Array.isArray(f.videos) ? f.videos : []) {
    const x = cleanVideo(v);
    if (!x || seen.has(x.kind + x.id)) continue;
    seen.add(x.kind + x.id);
    videos.push(x);
    if (videos.length >= MAX_VIDEOS) break;
  }
  const bseen = new Set();
  const books = [];
  for (const b of Array.isArray(f.books) ? f.books : []) {
    const x = cleanBook(b);
    if (!x || bseen.has(x.id)) continue;
    bseen.add(x.id);
    books.push(x);
    if (books.length >= MAX_BOOKS) break;
  }
  const lists = (Array.isArray(f.lists) ? f.lists : []).filter((l) => l && LIST.test(String(l.id || ''))).slice(0, 40).map((l) => ({ id: String(l.id), title: text(l.title, 160) }));
  return { id: String(f.id), name, col: num(f.col, 0, 5, 0), at: num(f.at, 0, 4e12, 0), lists, videos, books };
}
const cleanFolders = (list) => list.slice(0, MAX_FOLDERS).map(cleanFolder).filter(Boolean);

// ---- reading YouTube from the server (the browser is not allowed to read most of it) ------------------------------------
const KEY = () => process.env.YOUTUBE_API_KEY || '';
async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MirasGrove/1.0)', 'Accept-Language': 'en' }, signal: AbortSignal.timeout(9000) });
  if (!res.ok) { const e = new Error('YouTube said ' + res.status); e.status = res.status; throw e; }
  return res.json();
}
function isoDuration(s) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(s || ''));
  return m ? (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0) : 0;
}
// "0:00 Intro", "12:30 - Why habits matter", "1:02:03 Q&A" -> chapters (YouTube itself needs 3+, starting at 0:00; we accept 2+)
function parseChapters(desc) {
  const out = [];
  for (const line of String(desc || '').split(/\r?\n/).slice(0, 200)) {
    const m = /^\s*(?:[-•▶►>*]\s*)?(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*[-–—:.)]?\s*(.{1,80})$/.exec(line);
    if (!m) continue;
    const t = (+m[1] || 0) * 3600 + +m[2] * 60 + +m[3];
    const l = text(m[4], 80);
    if (l && (!out.length || t > out[out.length - 1].t)) out.push({ t, l });
  }
  return out.length >= 2 ? out.slice(0, MAX_TS) : [];
}
async function videoInfo(id) {
  if (KEY()) {
    const j = await getJson(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${id}&key=${encodeURIComponent(KEY())}`);
    const it = j.items && j.items[0];
    if (!it) { const e = new Error('Video not found'); e.status = 404; throw e; }
    return { id, title: text(it.snippet.title, 160), author: text(it.snippet.channelTitle, 80), dur: isoDuration(it.contentDetails && it.contentDetails.duration), chapters: parseChapters(it.snippet.description) };
  }
  const j = await getJson('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id));
  return { id, title: text(j.title, 160), author: text(j.author_name, 80), dur: 0, chapters: [] };
}
async function playlistItems(id) {
  const items = [];
  let page = '';
  let title = '';
  for (let i = 0; i < 4 && items.length < 200; i++) {
    const j = await getJson(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${id}${page ? '&pageToken=' + page : ''}&key=${encodeURIComponent(KEY())}`);
    for (const it of j.items || []) {
      const vid = it.contentDetails && it.contentDetails.videoId;
      if (!VID.test(String(vid || '')) || /^(Private|Deleted) video$/i.test(it.snippet.title || '')) continue;
      items.push({ id: vid, title: text(it.snippet.title, 160), author: text(it.snippet.videoOwnerChannelTitle || it.snippet.channelTitle, 80) });
    }
    page = j.nextPageToken || '';
    if (!page) break;
  }
  try {
    const p = await getJson(`https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${id}&key=${encodeURIComponent(KEY())}`);
    title = text(p.items && p.items[0] && p.items[0].snippet.title, 160);
  } catch (e) {}
  // durations for up to 50 at a time
  for (let i = 0; i < items.length; i += 50) {
    const chunk = items.slice(i, i + 50);
    try {
      const j = await getJson(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${chunk.map((x) => x.id).join(',')}&key=${encodeURIComponent(KEY())}`);
      const d = new Map((j.items || []).map((x) => [x.id, isoDuration(x.contentDetails.duration)]));
      chunk.forEach((x) => { x.dur = d.get(x.id) || 0; });
    } catch (e) {}
  }
  return { id, title, items };
}

// ---- books: Google Books (works without a key; GOOGLE_BOOKS_API_KEY in .env only raises the daily quota) ----------------------
function bookCover(il) {
  const u = il && (il.thumbnail || il.smallThumbnail);
  if (!u) return '';
  const s = String(u).replace(/^http:\/\//, 'https://').replace(/&edge=curl/g, '');
  return s.length <= 400 && COVER.test(s) ? s : '';
}
// Google returns many editions of the same book: keep one per title + first author, preferring the one that has a cover and a page count
function mapVolumes(items) {
  const byKey = new Map();
  for (const it of Array.isArray(items) ? items : []) {
    const v = it && it.volumeInfo;
    if (!v || !v.title || !BID.test(String(it.id || ''))) continue;
    const authors = (Array.isArray(v.authors) ? v.authors : []).map((a) => text(a, 60)).filter(Boolean);
    const book = { id: String(it.id), title: text(v.title, 160), authors: authors.join(', ').slice(0, 120), cover: bookCover(v.imageLinks), pages: num(v.pageCount, 0, 20000, 0) };
    if (!book.title) continue;
    const key = (book.title + '|' + (authors[0] || '')).toLowerCase();
    const old = byKey.get(key);
    if (!old) byKey.set(key, book);
    else if ((!old.cover && book.cover) || (!old.pages && book.pages && (old.cover ? book.cover : true))) byKey.set(key, { ...book, cover: book.cover || old.cover, pages: book.pages || old.pages });
  }
  return Array.from(byKey.values()).slice(0, 12);
}

// Open Library: the backup when Google Books refuses (no key needed). Its covers and page counts are good enough for a shelf.
function mapOpenLibrary(docs) {
  const out = [];
  const seen = new Set();
  for (const d of Array.isArray(docs) ? docs : []) {
    const id = String((d && d.key) || '').split('/').pop();
    const title = text(d && d.title, 160);
    if (!title || !BID.test(id) || seen.has(id)) continue;
    seen.add(id);
    const ci = Math.round(Number(d.cover_i));
    out.push({ id, title, authors: (Array.isArray(d.author_name) ? d.author_name : []).slice(0, 3).map((a) => text(a, 60)).join(', ').slice(0, 120), cover: ci > 0 ? 'https://covers.openlibrary.org/b/id/' + ci + '-M.jpg' : '', pages: num(d.number_of_pages_median, 0, 20000, 0) });
    if (out.length >= 12) break;
  }
  return out;
}
async function openLibrary(q) {
  const j = await getJson('https://openlibrary.org/search.json?q=' + encodeURIComponent(q) + '&limit=20&fields=key,title,author_name,cover_i,number_of_pages_median');
  return mapOpenLibrary(j.docs);
}

const lookupLimit = rateLimit({ windowMs: 10 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false });

// GET /api/museum -> { creators }  (your own museum only)
router.get('/', auth, async (req, res, next) => {
  try {
    const doc = await Museum.findOne({ player: req.player._id });
    res.json({ creators: doc ? doc.creators : [], updatedAt: doc ? doc.updatedAt : null });
  } catch (err) {
    next(err);
  }
});

// ---- photos dropped into a folder: the original file is kept as it is (no compressing, no resizing) -------------------------
// The first bytes decide what a file is (the client's Content-Type is never trusted); SVG is not accepted.
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;   // one MongoDB document holds 16 MB
const MAX_PHOTOS_PER_PLAYER = 600;
function sniffMime(b) {
  if (!Buffer.isBuffer(b) || b.length < 12) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.toString('latin1', 0, 4) === 'GIF8') return 'image/gif';
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}
const photoLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 400, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many photos just now. Try again in a little while.' } });

// POST /api/museum/photos  (raw image bytes, logged in) -> { id }
router.post('/photos', auth, photoLimit, express.raw({ type: () => true, limit: MAX_PHOTO_BYTES }), async (req, res, next) => {
  try {
    const mime = sniffMime(req.body);
    if (!mime) return res.status(400).json({ error: 'That file is not a photo I can keep (use JPG, PNG, WebP or GIF).' });
    if (req.body.length > MAX_PHOTO_BYTES) return res.status(413).json({ error: 'That photo is too big (max 15 MB).' });
    if ((await MuseumPhoto.countDocuments({ player: req.player._id })) >= MAX_PHOTOS_PER_PLAYER) return res.status(400).json({ error: 'You have kept a lot of photos. Remove some first.' });
    const img = await MuseumPhoto.create({ player: req.player._id, mime, data: req.body, size: req.body.length });
    res.status(201).json({ id: img._id.toString() });
  } catch (err) {
    next(err);
  }
});

// GET /api/museum/photos/:id  (the id is long and random, like board pictures). The original bytes, cached for a year.
router.get('/photos/:id', async (req, res, next) => {
  try {
    if (!PHOTO_ID.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const img = await MuseumPhoto.findById(req.params.id);
    if (!img) return res.status(404).json({ error: 'Not found' });
    res.set({
      'Content-Type': img.mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cross-Origin-Resource-Policy': 'same-origin',
    });
    res.send(img.data);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/museum/photos/:id  (only your own)
router.delete('/photos/:id', auth, async (req, res, next) => {
  try {
    if (!PHOTO_ID.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
    await MuseumPhoto.deleteOne({ _id: req.params.id, player: req.player._id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/museum/folders -> { folders }   your reel & video folders
router.get('/folders', auth, async (req, res, next) => {
  try {
    const doc = await Museum.findOne({ player: req.player._id });
    res.json({ folders: doc && doc.folders ? doc.folders : [], updatedAt: doc ? doc.updatedAt : null });
  } catch (err) {
    next(err);
  }
});

// PUT /api/museum/folders { folders } -> { updatedAt }   replaces your folders (the creators are left alone)
router.put('/folders', auth, async (req, res, next) => {
  try {
    const list = req.body && req.body.folders;
    if (!Array.isArray(list)) return res.status(400).json({ error: 'folders must be a list' });
    if (list.length > MAX_FOLDERS) return res.status(400).json({ error: `There is room for ${MAX_FOLDERS} folders.` });
    const folders = cleanFolders(list);
    const doc = await Museum.findOneAndUpdate({ player: req.player._id }, { $set: { folders } }, { new: true, upsert: true });
    res.json({ updatedAt: doc.updatedAt });
  } catch (err) {
    next(err);
  }
});

// PUT /api/museum { creators } -> { updatedAt }   replaces your museum
router.put('/', auth, async (req, res, next) => {
  try {
    const list = req.body && req.body.creators;
    if (!Array.isArray(list)) return res.status(400).json({ error: 'creators must be a list' });
    if (list.length > MAX_CREATORS) return res.status(400).json({ error: `The museum has room for ${MAX_CREATORS} creators.` });
    const creators = cleanCreators(list);
    const doc = await Museum.findOneAndUpdate({ player: req.player._id }, { $set: { creators } }, { new: true, upsert: true });
    res.json({ updatedAt: doc.updatedAt, count: creators.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/museum/info/:id -> { id, title, author, dur, chapters }   (dur and chapters need YOUTUBE_API_KEY in .env)
router.get('/info/:id', auth, lookupLimit, async (req, res) => {
  if (!VID.test(req.params.id)) return res.status(400).json({ error: 'That is not a YouTube video id.' });
  try {
    res.json(await videoInfo(req.params.id));
  } catch (err) {
    res.status(err.status === 404 || err.status === 401 || err.status === 403 ? 404 : 502).json({ error: 'YouTube did not give details for that video (it may be private or removed).' });
  }
});

// GET /api/museum/reel/:code -> { user, title, thumb }   reads the public Instagram page the way a link preview does (og:image, og:title); Instagram may refuse, then the page lets the player type it in
async function reelInfo(code) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 7000);
  try {
    const r = await fetch(`https://www.instagram.com/reel/${code}/`, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'Accept-Language': 'en' } });
    if (!r.ok) return null;
    const html = (await r.text()).slice(0, 400000);
    const meta = (p) => { const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']*)["']`, 'i')) || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${p}["']`, 'i')); return m ? m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&#064;/g, '@') : ''; };
    const ogTitle = meta('og:title'), desc = meta('og:description'), img = meta('og:image');
    let user = (ogTitle.match(/^(.{1,40}?)\s+on Instagram/i) || [])[1] || (desc.match(/-\s*@?([A-Za-z0-9._]{1,30})\s+on\s/i) || [])[1] || '';
    user = user.replace(/^@/, '').replace(/[^A-Za-z0-9._]/g, '').slice(0, 30);
    const cap = (ogTitle.match(/on Instagram:\s*["“]?(.+?)["”]?$/i) || [])[1] || '';
    let thumb = '';
    if (/^https:\/\//i.test(img)) {
      try {
        const ir = await fetch(img, { signal: ctl.signal });
        const buf = Buffer.from(await ir.arrayBuffer());
        const ct = (ir.headers.get('content-type') || 'image/jpeg').split(';')[0];
        thumb = buf.length <= 44000 && /^image\/(jpeg|png|webp)$/.test(ct) ? `data:${ct};base64,${buf.toString('base64')}` : img.length <= 1500 ? img : '';
      } catch (e) { thumb = img.length <= 1500 ? img : ''; }
    }
    if (!user && !thumb && !cap) return null;
    return { user, title: text(cap, 160) || 'Instagram reel', thumb };
  } finally { clearTimeout(t); }
}
router.get('/reel/:code', auth, lookupLimit, async (req, res) => {
  if (!IGC.test(req.params.code)) return res.status(400).json({ error: 'That is not an Instagram reel code.' });
  try {
    const r = await reelInfo(req.params.code);
    if (!r) return res.status(502).json({ error: 'Instagram did not share that reel.' });
    res.json(r);
  } catch (e) {
    res.status(502).json({ error: 'Instagram did not share that reel.' });
  }
});

// GET /api/museum/playlist/:id -> { id, title, items: [{ id, title, author, dur }] }   needs YOUTUBE_API_KEY; without it the page reads the playlist itself
router.get('/playlist/:id', auth, lookupLimit, async (req, res) => {
  if (!LIST.test(req.params.id)) return res.status(400).json({ error: 'That is not a YouTube playlist id.' });
  if (!KEY()) return res.status(501).json({ error: 'No YOUTUBE_API_KEY on the server.' });
  try {
    res.json(await playlistItems(req.params.id));
  } catch (err) {
    res.status(502).json({ error: 'YouTube did not give that playlist (it may be private).' });
  }
});

// GET /api/museum/books/search?q=atomic habits -> { items: [{ id, title, authors, cover, pages }] }
router.get('/books/search', auth, lookupLimit, async (req, res) => {
  const q = text(req.query.q, 100);
  if (q.length < 2) return res.status(400).json({ error: 'Type at least two letters of the book’s name.' });
  const key = process.env.GOOGLE_BOOKS_API_KEY || '';
  const url = 'https://www.googleapis.com/books/v1/volumes?q=' + encodeURIComponent(q) + '&maxResults=20&printType=books&fields=items(id,volumeInfo(title,authors,pageCount,imageLinks))' + (key ? '&key=' + encodeURIComponent(key) : '');
  let items = null;
  try {
    items = mapVolumes((await getJson(url)).items);
  } catch (err) {
    /* Google refused (often its shared free limit, 429): fall through to Open Library */
  }
  if (!items || !items.length) {
    try {
      const o = await openLibrary(q);
      if (o.length || !items) items = o;
    } catch (err) {
      if (!items) return res.status(502).json({ error: 'The library did not answer. Try again in a moment.' });
    }
  }
  res.json({ items });
});

module.exports = router;
module.exports._test = { cleanCreators, cleanVideo, cleanBook, mapVolumes, mapOpenLibrary, parseChapters, isoDuration };
