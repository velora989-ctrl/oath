const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Boss = require('../models/Boss');

const router = express.Router();

const MAX_BOSSES = 10; // the screen lets you have 3 at once; this is only a safety limit
const MAX_HALL = 300;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const text = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const int = (v, min, max, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def;
};
const day = (v) => (typeof v === 'string' && DATE.test(v) ? v : null);
const tile = (t) => (Array.isArray(t) && t.length === 2 && t.every((x) => Number.isFinite(Number(x))) ? [int(t[0], -9, 9, 0), int(t[1], -9, 9, 0)] : null);

function cleanBoss(b) {
  if (!b || typeof b !== 'object') return null;
  const name = text(b.name, 40);
  const minis = (Array.isArray(b.minis) ? b.minis : [])
    .slice(0, 3)
    .map((m) => {
      const k = m && (m.k === 'count' || m.k === 'done') ? m.k : 'time'; // how it is measured: minutes, a target number, or done / not done
      const t = k === 'done' ? 1 : k === 'count' ? Math.round(Number(m.t)) : Math.round(Number(m && m.t) * 100) / 100;
      return { n: text(m && m.n, 40), t: Math.min(100000, t), k };
    })
    .filter((m) => m.n && m.t > 0);
  if (!name || !minis.length) return null;
  const max = int(b.max, 1, 200000, 0);
  if (!max) return null;
  let td = null;
  if (b.td && day(b.td.d)) {
    const k = [...new Set((Array.isArray(b.td.k) ? b.td.k : []).map((x) => int(x, -1, 2, -1)).filter((x) => x >= 0 && x < minis.length))];
    const m = {};
    k.forEach((i) => { m[i] = int(b.td.m && b.td.m[i], 0, 1000, 0); });
    td = { d: b.td.d, k, dmg: int(b.td.dmg, 0, 100000, 0), m };
  }
  const out = {
    id: int(b.id, 1, 9e15, Date.now()),
    name,
    style: int(b.style, 0, 2, 0), // the look: 0 classic, 1 green, 2 purple
    months: int(b.months, 1, 12, 1),
    days: int(b.days, 1, 400, 30),
    created: int(b.created, 0, 4e12, Date.now()),
    max,
    hp: int(b.hp, 1, max, max),
    minis,
    streak: int(b.streak, 0, 100000, 0),
    last: day(b.last),
    td,
  };
  if (Number.isFinite(Number(b.slot))) out.slot = int(b.slot, 0, 2, 0); // which of the 3 default places on the map
  if (b.bar === 'classic' || b.bar === 'new') out.bar = b.bar; // HP bar over the boss
  if (b.mbar === 'classic' || b.mbar === 'new') out.mbar = b.mbar; // HP bar over its mini bosses
  if (b.pos && typeof b.pos === 'object') { // positions chosen in Edit mode
    const c = tile(b.pos.c);
    const m = (Array.isArray(b.pos.m) ? b.pos.m : []).slice(0, minis.length).map(tile);
    if (c && m.length === minis.length && m.every(Boolean)) out.pos = { c, m };
  }
  return out;
}

function cleanHall(h) {
  if (!h || typeof h !== 'object') return null;
  const name = text(h.name, 40);
  if (!name) return null;
  return {
    name,
    style: int(h.style, 0, 2, 0),
    months: int(h.months, 1, 12, 1),
    start: day(h.start) || '',
    end: day(h.end) || '',
    days: int(h.days, 1, 100000, 1),
    minis: (Array.isArray(h.minis) ? h.minis : []).slice(0, 3).map((x) => text(x, 40)).filter(Boolean),
  };
}

function cleanAll(body) {
  const seen = new Set();
  const list = [];
  for (const b of Array.isArray(body && body.list) ? body.list : []) {
    const c = cleanBoss(b);
    if (c && !seen.has(c.id)) { seen.add(c.id); list.push(c); }
    if (list.length >= MAX_BOSSES) break;
  }
  const hall = (Array.isArray(body && body.hall) ? body.hall : []).map(cleanHall).filter(Boolean).slice(0, MAX_HALL);
  return { list, hall };
}

// GET /api/bosses -> { list, hall }
router.get('/', auth, async (req, res, next) => {
  try {
    const doc = await Boss.findOne({ player: req.player._id });
    res.json({ list: doc ? doc.list : [], hall: doc ? doc.hall : [], updatedAt: doc ? doc.updatedAt : null });
  } catch (err) {
    next(err);
  }
});

// GET /api/bosses/player/:id -> { list, hall }   anybody logged in can LOOK at another player's bosses (read-only: only your own can be changed)
router.get('/player/:id', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Player not found' });
    const doc = await Boss.findOne({ player: req.params.id });
    const { list, hall } = cleanAll({ list: doc ? doc.list : [], hall: doc ? doc.hall : [] });   // cleaned again, so only the known fields ever leave the server
    res.json({ list, hall });
  } catch (err) {
    next(err);
  }
});

// PUT /api/bosses { list, hall } -> { list, hall }   replaces everything
router.put('/', auth, async (req, res, next) => {
  try {
    if (!req.body || !Array.isArray(req.body.list) || !Array.isArray(req.body.hall)) return res.status(400).json({ error: 'list and hall must be lists' });
    const { list, hall } = cleanAll(req.body);
    const doc = await Boss.findOneAndUpdate({ player: req.player._id }, { $set: { list, hall } }, { new: true, upsert: true });
    res.json({ list, hall, updatedAt: doc.updatedAt });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports._test = { cleanAll, cleanBoss, cleanHall };
