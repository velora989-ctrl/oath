const express = require('express');
const mongoose = require('mongoose');
const Player = require('../models/Player');
const Journal = require('../models/Journal');
const { journalView, isRealDate, DATE_RE, MONTH_RE } = require('../services/dayStats');

const router = express.Router();

// All player data is PUBLIC (read-only). Writing happens only through authenticated routes.

// GET /api/players  -> everyone, highest total points first
router.get('/', async (req, res, next) => {
  try {
    const players = await Player.find();
    const list = players.map((p) => p.toPublic()).sort((a, b) => b.totalPoints - a.totalPoints);
    res.json({ players: list });
  } catch (err) {
    next(err);
  }
});

// GET /api/players/:id
router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Player not found' });
    const player = await Player.findById(req.params.id);
    if (!player) return res.status(404).json({ error: 'Player not found' });
    res.json({ player: player.toPublic() });
  } catch (err) {
    next(err);
  }
});

// GET /api/players/:id/journals?limit=30&before=<ISO date>&date=YYYY-MM-DD
// Newest day first. With ?date= you get that one day (an array with 0 or 1 journals).
router.get('/:id/journals', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Player not found' });
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const filter = { player: req.params.id };
    if (DATE_RE.test(req.query.date || '')) filter.date = req.query.date;
    if (req.query.before) filter.createdAt = { $lt: new Date(req.query.before) };
    const journals = await Journal.find(filter).sort({ date: -1, createdAt: -1 }).limit(limit);
    res.json({ journals: journals.map(journalView) });
  } catch (err) {
    next(err);
  }
});

// GET /api/players/:id/journal/:date  -> { journal } or { journal: null } if nothing was written that day
router.get('/:id/journal/:date', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Player not found' });
    if (!isRealDate(req.params.date)) return res.status(400).json({ error: 'Invalid date' });
    const journal = await Journal.findOne({ player: req.params.id, date: req.params.date }).sort({ createdAt: -1 });
    res.json({ journal: journal ? journalView(journal) : null });
  } catch (err) {
    next(err);
  }
});

// GET /api/players/:id/calendar?month=YYYY-MM
// One entry per day that has a journal: signal/noise ratio, points gained and the tasks done.
// (No journal text, so the calendar stays small.)
router.get('/:id/calendar', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Player not found' });
    const month = String(req.query.month || '');
    if (!MONTH_RE.test(month)) return res.status(400).json({ error: 'month must look like 2026-10' });
    const docs = await Journal.find({
      player: req.params.id,
      date: { $gte: `${month}-01`, $lte: `${month}-31` }, // YYYY-MM-DD strings sort like dates
    })
      .sort({ date: 1 })
      .lean();
    const days = docs.map((d) => {
      const v = journalView(d);
      return {
        date: v.date,
        ratio: v.signal_to_noise_ratio,
        signalMinutes: v.signalMinutes,
        noiseMinutes: v.noiseMinutes,
        necessityMinutes: v.necessityMinutes,
        points: v.points,
        totalPoints: v.totalPoints,
        tasks: v.tasks,
      };
    });
    res.json({ month, days });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
