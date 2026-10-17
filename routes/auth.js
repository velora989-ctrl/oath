const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Player = require('../models/Player');
const auth = require('../middleware/auth');
const { MAX_PLAYERS, FULL_MESSAGE, isValid } = require('../services/characters');
const archetypes = require('../services/archetypes');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const signToken = (player) =>
  jwt.sign({ sub: player._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });

// POST /api/auth/register  { name, email, password }
router.post('/register', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (name.length < 2 || name.length > 16) return res.status(400).json({ error: 'Name must be 2-16 characters' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    if (await Player.exists({ email })) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // the Grove only has room for MAX_PLAYERS people; everyone else has to ask the admins
    if ((await Player.countDocuments()) >= MAX_PLAYERS) return res.status(403).json({ error: FULL_MESSAGE, full: true });

    const passwordHash = await bcrypt.hash(password, 10);
    const player = await Player.create({ name, email, passwordHash });
    // two people registering at the very same moment could both pass the check above: the later one gives its spot back
    if ((await Player.countDocuments()) > MAX_PLAYERS && (await Player.countDocuments({ createdAt: { $lt: player.createdAt } })) >= MAX_PLAYERS) {
      await Player.deleteOne({ _id: player._id });
      return res.status(403).json({ error: FULL_MESSAGE, full: true });
    }
    res.status(201).json({ token: signToken(player), player: player.toPublic() });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login  { email, password }
router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    const player = await Player.findOne({ email }).select('+passwordHash');
    const ok = player && (await bcrypt.compare(password, player.passwordHash));
    if (!ok) return res.status(401).json({ error: 'Incorrect email or password' });

    res.json({ token: signToken(player), player: player.toPublic() });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/character  (auth) { character } -> the player's character, chosen once from the ones nobody has
router.post('/character', auth, async (req, res, next) => {
  try {
    const key = String(req.body.character || '').trim().toLowerCase();
    if (!isValid(key)) return res.status(400).json({ error: 'Pick one of the characters' });
    if (req.player.character) return res.status(409).json({ error: 'You already have a character' });
    if (await Player.exists({ character: key })) return res.status(409).json({ error: 'Someone else already has that character. Pick another one.' });
    // the unique index decides when two players grab the same one at the same moment
    try {
      req.player.character = key;
      await req.player.save();
    } catch (err) {
      if (err && err.code === 11000) return res.status(409).json({ error: 'Someone else just took that character. Pick another one.' });
      throw err;
    }
    res.json({ player: req.player.toPublic() });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/archetype  (auth) { archetype: 'liberal' | 'radical' } -> chosen once
router.post('/archetype', auth, async (req, res, next) => {
  try {
    const key = String(req.body.archetype || '').trim().toLowerCase();
    if (!archetypes.isValid(key)) return res.status(400).json({ error: 'Pick Tarnished or Elden Lord' });
    if (req.player.archetype) return res.status(409).json({ error: 'You already chose your archetype' });
    req.player.archetype = key;
    await req.player.save();
    res.json({ player: req.player.toPublic() });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me  (auth) -> the logged-in player's own record
router.get('/me', auth, (req, res) => {
  res.json({ player: req.player.toPublic(), email: req.player.email });
});

module.exports = router;
