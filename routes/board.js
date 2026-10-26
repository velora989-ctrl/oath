const express = require('express');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const Board = require('../models/Board');
const BoardImage = require('../models/BoardImage');

const router = express.Router();

const MAX_PAPERS = 60;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES_PER_PLAYER = 150;
const ID24 = /^[a-f0-9]{24}$/;
const STYLES = new Set(['parch', 'notice', 'tea', 'ledger', 'slip', 'scrap', 'letter', 'map']);
const TAGS = new Set(['div', 'span', 'b', 'strong', 'i', 'em', 'u', 'br']);
const CLASSES = new Set(['b-title', 'b-head', 'b-sub', 'b-body', 'b-fine', 'b-hand', 'b-orn']);

const num = (v, min, max, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

// Paper text is written in a contenteditable box, so it arrives as HTML. Only a short list of tags and attributes is kept
// (the browser cleans it again before showing it); everything else is dropped. Plain text is escaped.
function cleanStyle(raw) {
  return String(raw || '')
    .split(';')
    .map((d) => d.trim())
    .filter((d) => {
      const m = /^([a-z-]+)\s*:\s*(.+)$/i.exec(d);
      if (!m) return false;
      const prop = m[1].toLowerCase();
      const val = m[2];
      if (!['font-family', 'font-size', 'color', 'text-align', 'font-weight', 'font-style', 'text-decoration'].includes(prop)) return false;
      return /^[\w\s,.'"#%()\-]+$/.test(val) && !/url\s*\(|expression|@import|javascript/i.test(val);
    })
    .join(';');
}
function cleanHtml(html) {
  const s = String(html || '').slice(0, 20000);
  return s
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)([^<>]*)>/g, (all, tag, attrs) => {
      tag = tag.toLowerCase();
      if (!TAGS.has(tag)) return '';
      if (all.startsWith('</')) return `</${tag}>`;
      let out = '';
      const cls = /\sclass\s*=\s*"([^"]*)"/i.exec(' ' + attrs);
      if (cls) {
        const k = cls[1].split(/\s+/).filter((c) => CLASSES.has(c)).join(' ');
        if (k) out += ` class="${k}"`;
      }
      const o = /\sdata-o\s*=\s*"([1-4])"/i.exec(' ' + attrs);
      if (o) out += ` data-o="${o[1]}"`;
      const l = /\sdata-l\s*=\s*"(bul|num)"/i.exec(' ' + attrs);
      if (l) out += ` data-l="${l[1].toLowerCase()}"`;
      const st = /\sstyle\s*=\s*"([^"]*)"/i.exec(' ' + attrs);
      if (st) {
        const v = cleanStyle(st[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
        if (v) out += ` style="${v.replace(/"/g, '&quot;')}"`;
      }
      return `<${tag}${out}${tag === 'br' ? '/' : ''}>`;
    });
}
// the part of a picture that is trimmed away: [left, top, right, bottom] as fractions; at least 5% must stay visible
function cleanCrop(c) {
  if (!Array.isArray(c) || c.length !== 4) return undefined;
  const v = c.map((n) => num(n, 0, 0.95, 0));
  if (v[0] + v[2] > 0.95) { v[0] = 0; v[2] = 0; }
  if (v[1] + v[3] > 0.95) { v[1] = 0; v[3] = 0; }
  return v.some((n) => n > 0.0005) ? v.map((n) => Math.round(n * 10000) / 10000) : undefined;
}
function cleanPaper(p) {
  if (!p || typeof p !== 'object') return null;
  if (p.style === 'image') {
    if (!ID24.test(String(p.img || ''))) return null;
    return {
      id: String(p.id || '').slice(0, 40) || Math.random().toString(36).slice(2),
      style: 'image',
      x: num(p.x, -3000, 4000, 0),
      y: num(p.y, -3000, 4000, 0),
      w: num(p.w, 20, 2000, 300),
      h: num(p.h, 20, 2000, 300),
      rot: num(p.rot, -180, 180, 0),
      z: Math.round(num(p.z, -100000, 100000, 1)),
      seed: Math.round(num(p.seed, 0, 2147483647, 1)),
      html: '',
      img: String(p.img),
      fx: Math.round(num(p.fx, 0, 3, 0)),
      flip: p.flip ? 1 : 0,
      alpha: p.alpha ? 1 : 0,
      cr: cleanCrop(p.cr),
    };
  }
  if (!STYLES.has(p.style)) return null;
  return {
    id: String(p.id || '').slice(0, 40) || Math.random().toString(36).slice(2),
    style: p.style,
    x: num(p.x, -2000, 3000, 0),
    y: num(p.y, -2000, 3000, 0),
    w: num(p.w, 100, 1000, 300),
    h: num(p.h, 80, 1000, 300),
    rot: num(p.rot, -180, 180, 0),
    z: Math.round(num(p.z, -100000, 100000, 1)),
    seed: Math.round(num(p.seed, 0, 2147483647, 1)),
    html: cleanHtml(p.html),
  };
}

// ---- pictures -------------------------------------------------------------------------------------------------------
// The first bytes decide what a file is (the client's Content-Type is never trusted). SVG is not accepted: the browser turns
// it into a normal picture before uploading, so no script can ever be stored.
function sniffMime(b) {
  if (!Buffer.isBuffer(b) || b.length < 12) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.toString('latin1', 0, 4) === 'GIF8') return 'image/gif';
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}
const uploadLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many pictures just now. Try again in a little while.' } });

