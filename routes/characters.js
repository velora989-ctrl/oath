const express = require('express');
const Player = require('../models/Player');
const { CHARACTERS } = require('../services/characters');

const router = express.Router();

// GET /api/characters -> every character and whether another player already has it
router.get('/', async (req, res, next) => {
  try {
    const used = new Set((await Player.find({ character: { $type: 'string' } }).select('character').lean()).map((p) => p.character));
    res.json({ characters: CHARACTERS.map((c) => ({ ...c, taken: used.has(c.key) })) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
