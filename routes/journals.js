const express = require('express');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const Journal = require('../models/Journal');
const Player = require('../models/Player');
const { analyzeJournal } = require('../services/groq');
const { STATS, computeDay, checkDay, journalView, isRealDate, isFutureDate, todayUTC } = require('../services/dayStats');

const router = express.Router();

// AI calls cost money; keep it reasonable per IP.
const analyzeLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

function incFrom(total, sign = 1) {
  const inc = {};
  for (const k of STATS) if (total[k]) inc[`stats.${k}`] = sign * total[k];
  return inc;
}

// "2026-10-14" -> "14/10/2026" for messages
const niceDate = (d) => d.split('-').reverse().join('/');

// POST /api/journals  (auth)  { text, date? }
// ONE journal per player per day. Sends the text to Groq, stores the structured result and adds
// the points to the player's stats. A second journal for the same day is refused (409);
// delete the day's journal first if you really want to rewrite it.
router.post('/', auth, analyzeLimiter, async (req, res, next) => {
  try {
    const text = String(req.body.text || '').trim();
    if (text.length < 5) return res.status(400).json({ error: 'Write a bit more in your journal first' });
    if (text.length > 5000) return res.status(400).json({ error: 'Journal is too long (max 5000 characters)' });

    const date = req.body.date ? String(req.body.date) : todayUTC();
    if (!isRealDate(date)) return res.status(400).json({ error: 'Invalid date' });
    if (isFutureDate(date)) return res.status(400).json({ error: "You can't write a journal for a day that hasn't happened yet" });

    // check before calling the AI so a duplicate costs nothing
    const existing = await Journal.findOne({ player: req.player._id, date });
    if (existing) {
      return res.status(409).json({ error: `You already wrote your journal for ${niceDate(date)}`, journal: journalView(existing) });
    }

    let analysis;
    try {
      analysis = await analyzeJournal(text, req.player._id);
    } catch (err) {
      console.error('AI error:', err.message);
      const detail = process.env.NODE_ENV === 'production' ? '' : ` (${err.message.slice(0, 160)})`;
      return res.status(502).json({ error: `Could not analyse your journal right now.${detail}` });
    }

    // every hour of the day must be defined: durations have to add up to exactly 24h
    const problem = checkDay(analysis.tasks);
    if (problem) return res.status(400).json({ error: problem });

    let journal;
    try {
      journal = await Journal.create({
        player: req.player._id,
        date,
        rawText: text,
        tasks: analysis.tasks,
        signal_to_noise_ratio: analysis.signal_to_noise_ratio,
      });
    } catch (err) {
      // two requests for the same day at once: the unique index lets only one through
      if (err && err.code === 11000) {
        return res.status(409).json({ error: `You already wrote your journal for ${niceDate(date)}` });
      }
      throw err;
    }

    const gained = computeDay(analysis.tasks).points;
    const inc = incFrom(gained);
    let player = req.player;
    if (Object.keys(inc).length) {
      player = await Player.findByIdAndUpdate(req.player._id, { $inc: inc }, { new: true });
    }

    res.status(201).json({ journal: journalView(journal), gained, player: player.toPublic() });
  } catch (err) {
    next(err);
  }
});

// GET /api/journals/:id  (public)
router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Journal not found' });
    const journal = await Journal.findById(req.params.id);
    if (!journal) return res.status(404).json({ error: 'Journal not found' });
    res.json({ journal: journalView(journal) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/journals/:id  (auth, owner only) - also removes the points it granted
router.delete('/:id', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Journal not found' });
    const journal = await Journal.findById(req.params.id);
    if (!journal) return res.status(404).json({ error: 'Journal not found' });
    if (journal.player.toString() !== req.player._id.toString()) {
      return res.status(403).json({ error: 'You can only delete your own journals' });
    }

    const inc = incFrom(computeDay(journal.tasks).points, -1);
    await journal.deleteOne();
    let player = req.player;
    if (Object.keys(inc).length) {
      player = await Player.findByIdAndUpdate(req.player._id, { $inc: inc }, { new: true });
    }
    res.json({ ok: true, player: player.toPublic() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