// POST /api/board/images  (raw image bytes, logged in) -> { id }
router.post('/images', auth, uploadLimit, express.raw({ type: () => true, limit: MAX_IMAGE_BYTES }), async (req, res, next) => {
  try {
    const mime = sniffMime(req.body);
    if (!mime) return res.status(400).json({ error: 'That file is not a picture I can pin (use PNG, JPG, GIF or WebP).' });
    if (req.body.length > MAX_IMAGE_BYTES) return res.status(413).json({ error: 'That picture is too big (max 5 MB).' });
    if ((await BoardImage.countDocuments({ player: req.player._id })) >= MAX_IMAGES_PER_PLAYER) {
      return res.status(400).json({ error: 'You have pinned a lot of pictures. Remove some papers first (unused pictures are cleaned up after a day).' });
    }
    const img = await BoardImage.create({ player: req.player._id, mime, data: req.body, size: req.body.length });
    res.status(201).json({ id: img._id.toString() });
  } catch (err) {
    next(err);
  }
});

// GET /api/board/images/:id  (public, like the boards themselves). The id is long and random; the file is cached for a year.
router.get('/images/:id', async (req, res, next) => {
  try {
    if (!ID24.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const img = await BoardImage.findById(req.params.id);
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

// ---- boards: a player can keep several, each with its own name -----------------------------------------------------------
const MAX_BOARDS = 12;
const cleanName = (v) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
const listDto = (b) => ({ id: String(b._id), name: b.name || 'My board', updatedAt: b.updatedAt || null, count: b.count != null ? b.count : Array.isArray(b.papers) ? b.papers.length : 0 });

// GET /api/board/list/:playerId  (public) -> { boards: [{ id, name, count, updatedAt }] }, oldest first
router.get('/list/:playerId', async (req, res, next) => {
  try {
    if (!ID24.test(req.params.playerId)) return res.status(404).json({ error: 'Not found' });
    const rows = await Board.find({ player: req.params.playerId }).sort({ order: 1, createdAt: 1 }).select('name order count updatedAt');
    res.json({ boards: rows.map(listDto) });
  } catch (err) {
    next(err);
  }
});

// GET /api/board/b/:id  (public) -> { board: { id, name, player, papers, updatedAt } }. Anyone can look; only the owner can change (PUT).
router.get('/b/:id', async (req, res, next) => {
  try {
    if (!ID24.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const b = await Board.findById(req.params.id);
    if (!b) return res.status(404).json({ error: 'That board does not exist any more.' });
    res.json({ board: { id: String(b._id), name: b.name || 'My board', player: String(b.player), papers: b.papers || [], updatedAt: b.updatedAt || null } });
  } catch (err) {
    next(err);
  }
});

// POST /api/board/b  { name } -> { board: { id, name } }. Makes a new, empty board for the logged-in player.
router.post('/b', auth, async (req, res, next) => {
  try {
    const name = cleanName(req.body && req.body.name);
    if (!name) return res.status(400).json({ error: 'Give the board a name first.' });
    if ((await Board.countDocuments({ player: req.player._id })) >= MAX_BOARDS) return res.status(400).json({ error: `You can keep up to ${MAX_BOARDS} boards. Remove one first.` });
    const b = await Board.create({ player: req.player._id, name, order: Date.now(), papers: [], count: 0 });
    res.status(201).json({ board: listDto(b) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/board/b/:id  { papers?, name? } -> { updatedAt, board }. Replaces the papers and / or renames. Owner only.
router.put('/b/:id', auth, async (req, res, next) => {
  try {
    if (!ID24.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const set = {};
    if (req.body && req.body.name !== undefined) {
      const name = cleanName(req.body.name);
      if (!name) return res.status(400).json({ error: 'Give the board a name first.' });
      set.name = name;
    }
    if (req.body && req.body.papers !== undefined) {
      const list = req.body.papers;
      if (!Array.isArray(list)) return res.status(400).json({ error: 'papers must be a list' });
      if (list.length > MAX_PAPERS) return res.status(400).json({ error: `At most ${MAX_PAPERS} papers fit on the board` });
      set.papers = list.map(cleanPaper).filter(Boolean);
      set.count = set.papers.length;
    }
    if (!Object.keys(set).length) return res.status(400).json({ error: 'Nothing to save' });
    const b = await Board.findOneAndUpdate({ _id: req.params.id, player: req.player._id }, { $set: set }, { new: true });
    if (!b) return res.status(404).json({ error: 'That board is not yours, or it does not exist any more.' });
    if (set.papers) cleanupImages(req.player._id);
    res.json({ updatedAt: b.updatedAt, board: listDto(b) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/board/b/:id  -> { ok }. Owner only; the last board cannot be removed.
router.delete('/b/:id', auth, async (req, res, next) => {
  try {
    if (!ID24.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
    if ((await Board.countDocuments({ player: req.player._id })) <= 1) return res.status(400).json({ error: 'Keep at least one board. You can rename it instead.' });
    const r = await Board.deleteOne({ _id: req.params.id, player: req.player._id });
    if (!r || !r.deletedCount) return res.status(404).json({ error: 'That board is not yours, or it does not exist any more.' });
    cleanupImages(req.player._id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// pictures that are on none of the player's boards any more (and are over a day old, so an Undo or a fresh upload is never hit) are deleted
async function cleanupImages(playerId) {
  try {
    const all = await Board.find({ player: playerId }).select('papers.img');
    const keep = [];
    all.forEach((b) => (b.papers || []).forEach((p) => p.img && keep.push(p.img)));
    await BoardImage.deleteMany({ player: playerId, _id: { $nin: keep }, createdAt: { $lt: new Date(Date.now() - 24 * 3600 * 1000) } });
  } catch (e) { /* best effort */ }
}

// a picture above the size limit
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) return res.status(413).json({ error: 'That is too big (pictures: max 5 MB).' });
  next(err);
});

module.exports = router;
module.exports._test = { cleanHtml, cleanPaper, sniffMime, cleanCrop, cleanName };
