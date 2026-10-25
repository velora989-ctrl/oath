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
      const st = /\sstyle\s*=\s*"([^"]*)"/i.exec(' ' + attrs);
      if (st) {
        const v = cleanStyle(st[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
        if (v) out += ` style="${v.replace(/"/g, '&quot;')}"`;
      }
      return `<${tag}${out}${tag === 'br' ? '/' : ''}>`;
    });
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

// GET /api/board/:playerId  (public) -> { board: { papers, updatedAt } }. Anyone can look at a board; only its owner can change it (PUT /).
router.get('/:playerId', async (req, res, next) => {
  try {
    if (!ID24.test(req.params.playerId)) return res.status(404).json({ error: 'Not found' });
    const b = await Board.findOne({ player: req.params.playerId });
    res.json({ board: { papers: b ? b.papers : [], updatedAt: b ? b.updatedAt : null } });
  } catch (err) {
    next(err);
  }
});

// GET /api/board -> { board: { papers, updatedAt } } (your own board; updatedAt is null before the first save)
router.get('/', auth, async (req, res, next) => {
  try {
    const b = await Board.findOne({ player: req.player._id });
    res.json({ board: { papers: b ? b.papers : [], updatedAt: b ? b.updatedAt : null } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/board  { papers: [...] } -> { updatedAt }. Replaces your whole board.
router.put('/', auth, async (req, res, next) => {
  try {
    const list = req.body && req.body.papers;
    if (!Array.isArray(list)) return res.status(400).json({ error: 'papers must be a list' });
    if (list.length > MAX_PAPERS) return res.status(400).json({ error: `At most ${MAX_PAPERS} papers fit on the board` });
    const papers = list.map(cleanPaper).filter(Boolean);
    const b = await Board.findOneAndUpdate({ player: req.player._id }, { $set: { papers } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    // pictures that are no longer on the board (and are over a day old, so an Undo or a fresh upload is never hit) are deleted
    const keep = papers.filter((p) => p.img).map((p) => p.img);
    BoardImage.deleteMany({ player: req.player._id, _id: { $nin: keep }, createdAt: { $lt: new Date(Date.now() - 24 * 3600 * 1000) } }).catch(() => {});
    res.json({ updatedAt: b.updatedAt });
  } catch (err) {
    next(err);
  }
});

// a picture above the size limit
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) return res.status(413).json({ error: 'That is too big (pictures: max 5 MB).' });
  next(err);
});

module.exports = router;
module.exports._test = { cleanHtml, cleanPaper, sniffMime };
