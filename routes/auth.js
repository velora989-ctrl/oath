const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Player = require('../models/Player');
const auth = require('../middleware/auth');

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

    const passwordHash = await bcrypt.hash(password, 10);
    const player = await Player.create({ name, email, passwordHash });
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

// GET /api/auth/me  (auth) -> the logged-in player's own record
router.get('/me', auth, (req, res) => {
  res.json({ player: req.player.toPublic(), email: req.player.email });
});

module.exports = router;
