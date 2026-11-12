const express = require('express');
const auth = require('../middleware/auth');
const CalendarPref = require('../models/CalendarPref');

const router = express.Router();

const MAX_DAYS = 400;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// a real calendar date between 2020 and 2040 (so "2026-02-31" is refused)
function validDate(s) {
  const m = DATE.exec(String(s || ''));
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (y < 2020 || y > 2040) return false;
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}
const cleanNote = (v) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);

function cleanDays(list) {
  const seen = new Map();
  for (const x of list) {
    if (!x || !validDate(x.d)) continue;
    const h = Number(x.h) === 1 ? 1 : Number(x.h) === 2 ? 2 : Number(x.h) === 0 ? 0 : null;   // 2 = exam day (red)
    if (h === null) continue;
    seen.set(x.d, { d: x.d, h, n: h >= 1 ? cleanNote(x.n) : '' });
  }
  return Array.from(seen.values()).sort((a, b) => (a.d < b.d ? -1 : 1));
}

const MAX_NOTE_DAYS = 800, MAX_TODOS = 40;
const cleanText = (v, n) => String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/g, '').slice(0, n);
function cleanNotes(list) {
  const seen = new Map();
  for (const x of list) {
    if (!x || !validDate(x.d)) continue;
    const t = (Array.isArray(x.t) ? x.t : []).slice(0, MAX_TODOS).map((i) => ({ x: cleanText(i && i.x, 120).replace(/\s+/g, ' ').trim(), d: !!(i && i.d) })).filter((i) => i.x);
    const n = cleanText(x.n, 1000);
    if (!t.length && !n.trim()) continue;
    seen.set(x.d, { d: x.d, n, t });
  }
  return Array.from(seen.values()).sort((a, b) => (a.d < b.d ? -1 : 1));
}

// GET /api/calendar/notes -> { notes: [{ d, n, t: [{ x, d }] }] }   your to-dos and notes beside each day
router.get('/notes', auth, async (req, res, next) => {
  try {
    const doc = await CalendarPref.findOne({ player: req.player._id });
    res.json({ notes: doc && doc.notes ? doc.notes.map((x) => ({ d: x.d, n: x.n || '', t: (x.t || []).map((i) => ({ x: i.x, d: !!i.d })) })) : [] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/calendar/notes { notes } -> { notes }   replaces your day notes (the holiday changes are left alone)
router.put('/notes', auth, async (req, res, next) => {
  try {
    const list = req.body && req.body.notes;
    if (!Array.isArray(list)) return res.status(400).json({ error: 'notes must be a list' });
    if (list.length > MAX_NOTE_DAYS) return res.status(400).json({ error: `At most ${MAX_NOTE_DAYS} days can have notes` });
    const notes = cleanNotes(list);
    await CalendarPref.findOneAndUpdate({ player: req.player._id }, { $set: { notes } }, { new: true, upsert: true });
    res.json({ notes });
  } catch (err) {
    next(err);
  }
});

// GET /api/calendar -> { days: [{ d, h, n }] }   (your own changes only)
router.get('/', auth, async (req, res, next) => {
  try {
    const doc = await CalendarPref.findOne({ player: req.player._id });
    res.json({ days: doc ? doc.days.map((x) => ({ d: x.d, h: x.h, n: x.n || '' })) : [], updatedAt: doc ? doc.updatedAt : null });
  } catch (err) {
    next(err);
  }
});

// PUT /api/calendar  { days: [{ d, h, n }] } -> { days }   replaces your list of changes
router.put('/', auth, async (req, res, next) => {
  try {
    const list = req.body && req.body.days;
    if (!Array.isArray(list)) return res.status(400).json({ error: 'days must be a list' });
    if (list.length > MAX_DAYS) return res.status(400).json({ error: `At most ${MAX_DAYS} days can be changed` });
    const days = cleanDays(list);
    const doc = await CalendarPref.findOneAndUpdate({ player: req.player._id }, { $set: { days } }, { new: true, upsert: true });
    res.json({ days, updatedAt: doc.updatedAt });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports._test = { cleanDays, validDate, cleanNotes };
